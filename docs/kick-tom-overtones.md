# Kick/floor-tom collision repair (v140)

The supplied Wastedyearstake2 backup contains a 207.67483-second recording with 1,406 Expert Drum notes. Its metadata confirms six-source Demucs isolation was used before the revision-27 estimator. All 252 green floor-tom candidates coincide with a kick within 35 ms. The existing independent-body check accepted any fresh spectral peak from 68–150 Hz, including a kick's higher resonating modes.

The new estimate-only final check requires a concurrent green candidate's strongest pitched mode in that band to remain stable through 25, 65 and 145 ms windows. A descending upper kick mode no longer supplies a second physical pad. It does not alter kicks, other pad colors, note times, or toms outside the kick-collision window. Stable independent floor-tom bodies alongside kicks remain accepted. The policy is `independent-persistent-body-v1` in the Drum audio review. This is a conservative signal rule; weak, masked or strongly pitch-bending real floor toms may be omitted. It does not establish a complete ground-truth transcription.

The uploaded recording was decoded locally and its Drum signal re-extracted across the entire song using the pinned six-source model and original sample-clock overlap-add. The model, source audio and separated PCM are not shipped with the game or committed to the repository. Only the generic filter and optional corpus test are shipped.

For the supplied backup, apply the filter to each existing difficulty without rebuilding the other notes:

| Difficulty | Before | After | Removed green/kick overlaps |
| --- | ---: | ---: | ---: |
| Easy | 511 | 408 | 103 |
| Medium | 720 | 576 | 144 |
| Hard | 1,076 | 879 | 197 |
| Expert / Normal | 1,406 | 1,165 | 241 |

All 318 Expert kicks, 212 snares, 339 yellow, 18 blue and 267 orange notes remain exactly as supplied; 11 green notes pass the new evidence check. Keeping these notes does not independently validate them. Original audio bytes retain SHA-256 `e74c0f2893d7d41598e9a7f50ad6a224a810da4cecf8e24f93f0882c01fcdd7e`. The corrected portable backup round-trips through the normal library validator, preserving every retained note and the original recording. Import that repaired backup to update this saved chart. Existing device-local charts are not silently edited by a game update.

Validation: dedicated synthetic cases reject sweeping kick modes while preserving genuine simultaneous pitched toms and unrelated pad/tom events; the actual uploaded corpus check runs with `RIFFBOUND_WASTED_ROOT`. Existing bass-masked Drums, colors, fast fills, overlaps and fallback Guitar rejection run: 33 passed, one unrelated unavailable-recording skip, zero failures. Upload/rebuild/isolation/cancel/offline/roll checks: 76 passed, one corpus skip before the supplied separated PCM was ready, zero failures. A final separate corpus run passed all four collision tests. Browser playback and exhaustive human annotation of every hit were not available.
