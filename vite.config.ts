import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  optimizeDeps: {
    include: ['maplibre-gl', 'react-map-gl'],
  },
  build: {
    commonjsOptions: {
      include: [/maplibre-gl/, /node_modules/],
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Ensure old caches are cleared and new builds activate immediately
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        // Increase cache size limit to 5MB
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Don't precache very large images
        globIgnores: [
          '**/billboard-times-square-*.jpg',
          '**/a-new-policy.png',
          '**/rashid-illinois.jpg',
          '**/unity-justice-fund.png'
        ],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /^https:\/\/.*\.(jpg|jpeg|png|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },
      manifest: {
        name: 'Molitico - News & Legislative Tracker',
        short_name: 'Molitico',
        description: 'Track news and congressional bills affecting Arab and Muslim American communities',
        theme_color: '#0A1E3E',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
