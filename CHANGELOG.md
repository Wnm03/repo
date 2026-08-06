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
