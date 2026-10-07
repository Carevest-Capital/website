import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  server: { port: 5190, fs: { allow: [path.resolve(__dirname, '..')] } },
  resolve: { alias: { '@shared': path.resolve(__dirname, '../shared'), '@seed': path.resolve(__dirname, '../site/content') } },
  build: { outDir: 'dist', emptyOutDir: true }
});
