# Song backgrounds

Version 104 adds **Backgrounds / video** at Soundcheck. Choose the Riffbound concert stage, a dark stage, or a local video. Open a song first to customize its background. Iron Voltage has its own selection too.

Choose your own Guitar Hero gameplay footage, concert clip or music video. MP4 and WebM are recommended; other formats depend on the browser's codecs. Files must be non-empty and at most 500 MB. No Guitar Hero footage is bundled or downloaded automatically.

Video is always muted. The game's original song audio remains the playback clock and the chart stays above the video. Video darkness can be adjusted from 0–80%; the highway keeps its opaque surface and foreground pads. Choosing a video disables the hidden animated-band draw loop.

**Video position at song start** is an offset in seconds. Enter 10 to skip a ten-second video intro, or -4 to hold the first frame until four seconds into the song. This setting never changes chart notes or scoring timing. Opening the chooser pauses a running track. Count-ins hold the selected starting frame; preview seeks, pause/resume, restart, instrument switches, practice speed and loop wraps follow the audible song transport. Short videos hold their final frame rather than restarting independently.

Selections, offsets, darkness and video Blobs save per audio/song ID in the separate `riffbound-backgrounds-v1` IndexedDB database. They are local to the device and survive normal reloads and offline play. They are not part of `.riffpack` backups or the public setlist. Remove video releases its object URL and removes the stored Blob on the next committed write. Browser data clearing removes local videos. A storage failure leaves a working session copy with an explicit message; codec and playback failures do not affect chart/audio playback. Pending writes and the open dialog block automatic game reloads.

Verification: deterministic media-element tests cover transport, per-song reload, stale reads, failed writes, invalid files and late play promises. Game/DOM/audio adapter tests cover count-ins, pause, chooser keyboard isolation, preview, practice loops/speed and update safety. Browser rendering, actual video codecs and physical-device playback still need a real browser check; this environment has no supported browser QA capability.
