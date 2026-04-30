module.exports = {
  apps: [
    {
      name: "billsutra-api",
      cwd: "./server",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        APP_ENV: "production",
        NODE_ENV: "production",
        ENABLE_SCHEDULER: "false",
      },
    },
    {
      name: "billsutra-worker",
      cwd: "./server",
      script: "dist/queues/worker.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        APP_ENV: "production",
        NODE_ENV: "production",
      },
    },
    {
      name: "billsutra-scheduler",
      cwd: "./server",
      script: "dist/index.js",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "512M",
      env: {
        APP_ENV: "production",
        NODE_ENV: "production",
        ENABLE_SCHEDULER: "true",
      },
    },
  ],
};
