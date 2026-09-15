"""Render pinned Expert corrections; leave the lower-level event table intact.

Usage: python tools/apply-inbloom-score-review.py --output dist/reference-charts.js
The score image and source audio are private inputs, not repository assets.
Review decisions and measurement notes are in docs/inbloom-chart-review.md.
"""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
review = json.loads((root / 'tools/inbloom-score-review.json').read_text())
source = (root / 'dist/reference-charts.js').read_text()
chart = json.loads(re.search(r'  const chart=(.*);', source).group(1))
assert review['audioId'] == chart['audioId']
assert review['duration'] == chart['duration']
original = {(ms, lane) for ms, lane, _ in chart['hits']}
additions = []
for note in review['notes']:
    assert note['lane'] == 1
    assert 15190 < note['ms'] < 47442
    assert (note['ms'], note['lane']) not in original
    if note['kind'] == 'score-overlap':
        assert (note['ms'], note['withLane']) in original
        strength = .3
    else:
        assert note['kind'] == 'treble-attack'
        assert note['rise'] >= .0014 and note['attackRatio'] >= 1.2
        strength = .2
    additions.append([note['ms'], note['lane'], strength])
assert len({(n[0], n[1]) for n in additions}) == len(additions)
rendered = '  const scoreAdditions=' + json.dumps(additions, separators=(',', ':')) + ';\n'
source, count = re.subn(r'  const scoreAdditions=.*?;\n', lambda _: rendered, source, count=1)
assert count == 1
close_up = review['closeUpReview']
corrections = {'revision': review['revision'], 'additions': [], 'removals': []}
for note in close_up['additions']:
    ms, lane = note['ms'], note['lane']
    assert (ms, lane) not in original
    if note['kind'] == 'open-hat-overlap':
        assert lane == 1 and (ms, 0) in original
        assert note['bar'] in [1, 2, 3, 4, 12]
        strength = .3
    else:
        assert note['kind'] == 'flam-second-stroke'
        assert lane in [0, 2, 4] and note['bar'] in [1, 2, 3, 4]
        assert (note['firstMs'], lane) in original
        assert 16 <= ms - note['firstMs'] <= 55
        assert note['bodyAttackRatio'] >= 3 and note['trebleAttackRatio'] >= 3
        strength = .25
    corrections['additions'].append([ms, lane, strength])
for note in close_up['removals']:
    assert note['kind'] == 'kick-click' and note['lane'] == 1
    assert (note['ms'], 1) in original and (note['ms'], 5) in original
    assert note['trebleSustainRatio'] < 1.2
    corrections['removals'].append([note['ms'], 1])
video_review = review['videoScreensReview']
for note in video_review['additions']:
    ms, lane = note['ms'], note['lane']
    assert lane == 1 and (ms, lane) not in original
    assert note['bar'] in [33, 34, 35, 36, 43, 44]
    start, end = video_review['barWindowsSeconds'][str(note['bar'])]
    assert start <= ms / 1000 < end
    step = note['sixteenth']
    assert isinstance(step, int) and 0 <= step <= 15
    if note['bar'] == 33:
        assert step >= 2  # Opening crash and the following sixteenth rest.
    if note['bar'] == 36:
        assert step <= 14  # Open hat on the first fill snare only.
    if note['bar'] in [43, 44]:
        assert step in [2, 4, 6, 8, 10, 12, 14]
    if note['kind'] == 'score-overlap':
        assert note['withLane'] in [0, 5] and (ms, note['withLane']) in original
        strength = .3
    else:
        assert note['kind'] == 'treble-attack'
        assert note['rise'] >= .0014 and note['attackRatio'] >= 1.2
        assert .45 <= note['decay'] <= 1.65 and note['tail'] < .6
        assert not any(lane == 3 and 0 < ms / 1000 - t / 1000 < .8 for t, lane in original)
        strength = .2
    corrections['additions'].append([ms, lane, strength])
keys = [(ms, lane) for ms, lane, _ in additions + corrections['additions']]
assert len(set(keys)) == len(keys)
assert len({tuple(n) for n in corrections['removals']}) == len(corrections['removals'])
rendered = '  const scoreCorrections=' + json.dumps(corrections, separators=(',', ':')) + ';\n'
source, count = re.subn(r'  const scoreCorrections=.*?;\n', lambda _: rendered, source, count=1)
assert count == 1
Path(args.output).write_text(source)
print(f'Rendered {len(additions)} earlier additions, {len(corrections["additions"])} reviewed overlay additions, '
      f'{len(corrections["removals"])} removals; lower-level baseline unchanged.')
