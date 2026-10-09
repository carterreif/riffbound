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


## Version 32 — Expert as the complete detected audio chart

The player requests all detected audio notes on Expert, then progressively fewer notes on Hard, Medium and Easy. This strengthens D3: chart construction may not remove accepted distinct attacks using a minimum spacing or loudness threshold before building Expert.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| E1 | Build Expert directly from accepted audio events. | Preserve every distinct accepted timestamp and voice, including quiet fast repeats, flams, kicks and concurrent colors. Remove the final 12 ms proximity filter. Only exact voice/time duplicates or multiple detections explicitly anchored to the same measured voice/attack may merge. Existing audio evidence checks still reject noise and unsupported hits. |
| E2 | Derive lower levels from the complete Expert chart. | Hard selects from Expert, Medium from Hard, Easy from Medium; counts never increase going down. Preserve selected timestamps and drum colors. Guitar/Bass retain their 3/4/5/5 fret mapping; Vocal pitches and measured holds remain. Sparse passages may be identical across adjacent levels. |
| E3 | Make the progression visible. | Preview shows Expert → Hard → Medium → Easy note totals for the selected instrument. The selected difficulty drives actual preview, scoring and playback. Expert means all distinct detected notes, not guaranteed perfect transcription of arbitrary mixed audio. |
| E4 | Preserve the setlist and source audio. | Upload builds all difficulties together and saves normally. Existing charts remain available without forced analysis; Rebuild this instrument’s chart reanalyzes its original audio and saves all four new arrangements while preserving other parts. Save/reopen/backup must retain the complete Expert chart. |
| E5 | Verify and ship. | Regression tests cover sub-12 ms distinct events, same-attack duplicate rejection, quiet hits, all drum colors, tonal events, nested subsets, difficulty totals, rebuild and persistence. Keep the matched In Bloom table and prior false-hit tests. Ship Game version 32, offline cache v32-1, and synchronize source to carterreif/riffbound. |

The source audio is unchanged and shared by all difficulties. This update changes chart arrangement, not source separation or detector sensitivity. It cannot recover notes omitted from old saved Expert charts without rebuilding from audio. The existing Rebuild button provides that update without another upload. Audio remains local to the browser, using the established chunked storage and portable backups.


Implementation review: removing proximity-based suppression revealed that body and treble detectors sometimes produced two candidates for one hi-hat or cymbal. The final implementation retains shared measured-attack provenance, aliases a single unambiguous hi-hat onset, and carries a recovered cymbal's matching spectral-frame identity through later color correction. This rejects duplicate detections without applying a chart-density cutoff or merging two explicitly distinct hi-hat anchors. Existing synthetic drum-color, fill and hi-hat/kick tests remain unchanged and must pass.


Version 32 verification: **150 passed, 0 failed, 4 skipped** in 76.4 seconds with `node --test tests/*.test.cjs`. The four optional original-recording tests were skipped because the reference WAV and PCM were not present in the recovered workspace. The checked-in In Bloom event table still retains all 1,275 Expert strikes and nested lower levels. New regressions verify distinct events closer than 12 ms across all four instruments, quiet attacks, simultaneous colors/pitches, same-attack duplicate rejection, correct lower-level subsets, all 16 instrument/difficulty preview totals, and rebuilding a saved song followed by fresh reopen and backup round-trip without audio loss. Existing synthetic drum-color, cymbal/hi-hat, tom-fill, kick, scoring, storage and offline tests pass. JavaScript syntax, local entry-point asset references and patch whitespace also pass. UI verification uses deterministic DOM/audio/storage adapters; a live browser or physical-device playthrough is not claimed.

Player flow: refresh to **Game version 32**. Upload a song, or open an existing setlist entry and choose **Rebuild this instrument’s chart**. Expert uses the complete accepted audio chart; Hard, Medium and Easy are reduced from it. Compare the four note totals above the preview, choose a difficulty, and preview or play. The rebuilt chart saves using the existing setlist flow; any storage failure remains visible and actionable.


## Version 33 — supplied In Bloom score and WAV, Expert/Hard only

The player supplied page 1 of a drum score and reattached the exact original WAV, asking to copy the notation more closely without changing Easy or Medium. Most existing notes should remain intact.

| ID | Requirement | Acceptance |
| --- | --- | --- |
| S1 | Match this recording, not unrelated uploads. | Require the existing full-file SHA-256 and duration. No filename routing; other songs and other instrument analyzers remain unchanged. |
| S2 | Use the supplied score as a guide and audio as the timing source. | Keep the existing snare, tom, floor-tom, cymbal and kick events. Review the clearly readable repeating hi-hat voice on score page 1, bars 5–14, against the WAV. New quiet yellow hits need a measured treble attack; overlapping yellow notes use the score's hat voice at existing audio-measured snare/kick times. Omit ambiguous cymbal-wash positions. Do not extrapolate the page over unshown sections or add yellow to the known snare/tom fills. |
| S3 | Update only Expert and Hard. | Expert incorporates the accepted review additions. Hard derives as a reduced subset of that Expert. New uploads use the previous matched Easy/Medium; existing-song rebuilds, same-file reuploads and selected/whole-part rebuilds preserve the player's current Easy/Medium arrays exactly. Keep the hidden legacy Normal chart. |
| S4 | Keep persistence and playback correct. | Preview, note totals, scoring, save/reopen and backup round-trip use the correct arrangement. Retain original WAV bytes and other instrument charts. Show a brief note identifying the Expert/Hard score review. |
| S5 | Verify and publish. | Test all four difficulty arrays, only-intended-event changes, score/audio onset landmarks, original-WAV matching, all-note scoring and storage/rebuild flows. Run the full existing suite with the restored exact reference WAV/PCM. Update PRD/review documentation, publish the game and sync GitHub. |

The low-resolution image is one page, not a complete transcription of the recording. Score-supported simultaneous hi-hats are an interpretation of the supplied notation; their voice cannot always be isolated from a simultaneous snare or kick in the WAV. The review is limited to the covered passage and makes no full-song accuracy claim. The original score image and WAV are not included in public game assets.


Version 33 result: the bounded review adds 76 yellow notes (27 independently measured quiet attacks; 49 score-supported overlaps). Expert has 1,351 notes and Hard has 1,310. New-upload Easy/Medium remain 522/916; their complete arrays and hidden Normal match version 32 SHA-256 snapshots. Existing-player lower charts are preserved instead of replaced by those defaults. Only revised In Bloom Expert/Hard use a new personal-best score key.

Verification: **162 passed, 0 failed, 0 skipped** in 116.2 seconds with the exact original WAV and pinned 22050 Hz mono PCM supplied to the full test suite. This includes all prior original-recording timing landmarks, actual WAV upload/save/reopen/rebuild, intact source bytes in backups, exact lower-level snapshot hashes, score-review onset landmarks with independent treble evidence, all-note scoring, and preservation through instrument, selected-part, whole-song and both in-memory/stored same-audio reuploads. Both reference authoring tools reproduce the runtime source byte-for-byte. JavaScript syntax and patch whitespace checks pass. Tests use deterministic DOM/audio/storage adapters, not a live browser or physical-device playthrough; the score's simultaneous-voice interpretation remains a stated limit.

Player flow: refresh the game, open the saved In Bloom recording, choose **Drums → Rebuild this instrument’s chart**, then select **Expert** or **Hard** and preview the passage around **0:16–0:47**. New uploads of the exact supplied WAV also select the revision. The preview explains that only Expert and Hard were revised. Original audio and lower charts remain in the setlist, and no score image or song audio is published.


## Version 34 — In Bloom close-up score corrections

### Request and scope

Use the user's clearer score crop to correct the matched original In Bloom drum recording on Expert and Hard. Retain Easy, Medium, hidden Normal, audio, other instruments and the setlist. Scope is this exact recording and the visible passage; do not change the generic upload detector or invent every printed articulation in indistinct audio.

### Requirements and implementation

- Resolve independently supported opening flams into separate notes of the same drum color on Expert. Eleven second attacks are measured from the WAV: six snare, four rack tom, one floor tom. Hard reduces these to the simpler leading strike.
- Carry clearly indicated open hi-hats as yellow over four opening snare backbeats and the first verse-ending fill snare. Later roll strokes stay red alone.
- Remove the two reviewed yellow kick-click artifacts, retaining the actual kicks and every other baseline event. Retain all 76 yellow additions from the preceding score review.
- Keep the original baseline table and each player's stored Easy/Medium/Normal arrays. The new upper charts contain 1,365 Expert and 1,313 Hard notes; lower counts remain 522 Easy and 916 Medium for a fresh matching upload.
- Persist the matched score revision so new Expert/Hard scores are separate from older upper charts. Retain previous score keys for charts not rebuilt, Easy/Medium and other parts.
- Save all changes through the existing chunked audio/setlist path, and update the offline asset version so players can load the correction after refreshing and rebuilding.

### Acceptance checks

Check every corrected onset and lane, same-color flam separation and Hard reduction, the open-hat/snare chord and red-only ending, removal of yellow with kick retained, original lower-array hashes, all-note scoring, exact-WAV matching, and saved lower charts across all five update routes. Use actual pinned PCM to verify renewed broadband and treble power at all eleven added flam strokes. Reproduce the reference file with both authoring tools. Run the existing upload/preview/backup/reopen and storage regression suite against the original WAV.

### Limits

This is a bounded score-and-audio review. Five ambiguous printed grace-note articulations remain single strokes, and solo hats masked by cymbal wash are not completed from a grid. Open-hi-hat overlaps are score-informed interpretations. No perfect full-song transcription, live browser playthrough or physical-phone playthrough is claimed. See `docs/inbloom-chart-review.md` revision 3 for exact decisions and measurement windows.


