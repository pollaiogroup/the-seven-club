import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

// Link enviado por e-mail (recuperação de senha): troca o token por uma sessão.
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;
  const nextParam = url.searchParams.get('next') || '/redefinir-senha';
  const next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/feed';
  const code = url.searchParams.get('code');
  const supabase = await createClient();
  // Modelo de e-mail personalizado (README): ?token_hash=...&type=recovery
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  // Modelo padrão do Supabase: o link passa pelo Auth e volta com ?code=... (PKCE)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL('/entrar?erro=link-invalido', url.origin));
}
