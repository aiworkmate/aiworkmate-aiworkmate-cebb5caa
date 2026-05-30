import { config } from './config.mjs';
import { createApp } from './app.mjs';

const { server } = await createApp();

server.listen(config.port, config.host, () => {
  console.log(`AI WorkMate running at http://${config.host}:${config.port}`);
});