Final verification: **165 tests passed, none failed or skipped**, with the original WAV and pinned PCM (83.5 seconds). All corrected onsets/colors, close-stroke scoring, Hard reduction, original lower-array hashes, five saved-song update routes and persistence regressions pass. Both authoring tools reproduce the runtime reference byte-for-byte. JavaScript syntax, the entrypoint and local asset references also pass.


## Version 35 — chart the supplied video screenshots against the original WAV

### Goal and scope

Use the four user-uploaded notation screenshots to improve In Bloom Expert and Hard. The screenshots cover six unique measures (33–36, 43–44); the last two show the same measures. Preserve the earlier reviewed chart, Easy, Medium, hidden Normal, original audio, other instrument charts and saved setlist data. Do not change generic song charting or claim that the inaccessible video was reviewed in full.

### Requirements implemented

- Align the six unique measures with the original WAV using existing crash/kick starts, snare backbeats and kick pairs. Keep measured timing rather than cover timestamps or grid quantization.
- Add 15 separately measured quiet hi-hats and 21 score-informed hi-hat overlaps, all yellow, to Expert and Hard. Preserve all other events and earlier corrections.
- Keep the open hi-hat with the first fill snare at 117.293 seconds; the following snare at 117.539 remains red alone. Preserve the original cymbal at 111.237 and kick at 117.104 where the WAV differs from the cover.
- Leave six uncertain solo hats and one unsupported final thirty-second snare unfilled. Repeated screenshots must not create duplicate taps.
- Retain the player's lower charts and original audio through every update route. Fresh counts: 522 Easy, 916 Medium, 1,349 Hard, 1,401 Expert.
- Persist matched score revision 4 using the existing versioned personal-best behavior, and refresh offline assets for the published correction.

### Acceptance and verification

Verify the exact 36 additions are yellow and bounded to the six measures; remove them and compare a hash of the complete preceding reference to establish that no other event changed. Check first-difference PCM energy at all fifteen quiet onsets, snare/hi-hat chords, snare-only ending, kick pairs, recording-specific differences and absence of the unsupported fill note. Retain lower-array golden hashes, all-note scoring, exact-WAV match, all five saved-song update routes, preview, export/import backup and reopen checks. Both authoring tools must reproduce the runtime reference. Full results are recorded below after execution.

### Limitations and use

The screenshot overlap assignments are score-informed estimates, and the cover can differ from the WAV. This is not a complete annotation of every note in the song. Existing setlist charts change only after opening the song, selecting Drums and choosing **Rebuild this instrument's chart**, or reuploading the identical original WAV. No live-browser or physical-device playthrough is claimed. Detailed measure anchors and evidence are in `docs/inbloom-chart-review.md`, revision 4.


Final verification: **168 tests passed, none failed or skipped**, using the original uploaded WAV and pinned PCM (83.3 seconds). All 36 additions, the fifteen independent quiet-onset checks, the complete preceding-reference hash, lower-chart snapshots, all-note scoring, five update routes and setlist/backup/reopen regressions pass. Both authoring tools reproduce the runtime reference byte-for-byte. JavaScript syntax, the entrypoint and local asset references pass.


## Version 36 — Authored chart interchange

### Goal and scope

Allow a player to import an authored Guitar, Bass or Drums `.chart` arrangement with its matching audio, play/preview it and keep it in the existing device-local setlist. Export editable charts so individual mistakes can be corrected in an external editor such as Moonscraper. This implements the chart interchange recommendation; automatic drum model evaluation remains separate future work.

### Requirements and acceptance

- Add Chart files alongside existing game tools, matching the current dark interface and touch-friendly controls.
- Review a selected file before loading. Show instruments, difficulties, counts, drum-layout ambiguity and mapping limitations. No mutation during review.
- Support Song metadata, Resolution, Offset, tempo changes, time signatures, Single (Guitar), DoubleBass (Bass), and Drums sections on Easy/Medium/Hard/Expert. Ignore editor-only tempo anchors as specified by the format.
- Keep authored onsets, chords, fretted holds and independent drum hits. Never pass imports through audio detection or beat snapping.
- Map five-lane drums to red snare, yellow hi-hat, blue tom, orange cymbal, green floor tom and purple kick. Include Expert+ kicks. Pro cymbal markers distinguish cymbals from toms; refuse an ambiguous auto layout until the player chooses. Standard four-lane mapping is explicitly approximate.
- Reject collisions that map two simultaneous source notes to one pad, unsupported open frets/sustained drum rolls, malformed timing and oversized files. Reject mismatched chart length before replacing the current song.
- Use the open song audio or decode a selected audio file (5–480 seconds, at most 80 MB). Identify it by the existing SHA-256 audio ID. Do not request microphone or network access.
- Replace only explicitly supplied non-empty difficulties for matching audio; empty editor sections are treated as unavailable, never as an erase command; preserve other stored levels and instruments. Derive only missing levels for a new part. Label supplied/derived/retained levels in the preview.
- Preserve all authored fret positions, even when an authored Easy/Medium track uses more frets than generated arrangements. Keep generated chart fret limits unchanged.
- Save imported charts and original audio using existing chunked storage; survive a fresh reopen and `.riffpack` backup round trip. Keep actionable save failures and the playable open copy.
- Use content-specific personal-best keys for imported charts. Explicit audio rebuild replaces imported provenance only for rebuilt parts.
- Export `notes.chart`, `song.ini` with five-lane drum settings, and the original audio. Preserve all available Guitar/Bass/Drums levels and imported tempo/time signatures. Use at least 10,000 ticks per beat to retain off-grid measured timing (within 0.1 ms across supported tempos). Match the referenced and downloaded audio filename.
- Keep private uploads and reference inputs out of Site/GitHub assets. Include the interchange module in offline caching.

### Limits

- `.chart` only: MIDI, six-fret parts and vocal transcription interchange are not implemented. Existing vocal pitch-pad play and `.riffpack` backup remain available.
- HOPO/tap, authored power phrases, accents and ghost dynamics do not change the existing game mechanics. Drum rolls must contain discrete hits.
- Four-lane chart colors are not a complete physical-kit transcription. Pro mappings can collapse multiple tom/cymbal voices; collisions are rejected. Five-lane charts best match the game.
- The player must pair the exact recording and preview synchronization. File-length validation cannot verify a musical match.
- Chart exports contain playable arrangements, not a lossless archive of every unsupported event. Keep the original editor file and use `.riffpack` for a full Riffbound backup.
- AI transcription models were not added. Automatic chart quality and the reviewed In Bloom reference remain unchanged.

### Verification

Automated format and UI-flow coverage verifies variable tempo/offset/holds, all drum lanes and kicks, Pro cymbal markers, no beat snapping, all-level export/import, refusal of unsupported/invalid notes, supplied lower-level preservation, authored five-fret Easy play, new-audio and current-audio imports without analysis, chunked setlist persistence, fresh reopening, portable backups and real downloaded chart/audio bytes. Static JS, local asset and offline-cache checks are required before publication. Live Moonscraper application and physical-phone tests are not performed in this environment.

Verification results: the full suite passed 180/180 with the pinned original WAV/PCM (zero failures or skips). The additional save-completion/preview regression passed separately. All eight format tests were re-run after guarding empty editor sections and passed. HTML IDs, runtime asset references, offline inclusion and all JavaScript syntax checks passed.


## Version 37 — automatic mobile updates

### User outcome

A phone with a saved In Bloom recording receives game improvements and reviewed drum-chart corrections without a desktop rebuild/export/import cycle. Code updates and device-local song storage remain separate.

### Requirements

- Register the offline worker automatically on supported HTTPS browsers. Check on startup, online recovery, foreground return and every five visible minutes. Failed downloads leave the current game usable.
- Install a complete versioned public-asset cache before activation. No player audio is added to that cache, uploaded, deleted or made public.
- Activate and refresh only when the page is visible, between songs, without unsaved audio/charts, active charting, loading, backup import, save, calibration or open tool/results panels. Paused play also blocks updates. The explicit update button follows the same data/play safety checks.
- Do not automatically activate while another game tab is open. Do not reload a page during play even if another tab activates a worker. First installation of the same version must not cause a reload loop.
- Preserve the selected saved track, instrument, difficulty and mode across the refresh using a one-use session marker. Never autoplay. If that marker cannot be written, defer refreshing an open song.
- On opening an exact SHA/duration-matched In Bloom setlist record with an older score revision, update Expert and Hard to the same note arrays produced by current matched upload analysis. Save once after the correction; no signal reanalysis or resampling is needed.
- Preserve audio bytes, song identity, Easy, Medium, hidden Normal, other instruments and imported authored drum charts. Unknown recordings and newer revisions must not be migrated.
- If saving a correction fails, keep the open playable copy and the previous stored version; show the existing actionable save error and block automatic reload until saved.

### Limits and rollout

Version 36 and earlier need one final manual update or a close/reopen of all game tabs while online to receive this updater. Background installation while the app is closed is not promised. Browser storage is local and subject to browser/OS removal: this feature does not provide cross-device audio sync or replace backups. The automatic chart migration is deliberately restricted to the verified In Bloom recording; arbitrary saved charts are never silently reanalyzed.

### Verification

Deterministic service-worker, UI/audio and persistence adapters cover update deferral, same-version installation, reconnect/foreground retries, manual safety, multiple tabs, selected-track restoration without autoplay, save failure, revision idempotence and authored/lower-chart preservation. Matched migration is compared to the actual analyzer: Expert 1,401 notes and Hard 1,349. Full regression tests include the private original recording and reopened byte-preserving storage. This is automated verification, not a physical iPhone/Android browser test.

Validation result: the full 194-test suite passed with both original-recording fixtures enabled and no skips. A subsequent selected-track restore race fix passed all four targeted UI tests, including the added save-completion/playback regression (195 total test cases now present). Syntax, HTML asset references, unique IDs and whitespace checks passed.


## Version 38 — make update status discoverable

Problem: players following the phone update instructions cannot find the conditional Use updated game button and cannot tell whether their copy is current.

