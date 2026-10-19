// Runs the full click-through once per design (and evolved in dark mode). Exit 1 if any run fails.
//   npm run e2e:all      (E2E_URL / E2E_HEADED are passed through)
import { spawnSync } from 'node:child_process';

const RUNS = ['evolved', 'evolved-dark', 'warm', 'arcade', 'instrument'];
const results = [];
for (const theme of RUNS) {
  console.log(`\n=== E2E_THEME=${theme} ===`);
  const run = spawnSync(process.execPath, ['scripts/e2e-smoke.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, E2E_THEME: theme },
  });
  results.push([theme, run.status === 0]);
}
console.log('\n=== e2e:all summary ===');
for (const [theme, ok] of results) console.log(`${ok ? 'ok  ' : 'FAIL'} ${theme}`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
