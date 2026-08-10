# Patch S543 — Re-fix "UI Ride Tidak Muncul di Tab Jalan Car Notes"

Melanjutkan dari `S542-FULL-RELEASE.zip` (v1275). Ini BUKAN fitur baru
— ini pasang-ulang fix S532 yang ternyata sempat ke-revert diam-diam
sejak patch s538 (v1266-1267) dan terbawa sampai s542 tanpa terdeteksi.
Detail root cause & investigasi lengkap ada di `s543-SESSION-NOTE.md`.

## Ringkasan perbaikan
Root cause: tab "🚴 Jalan" (markup `#cnTab-jalan` di HTML) dan
panggilan `RideUI.render()` (di `renderCnTab()`,
`modules/shared/modules-render.js`) hilang dari `index.html`/
`app_production.html` sejak build v1266-1267 (sesi s538) — kemungkinan
karena build sesi itu memakai base HTML lama sebelum fix S532
dipasang, bukan hasil s537.

Perbaikan sesi ini murni memasang ulang wiring yang sama persis dengan
S532 (0 logic baru, 0 perubahan ke modul Ride manapun):
1. `index.html` + `app_production.html` — tombol tab `🚴 Jalan` + pane
   `#cnTab-jalan` (field `rideStatusText`/`rideDistanceText`/
   `rideDurationText`/`rideAvgSpeedText`/`rideMaxSpeedText`/
   `rideErrorText`, tombol `rideStartBtn`/`ridePauseBtn`/
   `rideResumeBtn`/`rideStopBtn`/`rideDiscardBtn`).
2. `modules/shared/modules-render.js` — `RideUI.render()` dipanggil di
   `renderCnTab()`.

0 perubahan ke `ride-activity-metrics.js`/`ride-gps-recorder.js`/
`ride-storage.js`/`ride-history.js`/`ride-map.js`/
`ride-vehicle-integration.js`/`ride-ui.js`/`vehicle-core.js` (checksum
dicek, tidak tersentuh — array tab `'jalan'` di `setCnTab()` memang
sudah bertahan sejak S532, tidak pernah ikut regresi).

## ⚠️ Catatan build (penting)
Environment build sesi ini TIDAK punya akses jaringan, jadi `esbuild`
(devDependency) tidak bisa dipasang. `scripts/build.js` tetap berjalan
lengkap lewat fallback bawaannya, tapi `app-bundle-a.min.js`/
`app-bundle-b.min.js` di patch ini **valid secara sintaks & fungsi
100% sama, TAPI TIDAK diminify** (ukuran file jauh lebih besar dari
build s542 sebelumnya — source digabung apa adanya). Kalau ukuran kecil
diperlukan (mis. untuk produksi/hosting dengan kuota), jalankan ulang
di environment yang online:
```
npm install --save-dev esbuild
node scripts/build.js
```

## Verifikasi
- `node scripts/verify-window-expose.js` → ✓ OK
- `node scripts/verify-bundle-freshness.js` → ✓ kedua bundle segar
- `node --test tests/ride-ui.test.js` → 31/31 pass
- `node --test tests/*.test.js` (full suite, 3753 test) → **3753/3753
  pass, 0 gagal, 0 regresi**

## File dalam patch ini (path asli repo)
- `index.html`
- `app_production.html`
- `modules/shared/modules-render.js`
- `modules/shared/modals.js` (version sync saja)
- `modules/shared/modules-calc.js` (version sync saja)
- `modules/shared/features-helpers-global-security.js` (version sync
  saja)
- `chat-action-handlers.js` (version sync saja)
- `app-bundle-a.min.js` (rebuild, TIDAK minified — lihat catatan di
  atas)
- `app-bundle-b.min.js` (rebuild, TIDAK minified — lihat catatan di
  atas)
- `sw.js` (`CACHE_NAME` → `kw-cache-v1276`)
- `docs/FILE-MAP.md`, `docs/COVERAGE-PER-MODULE.md` (regenerasi
  otomatis)
- `s543-SESSION-NOTE.md` (root cause & investigasi lengkap)

Versi: v1275 (`s542-custodian-registry-rename-remove`) → v1276
(`s543-custodian-registry-rename-remove`).

Upload SEMUA file di atas (jangan cuma HTML) — sesuai catatan
`scripts/build.js`.