- Keep Check for updates visible in Install / offline, show the installed game version there, and change the action to Use updated game only when a downloaded update is ready.
- Explicit checks bypass the normal time throttle. Distinguish checking, an in-progress download, no new update found, offline, and failed download states. Do not claim that the game is current before installation finishes. Stale async status reads must not overwrite a newer update-ready state.
- Retain all version 37 playback, unsaved-song, other-tab and selected-song restoration protections. Keep a retry action after a failed download. No song or chart storage format changes.
- Explain the one-time older-version bootstrap using controls those versions actually have: Save game for offline play, then use the ready update action or close/reopen saved game sessions.

Validation: 20 targeted updater/offline/storage tests passed; the unchanged original-WAV storage fixture was not enabled in this targeted run (one skip). Three new UI regressions cover the persistent button/version, explicit recheck, download-to-ready transition, offline feedback and failed-download retry. JavaScript syntax, HTML local assets/IDs and whitespace checks passed. No physical phone testing was performed.


## Version 39 — repair mobile offline installation

Reported failure: the phone's version 38 panel says the update check failed, and both Save game for offline play and Check for updates appear ineffective.

Production evidence: a read-only HEAD request to the published `/index.html` returned HTTP 307 with `Location: /`. The service worker fetched `/index.html` and rejected every redirected response, so this ordinary hosting redirect prevented its cache from installing. Additional server logs contained no worker errors. GET probes from this environment returned HTTP 403 and did not verify device-specific access; no attempt was made to bypass that restriction.

Requirements and implementation:

- Fetch the canonical game homepage `/` and retain the existing `index.html` offline cache key. Continue to reject unexpected redirects, bad HTTP responses and HTML masquerading as script/style/image assets.
- Let a newly registered or installing worker finish instead of immediately issuing a redundant update request. Re-register after a failed first install leaves no worker. Bound registration/update checks so the controls become retryable if the browser stops responding.
- Save game for offline play must await worker activation, repair missing cache files when needed and verify every public asset before displaying success. Show saving/progress, explicit success or a useful failure; never equate a registration/update request with a completed offline download.
- Cache repair uses a version-checked worker request over a message port. Completion is sent only after all writes finish. Failed repairs must not clear player audio or setlist storage. The downloader and updater do not call IndexedDB deletion, unregister the app or clear the user's browser data.
- Include the browser's error detail in update/save failures. Preserve the existing game while updates fail and retain retry controls. Refuse repair against another game version and let the existing safe-update flow complete first.
- Preserve active play, pause, unsaved-song, save and multi-tab update protections. A controlling worker older than the current page must never trigger a reload loop. Defer refreshing while an offline save is in progress.

Verification uses deterministic page and worker adapters with the production redirect reproduced. Tests cover canonical-home caching and network-free navigation, failed first-install recovery, activation waiting, actual missing-file repair, progress/verified completion, write failures, mismatched versions, unresponsive workers/update checks, and existing reload safety. Physical iPhone/Android verification is not claimed.

Validation result: 29 targeted updater, worker and storage tests passed, zero failures; the unchanged optional original-WAV storage fixture was not enabled (one skip). HTML assets/IDs, JavaScript syntax and whitespace checks passed. No changes were made to saved-song persistence or chart data.


## Version 40 — add any supported song directly to the setlist

### Outcome and requirements

Players can add their own audio on mobile or desktop without finding the lower Auto chart section or replacing the demo files.

- Place an obvious **+ Add song** action in Your setlist and Manage songs, available with an existing song open.
- Provide a labeled audio picker and explicit Guitar, Drums, Bass, Vocals or Whole song choice. Generate Easy, Medium, Hard and Expert using the existing analysis pipeline. Do not mutate or rechart the previous song when changing the new upload's choice.
- Accept full recordings and isolated audio supported by browser decoding. Show the existing 5–480 second and 80 MiB limits. Reject empty, oversized, unsupported and invalid recordings with visible feedback. No streaming URL import or cross-device sync is implied.
- Show charting progress, cancellation, saving, confirmed persistence and actionable failure beside the setlist. Offer Retry save and Export backup after a failed write; retry must not rechart. Preserve the existing playable copy and saved songs when decoding, charting or storage fails.
- Save every accepted recording using the existing chunked IndexedDB audio/chart transaction. Clear a filtering query after adding a new entry. Reopen saved songs after a fresh startup without reanalysis. Identical audio shares one entry and retains other instruments.
- Disable adding while playing, paused, loading, charting, importing or saving. Block automatic game refresh and gameplay shortcuts while the Add song dialog is open. A canceled upload must ignore late decoding/worker results.
- Retain reviewed In Bloom data, authored imports, drum colors and offline update behavior. Bump the game and cache version so existing phones can receive the feature.

### Verification

Five new automated UI/storage scenarios cover two distinct recordings with fresh mobile reopening, all four instrument charts and difficulty arrays, duplicate identity, invalid files, previous-song preservation, cancellation with late decoding, update/keyboard safety, and failed-save recovery without reanalysis. Deterministic DOM/audio adapters and real chunked storage code are used; this is not physical-phone testing.

Validation result: 102 upload/UI, storage, connection and offline/updater tests passed, zero failures. Two unchanged optional reference-WAV tests were skipped in this targeted run. The upload suite also exercised the real analyzers on synthetic single-part and full-band audio. All runtime JavaScript syntax, HTML local asset references, unique IDs and whitespace checks passed.

## Version 41 — independently verify metal hits masked by bass

### Reference and problem

The user supplied a 31.866-second Guitar Hero Metallica gameplay excerpt as a drum-color guide. Inspecting its highway shows red snare repeats, yellow hats, orange cymbals and purple kick bars; simultaneous hand/pedal notes remain simultaneous. The broad automatic classifier was using a loud low pitched accompaniment as part of a snare's body, turning some hats/cymbals red. Some short bright hats also became orange when their tail passed a generic ringing threshold.

### Requirements and implementation

- Apply the correction to any newly analyzed drum recording. No filename, song hash, tempo template, copied chart or Roam-specific runtime rule may select the fix.
- Keep Red = snare, Yellow = closed/open hi-hat, Blue = rack tom, Orange = crash/ride, Green = floor tom and Purple = kick. Difficulty reduction preserves the master hit's timing/color; do not alternate colors merely to decorate a fill.
- Verify a fresh measured high-frequency onset independently of the loud low body. Require low-body dominance, limited snare-range body energy, measurable treble energy and an independently rising noise envelope before reconsidering a suspected metal strike.
- Distinguish a short bright transient from sustained cymbal energy using early/tail contrast and decay. A qualifying hat remains yellow even if a modest ringing tail passes the old cymbal threshold.
- Retain the accepted event time and provenance when correcting a color. Retain simultaneous kicks and independently supported toms. Never synthesize hits on a beat grid or treat a ring as a new strike.
- Leave imported charts and the existing matched In Bloom review intact. Existing arbitrary saved charts are not silently replaced; the player can use Rebuild this instrument’s chart. New drum analyses identify version 16; game/offline package becomes version 41.
- Keep the user's video, extracted audio, screenshots and analysis intermediates out of public assets and GitHub.

### Verification and limits

The independent synthetic fixture mixes labeled hats/cymbals with kicks and low pitched accompaniment. It exposed wrong red notes in the preceding version. Test two random-noise seeds and two hi-hat decay rates; measure missed hits and extras separately on every lane, and preserve all retained times/colors through Easy, Medium and Hard.

An optional private-recording regression checks seven visually reviewed yellow events near 6.233, 10.600, 17.967, 25.533, 27.333, 28.233 and 31.000 seconds, plus three orange events near 12.100, 20.900 and 21.833 seconds. Allow 60 ms for video frame timing. The old analyzer gave these masked events wrong or missing hand colors; the new one produces their requested colors without extra red hits in those windows. Also retain a red-only opening snare phrase and avoid inventing toms in this excerpt. Supply `RIFFBOUND_ROAM_PCM` as a local 22,050 Hz mono float32 extraction to run that regression; the audio is not committed.

These are selected corrections, not a fully reviewed ground truth for the entire video. Broader comparison still finds missed quiet hats and false cymbal candidates in this dense mix. Do not claim perfect charting, full note recall, or reproduction of Guitar Hero's proprietary authoring method. Exact authored arrangements remain available through chart import. Lowering the spectral-template learning threshold was experimentally rejected because it introduced incorrect tom colors; the shipped threshold and separation model are unchanged.

Validation: the full 217-test run, with both supplied recording fixtures enabled, initially passed 216 tests and exposed one cymbal-wash false positive. A stricter fresh-onset requirement after a recent crash fixed that regression. All 14 affected fill, cymbal-overlap and new bass-masking/recording tests then passed on the final code, with no skips. An existing yellow/orange pair is left intact when both voices already have independent evidence. Original In Bloom, drum-roll/color, onset timing, difficulty, upload, storage and offline/update checks passed in the full run. Runtime syntax, HTML asset/ID and whitespace checks passed. Physical-phone testing was not performed.

## Version 42 — ship the corrected Roam chart

Goal: make the current corrected Roam arrangement available through the live desktop/mobile game, with local save migration and offline support.

- Match only SHA-256 53dd7e8d5503db94988872300a29932c41e7174560d49d72fa6f7068af6b7e88 and duration 433.626031746 seconds (20 ms tolerance), never filename alone.
- Use the authored revision 3 chart with exact timestamps: 2051 Expert, 1687 Hard, 1117 Medium, 681 Easy. Preserve red/yellow/purple notes and the video-guided opening; remove the 193 likely duplicate orange notes and correct the four inspected rack/floor tom colors.
- Update automatic saved copies and only the fingerprinted older Roam backup on open, saving once. Protect independently imported charts, already current backups, future revisions, and every other instrument. No song/audio removal or clearing device storage.
- New uploads, explicit rebuilds, and migration select the same chart. All four levels remain nested subsets. General song transcription behavior and the existing In Bloom lower-difficulty preservation remain intact.
- Bundle only reference note/waveform data, no WAV, video, or private backup. Songs remain device-local; game updates do not synchronize setlists across devices.
- Ship game version 42 and offline cache v42-1 including the new reference module. Updates apply using the existing safe-between-songs flow.
- Require recording identity/length guards, exact backup equivalence, corrected color landmarks, scoreability, protected imports, automatic migration idempotency, desktop/mobile upload-save-reopen and offline asset checks before publishing.

