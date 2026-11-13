import { EventEmitter } from 'events';
import Device from './models/Device';
import ActionGroup from './models/ActionGroup';
import { State } from './models/Device';
import Execution, { ExecutionState, ExecutionError } from './models/Execution';
import ApiClient, { CloudApiClient, CloudJWTApiClient, LocalApiClient } from './ApiClient';
import Location from './models/Location';
import Gateway from './models/Gateway';
import Setup from './models/Setup';
import LocalApiToken from './models/LocalApiToken';

export let logger;
export let interceptor;

const EXEC_TIMEOUT = 2 * 60 * 1000;
// Cloud API: POST /setup/devices/states/refresh and GET /setup/devices are limited to 1 call per day and session
const CLOUD_REFRESH_MINUTES = 24 * 60;
// Upper bound (in seconds) of the back-off after event polling errors, e.g. while the gateway reboots
const MAX_POLLING_ERROR_LOCK = 300;
// setInterval() overflows above 2^31-1 ms
const MAX_TIMER_SECONDS = Math.floor(2147483647 / 1000);


function getApiClient(service: string): ApiClient {
    switch (service.toLowerCase()) {
        case 'local': return new LocalApiClient();
        case 'tahoma':
        case 'tahoma_switch':
        case 'connexoon':
        case 'somfy_europe': return new CloudApiClient('ha101-1.overkiz.com');
        case 'connexoon_rts':
        case 'somfy_australia': return new CloudApiClient('ha201-1.overkiz.com');
        case 'somfy_north_america': return new CloudApiClient('ha401-1.overkiz.com');
        case 'flexom': return new CloudApiClient('ha108-1.overkiz.com');
        case 'cozytouch': return new CloudJWTApiClient(
            'ha110-1.overkiz.com',
            'https://apis.groupe-atlantic.com/token',
            'https://apis.groupe-atlantic.com/magellan/accounts/jwt',
            'Q3RfMUpWeVRtSUxYOEllZkE3YVVOQmpGblpVYToyRWNORHpfZHkzNDJVSnFvMlo3cFNKTnZVdjBh',
        );
        case 'rexel': return new CloudApiClient('ha112-1.overkiz.com');
        case 'hi_kumo': return new CloudApiClient('ha117-1.overkiz.com');
        default: throw new Error('Invalid service name: ' + service);
    }
}

export default class OverkizClient extends EventEmitter {
    private api: ApiClient;

    private service: string;

    private fetchLock = false;
    private refreshLock = false;
    private executionPool: Record<string, Execution> = {};

    private devices: Array<Device> = new Array<Device>();

    private pollingPeriod: number;
    private refreshPeriod: number;
    private execPollingPeriod: number;
    private eventPollingPeriod = 0;
    private pollingErrorLockDuration = 10;

    private pollingTaskId: NodeJS.Timeout | null = null;
    private refreshTaskId: NodeJS.Timeout | null = null;
    private listenerId: null | string = null;

