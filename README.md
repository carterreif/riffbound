# Riffbound

Browser rhythm game, version 31. Guitar, bass, drums, and pitch-pad vocals, with automatic charting and Easy, Medium, Hard, and Expert arrangements.

Live game: https://riffbound.aaronreifschneider.chatgpt.site

## Run locally

From this folder, run `python3 -m http.server 8080 --directory dist`, then open http://localhost:8080.

## Tests

With Node.js installed, run `node --test tests/*.test.cjs`. Recording-specific tests require the original reference audio and the RIFFBOUND_REFERENCE_PCM / RIFFBOUND_REFERENCE_WAV environment variables. Those private audio files are not included.

The original version 31 verification passed 147 tests with the private reference fixtures available. This handoff packages that existing version; it does not claim a new browser/device test.

## Files

- `dist/`: playable game, assets, offline support, chart analyzers and storage.
- `docs/PRD.md`: requirements and verification history.
- `tests/`: automated tests and synthetic audio fixtures.
- `tools/`: In Bloom reference-chart authoring tools and chart data.

Uploaded songs and setlists live in each player's browser and are not part of this repository. Vocals use pitch pads and holds rather than microphone scoring. Automatic charting of full mixes remains approximate.

## Upload this source to GitHub

1. Extract this ZIP.
2. Sign in to GitHub as an account with write access to the destination repository.
3. Open the repository's Upload files screen. Drag the extracted contents, including the directories, into the upload area. Upload the extracted contents, not the ZIP itself.
4. Review the files and commit. Existing files with the same paths will be updated.

GitHub guide: https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository

## Source snapshot

Original Sites commit: eb670f18c0dc0cc5e594e9492958ba63b6ea1f99

This ZIP is a snapshot of the game files. It does not contain the original Git commit history. Copying it does not automatically synchronize future changes between Sites and GitHub.

