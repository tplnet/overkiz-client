# Usage

[← Back to the README](../README.md)

### Read devices and states

```ts
const devices = await client.getDevices();       // devices with their sensors attached
const device = devices[0];

device.hasState('core:ClosureState');           // true / false
device.getState('core:ClosureState')?.value;    // e.g. 0 … 100

device.on('states', (states) => { /* states changed */ });
```

`getSetup()` returns gateways and devices in one call, `getGateways()` only the gateways.

### Execute a command

```ts
import { Action, Command, Execution, ExecutionState } from '@tplnet/overkiz-client';

const action = new Action(device.deviceURL, [new Command('setClosure', [50])]);
action.on('update', (state: ExecutionState, event) => {
    console.log(`${device.label}: ${state}`);    // TRANSMITTED, IN_PROGRESS, COMPLETED, FAILED …
});

const execId = await client.execute('apply', new Execution('Half open - my app', action));

// cancel if needed
await client.cancelExecution(execId);
```

Available commands depend on the device; see `device.definition.commands`.

### Client events

```ts
client.on('connect', () => console.log('logged in'));
client.on('disconnect', () => console.log('session lost, will reconnect'));
```

### Other methods

| Method | Description |
|---|---|
| `refreshAllStates()` | Ask for a full state refresh (local: re-reads all devices) |
| `refreshDeviceStates(deviceURL)` | Refresh one device (cloud only) |
| `getStates(deviceURL)` / `getState(deviceURL, name)` | Read states directly from the API |
| `getActionGroups()` | Scenarios (cloud only, empty list locally) |
| `getSetupLocation()` | Setup location (cloud only) |
| `isLocal` | `true` when using the local API |
