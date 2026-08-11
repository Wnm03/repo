# PATCH — Auto-suggest Owner Dana Titipan dari Catatan

**Permintaan user:** dari 5 ide lanjutan (auto-suggest porsi, badge riwayat,
migrasi massal, reminder lupa pilih, filter per pemilik) — cek status lalu
implementasikan salah satu dengan ringkas.

## Cek status ide lain (di repo yang diupload, sudah sampai S568)
- ✅ **Filter laporan per pemilik** — sudah ada (S567/S568,
  `filter-laporan.js`, tab per owner di modal Riwayat Transaksi).
- ✅ **Badge/porsi di riwayat transaksi** — sudah ada (S566/S567, badge
  "👥 Porsi" di kartu akun + split per owner di Riwayat Transaksi).
- ✅ **Reminder lupa pilih porsi** — sudah ada secara implisit:
  `TitipanExpenseUI.save()` block simpan & toast peringatan kalau 0 owner
  dicentang (baris ~213-216, sudah sejak S521).
- ⬜ **Migrasi transaksi lama sekaligus** — belum ada, scope lebih besar
  (perlu UI pemilihan transaksi lama + bulk-update owner), disarankan jadi
  sesi terpisah.
- ⬜ **Auto-suggest porsi dari kategori/catatan** — belum ada → diimplementasikan
  di patch ini.

## Perubahan
- **`modules/finance/titipan-expense-ui.js`**: tambah `TitipanExpenseUI.onNoteInput()`
  — kalau catatan yang diketik user mengandung PERSIS 1 nama owner existing
  (case-insensitive substring) DAN belum ada owner yang tercentang manual,
  owner itu otomatis tercentang. Ambigu (cocok >1 nama) atau tidak cocok
  sama sekali → tidak ada perubahan. User tetap bebas ubah manual kapan
  saja. 0 tulis ke `D`, pola sama `toggleOwner()`.
- **`modules/shared/modals.js`**: field `#titipanExpenseNote` di
  `titipanExpenseModal` — tambah `oninput="TitipanExpenseUI.onNoteInput()"`.
- **`tests/s521-titipan-expense-ui.test.js`**: +5 test baru (gap-check
  wiring oninput + 4 skenario onNoteInput: single match, ambigu 2 match,
  tidak menimpa pilihan manual, tidak match sama sekali).

## Hasil test
`node --test tests/s521-titipan-expense-ui.test.js` → 22/22 pass.
Full suite (`node --test tests/*.test.js`) → 3992/3998 pass, 6 fail
PRE-EXISTING di `tests/s551-investment-owners-nominal-readonly.test.js`
(dikonfirmasi gagal juga di repo asli sebelum patch ini — tidak terkait).

## Audit repo update di atas S567 (`repo-updated.zip`)

Repo yang diupload (`repo-updated.zip`) sudah lanjut sampai **S569 ("Sesi
A")** + **Sesi C**, jadi 2 sesi lebih baru dari S568 yang jadi basis patch
ini. Dicek per file (bandingkan isi `modules/shared/modals.js` di repo vs
di patch ini — TIDAK ada konflik, lihat catatan di bawah):

**S568 — `FIX-s568-filtertx-owner-split-tab-picker.md`** (tab per pemilik
di Riwayat Transaksi akun tertaut):
- ubah: `modules/finance/filter-laporan.js`, `tests/s567-filtertx-owner-split.test.js`

**S569 / "Sesi A" — `FIX-sA-resolve-tx-owner-split-stale-fix.md`**
(`resolveTxOwnerSplitForAccount()`, fix porsi stale setelah aset di-link
ke Holding Investasi):
- ubah: `modules/finance/filter-laporan.js` (fungsi baru, di file yang sama
  dengan S568)
- baru: `tests/s569-resolve-tx-owner-split-stale-fix.test.js`

**Sesi C — `FIX-sC-titipan-majoris-expense-comparison.md`** (baris
"Estimasi dari Transaksi <Akun>" di kartu Dana Titipan):
- ubah: `modules/finance/dana-titipan-portfolio-render.js`
  (`_expenseComparisonForOwner()` baru + 1 baris render baru)
- baru: `tests/sC-titipan-majoris-expense-comparison.test.js`

**Version-sync only** (auto oleh `scripts/build.js`, 0 logic manual,
berulang tiap sesi di atas): `app-bundle-a.min.js`, `app-bundle-b.min.js`,
`app_production.html`, `index.html`, `sw.js`, `docs/FILE-MAP.md`,
`docs/COVERAGE-PER-MODULE.md`, `chat-action-handlers.js`,
`modules/shared/modals.js`, `modules/shared/modules-calc.js`,
`modules/shared/modules-render.js`,
`modules/shared/features-helpers-global-security.js`. Versi bundle saat
ini `v1299`.

**Cek konflik dgn patch ini:** `modules/shared/modals.js` termasuk file
yang ikut disentuh (version-sync) di S568/S569/SesiC — tapi field
`#titipanExpenseNote` di dalamnya TIDAK berubah isinya di semua sesi
tsb (masih persis versi sebelum patch, belum ada
`oninput="TitipanExpenseUI.onNoteInput()"`). Jadi patch `modals.js` &
`titipan-expense-ui.js` di sini **masih bisa diterapkan bersih** ke
`repo-updated.zip` tanpa perlu rebase. `titipan-expense-ui.js` di repo
juga belum punya `onNoteInput()`.
