import { scanSecurityBoundary } from './security-release-check-lib.mjs';

const failures = await scanSecurityBoundary(process.cwd());
if (failures.length) {
  console.error('Production security release check failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Production security release check passed.');
}
