# In Bloom matched drum chart, revision 1

The player asked to chart the supplied In Bloom drum audio using the demo's approach. The demo's sound and notes share a known event list. This recording already exists, so its matched list is derived from the audio and checked at selected passages. The demo's notes, tempo and fills are not copied onto the recording.

The matching key is the original WAV's SHA-256: `551b1a24c46298a1467c11c1cceffa5e7fb7cc6be63c16a378a34b755b7960c3`. Duration is 272.661859 seconds. Matching uses the actual upload bytes and a length check, never the filename. Renaming the exact file works; another mix, trim, export or encoding uses ordinary automatic charting. No original audio is bundled or published.

## Authoring and reproducibility

The version 28 generic analysis supplied measured onset candidates, supplemented by short treble attacks. Candidate times were grouped within 55 ms; no beat-grid completion or fixed color cycle was added. `tools/inbloom-onsets.json` pins those times, waveform, recording identity and template examples so future generic detector edits cannot silently change this chart.

`tools/build-inbloom-reference.py` accepts the exact inspected mono 22050 Hz float32 PCM and verifies its digest. It measures 80 frequency bands at three stages of each attack, subtracts preceding sound, and fits nonnegative combinations of drum examples from this recording. Cymbal/hat templates cannot explain low drum bodies. A dominant body is one snare or tom; independently supported noise or kick components may coexist. The retained thresholds favor omitting uncertain weak components over adding a second hand color from the same body sound.

| Voice | Inspected source examples, seconds |
| --- | --- |
| Red snare | 3.052, 4.088, 4.285, 7.294, 10.562 |
| Yellow hi-hat | 5.884, 9.121, 12.258 |
| Blue rack tom | 4.672, 7.902, 11.152 |
| Green floor tom | 5.080, 8.288, 11.583 |
| Orange cymbal | 2.242, 3.470, 5.481, 6.692 |
| Purple kick | 2.849, 4.494, 6.087, 7.705, 12.572 |

Review used the recording's time/frequency energy around the opening (2–14 s), verse (29.5–33.5 s), later groove (59.5–63.5 s), fill (239.8–241.5 s), snare roll (243.4–244.6 s), and uncertain tails (234.8–235.7 s and 264.3–269 s). Candidate orange notes at 235.283 and 241.432 seconds were removed because the spectrogram showed ringing without a new strike. The short post-performance sound at 268.620 seconds did not support the proposed sustained cymbal identity and was omitted rather than guessed into another color.

A trial excluding all high frequencies from kick templates created false cymbal notes on many ordinary kicks and was rejected. The retained kick examples model their own upper-frequency sound. This fitting method is recording-specific and does not change general transcription rules for other uploads.

## What was checked

Four opening fills use red → red → blue → green. A later six-note fill uses red → red → red → blue → green → green. The later six-note snare roll remains red alone. These 28 reviewed hand hits had 10 completely correct hand-color sets and 25 wrong-color extras under generic version 28 analysis; the matched list has 28 correct sets and zero extra hand colors at those positions. Ten of these positions were also template examples; eighteen were not used as templates. This is a selected-passage comparison, not independent full-song accuracy.

The prior 28 annotated kick/snare/hat/cymbal landmarks remain release gates. Additional checks cover selected verse hats, real crash/kick chords, removal of reviewed tail notes, all-note scoring, exact audio matching, fresh chart copies, upload/rebuild identity forwarding, preview seeking, backup preservation and reopening without reanalysis.

The retained Standard/Expert event list contains 1,275 notes: 298 red, 297 yellow, 14 blue, 88 orange, 32 green and 546 kicks. Warmup contains 522 retained notes. Counts describe the chart and are not proof of transcription accuracy. The whole recording has not been independently annotated; quiet or overlapping voices can still be omitted or misclassified, and some grouped attacks can hide close hits. The chart is described in the game as **In Bloom · Matched drum chart**, not a perfect or official transcription.

## Use and persistence

