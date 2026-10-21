"""Offline, repeatable derivatives of an approved compiled capture. Requires Pillow.

Run only when changing approved imagery; normal website builds use committed assets.
The original screenshot is immutable. No generative edits or interface retouching.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'assets/products/nebula/bp010-approved-icons'
config = json.loads((SOURCE_DIR / 'capture.json').read_text(encoding='utf-8'))
source = SOURCE_DIR / config['file']
assert hashlib.sha256(source.read_bytes()).hexdigest() == config['sha256'].lower(), 'Source hash mismatch'
original = Image.open(source).convert('RGB')
x, y, width, height = config['clientRect']
assert 0 <= x < x + width <= original.width and 0 <= y < y + height <= original.height
client = original.crop((x, y, x + width, y + height))
relative = 'assets/products/nebula/bp010-approved-icons'
output = ROOT / 'public' / relative
output.mkdir(parents=True, exist_ok=True)
files = []

def record(file, im):
    data = file.read_bytes()
    files.append({'path': '/' + file.relative_to(ROOT / 'public').as_posix(), 'width': im.width,
                  'height': im.height, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
    return files[-1]['path']

variants = []
for target in (480, 768, 960, 1200):
    assert target <= width, 'Never invent resolution by upscaling'
    im = client if target == width else client.resize((target, round(height * target / width)), Image.Resampling.LANCZOS)
    file = output / f'projectnebula-interface-{target}.webp'
    im.save(file, 'WEBP', quality=94, method=6)
    variants.append({'src': record(file, im), 'width': target})

# Lossless encoding retains every decoded source pixel for close inspection.
full = output / 'projectnebula-interface-full.webp'
client.save(full, 'WEBP', lossless=True, method=6)
assert Image.open(full).convert('RGB').tobytes() == client.tobytes()
full_path = record(full, client)

details = {}
for name, center_x in [('clarity', 172), ('silk', 457), ('air', 742), ('tame', 1027)]:
    # Explicit details from the same source, including the entire knob and label.
    detail = client.crop((center_x - 137, 405, center_x + 137, 696))
    file = output / f'projectnebula-{name}-detail.webp'
    detail.save(file, 'WEBP', lossless=True, method=6)
    details[name] = {'src': record(file, detail), 'width': detail.width, 'height': detail.height}

# Social card uses the full authentic interface; lighting is outside the screenshot.
card = Image.new('RGB', (1200, 630), '#050911')
draw = ImageDraw.Draw(card)
for line in range(630):
    draw.line((0, line, 1199, line), fill=(5 + round(line/130), 9 + round(line/90), 17 + round(line/40)))
font_path = str(ROOT / 'public/assets/fonts/SpaceGrotesk-Variable.ttf')
font = lambda size: ImageFont.truetype(font_path, size)
draw.text((35, 210), 'HEX THE ENGINEER', fill='#c6b1f0', font=font(19))
draw.text((35, 258), 'PROJECTNEBULA', fill='#c2eef1', font=font(29))
draw.text((35, 313), 'Intelligent', fill='#dbe4f4', font=font(25))
draw.text((35, 347), 'Mix Finishing', fill='#dbe4f4', font=font(25))
draw.text((35, 426), 'PRIVATE BETA', fill='#91a8c1', font=font(15))
draw.text((35, 453), 'Working product name', fill='#91a8c1', font=font(13))
social_client = client.resize((800, 587), Image.Resampling.LANCZOS)
card.paste(social_client, (378, 21))
social = output / 'projectnebula-social.jpg'
card.save(social, 'JPEG', quality=94, subsampling=0)
social_path = record(social, card)

manifest = {'generation': 'bp010-approved-icons', 'build': config['build'], 'width': width, 'height': height,
            'interface': variants[-1]['src'], 'small': variants[1]['src'], 'variants': variants,
            'full': full_path, 'details': details, 'social': {'src': social_path, 'width':1200, 'height':630}}
(ROOT / 'src/product-images.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
(SOURCE_DIR / 'derivatives.json').write_text(json.dumps(files, indent=2) + '\n', encoding='utf-8')
for file in files:
    print(f"{file['width']}x{file['height']} {file['bytes']:>7} bytes {file['path']}")
