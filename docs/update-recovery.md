# Update recovery (v129)

Game installation now downloads the runtime without the optional demo chart/audio pack. Explicit **Save game for offline play** still downloads and verifies the complete package. Downloads run at most four requests at a time, and a registration that finishes after the setup timeout is watched rather than leaving a stale error on screen.

For an already cached older release, open `/update.html` (the hosting service may canonicalize this to `/update`). This standalone page is deliberately outside the service worker asset manifest so older workers let it load from the network. Its button verifies a fresh same-site recovery script before unregistering the service worker with the exact game scope and deleting only `riffbound-offline-` caches. It never accesses IndexedDB or localStorage. Save current work and close other game tabs before using it; the offline package needs saving again afterward.

Validation: worker install/full offline-save coverage, bad assets/redirects/version mismatches, late registration recovery, no mutations before a click or failed online verification, exact worker scope, unrelated-cache preservation, duplicate-click handling, and existing reload safety tests. Browser preview is unavailable in this environment, so a real-browser recovery remains to be confirmed.
