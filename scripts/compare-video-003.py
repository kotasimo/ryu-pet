"""Make a PRIVATE visual comparison of video 003 and browser model screenshots.

Run the browser capture first; pass its screenshot directory and the original
video path at runtime. Never commit or upload the output image.
"""

import argparse
from pathlib import Path

import cv2
from PIL import Image, ImageDraw, ImageOps

TIMES = (0, 2, 3, 4, 6, 8, 10, 13, 15)
parser = argparse.ArgumentParser()
parser.add_argument('--video', type=Path, required=True)
parser.add_argument('--screenshots', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
args = parser.parse_args()

capture = cv2.VideoCapture(str(args.video))
if not capture.isOpened():
    raise SystemExit('Cannot decode private video')
sheet = Image.new('RGB', (1800, 1100), 'white')
draw = ImageDraw.Draw(sheet)
for index, second in enumerate(TIMES):
    capture.set(cv2.CAP_PROP_POS_MSEC, second * 1000)
    ok, frame = capture.read()
    if not ok:
        raise SystemExit(f'Cannot read video at {second}s')
    frame = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    # Head-focused crop from this one source clip. Preserve the original.
    video_head = ImageOps.fit(frame.crop((85, 175, 540, 690)), (290, 310))
    model_path = args.screenshots / f'issue5-model-{second:02d}.png'
    with Image.open(model_path) as model:
        model_head = ImageOps.fit(model.convert('RGB').crop((145, 70, 515, 475)), (290, 310))
    x = (index % 3) * 600
    y = (index // 3) * 365
    sheet.paste(video_head, (x, y))
    sheet.paste(model_head, (x + 300, y))
    draw.text((x + 8, y + 318), f'Video 003 {second}s', fill='black')
    draw.text((x + 308, y + 318), f'Model {second}s', fill='black')
capture.release()
args.output.parent.mkdir(parents=True, exist_ok=True)
sheet.save(args.output, quality=91)
print('Private comparison saved')
