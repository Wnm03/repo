# COVERAGE-PER-MODULE.md — test coverage per module family (AUTO-GENERATED, JANGAN EDIT MANUAL)

> Di-generate otomatis oleh `node scripts/generate-coverage-per-module.js` —
> dipanggil juga otomatis di akhir setiap `node build.js` yang sukses. S331,
> tindak lanjut poin #3 (TERAKHIR) dari daftar saran maintainability user
> pasca-audit S324 ("coverage per modul") — lihat komentar header
> `scripts/generate-coverage-per-module.js` untuk metodologi lengkap & batasannya.
>
> **Batasan penting**: ini cakupan STRUKTURAL (berapa file test yang secara
> LANGSUNG me-load minimal 1 file di family itu lewat `loadSource([...])`/
> literal path lain), BUKAN code-coverage ter-instrumentasi (mis. istanbul/c8).
> Family dgn "0 test file" belum tentu 0% teruji sungguhan (bisa saja diuji
> tidak langsung lewat modul lain yang memanggilnya) — anggap sbg sinyal awal
> utk ditinjau, bukan vonis akhir. Kalau file ini kelihatan tidak sinkron,
> jalankan ulang generatornya, JANGAN diedit tangan.

Terakhir digenerate: 2026-08-10T02:36:16.811Z
Total file test (`tests/*.test.js`): 320 · Total module family: 15

| Module family | File source (.js) | File test yang menyentuh | Status |
|---|---:|---:|---|
| `economic-intelligence` | 20 | 2 |  |
| `modules/self-reward` | 3 | 2 |  |
| `lifeos` | 29 | 4 |  |
| `modules/cross` | 17 | 4 |  |
| `modules/home` | 3 | 4 |  |
| `modules/logistics` | 2 | 4 |  |
| `modules/dashboard-hub` | 6 | 6 |  |
| `modules/ai` | 7 | 10 |  |
| `modules/business` | 10 | 14 |  |
| `root` | 19 | 60 |  |
| `modules/shop` | 21 | 61 |  |
| `modules/asset` | 19 | 72 |  |
| `modules/vehicle` | 80 | 72 |  |
| `modules/finance` | 44 | 100 |  |
| `modules/shared` | 31 | 142 |  |
