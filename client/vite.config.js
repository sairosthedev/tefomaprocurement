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
    // @fosssil/shared is a CommonJS workspace package. Rollup's commonjs
    // plugin only processes `node_modules/**` by default, so we extend it
    // to cover the linked workspace path as well.
    commonjsOptions: {
      include: [/node_modules/, /packages[\\/]shared/]
    }
  },
  optimizeDeps: {
    include: ['@fosssil/shared']
  }
});
