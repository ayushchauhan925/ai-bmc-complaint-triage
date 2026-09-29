import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Splits the large third-party libraries into their own chunks so the app's own
        // code (the largest thing likely to change between deploys) stays small and
        // cacheable separately from React/Leaflet/Recharts, which rarely change.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-leaflet': ['leaflet', 'react-leaflet', 'leaflet.markercluster'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
});
