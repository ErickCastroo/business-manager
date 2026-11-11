import { config as loadDotEnv } from 'dotenv';
import { resolve } from 'node:path';

let environmentLoaded = false;

export function loadEnvironment(): void {
  if (environmentLoaded) {
    return;
  }

  loadDotEnv({
    path: resolve(import.meta.dirname, '../../../../.env'),
    quiet: true,
  });
  environmentLoaded = true;
}
