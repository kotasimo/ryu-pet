"""Build private, aligned near-front pose frames from real photos 308 and 310.

Both photos have the same resolution and nearly identical setting. Hand-checked
landmark pairs describe their corresponding facial features and silhouette.
RBF geometry moves each source into a shared intermediate shape, then mixes
the registered textures. The images and resulting frames stay gitignored.
This does not measure 3D yaw or synthesize an unseen side of the face.
"""

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps
from scipy.interpolate import RBFInterpolator


parser = argparse.ArgumentParser()
parser.add_argument('--front', type=Path, required=True)
parser.add_argument('--near', type=Path, required=True)
parser.add_argument('--assets', type=Path, required=True)
args = parser.parse_args()

size = (1108, 1170)
parts = ('ear_left', 'ear_right', 'head', 'cheek_left', 'cheek_right', 'mouth', 'eye_left', 'eye_right')
manifest = json.loads((args.assets / 'manifest.json').read_text(encoding='utf-8'))
front = Image.new('RGBA', size)
for part in parts:
    box = manifest['layers'][part]['box']
    with Image.open(args.assets / f'{part}.png') as layer:
        front.alpha_composite(layer.convert('RGBA'), box[:2])

# The older per-part cutouts retain small pieces of the wall/hand. Restrict
# them to one reviewed exterior contour before any view interpolation.
silhouette = Image.new('L', size)
ImageDraw.Draw(silhouette).polygon([
    (291, 139), (309, 126), (348, 143), (392, 183), (431, 238),
    (452, 279), (506, 249), (555, 237), (624, 233), (699, 249),
    (758, 282), (805, 230), (872, 184), (941, 158), (970, 166),
    (981, 189), (967, 248), (937, 328), (904, 395), (920, 464),
    (930, 568), (917, 653), (883, 727), (827, 791), (754, 844),
    (668, 883), (557, 890), (469, 863), (395, 813), (349, 748),
    (365, 664), (355, 548), (348, 455), (337, 392), (308, 326),
    (289, 245), (284, 176),
], fill=255)
silhouette = silhouette.filter(ImageFilter.GaussianBlur(5))
front_alpha_array = np.minimum(np.asarray(front)[:, :, 3], np.asarray(silhouette))
with Image.open(args.front) as raw:
    front_photo = ImageOps.exif_transpose(raw).convert('RGB').crop((0, 0, *size))
if front_photo.size != size:
    raise SystemExit('The front photo has unexpected dimensions')
segmentation = np.where(front_alpha_array > 8, cv2.GC_PR_FGD, cv2.GC_BGD).astype(np.uint8)
core = cv2.erode((front_alpha_array > 220).astype(np.uint8), np.ones((41, 41), np.uint8))
segmentation[core > 0] = cv2.GC_FGD
border = cv2.dilate((front_alpha_array > 8).astype(np.uint8), np.ones((15, 15), np.uint8))
segmentation[border == 0] = cv2.GC_BGD
cv2.grabCut(cv2.cvtColor(np.asarray(front_photo), cv2.COLOR_RGB2BGR), segmentation,
            None, np.zeros((1, 65), np.float64), np.zeros((1, 65), np.float64),
            4, cv2.GC_INIT_WITH_MASK)
refined = np.isin(segmentation, (cv2.GC_FGD, cv2.GC_PR_FGD)).astype(np.uint8) * 255
refined = cv2.GaussianBlur(refined, (0, 0), 2.5)
front_alpha_array = np.minimum(front_alpha_array, refined)
front.putalpha(Image.fromarray(front_alpha_array, 'L'))

with Image.open(args.near) as raw:
    near = ImageOps.exif_transpose(raw).convert('RGB')
if near.size != (1108, 1478):
    raise SystemExit('The near-front photo has unexpected dimensions')
near = near.crop((0, 0, *size))

