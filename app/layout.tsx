import type { Metadata, Viewport } from 'next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '@fontsource/atkinson-hyperlegible/400.css';
import '@fontsource/atkinson-hyperlegible/700.css';
import { PwaProvider } from '@/app/components/pwa/PwaProvider';
import { AuthProvider } from '@/app/hooks/useAuth';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://territory-mapper-blush.vercel.app'),
  title: { default: 'Territory Mapper', template: '%s · Territory Mapper' },
  description: 'Secure, accessible, offline-ready congregation territory field work.',
  applicationName: 'Territory Mapper',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon-180.png', sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Territory Mapper' },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f2e9' },
    { media: '(prefers-color-scheme: dark)', color: '#15231c' },
  ],
};

const themeInitializer = `
  (() => {
    try {
      const theme = localStorage.getItem('theme');
      const accessibility = JSON.parse(localStorage.getItem('accessibility-settings') || '{}').state || {};
      const highContrast = accessibility.highContrast === true;
      const bigMode = accessibility.bigMode === true;
      const reducedMotion = accessibility.reducedMotion === true;
      if (theme === 'dark') document.documentElement.classList.add('dark');
      if (theme === 'light') document.documentElement.classList.add('light');
      if (highContrast) document.documentElement.classList.add('high-contrast');
      if (bigMode) document.documentElement.classList.add('big-mode');
      if (reducedMotion) document.documentElement.classList.add('reduced-motion');
    } catch {}
  })();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script id="theme-initializer" dangerouslySetInnerHTML={{ __html: themeInitializer }} />
      </head>
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <AuthProvider>
          <PwaProvider>{children}</PwaProvider>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
