# Learning and timing tools

Version 110 improves practice and hit feedback in response to player reports about Guitar Hero. These reports identify recurring friction, rather than a statistical ranking of complaints across all games or platforms.

- [World Tour players describe practice loading, awkward section restarts and requests for looping](https://gamefaqs.gamespot.com/boards/944203-guitar-hero-world-tour/47272977). [Other players report similar speed/section-change friction](https://gamefaqs.gamespot.com/boards/944203-guitar-hero-world-tour/46538504).
- [Activision's Advanced Calibration guide](https://support.activision.com/guitar-hero-live/articles/advanced-calibration-for-a-guitar-hero-live-controller) acknowledges early/late notes and input-registration difficulties. [Player reports describe inconsistent calibration and uncertainty about hit timing](https://www.reddit.com/r/GuitarHero/comments/1lgrsqu/).

Riffbound already offers no-fail play, custom controller mapping, timing calibration, independent highway speed and looping practice. This release extends those features instead of altering instrument colors, authored charts or scoring windows.

## Practice the last miss

During a scored run or practice pass, the game remembers the latest missed note for the current song, instrument and difficulty. Open Practice and select **Use last missed section**, or choose **Practice last missed section** on the results screen. The suggested eight-second window includes up to three seconds before the note and is adjusted to fit the recording. Review or edit the start/end times before starting. Changing songs, instruments, difficulty or chart data clears the suggestion. Preview autoplay cannot generate a missed-note suggestion.

Practice speeds range from 25% to 100% in 5% steps. Slower playback lowers audio pitch, as the existing playback implementation does; this is disclosed beside the control. Practice uses the loaded chart/audio buffer without downloading, decoding or recharting for each attempt. Looping practice remains excluded from personal bests.

**Retry**, or **R** outside text inputs and dialogs, starts a fresh run with a new count-in. In practice it preserves the section and speed, including from pause. During a regular run it starts the track at the beginning with a fresh score. Ctrl/Command/Alt+R and repeated keydown events are left alone. Retry prepares the video's matching frame and preserves its original full-chart first-note anchor.

## See successful hit timing

Successful hits display **EARLY**, **LATE**, or **ON TIME** beneath the existing judgment. The display uses real milliseconds after the current calibration and accounts for slowed practice speed. Within approximately 20 ms is labeled on time; the existing Perfect/Good scoring thresholds stay unchanged. Misses and extra strikes have no inferred timing estimate. Extra drum roll taps do not create timing samples. Turn live feedback off using **Show early/late feedback while playing** in Timing; the preference saves on this device.

After at least eight successfully hit notes, results report median note timing and early/on-time/late counts. Chord notes count as notes. This describes successful hits in that run, not all physical taps and not a measured device-latency diagnosis. It neither changes calibration automatically nor replaces the existing tap test. Preview does not generate timing samples.

## Verification

Deterministic engine and game/DOM/audio tests cover all instruments, strummed chords, drum rolls, early/late signs, calibration, fractional practice speeds, fresh retry scores, missed-note selection, dialog/input shortcut isolation, saved preferences, video preparation and older HTML missing the new controls. Existing gameplay, controller, offline, storage and background-video suites also pass. Actual browser rendering, physical controllers and video codecs were not inspected in this environment.
