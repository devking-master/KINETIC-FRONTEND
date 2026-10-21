// Runs before every build. Anything named VITE_* is compiled into the public JavaScript bundle,
// so a secret-looking name there is a leak waiting to happen. Fail the build instead of shipping it.
import { existsSync, readFileSync } from 'node:fs';

const SUSPICIOUS = /(SECRET|KEY|TOKEN|PASSWORD|PRIVATE)/i;
const names = new Set(Object.keys(process.env).filter((name) => name.startsWith('VITE_')));

for (const file of ['.env', '.env.local', '.env.production', '.env.development']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(VITE_[A-Za-z0-9_]+)\s*=/);
    if (match) names.add(match[1]);
  }
}

const offenders = [...names].filter((name) => SUSPICIOUS.test(name));
if (offenders.length > 0) {
  console.error('\nBuild stopped: these VITE_ variables look like secrets and would be published in the app bundle:');
  for (const name of offenders) console.error(`  - ${name}`);
  console.error('Rename them or move the value to the server (Render) instead.\n');
  process.exit(1);
}
console.log('check-env: no secret-looking VITE_ variables.');
