// dana-titipan-portfolio-presenter.js — Dana Titipan dalam Investasi:
// Portfolio Allocation Projection (Sesi 484 + Sesi 485a-e + Sesi 486).
//
// SESI 486 (Case F: Partial Return / Pengembalian Dana Titipan, lihat
// RENCANA-SESI-CASEF-PARTIAL-RETURN-S486.md — menutup "Remaining
// limitations" terakhir yang dicatat eksplisit di penutup Gap #3,
// RENCANA-SESI-GAP3-TITIPAN-COMMITMENT.md § "Ringkasan Akhir"): tambah
// `D.titipanReturns[]` — LOG/riwayat pengembalian (BUKAN upsert seperti
// `titipanCommitments`), lewat `recordReturn()`/`getReturns()`/
// `deleteReturn()` baru di `DanaTitipanPortfolioAPI`. `build()` extend 2
// field derived baru per owner: `returnedTotal` (selalu angka, default
// 0) & `outstandingPrincipal` (null kalau `principalAmount` null,
// kalau tidak `max(0, principalAmount-returnedTotal)`, tidak pernah
// negatif) — TIDAK disimpan ke `D` sama sekali. UI baru
// `DanaTitipanReturnUI` (modal `titipanReturnModal`, owner READONLY —
// beda dari `titipanCommitmentModal` yang dropdown, karena return
// selalu terikat ke owner kartu yang sedang dibuka) + extend
// `render()` (baris "Sudah Dikembalikan"/"Pokok Belum Dikembalikan" +
// riwayat + tombol "↩️ Catat Pengembalian"). 0 sentuhan
// OwnershipEngine/MultiOwnerEngine/investasi.js/akun.js (HARD RULE sama
// seperti seluruh Gap #3).
//
// SESI 485c (Gap #3 audit, langkah 3/5 dari rencana multi-sesi — lihat
// RENCANA-SESI-GAP3-TITIPAN-COMMITMENT.md): extend `build()` —
// projection sekarang UNION owner dari `D.titipanCommitments[]` +
// owner hasil agregasi holding (sebelumnya build() HANYA melihat owner
// dari holding; owner yang sudah komit tapi belum punya holding sama
// sekali sekarang tetap muncul dgn allocated/currentValue/gain = 0).
// Tiap owner sekarang punya field baru: `principalAmount` (dari
// commitment, `null` — BUKAN 0 — kalau owner itu belum punya record
// commitment sama sekali), `estimatedUnallocated` (null kalau
// principalAmount null, kalau tidak `max(0, principal-allocated)`),
// `overAllocatedAmount` (`max(0, allocated-principal)`, 0 kalau tidak
// over-alokasi atau principal belum ada), `allocationStatus` (`'OK'` /
// `'OVER_ALLOCATED'` / `'PRINCIPAL_NOT_SET'`). `totals` dapat 3 field
// baru: `principalAmountTotal`, `estimatedUnallocatedTotal` (HANYA
// dijumlah dari owner yang principal-nya sudah diset — owner
// `PRINCIPAL_NOT_SET` tidak ikut menyumbang, konsisten dgn nilai
// `estimatedUnallocated`-nya yang `null`), `overAllocatedTotal`. 0 rumus
// baru di luar itu — `allocatedPrincipal`/`currentValue`/`gain` per
// owner/holding TETAP 100% reuse mekanisme S484 lama (tidak disentuh).
//
// SESI 485b (langkah 2/5): CRUD backend murni utk `D.titipanCommitments[]`
// — `saveCommitment()` (upsert by `ownerId`, existing-owner-only via
// `listExistingOwners()`, TIDAK PERNAH generate identity baru) +
// `getCommitments()` (getter read-only). Isolasi total dari
// `D.accounts`/`D.transactions`/`D.investmentTx`/`D.investments`/
// `D.debts` (lihat test regresi §"tidak mengubah data lain").
//
// SESI 485a (langkah 1/5): fondasi data model `D.titipanCommitments[]`
// (init lazy, TIDAK ditulis file ini sesi itu) + `listExistingOwners()`
// (owner picker read-only, lihat komentar di fungsinya).
//
// TARGET EKSPLISIT USER: audit menemukan `DanaKelolaan.listTitipan()` cuma
// menjumlah cost basis (holdingCost) per entri titipan, TIDAK menampilkan
// nilai sekarang / unrealized P&L per instrumen, DAN datanya flat list
// (bukan digrupkan per pemilik dana lintas semua holding). Sesi ini
// menutup KEDUA gap itu (#1 nilai/P&L per baris, #2 grouping per owner)
// TANPA menyentuh gap #3 (belum ada entitas "pokok dana titipan" top-down
// / kas belum diinvestasikan / validasi over-allocation — MENUNGGU
// keputusan desain data terpisah, SENGAJA tidak dikerjakan di sini).
//
// PRINSIP (0 engine baru, 0 SSOT baru, 0 rumus finansial baru, 0 perubahan
// business logic/ownership engine/multi-owner engine/investment engine/
// schema holding): file ini MURNI proyeksi read-only yang mengelompokkan
// & menyajikan ulang angka yang SUDAH FINAL dari:
//   - `Investment.getHoldings()`/`getOwners(h)` (investasi.js, Sesi 462) —
//     daftar holding & pemilik EFEKTIF per holding (toleran h.owners[]
//     multi-owner, fundSource/titipanOwner single-owner legacy, default
//     SELF — SATU titik baca yang SUDAH ADA, tidak disintesis ulang di
//     sini).
//   - `Investment.holdingCost(h)`/`holdingValue(h)`/`holdingGainLoss(h)`
//     (investasi.js) — pokok/nilai sekarang/untung-rugi SELURUH holding,
//     dipakai APA ADANYA (0 rumus baru).
//   - `MultiOwnerEngine.splitByPorsi(nilai, owners)` (multi-owner-engine.js,
//     SUDAH ADA & PURE) — satu-satunya mekanisme "bagi nilai per porsi
//     owner" yang dipakai di codebase ini (dipanggil terpisah utk cost/
//     value/gain, supaya definisi "bagian owner" pada tiap angka 100%
//     konsisten dgn cara `_syncTitipanDebt()` di investasi.js menghitung
//     nilai utang per owner — TIDAK ada definisi valuasi baru dibuat di
//     sini).
//
// Guard typeof berlapis di setiap fungsi (pola SAMA PERSIS DanaKelolaan.*)
// supaya modul ini aman dimuat/dites berdiri sendiri & tidak pernah crash
// kalau satu holding malformed/legacy/data valuasi tidak lengkap —
// holdingCost/holdingValue/holdingGainLoss sendiri sudah fallback ke 0
// utk field yang hilang (`h.unit||0` dst), jadi tidak perlu guard
// tambahan di sini utk itu.
const DanaTitipanPortfolioAPI = {

// _holdingSplits(h) — helper internal: pecah cost/value/gain SATU holding
// per baris owner (urutan owners[] SAMA PERSIS urutan splitByPorsi() utk
// ketiganya, jadi index-aligned & aman di-zip). Balikin null kalau
// dependency belum dimuat / owners tidak valid (gagal validateOwners()
// via splitByPorsi) — caller (build()) skip holding itu, tidak throw.
_holdingSplits(h) {
  if (!h || typeof Investment === 'undefined' || typeof MultiOwnerEngine === 'undefined') return null;
  if (typeof Investment.getOwners !== 'function') return null;
  const owners = Investment.getOwners(h);
  if (!Array.isArray(owners) || !owners.length) return null;
  const cost = (typeof Investment.holdingCost === 'function') ? (Investment.holdingCost(h) || 0) : 0;
  const value = (typeof Investment.holdingValue === 'function') ? (Investment.holdingValue(h) || 0) : 0;
  const gain = (typeof Investment.holdingGainLoss === 'function') ? (Investment.holdingGainLoss(h) || 0) : (value - cost);
  const costSplit = MultiOwnerEngine.splitByPorsi(cost, owners);
  const valueSplit = MultiOwnerEngine.splitByPorsi(value, owners);
  const gainSplit = MultiOwnerEngine.splitByPorsi(gain, owners);
  if (!costSplit.ok || !valueSplit.ok || !gainSplit.ok) return null;
  return { owners, costSplit: costSplit.splits, valueSplit: valueSplit.splits, gainSplit: gainSplit.splits };
},

// build() — projection utama. Grouping per owner NON-SELF lintas SEMUA
// holding investasi (satu owner bisa tersebar ke banyak instrumen; satu
// instrumen bisa punya porsi dari beberapa owner — keduanya sudah
// didukung `Investment.getOwners()`/`h.owners[]`, tidak ada logic baru
// di sini utk itu). Owner SELF & baris porsi 0 SENGAJA dikecualikan (pola
// sama `_syncTitipanDebt()`: `.filter((o) => !o.isSelf && o.porsi > 0)`).
//
// `totals.allocatedPrincipalTotal` SENGAJA diberi nama eksplisit
// "teralokasi" (bukan `totalTitipan`/`totalPrincipal`/`totalDanaTitipan`)
// — angka ini HANYA menjumlah porsi non-SELF yang SUDAH masuk ke holding
// investasi, BUKAN estimasi total dana titipan yang diterima (gap #3,
// belum ada sumber datanya). Tidak ada baris "kas belum diinvestasikan"
// di output ini sama sekali (SENGAJA, lihat catatan gap #3 di atas).
build() {
  const ownersMap = new Map();
  const canReadHoldings = !(typeof Investment === 'undefined' || typeof Investment.getHoldings !== 'function');
  if (canReadHoldings) {
    const holdings = Investment.getHoldings() || [];
    holdings.forEach((h) => {
      if (!h) return;
      const splits = this._holdingSplits(h);
      if (!splits) return;
      const { owners, costSplit, valueSplit, gainSplit } = splits;
      owners.forEach((o, idx) => {
        if (!o || o.isSelf) return;
        if (!(o.porsi > 0)) return;
        const ownerId = o.ownerId || 'titipan_investor';
        const ownerName = (o.ownerName && String(o.ownerName).trim()) || 'Pemilik dana titipan';
        const allocatedPrincipal = (costSplit[idx] && costSplit[idx].bagian) || 0;
        const currentValue = (valueSplit[idx] && valueSplit[idx].bagian) || 0;
        const gain = (gainSplit[idx] && gainSplit[idx].bagian) || 0;
        if (!ownersMap.has(ownerId)) {
          ownersMap.set(ownerId, { ownerId, ownerName, allocatedPrincipal: 0, currentValue: 0, gain: 0, holdings: [] });
        }
        const bucket = ownersMap.get(ownerId);
        bucket.allocatedPrincipal += allocatedPrincipal;
        bucket.currentValue += currentValue;
        bucket.gain += gain;
        bucket.holdings.push({
          holdingId: h.id,
          name: h.name || 'Holding',
          type: h.type || '',
          ownerPct: o.porsi,
          allocatedPrincipal,
          currentValue,
          gain,
          linkedInvestmentId: h.id,
          linkedOwnerId: ownerId,
        });
      });
    });
  }

  // SESI 485c — union dgn owner dari D.titipanCommitments[]: owner yang
  // sudah komit pokok tapi BELUM punya holding sama sekali (mis. baru
  // saja dicatat, belum sempat dibelanjakan) tetap harus muncul di
  // projection (allocated/currentValue/gain = 0, bukan hilang begitu
  // saja) — supaya "Estimasi Belum Teralokasi" bisa dihitung utk owner
  // itu (sesi UI, S485d).
  const commitments = (D && Array.isArray(D.titipanCommitments)) ? D.titipanCommitments : [];
  const commitMap = new Map();
  commitments.forEach((c) => {
    if (!c || !c.ownerId) return;
    commitMap.set(c.ownerId, c);
    if (!ownersMap.has(c.ownerId)) {
      const ownerName = (c.ownerName && String(c.ownerName).trim()) || 'Pemilik dana titipan';
      ownersMap.set(c.ownerId, { ownerId: c.ownerId, ownerName, allocatedPrincipal: 0, currentValue: 0, gain: 0, holdings: [] });
    }
  });

  // SESI 486 (Case F: Partial Return / Pengembalian Dana Titipan) —
  // jumlahkan riwayat `D.titipanReturns[]` per owner LEBIH DULU (di luar
  // loop owners.forEach di bawah, sama pola dgn `commitMap` di atas),
  // supaya `returnedTotal` tersedia tanpa iterasi ulang per owner.
  const returnsList = (D && Array.isArray(D.titipanReturns)) ? D.titipanReturns : [];
  const returnedMap = new Map();
  returnsList.forEach((r) => {
    if (!r || !r.ownerId) return;
    const amt = isFinite(r.amount) ? Number(r.amount) : 0;
    returnedMap.set(r.ownerId, (returnedMap.get(r.ownerId) || 0) + amt);
  });

  const owners = Array.from(ownersMap.values());
  owners.forEach((o) => {
    o.holdings.sort((x, y) => y.allocatedPrincipal - x.allocatedPrincipal);
    const commit = commitMap.get(o.ownerId);
    const principalAmount = commit ? (isFinite(commit.principalAmount) ? Number(commit.principalAmount) : 0) : null;
    let estimatedUnallocated = null;
    let overAllocatedAmount = 0;
    let allocationStatus = 'PRINCIPAL_NOT_SET';
    if (principalAmount !== null) {
      if (o.allocatedPrincipal > principalAmount) {
        allocationStatus = 'OVER_ALLOCATED';
        estimatedUnallocated = 0;
        overAllocatedAmount = o.allocatedPrincipal - principalAmount;
      } else {
        allocationStatus = 'OK';
        estimatedUnallocated = principalAmount - o.allocatedPrincipal;
      }
    }
    o.principalAmount = principalAmount;
    o.estimatedUnallocated = estimatedUnallocated;
    o.overAllocatedAmount = overAllocatedAmount;
    o.allocationStatus = allocationStatus;
    // SESI 486 — `returnedTotal` SELALU angka (default 0, bukan null —
    // beda dari `principalAmount`: "belum pernah kembali sepeser pun"
    // dan "belum ada data pokok" adalah 2 hal berbeda).
    // `outstandingPrincipal` derived (TIDAK disimpan ke D sama sekali,
    // sesuai rencana sesi): null kalau `principalAmount` null
    // (PRINCIPAL_NOT_SET — konsisten dgn `estimatedUnallocated`), kalau
    // tidak `max(0, principalAmount - returnedTotal)` (tidak pernah
    // negatif meski returnedTotal > principalAmount / kelebihan bayar).
    const returnedTotal = returnedMap.get(o.ownerId) || 0;
    o.returnedTotal = returnedTotal;
    o.outstandingPrincipal = (principalAmount !== null) ? Math.max(0, principalAmount - returnedTotal) : null;
  });
  owners.sort((a, b) => b.allocatedPrincipal - a.allocatedPrincipal);

  const totals = owners.reduce((acc, o) => {
    acc.allocatedPrincipalTotal += o.allocatedPrincipal;
    acc.currentValueTotal += o.currentValue;
    acc.gainTotal += o.gain;
    if (o.principalAmount !== null) {
      acc.principalAmountTotal += o.principalAmount;
      acc.estimatedUnallocatedTotal += (o.estimatedUnallocated || 0);
      acc.outstandingPrincipalTotal += o.outstandingPrincipal;
    }
    acc.overAllocatedTotal += o.overAllocatedAmount;
    acc.returnedTotalSum += o.returnedTotal;
    return acc;
  }, {
    allocatedPrincipalTotal: 0, currentValueTotal: 0, gainTotal: 0,
    principalAmountTotal: 0, estimatedUnallocatedTotal: 0, overAllocatedTotal: 0,
    returnedTotalSum: 0, outstandingPrincipalTotal: 0,
  });
  return { owners, totals };
},

// listExistingOwners() — Sesi 485a (Gap #3 audit, langkah 1/5: fondasi
// data model + owner picker, READ-ONLY). Kumpulkan daftar owner UNIK
// (by `ownerId`, BUKAN `ownerName` — dua owner beda `ownerId` dgn nama
// sama TETAP 2 entri terpisah, sesuai keputusan audit: ownerId adalah
// identity, ownerName cuma display) dari SELURUH holding investasi yang
// ada sekarang, 100% reuse `Investment.getHoldings()`/`getOwners(h)`
// (0 sumber data baru, 0 registry baru — TIDAK ada `D.titipanOwners[]`).
//
// Dipakai sebagai sumber dropdown "Pilih Owner" di form komitmen (sesi
// UI, S485d) — supaya ownerId TIDAK PERNAH diketik manual oleh user
// (mencegah user membuat identity baru yang tidak dikenal sistem).
// Owner SELF tetap DIKECUALIKAN (pola sama build(): `.filter((o) =>
// !o.isSelf)`) — dana titipan hanya utk owner non-SELF.
//
// CATATAN LEGACY COLLISION (audit, TIDAK diperbaiki sesi ini — lihat
// investasi.js Investment.getOwners(): holding legacy `fundSource:
// 'titipan'` SELALU balik ownerId literal 'titipan_investor' apa pun
// isi `titipanOwner`-nya). Konsekuensi: kalau ada 2 holding legacy milik
// 2 orang berbeda (mis. Budi & Cici, keduanya lewat fundSource:'titipan'
// tanpa h.owners[]), keduanya collapse jadi 1 entri di sini dgn
// `ownerId:'titipan_investor'` (ownerName = milik holding yang diproses
// PERTAMA, sesuai urutan Investment.getHoldings()). Ini BUKAN bug baru
// sesi ini — PRE-EXISTING/OUT OF SCOPE, didokumentasikan di
// SESSION-NOTE, TIDAK di-patch (dilarang oleh keputusan audit: dilarang
// migrate ownerId/rewrite legacy holdings/ubah getOwners()).
//
// Parameter: tidak ada.
// Return: array `{ownerId, ownerName}`, urutan mengikuti kemunculan
//   pertama tiap ownerId di `Investment.getHoldings()` (deterministik,
//   TIDAK di-sort ulang di sini — sorting jadi tanggung jawab caller/UI
//   kalau perlu, supaya fungsi ini tetap murni "kumpulkan & dedup").
listExistingOwners() {
  if (typeof Investment === 'undefined' || typeof Investment.getHoldings !== 'function') return [];
  if (typeof Investment.getOwners !== 'function') return [];
  const seen = new Set();
  const result = [];
  const holdings = Investment.getHoldings() || [];
  holdings.forEach((h) => {
    if (!h) return;
    const owners = Investment.getOwners(h);
    if (!Array.isArray(owners)) return;
    owners.forEach((o) => {
      if (!o || o.isSelf) return;
      if (!o.ownerId) return;
      if (seen.has(o.ownerId)) return;
      seen.add(o.ownerId);
      const ownerName = (o.ownerName && String(o.ownerName).trim()) || 'Pemilik dana titipan';
      result.push({ ownerId: o.ownerId, ownerName });
    });
  });
  return result;
},

// getCommitments() — Sesi 485b, getter read-only. Init lazy (pola sama
// `D.investmentWatchlist`): TIDAK menulis `D.titipanCommitments` kalau
// belum ada, cuma balikin array kosong (biar getter murni tidak punya
// side-effect nulis ke `D`).
// Return: array `D.titipanCommitments` apa adanya (atau `[]`).
getCommitments() {
  return (D && D.titipanCommitments) || [];
},

// saveCommitment({ownerId, ownerName, principalAmount, committedDate,
// notes}) — Sesi 485b (Gap #3 audit, langkah 2/5). Upsert by `ownerId`
// ke `D.titipanCommitments[]`. **existing-owner-only**: `ownerId` WAJIB
// sudah muncul di `listExistingOwners()` (owner picker read-only, Sesi
// 485a) — fungsi ini TIDAK PERNAH membuat identity `ownerId` baru yang
// tidak dikenal sistem (mencegah user "ketik nama sendiri" bikin owner
// hantu yang tidak nyambung ke holding manapun).
//
// Validasi (throw Error kalau gagal, TIDAK menulis apa pun ke `D` kalau
// validasi gagal — atomic per panggilan):
//   - `ownerId` wajib diisi & harus ada di `listExistingOwners()`.
//   - `principalAmount` wajib numerik (`isFinite`) & >= 0 (dilarang
//     negatif — pokok dana titipan tidak bisa minus).
//
// Upsert: kalau sudah ada record dgn `ownerId` sama -> update in place
// (field yang di-pass `undefined` dipertahankan nilai lama, pola sama
// `Investment.updateWatch()`), TIDAK push duplikat. Kalau belum ada ->
// push record baru dgn `id: uid()`.
//
// ISOLASI TOTAL (HARD RULE sesi ini): fungsi ini HANYA menyentuh
// `D.titipanCommitments` (+ panggil `save()` kalau tersedia, pola sama
// semua CRUD lain di codebase ini) — 0 sentuhan ke `D.accounts`,
// `D.transactions`, `D.investmentTx`, `D.investments`, `D.debts` (lihat
// test regresi assert deep-equal sebelum/sesudah selain
// `titipanCommitments`).
//
// Return: record commitment yang tersimpan (`{id, ownerId, ownerName,
//   principalAmount, committedDate, notes, createdAt, updatedAt}`).
saveCommitment(input) {
  const params = input || {};
  const ownerId = params.ownerId;
  if (!ownerId) throw new Error('Owner wajib dipilih');
  const known = this.listExistingOwners().find((o) => o.ownerId === ownerId);
  if (!known) throw new Error('Owner tidak ditemukan pada daftar pemilik investasi yang ada');
  const principalAmount = Number(params.principalAmount);
  if (!isFinite(principalAmount) || principalAmount < 0) {
    throw new Error('Pokok dana titipan harus berupa angka >= 0');
  }
  D.titipanCommitments = D.titipanCommitments || [];
  const ownerName = (params.ownerName && String(params.ownerName).trim()) || known.ownerName;
  const now = Date.now();
  let record = D.titipanCommitments.find((c) => c && c.ownerId === ownerId);
  if (record) {
    record.ownerName = ownerName;
    record.principalAmount = principalAmount;
    if (params.committedDate !== undefined) record.committedDate = params.committedDate;
    if (params.notes !== undefined) record.notes = params.notes;
    record.updatedAt = now;
  } else {
    record = {
      id: (typeof uid === 'function') ? uid() : ('tc_' + now),
      ownerId,
      ownerName,
      principalAmount,
      committedDate: params.committedDate || '',
      notes: params.notes || '',
      createdAt: now,
      updatedAt: now,
    };
    D.titipanCommitments.push(record);
  }
  if (typeof save === 'function') save();
  return record;
},

// getReturns(ownerId) — Sesi 486 (Case F: Partial Return / Pengembalian
// Dana Titipan, lihat RENCANA-SESI-CASEF-PARTIAL-RETURN-S486.md).
// Getter read-only, pola sama getCommitments(). Tanpa `ownerId` -> semua
// record `D.titipanReturns`. Dengan `ownerId` -> difilter utk owner itu
// saja (dipakai render() riwayat per owner & DanaTitipanReturnUI).
getReturns(ownerId) {
  const all = (D && Array.isArray(D.titipanReturns)) ? D.titipanReturns : [];
  if (!ownerId) return all;
  return all.filter((r) => r && r.ownerId === ownerId);
},

// recordReturn({ownerId, ownerName, amount, returnDate, notes}) —
// Sesi 486 (Case F). Catat 1 baris pengembalian dana titipan ke
// `D.titipanReturns[]` — ini LOG/riwayat, BUKAN upsert seperti
// saveCommitment(): satu owner bisa punya banyak baris pengembalian dari
// waktu ke waktu, semua tersimpan apa adanya, tidak ada yang ditimpa.
//
// existing-owner-only, pola SAMA PERSIS saveCommitment() (Sesi 485b):
// `ownerId` wajib sudah ada di `listExistingOwners()` — fungsi ini TIDAK
// PERNAH membuat identity `ownerId` baru. Validasi (throw Error kalau
// gagal, TIDAK menulis apa pun ke `D` kalau gagal — atomic):
//   - `ownerId` wajib diisi & dikenal.
//   - `amount` wajib numerik (`isFinite`) & >= 0 (dilarang negatif —
//     kalau perlu koreksi, hapus baris via deleteReturn() lalu catat
//     ulang, pola sama "hapus lalu catat ulang" InvestmentTxUI.deleteTx()
//     — fungsi ini SENGAJA tidak punya updateReturn()).
//
// ISOLASI TOTAL (HARD RULE sesi ini, sama seperti saveCommitment()):
// fungsi ini HANYA menyentuh `D.titipanReturns` (+ panggil `save()` kalau
// tersedia) — 0 sentuhan ke `D.accounts`, `D.transactions`,
// `D.investmentTx`, `D.investments`, `D.debts`.
//
// Return: record pengembalian yang tersimpan (`{id, ownerId, ownerName,
//   amount, returnDate, notes, createdAt}`).
recordReturn(input) {
  const params = input || {};
  const ownerId = params.ownerId;
  if (!ownerId) throw new Error('Owner wajib dipilih');
  const known = this.listExistingOwners().find((o) => o.ownerId === ownerId);
  if (!known) throw new Error('Owner tidak ditemukan pada daftar pemilik investasi yang ada');
  const amount = Number(params.amount);
  if (!isFinite(amount) || amount < 0) {
    throw new Error('Nominal pengembalian harus berupa angka >= 0');
  }
  D.titipanReturns = D.titipanReturns || [];
  const ownerName = (params.ownerName && String(params.ownerName).trim()) || known.ownerName;
  const now = Date.now();
  const record = {
    id: (typeof uid === 'function') ? uid() : ('tr_' + now),
    ownerId,
    ownerName,
    amount,
    returnDate: params.returnDate || '',
    notes: params.notes || '',
    createdAt: now,
  };
  D.titipanReturns.push(record);
  if (typeof save === 'function') save();
  return record;
},

// deleteReturn(id) — Sesi 486 (Case F). Hapus 1 baris riwayat
// pengembalian by `id`. Return `true` kalau ada yang terhapus, `false`
// kalau `id` tidak ditemukan (TIDAK throw — pola sama getter/delete
// read-only-safe lain di codebase ini). ISOLASI TOTAL: HANYA menyentuh
// `D.titipanReturns`.
deleteReturn(id) {
  if (!(D && Array.isArray(D.titipanReturns))) return false;
  const idx = D.titipanReturns.findIndex((r) => r && String(r.id) === String(id));
  if (idx === -1) return false;
  D.titipanReturns.splice(idx, 1);
  if (typeof save === 'function') save();
  return true;
},

};

