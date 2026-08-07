# Changelog — Sesi 456 (dana titipan dikeluarkan dari goal cards)

## Konteks

Lanjutan S455: dana titipan owner non-SELF (entri di `D.debts` via
`_syncOwnerDebts()`) sudah di-exclude dari `DebtStrategy.activeDebts()`,
tapi masih ikut kebaca `goalSourceDebt()` (`lifeos/adapters/goal-adapter.js`)
— nongol sbg kartu Goal 0% yang gak pernah selesai. Detail:
`FIX-v1176-to-v1177-s456-goal-adapter-exclude-titipan.md`.

## Perubahan

- `lifeos/adapters/goal-adapter.js` — `goalSourceDebt()` exclude entri
  `linkedAssetId` (titipan), pola sama persis S455.
- `tests/s456-goal-adapter-exclude-titipan.test.js` — 2 test baru.

## Belum ditangani
- Tidak ada.

---

# Changelog — Sesi 455 (dana titipan dikeluarkan dari strategi pelunasan utang)

## Konteks

Lanjutan S454: dana titipan owner non-SELF (entri di `D.debts` via
`_syncOwnerDebts()`) ikut kebaca `DebtStrategy.activeDebts()` — nongol di
strategi snowball/avalanche & activeCount Debt Optimizer, padahal bukan
kewajiban dibayar. Detail: `FIX-v1175-to-v1176-s455-owner-debt-exclude-strategy.md`.

## Perubahan

- `modules/finance/piutang-utang.js` — `DebtStrategy.activeDebts()` exclude
  entri `linkedAssetId` (titipan); `Debt.renderList()` badge "🔒 Titipan —
  bukan kewajiban dibayar". `Debt.totalValue()` (Kekayaan Bersih) tidak
  berubah.
- `tests/s455-owner-debt-exclude-strategy.test.js` — 3 test baru.

## Belum ditangani
- Tidak ada.

---

# Changelog — Sesi 454 (badge peringatan akun tertaut utk aset multi-pemilik)

## Konteks

Lanjutan diskusi user soal gap desain: modal "Tautkan ke Akun" di form
Aset tidak punya pilihan porsi mana yang ditautkan kalau asetnya
multi-pemilik. Audit konfirmasi ini SENGAJA (S449/BUG-OWN-002) — akun
tertaut selalu representasi NILAI PENUH instrumen, porsi non-SELF sudah
ditangani terpisah lewat `_syncOwnerDebts()` (Buku Utang). Dari 3 opsi
yang didiskusikan, dipilih yang paling aman: badge informational saja
(0 perubahan logic saldo/utang). Detail lengkap di
`FIX-v1173-to-v1175-s454-multiowner-linked-account-badge.md`.

## Perubahan

- `modules/asset/aset.js` — `Aset.openActionsMenu()`: badge baru
  "⚠️ Akun tertaut merepresentasikan 100% nilai aset (bukan cuma porsi
  Anda)…", tampil HANYA kalau aset punya akun tertaut DAN multi-pemilik
  (reuse `MultiOwnerEngine.getOwners()`).
- `tests/s454-linked-account-multiowner-badge.test.js` — 4 test baru.

## Belum ditangani

- Opsi checkbox "tautkan porsi SELF saja" & opsi akun berbeda per
  pemilik (`owners[].linkedAccountId`) — DITOLAK/ditunda sesuai diskusi
  (lihat FIX note), belum ada kebutuhan nyata di luar gap UI ini.

---

# Changelog — Sesi 422 (item TERAKHIR "saran tambahan" rencana "Fuel Estimation Auto-Update")

## Konteks

Item terakhir yang tersisa dari "saran tambahan" s420 (2 lainnya sudah
dikerjakan s421): guard akumulasi error fill-parsial berturut-turut.
Rencana "Fuel Estimation Auto-Update" kini SELESAI SEPENUHNYA.

## Perubahan

- `modules/vehicle/fuel-state-estimator.js` — field BARU
  `partialFillDriftRisk` (true kalau `partialFillsCounted` >=
  `PARTIAL_FILL_DRIFT_THRESHOLD` = 3), 0 rumus baru.
- `modules/vehicle/fuel-card.js` — `_partialFillDriftHint()` (BARU) +
  nudge UI "⚠️ Sudah beberapa kali isi BBM parsial berturut-turut.
  Disarankan Full Tank atau koreksi manual biar akurat lagi."
- `tests/fuel-state-estimator.test.js` + `tests/fuel-card.test.js` — 10
  test baru.

## Belum ditangani

- Tidak ada — rencana "Fuel Estimation Auto-Update" (termasuk semua
  "saran tambahan") sudah selesai sepenuhnya.
- Detail lengkap di `s422-SESSION-NOTE.md`.
