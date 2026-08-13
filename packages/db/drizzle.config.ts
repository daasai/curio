import { defineConfig } from 'drizzle-kit';
import { join } from 'path';

export default defineConfig({
  schema: join(__dirname, './src/schema.ts'),
  out: join(__dirname, './drizzle'),
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_URL || './data/curio.db',
  },
});
