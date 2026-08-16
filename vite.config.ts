import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const podPort = process.env.COFFEE_POD_PORT || env.COFFEE_POD_PORT || '8733';
  const podProxy = () => ({
    target: `http://127.0.0.1:${podPort}`,
    changeOrigin: true,
    ...(env.COFFEE_POD_API_TOKEN
      ? { headers: { authorization: `Bearer ${env.COFFEE_POD_API_TOKEN}` } }
      : {}),
  });

  return {
    plugins: [tailwindcss(), react()],
    root: 'ui',
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'ui/src'),
      },
    },
    server: {
      port: 5173,
      host: '127.0.0.1',
      proxy: {
        // Registry proxies — go direct to external APIs (no backend needed)
        '/pod/skills/registry/clawhub': {
          target: 'https://clawhub.ai/api/v1',
          changeOrigin: true,
          rewrite: (p: string) => p.replace('/pod/skills/registry/clawhub/', '/'),
        },
        '/pod/skills/registry/skillsmp': {
          target: 'https://skillsmp.com/api/v1',
          changeOrigin: true,
          rewrite: (p: string) => p.replace('/pod/skills/registry/skillsmp/', '/'),
        },
        // skills.sh does not expose a stable JSON catalog. Keep its RSC
        // adaptation and cache in the Pod backend so development exercises the
        // same normalized contract as the packaged app.
        '/pod/skills/registry/skillssh': podProxy(),
        // The browser-based dev UI has no Electron preload, so it cannot read
        // the per-install owner token. Keep the token server-side and attach it
        // at the local proxy boundary instead of exposing it to browser code.
        '/pod': podProxy(),
        '/coffee': podProxy(),
        '/health': podProxy(),
        '/integrations': podProxy(),
      },
    },
    build: {
      outDir: '../dist-ui',
      emptyOutDir: true,
      // Keep vendor code grouped by entry without size-splitting lazy dependency
      // graphs. Splitting Plate/Slate by size creates circular chunks that fail
      // during module initialization when Journal or a document is opened.
      chunkSizeWarningLimit: 650,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor',
                test: /node_modules[\\/]/,
                minSize: 100_000,
                priority: 10,
                entriesAware: true,
              },
            ],
          },
        },
      },
    },
  };
});
