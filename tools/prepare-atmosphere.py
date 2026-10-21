"""Optimize retained atmospheric artwork without changing the composition."""
from pathlib import Path
from PIL import Image
ROOT = Path(__file__).resolve().parents[1]
for name, widths in [('cosmic-field', (960, 1536)), ('galaxy-cloud', (960, 1983))]:
    original = Image.open(ROOT / f'assets/atmosphere/{name}-original.webp')
    for width in widths:
        image = original if original.width == width else original.resize((width, round(original.height * width / original.width)), Image.Resampling.LANCZOS)
        path = ROOT / f'public/assets/atmosphere/{name}-{width}.webp'
        path.parent.mkdir(parents=True, exist_ok=True)
        image.save(path, 'WEBP', quality=88, method=6)
        print(f'{path.name}: {path.stat().st_size} bytes')
