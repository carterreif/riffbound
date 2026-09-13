"""Rebuild the matched event table from the exact private mono 22050 Hz f32 audio.

Requires numpy/scipy. The audio is not committed. Measured candidate times and
reviewed template examples are pinned in inbloom-onsets.json, independently of
future changes to the general uploader. This fits an estimate, not full ground truth.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.optimize import nnls

parser = argparse.ArgumentParser()
parser.add_argument('--pcm', required=True)
parser.add_argument('--output', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
config = json.loads((root / 'tools/inbloom-onsets.json').read_text())
data = Path(args.pcm).read_bytes()
if hashlib.sha256(data).hexdigest() != config['pcmSha256']:
    raise SystemExit('Use the exact inspected 22050 Hz mono float32 recording.')
samples = np.frombuffer(data, dtype='<f4')
freq, times, spectrum = signal.stft(samples, fs=22050, nperseg=2048, noverlap=1828, boundary='zeros')
power = abs(spectrum) ** 2
dt = times[1] - times[0]
edges = np.geomspace(35, 10000, 81)
bands = np.array([power[(freq >= a) & (freq < b)].sum(axis=0) for a, b in zip(edges[:-1], edges[1:])])
centers = np.sqrt(edges[1:] * edges[:-1])
scale = np.maximum(np.quantile(np.sqrt(bands), .95, axis=1), .00008) ** .7


def features(time):
    frame = int(round(time / dt))
    before = bands[:, max(0, frame - 7):max(1, frame - 3)].mean(axis=1)
    return np.concatenate([
        np.sqrt(np.maximum(0, bands[:, frame + offset:frame + offset + 2].mean(axis=1) - before * .65)) / scale
        for offset in [1, 3, 6]
    ])


templates, labels = [], []
for label, examples in config['templates'].items():
    lane = int(label)
    for time in examples:
        vector = features(time)
        if lane in [1, 3]:
            vector.reshape(3, -1)[:, centers < 1500] = 0
        templates.append(vector / np.linalg.norm(vector))
        labels.append(lane)
matrix = np.array(templates).T
notes = []
for time in config['onsets']:
    vector = features(time)
    coefficients, residual = nnls(matrix, vector, maxiter=300)
    if not np.linalg.norm(vector) or residual / np.linalg.norm(vector) > .65:
        continue
    scores = [sum(coefficients[i] for i, label in enumerate(labels) if label == lane) for lane in range(6)]
    body = max([0, 2, 4], key=lambda lane: scores[lane])
    primary = scores[body]
    lanes = [body] if primary >= 1.1 else []
    if scores[5] >= .65 and scores[5] > primary * .18:
        lanes.append(5)
    if scores[1] >= .15 and scores[1] > primary * .18 and scores[1] > scores[3] * .75:
        lanes.append(1)
    if scores[3] >= .18 and scores[3] > primary * .3 and scores[3] > scores[1] * .85 and (body == 0 or primary < 1.1 or scores[3] > primary):
        lanes.append(3)
    for lane in lanes:
        if any(n[1] == lane and time - n[0] < (.18 if lane == 3 else .07) for n in notes[-12:]):
            continue
        notes.append((round(time, 6), lane, float(scores[lane])))
notes = [n for n in notes if not (n[1] == 3 and any(abs(n[0] - time) < .003 for time in config['rejectedCymbalTimes']))]
chart = {key: config[key] for key in ['audioId', 'duration', 'bpm', 'offset', 'label', 'waveform']}
chart['hits'] = [[round(time * 1000), lane, round(strength, 3)] for time, lane, strength in sorted(notes, key=lambda n: (n[0], n[1]))]
source = (root / 'dist/reference-charts.js').read_text()
source, count = re.subn(r'  const chart=.*?;\n', lambda _: '  const chart=' + json.dumps(chart, separators=(',', ':')) + ';\n', source, count=1)
assert count == 1
Path(args.output).write_text(source)
print(f'Wrote {len(chart["hits"])} matched events; original audio excluded.')
