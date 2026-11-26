"""Create a local, gitignored side-view layer from the selected real photo.

The polygon is a manually reviewed silhouette for candidate 349. This is a
cutout, not a generated image. Never commit its output or the source photo.
"""

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--assets', type=Path, required=True)
args = parser.parse_args()

photo = Image.open(args.source).convert('RGB').resize((1200, 800), Image.Resampling.LANCZOS)
outline = [
    (259, 245), (267, 225), (327, 217), (432, 185), (456, 151),
    (494, 137), (503, 40), (520, 35), (556, 95), (586, 133),
    (635, 139), (657, 65), (674, 56), (704, 98), (726, 150),
    (782, 187), (821, 262), (857, 368), (863, 474), (817, 516),
    (731, 518), (661, 515), (609, 513), (511, 519), (452, 516),
    (440, 489), (417, 440), (367, 399), (305, 357), (272, 308),
]
alpha = Image.new('L', photo.size)
ImageDraw.Draw(alpha).polygon(outline, fill=255)
alpha = alpha.filter(ImageFilter.GaussianBlur(9))
photo.putalpha(alpha)
cutout = photo.crop((245, 25, 875, 555)).resize((800, 673), Image.Resampling.LANCZOS)
args.assets.mkdir(parents=True, exist_ok=True)
cutout.save(args.assets / 'side_head.png')
manifest_path = args.assets / 'manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['layers']['side_head'] = {'box': [160, 145, 960, 818]}
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Prepared private side-view layer: {cutout.size}')
