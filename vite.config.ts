import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // 👇 THIS FIXES THE WHITE SCREEN
      base: "/Color-Master/",
      
      server: {
        port: 3000,
        host: '0.0.0.0',
      },

      plugins: [react()],

      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },

      // 👇 NEW SECTION: Forces filenames to be predictable for the Service Worker
      build: {
        rollupOptions: {
          output: {
            entryFileNames: `assets/index.js`,
            chunkFileNames: `assets/index.js`,
            assetFileNames: `assets/index.[ext]`,
          }
        }
      }
    };
});
