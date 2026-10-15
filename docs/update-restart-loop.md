# Update restart loop — version 114

The supplied Riffbound.mp4 shows the idle stage repeatedly disappearing and reappearing. Captured frames also show the setlist returning to its initial “Loading saved songs” state and default track metadata. This suggests page restarts, rather than a song-timing or scoring fault. The recording does not include browser logs, so it does not establish which cached resource triggered the restarts.

The updater previously tracked `reloading` only in the current JavaScript page. When a stale cached document survived a reload and the controlling worker reported a newer version again, each fresh page could automatically reload again. A deterministic test reproduces that loop before this fix.

The updater now remembers up to eight recent target versions in tab-local session storage. Each target gets one automatic refresh attempt. If the old copy persists, automatic refresh pauses and Install / offline offers **Use updated game**. Explicit retries remain available; missing or unwritable session storage also pauses automatic refresh. The existing playback, unsaved-song and resume-preparation checks still apply. A later release may update normally. This does not remove setlist, song audio, video, scores or controller mappings.

Before writing its offline cache, the worker checks that the downloaded runtime manifest identifies the same release. A mismatched download fails before writing or deleting existing cache entries. This detects a worker/manifest mismatch, not every possible stale individual asset.

Validation covers successive page boots sharing session storage, alternating recent target versions, manual retry, later releases, blocked reads and writes, unsuccessful resume preparation, and mismatched offline downloads. Existing practice/results, video synchronization, controller and storage tests remain covered. No supported browser QA surface was available; the remaining check is to open version 114 on the affected device and verify that the idle stage stays visible.
