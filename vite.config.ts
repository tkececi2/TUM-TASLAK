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
    host: '0.0.0.0', // tüm ağ arayüzlerinde dinle
    port: 3000,
    strictPort: true,
    hmr: {
      host: '0.0.0.0',
      clientPort: 443,
    },
    watch: {
      usePolling: true,
    },
    allowedHosts: ['all', '59c3c0ea-b998-46c3-a369-f3b8382e3aab-00-3nk2pc0b7jjne.pike.replit.dev'],
  },
});