// pm2 process definitions for Pod dev servers.
// Usage (from this directory):
//   pm2 start ecosystem.config.cjs      # start both
//   pm2 restart all                     # restart both
//   pm2 logs                            # tail logs
//   pm2 stop all / pm2 delete all       # stop / remove
//
// Both apps auto-restart on crash. The backend's `tsx watch` still hot-reloads
// on source edits; pm2 only steps in if the process actually dies.
const PROJECT = '/Users/stevieghiassi/dev/coffee-pod';

const common = {
  cwd: PROJECT,
  interpreter: 'bash',
  autorestart: true,
  max_restarts: 50,
  restart_delay: 2000,
  // Restart if the process wedges and stops responding (memory guard).
  max_memory_restart: '1G',
  time: true, // timestamp log lines
};

module.exports = {
  apps: [
    {
      ...common,
      name: 'coffee-pod-api',
      script: 'scripts/pm2-api.sh',
      out_file: `${PROJECT}/data/logs/api.out.log`,
      error_file: `${PROJECT}/data/logs/api.err.log`,
    },
    {
      ...common,
      name: 'coffee-pod-ui',
      script: 'scripts/pm2-ui.sh',
      out_file: `${PROJECT}/data/logs/ui.out.log`,
      error_file: `${PROJECT}/data/logs/ui.err.log`,
    },
  ],
};
