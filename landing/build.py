# Gera a landing page em um único arquivo HTML, com as imagens embutidas.
# Uso: python3 landing/build.py [endereço-do-app] [arquivo-de-saída]
import base64, pathlib, re, sys

here = pathlib.Path(__file__).parent
src = (here / 'source.html').read_text()

def img(m):
    data = (here / 'img' / f'{m.group(1)}.webp').read_bytes()
    return 'data:image/webp;base64,' + base64.b64encode(data).decode()

out = re.sub(r'\{\{IMG:([a-z-]+)\}\}', img, src)
if len(sys.argv) > 1 and sys.argv[1]:
    out = out.replace('https://the-seven-club.vercel.app', sys.argv[1].rstrip('/'))
dest = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else here / 'the-seven-club.html'
dest.write_text(out)
print(dest, len(out) // 1024, 'KB')
