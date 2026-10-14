# Authored charts on future uploads

Version 68 keeps a working authored arrangement when the same audio is uploaded again, for Guitar, Bass, Drums and Vocals. This extends the authored-first flow rather than promoting an audio estimate to an authored chart.

1. Match the uploaded audio's exact SHA-256 to the current or saved song, with a decoded-duration tolerance of 20 ms.
2. Reuse each requested, valid authored part from that song. Preserve its complete difficulty arrays, source credit/import identity, instrument-specific tempo map, and manual timing adjustment. Estimates do not qualify.
3. Search the existing Clone Hero community catalog only for missing requested parts, when enabled and a title/artist identity is available. Parse the requested MIDI/.chart instrument separately. Author-supplied difficulties are kept; missing difficulties are reduced from an available authored arrangement by the existing import workflow.
4. Automatically chart only remaining unsupported/unavailable parts, with the existing estimate labels and preview. A missing Drum chart cannot receive Guitar notes.

Same-recording reuse works without a new online fetch and is stored in the normal setlist/backup metadata. Source information survives backup import/export and fresh reopening. Lookup identity is retained so adding another instrument to a renamed saved recording can search its correct title and artist. The explicit Find community chart action requests a fresh search; explicit audio rebuild remains available. A different recording or encoding does not reuse local notes merely because its filename or duration is similar.

The Hero of the Day version 67 reference stays available for its verified recording. Nothing copies that song's notes into other songs. The existing public demo setlist and personal audio storage remain unchanged.

The catalog cannot provide every song/instrument. Vocals require a supported pitched vocal MIDI track. Unsupported open-note/drum layouts and unavailable recordings are reported instead of being treated as exact authored notes. A community title/artist/length match still needs timing preview, unlike the waveform-verified Hero reference.

Verification exercises each of the four parts on both desktop and mobile UI adapters, including first authored download, offline reupload under another filename, portable backup round trip and a fresh session. It also tests partial whole-song lookup, distinct audio with an identical title, malformed imports, independent instrument data, and manual timing shifts without double application. Tests use deterministic catalog/container fixtures; physical-device and live-CDN availability are not established by these tests.
