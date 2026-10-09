# Riffbound

Browser rhythm game, version 44. Play Guitar, Bass, Drums or pitch-pad Vocals with automatic charting and Easy, Medium, Hard and Expert arrangements.

[Play Riffbound](https://riffbound.aaronreifschneider.chatgpt.site)

Expert keeps every distinct note accepted by the audio analysis. Hard, Medium and Easy progressively reduce that chart while preserving retained timing and drum colors. The preview shows the note totals for all four difficulties. Exact duplicate detections of one physical hit are merged; quiet or closely spaced independent hits remain in Expert.

The matched In Bloom drum chart includes score-and-audio reviews for Expert and Hard: separate same-color flam strokes, open hi-hat overlaps, removal of two yellow kick-click artifacts, and 36 additional hi-hats guided by supplied video screenshots. Easy and Medium retain their previous arrangements.

## Expert note recovery (version 44)

Expert now follows fast repeated Bass/Vocal attacks through their measured band envelopes. Short Guitar attacks can use coherent raw harmonics when the sustained-tone detector masks them; nearby picked notes are checked within their own onset boundaries to preserve pitch colors. Sparse recordings with one clear note or hit are accepted without manufacturing extra notes.

Drums recover strong short hi-hat bursts directly after a crash and verify quieter tom repeats against bodies recovered earlier in the same fill. A delayed kick body can return to a simultaneous measured hand strike only when low-frequency energy rises within its first 12 ms. Later independent kicks retain their own timing. Existing quiet-hat, red-only roll, blue/green tom and cymbal-tail checks continue to apply.

These changes improve recall without completing a rhythm grid or forcing every color into every song. The independent fast-note and single-hit fixtures contain no missed or added notes; dense overlapping kits still have known errors. Reviewed In Bloom/Roam charts remain protected. For existing automatic charts, select the instrument and **Rebuild this instrument’s chart**.

## Follow audible notes on every upload

New Guitar, Bass and Vocal charts distinguish a sharp re-articulation from a held note growing louder. Smooth volume modulation no longer creates repeated note heads. Genuine attacks and stable legato pitch changes still supply notes; no rhythm-grid completion or loudness-based chord generation is used. Drum analysis rechecks recovered orange notes to remove duplicated cymbal detections, snare-wire artifacts and weak fluttering tails. A cymbal decay alone cannot introduce a second hi-hat without separate hi-hat evidence in the recording.

These checks run for any supported recording, including each instrument in Whole song mode. For a previously saved automatic chart, choose its instrument and **Rebuild this instrument’s chart** to use the current detector. Matched reviewed charts and authored imports keep their existing protections. Difficulties reduce accepted Expert notes without adding hits or moving their timing. Preview generated charts: overlapping instruments and very quiet notes can still produce errors.

## Drum colors on new uploads

The detector checks for independent treble attacks when a loud kick or low pitched accompaniment could otherwise supply a false snare body. Short hi-hat attacks stay yellow; sustained cymbal attacks stay orange. Both may coincide with a purple kick. Snare rolls, rack toms and floor toms retain their separate color checks. The change applies to every newly analyzed drum recording, without a Roam-specific lookup or canned rhythm.

For an existing automatic chart, select **Drums → Rebuild this instrument’s chart** to apply the new analysis. This replaces that part's generated chart; export a backup first if you want to retain the previous arrangement. Authored chart imports and the matched In Bloom reference retain their existing handling.

Automatic transcription remains an estimate, especially with loud guitars and overlapping cymbals. The supplied 32-second gameplay excerpt helped verify selected color corrections; this is not a claim of complete or exact Guitar Hero chart reproduction. Use **Chart files** with an authored chart and matching audio when exact note arrangements matter.

## Add any supported song to your setlist

Choose **Your setlist → + Add song** (also in **Manage songs**). Pick an audio file from your phone or computer, choose **Drums**, **Guitar**, **Bass**, **Vocals**, or **Whole song — all four charts**, then tap **Chart & add to setlist**. Full recordings and isolated instruments work. All four difficulty arrangements are generated for each detected part.

Charting progress appears beside the setlist. Wait for **Added to your setlist · Saved on this device** before closing the game. If saving fails, **Retry save** saves the existing chart without analyzing again; **Export backup** protects the open audio and chart. Readding the same audio updates its existing entry and preserves the other parts.

Supported files include MP3, WAV, M4A, OGG and FLAC when your browser can decode them; each must be 5 seconds–8 minutes and at most 80 MB. Automatic charts are estimates, so preview them. This imports local audio files, not streaming-service links. Saved songs are available in the same browser on this device; use a `.riffpack` backup to transfer them elsewhere.

## Automatic phone updates

Open the game while online. It checks for updates at launch, when you return, when the connection comes back, and every five minutes while visible. New game files download automatically. The game refreshes between songs only after the current song is saved; it waits during play, pause, analysis, imports, saves and open panels. It reopens your selected saved song and difficulty without starting playback. Close other Riffbound tabs if an update is waiting.

In **Install / offline**, the current game version and **Check for updates** button are always visible. The button changes to **Use updated game** when a downloaded update is ready. The status distinguishes checking, downloading, no new update, offline and failed downloads. **Save game for offline play** waits for installation and verifies every cached game file before showing **Game saved for offline play**. It can also repair missing game files without changing your setlist.

For phones still showing only **Save game for offline play** and **Install Riffbound**, tap **Save game for offline play** while online and wait for the download. If **Use updated game** appears, tap it after saving your song; otherwise close all game tabs and the installed app after saving, then reopen this same game link online. Version 37 and later handle subsequent updates automatically. A closed or offline app gets updates next time it is opened online; this is not a background push service.

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


Version 39 fixes offline installation on hosts that redirect `index.html` to `/`. It caches the canonical homepage under the existing navigation key, retries failed first registrations, waits for installation before reporting a save, and gives update/download failures a visible reason and retry action. An older controlling worker no longer reloads a newer page in a loop.

## Roam recording update (version 42)

Uploading the exact supplied WhereverImayroamdrumsonly.wav in Drums mode selects the corrected Roam chart: Expert 2051, Hard 1687, Medium 1117, Easy 681. Opening a saved automatic chart or the fingerprinted older Roam backup updates and saves those four arrangements. Independently authored drum charts and other instruments are retained. The current backup already contains the same corrections. Only chart data is shipped; audio remains device-local and must be uploaded/imported once per device.

Revision 3 removes 193 likely snare-noise cymbal duplicates and changes four rack/floor tom colors. Timing and the original WAV are preserved. The shared video covers only an opening passage; later sections remain audio estimates and need preview. Existing In Bloom Expert/Hard updates still preserve its lower difficulties. Offline version 42 caches the Roam reference module.
