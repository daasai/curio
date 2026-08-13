import { describe, it, expect } from 'bun:test';
import { calculateSM2 } from '../src/scheduler/sm2';
import { createTestDb } from './test-utils';
import { toShanghaiDate } from '../src/utils';

describe('SM-2 Algorithm', () => {
  it('should verify test db factory path protection', () => {
    const { dbPath, cleanup } = createTestDb();
    expect(dbPath).not.toContain('data/curio.db');
    cleanup();
  });

  it('should calculate initial interval correctly', () => {
    const res = calculateSM2(5, 0, 2.5);
    expect(res.interval).toBe(1);
    expect(res.easeFactor).toBe(2.6);
  });

  it('uses the Asia/Shanghai learning day at the UTC day boundary', () => {
    expect(toShanghaiDate('2026-08-10T16:00:00.000Z')).toBe('2026-08-11');
  });

  it('should reset interval on incorrect answer', () => {
    const res = calculateSM2(2, 8, 2.8);
    expect(res.interval).toBe(1);
    expect(res.easeFactor).toBe(2.48);
  });
});
