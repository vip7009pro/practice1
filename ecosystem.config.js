module.exports = {
  apps: [
    {
      name: 'index',
      script: 'index.js',
      watch: true,
      ignore_watch: ['node_modules', 'outbinary', 'log', '.git', 'dist', 'build'],
      watch_options: {
        followSymlinks: false,
        usePolling: false,
      },
      max_restarts: 20,
      restart_delay: 500,
      env: {
        NODE_ENV: 'development',
      },
    },
  ],
};
