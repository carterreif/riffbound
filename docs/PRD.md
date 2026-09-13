# Riffbound — accurate automatic charts

Date: 2026-09-12

Status: version 29 adds an audio-matched In Bloom drum event chart following the demo's consistent voice mapping; version 22 setlist storage is preserved

Owner: Riffbound project

Baseline: published version 18

## Problem and outcome

Players upload audio expecting the highway to follow the instrument they hear. Missing hi-hats, extra notes from ringing drums, incorrect colors, and difficulty filters that remove real hits break that connection.

The goal is a chart of every audible strike of the selected instrument, at its actual time and with a consistent color. This release must preserve all distinct **detected** drum strikes in Standard and Expert, improve errors demonstrated by audio fixtures, and measure transcription errors honestly. Preserving detections is not proof that every audible strike was detected correctly.

## Color contract

| Instrument | Sound | Highway color | Lane |
| --- | --- | --- | --- |
| Drums | Snare | Red | 0 |
| Drums | Closed or open hi-hat | Yellow | 1 |
| Drums | Rack tom | Blue | 2 |
| Drums | Crash or ride cymbal | Orange | 3 |
| Drums | Floor tom | Green | 4 |
| Drums | Kick | Purple, full-width bar | 5 |
| Guitar | Detected pitches, ascending within the song | Green, red, yellow, blue, orange | 0–4 |

Loudness, note order, difficulty, and a missed hit must never rotate colors. Repeated guitar pitches keep their assigned lane. The green pad's orange assist changes input acceptance only; it must not recolor the chart.

## Requirements and acceptance

| ID | Requirement | Release acceptance |
| --- | --- | --- |
| R1 | Analyze only the chosen instrument. | Instrument isolation tests pass; guitar and drums remain separate saved charts. |
| R2 | Use the fixed color contract. | All labeled isolated kit hits match their expected lane; test quiet repeats, open hats, rides, and concurrent kick/hand strikes. |
| R3 | Preserve distinct detected strikes. | Standard and Expert retain every accepted drum event, including fast repeats on all six lanes and overlapping voices. No two-hand cap or tempo-based thinning. Only same-lane duplicate detections within 12 ms may be merged, keeping the stronger detection's original time. |
| R4 | Offer a detailed guitar chart. | Expert keeps distinct detected tonal attacks; Standard and Warmup may simplify. Surviving notes retain their pitch, lane, and onset. |
| R5 | Follow the audio clock. | Preserve unquantized onset times. Labeled synthetic hits match within 30–35 ms; the supplied recording's 28 inspected landmarks remain within 35 ms. Silence and intentional rests must not be filled from a beat grid. |
| R6 | Improve recognition without trading misses for false colors. | Score one-to-one matches per lane, report missed and extra notes separately, and retain existing color/timing checks. Existing dense hi-hat fixture must maintain at least 97% precision and recall. Add regression checks for concrete newly corrected errors. |
| R7 | Make the result reviewable. | Preview shows the selected instrument's notes and counts by sound/color. Explain that transcription is estimated and Warmup has fewer hits. Existing saved tracks can be explicitly rebuilt from their original audio. |
| R8 | Preserve songs and controls. | Upload, rebuild, save, export/import, instrument switching, mobile controls, and orange/green assist continue to pass applicable existing regression checks. Do not clear or migrate away saved audio. |
| R9 | Deliver traceable work. | Record changes and measured results here, commit the PRD with the tested source, publish the update to the existing game, and provide rebuild instructions. |

## Player flow

1. Choose Drums or Guitar and upload audio, or open a saved song and select **Rebuild this instrument’s chart**.
2. Analyze the uploaded audio locally, detect attacks, classify the selected instrument, and retain the measured timing.
3. Build charts using the color contract. Standard/Expert drums retain detections; Warmup offers a reduced subset.
4. Preview sections against the original audio, then play and save to the device's setlist.

## Measurement method

Use independently labeled strike times and lanes. Each expected hit can match at most one generated note of the same lane within the stated timing tolerance. Unmatched expected hits are misses; unmatched generated notes are extras. A wrong-color note produces a miss on the correct lane and an extra on the incorrect lane. Report precision and recall separately for each represented lane; never infer accuracy from note counts alone. Report timing error only for correctly matched hits.

Keep detector evaluation separate from chart construction: audio tests check which strikes were recognized; event-retention tests check whether chart construction loses or recolors accepted detections. Use deterministic fixtures with varied loudness, silence, deliberate rests, rapid repeats, overlapping voices, and more than one kit. The real recording has only 28 inspected landmarks and cannot establish full-song precision or recall.

## Scope and constraints

- Use the existing browser worker and audio clock; retain local processing and device-local saving.
- Keep original audio and independently saved instrument charts intact when rebuilding another part.
- Do not invent notes from tempo, filenames, known song patterns, or random lane assignments.
- Guitar colors represent pitch groups, not literal guitar strings; current analysis does not fully transcribe polyphonic guitar chords.
- No promise of perfect transcription for arbitrary mixes. Cymbal wash, overlapping snare/hat attacks, unusual tuning, distortion, and quiet ghost notes remain challenging.

## Full transcription milestone

The longer-term target is **100% recall with zero wrong-color or extra notes on a fully annotated reference set**. This is not a claim about the current game. Before claiming this target, annotate complete representative recordings across multiple kits and mixes, include tom fills and quiet overlaps, and pass the same per-lane one-to-one evaluation without tuning on the held-out recordings. If automatic detection remains imperfect, a note correction workflow is needed to let players finish a chart precisely. These are open product requirements, not silently waived release checks.

## Implemented changes

1. **R3:** Standard and Expert drums now retain all distinct accepted hits on every lane. Removed the 100 ms repeat filter and two-hand cap. Keep distinct flams, simultaneous voices, and weak repeats; merge only same-lane duplicate detections within 12 ms. Warmup remains a subset using original times and colors.
2. **R4:** Expert guitar retains distinct detected tonal attacks without tempo-based thinning. Standard and Warmup still simplify; pitch-to-color assignments stay consistent.
3. **R2/R6:** Verify an independent tom resonance when a learned tom event overlaps a kick. This removes the 32 false green notes found in the kick/snare/hat fixture while preserving genuine floor-tom and rack-tom strikes alongside kicks in the fill fixture.
4. **R2/R6:** Correct a learned snare/tom template exchange only when there is a clear noisy-snare versus clean-tone distinction. A broader remapping attempt failed the supplied recording's snare landmarks and was rejected; the narrower guard passes those landmarks.
5. **R5/R6:** Require a fresh noisy attack for directly classified crashes, so a cymbal's swelling tail does not become a second orange note. This matters after removing chart-level repeat suppression.
6. **R7:** Preview explains all drum colors, full detected-hit retention, and Expert's tighter timing. Guitar preview explains Expert attack retention. Per-color counts and the estimate limitation remain visible.
7. **R8/R9:** Incremented drum/guitar analysis versions and the offline asset cache. Retained the existing upload, audio backup, setlist, rebuild, and input-assist paths.

## Measured results

These are fixture measurements, not claims about every uploaded song. Dense kit measurements use one-to-one matches within 30 ms and are identical in Standard and Expert.

| Fixture | Sound | Expected | Matched | Missed | Extra | Precision | Recall |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Kick/snare/hat pattern | Snare | 32 | 32 | 0 | 0 | 100% | 100% |
| Kick/snare/hat pattern | Hi-hat | 121 | 119 | 2 | 2 | 98.3% | 98.3% |
| Kick/snare/hat pattern | Kick | 32 | 32 | 0 | 0 | 100% | 100% |
| Kick/snare/hat pattern | Tom, cymbal, floor tom | 0 | 0 | 0 | 0 | — | — |
| Pattern with concurrent tom fills | Snare | 32 | 32 | 0 | 0 | 100% | 100% |
| Pattern with concurrent tom fills | Hi-hat | 121 | 117 | 4 | 4 | 96.7% | 96.7% |
| Pattern with concurrent tom fills | Tom | 4 | 4 | 0 | 0 | 100% | 100% |
| Pattern with concurrent tom fills | Floor tom | 4 | 4 | 0 | 0 | 100% | 100% |
| Pattern with concurrent tom fills | Kick | 32 | 32 | 0 | 0 | 100% | 100% |
| Pattern with concurrent tom fills | Cymbal | 0 | 0 | 0 | 0 | — | — |

