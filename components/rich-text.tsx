import Link from 'next/link';
import { Fragment } from 'react';

const TOKEN = /(@[a-z0-9_.]{3,30}|https?:\/\/[^\s<]+)/g;

/** Texto com @menções e links clicáveis, preservando quebras de linha. */
export function RichText({ text, className }: { text: string; className?: string }) {
  const parts = text.split(TOKEN);
  return (
    <p className={className} style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
      {parts.map((p, i) => {
        if (/^@[a-z0-9_.]{3,30}$/.test(p)) return <Link key={i} href={`/integrantes/${p.slice(1)}`} className="font-semibold text-burgundy">{p}</Link>;
        if (/^https?:\/\//.test(p)) return <a key={i} href={p} target="_blank" rel="noopener noreferrer nofollow" className="text-burgundy underline underline-offset-2">{p.replace(/^https?:\/\//, '').slice(0, 40)}</a>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </p>
  );
}
