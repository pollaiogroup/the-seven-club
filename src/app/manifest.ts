import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'THE SEVEN CLUB',
    short_name: 'SEVEN CLUB',
    description: 'Sociedade de mulheres que nasceram para liderar. Born to lead.',
    lang: 'pt-BR',
    start_url: '/feed?origem=app',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#450B18',
    theme_color: '#450B18',
    categories: ['social', 'lifestyle', 'business'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Meu Seven', url: '/seven', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Afirmação do dia', url: '/afirmacoes', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Publicar', url: '/publicar', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  };
}
