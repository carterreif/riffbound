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
