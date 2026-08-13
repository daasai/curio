import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { ContentCorruptError } from './utils';
import { authRoutes } from './auth';
import { learningRoutes } from './learning';
import { reportRoutes } from './report';

const app = new Hono();

const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use('/*', cors({
  origin: (origin) => {
    if (process.env.NODE_ENV !== 'production') return origin || 'http://localhost:5173';
    return configuredOrigins.includes(origin) ? origin : undefined;
  },
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
}));

app.onError((error, c) => {
  if (error instanceof ContentCorruptError) {
    return c.json({ error: { code: 'CONTENT_CORRUPT', retryable: false } }, 422);
  }
  console.error('Unhandled API error', error);
  return c.json({ error: { code: 'INTERNAL_ERROR', retryable: true } }, 500);
});

app.get('/api/health', (c) => {
  return c.json({ status: 'ok', time: new Date().toISOString() });
});

app.route('', authRoutes);
app.route('', learningRoutes);
app.route('', reportRoutes);

export default app;
