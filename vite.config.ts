import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/');

          if (normalizedId.indexOf('/node_modules/three/') >= 0) {
            return 'vendor-three';
          }

          if (normalizedId.indexOf('/node_modules/@react-three/') >= 0) {
            return 'vendor-r3f';
          }

          if (normalizedId.indexOf('/node_modules/lucide-react/') >= 0) {
            return 'vendor-ui';
          }

          if (
            normalizedId.indexOf('/node_modules/react/') >= 0 ||
            normalizedId.indexOf('/node_modules/react-dom/') >= 0 ||
            normalizedId.indexOf('/node_modules/scheduler/') >= 0
          ) {
            return 'vendor-react';
          }

          return undefined;
        },
      },
    },
  },
});
