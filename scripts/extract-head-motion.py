"""Track visible head texture offline; keep the video and output private.

The seed rectangle is chosen once by the developer from a local frame. Sparse
optical flow tracks its image features in both temporal directions. This is a
2D appearance estimate, not dog landmark, 3D pose, or touch causality.

Requires opencv-python-headless and numpy. Example:
  python scripts/extract-head-motion.py --video <private-video> \
    --clip-id video-3 --seed-second 8 --seed-box X Y W H \
    --output <private-output.json>
"""

import argparse
import json
import math
from pathlib import Path

import cv2
import numpy as np


def arguments():
    parser = argparse.ArgumentParser()
    parser.add_argument('--video', type=Path, required=True)
    parser.add_argument('--clip-id', required=True)
    parser.add_argument('--seed-second', type=float, required=True)
    parser.add_argument('--seed-box', type=int, nargs=4, metavar=('X', 'Y', 'W', 'H'), required=True)
    parser.add_argument('--sample-fps', type=float, default=5)
    parser.add_argument('--output', type=Path, required=True)
    return parser.parse_args()


def run():
    args = arguments()
    if not args.video.is_file() or args.sample_fps <= 0:
        raise SystemExit('Video missing or invalid sample rate')
    capture = cv2.VideoCapture(str(args.video))
    if not capture.isOpened():
        raise SystemExit('OpenCV cannot decode this video')
    fps = capture.get(cv2.CAP_PROP_FPS)
    count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if fps <= 0 or count <= 0 or width <= 0 or height <= 0:
        raise SystemExit('Incomplete video metadata')
    scale = min(1.0, 640 / width)
    sample_step = max(1, round(fps / args.sample_fps))
    indices = list(range(0, count, sample_step))
    seed_index = min(indices, key=lambda index: abs(index / fps - args.seed_second))
    seed_position = indices.index(seed_index)

    def read_gray(index):
        capture.set(cv2.CAP_PROP_POS_FRAMES, index)
        ok, frame = capture.read()
        if not ok:
            return None
        frame = cv2.resize(frame, (round(width * scale), round(height * scale)), interpolation=cv2.INTER_AREA)
        return cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    seed_gray = read_gray(seed_index)
    if seed_gray is None:
        raise SystemExit('Cannot read seed frame')
    x, y, box_width, box_height = [round(value * scale) for value in args.seed_box]
    if x < 0 or y < 0 or box_width < 30 or box_height < 30 or x + box_width > seed_gray.shape[1] or y + box_height > seed_gray.shape[0]:
        raise SystemExit('Seed box lies outside the decoded frame')
    mask = np.zeros(seed_gray.shape, dtype=np.uint8)
    mask[y:y + box_height, x:x + box_width] = 255
    seed_points = cv2.goodFeaturesToTrack(seed_gray, mask=mask, maxCorners=180, qualityLevel=.012, minDistance=6, blockSize=7)
    if seed_points is None or len(seed_points) < 12:
        raise SystemExit('Too few visible features in seed box')
    origin = seed_points.reshape(-1, 2).astype(np.float32)
    center = np.array([x + box_width / 2, y + box_height / 2, 1], dtype=np.float64)
    seed_count = len(origin)

    def record(index, source, current):
        time = round(index / fps, 3)
        if len(source) < 8:
            return {'timeSec': time, 'head': None, 'confidence': 0, 'tracked': len(source), 'occluded': None, 'provenance': 'unmeasured'}
        matrix, inliers = cv2.estimateAffinePartial2D(source, current, method=cv2.RANSAC, ransacReprojThreshold=4, maxIters=2000, confidence=.98)
        if matrix is None or inliers is None:
            return {'timeSec': time, 'head': None, 'confidence': 0, 'tracked': len(source), 'occluded': None, 'provenance': 'unmeasured'}
        inlier_mask = inliers.ravel().astype(bool)
        inlier_count = int(inlier_mask.sum())
        confidence = round(inlier_count / seed_count, 3)
        if inlier_count < 8 or confidence < .2:
            return {'timeSec': time, 'head': None, 'confidence': confidence, 'tracked': len(source), 'occluded': None, 'provenance': 'low-confidence'}
        mapped = matrix @ center
        predicted = cv2.transform(source[inlier_mask][None, :, :], matrix)[0]
        error = float(np.median(np.linalg.norm(predicted - current[inlier_mask], axis=1)))
        return {
            'timeSec': time,
            'head': {
                'xNormalized': round(float((mapped[0] - center[0]) / seed_gray.shape[1]), 5),
                'yNormalized': round(float((mapped[1] - center[1]) / seed_gray.shape[0]), 5),
                'rollRad': round(math.atan2(float(matrix[1, 0]), float(matrix[0, 0])), 5),
                'scaleRatio': round(math.hypot(float(matrix[0, 0]), float(matrix[1, 0])), 5),
                'yawEstimate': None,
                'pitchEstimate': None,
            },
            'confidence': confidence,
            'tracked': len(source),
            'inliers': inlier_count,
            'medianReprojectionErrorPx': round(error / scale, 2),
            'occluded': None,
            'provenance': 'estimated-optical-flow',
        }

    samples = {seed_index: record(seed_index, origin, origin)}
    for direction in (1, -1):
        previous_gray = seed_gray
        previous_points = origin.copy()
        original_points = origin.copy()
        positions = range(seed_position + direction, len(indices) if direction == 1 else -1, direction)
        for position in positions:
            index = indices[position]
            gray = read_gray(index)
            if gray is None or len(previous_points) < 8:
                samples[index] = record(index, np.empty((0, 2), np.float32), np.empty((0, 2), np.float32))
                continue
            forward, status, _ = cv2.calcOpticalFlowPyrLK(previous_gray, gray, previous_points, None, winSize=(25, 25), maxLevel=3)
            if forward is None:
                samples[index] = record(index, np.empty((0, 2), np.float32), np.empty((0, 2), np.float32))
                previous_gray = gray
                continue
            backward, back_status, _ = cv2.calcOpticalFlowPyrLK(gray, previous_gray, forward, None, winSize=(25, 25), maxLevel=3)
            if backward is None or back_status is None:
                samples[index] = record(index, np.empty((0, 2), np.float32), np.empty((0, 2), np.float32))
                previous_gray = gray
                continue
            good = status.ravel().astype(bool) & back_status.ravel().astype(bool)
            good &= np.linalg.norm(backward - previous_points, axis=1) < 2.5
            original_points = original_points[good]
            previous_points = forward[good]
            samples[index] = record(index, original_points, previous_points)
            previous_gray = gray

    capture.release()
    output = {
        'schemaVersion': 1,
        'clipId': args.clip_id,
        'source': {'private': True},
        'method': 'seeded-sparse-optical-flow',
        'video': {'width': width, 'height': height, 'fps': round(fps, 3), 'durationSec': round(count / fps, 3)},
        'seed': {'timeSec': round(seed_index / fps, 3), 'boxPx': args.seed_box, 'features': seed_count},
        'samples': [samples[index] for index in indices],
        'limitations': [
            'Seed rectangle selected once by a developer; tracking after that is automatic.',
            '2D texture transform is not an anatomical nose/eye/ear measurement or a 3D yaw/pitch angle.',
            'Camera motion and supporting hands are not separated from apparent head movement.',
            'Occlusion cannot be classified reliably; null means unknown, not absent.',
            'Low-confidence samples are null; do not interpolate them without review.',
            'Simultaneous touch and movement do not prove causality.',
        ],
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
    valid = [sample for sample in output['samples'] if sample['head'] is not None]
    print(f"{args.clip_id}: decoded {len(indices)} samples; tracked {len(valid)}; seed features {seed_count}")


if __name__ == '__main__':
    run()
