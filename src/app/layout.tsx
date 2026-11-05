import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/dm-sans';
import './globals.css';
import { ServiceWorker } from '@/components/sw-register';
import { Toaster } from '@/components/ui/toaster';

// Telas de abertura do iPhone geradas por dev/scripts/brand-assets.mjs (o Android usa o manifest)
const SPLASH: [number, number, number][] = [[440, 956, 3], [402, 874, 3], [430, 932, 3], [393, 852, 3], [428, 926, 3], [390, 844, 3], [414, 896, 3], [375, 812, 3], [414, 896, 2], [375, 667, 2]];

export const metadata: Metadata = {
  title: { default: 'THE SEVEN CLUB', template: '%s · THE SEVEN CLUB' },
  description: 'Sociedade de mulheres que nasceram para liderar.',
  applicationName: 'THE SEVEN CLUB',
  appleWebApp: {
    capable: true, title: 'SEVEN CLUB', statusBarStyle: 'black-translucent',
    startupImage: SPLASH.map(([w, h, d]) => ({
      url: `/splash/splash-${w * d}x${h * d}.png`,
      media: `(device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${d}) and (orientation: portrait)`,
    })),
  },
  icons: { icon: '/favicon.png', apple: '/icons/apple-touch-icon.png' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#450B18',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster />
        <ServiceWorker />
      </body>
    </html>
  );
}