Accuracy limit: only the short shared opening was video-guided. The rest uses recording-specific audio estimation and bounded spectral inspection. This release does not promise every drum hit is manually verified or apply this recording-specific chart to different files.


## Version 43 — prioritize audible notes on every upload

### Product goal

Reduce notes that were never played, for all newly analyzed supported recordings and all four parts: Drums, Guitar, Bass and Vocals. The same evidence rules must run in single-instrument, separate-part and Whole song upload flows; no title, filename or audio identity may enable the general correction.

### Requirements

- Require a fresh, rapid tonal envelope attack before adding Guitar notes or splitting a held Bass/Vocal pitch into repeated note heads. Compare the localized rise with the surrounding band's full envelope change, rather than treating spectral flux or increasing volume alone as proof. Preserve stable legato pitch changes, including gradual vocal entrances.
- Measure each tonal instrument's frequency band independently of the percussion timing estimate. Average short-window band power using frame-sized buffers so long songs do not need a second sample-sized prefix array on mobile.
- Recheck orange drum notes after all recovery and color passes. Collapse duplicate orange detections within a single 12 ms burst; do not apply this merge to red snare/flam strokes or to the public chart builder's distinct accepted anchors. Reject orange notes paired with a snare without sustained cymbal evidence. Recent ringing and weak flutter require stronger evidence of a new cymbal attack. Track only accepted prior cymbals so a rejected candidate cannot suppress a later true strike.
- Do not infer a simultaneous yellow hi-hat merely from a cymbal's two-stage envelope. Require separately established short hi-hat evidence before the existing composite-attack recovery adds that voice. Retain clearly detected hats, real crash/body chords, quiet repeats and blue/green tom fills.
- Never complete a beat grid, add notes to fill silence, or alternate fill colors for decoration. Expert is the set of accepted distinct audible events; Hard, Medium and Easy are reduced subsets with original event timing and instrument identity.
- Keep already saved charts until an explicit rebuild, with the existing reviewed In Bloom/Roam migration rules and imported-chart protections. Audio storage, save/reopen and mobile offline behavior remain intact.
- Tag newly generated quality metadata with evidencePolicy audible-attacks-v1; general analysis versions become Drums 18, Guitar 5, Bass/Vocals 3. Reviewed recording-specific chart versions remain unchanged. Ship game/offline package version 43.

### Acceptance checks

Independently synthesize held notes with 1.5, 2 and 3 Hz volume modulation for Guitar, Bass and Vocals. Require one note per labeled entrance, correct pitch, no notes in rests and onset error below 30 ms. Independently synthesize crash tails with 13, 17 and 23 Hz flutter; require all four real orange hits and zero invented colors. The preceding detector adds repeated pitched notes and duplicate or phantom metal notes in these fixtures.

Existing fixtures must continue to verify actual bass/vocal re-articulations, vocal legato and vibrato, interleaved guitar/drum recordings, fast snare rolls, rack/floor tom fills, quiet hats and genuine simultaneous cymbal/body hits. Verify difficulty subsets, reviewed reference protection, whole-song/desktop/mobile upload-save-reopen flows, and offline updates before publication.

Accuracy limit: these are audio-evidence heuristics, not exact source separation or a promise of every note in every mix. Conservative rejection can omit ambiguous quiet attacks. Authored chart import remains the path for an exact arrangement; generated charts need previewing.

Validation: the broad 240-check run passed 236 tests, skipped three optional full-WAV Roam cases and hit one stale version-42 offline assertion. Updating that assertion for version 43 and running all 11 Roam checks with the supplied original WAV passed without failures or skips, covering the skipped scenarios and corrected assertion. All note-detection, new false-note fixtures, whole-song analysis, mobile/desktop upload, save/reopen, difficulty, reference, storage and update checks are covered across those runs. Runtime syntax and whitespace checks passed. UI/storage adapters are automated simulations, not physical-phone testing. In the four-note 2 Hz held-tone fixture, the previous Guitar, Bass and Vocal detectors each generated 24 notes; the final code generates four each.


## Version 44 — recover audible Expert hits without filling gaps

### Goal and scope

Improve recall of played hits while retaining false-note rejection for every supported audio upload and each analyzed part. Expert contains accepted distinct events; Hard, Medium and Easy reduce that master. An absent instrument or unused drum voice must stay absent. Do not claim exact transcription of every recording.

### Requirements and implementation

- Detect fast re-articulations of Bass and Vocals from independently measured tonal-band rises, not only a long-window spectral flux peak. Use real envelope onset anchors, merge duplicate candidate detections and retain stable legato changes. Permit clearly voiced 45 ms vocal segments rather than rejecting all phrases shorter than 70 ms.
- Recover short picked Guitar notes that the sustained-tone mask misses. Require a measured sharp onset, a fundamental plus integer-spaced overtones, concentrated raw spectral energy and a consistent pitch vote. Restrict those votes before the following measured onset so the next note cannot supply this note's color. One measured attack supplies one head; loudness still cannot generate a chord.
- Preserve the version-43 rejection of held-note volume modulation. Continuous unpitched noise must not chart as any of the four instruments.
- Scale isolated attacks from active frames when silence occupies most of a recording. A supported recording with one clear audible event is valid; never add events merely to meet a minimum note count. A truly silent recording still reports an error.
- Recover strong short hat bursts in the first 60–180 ms following a measured crash while its background is settling. Later cymbal flutter still requires a stable background. Keep Yellow = closed/open hi-hat, Orange = cymbal, Red = snare, Blue = rack tom, Green = floor tom and Purple = kick.
- Verify quieter tom repeats using genuine neighboring tom bodies, including bodies recovered earlier in the same pass. A measured stick burst can anchor timing, but the candidate still needs a clean body and independent pitch/phase evidence. No blind roll or fill completion.
- Realign a delayed kick cycle only when a prior measured hand onset within 15–60 ms contains immediate low-band growth and a kick-range body. The first 12 ms must show independent low-frequency rise; a later kick cannot inherit an earlier hat's timestamp. Preserve quiet 90 ms kick repeats and independently staggered hits.
- Retain reviewed reference selection/migration, authored import protections, other saved instruments, all four difficulties, chunked audio persistence and mobile/offline behavior. Existing arbitrary saved charts update only on explicit rebuild. Ship game/offline version 44 and generic detector versions Drums 19, Guitar 6, Bass/Vocals 4 with evidencePolicy audible-attacks-v2.

### Acceptance and accuracy limits

Independently synthesize 24 labeled repeated notes at 80, 120 and 160 ms spacing for each tonal instrument, plus a five-pitch guitar melody at 80, 100 and 120 ms spacing. Require exact head counts and pitches, onset error below 30 ms, and lower difficulties derived from accepted Expert events. Require one clear event in separate sparse Guitar/Bass/Vocal recordings and each of the six drum voices; all unused colors remain empty. Add continuous unpitched-noise negatives for all four instruments. Existing held-modulation, legato, vibrato, simultaneous voices, drum rolls, tom fills, cymbal flutter and quiet-double-kick tests remain mandatory.

In the labeled mixed-fill fixture (seed 119), compare before/after recall and false additions per color. Version 43 measured Red 36/36, Yellow 87/91 with one extra, Blue 14/16, Orange 4/4, Green 12/12, and Kick 27/28 with one late extra. Version 44 measures Red 36/36, Yellow 91/91 with one extra, Blue 16/16, Orange 4/4, Green 12/12, and Kick 28/28 with no extra, at 30 ms one-to-one tolerance. This is improved recall and one fewer false event, not perfect transcription: the remaining ambiguous yellow/snare overlap is not established as an independent hat. Broader tightly overlapping kit fixtures also retain known misses and false candidates. Do not suppress real quiet hats by globally tightening a snare/hat threshold that cannot distinguish the two.

Automatic audio evidence cannot guarantee every real note or every color in an arbitrary full mix. Isolated instrument audio and authored chart imports remain the most reliable inputs. Never apply a reviewed song's chart to a different audio identity or upload private reference audio with the public game.

Validation: the broad 265-test run passed 262 tests with zero failures and three optional original-WAV Roam scenarios skipped. A separate run of all 11 Roam checks using the supplied original WAV passed without failures or skips, covering those three scenarios. All 25 new Expert recall checks passed, including rapid repeated notes, five guitar pitch colors, sparse single-hit recordings and continuous-noise rejection. Existing reference, difficulty, upload, storage and offline-update checks passed. Runtime syntax and whitespace checks passed. Mobile UI and storage adapters are automated simulations; no physical-phone test was performed.

## Version 45 — identify more independently played rack and floor toms

### Goal and scope

Recover real blue rack-tom and green floor-tom notes during fills on every supported drum upload. Preserve Red = snare, Yellow = hi-hat, Blue = rack tom, Orange = cymbal, Green = floor tom and Purple = kick. Run the same verification after direct and adaptive analysis, including drum parts in Whole song and separate-part uploads. Never add a color merely because it is available.

### Requirements and implementation

