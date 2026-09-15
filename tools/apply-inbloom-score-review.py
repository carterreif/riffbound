"""Render the pinned, reviewed Expert additions; leave the original event table intact.

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
Path(args.output).write_text(source)
print(f'Rendered {len(additions)} Expert additions; original chart unchanged.')
