# PATCH v2 — Auto-suggest Owner Dana Titipan (untuk `repo-updated.zip`)

## Kenapa ada v2

Patch asli (`PATCH-titipan-owner-autosuggest.zip`) source-nya diambil dari
`repo-main`, yang basisnya BELUM punya fitur **"Porsi per Pemilik bukan
sistem patungan"** (dropdown `#txOwnerPorsi` di modal Transaksi,
`resolveTxOwnerAssignment()`) yang sudah ada di `repo-updated`. Karena
`modals.js` di-overwrite penuh (bukan diff/patch parsial), apply patch v1 ke
`repo-updated` apa adanya akan **menghapus balik** fitur Porsi per Pemilik
yang sudah ada di sana.

Patch v2 ini isinya sama persis secara LOGIKA (fitur auto-suggest owner dari
catatan) tapi source file-nya di-generate dari basis `repo-updated` +
`scripts/build.js` dijalankan ulang, jadi kedua fitur (Porsi per Pemilik +
Auto-suggest Owner) sama-sama ada, tidak saling menghapus.

## Cara apply

Timpa 3 file ini di `repo-updated` kamu dengan isi folder patch ini (path
sama persis):

- `modules/finance/titipan-expense-ui.js`
- `modules/shared/modals.js`
- `tests/s521-titipan-expense-ui.test.js`

Setelah itu jalankan `node scripts/build.js` di root repo supaya
`app-bundle-a/b.min.js`, `index.html`, `app_production.html`, `sw.js`, dan
`docs/FILE-MAP.md` / `docs/COVERAGE-PER-MODULE.md` ikut disinkronkan otomatis
(bukan bagian dari isi patch ini karena ukurannya besar & auto-generated —
lihat catatan di bawah kalau mau langsung pakai versi jadi).

## Perubahan (sama dengan patch v1)

- **`titipan-expense-ui.js`**: `TitipanExpenseUI.onNoteInput()` — kalau
  catatan yang diketik user mengandung PERSIS 1 nama owner existing
  (case-insensitive substring) DAN belum ada owner yang tercentang manual,
  owner itu otomatis tercentang. Ambigu (cocok >1 nama) atau tidak cocok
  sama sekali → tidak ada perubahan.
- **`modals.js`**: field `#titipanExpenseNote` — tambah
  `oninput="TitipanExpenseUI.onNoteInput()"`. Field `#txOwnerPorsi` (Porsi
  per Pemilik) di file yang sama TETAP UTUH, tidak tersentuh.
- **`tests/s521-titipan-expense-ui.test.js`**: +5 test (gap-check wiring +
  4 skenario onNoteInput) — sama seperti v1.

## Hasil verifikasi (dijalankan di atas `repo-updated` + patch ini)

- `node --test tests/s521-titipan-expense-ui.test.js` → **22/22 pass**.
- `node --test tests/*.test.js` (full suite) → **3992/3998 pass**. 6 fail
  yang tersisa PRE-EXISTING di `tests/s551-investment-owners-nominal-readonly.test.js`
  — sudah dicek, gagal juga sebelum patch ini diterapkan (bukan regresi).

## Catatan

Kalau tidak mau jalanin `scripts/build.js` sendiri, versi repo LENGKAP yang
sudah di-build (bundle + versi ter-bump ke v1300) sudah tersedia terpisah di
`repo-merged-s570-titipan-autosuggest.zip` dari respons sebelumnya — patch
folder ini hanya berisi 3 file source-nya saja kalau kamu mau apply manual
ke checkout kamu sendiri.
