# Chorus Encore drum checks (v130)

The existing online chart provider is Chorus Encore (`api.enchor.us`), the catalog behind Riffbound's Clone Hero search. Add a song now names that provider explicitly. With online lookup enabled, uploaded songs and title/artist discovery request a separate exact-title/artist Drum search, including charts without a quality-review badge. This runs even when a general result already claims to include Drums. Up to three instrument-filtered pages are searched, within the existing timeout, response-size and candidate limits.

The result distinguishes imported Drums, a catalog listing for an unselected Drum part, a listed chart that could not be imported, no matching listing in searched results, and an incomplete online check. The status is shown with the chart result and saved in `quality.onlineLookup.drumCheck`, including backups. A known direct community-pack source retains its existing path and is identified separately.

Only requested parts are imported. A catalog flag is insufficient: the MIDI or .chart must contain supported Drum notes. Uploaded audio still requires independent recording verification before any authored chart can replace its estimate. Community Drums retain their four-pad default; Guitar Hero drum conversions retain five lanes. This change does not upload recordings or relax title/artist/version matching.

Regression coverage includes misleading instrument metadata, dedicated Drum search pagination and limits, community listings without review badges, Guitar-only selection, unverified audio rejection, access failures, real desktop/mobile upload/save flows, title-only package audio, and backup round trips. Browser preview infrastructure is unavailable in this environment; live catalog availability and browser rendering have not been verified here.

Provider references: https://www.enchor.us/ and https://github.com/Geomitron/Bridge/blob/master/src-shared/search-api.ts
