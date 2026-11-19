#!/usr/bin/env node
/**
 * Prints the release notes of one version: its section of CHANGELOG.md, optionally the checks of this release,
 * and a link to the changelog. Used by the release workflows to fill the GitHub release; fails if the version
 * has no (or an empty) section, so that a release cannot go out without a description of its changes.
 *
 * Usage: node scripts/release-notes.mjs [version] [tag] [--checks | --keep-checks=<file>]    e.g. node scripts/release-notes.mjs 2.3.9
 * Without a version, the version from package.json is used (npm "version" script: checked during `npm version`).
 * --checks (publish workflow only) adds what was verified before this release: no known vulnerabilities, the Node.js
 * versions of the CI matrix and, if HOMEBRIDGE_VERSION is set, the newest Homebridge release the package was started with.
 * --keep-checks=<file> (release notes workflow) takes the "Checked for this release" section from the current
 * description of the release (saved in <file>), so refilling a release doesn't drop the checks of its publish run.
 * Same format in all tplnet Homebridge projects.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const keepChecksFrom = process.argv.find((arg) => arg.startsWith('--keep-checks='))?.slice('--keep-checks='.length);
const withChecks = process.argv.includes('--checks');
const version = (args[0] ?? pkg.version).replace(/^v/, '');
const tag = args[1] ?? `v${version}`;
if (!version) {
    console.error('Usage: node scripts/release-notes.mjs <version> [tag] [--checks | --keep-checks=<file>]');
    process.exit(2);
}

const lines = readFileSync(join(root, 'CHANGELOG.md'), 'utf8').split(/\r?\n/);
const escaped = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const start = lines.findIndex((line) => new RegExp(`^## \\[?v?${escaped}\\]?(\\s|$)`).test(line));
if (start === -1) {
    console.error(`CHANGELOG.md has no section "## ${version}" - please describe the changes of this release there.`);
    process.exit(1);
}
let end = lines.findIndex((line, index) => index > start && /^## /.test(line));
if (end === -1) {
    end = lines.length;
}
const body = lines.slice(start + 1, end).join('\n').trim();
if (!body) {
    console.error(`The section "## ${version}" in CHANGELOG.md is empty - please describe the changes of this release.`);
    process.exit(1);
}

const parts = [body];
if (withChecks) {
    const checks = [];
    const homebridge = process.env.HOMEBRIDGE_VERSION;
    if (homebridge) {
        checks.push(`Starts with the newest Homebridge release (${homebridge}) on Node.js ${process.versions.node}`);
    }
    checks.push('No known vulnerabilities (CVEs) in the runtime dependencies (`npm audit`)');
    checks.push('No known malicious packages in the dependencies (OSV) and no malware in the package (ClamAV)');
    const matrix = /^\s*node:\s*\[([^\]]+)\]/m.exec(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8'));
    if (matrix) {
        checks.push(`Built and tested with Node.js ${matrix[1].split(',').map((node) => node.trim()).join(', ')}`);
    }
    if (pkg.engines?.homebridge) {
        checks.push(`Supports Homebridge \`${pkg.engines.homebridge}\``);
    }
    parts.push(`### Checked for this release\n\n${checks.map((check) => `- ${check}`).join('\n')}`);
}
if (!withChecks && keepChecksFrom && existsSync(keepChecksFrom)) {
    const previous = /^### Checked for this release\r?\n[\s\S]*?(?=\r?\n\*\*Changelog:\*\*|\r?\n## |$(?![\s\S]))/m.exec(readFileSync(keepChecksFrom, 'utf8'));
    if (previous) {
        parts.push(previous[0].trim());
    }
}
const repository = process.env.GITHUB_REPOSITORY;
const link = repository ? `https://github.com/${repository}/blob/${tag}/CHANGELOG.md` : 'CHANGELOG.md';
parts.push(`**Changelog:** [CHANGELOG.md](${link})`);
console.log(parts.join('\n\n'));
