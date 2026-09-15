# Riffbound

Browser rhythm game, version 35. Play Guitar, Bass, Drums or pitch-pad Vocals with automatic charting and Easy, Medium, Hard and Expert arrangements.

[Play Riffbound](https://riffbound.aaronreifschneider.chatgpt.site)

Expert keeps every distinct note accepted by the audio analysis. Hard, Medium and Easy progressively reduce that chart while preserving retained timing and drum colors. The preview shows the note totals for all four difficulties. Exact duplicate detections of one physical hit are merged; quiet or closely spaced independent hits remain in Expert.

The matched In Bloom drum chart includes score-and-audio reviews for Expert and Hard: separate same-color flam strokes, open hi-hat overlaps, removal of two yellow kick-click artifacts, and 36 additional hi-hats guided by supplied video screenshots. Easy and Medium retain their previous arrangements.

For an existing setlist song, open it and choose **Rebuild this instrument’s chart** to apply updated charting to its original audio. The updated arrangements are saved with the original audio.

## Run locally

From this folder, run `python3 -m http.server 8080 --directory dist`, then open http://localhost:8080.

## Tests

With Node.js installed, run `node --test tests/*.test.cjs`. Recording-specific tests require the original reference audio and the `RIFFBOUND_REFERENCE_PCM` / `RIFFBOUND_REFERENCE_WAV` environment variables. Those private audio files are not included.

See [the PRD](docs/PRD.md) for requirements, verification results and testing limitations.

## Files

- `dist/`: playable game, assets, offline support, chart analyzers and storage.
- `docs/PRD.md`: requirements and verification history.
- `tests/`: automated tests and synthetic audio fixtures.
- `tools/`: In Bloom reference-chart authoring tools and chart data.

Uploaded songs and setlists stay in each player's browser and are not part of this repository. Vocals use pitch pads and holds without microphone scoring. Automatic charting of full mixes remains approximate; Expert preserves detected notes, not a guaranteed exact transcription of every sound.

Sites and GitHub retain separate commit histories. Publishing a Site does not automatically synchronize future edits to GitHub; both destinations must be updated.