On version 29, upload the exact WAV with Drums selected, or reopen the existing saved song and rebuild its drum chart. The existing file digest selects this event list. The matched label appears in chart details and survives saving, backups and switching to another cached instrument. Existing stored charts are not silently replaced. Another instrument's chart and the original audio remain intact.


## Revision 2 — supplied score page, Expert and Hard only (game version 33)

The newly attached WAV is byte-identical to the original 48,097,596-byte recording and has the same matching digest. `ffmpeg -i INPUT.wav -ac 1 -ar 22050 -f f32le OUTPUT.f32` recreates the pinned PCM digest `e336157b331730b6ee9448c4e5309f4ef70941bed1867f0b86fd1fdbfb1da390`. The user supplied one 413 × 535 image of score page 1. Its legible steady hi-hat voice supports a focused review of bars 5–14, approximately 15.190–47.442 seconds. The first four intro fills already match the reviewed snare → snare → rack tom → floor tom pattern and are preserved. Later, unshown passages are not filled in from this page.

The revision retains all 1,275 original events and adds **76 yellow hi-hat notes**. Of these, **27** have a distinct quiet treble attack in the WAV. The other **49** represent the score's simultaneous hi-hat voice over existing snare/kick strikes, using the exact existing onset; these overlapping voice assignments are score-supported interpretations, not independently isolated hats. Snare, tom, floor-tom, cymbal and kick notes remain identical. Seventeen uncertain solo-hat positions were left unresolved rather than copying a regular timing grid into cymbal wash. No yellow notes are added to the established snare-only fills near 27.6–27.9 or 40.5–40.8 seconds.

`tools/inbloom-score-review.json` records the bounded bar anchors, accepted event times, whether each hit is an independently measured treble attack or a score-supported overlap, treble measurements and unresolved positions. Strong existing hand attacks and measure starts align the score with this performance; the printed tempo is not used to replace the recording's drifting timing. For quiet attacks, review used a third-order 3500 Hz high-pass filter on the pinned PCM, 22-sample power frames, a four-frame RMS average and four-frame positive difference. Within −85/+65 ms of the score position, the candidate needs RMS rise ≥ .0014, early/pre-attack power ratio ≥ 1.2, a decaying short-noise envelope, and no recent crash wash. The onset is the leading 40% rise, not the quantized score position. Selected onsets at 16.532, 17.317, 20.575, 30.184, 33.411 and 35.430 seconds were checked separately against first-difference treble energy; each has more than double the preceding local treble power.

This is a conservative score-guided approximation. The small image does not resolve every articulation and the source separation cannot prove every simultaneous voice. No complete hand transcription or exact sheet-music reproduction is claimed.

Runtime keeps the original event table as the lower-level baseline and appends reviewed events only to Expert. Hard is reduced from that Expert by the existing difficulty rules. New uploads have **522 Easy / 916 Medium / 1,310 Hard / 1,351 Expert** notes. Hard has 41 fewer notes than Expert. Easy, Medium and hidden Normal are byte-for-byte unchanged from version 32. Existing saved songs preserve their own Easy, Medium and hidden Normal arrays on instrument rebuild, selected/whole-part rebuild and same-audio reupload; their original audio and other cached parts remain intact. Revised Expert/Hard scores use a new personal-best key, leaving lower-level scores unchanged.

`tools/apply-inbloom-score-review.py --output PATH` renders the pinned additions into the runtime file without rewriting the original table. The older authoring tool still reproduces that original table from the exact PCM. The score image, WAV and temporary analysis plots are excluded from the published game and GitHub.


Final revision-2 verification: **162 tests passed, none failed or skipped**, using the exact uploaded WAV and pinned PCM. Quiet-onset checks, complete Easy/Medium/Normal snapshot hashes, all-note scoring, original audio byte preservation, fresh reopen, portable backup and five update routes pass. Both authoring tools produce a byte-identical runtime reference file. The overlap assignments remain score-informed estimates and were not independently isolated in the audio.


