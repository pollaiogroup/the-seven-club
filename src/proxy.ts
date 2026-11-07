import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PUBLIC = ['/entrar', '/convite', '/recuperar', '/redefinir-senha', '/auth', '/sobre', '/instalar', '/assinatura', '/api/cron', '/api/assinatura', '/api/asaas'];

// Renova a sessão do Supabase a cada navegação e protege as rotas autenticadas.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(`${p}/`));

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/entrar';
    url.search = path !== '/' ? `?next=${encodeURIComponent(path + request.nextUrl.search)}` : '';
    return NextResponse.redirect(url);
  }
  if (data.user && path === '/entrar') {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.png|icons/|brand/|sw.js|manifest.webmanifest|offline.html|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt|xml)$).*)'],
};
