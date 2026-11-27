"""Check locally generated, gitignored model layers without exposing images."""

import argparse
import json
from pathlib import Path
from PIL import Image

NAMES = ('body', 'head', 'ear_left', 'ear_right', 'eye_left', 'eye_right',
         'cheek_left', 'cheek_right', 'mouth', 'eyelid_left', 'eyelid_right')

parser = argparse.ArgumentParser()
parser.add_argument('--assets', type=Path, default=Path('public/private-assets/ryu/model-v1'))
args = parser.parse_args()

manifest = json.loads((args.assets / 'manifest.json').read_text(encoding='utf-8'))
width, height = manifest['source_dimensions']
assert (width, height) == (1108, 1478), 'Unexpected reference dimensions'
assert set(NAMES) <= set(manifest['layers']) <= set(NAMES) | {'side_head'}, 'Missing or unexpected layers'

for name in manifest['layers']:
    box = manifest['layers'][name]['box']
    assert len(box) == 4 and all(type(value) is int for value in box), name
    x0, y0, x1, y1 = box
    assert 0 <= x0 < x1 <= width and 0 <= y0 < y1 <= height, name
    with Image.open(args.assets / f'{name}.png') as image:
        image.verify()
    with Image.open(args.assets / f'{name}.png') as image:
        assert image.mode == 'RGBA', name
        assert image.size == (x1 - x0, y1 - y0), name
        assert image.getchannel('A').getbbox() is not None, name

near_frames = sorted(args.assets.glob('near_*.webp'))
if near_frames:
    assert len(near_frames) == 33, 'Incomplete near-view sequence'
    for index in range(33):
        frame = args.assets / f'near_{index:02d}.webp'
        assert frame.is_file(), frame.name
        with Image.open(frame) as image:
            assert image.size == (1108, 1170), frame.name
            assert image.convert('RGBA').getchannel('A').getbbox() is not None, frame.name

print(f"Validated {len(manifest['layers'])} local photo layers, {len(near_frames)} near-view frames and manifest geometry.")
