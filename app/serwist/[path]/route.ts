import { createSerwistRoute } from '@serwist/turbopack';

const route = createSerwistRoute({
  swSrc: 'app/sw.ts',
  useNativeEsbuild: true,
  additionalPrecacheEntries: [
    { url: '/offline', revision: 'field-shell-v2' },
    { url: '/field', revision: 'field-shell-v2' },
  ],
});

export const dynamic = 'force-static';
export const dynamicParams = false;
export const revalidate = false;
export const generateStaticParams = route.generateStaticParams;
export const GET = route.GET;