- The first fixture previously generated **32 false green notes**. The fill fixture previously swapped red and blue body parts and generated **24 extra green notes**. Those demonstrated body-color errors are corrected.
- Hat performance is unchanged from version 18 on both dense fixtures. The original fixture meets its existing 97% gate. The newly added, harder fill fixture remains below that target; its regression check prevents worsening the measured baseline of 117 matches and 4 extras. This is an open accuracy issue, not a perfect-transcription pass.
- All **40 labeled strikes** across isolated demo voices, a differently tuned independent kit, and simultaneous kick/hand fixtures retain the correct lane within 35 ms, with no extra notes. This includes quieter repeats, open hats, and rides.
- The known-pitch guitar fixture retains **20/20 attacks** with correct measured pitch and stable colors. Separate construction tests retain all 30 rapid tonal events and every accepted event in the six-lane drum repeat/flam fixture.
- The supplied recording retains **28/28 inspected landmarks** within 35 ms: median timing error **0.7 ms**, maximum **15.7 ms**. Its full 272.7-second transcription is not annotated or scored.

## Verification and traceability

| Requirements | Evidence |
| --- | --- |
| R1 | `tests/focused-chart.test.cjs`; separate instrument upload/rebuild tests |
| R2 | `tests/note-colors.test.cjs`; two per-lane dense-kit checks in `tests/hi-hat.test.cjs` |
| R3–R4 | `tests/chart-retention.test.cjs`; fast-roll check in `tests/upgrades.test.cjs` |
| R5 | `tests/drum-recording.test.cjs`; attack/silence checks in `tests/autochart.test.cjs`; audio-clock checks |
| R6 | `tests/chart-metrics.cjs`; duplicate/wrong-color metric regression; measured table above |
| R7–R8 | Preview, upload, rebuild, cancellation, mobile, green/orange, backup, setlist, and atomic-storage checks |
| R9 | This PRD accompanies the committed static game; publish and handoff use the same source |

Final regression result: **56 passed, 0 failed, 0 skipped**, including the supplied recording (60.1 seconds). Syntax checks and `git diff --check` pass. The full-transcription milestone remains open as documented above.

Run the repeatable suite from the repository root:

```sh
RIFFBOUND_REFERENCE_PCM=/path/to/mono-22050-float32.pcm node --test tests/*.test.cjs
```

The optional PCM is the user's original recording converted to mono 22,050 Hz raw float32 audio. It stays outside the repository and deployed game. Without that environment variable, the real-recording check is skipped; the deterministic fixtures still run.

## Remaining work and next use

- Improve the remaining quiet/overlapping hi-hat misses and false yellow hits, including the harder fill fixture's sub-97% result.
- Build and label a broader reference set, especially busy cymbal patterns, ghost notes, different tunings, and dense mixes. Detection still has minimum onset spacing and can miss very fast attacks even though chart construction now preserves distinct accepted events.
- Add a correction workflow for uncertain or missed notes before claiming complete, exact charts. Complete polyphonic guitar transcription remains outside this release.
- Existing setlist charts retain their saved version until the player opens the song, selects its instrument, and chooses **Rebuild this instrument’s chart**. Preview the rebuilt chart, then verify its saved status. Installed/offline players may need **Install / offline → Use updated game** first.

## Version 20 — recurring save error

### Report and evidence

The player again saw “The song audio is missing or too large” while a song remained playable. The current upload code already preserves a Blob before audio decoding detaches the input buffer, and its rebuild test passes. The screenshot cannot establish the running version or exactly why that tab lacks a usable audio attachment. An older running/offline copy remains possible; it is not a confirmed diagnosis.

The supplied original WAV is **48,097,596 bytes (45.9 MiB)**, below the **80 MiB** limit. Its exact bytes pass reconnect, storage-adapter, and backup round-trip verification. This does not measure available space or prove that IndexedDB works in the player's browser.

### Additional requirements

| ID | Requirement | Acceptance |
| --- | --- | --- |
| S1 | Report the actual save condition. | Empty/missing audio and oversized audio have separate errors; the size limit is explicit. Invalid audio is rejected before opening a database transaction. |
| S2 | Recover the open chart using its original recording. | **Reconnect original audio** accepts only a byte-for-byte SHA-256 match to the song ID, retains both instrument charts and timing, and saves automatically without charting again. |
| S3 | Preserve recovery options on failure. | A mismatched file leaves the open song unchanged. Missing audio does not prompt the player to export a backup that cannot be created; reconnect remains available. Valid audio with a storage failure remains exportable. |
| S4 | Keep audio ownership separate from analysis results. | Rebuilding an instrument cannot overwrite the original audio Blob, decoded buffer, ID, filename, title, or recording length even if a worker response contains those fields. |
| S5 | Make repeat reports diagnosable. | Manage songs shows the attached audio size or exact attachment problem, plus **Game version 20**. Update the offline cache for the release. |

### Implementation and verification

- Implemented S1–S5 in the existing local song library and Manage songs flow. No database deletion, cloud storage, or audio conversion is introduced.
- Recovery checks exercise missing audio, wrong-file rejection, successful reattachment, both instrument charts, automatic setlist saving, backup round-trip, and reopening after a fresh page. Reconnection performs no new audio analysis.
- Verified the original 45.9 MiB WAV by matching its SHA-256 after reconnect, save/load, and export/import. The tests use a storage adapter; actual device quota failures still require freeing space or exporting a backup.
- Full affected regression result: **41 passed, 0 failed, 0 skipped** (58.7 seconds), including the original WAV recovery test. Syntax and whitespace checks pass. The chart detector is unchanged from version 19.

Run the affected suite with the optional original recording:

```sh
RIFFBOUND_REFERENCE_WAV=/path/to/InbloomNirvanadrumsonly.wav node --test tests/upload-flow.test.cjs tests/storage-offline.test.cjs tests/upgrades.test.cjs
```

### Recovery flow for the player

1. Confirm **Game version 20** at the bottom of Manage songs. For an older installed copy, apply the offered update under **Install / offline**. A reload ends an unsaved session, so retain the backed-up original audio and export the current song first if export works.
2. After updating from an older session, upload the backed-up original WAV again, then choose **Save current song**.
3. If the new dialog reports missing audio for an open chart, choose **Reconnect original audio** and select the exact file used for that chart. The repaired song is saved automatically.
4. Confirm **Added to your setlist · Saved on this device.** If saving instead reports full browser storage, follow that specific message; reattaching audio does not create more disk space.

## Version 21 — closing database connection

### Confirmed failure path

The next screenshot identifies **Game version 20**, **Audio attached · 45.9 MB**, and the exact transaction error **“The database connection is closing.”** The library cached an already-resolved open promise and reused its database handle after it closed. It neither invalidated unexpected closures nor recovered when creating a transaction on that handle threw.

