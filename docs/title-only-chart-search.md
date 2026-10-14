# Title-and-artist song search — version 94

Add song accepts a song title and artist without requiring an audio upload or another song to be open. Find chart & audio locates a supported chart conversion, retrieves its bundled music when available, and saves the playable song and chart to the device's setlist. Audio uploads require a verified own-instrument recording match before community notes are applied, with exact-recording reuse and independent audio-analysis fallback.

## Source selection

The bounded catalog search uses separate exact title/artist fields, with Neversoft and, for missing Guitar, Harmonix queries when recognized game sources are absent. A single general search page can recover spelling/indexing variants; exact normalized title/artist checks still control imports. At most three initial pages, two charter pages, one exact instrument page per missing requested part, and one general fallback page are searched. Missing-part queries target the Clone Hero catalog’s instrument field, without requiring a drum quality-review filter. Catalog groups may expand beyond the requested page size, so responses permit up to 1,000 chart rows within an 8 MB byte bound. Numeric found counts guide pagination.

Known Guitar Hero conversions rank ahead of ordinary community charts. GH1–3 and other guitar-only sources cannot provide Drums, Bass or Vocals. Each supported part comes from its actual MIDI or chart section. Version 92 supports five-lane drum sustains and MIDI drum-roll modifiers with explicit tap-based roll windows, so those features no longer prevent bundled-audio retrieval. Source setlist labels and charter credits persist in chart details, saves and backups. Conflicting recognized game labels in the catalog and downloaded package are rejected. Source labels describe catalog/package claims rather than independently authenticated original-game membership.

When audio is requested, the accepted chart parts come from one package. Missing instruments are reported, and notes from another package are not joined to this package's recording. Existing authored difficulties and derived missing levels retain their note timing, colors and holds. No audio estimates are generated without an audio recording. If the selected package provides full song audio, missing requested parts can be estimated independently from that recording; other parts’ authored notes are never substituted.

## Matching audio

The accepted SNG file table identifies music stems named song, guitar, rhythm, bass, vocals, keys and supported numbered drum/vocal stems. Preview clips and crowd audio are excluded. Only ranges inside that selected package on the existing files.enchor.us host are fetched. Audio access blocks stop the fetch; no alternate host or unrelated recording is substituted.

Up to 16 music tracks and 80 MB of encoded audio are accepted. The download phase has a 90-second timeout and shares the UI's cancellation signal. Stems are decoded sequentially, require supported channel/sample-rate bounds and close agreement with the 5-second–8-minute catalog recording length, and retain their common time zero. Browser offline decoding resamples to 22,050 Hz when supported. Stereo channels and all accepted music stems are combined, with global peak scaling only when needed to prevent clipping. The final stereo 16-bit WAV remains below the existing 80 MB song limit and is checked by the playback decoder before becoming the current song.

The playable audio is saved with the normal SHA-256 audio identity, chart references, source file names and waveform. Reopening needs no repeat download; riffpack backups include the playable audio. Existing charts for that exact saved audio are retained outside the requested parts. A replaced chart-only copy is removed only after the audio-backed song saves successfully and the fetched parts cover all of its old parts; unrelated chart-only work is kept.

Audio and notes originate from the same package. This is not an independent waveform timing review: package provenance is recorded separately and timingVerified remains false. Preview is available to check the source arrangement. Own-instrument waveform comparison for normal audio uploads remains separate, and its temporary reference stems are not saved.

## Missing-chart audio fallback

Instrument availability no longer blocks full-song audio discovery. After the bounded authored search, an exact title/artist package covering another instrument can supply its music when no supported requested chart was found. The same identity, setlist, host, file, size and time bounds apply. Only a full mix or supported set of music stems is accepted; an isolated Guitar file cannot pose as the song. Packages with unusable audio may be skipped within the existing four-candidate limit. Access/rate blocks stop requests. No audio source is inferred from a chart’s Guitar notes.

The UI decodes and validates the actual package audio before running independent analysis for each missing requested part. A missing Drum arrangement runs the Drum analyzer on its own package’s named Drum stems when available. Only its own percussion is combined for that input; the full song remains the playable audio. Without Drum stems, full-song isolation checks remain the estimated fallback. Its estimated status and audio identity are saved, with no borrowed Guitar import hash, reference, timing or verification receipt. Existing authored parts remain authored, and unavailable estimates are named. If no requested part can be built, or its audio fails, the current song stays intact. Cancellation during audio or analysis retains the current song. Same-audio saves preserve other parts and keep one setlist entry.

