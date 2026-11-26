"""Build private photo layers from the selected, near-frontal reference image.

This one-photo mask layout is deliberately specific to the selected 1108x1478
source. Supply the source path at runtime; never add the source or outputs to Git.
Requires Pillow (`python -m pip install pillow`).
"""

import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageOps

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True, help='Local 1108x1478 near-frontal photo')
parser.add_argument('--output', type=Path, default=Path('public/private-assets/ryu/model-v1'))
args = parser.parse_args()

with Image.open(args.source) as raw:
    source = ImageOps.exif_transpose(raw).convert('RGBA')
if source.size != (1108, 1478):
    raise SystemExit(f'Expected selected source size 1108x1478, got {source.size}')
args.output.mkdir(parents=True, exist_ok=True)

# Image-space contour points were placed by visual inspection of this photo.
# Soft alpha hides hard cut edges while leaving the original fur and markings.
layers = {
    'body': {
        'polygon': [(386,749),(425,724),(751,718),(884,756),(912,832),(915,914),(885,1003),(835,1081),(765,1130),(615,1145),(500,1108),(440,1040),(405,955),(386,858)],
        'box': (375, 707, 930, 1160), 'feather': 7,
    },
    'head': {
        'polygon': [(329,410),(349,346),(389,302),(446,269),(520,241),(615,234),(707,248),(786,281),(845,332),(893,404),(912,490),(927,586),(913,668),(879,726),(819,782),(754,834),(668,870),(556,879),(469,856),(400,808),(358,743),(335,655),(319,553)],
        'box': (302, 216, 943, 896), 'feather': 7,
    },
    'ear_left': {
        'polygon': [(336,376),(309,330),(294,239),(292,149),(306,129),(339,132),(382,161),(425,216),(457,290),(466,352),(413,394)],
        'box': (276, 111, 478, 410), 'feather': 3,
    },
    'ear_right': {
        'polygon': [(755,340),(779,280),(828,216),(898,169),(957,161),(977,186),(971,242),(946,317),(906,394),(849,414),(791,384)],
        'box': (736, 141, 996, 431), 'feather': 3,
    },
    'cheek_left': {'ellipse': (331, 461, 522, 708), 'box': (324, 454, 529, 715), 'feather': 18},
    'cheek_right': {'ellipse': (641, 458, 843, 715), 'box': (632, 449, 852, 724), 'feather': 18},
    'eye_left': {'ellipse': (389, 350, 511, 468), 'box': (382, 343, 518, 475), 'feather': 13},
    'eye_right': {'ellipse': (637, 361, 753, 478), 'box': (630, 354, 760, 485), 'feather': 13},
    'mouth': {'ellipse': (422, 565, 711, 718), 'box': (411, 555, 722, 729), 'feather': 18},
}

manifest = {'source_dimensions': [1108, 1478], 'layers': {}}
for name, spec in layers.items():
    mask = Image.new('L', source.size, 0)
    draw = ImageDraw.Draw(mask)
    if 'polygon' in spec: draw.polygon(spec['polygon'], fill=255)
    else: draw.ellipse(spec['ellipse'], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(spec['feather']))
    part = source.copy()
    part.putalpha(mask)
    box = spec['box']
    part.crop(box).save(args.output / f'{name}.png', optimize=True)
    manifest['layers'][name] = {'box': list(box)}

# Local closed-eye photographs show a narrow dark eyelid curve, rather than
# featureless fur. The curve below is an illustrated approximation over fur
# from the base photograph; it is not a pasted or measured closed-eye frame.
for name, sample_box, target_box in [
    ('eyelid_left', (385, 298, 520, 369), (387, 355, 518, 469)),
    ('eyelid_right', (628, 310, 764, 382), (631, 363, 763, 481)),
]:
    width, height = target_box[2] - target_box[0], target_box[3] - target_box[1]
    patch = source.crop(sample_box).resize((width, height), Image.Resampling.LANCZOS)
    line = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    pen = ImageDraw.Draw(line)
    points = [(int(width * .11), int(height * .52)),
              (int(width * .30), int(height * .60)),
              (int(width * .54), int(height * .62)),
              (int(width * .76), int(height * .56)),
              (int(width * .90), int(height * .47))]
    pen.line(points, fill=(31, 25, 24, 205), width=4, joint='curve')
    line = line.filter(ImageFilter.GaussianBlur(.8))
    patch.alpha_composite(line)
    mask = Image.new('L', (width, height), 0)
    ImageDraw.Draw(mask).ellipse((7, 8, width - 7, height - 8), fill=255)
    patch.putalpha(mask.filter(ImageFilter.GaussianBlur(9)))
    patch.save(args.output / f'{name}.png', optimize=True)
    manifest['layers'][name] = {'box': list(target_box)}

(args.output / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print('Generated', len(layers), 'private layers in', args.output)
