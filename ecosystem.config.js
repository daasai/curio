module.exports = {
  apps: [
    {
      name: 'curio-api',
      cwd: '/var/www/curio',
      // The controlled deploy workflow passes a deploy-account-owned, versioned
      // Bun path through BUN_BIN. Keep the legacy path only for existing local
      // operator invocations that do not provide that explicit release input.
      script: process.env.BUN_BIN || '/root/.bun/bin/bun-1.2.18',
      args: 'run apps/api/src/server.ts',
      env: {
        // The public DAAS site is HTTPS-only. Curio remains an invited pilot,
        // but its session cookie and API origin policy follow production
        // security boundaries on the verified hostname.
        NODE_ENV: 'production',
        ALLOW_HTTP_COOKIES: 'false',
        ALLOWED_ORIGINS: 'https://www.daaskit.com,https://cu.daas.ai',
        CURIO_PILOT_MODE: 'true',
        PORT: 5123,
        DB_PATH: './data/curio.db'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M'
    }
  ]
};
