// owner-registry.js — Owner Registry (Sesi 489, langkah 1/5 rencana
// PLAN-owner-registry-multi-session.md).
//
// TARGET: satu sumber kebenaran `ownerId` lintas Aset/Investasi/Titipan.
// Audit S488 menemukan `assetOwnersModal`/`investmentOwnersModal` generate
// `uid()` BARU tiap baris pemilik baru tanpa cek existing owner — "Budi" di
// Aset A dan Aset B bisa punya `ownerId` berbeda, padahal orangnya sama.
//
// SESI INI (S489) = FONDASI SAJA, TANPA WIRING. Tidak menyentuh aset.js,
// investasi-view.js, modals.js, atau titipanCommitmentModal — itu kerjaan
// S490 (aset.js), S491 (investasi-view.js), S492 (titipan), pola sama
// persis "1 task = 1 sesi" yang dipakai multi-owner-engine.js (S390).
//
// GATE #1 (dikunci): seed KOSONG. Registry mulai kosong, TIDAK di-backfill
// dari `D.assets[].owners`/`D.investments[].owners`/`D.titipanCommitments`
// yang sudah ada. Owner lama tetap standalone (nama sama, `ownerId` beda)
// persis seperti sekarang — hanya entri BARU setelah S490+ live yang akan
// konsisten. Konsisten dengan disiplin proyek "0 mutasi data existing".
// (Karena seed kosong, TIDAK perlu flag idempotent-seed seperti yang
// diwanti-wanti di "Danger point" plan — tidak ada proses seed sama sekali.)
//
// Struktur data: `D.ownerRegistry: [{id, name}]` — SATU field baru, tidak
// mengubah skema `owners[]` yang sudah ada di assets/investments/
// titipanCommitments. Field `ownerId`/`ownerName` di record lama tetap
// dibaca apa adanya oleh kode lain (0 sentuhan ke situ sesi ini).
//
// Pola guard `typeof` & getter-lazy-init sama persis
// `DanaTitipanPortfolioAPI.getCommitments()` (S485b) — getter TIDAK menulis
// `D.ownerRegistry` kalau belum ada, cuma balikin array kosong.

const OwnerRegistry = {

  // listAll() — getter read-only. Balikin `D.ownerRegistry` apa adanya
  // (atau `[]` kalau belum pernah diisi) — dipakai sebagai sumber dropdown
  // "Pilih Pemilik" di S490/S491 (belum ada consumer sesi ini).
  listAll() {
    return (typeof D !== 'undefined' && Array.isArray(D.ownerRegistry)) ? D.ownerRegistry : [];
  },

  // findOrCreate(name) — cari entri existing by NAMA (trim, case-insensitive)
  // dulu; kalau ketemu, balikin `id`-nya (TIDAK membuat entri baru/duplikat).
  // Kalau tidak ketemu, buat entri baru (`id` via `uid()`), push ke
  // `D.ownerRegistry`, panggil `save()` kalau tersedia, balikin `id` baru.
  //
  // CATATAN — batas fungsi ini: matching by nama HANYA dipakai di titik
  // input "buat baru" (user mengetik nama, S490+ dropdown). Registry
  // sendiri tetap dedup by `id`, BUKAN by nama — kalau nanti 1 entri
  // di-rename (fitur rename, eksplisit OUT-OF-SCOPE seluruh paket ini),
  // itu TIDAK collapse otomatis ke entri lain yang kebetulan namanya jadi
  // sama. Dua nama kembar dari 2 orang berbeda yang DIKETIK terpisah lewat
  // fungsi ini AKAN collapse jadi 1 `id` (match by nama) — ini SAMA seperti
  // risiko yang sudah didokumentasikan di Gate #1 plan untuk opsi seed
  // union, konsekuensi wajar dari "nama sebagai satu-satunya input user".
  //
  // Parameter:
  //   name (string) — wajib non-empty setelah di-trim, kalau tidak throw
  //     Error (pola sama `saveCommitment()`/`recordReturn()`).
  // Return: string `id` (existing atau baru).
  findOrCreate(name) {
    const trimmed = (name && String(name).trim()) || '';
    if (!trimmed) throw new Error('Nama pemilik wajib diisi');
    if (typeof D === 'undefined') throw new Error('Registry belum siap dimuat');
    D.ownerRegistry = Array.isArray(D.ownerRegistry) ? D.ownerRegistry : [];
    const lower = trimmed.toLowerCase();
    const existing = D.ownerRegistry.find((o) => o && typeof o.name === 'string' && o.name.trim().toLowerCase() === lower);
    if (existing) return String(existing.id);
    const id = String((typeof uid === 'function') ? uid() : ('owner_' + Date.now()));
    D.ownerRegistry.push({ id, name: trimmed });
    if (typeof save === 'function') save();
    return id;
  },

};

if (typeof window !== 'undefined') {
  window.OwnerRegistry = OwnerRegistry;
}
