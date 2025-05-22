
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
    port: 3001,
    strictPort: false,
    hmr: {
      clientPort: 443,
      overlay: false
    },
    watch: {
      usePolling: true
    },
    cors: true,
    allowedHosts: ['all', '59c3c0ea-b998-46c3-a369-f3b8382e3aab-00-3nk2pc0b7jjne.pike.replit.dev']
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