// DanaTitipanPortfolioPresenter — UI read-only di area Dana Kelolaan yang
// SUDAH ADA (kartu #danaKelolaanLapCard, tab Laporan Keuangan), container
// baru #danaTitipanPortfolioList ditaruh SETELAH
// #danaKelolaanTitipanDetailList (dana-kelolaan-presenter.js) di kartu yang
// sama — pola sama persis (baca-saja, guard container opsional, 0 CSS
// baru: reuse `<details>`/`<summary>` native browser utk expand per owner,
// class `u-flex`/`u-jcb`/`u-fs11`/`u-t2`/`u-fw700` yang sudah dipakai
// `renderTitipanDetail()`). TIDAK mengubah modal "Atur Porsi Kepemilikan"
// (`investasi-view.js`) sama sekali.
const DanaTitipanPortfolioPresenter = {

  _money(n) {
    return (typeof fmtFull === 'function') ? fmtFull(n) : ((typeof fmt === 'function') ? fmt(n) : ('Rp ' + Math.round(n || 0)));
  },

  _gainCls(n) {
    if (n > 0) return 'green';
    if (n < 0) return 'red';
    return '';
  },

  // _principalCell(o) — Sesi 485d: tampilkan "Pokok Dikomit" per owner.
  // "Belum dicatat" (BUKAN "Rp0") kalau owner ini belum punya record
  // commitment sama sekali (`principalAmount === null`, lihat build() S485c
  // — sengaja tidak didefault ke 0 supaya "belum pernah diisi" & "sudah
  // diisi 0" tetap kebedakan di tampilan).
  _principalCell(o) {
    if (o.principalAmount === null) return '<span class="u-t2">Belum dicatat</span>';
    return `<span class="u-fw700">${this._money(o.principalAmount)}</span>`;
  },

  // _unallocatedCell(o) — Sesi 485d: label WAJIB "Estimasi Belum
  // Teralokasi" (bukan Kas/Saldo/Dana Tersisa, sesuai rencana sesi —
  // angka ini estimasi dari pokok dikomit dikurangi yang sudah masuk
  // holding, BUKAN saldo kas riil). "Belum dicatat" kalau
  // PRINCIPAL_NOT_SET (estimatedUnallocated null dari build()), badge
  // ⚠️ + tampilkan kelebihan alokasi kalau OVER_ALLOCATED.
  _unallocatedCell(o) {
    if (o.allocationStatus === 'PRINCIPAL_NOT_SET') return '<span class="u-t2">Belum dicatat</span>';
    if (o.allocationStatus === 'OVER_ALLOCATED') {
      return `<span class="u-fw700 red">⚠️ Lebih ${this._money(o.overAllocatedAmount)}</span>`;
    }
    return `<span class="u-fw700">${this._money(o.estimatedUnallocated)}</span>`;
  },

  // _outstandingCell(o) — Sesi 486 (Case F). Label WAJIB "Pokok Belum
  // Dikembalikan" (bukan "Outstanding", sesuai rencana sesi). "Belum
  // dicatat" kalau PRINCIPAL_NOT_SET (outstandingPrincipal null dari
  // build() — konsisten dgn `_principalCell()`/`_unallocatedCell()`).
  _outstandingCell(o) {
    if (o.outstandingPrincipal === null) return '<span class="u-t2">Belum dicatat</span>';
    return `<span class="u-fw700">${this._money(o.outstandingPrincipal)}</span>`;
  },

  // _returnsHistoryHtml(ownerId) — Sesi 486 (Case F). Riwayat baris
  // pengembalian per owner, 100% konsumsi
  // `DanaTitipanPortfolioAPI.getReturns(ownerId)` (0 agregasi baru di
  // sini — total sudah dihitung `build()`). Kosong -> string kosong
  // (TIDAK render heading "Riwayat" kalau tidak ada isi, pola sama
  // `o.holdings.map()` di atas yang juga diam kalau kosong).
  // `notes` WAJIB lewat `escapeHtml()` (field user-controlled, sama
  // seperti `ownerName`).
  _returnsHistoryHtml(ownerId) {
    if (typeof DanaTitipanPortfolioAPI === 'undefined') return '';
    const list = DanaTitipanPortfolioAPI.getReturns(ownerId) || [];
    if (!list.length) return '';
    return `
          <div class="u-fs11 u-t2 u-ml10 u-mt4">Riwayat pengembalian:</div>
          ${list.map((r) => `
            <div class="u-flex u-jcb u-fs11 u-mb2 u-ml10">
              <span>↩️ ${this._money(r.amount)}${r.returnDate ? ` <span class="u-t2">(${escapeHtml(r.returnDate)})</span>` : ''}${r.notes ? ` <span class="u-t2">— ${escapeHtml(r.notes)}</span>` : ''}</span>
              <button type="button" class="card-setting-btn" data-action="DanaTitipanReturnUI.deleteEntry" data-args='["${r.id}"]' aria-label="Hapus riwayat pengembalian">🗑️</button>
            </div>
          `).join('')}`;
  },

  render() {
    const el = document.getElementById('danaTitipanPortfolioList');
    if (!el) return; // container belum ada di halaman ini, aman diam2ny (pola sama presenter lain).
    if (typeof DanaTitipanPortfolioAPI === 'undefined') return;

    const projection = DanaTitipanPortfolioAPI.build();
    // Sesi 485d — tombol buka modal "💰 Pokok Dana Titipan" (murni
    // konsumsi API sesi 485a-c: listExistingOwners()/saveCommitment(),
    // 0 logika CRUD/projection baru ditulis di sini). Selalu ditampilkan
    // di atas (bukan cuma saat owners.length>0) supaya owner yang baru
    // saja dapat porsi holding (jadi listExistingOwners()) tapi belum
    // pernah dicatat pokoknya tetap bisa langsung dicatat dari sini.
    const addBtn = '<button type="button" class="btn btn-ghost btn-full btn-sm u-mb8" data-action="DanaTitipanCommitmentUI.open">💰 Catat/Update Pokok Dana Titipan</button>';
    if (!projection.owners.length) {
      el.innerHTML = addBtn + '<div class="u-fs11 u-t2 u-mt6">Belum ada porsi dana titipan yang teralokasi ke holding investasi.</div>';
      return;
    }

    el.innerHTML = addBtn + `
      <div class="u-fs11 u-t2 u-mt10 u-mb4">Dana titipan dalam investasi (per pemilik, teralokasi ke instrumen):</div>
      ${projection.owners.map((o) => `
        <details class="u-mb6">
          <summary class="u-flex u-jcb u-fs12 u-pointer">
            <span>${o.allocationStatus === 'OVER_ALLOCATED' ? '⚠️ ' : ''}👤 ${escapeHtml(o.ownerName)}</span>
            <span>
              <span class="u-t2">Pokok</span> <span class="u-fw700">${this._money(o.allocatedPrincipal)}</span>
              &nbsp;→&nbsp;
              <span class="u-t2">Kini</span> <span class="u-fw700">${this._money(o.currentValue)}</span>
              &nbsp;<span class="u-fw700 ${this._gainCls(o.gain)}">${o.gain >= 0 ? '+' : ''}${this._money(o.gain)}</span>
            </span>
          </summary>
          <div class="u-fs11 u-mb4 u-ml10" style="display:grid;grid-template-columns:1fr 1fr;gap:4px 10px">
            <span class="u-t2">Pokok Dikomit</span><span>${this._principalCell(o)}</span>
            <span class="u-t2">Teralokasi ke Holding</span><span class="u-fw700">${this._money(o.allocatedPrincipal)}</span>
            <span class="u-t2">Estimasi Belum Teralokasi</span><span>${this._unallocatedCell(o)}</span>
            <span class="u-t2">Nilai Saat Ini</span><span class="u-fw700">${this._money(o.currentValue)}</span>
            <span class="u-t2">Untung-Rugi</span><span class="u-fw700 ${this._gainCls(o.gain)}">${o.gain >= 0 ? '+' : ''}${this._money(o.gain)}</span>
            <span class="u-t2">Sudah Dikembalikan</span><span class="u-fw700">${this._money(o.returnedTotal)}</span>
            <span class="u-t2">Pokok Belum Dikembalikan</span><span>${this._outstandingCell(o)}</span>
          </div>
          <button type="button" class="btn btn-ghost btn-sm u-mb6 u-ml10" data-action="DanaTitipanCommitmentUI.open" data-args='["${o.ownerId}"]'>✏️ Atur Pokok Dana Titipan</button>
          <button type="button" class="btn btn-ghost btn-sm u-mb6 u-ml10" data-action="DanaTitipanReturnUI.open" data-args='["${o.ownerId}"]'>↩️ Catat Pengembalian</button>
          ${this._returnsHistoryHtml(o.ownerId)}
          ${o.holdings.map((hh) => `
            <div class="u-flex u-jcb u-fs11 u-mb2 u-ml10">
              <span>📈 ${escapeHtml(hh.name)} <span class="u-t2">(${hh.ownerPct}%)</span></span>
              <span>
                <span class="u-t2">${this._money(hh.allocatedPrincipal)} → ${this._money(hh.currentValue)}</span>
                &nbsp;<span class="${this._gainCls(hh.gain)}">${hh.gain >= 0 ? '+' : ''}${this._money(hh.gain)}</span>
              </span>
            </div>
          `).join('')}
        </details>
      `).join('')}
      <div class="u-flex u-jcb u-fs12 u-mt6 u-pt6" style="border-top:1px dashed var(--border,#ddd)">
        <span class="u-fw700">Total Teralokasi</span>
        <span>
          <span class="u-fw700">${this._money(projection.totals.allocatedPrincipalTotal)}</span>
          → <span class="u-fw700">${this._money(projection.totals.currentValueTotal)}</span>
          &nbsp;<span class="u-fw700 ${this._gainCls(projection.totals.gainTotal)}">${projection.totals.gainTotal >= 0 ? '+' : ''}${this._money(projection.totals.gainTotal)}</span>
        </span>
      </div>
      <div class="u-flex u-jcb u-fs11 u-mt4">
        <span class="u-t2">Total Pokok Dikomit</span>
        <span class="u-fw700">${this._money(projection.totals.principalAmountTotal)}</span>
      </div>
      <div class="u-flex u-jcb u-fs11 u-mt2">
        <span class="u-t2">Total Estimasi Belum Teralokasi</span>
        <span class="u-fw700">${this._money(projection.totals.estimatedUnallocatedTotal)}</span>
      </div>
      ${projection.totals.overAllocatedTotal > 0 ? `
      <div class="u-flex u-jcb u-fs11 u-mt2">
        <span class="u-t2">⚠️ Total Kelebihan Alokasi</span>
        <span class="u-fw700 red">${this._money(projection.totals.overAllocatedTotal)}</span>
      </div>` : ''}
    `;
  },

};