## Revision 3 — clearer score crop (game version 34)

The user supplied a clearer crop covering intro bars 1–8 and the first four verse bars. It resolves open-hi-hat circles and grace notes that were indistinct in the earlier small image. The lower vocal/melody systems are not treated as drum notes. Review was bounded to the same original WAV; no new audio, score image or analysis plot is published.

Expert now adds **11 separate same-drum second strokes** in the opening flams: six red snares, four blue rack toms and one green floor tom. The original leading strikes remain at their measured times. The new second attacks occur 20–41 ms later, at 4.128, 4.325, 4.707, 7.333, 7.525, 7.936, 8.308, 10.594, 11.190, 14.021 and 14.417 seconds. Neither a regular flam delay nor a color alternation is synthesized. Hard retains the first stroke and omits each of these close second strokes through the existing reduction rules.

For each printed flam, review compared the waveform and three-millisecond-smoothed RMS in 150–1800 Hz body and 2000–8000 Hz treble bands. A secondary positive rise was inspected within 16–55 ms of the first onset. The leading 40% rise, minus 1 ms, supplies the candidate time. Power from +2 to +10 ms must exceed power from −10 to −2 ms by at least three times in both bands. Eleven positions passed. Five printed articulations did not give sufficiently distinct evidence and were left as single notes. A separate test uses the unfiltered PCM and its first difference; all eleven new attacks exceed the preceding local power by more than three times in both measurements. This is evidence for these selected strokes, not proof of every grace note in the performance.

Five **open yellow hi-hat overlaps** are added at the existing snare times: 3.051, 6.265, 9.504, 12.754 and 40.488 seconds. These are score-informed simultaneous voice assignments, not independently isolated hats. The last overlap corrects revision 2's blanket exclusion of yellow throughout that verse-ending fill: only its indicated first fill stroke carries the open hat. Subsequent snare hits at 40.681 and 40.779 seconds stay red alone. The separate fill near 27.6–27.9 seconds remains unchanged. Quiet solo hats hidden by crash wash are not filled from a timing grid.

Two yellow notes at 3.243 and 9.702 seconds are removed from Expert/Hard, while their kicks remain. The clearer score has no hi-hat at these kick positions. Audio review showed brief high-frequency kick clicks without a new sustained treble envelope; 18–45 ms treble power was only 0.994 and 1.098 times the preceding 25–5 ms baseline. Other hats, all 76 earlier score additions, all orange cymbals, all kicks and later unshown fills remain intact.

New totals are **522 Easy / 916 Medium / 1,313 Hard / 1,365 Expert**. Expert contains 304 red, 376 yellow, 18 blue, 88 orange, 33 green and 546 kick notes. The net change from revision 2 is +14 notes (16 added, two removed); Hard gains three. Easy, Medium and hidden Normal remain byte-for-byte unchanged. Consequently their two older yellow positions can remain present even though the corrected Expert no longer contains them; upper-only correction intentionally does not enforce a new cross-level subset relationship on preserved lower charts. Hard remains an exact subset of corrected Expert.

The authoring JSON retains revision 2 decisions and appends a `closeUpReview` with each addition, removal, measurement and unresolved articulation. Its renderer emits a separate correction overlay. The original 1,275-event table is never rewritten by that overlay, so saved lower-level charts continue to use their original baseline. Rebuild/reupload applies the revised Expert/Hard only when the WAV identity matches. A persisted score revision gives revised upper charts their own personal best; previously saved revision-2 upper charts keep their previous key until rebuilt. Lower-level and other-instrument scores retain their existing keys.


Final verification: **165 tests passed, none failed or skipped**, with the original WAV and pinned PCM (83.5 seconds). All corrected onsets/colors, close-stroke scoring, Hard reduction, original lower-array hashes, five saved-song update routes and persistence regressions pass. Both authoring tools reproduce the runtime reference byte-for-byte. JavaScript syntax, the entrypoint and local asset references also pass.
