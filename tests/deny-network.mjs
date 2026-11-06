import { beforeEach, afterEach, expect } from 'vitest';
import { installOfflineGuard } from '../scripts/offline-guard.mjs';
let guard;
beforeEach(() => { guard = installOfflineGuard(); });
afterEach(() => {
  const attempts = guard.attempts;
  guard.restore();
  expect(attempts, 'No external network attempt is allowed').toBe(0);
});