// DanaTitipanCommitmentUI — Sesi 485d (Gap #3 audit, langkah 4/5 dari
// rencana multi-sesi — lihat RENCANA-SESI-GAP3-TITIPAN-COMMITMENT.md):
// modal CRUD "💰 Pokok Dana Titipan" (`titipanCommitmentModal`,
// modals.js), pola gabungan `investmentOwnersModal` (dropdown owner
// via listExistingOwners(), TIDAK BOLEH ketik nama bebas) +
// `investmentTxModal` (form tambah sederhana). MURNI konsumsi API sesi
// 485a-c (`DanaTitipanPortfolioAPI.listExistingOwners()`/
// `getCommitments()`/`saveCommitment()`) — 0 logika CRUD/projection
// baru ditulis di sini, file ini hanya baca input DOM & panggil API
// yang sudah ada + validasi (SUDAH ADA di saveCommitment()).
const DanaTitipanCommitmentUI = {

  // open(ownerId) — Sesi 485d. Isi dropdown owner dari
  // listExistingOwners() (bukan free-text — cegah user bikin identity
  // baru yang tidak nyambung ke holding manapun, sama alasan
  // listExistingOwners() sendiri, S485a). Kalau `ownerId` diberikan &
  // sudah punya record commitment tersimpan (getCommitments()), field
  // Pokok/Tanggal/Catatan diisi otomatis dari situ (mode edit) — kalau
  // tidak, form kosong (mode tambah baru, owner dipilih manual dari
  // dropdown).
  open(ownerId) {
    if (typeof DanaTitipanPortfolioAPI === 'undefined') { if (typeof toast === 'function') toast('⚠️ Fitur pokok dana titipan belum siap dimuat'); return; }
    const owners = DanaTitipanPortfolioAPI.listExistingOwners();
    const sel = document.getElementById('titipanCommitOwner');
    if (sel) {
      if (!owners.length) {
        sel.innerHTML = '<option value="">— Belum ada owner di holding investasi —</option>';
      } else {
        sel.innerHTML = owners.map((o) => `<option value="${o.ownerId}">${escapeHtml(o.ownerName)}</option>`).join('');
      }
      if (ownerId) sel.value = ownerId;
    }
    const existing = ownerId
      ? DanaTitipanPortfolioAPI.getCommitments().find((c) => c && c.ownerId === ownerId)
      : null;
    const principalEl = document.getElementById('titipanCommitPrincipal');
    if (principalEl) principalEl.value = existing ? existing.principalAmount : '';
    if (typeof updateAmtPreview === 'function') updateAmtPreview('titipanCommitPrincipal', 'titipanCommitPrincipalPreview');
    const dateEl = document.getElementById('titipanCommitDate');
    if (dateEl) dateEl.value = existing ? (existing.committedDate || '') : '';
    const notesEl = document.getElementById('titipanCommitNotes');
    if (notesEl) notesEl.value = existing ? (existing.notes || '') : '';
    if (typeof openModal === 'function') openModal('titipanCommitmentModal');
  },

  // save() — Sesi 485d. Baca form, panggil
  // `DanaTitipanPortfolioAPI.saveCommitment()` (S485b, validasi
  // existing-owner-only + principal>=0 SUDAH ADA di sana — 0 validasi
  // baru ditulis di sini). `saveCommitment()` melempar Error kalau
  // validasi gagal, dibungkus try/catch pola sama
  // `InvestmentUI.saveOwners()`.
  save() {
    if (typeof DanaTitipanPortfolioAPI === 'undefined') { if (typeof toast === 'function') toast('⚠️ Fitur pokok dana titipan belum siap dimuat'); return; }
    const sel = document.getElementById('titipanCommitOwner');
    const ownerId = sel ? sel.value : '';
    if (!ownerId) { if (typeof toast === 'function') toast('⚠️ Owner wajib dipilih'); return; }
    const ownerName = sel && sel.selectedOptions && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : '';
    const principalEl = document.getElementById('titipanCommitPrincipal');
    const principalAmount = principalEl ? principalEl.value : '';
    const committedDate = (document.getElementById('titipanCommitDate') || {}).value || '';
    const notes = (document.getElementById('titipanCommitNotes') || {}).value || '';
    try {
      DanaTitipanPortfolioAPI.saveCommitment({ ownerId, ownerName, principalAmount, committedDate, notes });
    } catch (e) {
      if (typeof toast === 'function') toast('⚠️ ' + ((e && e.message) ? e.message : 'Gagal menyimpan pokok dana titipan'));
      return;
    }
    if (typeof closeModal === 'function') closeModal('titipanCommitmentModal');
    if (typeof DanaTitipanPortfolioPresenter !== 'undefined') DanaTitipanPortfolioPresenter.render();
    if (typeof toast === 'function') toast('✅ Pokok dana titipan tersimpan');
  },

};

