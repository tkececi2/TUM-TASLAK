import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
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
    allowedHosts: [
      '45632e60-4c2f-4a77-a23f-e3723504e195-00-20eqc0e5k2twn.pike.replit.dev',
      '.replit.dev',
      '.repl.co',
      'replit.com'
    ]
  }
})