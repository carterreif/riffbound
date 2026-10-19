# Wasteland — 10 Years (v133)

The live Chorus Encore catalog on 2026-10-19 returns only Zantor's Guitar chart (`77de5bbb3f84927bd417abe4b3c0dfe5`, 755 Expert heads). Its sole music file is a full recording, `song.opus`; there is no authored Drum part. Title-only Drum lookup therefore retrieved the audio and estimated percussion. Running estimator revision 27 on that recording produced 1,447 guessed heads, including notes during the opening Guitar passage. This explains the reported behavior without claiming the user's saved chart has been inspected.

A separate public community source was verified on RhythmVerse:
https://rhythmverse.co/songfile/60ba773570ce4241aab2aa5c5b99bed4

The package's internal author is Elite42069 (uploaded by elitestar8829), and its metadata identifies Wasteland by 10 Years, The Autumn Effect. It contains separate Guitar, Bass and Drums MIDI tracks plus a plaintext, unencrypted ten-channel Vorbis recording. No decryption or general console-package reader is added. Vocals are not advertised: this MIDI's unpitched syllables are unsupported.

Authored Drum heads: Easy 386, Medium 467, Hard 777, Expert 1239. First Drum attack is at 19.729932 seconds; the Guitar part begins at 6.575344. Four-lane colors and kick come from the MIDI, with Pro cymbal/tom metadata retained. The source's own audio and MIDI share time zero. These source offsets must not be applied to a different recording without waveform verification.

## Download and local import

The source host returns no Access-Control-Allow-Origin for the Riffbound origin. Browser fetch cannot read this package. Do not claim automatic retrieval works or add an arbitrary third-party proxy. In Add a song, a direct link uses the source host's normal download. The player selects that downloaded file in **Community package**, chooses Drums, and presses **Import package & audio**. Title and artist may be omitted because the reviewed package supplies them. A mismatched entered identity is rejected. New audio comes from that package; the older estimated song entry is not deleted.

Only this exact reviewed package is accepted. Its full 19,738,624-byte SHA-256 and each extracted MIDI/Ogg receipt are verified before use. Fixed file spans strip the plaintext MOGG header and interspersed container hash tables. The package, chart and audio bytes are not bundled in Git or the published game. Imported bytes remain local and are held in a WeakMap for the current operation; authored notes and mixed audio save through normal song persistence. Invalid, changed or truncated files cannot substitute chart data.

The full-band mix supports up to 16 decoded channels, retaining the existing even/odd stereo-pair downmix and time zero. The usual duration, sample, peak and 80 MB song constraints remain. Title-only lookups can report the reviewed authored source but direct users to the manual package import rather than claiming an unavailable automatic download succeeded.

## Validation

The actual downloaded file passed the package and extracted-file receipts. MIDI imports retain all four Drum difficulties and their original timing. All 87 focused checks passed. Tests exercise real-source import, instrument separation, no catalog/network calls for a selected file, local desktop/mobile Add a song handlers, save provenance and matching package audio, rejection of unknown/changed files, ten-channel stereo mixing and existing Chorus/ZIP/song-audio/update behavior. Real-source tests use RIFFBOUND_REVIEWED_SOURCE and keep the copyrighted fixture outside the repo. Their UI decoder is a controlled fixture; actual browser decoding/playback remains unverified because browser preview infrastructure is unavailable. ffprobe independently validated the extracted Ogg: Vorbis, 10 channels, 44.1 kHz, 239.018957 seconds including padding.

STFS layout was inspected using primary format references:
https://free60.org/System-Software/Formats/STFS/
https://github.com/hetelek/Velocity/blob/master/XboxInternals/Stfs/StfsPackage.cpp
Runtime extraction uses reviewed byte spans and full receipts rather than executing or exposing a general filesystem reader.