- Verify each recovery candidate against a measured short treble attack and a clean resonant body. Two treble-filter stages must establish a new stick transient within the first 12 ms; body concentration and the noise decay reject snare-wire and cymbal noise.
- Compare separate spectral body peaks with the measured complex decay in two pre-hit windows. A 20 ms post-hit window proves that the vibration is present at the current onset. A longer projection ranks its pitch without allowing a later tom to supply an earlier hi-hat's color. Do not turn an unchanged ringing tom beneath a hat into a new tom strike.
- Admit a quiet repeat whose vibration partly cancels the preceding body only with a measured stick transient, a coherent pre-hit body and a verified neighboring tom 65–250 ms earlier. This is evidence checking, not automatic roll completion. The candidate still needs its own timing and resonance change.
- Correct a prematurely or belatedly aligned tom head to its independently measured stick attack. An earlier head may move forward only when it lacks a real stick attack of its own. Preserve separate nearby hand hits and kick evidence. A confirmed tom's stick noise must not duplicate into yellow, and a learned floor-tom activation must not duplicate into kick without an independent low resonance.
- Learn a rack/floor boundary only when at least two verified hits establish each side of a pitch gap exceeding half an octave, with the lower group at most 145 Hz and the upper group at least 165 Hz. Otherwise retain the default 102 Hz boundary. Two high rack-tom voices remain blue; a repeatedly established 120 Hz floor and 210 Hz rack can map to green and blue respectively. This cannot identify physical drum size from pitch alone in every tuning.
- Keep Expert as the accepted audio-event master. Hard, Medium and Easy reduce it without recoloring or retiming retained hits. Preserve authored chart imports, reviewed In Bloom/Roam selection and migrations, audio persistence and mobile/offline behavior. Existing arbitrary saved charts change only after explicit rebuild.
- Ship game/offline version 45 and generic drum chartVersion 20, with tomEvidencePolicy measured-resonance-v1. Guitar/Bass/Vocal detector versions and the reviewed references remain unchanged.

### Acceptance and accuracy limits

Add independently labeled fixtures for varied tom tuning and stick strength, another noise seed, 80 ms fills, long resonant tails with quieter canceling hits, single-voice rolls and a 120-hit passage through adaptive separation. Require every labeled blue/green hit, onset error below 25 ms, exact zero extra notes on every unused color, and difficulty subsets preserving onset/color. Add rack/floor ringing tails with 13 and 23 Hz amplitude flutter; require only the two genuine struck notes. Existing tests must preserve snare-only rolls, hats before/after toms, simultaneous kicks, cymbal wash, sparse single hits, continuous-noise rejection and independently staggered colors.

These fixtures establish improved recovery, not perfect transcription of arbitrary acoustic recordings. Tom recovery remains conservative when a cymbal or another instrument obscures the body. Tunings without two clear groups remain ambiguous; tightly overlapping kit fixtures retain existing measured errors. The algorithm does not synthesize a missing fill, force absent drum voices or substitute a reviewed song chart for an unrelated upload. Private reference audio stays outside the published game and repository.

Measured before/after on the same independent fixtures: version 44 recovered 1/12 blue and 8/12 green in the default 24-hit fill; version 45 recovers 12/12 of each, with no extras. With stronger stick noise, version 44 added 13 yellow notes and retained only 1 blue/7 green; version 45 retains all 24 tom notes with zero yellow notes. In the 120-hit adaptive passage, version 44 retained 60/60 blue and 20/60 green, with 106 false yellow notes and 20 false kicks. Version 45 retains 60/60 of each tom color with zero added notes on any color. The separate 80 ms and long-tail fixtures also retain all 24 labeled hits without added colors. These are synthetic ground-truth comparisons, not claims about unmeasured songs.

Validation: the complete 281-test run passed 278 tests with zero failures and three optional full-WAV Roam cases skipped. A separate run of all 11 Roam checks using the supplied original WAV passed with no failures or skips, covering those three cases. All 16 new tom checks passed. Existing drum-color, snare-roll, hi-hat, cymbal, kick, timing, difficulty, reference, upload, save/reopen and offline-update checks passed. Runtime syntax and whitespace checks passed. Mobile UI/storage coverage uses automated adapters, not a physical-phone test.


## Version 46 — quiet attacks and visible ghost notes

### Goal and scope

For every new supported upload or explicit rebuild, retain independently audible soft attacks on Expert and mark their dynamics without adding silent or guessed hits. Apply this to Drums, Guitar, Bass and Vocals, including selected parts of full-song uploads. Drum identities remain Red snare, Yellow hi-hat, Blue tom, Orange cymbal, Green floor tom and Purple kick. Reviewed audio-identity reference charts and authored imports retain their supplied arrangements.

### Requirements and implementation

- Recover a soft repeat only from actual onset and instrument evidence. For neighboring toms, extend the verified repeat window to 65–300 ms and allow lower measured stick novelty/energy while retaining a fresh stick transient, clean body, resonant pitch and phase checks. Extend supported kick-repeat context to 350 ms. Lower Bass/Vocal relative voicing floor while retaining stable pitch and harmonic-confidence checks. Do not blanket-lower color classification thresholds or synthesize a fill on a tempo grid.
- After accepting attacks, estimate relative dynamics in the selected instrument band (separate bands for drum voices), comparing local same-voice hits within four seconds. Subtract pre-hit background power. Store normalized velocity in (0, 1]; mark an attack below 22% of its local accent reference as ghost only with at least four same-voice observations. This is an estimated relative attack level, not calibrated MIDI velocity or acoustic force. A uniformly quiet recording is not automatically all ghost notes. Insufficiently exposed hits remain unconfirmed.
- Expert retains all accepted heads, original onsets and colors, including ghost hits. Generated Hard, Medium and Easy favor accents before existing density reductions; a quiet pickup cannot consume the spacing slot needed by a strong backbeat. Existing authored lower difficulties are preserved.
- Draw a high-contrast hollow center on a ghost gem or kick bar without reducing its size or changing its lane color. Chart preview states the quiet-note count and explains the marker. Use the same pad, hit window and score as an ordinary note; no pressure-sensitive hardware is needed.
- Preserve ghost and velocity through chart construction, chunked setlist saves, fresh reopening and .riffpack export/import. Validate dynamics on import instead of silently stripping them. Leave audio bytes intact.
- Ship game/offline version 46 and generic detector versions Drums 21, Guitar 7 and Bass/Vocals 5. Add quality policy relative-attack-dynamics-v1 and an Expert ghost-hit count. Existing arbitrary saved charts use the new analyzer only on explicit rebuild.

### Acceptance and measured limits

Use independent labeled recordings with 24 attacks (eight soft) per voice. Require exact heads, zero added colors/pitches, onset error within 30 ms, eight correctly identified ghost hits, no accent mislabeled as ghost and lower difficulties drawn from Expert accents. Test Snare/Hi-hat at 3% accent amplitude, Blue tom at 12%, Orange cymbal at 6% with exposed 850 ms spacing, Green floor tom and Kick at 6%, and Guitar/Bass/Vocals at 3%. Also test uniformly quiet recordings, normal-pad scoring, hollow rendering, mobile upload/reopen and chunked persistence plus portable-backup validation.

At 230 ms spacing, Version 45 measured 16/24 green floor-tom hits at 6% amplitude and 20/24 kicks at 6%; Version 46 measures 24/24 each with zero added heads. Bass and Vocal separated-note recordings at 3% improved from 16/24 to 24/24. The new dynamics annotation marks the eight soft attacks for all nine exposed test voices, while preserving accepted timing and identity.

These are controlled signal tests, not evidence of perfect arbitrary-song transcription. At 230 ms spacing, blue toms at 6%/3% amplitude and repeated crashes at 12%/6%/3% remain partly buried in prior ringing and are not reliably recovered. Other tightly overlapping kit fixtures retain their documented ambiguous misses/additions. Full mixes, noise, reverb and overlapping instruments can affect dynamics estimates. Do not turn ringing, a held-note swell or background noise into a ghost-note event. Isolated tracks and reviewed/imported charts remain more reliable.

Validation: the full 299-test run passed 296 tests with zero failures and three optional original-WAV Roam scenarios skipped. A separate run of all 11 Roam checks using the supplied original WAV passed with no failures or skips, covering those three scenarios. All 17 new quiet-note/dynamics checks and the additional mobile upload/reopen check passed. Existing noise, held-modulation, cymbal/tom ringing, colors, fills, timing, references, import, chunked storage and offline/update checks passed. Runtime syntax and whitespace checks passed. Mobile coverage uses automated audio/DOM/storage adapters; no physical-phone test was performed.


## Version 47 — recover supported hits underneath a ringing drum

### Goal and scope

Run the instrument's audio-evidence checks automatically for every new upload and explicit rebuild. Improve the remaining quiet Blue tom, Green floor-tom and Purple kick misses under predictable ringing, while retaining all other drum colors and rejecting extra notes. Expert keeps accepted soft attacks and their ghost markers; simpler arrangements favor accents. This pass estimates events from the selected audio; it does not restore sound that is completely masked or reconstruct an unavailable stem.

### Requirements and implementation

