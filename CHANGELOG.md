# Changelog — Sesi 464 (AUD-008 lanjutan: UI modal titipan investasi)

## Konteks

AUD-008 (`docs/BUG_REGISTRY.md`) sebelumnya sudah **DONE (Sesi 462)** untuk
bagian engine — `investasi.js` sudah punya `h.owners[]` opsional +
`Investment.getOwners()`/`setOwners()` lewat `MultiOwnerEngine` yang sudah
ada — tapi UI-nya (form multi-baris pemilik, mirror `assetModal`) sengaja
ditunda ke sesi berikutnya. Sesi ini mengerjakan UI-nya.

## Perubahan

- `modules/asset/investasi-view.js` (**baru**): `InvestmentUI` — modal
  "⚖️ Atur Porsi Kepemilikan" untuk holding investasi. Mirror
  `Aset.openOwnersModal()`/`_renderOwnersList()`/`updateOwnersTotal()`/
  `addOwnerRow()`/`removeOwnerRow()`/`onOwnerNameInput()`/
  `onOwnerPorsiInput()`/`onOwnerIsSelfToggle()`/`saveOwners()`/
  `resetOwners()` dari `aset.js` (S392a-S453), versi RINGKAS — **tanpa**
  lapisan Nominal (Rp) dua-arah (S429/S457) karena holding investasi tidak
  punya field nilai manual yang setara dengan `a.nilai` (unit/avgPrice/
  currentPrice selalu diturunkan ulang dari riwayat transaksi lewat
  `Investment.recomputeHolding()`, bukan diisi manual). Field yang diedit
  hanya Nama Pemilik + Porsi (%) + toggle "Ini saya". Penyimpanan 100%
  reuse `Investment.setOwners()` (sudah ada sejak S462) — 0 validasi/rumus
  porsi baru ditulis di sini.
- `scripts/build.js`: `modules/asset/investasi-view.js` didaftarkan ke
  `GROUP_B`, tepat setelah `investasi.js` (dependency: butuh `Investment`
  sudah dimuat lebih dulu).
- `modules/shared/modals.js`: entry baru `investmentOwnersModal`
  ditambahkan ke akhir array `MODAL_HTML` (index 92). `MODAL_VERSION`
  di-bump ke `s464-investment-owners-modal-ui`.
- `index.html` & `app_production.html`: `<script>document.write(MODAL_HTML[92]);</script>`
  ditambahkan tepat setelah baris `assetOwnersModal` (index 91).
- `docs/BUG_REGISTRY.md`: AUD-008 ditandai selesai sepenuhnya (engine +
  UI).

## Belum ditangani (disengaja, di luar scope sesi ini)

- Belum ada tombol pemicu (`data-action="InvestmentUI.openOwnersModal"`)
  yang dipasang di UI lain (mis. daftar/edit holding investasi) — modul
  investasi belum punya halaman/list holding terpusat di codebase ini,
  jadi pemanggilan `InvestmentUI.openOwnersModal(id)` untuk sekarang perlu
  di-wire manual oleh caller mana pun yang punya id holding-nya (pola
  sama seperti tombol "⚖️ Atur Porsi Kepemilikan" di `assetModal`, yang
  akan dikerjakan begitu ada UI daftar holding investasi).
- `app-bundle-a.min.js`/`app-bundle-b.min.js` PERLU di-rebuild
  (`npm run build`) sebelum dipakai production — tooling esbuild tidak
  tersedia di environment ini.

## S465 — Rebuild bundle & sinkronisasi versi (audit lanjutan S464)

Menindaklanjuti satu dari dua item "Belum ditangani" di atas: rebuild
bundle. Item tombol pemicu tetap TIDAK dikerjakan (masih butuh keputusan
produk soal halaman/list holding investasi terpusat — di luar scope
audit teknis).

## Perubahan

- Ditemukan drift versi: `MODAL_VERSION` (modals.js) sudah di `s464-...`
  tapi `APP_BUILD_VERSION`/`PRODUCTION_BUILD_SYNCED_VERSION`
  (features-helpers-global-security.js), `MODULE_RENDER_VERSION`
  (modules-render.js), `MODULE_CALC_VERSION` (modules-calc.js), dan
  `MODULE_FEATURES_VERSION` (chat-action-handlers.js) masih tertinggal di
  `s461-...` — build.js menolak lanjut sampai ke-5 konstanta itu
  disamakan manual dulu (lihat `verifyVersionConstantsSynced()`).
  Disamakan ke `s464-investment-owners-modal-ui`, lalu `node
  scripts/build.js` dijalankan ulang; build.js sendiri lalu auto-bump
  semuanya sekali lagi ke `s465-investment-owners-modal-ui` (perilaku
  bawaan `bumpVersionEverywhere()`, bukan sesi kerja baru) & versi build
  numerik 1181 → 1182.
- `app-bundle-a.min.js` & `app-bundle-b.min.js`: di-rebuild penuh via
  `node scripts/build.js` — sekarang berisi `investasi-view.js`/
  `InvestmentUI` (sebelumnya belum, karena belum pernah di-build ulang
  sejak S464). esbuild tidak tersedia di sandbox ini (tanpa akses
  registry npm) jadi bundle TANPA minifikasi (raw concat, fallback
  bawaan build.js) — lebih besar dari build sebelumnya tapi valid
  (`node --check` lolos) & `verify-bundle-freshness.js` konfirmasi hash
  source cocok.
- `index.html`, `app_production.html`, `sw.js`: `?v=` / `CACHE_NAME`
  disamakan ke `1182` oleh build.js (bagian rutin dari proses build).
- Verifikasi penuh dijalankan ulang setelah build: `node --test
  tests/*.test.js` (2984/2984 lolos), `verify-window-expose.js` (63
  modul, semua ter-expose), `verify-release-ready.js` (lolos dengan 2
  gate di-override manual — lint & minify — karena keduanya butuh akses
  npm registry yang tidak ada di sandbox ini; alasan override tercatat
  di `docs/RELEASE-GATE-LOG.md`).

## Belum ditangani (tetap di luar scope)

- Tombol pemicu `InvestmentUI.openOwnersModal(id)` di UI lain — masih
  belum ada halaman/list holding investasi terpusat di codebase (bahkan
  `Investment.addHolding()` sendiri belum pernah dipanggil dari UI mana
  pun). Ini keputusan produk/desain UI baru, bukan sekadar audit teknis,
  jadi sengaja tidak ditambahkan di sini.
- Lint (`eslint`) & minifikasi (`esbuild`) nyata — perlu dijalankan
  ulang di environment dengan akses `npm install` sebelum rilis
  production final, supaya bundle ukurannya kembali kecil & lolos lint
  asli (bukan override).
