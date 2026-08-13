import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createTestDb } from './test-utils';

let server: any;
let cleanupFn: () => void;
let dbPathVal: string;
let baseUrl: string;

beforeAll(async () => {
  const testDb = createTestDb();
  cleanupFn = testDb.cleanup;
  dbPathVal = testDb.dbPath;
  server = (await import('../src/index')).default;
  baseUrl = `http://localhost`;
});

afterAll(() => {
  if (cleanupFn) cleanupFn();
});

describe('Auth & Progress API', () => {
  it('should prevent testing on production database', () => {
    expect(dbPathVal).not.toContain('data/curio.db');
  });

  it('does not expose legacy userId-authorized routes', async () => {
    const endpoints = [
      new Request(`${baseUrl}/api/user/profile?userId=forged`),
      new Request(`${baseUrl}/api/schedule/daily?userId=forged`),
      new Request(`${baseUrl}/api/report/parent?userId=forged`),
    ];
    for (const request of endpoints) {
      const response = await server.fetch(request);
      expect(response.status).toBe(404);
    }
  });
});
