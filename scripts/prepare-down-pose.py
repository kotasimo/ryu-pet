"""Create private, subtle downward-pitch render frames from photo 308.

Video 003 shows nose-down posture but the hand occludes precise landmarks.
The values below are provisional appearance controls, never measurements.
Only the selected photo is warped; there is no second-face crossfade.
"""

import argparse
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy.interpolate import RBFInterpolator

parser = argparse.ArgumentParser()
parser.add_argument('--assets', type=Path, required=True)
args = parser.parse_args()
source = np.asarray(Image.open(args.assets / 'near_00.webp').convert('RGBA'))
height, width = source.shape[:2]
points = np.array([
    (300, 150), (975, 170), (575, 240),
    (465, 420), (686, 426), (500, 530), (438, 510), (585, 548),
    (370, 570), (675, 586), (546, 655), (584, 802),
    (340, 650), (900, 640), (420, 860), (800, 865),
    (0, 0), (1107, 0), (0, 1169), (1107, 1169),
    (60, 400), (1050, 400), (60, 800), (1050, 800),
], dtype=np.float32)
delta = np.array([
    (0, 0), (0, 0), (0, 2),
    (2, 7), (-2, 7), (0, 26), (0, 21), (0, 23),
    (0, 17), (0, 17), (0, 17), (0, 8),
    (0, 10), (0, 10), (0, 0), (0, 0),
    (0, 0), (0, 0), (0, 0), (0, 0),
    (0, 0), (0, 0), (0, 0), (0, 0),
], dtype=np.float32)
model = RBFInterpolator(points, delta, kernel='thin_plate_spline', smoothing=8)
ys, xs = np.mgrid[0:height:4, 0:width:4]
coarse = model(np.column_stack((xs.ravel(), ys.ravel()))).reshape((*xs.shape, 2))
dx = cv2.resize(coarse[:, :, 0].astype(np.float32), (width, height))
dy = cv2.resize(coarse[:, :, 1].astype(np.float32), (width, height))
grid_y, grid_x = np.mgrid[0:height, 0:width].astype(np.float32)
for index in range(33):
    amount = index / 32
    frame = cv2.remap(source, grid_x - amount * dx, grid_y - amount * dy,
                      cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
    Image.fromarray(frame, 'RGBA').save(args.assets / f'down_{index:02d}.webp', quality=92, method=5)
print('Generated 33 private, provisional downward-pitch frames')
