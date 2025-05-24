
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: true,
    port: 3000,
    strictPort: true,
    hmr: {
      clientPort: 443,
      overlay: false
    },
    watch: {
      usePolling: true
    },
    cors: true,
    allowedHosts: ['all', '59c3c0ea-b998-46c3-a369-f3b8382e3aab-00-3nk2pc0b7jjne.pike.replit.dev', '45632e60-4c2f-4a77-a23f-e3723504e195-00-20eqc0e5k2twn.pike.replit.dev']
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
