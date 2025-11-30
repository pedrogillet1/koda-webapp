module.exports = {
  apps: [{
    name: "koda-backend",
    script: "./dist/server.js",
    cwd: "/home/koda/koda-webapp/backend",
    env: {
      NODE_ENV: "production"
    },
    node_args: "-r dotenv/config"
  }]
};
