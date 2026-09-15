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
keys = [(ms, lane) for ms, lane, _ in additions + corrections['additions']]
assert len(set(keys)) == len(keys)
assert len({tuple(n) for n in corrections['removals']}) == len(corrections['removals'])
rendered = '  const scoreCorrections=' + json.dumps(corrections, separators=(',', ':')) + ';\n'
source, count = re.subn(r'  const scoreCorrections=.*?;\n', lambda _: rendered, source, count=1)
assert count == 1
Path(args.output).write_text(source)
print(f'Rendered {len(additions)} earlier additions, {len(corrections["additions"])} close-up additions, '
      f'{len(corrections["removals"])} removals; lower-level baseline unchanged.')
