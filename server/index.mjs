import { config } from './config.mjs';
import { createApp } from './app.mjs';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

let server;
try {
  ({ server } = await createApp());
} catch (error) {
  console.error('Failed to initialize application:', error);
  process.exit(1);
}

server.on('error', (error) => {
  console.error('Server error:', error);
  process.exit(1);
});

server.listen(config.port, config.host, () => {
  console.log(`AI WorkMate running at http://${config.host}:${config.port}`);
});