    constructor(public readonly log, public readonly config) {
        super();
        logger = log;
        // Default values
        this.service = config['service'] || 'somfy_europe';
        // Event polling (in seconds). The local API has no rate limit (Somfy: at most once per second),
        // so poll faster there; the cloud keeps 60 s. During executions poll every execPollingPeriod.
        this.execPollingPeriod = config['execPollingPeriod'] || (this.isLocal ? 2 : 5);
        this.pollingPeriod = config['pollingPeriod'] || (this.isLocal ? 5 : 60);
        // Periodic full-state refresh (in minutes, 0 = disabled). The cloud API allows the bulk
        // state refresh only once per day and session, so default to once a day there.
        this.refreshPeriod = (config['refreshPeriod'] ?? (this.isLocal ? 30 : CLOUD_REFRESH_MINUTES)) * 60;
        this.refreshPeriod = Math.min(this.refreshPeriod, MAX_TIMER_SECONDS);

        if (this.refreshPeriod === 0) {
            this.log.info('refreshPeriod is 0: periodic full-state refresh disabled.');
        } else if (!this.isLocal && this.refreshPeriod < CLOUD_REFRESH_MINUTES * 60) {
            this.log.warn('WARNING: refreshPeriod below ' + CLOUD_REFRESH_MINUTES + ' minutes exceeds the cloud API rate limit'
                + ' (1 state refresh per day) and leads to 429 QUOTA_EXCEEDED errors.');
        } else if (this.refreshPeriod < 1800) {
            this.log.warn('WARNING: Setting refreshPeriod lower than 30 minutes is discouraged.');
        }
        if (this.pollingPeriod < 10 && this.pollingPeriod !== 0 && this.service !== 'local') {
            this.log.error('ERROR: pollingPeriod must be higher than 10 or equals to 0.');
            this.pollingPeriod = 60;
        }
        if (this.pollingPeriod < 30 && this.service !== 'local') {
            this.log.warn('WARNING: Setting pollingPeriod lower than 30 seconds is discouraged.');
        }
        if (this.pollingPeriod > 60 && this.service !== 'local') {
            this.log.warn('WARNING: Setting pollingPeriod higher than 60 seconds can generate session timeout errors.');
        }

        interceptor = (request) => {
            if (config['proxy']) {
                const url = new URL(request.url?.startsWith('http') ? request.url : ((request.baseURL ?? '') + request.url));
                request.baseURL = config['proxy'];
                request.url = url.pathname;
                if (request.headers === undefined) {
                    request.headers = {};
                }
                request.headers['X-Forward-Host'] = url.host;
            }
            logger.debug(request.method?.toUpperCase(), request.url);
            return request;
        };

        this.api = getApiClient(this.service);
        if (this.api instanceof LocalApiClient && config['tlsInsecure']) {
            this.api.setInsecureTls(true);
        }
        if (config['user'] && config['password']) {
            this.api.setCredentials(config['user'], config['password']);
        }

        this.api.on('connect', () => {
            this.emit('connect');
            this.setRefreshTaskPeriod(this.refreshPeriod);
            this.setPollingTaskPeriod(this.pollingPeriod);
        });
        this.api.on('disconnect', () => {
            this.emit('disconnect');
            this.setRefreshTaskPeriod(0);
            this.setPollingTaskPeriod(0);
        });
    }

    /** True when talking to the local API of the gateway (developer mode). */
    public get isLocal(): boolean {
        return this.service.toLowerCase() === 'local';
    }

    public connect(user: string, password: string) {
        this.api.setCredentials(user, password);
        return this.api.connect();
    }

    public hasExecution(execId?: string) {
        if (execId) {
            return execId in this.executionPool;
        } else {
            return Object.keys(this.executionPool).length > 0;
        }
    }

    private async registerListener() {
        if (this.listenerId === null) {
            //logger.debug('Registering event listener...');
            const data = await this.api.post('/events/register');
            this.listenerId = data.id;
        }
    }

    private async unregisterListener() {
        if (this.listenerId !== null) {
            //logger.debug('Unregistering event listener...');
            await this.api.post('/events/' + this.listenerId + '/unregister');
            this.listenerId = null;
        }
    }

    /*
        oid: The command OID or 'apply' if immediate execution
        execution: Body parameters
        callback: Callback function executed when command sended
    */
    async execute(oid, execution) {
        //logger.debug(JSON.stringify(execution));
        if (Object.keys(this.executionPool).length >= 10) {
            // Avoid EXEC_QUEUE_FULL (max 10 commands simultaneous)
            // Postpone in 10 sec
            await this.delay(10 * 1000);
            return await this.execute(oid, execution);
        }
        try {
            if (this.isLocal && oid !== 'apply') {
                // The local API only offers /exec/apply (no high priority, no persisted action groups)
                if (oid === 'apply/highPriority') {
                    oid = 'apply';
                } else {
                    throw new Error('Not supported by the local API: /exec/' + oid);
                }
            }
            const data = await this.api.post('/exec/' + oid, execution);
            this.executionPool[data.execId] = execution;

            // Update event poller for execution monitoring
            this.setPollingTaskPeriod(this.execPollingPeriod);

            // Auto remove execution in case of timeout (eg: listener event missed, listener registration fails)
            setTimeout(() => {
                const execution = this.executionPool[data.execId];
                if (execution) {
                    execution.onStateUpdate(ExecutionState.TIMED_OUT, null);
                    delete this.executionPool[data.execId];
                }
            }, EXEC_TIMEOUT);

            return data.execId;
        } catch (error) {
            throw new ExecutionError(ExecutionState.FAILED, error);
        }
    }

    private setRefreshTaskPeriod(period: number) {
        // Clear previous task
        if (this.refreshTaskId) {
            clearInterval(this.refreshTaskId);
            this.refreshTaskId = null;
        }
        if (period > 0) {
            this.refreshTaskId = setInterval(this.refreshTask.bind(this), period * 1000);
        }
    }