- After normal drum verification, scan for a new resonant component 90–350 ms after a measured tom or kick. Fit a second-order decaying predictor to the prior 40 ms of the doubly low-pass-filtered body, then compare the next 14 ms with that prediction. Use sliding moments rather than refitting an entire window at each step.
- A candidate must have a stable predicted frequency in 35–350 Hz matching a nearby measured drum of the same physical voice, no already accepted body hit within 45 ms, and residual RMS above both a minimum floor and 4% of the previous body's level. Require a prediction-error ratio of at least 20,000 and at least 70% resonant concentration. These deliberately strict gates limit recovery to exposed changes in highly predictable ringing. Broadband wash and mixed unstable bodies must not pass merely because their volume rises.
- Reject a residual consistent with the old tone simply disappearing. Require a different phase direction or aligned positive growth; do not accept a pure opposing residual as a new stroke. Retain distinct measured onsets without grid snapping or blindly filling a roll. Rank nearby candidates by evidence and prevent duplicates.
- Assign the recovered note the measured neighboring drum's color, including the learned floor-tom range. Do not substitute yellow for a new tom body, blue for a kick or green for an unchanged low resonance. Feed accepted additions through existing relative-dynamics measurement, Expert construction and difficulty reduction.
- Record a per-instrument audio review. Drums use ring-residual-v1 with a recovered-hit count; Guitar, Bass and Vocals retain audible-attacks-v2 and their existing pitch, attack, sustained-note and noise checks. Whole song and Separate parts preserve each successful part's review rather than copying only the selected part's data. Rebuilding or reuploading one part retains other saved parts and their reviews. Matched reference uploads record reviewed-audio-identity-v1 and retain their reviewed arrangements.
- When recoveries exist, show the recovered-hit count in chart details and ask the player to preview the quiet passages. Preserve counts and ghost notes through chunked saves, reopen and .riffpack backups. Authored imports clear the replaced part's automatic-review data and never display stale recovery counts.
- Publish game/offline version 47 and generic Drum detector 22. Guitar 7 and Bass/Vocals 5 retain their current signal analysis. Original audio remains device-local; private test audio is excluded from deployed assets and public source.

### Acceptance and limits

For independent labeled Blue, Green and Kick recordings at 230 and 250 ms spacing, each with 24 strikes including eight at 3% accent amplitude, require 24/24 matched onsets within 30 ms, eight ghost markers, eight automatically recovered heads and zero added colors. Version 46 measured 16/24 on each 230 ms recording; Version 47 measures 24/24. Test smooth ringing modulation at 7, 13, 17, 23 and 31 Hz for both tom colors, requiring exactly the two real hits and no recovered heads. Preserve the prior irregular timing, mixed kit, masked cymbal/hat, snare rolls, held-tone modulation, storage and reference tests.

Also exercise mobile real-worker upload, chunked setlist save and fresh reopening without reanalysis; Whole song aggregation and one-part rebuild must retain independent review records. A portable backup must preserve the overlap-review count and ghost markers with original audio bytes intact.

Recovery remains conservative. In a near-cancelling 271 ms blue-tom recording at 3% amplitude, only two additional soft hits are supported (18/24 total), with no extra colors; the remaining hits stay unconfirmed. Repeated 3% cymbals at 230 ms remain hidden by stochastic wash (16/24 total) and must not acquire guessed tom or hi-hat notes. Busy full mixes and rich/unstable drum bodies may fail the strict predictor gate. A completed review means the available audio evidence was checked, not that every physical strike was recovered or independently verified by a human.

Validation: all 22 new buried-hit tests passed. The broad 323-scenario run passed 319, skipped three optional original-WAV Roam scenarios and found one test-setup failure: the new one-part review test selected an existing Bass chart but never clicked Rebuild. Correcting that test to invoke the actual rebuild handler resolved it; the complete 69-test upload-flow rerun passed 68 with zero failures and one original-WAV scenario skipped there (it passed in the broad run with reference media configured). Both new mobile/multipart checks also passed in a focused rerun. A separate 11-test run using the supplied original Roam WAV passed with zero failures or skips, covering the three optional broad-run scenarios. Existing colors, irregular onsets, fills, quiet notes, tail rejection, storage, references and offline/update checks passed; no failures remain unresolved. Syntax and whitespace checks passed. Mobile coverage uses audio/DOM/storage adapters, not a physical phone.


## Version 48 — sustained hi-hat identity and unsupported treble heads

### Goal and scope

Apply the selected recording's drum-voice evidence to every new generic drum upload and explicit rebuild, including Drums selected from Whole song or Separate parts. Keep open and closed hi-hats Yellow, snare Red, tom Blue, cymbal Orange, floor tom Green and kick Purple. Prevent the duration of an open hat from creating an Orange head, and prevent a crash's sharp initial attack from supplying a speculative Yellow head. Keep independently supported chords and physical onsets. Reviewed audio-identity charts and authored imports retain their existing arrangements; this change does not infer unrelated guitar, bass or vocal pitches from drum colors.

### Requirements and implementation

- After the direct or adaptive kit path and existing noise-tail checks, learn a stable treble fingerprint from exposed, fresh closed hats in the same recording. Use 32 power bands between 2.5 kHz and the lower of 10 kHz/Nyquist. Require at least four closed-hat examples in a consistent cluster, concentrated spectral evidence and strong within-cluster agreement. A generic broadband-noise envelope shared by hats and cymbals is insufficient to authorize a timbre correction.
- Compare a sustained head's early attack and later release with the kit's hat fingerprint. Both must agree before replacing an Orange candidate with Yellow. Collapse same-onset Yellow/Orange candidates to one Yellow head only when both phases support one sustained hat. Do not create a new stroke at a hat's foot choke, during a ringing tail, or on a beat grid.
- Reject calibration examples and relabeling decisions beside a snare. Require a predominantly fresh treble onset, measurable energy, and an exposed release without an intervening head. Measure fresh windows within a few milliseconds of the detector timestamp so initial strike energy is not subtracted as old background; retain the charted onset itself.
- A sustained, broadband release distinct from the learned hat can support a real cymbal even when its loud initial transient resembles a closed hat. Keep only Orange when no hat fingerprint is exposed. Admit a simultaneous Yellow/Orange pair only when the fast attack independently exposes the hat timbre and the release exposes a different sustained cymbal. Do not add a color merely because an envelope has two decay stages.
- Run this pass before final tom/kick verification, relative dynamics and Expert construction. All easier arrangements remain subsets of accepted Expert heads with unchanged physical voice and onset. Preserve per-instrument metalIdentityPolicy attack-release-timbre-v1 and metalCorrections alongside the existing buried-hit review through multipart merging, reupload, rebuild, chunked setlist saves, reopen and portable backups. The count describes algorithmic candidate adjustments, not human-verified accuracy.
- Publish game/offline version 48 and generic Drum detector 23. Guitar 7 and Bass/Vocals 5 retain their existing selected-audio checks. Existing saved generic charts update on explicit Rebuild this instrument's chart; reopening alone preserves their saved arrangements. Original/private audio remains excluded from public source and deployed assets.

### Acceptance and limits

Independently generate metallic closed/open hats sharing a physical spectrum, separate broadband crashes, red-only rolls, Blue/Green fills, kick/cymbal chords and deliberate rests. Test multiple noise seeds, 4/7/10 per-second open-hat decay constants, six-bar direct analysis and sixteen-bar adaptive analysis. Require every labeled voice to match within 30 ms with zero added heads; require lower difficulties to preserve Expert identities and onsets. Version 47 miscolored all six or sixteen long open hats Orange at decay constants 4/7/10; Version 48 must retain every one as Yellow while keeping the real crashes Orange.

Include foot-choked hats, softer open hats, shifted metallic partials and single crashes with a fast initial component. Require no release/choke notes or extra Yellow head from those crashes. For an exposed real hat/crash/kick chord, retain all cymbals, kicks and other kit voices and at least 41/42 hats with zero extras. Require automatic mobile real-worker upload, explicit rebuild, fresh setlist reopen and .riffpack round trip to retain exact corrected colors and review data. Preserve the existing snare-roll, mixed-kit, quiet-note, buried-hit, irregular-time, reference, storage and offline/update checks.

This is a recording-specific signal check, not perfect source separation. Kits without enough exposed closed hats or a distinguishable spectrum cannot authorize the correction. Spectrally identical broadband hats/crashes, an unfamiliar second hat, tightly overlapping snare/hat noise, quiet simultaneous hats beneath sharp crashes and completely masked strikes remain uncertain. Strong body or vocal/guitar overlap can obscure the fingerprint. Do not convert that uncertainty into a promised complete transcription; preview or authored chart review remains necessary for arbitrary full mixes.

Validation: all 22 new identity/color checks passed, including both direct and adaptive drum paths, all six named voices, long/quiet/choked/shifted hats, sharp single crashes, supported hat/crash/kick chords and portable backups. The full 346-test run passed 343 with zero failures and three optional original-WAV Roam cases skipped. A separate run of all 11 Roam checks with the supplied original WAV passed with zero failures or skips, covering those three scenarios. The mobile real-worker upload, explicit rebuild, chunked save/reopen and multipart review-retention checks passed in the full run. Syntax and whitespace checks passed. Phone coverage uses automated audio/DOM/storage adapters, not a physical-phone recording. Existing mixed-noise fixtures retain their documented one/two ambiguous Yellow extras; this release does not claim to eliminate every false note in unmeasured songs.


## Version 49 — independently supported overlapping drum voices

### Goal and scope

Review collisions between drum hits and ringing tails on every new generic Drums upload and explicit rebuild, including selected parts of whole-song uploads. Recover supported Yellow hi-hats with Orange crashes and Purple kicks; keep a later crash at its own onset when an earlier open hat is still ringing. Suppress false Yellow heads from cymbal flutter or release. Preserve Red-only snare rolls, Blue/Green fills, quiet dynamics, all accepted physical timings and saved arrangements. Reviewed references and authored imports remain unchanged.

### Requirements and implementation

