import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@tewelde/funcscript/browser']
  },
  build: {
    commonjsOptions: {
      include: [/funcscript-js/, /node_modules/]
    }
  }
});
