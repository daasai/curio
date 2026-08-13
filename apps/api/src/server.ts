import app from './index';
import { assertSecurityConfig } from './auth';
import { ensureRuntimeSchema } from './runtime-schema';
import { join } from 'path';

const port = Number(process.env.PORT) || 8899;
const hostname = process.env.HOST || '127.0.0.1';

assertSecurityConfig();
ensureRuntimeSchema(process.env.DB_PATH || join(__dirname, '../../../data/curio.db'));

console.log(`🚀 Curio API Server running at http://${hostname}:${port}`);

const server = Bun.serve({
  port,
  hostname,
  fetch: app.fetch,
});
