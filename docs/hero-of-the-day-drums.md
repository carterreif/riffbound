# Hero of the Day authored drum replacement

Version 67 replaces the independently analyzed but guitar-contaminated drum estimate for the supplied Metallica Load Track 6 recording with SingeMFRC's authored Clone Hero Expert Drums. This is a recording-specific reference, not a general claim that audio estimation can recover every drum strike.

Source: [Rhythmverse listing](https://rhythmverse.co/songfile/616d6f0683924a74a7959f8ea7d6815b). Its song.ini identifies Metallica, Load, 1996, Track 6. The listing credits Roadsounder99 for Guitar, and SingeMFRC for added Drums and tempo-map adjustments. Only the Drums part and its tempo/signature data are converted. Neither Guitar notes nor any source audio is shipped in this reference.

The original notes.chart SHA-256 is `0900c9dfb8e074ff39df9668e7fe2f95ef6089536da07dde4ed9c171bf539550`. Pro drum conversion keeps snare red, hi-hat yellow, rack tom blue, cymbal orange, floor tom green, and kick as the independent pedal lane. Two simultaneous source voices which map to the same game pad are coalesced into one playable head. Expert has 1,447 pad hits: 335 snare, 297 hi-hat, 49 rack tom, 384 cymbal, 25 floor tom and 357 kick. Source Expert is retained; Hard (1,366), Medium (722), and Easy (404) are Riffbound reductions, not claimed authored lower charts. All retained notes preserve Expert's colors and times.

## Recording and alignment

Automatic selection requires the exact uploaded audio SHA-256 `b6c80b6694186a1f820f7bdd610a4c41bae0c2437e1f6acfe2e67fb312b42cdd` and decoded duration 261.66857142857145 seconds (tolerance 20 ms). Song names and Track 6 alone cannot select it. Other encodings, isolated drum stems, live performances and recordings continue through the independent lookup/analysis path.

For private QA, the source backing audio was compared to the user's original audio as mono 22,050 Hz PCM. Four-second windows starting at 5, 20, 40, 80, 110, 150, 190, 230 and 250 seconds all gave the same 20,634-sample lead in the source audio, with normalized correlations 0.9596–0.9952. Apply -20,634 / 22,050 seconds (-0.9357823129251701) to source notes and the source tempo-map offset. No time stretch, per-hit snapping, guessed onsets, or added detection colors are applied. The match establishes the recording alignment; it does not certify the charter's every musical decision.

The source's variable tempo map remains scoped to Drums. Existing Guitar notes, Guitar tempo data, audio bytes, and song identity are preserved on upgrade. Player-imported Drums, timing-adjusted arrangements, and other recordings are protected. A generated saved chart upgrades once when opened; new matching uploads load the authored Drums directly. The same page/worker/reference paths are shipped in the mobile offline cache. Normal compatibility notes are replaced with the new Medium arrangement so no stale estimated chart remains.

## Validation

Actual uploaded audio is exercised through the desktop and mobile UI adapters, worker charting, setlist persistence, portable backup round trip, and old-estimate reopen/upgrade. Expert is compared note-for-note to the converted source before backup creation. Automated playback checks every difficulty. Backup verification compares original audio bytes and Guitar charts exactly. Browser/device listening and physical-phone play are not available in this environment.