    private async setPollingTaskPeriod(period: number) {
        if (period !== this.eventPollingPeriod) {
            this.eventPollingPeriod = period;

            // Clear previous task
            if (this.pollingTaskId) {
                clearInterval(this.pollingTaskId);
                this.pollingTaskId = null;
            }

            if (period > 0) {
                this.pollingTaskId = setInterval(this.pollingTask.bind(this), period * 1000);
                if (this.listenerId === null) {
                    logger.debug('Enable event polling period every ' + period + ' sec');
                    // Run immediately the first execution to register listener
                    this.pollingTask();
                } else {
                    logger.debug('Change event polling period to ' + period + ' sec');
                }
            } else {
                logger.debug('Disable event polling');
                this.listenerId = null;
            }
        }
    }

    private async refreshTask() {
        try {
            //logger.debug('Refresh all devices');
            await this.refreshAllStates();
        } catch (error) {
            logger.error(error);
        }
    }

    private async pollingTask() {
        if (this.eventPollingPeriod !== this.pollingPeriod && !this.hasExecution()) {
            // Restore default polling frequency if no more execution in progress
            this.setPollingTaskPeriod(this.pollingPeriod);
        } else if (!this.fetchLock) {
            // Execute task if not already running
            this.fetchLock = true;
            await this.fetchEvents();
            this.fetchLock = false;
        }
    }

    private async fetchEvents() {
        if (this.listenerId !== null) {
            try {
                //logger.debug('Polling events...');
                const data = await this.api.post('/events/' + this.listenerId + '/fetch', undefined, false);
                for (const event of data) {
                    //logger.debug(event);
                    if (event.name === 'DeviceStateChangedEvent') {
                        const device = this.devices[event.deviceURL];
                        device?.updateStates(event.deviceStates);
                    } else if (event.name === 'ExecutionStateChangedEvent') {
                        const execution = this.executionPool[event.execId];
                        if (execution) {
                            execution.onStateUpdate(event.newState, event);
                            if (event.timeToNextState === -1) {
                                // No more state expected for this execution
                                delete this.executionPool[event.execId];
                            }
                        }
                    } else if (event.name === 'RefreshAllDevicesStatesCompletedEvent') {
                        this.refreshLock = false;
                        logger.debug('Refresh all states completed');
                        // Changed states arrive as DeviceStateChangedEvent. Do not re-read all devices here:
                        // GET /setup/devices is limited to once per day and session on the cloud API.
                    }
                }
                this.pollingErrorLockDuration = 10;
            } catch (error: unknown) {
                if (typeof error === 'string' && error.includes('400') && error.includes('No registered event listener')) {
                    // Expected after a gateway restart or session change: register a new listener right away
                    logger.info('Event listener expired (gateway restarted?), registering a new one');
                    this.listenerId = null;
                } else {
                    logger.error('Polling error -', error);
                    if (typeof error === 'string' && (error.includes('400') || error.includes('401') || error.includes('404'))) {
                        // If not registered (400/404) or disconnected (401)
                        this.listenerId = null;
                    }
                    // Will lock the poller in case of unknown error
                    await this.delay(this.pollingErrorLockDuration * 1000);
                    this.pollingErrorLockDuration = Math.min(this.pollingErrorLockDuration * 2, MAX_POLLING_ERROR_LOCK);
                }
            }
        }
        if (this.listenerId === null) {
            try {
                await this.registerListener();
                this.pollingErrorLockDuration = 10;
            } catch (error) {
                logger.error('Registration error -', error);
                // Will lock the poller in case of error
                await this.delay(this.pollingErrorLockDuration * 1000);
                this.pollingErrorLockDuration = Math.min(this.pollingErrorLockDuration * 2, MAX_POLLING_ERROR_LOCK);
            }

        }
    }

    private async delay(duration) {
        return new Promise(resolve => setTimeout(resolve, duration));
    }

