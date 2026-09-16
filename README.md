# Riffbound

Browser rhythm game, version 37. Play Guitar, Bass, Drums or pitch-pad Vocals with automatic charting and Easy, Medium, Hard and Expert arrangements.

[Play Riffbound](https://riffbound.aaronreifschneider.chatgpt.site)

Expert keeps every distinct note accepted by the audio analysis. Hard, Medium and Easy progressively reduce that chart while preserving retained timing and drum colors. The preview shows the note totals for all four difficulties. Exact duplicate detections of one physical hit are merged; quiet or closely spaced independent hits remain in Expert.

The matched In Bloom drum chart includes score-and-audio reviews for Expert and Hard: separate same-color flam strokes, open hi-hat overlaps, removal of two yellow kick-click artifacts, and 36 additional hi-hats guided by supplied video screenshots. Easy and Medium retain their previous arrangements.

## Automatic phone updates

Open the game while online. It checks for updates at launch, when you return, when the connection comes back, and every five minutes while visible. New game files download automatically. The game refreshes between songs only after the current song is saved; it waits during play, pause, analysis, imports, saves and open panels. It reopens your selected saved song and difficulty without starting playback. Close other Riffbound tabs if an update is waiting.

For phones still running version 36 or earlier, open **Install / offline → Use updated game** once after saving your song, or close all game tabs and reopen online. Version 37 handles subsequent updates automatically. A closed or offline app gets updates next time it is opened online; this is not a background push service.

Opening the matching saved In Bloom recording automatically applies newer reviewed Expert/Hard charts and saves them with its existing audio. Easy, Medium, legacy Normal, other instruments and imported authored drum charts are preserved. No reupload, manual rebuild or desktop export is needed for this matched recording once its audio is saved on the phone. Other recordings retain their charts until you choose **Rebuild this instrument’s chart**.

Songs do not sync between devices. Import the audio or a `.riffpack` backup on the phone once if it is not there yet. Automatic updates never clear song storage; retain backups because the browser or operating system can still remove local storage.

## Chart import and export

Open **Chart files** beside Manage songs. Choose a `.chart` file, then choose its matching audio or use the open song. Review the detected instruments and note counts, choose a drum layout if the file is ambiguous, and click **Load chart**. The song saves to the setlist; select a difficulty and use **Preview chart** to check sync. Timing shift moves notes in milliseconds; positive values move notes later.

Supplied Guitar, Bass and Drums difficulties keep their authored note times, lanes, chords and holds. An import updates only supplied non-empty levels for the same audio; existing other levels and instruments remain. Missing levels for a new instrument are derived and labeled. To replace both Expert and Hard, include both sections in the file.

Export **notes.chart**, **song.ini**, and the original audio from the same panel. Keep all three in one folder when opening the chart in Moonscraper. Exports include all available Guitar, Bass and Drums difficulties, retain imported tempo changes, and use five-lane drums. The complete audio/chart backup remains **Manage songs → Export current song** (`.riffpack`).

This release supports `.chart`, not MIDI. Open guitar/bass notes, sustained drum rolls, six-fret tracks and vocals are not imported. HOPO/tap, accent, ghost and phrase mechanics use Riffbound's existing gameplay. Standard four-lane drums cannot identify every drum voice; prefer five-lane or Pro charts. Pro tom/cymbal combinations that collide on one Riffbound pad are rejected rather than silently dropped. Matching song length does not prove that an audio recording matches a chart: preview it.

Format implementation is original code based on the CC0 [GuitarGame_ChartFormats documentation](https://github.com/TheNathannator/GuitarGame_ChartFormats). No Moonscraper or YARG code/assets, neural models or external processing services are bundled.

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
