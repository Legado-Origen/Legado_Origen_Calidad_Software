import { describe, expect, it } from 'vitest';
import { systemClock } from '../../src/shared/clock.js';

describe('systemClock', () => {
  it('entrega el instante actual', () => {
    const before = Date.now();

    const now = systemClock.now().getTime();

    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});