For Wasteland / 10 Years, the live catalog returned Zantor’s Guitar-only chart (`77de5bbb3f84927bd417abe4b3c0dfe5`), with a full song.opus and no catalog Drum track. The explicit Drum query returned zero. Its source audio was downloaded and mixed into a valid 20,460,092-byte, 231.973333-second stereo WAV. The production analyzer detected 1,450 Expert/legacy Normal Drum events, with 1,073 Hard, 682 Medium and 424 Easy. These are audio estimates, not a fetched Clone Hero Drum arrangement or a verified transcription of every percussion strike. No commercial audio is bundled into the deployed game.

## Uploaded-recording matching

Every fresh community lookup for uploaded audio requires its own instrument’s waveform match. Matching title, artist and duration alone cannot authorize Guitar Hero or community notes. The source part’s temporary stems are compared with the actual upload in separated windows; only a stable match may import and shift that part’s notes and tempo-map base. Guitar evidence cannot verify Drums, Bass or Vocals. Missing stems, wrong recordings, weak or drifting matches use independent analysis of the original audio. Each instrument remains separate.

Automatic authored reuse checks the exact audio hash and recording duration. A community part also needs recording evidence for this exact hash and instrument, or a matching receipt tying both its notes and playable audio to the same downloaded package. Older unverified community charts are checked again when rebuilt. Manually imported charts remain reusable for the same audio, and opening a saved song alone does not replace its notes or audio.

## Audio-unavailable fallback

Missing, isolated-only, silent, wrong-length, oversized, blocked or undecodable bundled audio leaves the supported chart saved as chart-only with an actionable status. A chart-only entry uses zero audio chunks, previews notes without music and can later attach matching local audio. Normal missing-audio corruption checks still apply to audio-backed songs. No match or cancellation keeps the previous song and saved setlist intact. Save failure permits playback/export and persistence retry without another search.

## Validation

Live checks fetched King Nothing and Wherever I May Roam drum charts from their Neversoft Guitar Hero: Metallica conversions. Version 90 additionally fetched King Nothing's eight music tracks (backing, Guitar, Bass, Vocals and four Drums) and used the production mixer to produce a 29,416,400-byte, 333.518776-second stereo PCM WAV. FFmpeg decoded each source stem; ffprobe verified the resulting 22,050 Hz stereo WAV. This live check used FFmpeg as the decoding adapter and does not establish physical-browser behavior on every device.

Version 91 additionally compared that mixed King Nothing WAV against its four own Drum stems with the production recording matcher: four separated windows verified the recording at zero offset. This validates that example, rather than every uploaded mix.

Ten new recording-match regressions use real waveform features, matching, SNG/MIDI parsers and upload handlers. They cover equal-title/equal-duration wrong recordings, missing stems, cross-instrument proof, padded recordings, original audio preservation, fallback and cached receipt boundaries. Positive parser/UI fixtures explicitly mock a verified provider; the new waveform checks run the real matcher.

Deterministic checks exercise real SNG/MIDI parsers, range unmasking, the audio mixer and UI/IndexedDB handlers. They cover desktop/mobile search with audio, playable save/reopen, exact audio backup bytes, whole-song source boundaries, repeated-search deduplication, preserved other charts, stereo/frequency mixing, attack timestamps, clipping bounds, audio limits, missing/invalid audio fallback, cancellation and chart-only persistence. Original audio uploads and offline runtime assets retain their regression checks.

Version 93 adds 11 passing audio-fallback regressions. The 167 affected chart, alignment, backup and offline/update checks passed 166 with one optional reference WAV skipped; the final 77-check release run passed 76 with that optional WAV skipped. The actual-source mobile adapter downloaded Wasteland’s song.opus, ran the production Drum worker, saved its exact WAV, round-tripped a backup and reopened without analysis. Browser decoding was modeled with the actual FFmpeg-decoded source and waveform; physical-browser behavior is not claimed. Runtime syntax, asset paths, HTML IDs and whitespace checks pass.

API contracts were checked against Geomitron/Bridge's src-shared/search-api.ts and src-angular/app/core/services/search.service.ts. SNG parsing continues to use the independently implemented documented container format.
