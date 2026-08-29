module.exports = {
  apps: [
    {
      name: "guardian-telegram",
      script: "npm",
      args: "run telegram",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "guardian-agent",
      script: "npm",
      args: "run agent",
      cwd: __dirname,
      autorestart: true,
      max_restarts: 10,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
