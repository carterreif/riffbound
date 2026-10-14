# 2 X 4 recording review (version 77)

The supplied `02 Track 2.riffpack` contains only Drums, generated from the full Metallica recording. It is not an authored Guitar-to-Drums import. Its original Expert estimate has 2,584 notes, including 713 blue/green candidates. The supplied audio SHA-256 is `199a00fc424021a9e6a7841b15c1242b9e03f32e625214d43ea300009f62094e`; decoded duration is 328.1240816326531 seconds.

## Scope and evidence

The isolated opening's waveform and spectrogram identify 13 snare heads, seven rack-tom heads, and one floor-tom head before the first cymbal/kick. Remove metal-color spill and the floor-tom tail's false kick. Both rack voices belong to blue; the low floor voice belongs to green. Keep the measured recording times, rather than imposing a fixed beat grid.

A conservative spectral-template review covers existing tom candidates throughout the recording. Templates come from the clean opening: low rack at 1.325/2.380/3.434 seconds, higher rack at 1.494/2.530/3.585, floor at 4.593, and exposed snares. Compare four attack/body windows after subtracting the preceding spectrum, with frequency weighting measured from this recording. Reject a candidate without sufficient similarity to these tom sounds, or with stronger snare similarity. Use the clearly stronger rack/floor identity to correct 31 later colors. Ambiguous supported rack/floor candidates keep their old color. Coalesce duplicate same-pad detections within 28 ms; retain independent pads/kick.

The corrected Expert arrangement has 1,915 heads: red 483, yellow 513, blue 40, orange 226, green 19, kick 634. Hard/Medium/Easy are progressively reduced subsets with unchanged retained times and colors. Velocity/ghost flags survive except at the explicitly reviewed opening landmarks. Original audio bytes, duration, tempo and unrelated instrument charts are retained.

This is a precision-focused estimated revision, **not** an exhaustive authored transcription. Dense-section snare, hi-hat, cymbal and kick notes retain their previous estimates. Weak buried toms may be omitted by the conservative threshold. Spectral similarity is evidence, not a ground-truth accuracy score. No claim that all notes are correct is made.

The matched Enchor chart lacks Drums. An accessible Songsterr percussion part contains notation only through bar 26, with remaining bars empty; a separate public General MIDI arrangement has unverified timing/structure. Neither is bulk imported. They do not establish a full matching Clone Hero Drum chart.

## Delivery and protection

`track-two-reference.js` bundles only the reviewed note data. Exact audio hash and duration are required; titles and generic Track 2 filenames cannot trigger it. New uploads of those exact bytes use the reviewed Drums. Existing saved estimates update only if every difficulty matches the supplied baseline's two independent rolling fingerprints. Edits, imported Drums and manual drum timing shifts are protected. Other instruments do not use this reference. It ships in the desktop/mobile analysis worker and offline cache; no new audio or public demo is bundled.

Validation uses the actual supplied backup and decoded audio outside the repository, portable-backup byte comparison, desktop/mobile upload adapters, instrument preservation and edit protections. Physical-phone/browser QA is unavailable in this environment.

Release validation: 117 focused checks, 104 passed, 13 optional fixtures for other recordings skipped, zero failures. All nine Track 2 checks ran with the supplied backup and actual decoded recording, including mobile/desktop upload and saved reopen. Playback checks cover each difficulty's accepted note list; they do not prove exhaustive transcription accuracy.
