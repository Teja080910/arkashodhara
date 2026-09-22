/**
 * Arkasodhara — PM2 process definition.
 *
 * Runs the Next.js production server on port 3117, dedicated so it never
 * collides with the other apps on this VPS (Agrinp 3000, tent-on-rent 3020,
 * astro-shine 3067, kavi-solutions 3111).
 *
 * The port can be overridden at deploy time:
 *   PORT=3200 ./deploy/deploy.sh
 * If you change it, update BOTH this default and proxy_pass in deploy/nginx.conf.
 */
const PORT = process.env.PORT || 3117;

module.exports = {
  apps: [
    {
      name: 'arkasodhara',
      script: 'node_modules/next/dist/bin/next',
      args: `start -p ${PORT}`,
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: String(PORT),
      },
    },
  ],
};