- Keep the existing recording-specific closed-hat cluster and broad attack/release comparison. Retain each calibration example's physical timestamp. From at most 32 evenly sampled cluster examples, learn a normalized fine-frequency spectrum; identify separate resonances with clear local contrast. Do not hardcode any kit's resonance frequencies, copy a demo pattern or use a tempo grid to complete an overlap.
- A second hand color must expose at least three learned metal resonances in two attack windows, growing above the pre-hit sound. Require local contrast in both windows and broad timbre agreement, including a measurable difference from the cymbal release. The broad check rejects random peaks in a broadband crash; the resonance check keeps supported hats beneath a sharp crash. A recording without enough exposed, distinctive hats cannot authorize this added evidence path.
- Inspect measured treble onsets as well as existing metal candidates. Additional candidates need a fresh stick transient, sufficient high-frequency energy relative to the full body, measurable new noise and a supported instrument identity. Lower novelty is allowed only inside these recording-specific voice checks, not as a global onset threshold. Keep original onset/provenance and genuine body/kick voices.
- When a later measured hit contaminates the release window, strong fresh hi-hat identity can label the earlier stroke Yellow without adding a crash there. Check metal identity before final noise-tail rejection so a wrongly Orange open hat cannot cause a subsequent real crash to be discarded as repeated cymbal wash. Recovered or retained cymbals still pass the existing tail rejection afterward.
- Recheck existing Yellow candidates inside recent cymbal wash. Reject a head whose attack neither matches the learned hat spectrum nor contains its new resonances. Perform this rejection even when the supposed head lacks a fresh noise onset; failed fresh-onset evidence cannot protect a false existing note. Preserve a separately supported Orange head at the same onset when removing Yellow. Never turn a decay cutoff into a ghost note.
- Count unique changed physical color candidates rather than multiple detector proposals for one pad/onset. Store metalIdentityPolicy attack-release-timbre-v2 and the correction count in the Drums audio review. Preserve these data and exact notes through multipart aggregation, chunked saves, fresh mobile reopen and portable backup. Expert retains accepted voices and onsets; lower difficulties remain subsets without recoloring.
- Publish game/offline version 49 and generic Drum detector 24. Guitar 7 and Bass/Vocals 5 retain their existing pitch and attack checks. Existing saved generic charts use the new review after explicit Rebuild this instrument's chart. Audio stays device-local; private reference media is not deployed or committed.

### Acceptance and measured limits

Use independently labeled multi-voice audio to test sharp simultaneous hi-hat/crash/kick strikes across three noise seeds, ordinary two-hand chords, and open hats 100 ms before a later crash/kick across both direct and adaptive paths. Require every Red, Blue, Orange, Green and Purple hit with zero extra heads; retain at least 40/42 Yellow hits in the sharpest overlapping six-bar cases. For ordinary exposed chords and the staggered ringing-hat cases, require every labeled head with zero extras. In the staggered cases, verify each earlier Yellow and later Orange/Purple onset within 12 ms, not merely total counts.

Version 48 measured 37/42, 38/42 and 37/42 hats in the sharp simultaneous cases (seeds 481, 907, 2611), with 5/6, 4/6 and 5/6 crashes. The revised check measures 42/42, 40/42 and 41/42 hats and all six crashes per recording, with no extra heads. The remaining two/one quiet simultaneous hats stay unconfirmed. In the six-bar ringing-hat recording, Version 48 missed six hats and all six later crashes, placing six Orange heads at the earlier hat onsets; the revised check separates all 42 Yellow hits and six crashes. The sixteen-bar version must retain all 112 hats and 16 crashes with their separate onsets.

Test single sharp crashes with five additional noise seeds; their random spectral peaks must not license Yellow. Test cymbal wash at 17 and 31 Hz in a recording that supplies a distinct learned metallic hat. Version 48 added eight and two Yellow heads respectively; the revised check must add none while retaining all real kit hits. Also retain the full previous color, dynamics, buried-hit, fill, independent-timing, tonal-instrument, reference, save/import and offline-update checks. Mobile real-worker upload must preserve corrected overlaps through chunked storage and fresh reopening without reanalysis.

These are controlled audio tests, not a complete transcription guarantee for arbitrary mixtures. Quiet hats fully buried in a sharp crash, kits without exposed stable hat examples, unfamiliar secondary hats, rich unstable resonances and spectrally identical broadband snare/hat noise remain ambiguous. Existing mixed-noise fixtures have documented one/two Yellow extras outside this distinguishable-hat correction scope. Do not force unsupported colors or fill missing notes from rhythm alone. Mobile coverage uses automated audio/DOM/storage adapters rather than a physical handset.

Validation: all 19 new overlap, timing, false-head and backup scenarios passed. The complete 366-test run passed 363 with zero failures and three optional original-WAV Roam scenarios skipped. A separate run of all 11 Roam checks using the supplied original WAV passed with zero failures or skips, covering those three scenarios. The mobile real-worker overlap upload, chunked save/fresh reopen, explicit rebuild and multipart review-preservation checks passed. Existing snare rolls, tom/floor-tom fills, kicks, ghost dynamics, buried resonances, tonal attack/pitch, reference, backup/import, storage failure and offline/update checks passed. Syntax and whitespace checks passed. Quiet overlapping hats below the measured evidence gates and the existing spectrally ambiguous mixed-noise cases retain the limits documented above.

## Version 50 — consistent audio colors across instruments

### Goal and scope

Keep uploaded audio's detected note identities consistent for Drums, Guitar, Bass and Vocals, in single-part, separately selected and whole-song charting. A repeated pitch must retain its color within a difficulty; common repeated pitches must not push less frequent notes onto the same pad when the available five pads can distinguish them. Do not add attacks to fill empty colors. Maintain independent drum voice colors, measured timings, quiet dynamics and authored/reference arrangements.

### Requirements and implementation

- Guitar, Bass and Vocals assign colors from distinct accepted pitches, without repetition-weighted percentiles. For one through five distinct pitches, allocate ordered pads across the highway, with one distinct pad per pitch. A single-pitch recording uses one pad. For more than five pitches, map the full measured pitch span monotonically to five pads; nearby pitches can share a pad, and every repeated pitch retains its mapping. The chart still carries each measured MIDI pitch.
- Build the pitch mapping once from Expert's accepted events. Use it for the legacy normal arrangement too. Hard retains Expert colors; Easy and Medium for Guitar/Bass use the existing three/four-fret reduction. Vocals retain five pads. Reductions remove heads and simplify frets without changing the measured pitch or onset. Do not infer physical instrument identities from these tonal pad colors.
- Drums retain Red snare, Yellow closed/open hi-hat, Blue tom, Orange crash/ride, Green floor tom and Purple kick. The v49 overlap, transient, learned hat identity, snare-roll, tom-resonance and tail rejection checks continue to gate drum heads. This release changes tonal color assignment, not the acoustic onset or pitch estimators.
- Preserve each part's color policy in its own audio review: distinct-audio-pitches-v1 plus its Expert pitchColors for tonal parts; fixed-drum-voices-v1 for generic and reviewed-reference Drums. Keep review metadata through multipart aggregation, one-part rebuild, automatic setlist save, fresh reopen and portable backup. Authored imports and existing saved arrangements are not recolored on reopen.
- Publish game/offline version 50, Guitar detector 8 and Bass/Vocals detector 6. Generic Drums remains detector 24; reviewed In Bloom/Roam remain unchanged. New uploads and explicit instrument rebuilds use the new tonal mapping. Private audio stays excluded from deployed assets and source.

### Acceptance and limits

Generate independent labeled audio for all three tonal instruments with five equally or unevenly spaced pitches, rare endpoints, deliberate rests, and 24 repetitions of the middle pitch. Require every real attack and its measured pitch, zero additional heads and the five expected ordered colors. Timing tolerances remain 45 ms for low bass and 30 ms for Guitar/Vocals in these fixtures. Verify lower difficulties retain Expert pitches and timing with only their intended fret reduction.

Version 49 merged the second rare pitch into the first color in these recordings; for tightly spaced five-pitch melodies it merged multiple distinct pitches. All six controlled audio recordings must now distinguish the five pitches. Independently compare seven-pitch charts before/after 100 added repetitions of one accepted pitch; unchanged physical pitches must retain identical ordered colors, with the lowest/highest at the endpoints. Preserve exact playable fields and per-part reviews through a combined tonal .riffpack backup. Mobile real-worker uploads for Guitar, Bass and Vocals must retain exact charts and reviews through chunked save, fresh reopen without analysis and explicit same-part rebuild. Recheck all named drum colors and the existing overlap/fill/ghost, upload, import, storage and offline/update regressions.

Five pads cannot assign a unique color to every pitch of a wider melody, and automatic analysis of a full mix can still misidentify a pitch or masked instrument. This mapping fix cannot recover completely buried notes or turn uncertain audio into a perfect transcription. Preserve those detection limits and require preview review. Mobile verification uses automated audio/DOM/storage adapters rather than a physical phone.

Validation: all 13 new tonal color, repetition-invariance, backup and mobile save/reopen/rebuild scenarios passed. The initial focused 56-case color, tonal, named-drum, rapid-note and no-extra-attack checks passed. The broad 382-case run passed 369 with 12 optional private-media skips and one cancellation-test polling timeout. A subsequent 74-case upload run, including the original In Bloom recording, passed 73 and exposed a test wait that missed an intermediate batch state. The test adapter now uses a bounded elapsed wait while observing each immediate event-loop phase; all six relevant color/save, multipart and cancellation checks passed after that correction, with no unresolved failures. The entire broad suite was not repeated after this test-only wait correction. A separate 35-case original In Bloom/Roam reference run passed without failures or skips. Syntax and whitespace checks passed. These checks preserve the full-mix and physical-phone verification limits above.


## Version 51 — Reliable backup export and truthful save status

### Problem and goal

A player exporting a saved 52.7 MB Frantic WAV saw “Backup exported” although no file appeared in Downloads. The old flow clicked a temporary anchor, removed it immediately, revoked its Blob URL after 30 seconds, and unconditionally claimed success. Browser download requests do not acknowledge completion. Give the player an explicit recovery path and confirm success only when the app actually completes a file write.

### Requirements and implementation

