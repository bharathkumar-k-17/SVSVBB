import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import viteCompression from 'vite-plugin-compression';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Redirect ALL firebase/* imports to our no-op stub so the app
      // doesn't crash while remaining pages are gradually migrated.
      'firebase/app':       path.resolve(__dirname, 'src/lib/firebase-stub.ts'),
      'firebase/auth':      path.resolve(__dirname, 'src/lib/firebase-stub.ts'),
      'firebase/firestore': path.resolve(__dirname, 'src/lib/firebase-stub.ts'),
      'firebase/storage':   path.resolve(__dirname, 'src/lib/firebase-stub.ts'),
      'firebase/functions': path.resolve(__dirname, 'src/lib/firebase-stub.ts'),
      'firebase/analytics': path.resolve(__dirname, 'src/lib/firebase-stub.ts'),
    },
  },
  plugins: [
    react(),
    viteCompression({ algorithm: 'gzip' }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo.jpg'],
      manifest: {
        name: 'SVSVBB Ganesh Festival',
        short_name: 'SVSVBB',
        description: 'Private Ganesh Festival Management System',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        cleanupOutdatedCaches: true,
        // Skip waiting so new service worker activates immediately
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-data-cache',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
  build: {
    assetsInlineLimit: 4096, // Inline small assets (<= 4kb)
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
          'query-vendor': ['@tanstack/react-query'],
          'ui-vendor': ['lucide-react', 'react-hot-toast']
        }
      }
    }
  }
});