The fault-injected test reproduces that exact exception on the previous code and now succeeds. This establishes the application's stale-handle recovery defect; it does not establish why the player's browser originally closed its connection. Browsers reject new transactions once a connection is closing, and a forced closure aborts existing transactions before its close event. [IndexedDB connection lifecycle](https://www.w3.org/TR/IndexedDB/#close-a-database-connection).

### Requirements and implementation

| ID | Requirement | Implemented behavior |
| --- | --- | --- |
| C1 | Recover a closed connection without deleting songs. | Cache the active handle separately from a pending open. Invalidate on close/versionchange and when transaction creation throws a closing-connection error; reopen the same database. |
| C2 | Bound automatic retries. | Retry the operation once on a fresh handle. Persistent failures produce an actionable backup/retry message; another manual Save starts fresh. |
| C3 | Keep failed writes atomic. | Wait for the transaction's abort event before retrying. A request error alone does not authorize replay while rollback may still be pending. |
| C4 | Preserve operation order across recovery. | Queue save/remove operations so an older retry cannot overwrite a newer chart or resurrect a removed song. |
| C5 | Handle competing reads and delayed events. | Concurrent operations share a pending open. Old close events cannot evict a replacement handle; abandoned blocked opens close their late successful handle. |
| C6 | Preserve real error distinctions. | Do not automatically retry quota errors or application validation errors. Valid audio remains exportable when the browser cannot save. |

No schema change, database deletion, audio reattachment, or new chart analysis is required by this fix. Manage songs and the offline bundle identify the updated release as **21**.

### Verification

- **Eight lifecycle regressions pass:** exact closing-handle error, close/versionchange events, concurrent setlist/save access, aborted-write recovery, ordered saves/removals, bounded failure/manual retry, quota rollback without replay, and late blocked-open completion. The initial seven-case suite failed six cases on version 20 before the fix.
- **20 storage/offline/playback checks plus 13 focused UI checks pass (33 total, no failures or skips)**, including the original 48,097,596-byte WAV's save and backup round-trip.
- Tests use deterministic fault injection for IndexedDB lifecycle events and storage adapters. A browser executable is unavailable in this environment, so these results do not claim live verification in the player's browser. The chart detector and gameplay rendering are unchanged.

```sh
RIFFBOUND_REFERENCE_WAV=/path/to/InbloomNirvanadrumsonly.wav node --test tests/storage-connection.test.cjs tests/storage-offline.test.cjs tests/upgrades.test.cjs
node --test --test-name-pattern='saved songs reopen|detachment|chart rebuilds cannot|missing audio reconnects|storage failure|save failures|late empty|cached guitar|setlist' tests/upload-flow.test.cjs
```

### Player recovery

Export the current song before refreshing; the screenshot confirms its audio remains attached, so the backup can preserve the existing chart. Apply the game update, confirm **Game version 21**, then import that `.riffpack` backup. Import saves automatically; if needed, choose **Save current song** again. Confirm the saved status before closing. Persistent browser storage failures still require exporting a backup and addressing the browser/device condition; the game never clears stored songs to repair a connection.


## Version 22 — audio write failure and empty setlist recovery

### Observed failures

The version 21 screenshot shows valid attached audio (45.9 MB) but **Failed to write blobs (IOError)**. Reopening a closed connection cannot repair this separate Blob write path. A later screenshot has no uploaded song open and no saved entries, so Save and Export are correctly disabled but the dialog needs an immediate way to restore or upload a song.

### Requirements and implementation

| ID | Requirement | Implemented behavior |
| --- | --- | --- |
| B1 | Save without depending on IndexedDB Blob writes. | Write audio as raw ArrayBuffer records of at most 32 KiB. Reassemble the original Blob only in memory when opening/exporting. No compression, resampling, or audio changes. |
| B2 | Avoid large chart records as well. | Encode the full metadata, charts, and waveform as JSON bytes in 32 KiB records. The setlist stores a small summary with instrument names; listing does not load audio or note arrays. |
| B3 | Keep songs complete and recoverable across writes. | Commit audio parts, chart parts, manifests, and setlist summary in one transaction, requesting strict durability. Read audio before opening the write transaction. Keep version 21's ordered write queue and bounded reconnect retry. Report success only after transaction completion. |
| B4 | Preserve existing songs and both instruments. | Read legacy Blob entries; convert on the next successful save in the same database, merging the previous guitar/drum charts within the write transaction. No database deletion or schema upgrade. |
| B5 | Avoid incomplete playback and orphaned records. | Validate manifest sizes and every chunk length on read. A failed replacement rolls back all writes. Removal deletes its summary, manifest, and both sets of chunks together. |
| B6 | Make an empty session actionable. | Manage songs explains that no uploaded song is open. Add Upload drums and Upload guitar buttons; either selects the instrument before opening the audio picker. Import backup preserves existing charts. |
| B7 | Preserve honest failure states. | Distinguish disk I/O from closing-connection errors, keep valid audio exportable, and never show a saved confirmation on a rejected write. Device-wide storage failures still need free space or another browser. |

The game remains explicitly device-local and keeps the same public origin, IndexedDB name/version, and portable .riffpack format. Notes, colors, automatic charting, and gameplay are unchanged. The Manage songs version and offline cache are updated to 22.

### Verification and limits

- The version 21 implementation reproduces **Failed to write blobs (IOError)** in the fault adapter; the new implementation saves and reopens under the same rejection rule.
- **24 storage/offline/playback checks plus 15 focused UI checks pass (39 total, no failures or skips).**
- All **48,097,596 original WAV bytes** survive save, a fresh library instance, opening, export, and import, verified by SHA-256. The largest stored record is **32,768 bytes**. The test rejects every Blob write and every value above 64 KiB.
- A dense fixture with 6,000 notes per difficulty reopens with exact note data; legacy migration retains both instruments; interrupted chunk replacement preserves the previous song; removal leaves no audio records; a missing chunk fails explicitly.
- The empty-dialog test runs actual game handlers against the real song library with the fault adapter. Upload drums adds the song to the setlist; a fresh game instance reopens its audio and chart without invoking chart analysis.
- These are deterministic DOM/audio/IndexedDB adapters, not a live test in the player's browser. A browser executable was unavailable and its download timed out. This fix bypasses the identified Blob path; it cannot guarantee that a device with a broader disk or browser-profile failure will accept writes.

```sh
RIFFBOUND_REFERENCE_WAV=/path/to/InbloomNirvanadrumsonly.wav node --test tests/storage-offline.test.cjs tests/storage-connection.test.cjs tests/upgrades.test.cjs
node --test --test-name-pattern='Manage songs explains|persistent disk IO|saved songs reopen|detachment|chart rebuilds cannot|missing audio reconnects|storage failure|save failures|late empty|cached guitar|setlist' tests/upload-flow.test.cjs
```

### Player recovery

If a song is still open, export it before updating. Apply the update and confirm **Game version 22**. In Manage songs, use **Import backup** with an existing .riffpack, or **Upload drums** with the original drum WAV if no backup exists. Upload/import saves automatically. Wait for **Added to your setlist · Saved on this device**, then reopen the game and select the song from the setlist. Do not clear the game's site data to apply this update.


## Version 23 — fewer extra drum notes and better tom-fill colors

### Goal and implementation

The player reports notes that are not present in the audio and asks for tom fills to use blue, with the other drum colors following their actual sounds. Keep the color contract and measured, unquantized timing. Improve demonstrated errors without claiming complete transcription of arbitrary recordings.

| Requirement | Implementation |
| --- | --- |
| Reject a ringing floor tom when the next kick arrives. | A concurrent tom now needs a spectral peak that has grown relative to the pre-hit audio, as well as an independent pitched body. A surviving old resonance is insufficient. |
| Reject extra cymbal/hat notes in ringing tails. | Verify a new treble attack around each separated cymbal event. A narrow timing allowance preserves attacks refined a few milliseconds early or late. |
| Assign clean tom fills by their sound. | Check clean low-frequency body pitch at accepted tom events. Separate rack-tom and floor-tom colors rather than relying solely on a learned component index. |
| Recover measured fill attacks masked by the learned model. | A raw low-frequency onset must agree with a sufficiently strong learned drum candidate, clean pitched body, and fresh energy rise. Conservative kick guards prevent creating rack toms from kick harmonics. Stable low-tom pitch can correct a mistaken kick label. |
| Avoid duplicate interpretations of one attack. | When multiple candidates of the same lane point to the identical measured attack, keep the stronger candidate. Chart construction still retains distinct accepted hits and does not fill a beat grid. |
| Preserve existing songs and gameplay. | No storage or audio-clock changes. Drum analysis version is 5; guitar remains 3. Offline cache and displayed game version become 23. Existing charts change only after an explicit rebuild. |

### Measured changes

New 24-second fixtures include deliberate rests, snare rolls, two rack-tom pitches, floor toms, kick pitch sweeps, quieter repeats, and overlapping cymbal noise. Two deterministic noise realizations expose different learned-template errors. One-to-one matches use a 30 ms tolerance; Standard and Expert have identical detected-hit results.

| Fixture | Voice | Expected | Version 22 matched / extra | Version 23 matched / extra |
| --- | --- | ---: | ---: | ---: |
| Mixed fill A | Snare / red | 36 | 33 / 3 | 33 / 0 |
| Mixed fill A | Rack tom / blue | 16 | 4 / 0 | 10 / 0 |
| Mixed fill A | Floor tom / green | 12 | 6 / 4 | 10 / 0 |
| Mixed fill A | Kick / purple | 28 | 27 / 2 | 27 / 1 |
| Mixed fill B | Snare / red | 36 | 34 / 0 | 34 / 0 |
| Mixed fill B | Rack tom / blue | 16 | 4 / 0 | 14 / 0 |
| Mixed fill B | Floor tom / green | 12 | 0 / 10 | 9 / 0 |
| Mixed fill B | Kick / purple | 28 | 26 / 9 | 26 / 3 |

Total extras fall from **22 to 14** in fill A and **32 to 16** in fill B. The four green notes wrongly triggered by kicks after floor-tom hits are removed. Blue/green precision is 100% on these fixtures, but recall remains incomplete, as the table shows.

The existing concurrent-tom/hi-hat fixture improves from **117/121 yellow hits with 4 extras** to **117/121 with 2 extras**. Existing snare, tom, floor-tom, and kick results stay exact on that fixture. The simpler dense-hat fixture remains **119/121 with 2 extras**. All inspected recording landmarks must still pass; the full real recording has not been exhaustively annotated.

### Explicit remaining limitations

The harder new fixtures still have **85/91 hi-hats with 13 extras** and **0/4 overlapping crash hits**, unchanged from version 22. Those synthetic snare/hat/crash noise mixtures remain difficult for the learned separator. Some quiet tom repeats and snare hits remain missed. This release improves measured fill colors and removes identified false notes; it does not meet the full-transcription milestone. Do not describe the whole uploaded song as perfectly accurate.

A broad recovery attempt was rejected because it introduced rack-tom candidates near kick harmonics. A treble check without timing allowance was also rejected because it removed a known recording hi-hat. The shipped checks require corroborating evidence and preserve the existing recording landmarks.

### Regression coverage and player flow

`tests/drum-fills.test.cjs` tracks the new per-lane outcomes and the floor-tail/kick regression. `tests/hi-hat.test.cjs` now requires no more than two extras on the older fill fixture. Existing color, rapid-hit retention, real-recording timing, guitar, upload/rebuild, mobile control, and storage tests remain applicable.

To apply the correction to a saved song: open the song, choose **Drums**, select **Rebuild this instrument’s chart**, then preview the fill. Rebuilding saves the updated drum chart automatically while retaining the original audio and any guitar chart. Standard/Expert provide the full set of accepted detections; Warmup remains a simplified subset.

Final version 23 verification: **76 passed, 0 failed, 0 skipped**, including the original WAV save round-trip and the real recording's 28 landmarks (median timing error 0.7 ms; maximum 15.7 ms). Full suite completed in 40.8 seconds. Browser-facing flows use deterministic adapters; no live browser accuracy claim is made.

```sh
RIFFBOUND_REFERENCE_PCM=/path/to/mono-22050-float32.pcm RIFFBOUND_REFERENCE_WAV=/path/to/original.wav node --test tests/*.test.cjs
```

## Version 24 — separate snare rolls from cymbal noise

### Goal and chart-authoring reference

A snare-only roll must remain red at each measured strike. Its shell resonance must not create blue notes and its wire noise must not create yellow/orange chords. Preserve real overlapping voices when independently supported; keep blue rack toms, green floor toms, orange cymbals and purple kicks tied to their sounds.

In a [2007 developer interview](https://www.wired.com/2007/10/interview-guita/), Neversoft's Alan Flores described hiring musicians who transcribed songs into the game's buttons and worked with MIDI. This is evidence of a human authoring workflow, not a published automatic-upload algorithm. Riffbound uses its own audio analysis and preview workflow. It does not claim to implement RedOctane's internal tools or reproduce their exact charts.

### Requirements and implementation

| ID | Requirement | Implementation |
| --- | --- | --- |
| F1 | Treat one snare as one body voice. | The direct classifier keeps a recognized snare's shell and wire noise together as red; a separately recognized kick can remain. |
| F2 | Find short rolls despite ringing from the previous strike. | Classify fresh treble attacks as possible snares instead of assuming they can only be hats. A short noise-envelope check avoids the old long-window decay measurement for snare identification. |
| F3 | Recover quieter red strikes from audio evidence. | Measure additional attacks with 5 ms treble windows. Recovery requires a fresh onset, a substantial pitched snare body, a compatible noise decay and a neighboring recognized snare of similar tuning. Align timing in the same treble band that detected the attack. No beat-grid completion, inserted roll pattern or arbitrary color cycling. |
| F4 | Reject duplicate cymbal interpretations during snare rolls. | For neighboring, similarly tuned snare strikes 40–190 ms apart, compare treble/mid attack and early-tail energy. A shared envelope remains one red hit; yellow requires distinctly faster treble energy and orange requires slower independent noise. This is a conservative audio-based overlap check, not an unconditional ban on chords. |
| F5 | Retain real overlaps and original timing. | Independently supported hi-hats remain yellow, including accents in rolls. Notes on other onsets are not removed because a roll exists. Standard/Expert keep every accepted strike; Warmup remains a subset with the same colors/times. |
| F6 | Preserve the existing game and setlist. | No storage, playback-clock, input, stage, or guitar-analysis changes. Drum chart version becomes 6, displayed game version 24 and offline cache v24-1. Previously saved charts change only through explicit rebuilding. |

### Measured acceptance

One-to-one matching uses the independently labeled fixture audio and a 30 ms timing tolerance. Wrong colors count as both a missed correct note and an extra wrong note.

| Test | Version 23 | Version 24 |
| --- | --- | --- |
| Short snare-only roll, seed 313, 120 ms spacing | 3/40 red strikes, 2 false blue notes | 40/40 red strikes, no extra colors |
| Six snare-only variants: three noise realizations at 80/120 ms spacing, including quieter accents | Newly added coverage | 40/40 red strikes in each variant, zero extras on every lane |
| Same six rolls with 10 real hi-hat accents each | Newly added coverage | All 40 snares; 8–10/10 hi-hats, zero extras |
| Mixed fill A: red snare | 33/36, 0 extra | 36/36, 0 extra |
| Mixed fill B: red snare | 34/36, 0 extra | 36/36, 0 extra |
| Mixed fill A/B: yellow hi-hat | 85/91, 13 extra each | 85/91, 1 extra each |

Every snare-only roll strike in the mixed fixtures is checked directly for exactly one red note. All previous blue/green acceptance gates remain: mixed fill A has 10/16 blue and 10/12 green; B has 14/16 blue and 9/12 green, with no false blue or green notes. The original dense-hi-hat fixtures retain their previous measured recall and precision. The original recording's 28 inspected landmarks and original-WAV setlist round-trip remain release gates.

### Limits and release checks

This is not a complete transcription solution. Ambiguous simultaneous noise can still hide hats, and conservative separation can omit a quiet cymbal played with a snare roll. The harder mixed fixtures still miss all four overlapping crashes; their tom recall remains incomplete, and one isolated false yellow note remains outside the rolls. The whole real recording is not fully annotated. The short envelope check is designed around typical rolls at 80 ms or more; substantially faster hits and varied acoustic snares need additional labeled evaluation.

`tests/snare-rolls.test.cjs` covers the new isolated/overlapping roll cases. `tests/drum-fills.test.cjs` now requires all 36 snares, at most one false yellow, and red alone at snare-only fill positions. The full existing suite covers other colors, guitar, original recording timings, worker/upload/rebuild flow, mobile inputs, offline assets and saved-song storage. Browser-facing tests use deterministic adapters, not a live browser run.

Player flow: apply the update, confirm **Game version 24**, open the saved song, choose **Drums**, select **Rebuild this instrument’s chart**, then **Preview chart** at a fill. Rebuilding automatically saves the new drum chart with its original audio and preserves any guitar chart.

Final version 24 verification: **88 passed, 0 failed, 0 skipped** in 43.8 seconds. The original recording's 28 inspected hits retain a median timing error of 0.7 ms and maximum of 15.7 ms. All 48,097,596 original WAV bytes still survive the setlist save/reopen/export round-trip. No claim of complete real-song transcription or a live-browser test is made.

```sh
RIFFBOUND_REFERENCE_PCM=/path/to/mono-22050-float32.pcm RIFFBOUND_REFERENCE_WAV=/path/to/original.wav node --test tests/*.test.cjs
```

## Version 25 — individual drum colors and quieter fill strikes

### Report and goal

The player still hears fills that alternate red/yellow incorrectly, missing rack/floor tom strikes, and hi-hats interpreted as toms. Keep the established sound-to-color contract. Separate a new attack from the previous drum's ringing body, recover quieter measured strikes, and distinguish short hats from sustained cymbals. No smoothing onto a beat grid, color rotation, or invented fill pattern is permitted.

### Implementation and acceptance

| ID | Requirement | Behavior and verification |
| --- | --- | --- |
| C1 | Retain quiet blue/green tom repeats. | Clean pitched attacks can use weaker corroborating learned evidence. A short body-onset pass and a same-tuning neighboring tom can supply additional candidates. Comparing the pitched vibration's amplitude and phase distinguishes a real quiet repeat from simple decay. Additional candidates require evidence, not an expected rhythmic position. |
| C2 | Prevent a hi-hat from inheriting an old tom's body. | Verify a fresh, short treble attack separately. A tom requires a changed pitched resonance; an unchanged ringing body underneath the hat is insufficient. A tom's own faint stick noise does not automatically add yellow. |
| C3 | Preserve orange cymbals and real yellow/orange overlaps. | Measure noise through two high-pass stages, estimate the pre-existing tail, and subtract it before examining decay. A strong new sustained component supports orange. A separately supported fast component can retain yellow at the same time. |
| C4 | Recover hats masked by the larger analysis window. | Review measured 5 ms treble onsets as well as spectral candidates. Require a fresh noise contribution and short residual decay; reject a fresh tom body unless additional noise is substantial. |
| C5 | Keep snare rolls red. | Preserve version 24's snare-roll verification and all six 40-hit snare-only tests. In the sparse classifier, require new snare noise at the actual onset so a later cymbal entering the FFT window cannot create an early red note. |
| C6 | Preserve timing, saved songs and other instruments. | Keep actual measured timestamps, the existing duplicate-only merge and difficulty rules. No storage, audio-clock, highway rendering, input-assist or guitar-analysis changes. Drum analysis version 7; displayed game version 25; offline cache v25-1. |

### Measured results

The new fixture contains alternating toms and hats, quieter repeated toms, red-only rolls, isolated crashes followed by hats, kicks and rests. Noise realizations and hat volume vary. Ground truth is recorded while mixing each known voice, independently of the detector; evaluation uses one-to-one 30 ms matching.

| Fixture / voice | Version 24 matched / expected, extras | Version 25 matched / expected, extras |
| --- | --- | --- |
| New mixed-color A: yellow | 26/30, 6 | 29/30, 0 |
| New mixed-color A: blue | 24/24, 0 | 24/24, 0 |
| New mixed-color A: green | 23/24, 0 | 24/24, 0 |
| New mixed-color A: orange | 0/6, 0 | 6/6, 0 |
| Older difficult fill A: blue | 10/16, 0 | 14/16, 0 |
| Older difficult fill A: green | 10/12, 0 | 12/12, 0 |
| Older difficult fill A: orange | 0/4, 0 | 2/4, 0 |
| Older difficult fill B: blue | 14/16, 0 | 15/16, 0 |
| Older difficult fill B: green | 9/12, 0 | 11/12, 0 |
| Older difficult fill B: orange | 0/4, 0 | 1/4, 0 |
| Existing dense-hat fixture: yellow | 119/121, 2 | 121/121, 2 |
| Existing hats with concurrent toms: yellow | 117/121, 2 | 121/121, 2 |

New mixed-color B detects all 114 labeled strikes with zero extras. New mixed-color A detects 113/114, missing one yellow; all its snares, toms, floor toms, crashes and kicks are correct. Both older difficult fills retain all 36 red hits and red alone at snare-only roll positions. Their yellow results are 86/91 with one extra (A) and 85/91 with one extra (B). Neither gains false blue/green notes.

### Remaining limits

Automatic transcription is still an estimate. The quieter hat variant detects 24/30 hats, with all other voices correct; the very quiet variant detects 20/30 hats, 18/24 rack toms and 15/24 floor toms, with all snares/crashes/kicks correct and zero extra colors. The older difficult fixtures still miss some toms and simultaneous crashes, and the two older dense-hat fixtures retain two ambiguous snare-noise extras. No full-song accuracy score is claimed for the user's recording because only 28 landmarks are annotated.

A timing-refinement experiment was rejected after it added false floor-tom notes. The release retains the prior timing refinement, verifies additional low-onset candidates with independent evidence, and checks duplicate proximity after refining their times. The thresholds and short windows remain heuristic and need broader acoustic-kit evaluation.

### Release gates and player flow

`tests/drum-colors.test.cjs` checks all five hand colors plus kick at multiple hat levels. It explicitly rejects other colors at hi-hat positions and checks red alone throughout snare rolls. The older fill/hat tests now enforce their improved recall; all prior snare-roll, real recording, worker, guitar, playback, mobile, offline and setlist checks remain release gates. Browser interaction/storage tests use deterministic adapters; no live browser test is claimed.

Apply the update and confirm **Game version 25**. Open the saved song, choose **Drums**, use **Rebuild this instrument’s chart**, then preview the fill. Rebuilding saves the new drum chart automatically and preserves the original audio and any guitar chart. Existing saved charts are not silently replaced.

Final version 25 verification: **92 passed, 0 failed, 0 skipped** in 42.2 seconds. The original recording's 28 annotated landmarks retain median timing error 0.7 ms and maximum 15.7 ms. All 48,097,596 original WAV bytes survive save/reopen/export with Blob writes rejected by the storage adapter. This validates the stated regressions and persistence behavior, not exhaustive real-song transcription.


## Version 26 — yellow hi-hats and accessible kicks

### Request and conventions

The player reports inconsistent yellow notes and asks for more accessible kicks and charts closer to Clone Hero. Yellow remains closed/open hi-hat; red snare, blue rack tom, orange crash/ride and green floor tom retain their identities. Purple bars remain independent kick notes.

The [Clone Hero drum mapping guide](https://wiki.clonehero.net/books/guitars-drums-controllers/page/drum-mapping-guide) maps closed/open hi-hats to Yellow Cymbal and assigns a separate kick input. Its four-lane Pro layout and conversions differ from this player's requested five-color highway. This release follows consistent sound identities, independent pedals and measured timing within the existing layout. It does not add Clone Hero file compatibility or claim that automatic audio analysis equals a hand-authored chart.

### Requirements and implementation

| ID | Requirement | Implementation / acceptance |
| --- | --- | --- |
| H1 | An open hi-hat must not turn orange merely because it rings longer. | Compare fresh treble energy with its later decay after subtracting the preceding tail. Use the later window only when no other detected strike enters it. The new two-seed audio fixture must keep all 48 closed/open hats yellow in Standard and Expert. Existing crash/ride checks remain gates. |
| H2 | A bright hi-hat must not gain an extra red snare. | A learned red component with overwhelmingly bright noise and no supporting snare body/midrange is reviewed as a noise voice. Existing red-only rolls and independent kits must keep their identities. |
| H3 | Recover quiet repeated kicks from actual audio evidence. | Review short low-frequency onset candidates following an accepted kick. Require bass pitch below 68 Hz, a fresh body-energy rise and a changed pitched vibration; reject nearby duplicate/body hits. All 32 labeled kicks per new fixture, including 90 ms repeats, must survive without extra pedals. No rhythm-grid kick generation. |
| H4 | Make pedals easier to play. | Space and Enter both play drums' purple kick bars. Input ownership allows alternating keys or fingers without one release canceling the other. Shift activates drum Overdrive; guitar keeps its existing Space behavior. Mobile pedal grows from 80% to 94% width and from 52 to 64 px in portrait; compact landscape retains a 48 px height. Desktop pedal minimum height grows to 44 px. |
| H5 | Judge dense strikes consistently. | All drum pads and kicks target the closest eligible strike within the existing hit window. A late tap cannot be diverted to an earlier, farther same-color note. Preserve green/orange chord assistance and guitar hold behavior. |
| H6 | Keep labels and the demo consistent. | All hi-hat labels say hi-hat; the original demo's rides now use orange. Its Warmup omits unavailable ride-pad hits. Drum analysis version 8, game version 26, offline cache v26-1. |
| H7 | Preserve saved songs and honest review. | Existing stored charts stay as saved until explicitly rebuilt. Rebuild saves the new chart with the original audio and any other instrument chart. Setlist, waveform, timing, preview, mobile and storage gates remain required. |

### New audio measurements

`tests/fixtures/hat-kicks.cjs` mixes labeled closed/open hats, snare-only pairs, rack/floor toms followed by quieter hats, kick bursts and real kick/hat chords. It includes rests and uses two independent noise seeds. One-to-one matches use a 30 ms tolerance; wrong colors count as both a miss and an extra.

| Fixture | Version 25 hats | Version 26 hats | Version 25 kicks | Version 26 kicks | Wrong extra colors, v25 → v26 |
| --- | --- | --- | --- | --- | --- |
| A (seed 83) | 45/48 | 48/48 | 24/32 | 32/32 | 5 → 0 |
| B (seed 927) | 47/48 | 48/48 | 24/32 | 32/32 | 4 → 0 |

Both new fixtures now match all 112 labeled strikes, with zero extras, in Standard and Expert. Earlier difficult-fill and quiet-hat metrics remain measured independently; the new fixture is not a full-song accuracy claim.

### Limits and rejected approaches

The existing dense hi-hat fixture still retains two ambiguous snare-noise yellow extras. Quiet overlapping voices and very long open hi-hats versus cymbals can remain ambiguous. The user's recording has 28 annotated landmarks, not a complete independently labeled chart.

A broader kick recovery based on vibration change alone created false pedals from decaying kick sweeps and was rejected. The retained method additionally requires fresh body energy. A short-envelope cymbal threshold lost known crash overlaps; the retained later-tail check restores those gates while separating the new open hats.

### Player flow and verification

Confirm **Game version 26**, open the song in the setlist, select **Drums**, and choose **Rebuild this instrument’s chart**. Preview Standard or Expert around the affected hi-hat/kick section. The rebuilt chart saves automatically. Play kicks with **Space / Enter** or the wider touch pedal; drum Overdrive uses **Shift**.

Final version 26 verification: **98 passed, 0 failed, 0 skipped** in 43.3 seconds. The original recording's 28 annotated hits retain 0.7 ms median and 15.7 ms maximum timing error. All 48,097,596 original WAV bytes survive save/reopen/export with Blob and oversized writes rejected. Existing difficult-fill, quiet-hat and red-only roll metrics are preserved. UI interaction checks use deterministic DOM/audio adapters; no live browser capture is claimed.

## Version 27 — cymbal overlaps and buried hi-hats

### Problem and requirements

The player reports missing cymbals and incomplete hi-hat patterns. Some real cymbal attacks were absent from the learned events when another drum sounded simultaneously. Quiet hats beneath an earlier cymbal sometimes never reached the normal onset candidates. The chart must recover evidence in the audio without interpreting fluctuations in a cymbal's ringing as additional yellow notes.

| ID | Requirement | Implementation / acceptance |
| --- | --- | --- |
| C1 | Retain orange crash/ride attacks alongside other drums. | Review measured treble onsets even when the learned result contains only a kick or snare. Require a fresh attack and sustained noise decay. Account for a simultaneous snare's contribution to initial energy; reject tail evidence contaminated by a following strike. All 16 orange strikes per new overlap fixture and all four per older fill fixture must match. |
| C2 | Recover quiet yellow hi-hats beneath cymbal ringing. | Measure short rises and returns against the surrounding treble noise floor using 2 ms power frames. Select the strongest pulse before checking its shape. Require a settling background, established hi-hats elsewhere, and a recent accepted cymbal. The existing quieter-hat fixture must improve from 24/30 to 30/30, with zero extras on every color. |
| C3 | Keep cymbal wash, snare rolls and tom resonance out of yellow. | Require a distinct brief burst; reject fluctuations in the prior noise floor, contaminated decay windows and fresh tom resonance. Cymbal-only fixtures and fixtures with real isolated hats elsewhere must generate no unsupported notes. All previous red-only roll, open-hat and tom-color regressions remain gates. |
| C4 | Preserve simultaneous genuine voices and measured timing. | A recovered cymbal may retain a distinct fast hat component when supported by the measured envelope. Do not add notes on a beat grid or alternate colors to create fills. Match labeled strikes one-to-one within 30 ms and count wrong colors as misses and extras. Standard and Expert retain every accepted strike. |
| C5 | Ship without replacing existing saved charts. | Drum analysis version 9, game version 27 and offline cache v27-1. Explicit rebuild updates the selected drum chart and saves it with its original audio and any guitar chart. Keep storage, preview, timing, mobile controls and kick access unchanged. |

### Evaluation and limits

The new labeled audio fixtures combine crash/body chords, quiet hats in cymbal wash, genuine hat/body chords, snare-only pairs and rests. Separate negative fixtures contain modulated cymbal ringing with and without real hats elsewhere. Their labels come from the generated audio events, independently of detector output.

| Fixture / color | Version 26 matches | Version 27 matches | Version 27 extras |
| --- | --- | --- | --- |
| New overlap A / yellow | 24/48 | 38/48 | 0 |
| New overlap B / yellow | 24/48 | 38/48 | 0 |
| New overlap C / yellow | 24/48 | 39/48 | 0 |
| New overlap A, B and C / orange, each | 12/16 | 16/16 | 0 |
| Existing quieter hats / yellow | 24/30 | 30/30 | 0 |
| Existing mixed colors A / yellow | 29/30 | 30/30 | 0 |
| Older difficult fill A / orange | 2/4 | 4/4 | 0 |
| Older difficult fill B / orange | 1/4 | 4/4 | 0 |
| Older difficult fill A / yellow | 86/91 | 87/91 | 1 |
| Older difficult fill B / yellow | 85/91 | 87/91 | 1 |

All new overlap fixtures retain every labeled snare and kick with zero extra colors. Both cymbal-only seeds match their eight orange strikes without false hats. Both wash-plus-isolated-hat seeds match all eight orange and eight yellow strikes without extras. Existing red-only rolls, open hi-hats and quiet kick repeats remain acceptance gates.

The conservative recovery pass intentionally does not infer a buried hat at an existing snare onset. Extremely quiet voices and ambiguous snare noise remain limitations. The user's drum recording has 28 annotated landmarks; these support timing and selected color checks, not a complete transcription accuracy score.

The older dense-hat fixtures still retain two ambiguous snare-noise yellow extras. The very quiet color fixture remains at 20/30 hats, 18/24 rack toms and 15/24 floor toms, with all other voices correct and no extra colors. The difficult fills retain previously measured tom/kick misses. The new overlap fixtures still miss nine or ten of their 48 hats, particularly concurrent snare/hat strikes; this release does not promise every hit in mixed audio.

A permissive recovery experiment added 40 and 38 false hats to cymbal-only recordings and was rejected. Shape filtering before peak selection also accepted the trailing edges of rejected cymbal swells. The retained version selects peaks first and requires a settling background plus clear hats elsewhere. These restrictions trade some weak-hit recall for avoiding invented notes.

### Player flow

Confirm **Game version 27**, open the song from the setlist, select **Drums**, choose **Rebuild this instrument’s chart**, then preview the affected section in Standard or Expert. Existing charts are not silently replaced. Rebuilding saves the updated chart automatically with the original audio.

Final version 27 verification: **105 passed, 0 failed, 0 skipped** in 43.5 seconds, including seven new cymbal/hat regressions and the complete 272.7-second uploaded recording analysis. Its 28 annotated landmarks retain 0.7 ms median and 15.7 ms maximum timing error. All 48,097,596 original WAV bytes survive reconnect, save/reopen and backup while Blob and oversized writes are rejected by the storage adapter. Playback, mobile input, guitar, offline and setlist regressions pass. UI and storage checks use deterministic adapters; this is not a live browser or physical-phone test. Original user audio is excluded from the publication archive.

## Version 28 — independent timing for each color

### Request and observed defect

The player asks for all colors to hit at different times according to the uploaded song, followed by testing and fixes. Interpret this as independent measured instrument timing: a genuine simultaneous kick/snare/cymbal combination remains simultaneous. Never introduce arbitrary color offsets, force a cycling pattern, or move strikes onto a uniform beat grid.

A new staggered-audio test reproduced hi-hats 25 ms after kicks and rack toms being attached to the earlier body attack. The earlier attack's spectral window included the later noise, and recovery could also create a false orange note at that early time. Merely checking for a fresh high-frequency rise was insufficient: a pitched body's onset can create a small high-frequency transient too.

### Requirements and implementation

| ID | Requirement | Implementation / acceptance |
| --- | --- | --- |
| I1 | Give each accepted noise voice its own measured attack. | Review yellow/orange events and their recovery candidates using two high-pass stages and 2 ms energy windows. A later treble onset can replace the shared body time only when at least 12 ms later, independently fresh, and at least four times stronger than the early residual noise. Accept no arbitrary timing offset. |
| I2 | Recheck color at the corrected attack. | A recovered short noise burst with fast decay stays yellow; sustained cymbal evidence remains orange. Review both accepted events and candidate times so later recovery cannot recreate an early false cymbal. The 25 ms kick/hat and rack-tom/hat pairs must retain two different strike times and no nearby orange duplicate. |
| I3 | Test every color against audio with unequal intervals. | Two different drum sequences and two different guitar sequences include unequal gaps, changes of pace, rests and shifted starting times. Every labeled strike in these four fixtures must match its correct color within 8 ms, without extras. All six drum lanes and all five guitar lanes must be represented. |
| I4 | Preserve genuine chords, rolls and difficulty behavior. | Existing simultaneous kick/hand, red-only snare roll, cymbal overlap, open-hat and tom fixtures remain gates. Standard and Expert drums retain accepted strikes; Warmup may simplify density without moving or recoloring a retained strike. Guitar retains its measured pitch mapping. |
| I5 | Test actual playback and persistence after charting. | Play all new irregular charts through the scoring engine. Run the complete upload/preview/seek/play/replay, mobile, offline and setlist regression suite, including original WAV byte preservation. Publish only after addressing new failures. |
| I6 | Apply the update through explicit rebuilding. | Drum analysis version 10, game version 28, offline cache v28-1. Existing charts remain saved until the player rebuilds the selected instrument. Rebuilding automatically saves the new chart and preserves original audio and the other instrument. |

### Measurements and remaining limits

All four irregular-upload fixtures match all 144 labeled strikes, with no extra colors. Their independently generated labels verify actual audio timing and pitch/color identity. These tests also play through the scoring engine; they do not merely feed already-correct events into the chart builder.

The closer 42-strike stress fixture deliberately combines hits 25 or 40 ms apart, including noise/body pairs and two different toms. One-to-one matches use 15 ms tolerance to expose the early-chord defect that a 30 ms tolerance would hide.

| Stress fixture / lane | Version 27 matched / expected, extras | Version 28 matched / expected, extras |
| --- | --- | --- |
| 25 ms / yellow | 6/11, 2 | 8/11, 0 |
| 25 ms / orange | 4/5, 3 | 4/5, 1 |
| 40 ms / orange | 3/5, 3 | 3/5, 1 |

All other measured lane counts in these stress fixtures are preserved. In the 25 ms fixture, red matches 7/7, blue 5/7, green 3/7 and kick 5/5; one extra kick remains. In the 40 ms fixture, red matches 7/7 with two extras, yellow 6/11 without extras, blue 5/7 with one extra, green 5/7 with one extra and kick 5/5 with two extras. Closely overlapping tom bodies and ambiguous snare/hat noise therefore remain unresolved transcription limits. This release fixes the reproduced shared-time bug without claiming a perfect transcription of every sound. The prior dense-hat and very-quiet-voice limits still apply; the original recording has 28 annotated landmarks rather than full-song ground truth.

### Player flow

Confirm **Game version 28**, open the saved song, choose **Drums**, then **Rebuild this instrument’s chart**. Preview the affected fill in Standard or Expert. The rebuilt chart saves automatically. A real simultaneous strike still appears as a chord; separate strikes retain their detected timing.

Final version 28 verification: **111 passed, 0 failed, 0 skipped** in 44.3 seconds. The new irregular drum fixtures have maximum timing errors of 1.9 and 2.2 ms; the guitar fixtures each remain within 3.2 ms. All 144 strikes score successfully. The complete uploaded recording is analyzed and its 28 annotated landmarks retain 0.7 ms median and 15.7 ms maximum timing error. All 48,097,596 original WAV bytes survive reconnect/save/reopen/export with Blob and oversized writes rejected by the storage adapter. Existing simultaneous hits, snare rolls, mixed fills, yellow/orange checks, guitar, mobile controls, offline and setlist tests pass. UI and persistence checks use deterministic adapters; no live browser or physical-device test is claimed. User audio and test fixtures are excluded from the publication archive.

## Version 29 — a matched In Bloom drum event chart

The player asks to chart In Bloom like the demo. The demo's own sound and highway share a known drum-event list. Apply that consistent event representation and color mapping to a chart derived from the supplied recording. Preserve its actual timing and original playback audio.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| B1 | Build a stable event chart for the supplied In Bloom recording. | Use measured audio attacks and recording-specific drum examples; review selected opening/later fills, hats, cymbals and snare rolls. No copying the demo's tempo or note sequence onto this song. |
| B2 | Load only for the matching audio. | Forward the upload's SHA-256 to the analysis worker on upload and rebuild. Match exact bytes plus decoded duration. Another file with the same name must use ordinary analysis. |
| B3 | Keep physical hit identities consistent. | Reviewed snare-only roll positions contain red alone; descending tom fills separate blue and green. Retain independently supported crash/kick chords. Standard and Expert use the same 1,275 accepted strikes; Warmup retains a subset without recoloring. |
| B4 | Show which chart is in use. | Display **MATCHED CHART** and **In Bloom · Matched drum chart** when this instrument uses the reference. Preserve source metadata through save/reopen/backup and when analyzing the other instrument. |
| B5 | Preserve device-local songs and offline use. | Include the small reference event file in the offline package; original WAV remains device-local. Explicit rebuild saves the replacement drum chart with original audio and other instrument charts intact. No site-data clearing, database reset or Blob-write regression. |
| B6 | Test before publishing and retain review limits. | Require all existing tests plus exact-audio matching, selected passage color checks, all-note scoring and the real WAV's upload → preview → save → reopen → rebuild flow. Game version 29, drum analysis version 11, guitar analysis version 3, offline cache v29-1. |

`docs/inbloom-chart-review.md` records the source examples, retained chart counts, reproducible authoring inputs, selected-passage improvements, rejected approach and remaining limits. This explicitly requested recording-specific chart is an exception to earlier general-upload requirements against applying canned song patterns: it is selected only by matching the supplied audio, and other uploads retain general analysis. It is an estimated, partially reviewed transcription rather than an official or fully hand-verified chart.

Player flow: confirm **Game version 29**, open In Bloom in the setlist, choose **Drums → Rebuild this instrument’s chart**, and check for **In Bloom · Matched drum chart** above the preview. Preview the opening fill around 0:04 and the later roll around 4:03. Uploading the exact original WAV in Drums mode also selects the matched chart. The chart saves automatically.

Final version 29 verification: **118 passed, 0 failed, 0 skipped** in 45.1 seconds. All 1,275 matched Standard/Expert strikes and all 522 Warmup strikes score successfully. The exact original WAV selects the chart even when renamed; preview seeking to 239 seconds, save, fresh storage instance, backup, reopening without analysis and explicit rebuilding all pass while preserving the original 48,097,596 audio bytes. The prior generic analysis suite remains intact, including the full recording and its 28 inspected landmarks. Rebuilding the reference from the pinned PCM/onsets produces a byte-identical runtime file. Validation uses deterministic audio/DOM/storage adapters and spectral review, not a live browser, physical-phone playthrough or exhaustive human annotation. Only public game assets and the event table are packaged; source audio, analysis files, tools and tests are excluded.

## Version 30 — full-song uploads and four independent instrument charts

The player wants Drums, Bass, Guitar and Vocals from full recordings as well as isolated tracks, with a choice of charting scope.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| M1 | Offer One instrument, Whole song and Separate parts. | One instrument analyzes the selected part; Whole song attempts all four; Separate parts analyzes only checked parts. Each produces separate playable charts over the original audio, not a combined highway or exported audio stems. |
| M2 | Analyze Bass and Vocals independently. | Bass tracks low fundamentals and repeated attacks. Vocals track stable pitched phrases, legato changes and duration; sustained vibrato must not create alternating extra notes. Both retain a consistent relative pitch-to-color mapping. No transcription claim for arbitrary source separation from a mix. |
| M3 | Preserve existing quality improvements. | Guitar and Drums keep their established analysis. Exact In Bloom audio keeps its matched drum chart. New parts must not overwrite another part or alter original audio. |
| M4 | Provide coherent playback. | Bass supports tap and strum; Vocals uses pitch-mapped pads with sustain scoring. Vocal mode clearly explains pad play, with no microphone scoring or lyrics. The instrumental demo has a Bass chart matching its synthesis and no fabricated Vocals chart. |
| M5 | Complete multi-part jobs safely. | Analyze sequentially with progress and cancellation. Keep successful parts if another has no clear notes; identify unavailable parts. Commit no partial replacement on cancellation. Offer building selected parts on an already open song. |
| M6 | Keep four-part songs in the setlist. | Save, reopen and .riffpack round-trip all four charts and pitches/durations. Existing audio chunk storage remains unchanged. Cache repeated selections; explicit rebuilding replaces only requested parts. |
| M7 | Verify and publish. | Test independently generated low-pitch and vocal audio, rests/noise/vibrato/held notes, all-note playback, four-part upload routing, selected subsets, partial failure, cancellation, persistence and existing regressions. Four-option controls fit narrow layouts. Game version 30, offline cache v30-1. |

Full mixes are accepted, but these local signal detectors estimate instrument identity; guitar and vocals can overlap in frequency and not all parts are guaranteed to be audible or correctly separated. Supported automatic targets are these four instrument families. Vocal charts are a playable melody approximation, not an official transcription or a vocal recognition system. Existing browser limits remain 5 seconds–8 minutes and 80 MB.

Version 30 verification: **135 passed, 0 failed, 0 skipped** in 53.4 seconds. Four independently synthesized eight-note Bass/Vocals fixtures retain all expected pitches, repeated notes and all five color lanes without extra notes in rests. Bass timing is within 45 ms, Vocals within 20 ms, and vocal durations within 35 ms in these fixtures. Vibrato does not create additional notes; legato vocal pitch changes and repeated low bass attacks retain measured holds. Silence and broadband noise are rejected. These controlled harmonic fixtures do not establish transcription accuracy for human singing or arbitrary commercial recordings.

A mixed full-band fixture runs all four real analyzers through upload, save, instrument switching and preview. Separate tests verify all-four backup round trips, selected-part building, per-part failure reporting, cancellation both before and after one part completes, cache reuse, preserving existing charts on reupload, and vocal touch sustain scoring after Bass strum mode. All prior In Bloom, generic drum/guitar timing, original WAV byte preservation, storage recovery and offline tests pass. The UI checks use deterministic DOM/audio/storage adapters; a live browser or physical-phone playthrough is not claimed. Source audio and test fixtures remain outside the publication archive.

Player flow: choose **One instrument**, **Whole song — all four charts**, or **Separate parts — choose several** in Auto Chart, then upload a supported full song or isolated track. For an already open song, Whole song and Separate parts offer a build button above the preview. Choose Guitar, Drums, Bass or Vocals beside the highway to preview and play one chart. Whole song creates four separate part charts over the original recording, not one combined multi-instrument highway. If analysis cannot find a clear part, the other successful charts remain playable and the unavailable part is named.

## Version 31 — Easy, Medium, Hard and Expert

The player requests Guitar Hero-style difficulty selection for uploaded songs. This supersedes the earlier Warmup/Standard/Expert naming and the earlier requirement that Standard retain all drum hits. Expert still preserves the complete accepted transcription.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| D1 | Generate four playable arrangements for every selected instrument on upload. | Easy, Medium, Hard and Expert are available for single-part, selected-part and whole-song uploads. Switching difficulty uses the cached chart and does not analyze audio again. |
| D2 | Offer a meaningful progression. | Guitar/Bass use three frets on Easy, four on Medium and five on Hard/Expert. Easier levels reduce note density and chord size. Drum colors retain physical instrument identity on every level, with progressively fewer hand hits and kicks on lower levels. Vocal melody uses fewer segments on easier levels and retains pitch/hold identity. |
| D3 | Preserve timing and Expert transcription. | Derive reductions from the measured Expert notes. Retained strikes keep their timestamps; no invented fills, notes or quantization. Original pitches remain stored even when Guitar/Bass colors are compressed to fewer frets. Expert retains all original accepted notes, including In Bloom's 1,275 hits. Sparse passages may have the same notes on adjacent difficulties. |
| D4 | Apply the selection everywhere. | Preview, highway speed, hit window, practice, score, results and replay all use the selected difficulty. Controls explain available frets and note count; four buttons fit on mobile. Scores are stored separately by instrument, difficulty and control mode. |
| D5 | Keep existing saved songs and backups usable. | Opening or importing a legacy three-level chart derives the new arrangements locally from its Expert chart. Preserve original audio, Expert notes and the hidden legacy Standard chart; never require reupload or clear storage. Re-export/save persists the new arrangements. Validate new-level notes as strictly as legacy notes. |
| D6 | Follow the existing test/publish workflow. | Verify difficulty progression, drum colors/kick simplification, Guitar/Bass fret limits, vocal holds, all-level scoring, original recording, upload/preview switching, setlist/backup migration and malformed new-level rejection. Ship Game version 31 and offline cache v31-1, including the shared difficulty module. |

These are game-specific arrangements inspired by the requested four difficulty levels; they do not reproduce a proprietary charting system or make the automatic transcription exact.

Difficulty rules: hit windows are ±190 / 160 / 140 / 125 ms for Easy / Medium / Hard / Expert. Highway approach times are 3.1 / 2.7 / 2.4 / 2.15 seconds before the player's speed adjustment. Reductions are nested selections of the measured events; Guitar/Bass map those selected pitches onto 3 / 4 / 5 / 5 frets. Drum and vocal lane identities remain fixed. True chords are reduced in hand count, and duplicate fret positions created by mapping are merged. Existing Expert personal best keys remain valid; the newly arranged lower levels use separate best-score keys.

The supplied In Bloom recording produces 522 / 916 / 1,234 / 1,275 notes, including 195 / 315 / 513 / 546 kicks, on Easy / Medium / Hard / Expert. Every retained drum note matches an Expert strike's time and physical instrument. The automatic audio transcription itself is unchanged by this release.

Player flow: upload a song in any charting scope, select the instrument, choose **Easy, Medium, Hard or Expert**, then use **Preview chart** or **Play track**. All four arrangements are built together. Existing setlist songs gain the new choices when opened without another upload; Save current song or exporting a backup persists the updated arrangements. Vocal mode continues to use pitch pads and held notes, without microphone scoring.

Final verification: **147 passed, 0 failed, 0 skipped** in 52.0 seconds. New tests cover all four instruments and difficulty levels, strict density progression in dense passages, original onset/pitch preservation, correct drum colors, simpler kick patterns, collapsed fret chords, vocal holds, exact Expert retention, malformed Medium/Hard rejection, all-level scoring, previews, replay and separate personal best keys. A whole-song upload exposes all 16 instrument/difficulty choices without another decode or analysis. Legacy setlist entries and backups gain the four arrangements without losing original audio or Expert notes. The full original In Bloom WAV upload/save/reopen/rebuild and the prior audio/storage/offline regressions pass. Two older expectations were updated to reflect the requested behavior: drum pads keep their physical colors at every level, and Guitar/Bass colors compress onto fewer frets on Easy/Medium. Automated UI checks use deterministic DOM/audio/storage adapters, not a live browser or physical-device playthrough. Only game assets are packaged for publication.
