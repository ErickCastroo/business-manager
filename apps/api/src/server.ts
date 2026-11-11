import { app } from './app.js';
import { logger } from './lib/logger.js';

const DEFAULT_PORT = 4000;

function resolvePort(rawPort: string | undefined): number {
  if (rawPort === undefined) {
    return DEFAULT_PORT;
  }

  const port = Number(rawPort);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

const port = resolvePort(process.env.PORT);
const server = app.listen(port, () => {
  logger.info({ port }, 'API server listening');
});

server.on('error', (error) => {
  logger.fatal({ err: error, port }, 'API server failed to start');
  process.exitCode = 1;
});
