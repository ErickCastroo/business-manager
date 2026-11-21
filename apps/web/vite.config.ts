import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { parseEnv } from 'node:util';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The root .env also configures the API's NODE_ENV. Only the public URL belongs in Vite.
const rootEnv = new URL('../../.env', import.meta.url);
const rootApiUrl = existsSync(rootEnv)
  ? parseEnv(readFileSync(rootEnv, 'utf8')).VITE_API_URL
  : undefined;
const apiUrl = process.env.VITE_API_URL ?? rootApiUrl;

export default defineConfig({
  define: apiUrl === undefined ? {} : { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl) },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'radix-ui',
              priority: 20,
              test: /node_modules[\\/](?:radix-ui|@radix-ui)[\\/]/,
            },
            {
              name: 'validation',
              priority: 20,
              test: /node_modules[\\/]zod[\\/]/,
            },
            {
              name: 'react-runtime',
              priority: 20,
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
            },
          ],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
