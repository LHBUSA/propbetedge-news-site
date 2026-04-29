import { defineConfig } from 'vite';
export default defineConfig({
  build: { outDir: 'dist', sourcemap: false, target: 'es2020' },
  server: { port: 5173 },
});
