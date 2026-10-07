import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('../dist/', import.meta.url);
const worker = new URL('sw.js', root);
const source = await readFile(worker, 'utf8');
const paths = JSON.parse(source.match(/const SHELL=(\[[^;]+\]);/)[1].replaceAll("'", '"'));
const hash = createHash('sha256');
for (const path of [...new Set(paths.filter(path => path !== './'))].sort()) {
  hash.update(path);
  hash.update(await readFile(new URL(path, root)));
}
// Include worker behavior without its generated fingerprint to keep builds stable.
hash.update(source.replace(/const CACHE='[^']+';/, "const CACHE='';"));
const version = hash.digest('hex').slice(0, 20);
await writeFile(worker, source.replace(/const CACHE='[^']+';/, `const CACHE='money-bubble-shell-${version}';`));
console.log(`App shell: ${version}`);
