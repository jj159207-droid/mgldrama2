# TAZA offline movie viewing — setup and release checklist

This feature lets a viewer **who already has paid playback rights** save a
complete MP4 inside the storage of the current browser/app and later watch it
in the standalone `/offline.html` page without internet.

## Technical limitations

- **All 45 TAZA full-movie URLs currently point at Bunny Stream embed or play
  pages.** They are not downloadable media files by themselves.
- Bunny Stream only provides `play_480p.mp4`, etc., for videos with MP4
  Fallback enabled when the video was uploaded/encoded (according to the Bunny
  Stream documentation).
- In **Bunny Stream → Video Library → Encoding**, enable **MP4 Fallback**
  before uploading future videos. Check the current 45 videos in the Bunny
  dashboard; they may need new uploads/encoding for MP4 files to exist.
- A Bunny library may use a custom pull-zone hostname instead of the common
  `vz-{libraryId}.b-cdn.net` default. The current helper uses the default
  hostname. For libraries with custom hostnames, update the helper using the
  actual hostname **after verifying it in the Bunny dashboard**, never make
  up hostnames.
- The MP4 must be available to a browser fetch with **CORS enabled** and the
  security/referrer settings permitting requests from `https://taza.site`.
  Bunny token authentication can prevent unsigned MP4 access even if the
  normal player iframe works. Do not disable all authentication just to enable
  offline downloads; use signed download URLs/protected CDN if required.
- We do **not** re-host or relay multi-GB video files via Vercel; traffic goes
  directly from the licensed CDN to browser storage. This is intentional for
  streaming function limitations and cost.
- A full movie can require many hundreds of MB. Downloads may fail when the
  browser lacks space or evicts best-effort storage; the app prompts for
  persistent browser storage when supported.
- **Offline mode cannot securely revoke a purchased file while the device has
  no internet.** Browser-device date and storage are not tamper-proof DRM.
  For stronger offline DRM use a dedicated native app and supported
  Widevine/FairPlay license persistence. This version only enforces stored
  expiration in the UI; do not claim perfect copy protection.
- Existing session cookies are never cached. Movie files are stored locally
  only after the server verifies a paid entitlement, and the offline
  collection has a separate 21+ confirmation screen.

## Test from a phone

1. Confirm one test movie has a real `play_480p.mp4` or `play_360p.mp4`
   link in Bunny, that the browser can fetch it via CORS, and that the user
   is authorized for playback. No real bank transaction is necessary for
   testing if a legitimate admin test grant is available.
2. Sign into TAZA and open that film normally; choose **⬇ Татаж хадгалах**.
3. Keep the page open until **Амжилттай хадгаллаа!** appears. A video must
   be fully saved before offline playback.
4. Select **📁 Татсан кино** and confirm the entry appears and plays.
5. Disable all network connectivity. Reopen the site/app (or bookmark
   `/offline.html`). The service worker should serve the offline library.
6. Play the cached film and confirm that it works offline.
7. Delete it from the offline library and verify it is no longer playable.
8. Ensure the expiry cleanup works and that a user without rights cannot
   download any movie.

**Do not promote this feature as active for all 45 movies until at least one
actual Bunny source has passed this test and the rest have been confirmed
to have downloadable MP4 variants.**


## Native MP4 download to Downloads / Files

The movie player also offers **⬇ MP4 файл татах**. It is distinct from
**⬇ Татаж хадгалах** (browser-only offline cache).
- Chromium browsers with File System Access API: the browser asks where to
  save a .mp4 file, checks /api/playback again for current entitlement, and
  streams the file directly to the chosen folder without buffering multi-GB
  content in application memory.
- Safari / Firefox: a separately authenticated `/api/direct-download?id=...`
  endpoint redirects to the permitted Bunny fallback MP4; users may then
  need to select Download or Save to Files in the native media viewer.
  HTTP redirect does NOT guarantee a browser download.
- A downloaded MP4 is **not** DRM protected: a user can rename or share the
  file and it will not expire automatically when their online viewing rights
  expire. Do not promise DRM.
- MP4 Fallback and CDN access (referer/CORS/token auth) still have to work.
  As on-device cache saving, the player does not auto-download movies.
  Large downloads consume Bunny bandwidth and users' device storage.
