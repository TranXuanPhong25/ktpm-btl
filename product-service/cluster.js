const cluster = require('cluster');
const os = require('os');

const numCPUs = process.env.NODE_CLUSTER_WORKERS || os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);
  console.log(`Forking ${numCPUs} workers...`);

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died. Restarting...`);
    cluster.fork();
  });
} else {
  // Workers share the same TCP connection
  require('./index.js');
  console.log(`Worker ${process.pid} started`);
}