// DanaTitipanReturnUI — Sesi 486 (Case F: Partial Return / Pengembalian
// Dana Titipan, lihat RENCANA-SESI-CASEF-PARTIAL-RETURN-S486.md,
// lanjutan Gap #3 yang SUDAH SELESAI S485a-e). Modal "↩️ Catat
// Pengembalian" (`titipanReturnModal`, modals.js) — beda dari
// `titipanCommitmentModal`: field Owner di sini READONLY DISPLAY (bukan
// dropdown), karena pengembalian SELALU terikat ke owner yang sedang
// dibuka dari kartunya sendiri (bukan record baru bebas pilih owner).
// MURNI konsumsi API Sesi 486 (`DanaTitipanPortfolioAPI.recordReturn()`/
// `getReturns()`/`deleteReturn()`) — 0 logika CRUD baru ditulis di sini,
// pola SAMA PERSIS `DanaTitipanCommitmentUI` (S485d).
const DanaTitipanReturnUI = {

  // open(ownerId) — isi tampilan owner (readonly) dari
  // listExistingOwners() + kosongkan form (SELALU mode tambah baru —
  // riwayat pengembalian TIDAK PERNAH diedit, hanya ditambah/dihapus,
  // pola sama InvestmentTxUI "hapus lalu catat ulang").
  open(ownerId) {
    if (typeof DanaTitipanPortfolioAPI === 'undefined') { if (typeof toast === 'function') toast('⚠️ Fitur pengembalian dana titipan belum siap dimuat'); return; }
    const known = DanaTitipanPortfolioAPI.listExistingOwners().find((o) => o.ownerId === ownerId);
    const ownerDisplayEl = document.getElementById('titipanReturnOwnerDisplay');
    if (ownerDisplayEl) ownerDisplayEl.textContent = known ? known.ownerName : '';
    const ownerIdEl = document.getElementById('titipanReturnOwnerId');
    if (ownerIdEl) ownerIdEl.value = ownerId || '';
    const amountEl = document.getElementById('titipanReturnAmount');
    if (amountEl) amountEl.value = '';
    if (typeof updateAmtPreview === 'function') updateAmtPreview('titipanReturnAmount', 'titipanReturnAmountPreview');
    const dateEl = document.getElementById('titipanReturnDate');
    if (dateEl) dateEl.value = '';
    const notesEl = document.getElementById('titipanReturnNotes');
    if (notesEl) notesEl.value = '';
    if (typeof openModal === 'function') openModal('titipanReturnModal');
  },

  // save() — baca form, panggil `DanaTitipanPortfolioAPI.recordReturn()`
  // (validasi existing-owner-only + amount>=0 SUDAH ADA di sana — 0
  // validasi baru di sini). `recordReturn()` melempar Error kalau
  // validasi gagal, dibungkus try/catch pola sama
  // `DanaTitipanCommitmentUI.save()`.
  save() {
    if (typeof DanaTitipanPortfolioAPI === 'undefined') { if (typeof toast === 'function') toast('⚠️ Fitur pengembalian dana titipan belum siap dimuat'); return; }
    const ownerIdEl = document.getElementById('titipanReturnOwnerId');
    const ownerId = ownerIdEl ? ownerIdEl.value : '';
    if (!ownerId) { if (typeof toast === 'function') toast('⚠️ Owner wajib dipilih'); return; }
    const ownerDisplayEl = document.getElementById('titipanReturnOwnerDisplay');
    const ownerName = ownerDisplayEl ? ownerDisplayEl.textContent : '';
    const amountEl = document.getElementById('titipanReturnAmount');
    const amount = amountEl ? amountEl.value : '';
    const returnDate = (document.getElementById('titipanReturnDate') || {}).value || '';
    const notes = (document.getElementById('titipanReturnNotes') || {}).value || '';
    try {
      DanaTitipanPortfolioAPI.recordReturn({ ownerId, ownerName, amount, returnDate, notes });
    } catch (e) {
      if (typeof toast === 'function') toast('⚠️ ' + ((e && e.message) ? e.message : 'Gagal mencatat pengembalian dana titipan'));
      return;
    }
    if (typeof closeModal === 'function') closeModal('titipanReturnModal');
    if (typeof DanaTitipanPortfolioPresenter !== 'undefined') DanaTitipanPortfolioPresenter.render();
    if (typeof toast === 'function') toast('✅ Pengembalian dana titipan tercatat');
  },

  // deleteEntry(id) — hapus 1 baris riwayat pengembalian, `askConfirm()`
  // dulu (pola sama `InvestmentTxUI.deleteTx()`), 100% reuse
  // `DanaTitipanPortfolioAPI.deleteReturn()` (0 logic baru).
  async deleteEntry(id) {
    if (typeof DanaTitipanPortfolioAPI === 'undefined') return;
    if (typeof askConfirm === 'function') {
      const ok = await askConfirm('Hapus riwayat pengembalian ini?', { okText: 'Ya, Hapus' });
      if (!ok) return;
    }
    DanaTitipanPortfolioAPI.deleteReturn(id);
    if (typeof DanaTitipanPortfolioPresenter !== 'undefined') DanaTitipanPortfolioPresenter.render();
    if (typeof toast === 'function') toast('🗑️ Riwayat pengembalian dihapus');
  },

};

if (typeof window !== 'undefined') {
  window.DanaTitipanCommitmentUI = DanaTitipanCommitmentUI;
  window.DanaTitipanReturnUI = DanaTitipanReturnUI;
}
