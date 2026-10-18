# Bow Down / Sad To Know import repair (v132)

Live Chorus Encore checks on 2026-10-18 confirmed that both reported titles have authored Drum charts. This release fixes format handling; it adds no song-name exceptions and does not bundle the charts or recordings.

| Song | Catalog source | Play layout | Easy / Medium / Hard / Expert heads |
| --- | --- | --- | --- |
| Bow Down — I Prevail | Hoph2o, community chart | Four pads + kick | 609 / 792 / 1238 / 1437 |
| Sad To Know — Middle Class Rut | Neversoft, `ghwordlc` | Five pads + kick | 637 / 915 / 1157 / 1363 |

Before the fix, Bow Down failed with “Freestyle endings need a chart review.” A complete interior activation-marker window contains no playable heads. The importer now retains the original authored notes and leaves that window empty when there are real notes both before and after it. It still rejects partial uncharted marker windows, final freestyle endings and explicit coda endings. Marker pitches never become drum hits.

Sad To Know failed while reading running-status notes after Phase Shift annotations in other instrument tracks. Catalog MIDI imports now explicitly enable compatibility for the documented legacy chart encoding that retains channel running status over metadata and SysEx annotations. Strict MIDI parsing remains the default. Track/chunk bounds, first-message status, valid data bytes, note pairing, tempo, instrument and unsupported-note checks remain. Compatibility use is returned as a parser warning.

Bow Down's only music asset is `guitar.opus`. Clone Hero/EOF packages can use guitar.* as their single shared recording. That sole-file convention is now supported for package playback and for full-recording verification of an already parsed Drum chart. Preview and crowd files do not count as music. In a multi-stem package, guitar audio cannot replace an absent Drum stem. Shared recordings never supply isolated Drum estimates or create a missing Drum track. Uploaded audio still requires waveform identity; filenames and catalog metadata alone cannot approve it.

Validation: actual downloaded chart files parse with all four difficulty counts matching the catalog; live search/import checks identify four-lane community and five-lane GH layouts. 110 focused regressions passed, covering strict/legacy parsing, empty activation windows, true endings, wrong audio, instrument isolation, package playback, mobile/desktop upload persistence, and updates. Browser preview infrastructure remains unavailable, and the user's uploaded audio has not been supplied for recording-specific timing verification. Existing saved estimates need **Repair this drum chart** to replace their notes.

Primary format references:

- https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/mid-format/Format-Overview.md
- https://wiki.clonehero.net/books/clone-hero-manual/page/common-issues
- https://github.com/cincodenada/editor-on-fire/blob/master/bin/manual/functions.htm

The actual MIDI files used for local inspection are transient analysis inputs, outside the repository and publication archive.
