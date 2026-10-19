# Additional automatic Drum sources (v134)

Riffbound now searches two reviewed publisher collections after Chorus Encore fails to supply the requested authored Drums: **Onyxite published customs** and **Grinnz / Onyxite**. Both use the publisher's public source repository at https://github.com/mtolly/onyx, pinned to revision `be402a777cb668fb9133471030c055c5e6956e3e`.

The metadata catalog contains 50 compatible Drum sources. It is an additional source collection, not a claim that 50 songs are absent from Chorus Encore. Selection starts from the publisher's 81-song published website list, resolves metadata includes, excludes alternative MIDI inputs and Drum layouts that need build-time transformations, and validates each remaining MIDI with Riffbound's existing importer. Freestyle endings, disco-flip charts, missing standard Drum tracks, files exceeding the event limits and tracks over 15 minutes remain excluded. The published runtime bundle contains title/artist/author/source/count/duration/receipt metadata only, not the original MIDI or audio.

At runtime, exact normalized title and artist select at most three candidates. Only the reviewed source path under the pinned mtolly/onyx revision is fetched; the user cannot provide an arbitrary URL. Each MIDI has a fixed byte length and SHA-256 receipt. Bounded streaming, the existing MIDI parser and arrangement validation check the actual Drum track before import. Native browser fetch uses credentials:omit and no-referrer. Actual GETs with the Riffbound Origin returned HTTP 200 and Access-Control-Allow-Origin: * for both source groups.

Examples verified live:

| Title | Artist | Source | Expert Drum heads |
| --- | --- | --- | --- |
| Constant Motion | Dream Theater | Onyxite published customs | 3553 |
| This Dying Soul | Dream Theater | Grinnz / Onyxite | 5755 |

## Chart-only contract

The GitHub source projects supply authored MIDI, not downloadable recordings. A title-only Drum search can download and save the authored chart, with source credit, original tempo map, practice markers and four-lane mapping. Expert notes are retained; missing lower difficulties are derived through the existing arrangement builder and labeled as derived. This is not a new audio estimator or Guitar-to-Drums conversion.

A Guitar-only package may have offered a full recording for an estimate. When switching to an independent additional Drum source, that unrelated recording/container is discarded and the result explicitly becomes chart only. It is never joined to the new notes based on title or approximate length. Working authored parts are preserved; the extra source is listed rather than silently replacing them. Uploaded audio is not approved using filenames or MIDI onsets: without a source recording for waveform comparison, the lookup reports availability but keeps its existing chart/audio behavior. Chart-only songs can attach an appropriately matching recording in Manage songs and need timing preview. Source project padding can differ from a retail recording.

The existing authored-chart search preference controls additional checks for audio uploads. Title-only Find chart & audio continues its explicit online search behavior. Existing Drum charts, unrequested Drums, selected local community packages and unknown catalog identities skip the extra fetch. Abort, timeout, network/format/receipt errors and HTTP access/rate blocks return the earlier result intact. The browser's device-local songs/backups retain the per-part source and additionalDrumCheck receipt.

## Provenance and verification

Primary publisher references:

- https://onyxite.org/customs/
- https://github.com/mtolly/onyx/blob/master/README.md
- https://github.com/mtolly/onyx/blob/be402a777cb668fb9133471030c055c5e6956e3e/website/songs.yml

The publisher licenses their own transcriptions under CC BY-SA, while explicitly noting other authors' work may have different terms. Individual source authors and the original project URL remain in each reference; this release does not bundle/rehost their MIDI files or recordings. The compositions remain their original authors' works.

All 97 focused checks passed. Validation includes all 50 actual downloaded MIDI files: SHA/length, authored difficulty head counts, original tempo duration and four-lane strikes. Controlled desktop/mobile UI tests cover title-only automatic retrieval, chart-only save/playback status and backup provenance. Other tests cover identity boundaries, opt-out, existing charts, refusal to borrow another recording, malformed/changed files, blocked hosts, cancellation and preservation of previous results. Actual browser UI/playback remains unverified because the preview environment is unavailable.
