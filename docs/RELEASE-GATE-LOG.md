# RELEASE-GATE-LOG.md — audit log override gate rilis (Sesi 424)

> Append-only. Setiap kali `scripts/verify-release-ready.js` di-override manual
> (lint tidak tersedia / bundle belum diminify), entri baru ditambahkan di sini
> OTOMATIS oleh skrip itu sendiri -- JANGAN diedit tangan, JANGAN dihapus entri
> lama. Ini jejak audit permanen: kalau ada rilis yang ternyata bermasalah,
> file ini menunjukkan persis kapan & kenapa gate itu dilewati.

## 2026-08-06T20:56:09.121Z — versi s424-release-gate-lint-esbuild-reliability

- **lint-unavailable**: override dipakai. Alasan: Sandbox Claude (bash_tool) untuk sesi ini punya network egress DISABLED -- npm install eslint gagal dgn npm error E403 (403 Forbidden dari registry.npmjs.org). eslint tidak pernah pernah terpasang di environment ini sejak awal proyek (konsisten dgn catatan sesi2 sebelumnya di docs/CLAUDE.md/CATATAN-CEK-CLAUDE.md). Verifikasi manual: perubahan sesi 424 cuma 2 file baru (scripts/verify-release-ready.js, tests/verify-release-ready-s424.test.js) + edit kecil di package.json/build.js/docs -- gaya kode konsisten dgn scripts/verify-window-expose.js (sesi 423) yg sudah lolos review manual sebelumnya, tidak ada pola yg biasa ditangkap eslint (no-undef, unused-vars) krn semua identifier baru dideklarasikan & dipakai lengkap dlm file yg sama.
- **unminified-bundle**: override dipakai. Alasan: Sandbox yg sama: npm install esbuild gagal dgn npm error E403 (403 Forbidden). esbuild adalah binary native per-platform, tidak bisa disalin manual tanpa akses jaringan (beda dgn source .js biasa). Bundle unminified TETAP 100% valid secara sintaks (node --check lolos, dicek build.js) & fungsional identik -- cuma ukuran file lebih besar (app-bundle-a: 1166.8KB, app-bundle-b: 2720.2KB, vs versi minified yg pernah tercatat ~500-600KB gabungan di sesi lampau). Diterima utk rilis patch sesi ini krn prioritas project adalah ZIP patch fungsional (docs/ZIP_RULES.md: 'ZIP adalah cara SATU-SATUNYA user menerima hasil kerja'), bukan ukuran file.

## 2026-08-06T21:07:22.954Z — versi s425-dedup-html-source-of-truth

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 registry.npmjs.org), eslint tidak bisa diinstall - perubahan sesi ini hanya menyentuh scripts/build.js, scripts/verify-release-ready.js, dan 1 file test baru, semua diverifikasi manual (2868/2868 test node --test pass, tidak ada style baru di luar pola eksisting)
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 registry.npmjs.org saat npm install esbuild), sama seperti kondisi s424 - bundle unminified 100% valid (node --check lolos), cuma ukuran lebih besar

## 2026-08-06T21:48:17.749Z — versi s428-doc-consolidation-stale-schedule

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403), eslint tidak bisa diinstall - sesi ini murni perubahan dokumentasi (.md) + 1 penanda komentar di CHECKPOINT.md, 0 file .js source disentuh selain regenerasi otomatis versi oleh build.js, 2868/2868 test tetap pass
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 saat npm install esbuild), sama seperti s424/s425 - bundle unminified 100% valid (node --check lolos)

## 2026-08-06T22:02:08.260Z — versi s429-doc-stale-marker-project-state-next-session

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403), eslint tidak bisa diinstall - sesi ini murni perubahan dokumentasi (.md), 0 file .js source disentuh selain regenerasi otomatis versi oleh build.js, 2868/2868 test tetap pass
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 saat npm install esbuild), sama seperti s424/s425/s428 - bundle unminified 100% valid (node --check lolos)

## 2026-08-06T22:10:42.678Z — versi s430-asset-owners-nominal-field

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403), eslint tidak bisa diinstall - perubahan sesi ini nambah field UI Nominal (Rp) sinkron 2 arah di modal Atur Porsi Kepemilikan (modules/asset/aset.js), 2874/2874 test node --test pass (naik dari 2868, +6 test baru), gaya kode konsisten dgn fungsi onOwnerPorsiInput/onOwnerNominalInput yang sudah ada
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 saat npm install esbuild), sama seperti s424/s425/s428/s429 - bundle unminified 100% valid (node --check lolos)

## 2026-08-06T22:21:36.775Z — versi s431-asset-owners-auto-distribute-remaining

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan, konsisten s424/s425/s428/s429/s430
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan, esbuild tidak terpasang, konsisten s424/s425/s428/s429/s430

## 2026-08-06T22:37:14.647Z — versi s432-audit-fitur-transfer

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan, konsisten sesi-sesi sebelumnya
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan, esbuild tidak terpasang, konsisten sesi-sesi sebelumnya

## 2026-08-06T22:54:07.855Z — versi s433-audit-fix-renov-edit-not-saving

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 registry.npmjs.org), eslint tidak bisa diinstall - perubahan sesi ini cuma 1 baris kondisi guard di modules/finance/transaksi.js + 1 file test baru + komentar, gaya kode konsisten dgn pola existing (bandingkan applyTxStockFromTx dkk), 2892/2892 test node --test pass (naik dari 2889, +3 test baru)
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 saat npm install esbuild), konsisten sesi-sesi sebelumnya - bundle unminified 100% valid (node --check lolos)

## 2026-08-06T23:27:55.418Z — versi s434-audit-fix-linked-acc-nol-riwayat-kosong

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 registry.npmjs.org), eslint tidak bisa diinstall - perubahan sesi 434 cuma: 1 baris filter (sameId) di modules/finance/filter-laporan.js, penambahan info tampilan (linkMeta) di modules/asset/aset.js openActionsMenu(), + 1 file test baru - gaya kode konsisten dgn pola existing (sameId dipakai identik dgn akun.js/aset.js), 2895/2895 test node --test pass (naik dari 2892, +3 test baru)
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 saat npm install esbuild), konsisten sesi-sesi sebelumnya - bundle unminified 100% valid (node --check lolos)

## 2026-08-06T23:41:36.878Z — versi s435-modal-sweep-coverage-assetowners

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 registry.npmjs.org), eslint tidak bisa diinstall - perubahan sesi 435 cuma 1 spec baru (assetOwnersModal) ditambah ke MODULE_METHOD_MODAL_SPECS di self-test.js, pola identik dgn spec Aset.openModal() persis di atasnya & purchaseOrderBatchModal (S388) sebelumnya, 2895/2895 test node --test tetap pass (tidak ada test baru krn sweep modal murni browser-only, konsisten S388)
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan keluar (npm error 403 saat npm install esbuild), konsisten sesi-sesi sebelumnya - bundle unminified 100% valid (node --check lolos)

## 2026-08-07T00:06:44.812Z — versi s436-tx-renov-toast-merge-fix

- **lint-unavailable**: override dipakai. Alasan: sandbox tanpa akses npm registry, eslint tidak terpasang
- **unminified-bundle**: override dipakai. Alasan: sandbox tanpa akses jaringan, esbuild tidak bisa diinstall
