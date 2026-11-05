import type { CapacitorConfig } from '@capacitor/cli';

// App das lojas (Android e iOS): o mesmo app da Vercel, aberto dentro de uma casca nativa.
// O app carrega o endereço publicado (server.url), então uma atualização do site já chega
// às integrantes sem nova versão na loja. Os recursos nativos entram por plugins.
// Passo a passo em README.md, seção "Publicação nas lojas".
const config: CapacitorConfig = {
  appId: 'club.theseven.app',
  appName: 'THE SEVEN CLUB',
  webDir: 'public',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://app.theseven.club',
    cleartext: false,
    allowNavigation: ['*.supabase.co'],
  },
  backgroundColor: '#450B18',
  ios: { contentInset: 'never', scheme: 'THE SEVEN CLUB' },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { backgroundColor: '#450B18', showSpinner: false, launchAutoHide: true },
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
