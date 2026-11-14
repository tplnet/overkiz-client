#!/usr/bin/env node
/**
 * Prints the release notes of one version: its section of CHANGELOG.md plus a link to the full changelog.
 * Used by the release workflows to fill the GitHub release; fails if the version has no (or an empty) section,
 * so that a release cannot go out without a description of its changes.
 *
 * Usage: node scripts/release-notes.mjs [version] [tag]    e.g. node scripts/release-notes.mjs 2.3.9
 * Without a version, the version from package.json is used (npm "version" script: checked during `npm version`).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const version = (process.argv[2] ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version).replace(/^v/, '');
const tag = process.argv[3] ?? `v${version}`;
if (!version) {
    console.error('Usage: node scripts/release-notes.mjs <version> [tag]');
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

const repository = process.env.GITHUB_REPOSITORY;
const link = repository ? `https://github.com/${repository}/blob/${tag}/CHANGELOG.md` : 'CHANGELOG.md';
console.log(`${body}\n\n**Full changelog:** [CHANGELOG.md](${link})`);