    private attachDevices(data) {
        const devices = data.map((device) => Object.assign(new Device(), device));
        let lastMainDevice: Device | null = null;
        let lastDevice: Device | null = null;
        let lastSubDevices: Array<Device>;
        const physicalDevices = new Array<Device>();
        devices.forEach((device) => {
            if (this.devices[device.deviceURL]) {
                //Object.assign(this.devices[device.deviceURL], device);
            } else {
                this.devices[device.deviceURL] = device;
            }
            if (device.isMainDevice()) {
                lastMainDevice = device;
                lastDevice = device;
                lastSubDevices = [device];
                physicalDevices.push(device);
            } else {
                if (lastDevice !== null && device.isSensorOf(lastDevice)) {
                    lastDevice.addSensor(device);
                } else if (lastMainDevice !== null && device.isSensorOf(lastMainDevice)) {
                    lastMainDevice.addSensor(device);
                } else {
                    let found = false;
                    for (const d of lastSubDevices) {
                        if (device.isSensorOf(d)) {
                            found = true;
                            d.addSensor(device);
                        }
                    }
                    if (!found) {
                        lastDevice = device;
                        lastSubDevices.push(device);
                        device.parent = lastMainDevice;
                        physicalDevices.push(device);
                    }
                }
            }
        });
        return physicalDevices;
    }

    public async getSetupLocation(): Promise<Location> {
        return await this.api.get('/setup/location') as Location;
    }

    public async getActionGroups(): Promise<Array<ActionGroup>> {
        if (this.isLocal) {
            logger.warn('Scenarios (action groups) are not available with the local API.');
            return [];
        }
        return this.api.get('/actionGroups');
    }

    public async refreshAllStates(devices: Array<string> = []) {
        if (this.isLocal) {
            // The local API has no state refresh endpoint, but reading the devices is not rate limited
            await this.refreshDevices();
            return;
        }
        this.refreshLock = true;
        await this.api.post('/setup/devices/states/refresh', devices).catch((error) => logger.warn('State refresh failed:', error));

        // Changed states arrive as DeviceStateChangedEvent. No fallback re-read of all devices here,
        // GET /setup/devices is limited to once per day and session on the cloud API.
        setTimeout(() => this.refreshLock = false, 30 * 1000);
    }

    public async refreshDeviceStates(deviceURL: string) {
        if (this.isLocal) {
            // Not available with the local API, states are pushed through events anyway
            logger.debug('Device state refresh not available with the local API:', deviceURL);
            return;
        }
        await this.api.post('/setup/devices/' + encodeURIComponent(deviceURL) + '/states/refresh');
    }

    public async refreshDevices() {
        const devices = await this.getDevices();
        devices.forEach((freshDevice) => {
            const device = this.devices[freshDevice.deviceURL];
            if (device) {
                device.updateStates(freshDevice.states);
            }
        });
    }

    public async getState(deviceURL, state) {
        const data = await this.api.get('/setup/devices/' + encodeURIComponent(deviceURL) + '/states/' + encodeURIComponent(state));
        return data.value;
    }

    public async getStates(deviceURL): Promise<Array<State>> {
        const states = await this.api.get('/setup/devices/' + encodeURIComponent(deviceURL) + '/states');
        return states;
    }

    public async cancelExecution(execId) {
        return await this.api.delete('/exec/current/setup/' + execId);
    }

    public async getExecutionHistory(): Promise<Array<Execution>> {
        return await this.api.get('/history/executions');
    }

    public async getSetup(): Promise<Setup> {
        const data = await this.api.get('/setup');
        data.devices = this.attachDevices(data.devices);
        return data;
    }

    public async getGateways(): Promise<Array<Gateway>> {
        return await this.api.get('/setup/gateways');
    }

    public async getDevices(): Promise<Array<Device>> {
        const data = await this.api.get('/setup/devices');
        return this.attachDevices(data);
    }

    public async setDeviceName(deviceURL, label) {
        await this.api.put(`/setup/devices/${encodeURIComponent(deviceURL)}/${label}`);
    }

    public async createLocalApiToken(gatewayPin: string, tokenLabel: string) {
        const data = await this.api.get('/config/' + gatewayPin + '/local/tokens/generate');
        logger.debug(data);
        const token = {
            label: tokenLabel,
            gatewayId: gatewayPin,
            token: data.token,
            scope: 'devmode',
        };
        const resp = await this.api.post('/config/' + gatewayPin + '/local/tokens', token);
        logger.debug(resp);
        return token;
    }

    public async getLocalApiTokens(gatewayPin: string): Promise<LocalApiToken[]> {
        return await this.api.get('/config/' + gatewayPin + '/local/tokens/devmode');
    }

    public async deleteLocalApiToken(gatewayPin: string, tokenUuid: string) {
        return await this.api.delete('/config/' + gatewayPin + '/local/tokens/' + tokenUuid);
    }
}
