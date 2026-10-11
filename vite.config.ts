import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { hls: ['hls.js'] } } }
  },
  server: {
    port: 5173,
    host: true,
    /* during `npm run dev` the API lives on 8787 */
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } }
  }
});
