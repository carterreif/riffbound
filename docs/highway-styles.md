# Highway styles — version 128

Choose **HIGHWAY STYLE** in Soundcheck, directly above **Backgrounds / video**.
The dropdown contains Riffbound Original and twelve game-inspired designs:

| Style | Surface |
| --- | --- |
| Guitar Hero I | Vintage wood grain |
| Guitar Hero II | Road-worn flames |
| Guitar Hero Encore: Rocks the 80s | Purple neon |
| Guitar Hero III | Iron and fire / lightning borders |
| Guitar Hero: Aerosmith | Silver wings |
| Guitar Hero World Tour | Brass stage chevrons |
| Guitar Hero: Metallica | Brushed steel and rivets |
| Guitar Hero Smash Hits | Starbursts |
| Guitar Hero 5 | Studio / vinyl grooves |
| Guitar Hero: Van Halen | Diagonal stripes |
| Band Hero | Blue spotlight diamonds |
| Guitar Hero: Warriors of Rock | Carved green runes |

These are original procedural designs inspired by game eras, not extracted or
identical official highways. Game titles identify the inspiration. No game logo,
texture download or external graphics request is involved.

The same dropdown and all options are available for Guitar, Drums, Bass and
Vocals. The selected style applies globally to all instruments and songs, and
saves as `highwayStyle` in the existing local preferences. Existing timing,
speed, audio and upload preferences are retained. Unknown/deleted IDs fall back
to Riffbound Original. A failed storage write reports that the selection is only
for the current visit. Highway choices are browser preferences, not chart data,
and are not included in riffpack backups.

A change takes effect on the next draw without restarting playback, recreating
the scoring session or changing notes, lanes, difficulty, hit windows or video.
Four-lane drums keep Red/Yellow/Blue/Green; five-lane drums keep a separate Orange
cymbal and Green floor tom. Vocals retain the existing pitch-pad gameplay.

The renderer changes the highway's surface, motifs, rails and beat-grid tint.
Decorations are clipped to the existing perspective trapezoid and drawn beneath
notes, lane feedback, holds, rolls and the hit line. Each frame has a bounded
number of vector paths and uses no image/network decode. Reduced motion freezes
the decorative scrolling. The original highway retains its previous palette.
The new module is included in the offline package.

Verification covers every style's finite/bounded/clipped drawing output and
reduced-motion stability; the production dropdown, persistence and restoration;
and actual gameplay scoring while cycling every style for all four instruments
and both drum layouts. A contact sheet rendered with the production surface
renderer and note-head drawing was visually inspected for contrast/readability.
The supervised browser preview could not start because its sandbox could not
mount proc; full browser layout verification remains unavailable here.
