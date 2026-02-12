import type { NextConfig } from "next";
import withPWA from "next-pwa";

// Ensure environment variables are loaded
const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_MAPBOX_TOKEN",
];

// Check for missing env vars (only log warnings, don't block build)
if (process.env.NODE_ENV === "development") {
  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      console.warn(`Warning: Missing environment variable: ${varName}`);
    }
  });
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://storage.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://api.mapbox.com",
              "img-src 'self' data: blob: https://api.mapbox.com https://*.tiles.mapbox.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.mapbox.com https://*.tiles.mapbox.com https://events.mapbox.com",
              "worker-src 'self' blob:",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.mapbox.com",
      },
      {
        protocol: "https",
        hostname: "*.tiles.mapbox.com",
      },
    ],
    unoptimized: true,
  },
  // Set turbopack root to this project directory (prevents wrong workspace root inference)
  turbopack: {
    root: import.meta.dirname,
  },
  // Webpack optimization (used during --webpack builds and by next-pwa)
  webpack: (config, { isServer, dev }) => {
    // Optimize bundle size
    if (!isServer && !dev) {
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: "all",
          cacheGroups: {
            framework: {
              name: "framework",
              test: /[\\/]node_modules[\\/](react|react-dom|next)[\\/]/,
              priority: 40,
              enforce: true,
            },
            mapbox: {
              name: "mapbox",
              test: /[\\/]node_modules[\\/](mapbox-gl|@mapbox)[\\/]/,
              priority: 30,
              enforce: true,
            },
            supabase: {
              name: "supabase",
              test: /[\\/]node_modules[\\/](@supabase)[\\/]/,
              priority: 20,
              enforce: true,
            },
            rxdb: {
              name: "rxdb",
              test: /[\\/]node_modules[\\/](rxdb)[\\/]/,
              priority: 20,
              enforce: true,
            },
            ui: {
              name: "ui",
              test: /[\\/]node_modules[\\/](lucide-react|@radix-ui)[\\/]/,
              priority: 10,
              reuseExistingChunk: true,
            },
            vendor: {
              name: "vendor",
              test: /[\\/]node_modules[\\/]/,
              priority: -10,
              reuseExistingChunk: true,
            },
          },
        },
      };
    }
    return config;
  },
  // Experimental features
  experimental: {},
};

// Wrap config with PWA support
const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  fallbacks: {
    document: "/offline",
  },
});

export default pwaConfig(nextConfig);
