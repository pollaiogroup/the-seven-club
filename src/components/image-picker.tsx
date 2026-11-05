'use client';
import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { uploadImage, type Uploaded } from '@/lib/images';
import { mediaUrl } from '@/lib/media';
import { toast } from '@/components/ui/toaster';

/** Seleciona e envia imagens já otimizadas; o formulário recebe os caminhos em um campo oculto (JSON). */
type Item = Uploaded & { preview?: string };

export function ImagePicker({ userId, name = 'media', max = 4, initial = [], label = 'Adicionar fotos', square = false, bucket = 'media' }: {
  userId: string; name?: string; max?: number; initial?: Item[]; label?: string; square?: boolean; bucket?: 'media' | 'private';
}) {
  const [items, setItems] = useState<Item[]>(initial);
  const [busy, setBusy] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  async function onPick(files: FileList | null) {
    if (!files) return;
    const list = Array.from(files).slice(0, max - items.length);
    setBusy((b) => b + list.length);
    for (const f of list) {
      try {
        const up = await uploadImage(f, userId, bucket, square ? 800 : 1600);
        setItems((x) => [...x, { ...up, preview: bucket === 'private' ? URL.createObjectURL(f) : undefined }]);
      } catch (e) {
        toast((e as Error).message, 'error');
      } finally {
        setBusy((b) => b - 1);
      }
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div>
      <input type="hidden" name={name} value={JSON.stringify(items.map(({ preview: _p, ...rest }) => rest))} />
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <div key={it.path} className="relative h-24 w-24 overflow-hidden rounded-2xl bg-dusty-soft">
            <img src={it.preview || mediaUrl(it.path)!} alt="" className="h-full w-full object-cover" />
            <button type="button" aria-label="Remover imagem" onClick={() => setItems((x) => x.filter((_, j) => j !== i))}
              className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-espresso/70 text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`b${i}`} className="skeleton flex h-24 w-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-taupe" /></div>
        ))}
        {items.length + busy < max && (
          <button type="button" onClick={() => input.current?.click()}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-taupe text-[12px] text-muted hover:border-burgundy hover:text-burgundy">
            <ImagePlus className="h-6 w-6" />
            {label}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" multiple={max > 1} className="hidden" onChange={(e) => onPick(e.target.files)} />
    </div>
  );
}
