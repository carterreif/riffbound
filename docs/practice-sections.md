# Named practice sections

Version 111 adds **Which section do you want to play?** to Practice. Choose a section to fill its start/end times, choose a speed, then Start practice. Options show the section name, time range and note count for the current instrument/difficulty. Sections with no notes are disabled. **Entire song** and **Custom range** remain available.

## Chart sections

The importer now retains `.chart` global `[Events]` entries named `section <name>` or `prc_<name>`, and MIDI `EVENTS` text/marker events such as `[section Verse 1]` and `[prc_verse_2]`. These conventions follow the existing [chart format reference](https://github.com/TheNathannator/GuitarGame_ChartFormats/blob/main/docs/Chart-File-Formats/chart-format/Format-Overview.md) and [MIDI global-event reference](https://solamint.github.io/GuitarGame_ChartFormats/Chart-File-Formats/mid-format/Tracks/Global-Events/).

Names and times are retained in the imported per-part timing metadata. Chart offsets, variable tempos, song.ini delay, verified recording alignment and subsequent manual part shifts all apply to section boundaries with the notes. A section ends at the next marker or the recording end. A sufficiently long gap before the first marker appears as **Lead-in**. Underscores are displayed as spaces. Imported section events also survive authored `.chart` export. Community single-part filtering now retains `[Events]` instead of discarding them.

Older saved imports that never retained section markers cannot recover those labels from their notes alone. Reload the original chart or find the authored chart again to obtain its markers, or name custom ranges below. Songs without usable named sections show generic **Section 1**, **Section 2**, etc. in roughly eight-measure blocks, bounded to 8–128 seconds. These are labeled timed sections and are not presented as detected verses or choruses. The original demo uses its known Intro, Main riff, Breakdown, Guitar solo and Final riff markers.

## Save Verse 1, Verse 2 or other custom names

For an uploaded or opened song, edit the start/end fields and enter a name under **Save this range as**, then select **Save named section**. At least one second must fit within the recording. Reusing a name updates that custom range; it overrides a same-named authored section in the practice selector without changing chart notes or imported markers. Select a saved section and use **Remove saved section** to delete its custom range. Manual edits return the selector to Custom range.

Custom ranges save to the local setlist as song metadata and survive reopening, offline use, ordinary RIFFPACK1 backups and combined RIFFPACK2 chart/video backups. They are common song ranges available to every instrument, while each part retains its own notes and timing corrections. Source chart labels remain per-part. Device storage failures report that the change is only retained for the session, so it can be exported or saved again. Custom ranges do not enter the public song catalog or change audio, difficulty arrangements, scoring or video offsets.

Selected ranges use the existing looping practice transport, 25–100% speed options and count-in. Retry preserves the loop bounds and speed. The video retains its full-chart first-note anchor and follows the selected section's actual song time. Practice does not save personal bests.

## Verification

Parser and deterministic UI/audio/storage checks cover `.chart` tempo changes and offset shifts, MIDI EVENTS text/marker events, community filtering and recording alignment, per-part manual timing adjustments, generic fallbacks, saved overrides, correct loop playback and Retry, custom range validation, persistence through fresh storage connections and both backup formats, deletion and explicit storage failures. Existing chart interchange, community lookup, video, offline, storage and learning-tool checks also pass. Actual browser rendering and physical media/controller behavior were not inspected in this environment.
