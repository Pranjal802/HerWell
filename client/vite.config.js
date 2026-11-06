import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(() => {
  let resolvedApi = (process.env.API_URL || process.env.VITE_API_URL || "").trim().replace(/\/+$/, "");
  if (resolvedApi && !resolvedApi.startsWith("http://") && !resolvedApi.startsWith("https://") && !resolvedApi.startsWith("/")) {
    resolvedApi = `https://${resolvedApi}`;
  }

  return {
    envPrefix: "VITE_",
    define: {
      "import.meta.env.API_URL": JSON.stringify(resolvedApi),
      "import.meta.env.VITE_API_URL": JSON.stringify(resolvedApi),
    },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
      },
      includeAssets: [
        "herwell-icon.svg",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
        "sw-push.js",
      ],
      manifest: {
        name: "HerWell",
        short_name: "HerWell",
        description: "Your personal health and wellness companion.",
        theme_color: "#0E7C7B",
        background_color: "#F4F7FA",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/herwell-icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
        shortcuts: [
          { name: "Today", url: "/", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "HerWell AI", url: "/ai", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Add reminder", url: "/reminders", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
          { name: "Check-in", url: "/wellness", icons: [{ src: "/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        importScripts: ["/sw-push.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          // Security requirement: API requests must NEVER be served from cache
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkOnly",
          },
          // Google Fonts Stylesheets
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Google Fonts Webfonts
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Static Images
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-images-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
    server: {
      proxy: {
        "/api": "http://localhost:5000",
      },
    },
  };
});