- Current-song, saved-row and failed-setlist-save backup actions open an Export backup panel showing the sanitized .riffpack filename, size and included audio/chart difficulties. Keep a visible Download backup anchor with its original Blob URL; closing the panel does not invalidate it. Release the previous URL when preparing a new backup and release the current one on non-persisted page exit.
- Where available, invoke showSaveFilePicker from the original export click, write the complete Library.pack Blob, and await stream close before reporting “Backup saved.” The panel offers Save backup as… for another fresh click if a saved-row storage read consumed user activation. Show clear cancellation/error recovery; abort a failed write and retain the ready backup.
- Browsers without the picker retain the usual download request, with the permanent anchor available for another click or browser Save link as. Say “Download requested” rather than “exported” or “saved,” because the page cannot observe browser download completion. Include a link to open the same game in its own tab when embedded download restrictions interfere.
- Keep backup preparation local, preserve every original audio byte and all chart difficulties, and leave setlist records untouched by cancellation or download failure. Prevent automatic game reload while the export panel is open or a file write is pending. Ship game/offline version 51; detector versions and chart data are unchanged.

### Acceptance and verification limits

Exercise the real UI handlers with deterministic browser/DOM adapters: a blocked automatic download leaves a usable link and exact backup contents; the file picker is called before the original click yields; success waits for stream close; cancellation supports retry; denied permission and disk-write failure preserve the setlist and ready file; saved-row and setlist-recovery exports use the same panel; a saved-row activation failure can be retried on the visible Save as button. Run the original Frantic WAV through that UI export path and verify its 55,247,388 audio bytes by SHA-256 after unpacking the backup. Include existing upload, storage and offline/update regression checks.

Actual device/browser download permission behavior cannot be verified with these adapters. A fallback download request is explicitly unconfirmed. Native Save as requires browser support and permission; an embedding sandbox may block downloads or the picker, so the standalone-tab recovery remains visible. No physical phone or live browser download was tested in this environment.

Validation: all seven export scenarios passed, including the supplied Frantic WAV byte-for-byte check. The combined upload, storage and automatic-update run completed 111 cases: 109 passed, 0 failed, and 2 optional In Bloom-media cases skipped because their private paths were not provided for this export-focused run. Syntax and whitespace checks passed. Browser permissions and physical-device delivery retain the limits above.


## Version 52 — Save as works from an explicit click and has a standalone fallback

### Problem and goal

The player reported that Save backup as did nothing. Version 51 started the native picker while opening the export panel; a pending picker then prevented the visible button from doing anything. Checking only whether the method exists also treated a cross-origin embedded game as eligible, although the File System Access specification disallows that context (https://wicg.github.io/file-system-access/#api-showsavefilepicker). Make the button own its request, provide immediate status, and deliver the already-prepared backup outside the embedded context without requiring another audio upload.

### Requirements

- Preparing the export panel must not call the native picker. Native Save as starts only from its visible button's current click, requests the Downloads folder as a starting location, and immediately displays Opening the save dialog. Keep the existing write/close success confirmation, error/cancel recovery and update-interruption guard.
- Check same-origin access to the top-level context, rather than method existence alone. A blocked embedded Save as opens the standalone save page on the user's click. A separate Save in new window action stays available when a native request is pending or denied. Handle blocked pop-ups explicitly and retain the download link.
- Transfer the prepared Blob to that same-origin window through postMessage. Validate the exact child/opener window, exact origin, unique per-attempt UUID token and message type in both directions. The child checks payload size against the 80 MB audio plus 8 MB metadata envelope and safe .riffpack filename length. It acknowledges receipt; remove the parent listener and timer after receipt, supersession, page exit or a 20-second handshake timeout. Ignore unsolicited windows, other origins, stale tokens and duplicate replacement payloads.
- The receiving page must not start a picker automatically. Its own Save as button has fresh activation in the standalone context. Provide a permanent download anchor for browsers without the native picker or denied saves. Preserve the original audio and all chart fields; transfer locally without server storage or clearing the original setlist. Keep game/chart versions unchanged except the game/offline release number 52. Include both standalone save assets in the offline cache.

### Acceptance and limits

Require the export panel to prepare without a native call or locked button; the visible native Save as must call the picker synchronously, then wait for close before success. Require embedded Save as to skip the forbidden picker, open the local save page and transfer only after its matching handshake. Check denied pop-up recovery, wrong-window/origin/token rejection, no-opener and malformed-payload recovery, transfer timeout, and duplicate payload rejection. Verify standalone native save, cancellation and disk-write failure, with an available fallback. Verify the actual 55,247,388-byte Frantic WAV SHA-256 after the game export and after a structured-clone Blob transfer and backup unpacking. Recheck saved-row exports, setlist, update guards and offline asset serving.

The game cannot override browser pop-up or download policies. Hosting headers or browser isolation can sever an opener; this is reported through the timeout recovery instead of claimed success. The fallback depends on permitting the save window. Actual desktop/phone permissions and real browser file delivery were not exercised here; verification uses the real scripts with deterministic browser/DOM adapters. A native picker that remains pending does not lock the download link or new-window fallback.

Validation: the combined upload, standalone-save, storage and update run completed 118 cases: 116 passed, 0 failed, and 2 optional In Bloom-media cases skipped. Both original Frantic backup byte checks passed. After the final Downloads starting-folder hint and filename validation, all 14 focused export/transfer/save cases passed again. Syntax and whitespace checks passed. Browser/device delivery remains subject to the verification limits above.

## Version 53 — Allow the hosted backup page in automatic updates

The player's offline panel remains on version 51 and reports that the update download did not finish. The new secondary HTML asset exposed an install assumption: all redirected responses were rejected, although static hosting can canonicalize `backup-save.html` to `backup-save`. Version 53 accepts only the exact same-origin, extensionless canonical address for a declared HTML asset and requires an HTML response. External, login, query-modified and unexpected asset redirects remain errors. Cache navigation to either backup address under the same validated HTML entry. Preserve atomic installation, current offline files, setlist/audio storage, chart data and reload guards.

Acceptance: reproduce the hosted HTML redirect during installation, then serve both backup addresses with network disabled. Reject external, login and query-modified redirects, a non-HTML backup response, redirected script responses and failed cache writes. Recheck the original Frantic audio through export and standalone Blob transfer. Live HTTP inspection from this environment returned 403, so the player's specific network failure cannot be independently attributed to the redirect; the redirect failure is reproduced with the real worker in the regression adapter. Actual browser update and file delivery require user verification.

Validation: the combined upload, standalone backup, storage and update run completed 121 cases: 117 passed, zero failed, and four optional original-media cases skipped. A focused run with the original Frantic WAV passed 13 cases, including both previously skipped export/transfer byte checks; the two optional In Bloom cases remained skipped. All three new worker redirect/content regressions passed. Syntax and whitespace checks passed. Physical-browser update and file delivery were not verified.

## Version 54 — Review drum colors through simultaneous snare hits

The player reports misplaced colors throughout the uploaded Frantic drum chart. The metallic-identity review previously skipped any yellow/orange onset within 30 ms of a red snare. Remove that gap for the entire recording, without imposing a maximum number of hand colors or completing patterns from a beat grid.

Requirements: learn the recording's exposed closed-hat fingerprint and separate resonances. A simultaneous snare may dilute the broadband attack match only when at least three learned metal resonances independently grow in two attack windows and the release matches the hat. A quieter open hat requires repeated late resonance evidence, an independently started resonance, matching release, and no intervening accepted stroke or independent hat attack. Raw snare-adjacent candidates cannot supply a generic extra cymbal without this hat evidence. Keep genuine snare/crash and snare/hat/crash combinations. Do not borrow the sound of a later hat. Keep original note timings and colors in difficulty reductions. Publish game/offline version 54 and generic drum analyzer version 25; other instrument versions remain unchanged.

Acceptance: labeled independent synthetic mixtures cover three noise seeds, three open-hat decays, short/direct and longer/adaptive analysis, quiet/choked/retuned hats, genuine cymbal combinations, and hats 80–180 ms after a snare. Assert lane/time matches and unsupported heads, not only total counts. Check actual mobile upload/rebuild handlers and chunked setlist reopening; retain backup export, storage and automatic-update regressions.

The supplied personal Frantic backup was reviewed against its entire 313.19-second WAV using a mono 22,050 Hz analysis copy. That pass changed 26 metallic-color decisions, with two net fewer note heads: Expert 2,339 → 2,337. Yellow 682 → 704 and orange 407 → 383; red 489, blue 61, green 22 and kick 678 keep their original lane/time/duration values. Hard, Medium and Easy are rebuilt as subsets of corrected Expert. Every retained onset is an original timestamp, and unpacking the revised backup confirms all 55,247,388 original WAV bytes with SHA-256 e412aade5bfe6ad508b36acfac421aa1fa19bcc72462b5881e6dc7085733f48e. Private audio and backup files are not committed or hosted in the public game. Import the reviewed backup to use these corrections; an existing saved chart is not silently reanalyzed.

Verification limits: the Frantic recording has no complete independently labeled transcription, so the count changes do not establish perfect note recall or correct classification throughout. Independent synthetic mixtures verify the targeted failure; genuinely overlapping, broadband or very quiet real sounds can remain ambiguous. Six genuine crash combination tests isolate the color-review step because the existing onset detector can miss a quiet concurrent snare. Other existing fixtures explicitly tolerate some extremely quiet misses or fast-fill extras. Mobile UI checks use deterministic adapters; no physical phone or listening-based full-track transcription was performed.

Validation: the drum, overlap, quiet-note, tom, other-instrument and difficulty regression run passed 167 tests. Three additional full-analyzer delayed-hat cases passed. The upload/storage/offline/update suite completed 122 cases: 120 passed, zero failed, and two optional original In Bloom-media cases skipped. The new mobile simultaneous-snare upload/rebuild case also passed independently. The reviewed Frantic backup passed pack/unpack and chunked save/fresh-reopen checks with all chart fields, review metadata and original audio bytes intact. Unchanged core-lane timing, difficulty subsets, syntax and whitespace checks passed. A full new analysis of the supplied WAV completed with analyzer version 25 and the new overlap policy; its 2,283 accepted heads differ from the 2,337 preserved/reviewed backup heads, so the personal correction file intentionally keeps the player's original onset detection rather than silently replacing it with a new analysis. These totals are not measures of real-track accuracy.
