import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2015',
    assetsInlineLimit: 4096, // 4kb'ye kadar olan dosyaları inline yap
  },
  server: {
    host: true, // tüm ağ arayüzlerinde dinle (0.0.0.0)
    port: 3000,
    strictPort: true,
  },
});