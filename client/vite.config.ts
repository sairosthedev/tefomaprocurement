import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  },
  build: {
    // @fossil/shared is a CommonJS workspace package. Rollup's commonjs
    // plugin only processes `node_modules/**` by default, so we extend it
    // to cover the linked workspace path as well.
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]shared/]
    },
    rollupOptions: {
      output: {
        // Libraries change far less often than the app, so a deploy leaves
        // this chunk cached in users' browsers.
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios']
        }
      }
    }
  },
  // Do not pre-bundle the workspace package — it changes often and a stale
  // .vite/deps cache causes "does not provide an export named …" errors.
  optimizeDeps: {
    exclude: ['@fossil/shared']
  }
});
