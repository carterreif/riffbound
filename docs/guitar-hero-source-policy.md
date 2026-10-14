# Guitar Hero source selection — version 85

Future uploads with community lookup enabled search the existing enchor.us catalog for the supplied title and artist. Matching Guitar Hero conversions rank ahead of ordinary community charts. The game label describes the package's claimed source; it does not establish authenticity. There is no bundled catalog of copyrighted game songs or new audio download feature.

## Instrument and recording rules

- Guitar Hero 1, 2, 3 and their recognized conversion aliases supply Guitar only. Rocks the 80s, Aerosmith and On Tour sources also remain guitar-only, even if catalog counts incorrectly claim other instruments.
- World Tour, Metallica, Smash Hits, Guitar Hero 5, Van Halen, Warriors of Rock and Band Hero can supply Drums only when the package contains a supported drum track. Guitar notes are never substituted for Drums.
- Each requested instrument is parsed independently. Authored difficulties are retained, missing levels are derived, and missing parts use independent audio analysis. One song may retain different chart sources for different instruments.
- Exact normalized title and artist matching, recording-length limits, supported formats, download bounds and per-part recording evidence still apply. Guitar-only game conversions additionally require that Guitar's own reference waveform verifies the uploaded recording; a same-length cover is insufficient.
- Game labels and charter credits are stored with imported chart details and references, including saves and backup round trips. Current saved charts, offsets and audio remain intact. Exact-recording authored reuse still precedes an online lookup.

## Bounded search

The general title/artist search reads at most three pages of 50 entries. A short result is complete and requires no extra game query. When all three pages are full, a Guitar or Drums request adds one Neversoft query; a Guitar request can also add one Harmonix query. Developer names narrow the search but never establish a game source on their own. Recognized source icons and package/folder labels identify candidate game conversions.

All requests use the existing catalog and file hosts, cancellation, timeout and byte budgets. At most four ranked packages are tried. HTTP 401, 403 or 429 stops the lookup; there is no alternate host retry. Reference stems used for recording comparison remain temporary and are excluded from saved songs and backups. Network failures or unsuitable matches retain the existing audio-charting fallback.

## Validation

127 targeted checks passed, with two unrelated fixture skips, plus eight upload-flow checks. Tests exercise source aliases, misleading metadata, missing drum tracks, independently sourced whole-song parts, bounded supplemental searches, access blocks, recording verification, game credits, backup round trips and future desktop/mobile uploads that reopen without reanalysis. These use real chart/SNG parsers with synthetic network, DOM and audio adapters; they do not establish availability of every game chart or physical-browser behavior against the live catalog.

## Primary metadata references

- [Bridge search request schema](https://github.com/Geomitron/Bridge/blob/master/src-shared/search-api.ts)
- [Bridge catalog result interface](https://github.com/Geomitron/Bridge/blob/master/src-shared/interfaces/search.interface.ts)
- [Bridge game source labels](https://github.com/Geomitron/Bridge/blob/master/src-shared/setlist-names.ts)
- [YARC OpenSource game icon catalog](https://github.com/YARC-Official/OpenSource)