# Corresponding locations in source-photo coordinates; these are alignment
# controls chosen from the actual two photographs, not video measurements.
front_points = np.array([
    (299, 140), (380, 260), (445, 335), (975, 170), (830, 270), (760, 315),
    (575, 239), (465, 422), (686, 426), (500, 531), (437, 510), (583, 548),
    (520, 591), (350, 490), (370, 570), (675, 586),
    (546, 655), (584, 802), (342, 650), (900, 640), (420, 860), (800, 865),
    (0, 0), (1107, 0), (0, 1169), (1107, 1169), (554, 0), (554, 1169),
    (60, 260), (60, 560), (60, 850), (1050, 260), (1050, 560), (1050, 850),
], dtype=np.float32)
near_points = np.array([
    (275, 210), (340, 300), (400, 355), (945, 185), (830, 255), (765, 300),
    (600, 258), (405, 463), (640, 457), (408, 640), (342, 600), (502, 651),
    (423, 682), (340, 490), (340, 650), (650, 650),
    (474, 706), (540, 812), (325, 690), (870, 660), (390, 850), (815, 850),
    (0, 0), (1107, 0), (0, 1169), (1107, 1169), (554, 0), (554, 1169),
    (60, 260), (60, 560), (60, 850), (1050, 260), (1050, 560), (1050, 850),
], dtype=np.float32)

height, width = size[1], size[0]
model = RBFInterpolator(front_points, near_points - front_points, kernel='thin_plate_spline', smoothing=8)
ys, xs = np.mgrid[0:height:4, 0:width:4]
coarse = model(np.column_stack((xs.ravel(), ys.ravel()))).reshape((*xs.shape, 2))
dx = cv2.resize(coarse[:, :, 0].astype(np.float32), size, interpolation=cv2.INTER_LINEAR)
dy = cv2.resize(coarse[:, :, 1].astype(np.float32), size, interpolation=cv2.INTER_LINEAR)
dx = np.clip(dx, -140, 140)
dy = np.clip(dy, -140, 140)
grid_y, grid_x = np.mgrid[0:height, 0:width].astype(np.float32)

front_rgba = np.asarray(front, dtype=np.float32) / 255
front_rgba[:, :, :3] *= front_rgba[:, :, 3:4]
front_alpha = Image.fromarray(np.asarray(front)[:, :, 3], 'L')
# Shape the second photo using the first photo's reviewed head mask, mapped to
# the actual landmarks of the near-front photo.
near_alpha = cv2.remap(np.asarray(front_alpha), grid_x - dx, grid_y - dy,
                       cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
near_rgba = np.asarray(near.convert('RGBA'), dtype=np.float32) / 255
near_rgba[:, :, 3] = near_alpha / 255
near_rgba[:, :, :3] *= near_rgba[:, :, 3:4]

count = 33
for index in range(count):
    amount = index / (count - 1)
    # After geometric registration, switch texture over only a short interval.
    # A full-length alpha crossfade shows duplicate eyes/nose at mid pose.
    texture_mix = np.clip((amount - .43) / .14, 0, 1)
    texture_mix = texture_mix * texture_mix * (3 - 2 * texture_mix)
    map_front_x, map_front_y = grid_x - amount * dx, grid_y - amount * dy
    map_near_x, map_near_y = grid_x + (1 - amount) * dx, grid_y + (1 - amount) * dy
    a = cv2.remap(front_rgba, map_front_x, map_front_y, cv2.INTER_LINEAR,
                  borderMode=cv2.BORDER_CONSTANT)
    b = cv2.remap(near_rgba, map_near_x, map_near_y, cv2.INTER_LINEAR,
                  borderMode=cv2.BORDER_CONSTANT)
    mixed = a * (1 - texture_mix) + b * texture_mix
    alpha = mixed[:, :, 3:4]
    color = np.divide(mixed[:, :, :3], np.maximum(alpha, 1e-5))
    output = np.concatenate((color, alpha), axis=2)
    output = (np.clip(output, 0, 1) * 255).astype(np.uint8)
    Image.fromarray(output, 'RGBA').save(args.assets / f'near_{index:02d}.webp', quality=92, method=5)
print(f'Generated {count} private, registered near-view frames from two photos')
