'use strict';
// tests/s567-filtertx-owner-split.test.js — Sesi 567.
//
// Target eksplisit user (lanjutan sesi 566): "riwayat transaksi ... tiap
// transaksi (modal/pengeluaran) dipecah per porsi pemilik lalu ditotal per
// orang."
//
// Sebelum sesi ini, showFilteredTx(scope='account') (dipakai saat kartu
// akun "(via Aset)" diketuk) cuma menampilkan total flat (income-expense)
// -- tidak ada pemecahan per porsi pemilik sama sekali, walau akunnya
// tertaut ke Aset multi-owner.
//
// Fix: elemen baru #filterTxOwnerSplit (modals.js, filterTxModal) diisi
// HANYA kalau scope==='account' DAN akun itu tertaut (D.assets[].accountId)
// ke Aset yang MultiOwnerEngine.getOwners()-nya balikin owners. Modal
// (total income) & Pengeluaran (total expense) masing-masing dipecah per
// porsi lewat REUSE MultiOwnerEngine.splitByPorsi() (0 rumus baru, sama
// fungsi yang dipakai resolveTxAssetSplit() per-transaksi di transaksi.js)
// -- 0 perubahan untuk scope lain atau akun yang tidak tertaut.

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/loadSource');

function makeEl(initial = {}) {
  return { innerHTML: '', textContent: '', style: {}, ...initial };
}

function makeCtx(D) {
  const els = {
    filterTxTitle: makeEl(),
    filterTxSummary: makeEl(),
    filterTxOwnerSplit: makeEl(),
    filterTxList: makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {} }),
  };
  const fakeDoc = {
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {}, dataset: {}, querySelector: () => makeEl() }),
  };
  const ctx = loadSource(
    ['modules/shared/ownership-engine.js', 'modules/shared/multi-owner-engine.js', 'modules/finance/filter-laporan.js'],
    {
      document: fakeDoc,
      D,
      sameId: (a, b) => String(a) === String(b),
      fmt: (n) => 'Rp' + n,
      escapeHtml: (s) => String(s),
      txHTML: (t) => `<div data-id="${t.id}"></div>`,
      curMonth: 7,
      curYear: 2026,
      openModal: () => {},
    },
    ['MultiOwnerEngine']
  );
  return { ctx, els };
}

test('showFilteredTx(scope=account) — akun tertaut aset multi-owner -> Modal & Pengeluaran dipecah per porsi, lalu ditotal per orang', () => {
  const D = {
    assets: [{ id: 'as1', name: 'Majoris', accountId: 'acc1', owners: [{ ownerId: 'SELF', ownerName: 'renov', porsi: 80 }, { ownerId: 'sihab', ownerName: 'mas sihab', porsi: 20 }] }],
    transactions: [
      { id: 't1', accountId: 'acc1', type: 'income', amount: 1000000, date: '2026-08-01' },
      { id: 't2', accountId: 'acc1', type: 'expense', amount: 200000, date: '2026-08-02' },
    ],
  };
  const { ctx, els } = makeCtx(D);
  ctx.showFilteredTx('account', 'all', 'Akun Test', 'acc1');
  const html = els.filterTxOwnerSplit.innerHTML;
  assert.equal(els.filterTxOwnerSplit.style.display, 'block', 'blok porsi harus ditampilkan');
  assert.ok(html.includes('renov (80%)'), 'nama+porsi owner 1 harus tampil');
  assert.ok(html.includes('mas sihab (20%)'), 'nama+porsi owner 2 harus tampil');
  // Modal (income) 1.000.000: 80% -> 800000, 20% -> 200000
  assert.ok(html.includes('Modal Rp800000'), 'modal owner 1 harus 80% dari total income');
  assert.ok(html.includes('Modal Rp200000'), 'modal owner 2 harus 20% dari total income');
  // Pengeluaran (expense) 200.000: 80% -> 160000, 20% -> 40000
  assert.ok(html.includes('Pengeluaran Rp160000'), 'pengeluaran owner 1 harus 80% dari total expense');
  assert.ok(html.includes('Pengeluaran Rp40000'), 'pengeluaran owner 2 harus 20% dari total expense');
  // Total net (800000) tetap dipecah sesuai porsi
  assert.ok(html.includes('Total Rp640000'), 'total net owner 1 harus 80% dari net (800000)');
  assert.ok(html.includes('Total Rp160000'), 'total net owner 2 harus 20% dari net (800000)');
});

test('showFilteredTx(scope=account) — akun TIDAK tertaut ke aset apa pun -> #filterTxOwnerSplit tetap kosong/tersembunyi', () => {
  const D = {
    assets: [],
    transactions: [{ id: 't1', accountId: 'acc1', type: 'income', amount: 50000, date: '2026-08-01' }],
  };
  const { ctx, els } = makeCtx(D);
  ctx.showFilteredTx('account', 'all', 'Akun Test', 'acc1');
  assert.equal(els.filterTxOwnerSplit.innerHTML, '', 'tidak boleh ada isi porsi utk akun tidak tertaut');
  assert.equal(els.filterTxOwnerSplit.style.display, 'none', 'blok porsi harus tersembunyi');
});

test('showFilteredTx(scope!=="account") — misal scope "laporan" -> #filterTxOwnerSplit tetap kosong/tersembunyi walau ada aset multi-owner', () => {
  const D = {
    assets: [{ id: 'as1', accountId: 'acc1', owners: [{ ownerId: 'SELF', ownerName: 'renov', porsi: 100 }] }],
    transactions: [{ id: 't1', accountId: 'acc1', type: 'income', amount: 50000, date: '2026-08-01' }],
  };
  const { ctx, els } = makeCtx(D);
  ctx.curMonth = new Date('2026-08-01').getMonth();
  ctx.curYear = new Date('2026-08-01').getFullYear();
  ctx.getRange = () => ({ from: new Date('2026-01-01'), to: new Date('2026-12-31') });
  ctx.getLaporanFilters = () => ({});
  ctx.showFilteredTx('laporan', 'all', 'Laporan Test');
  assert.equal(els.filterTxOwnerSplit.innerHTML, '', 'scope selain account tidak boleh memicu blok porsi');
  assert.equal(els.filterTxOwnerSplit.style.display, 'none');
});

test('showFilteredTx(scope=account) — elemen #filterTxOwnerSplit tidak ada di DOM (halaman lain) -> tidak error', () => {
  const D = {
    assets: [{ id: 'as1', accountId: 'acc1', owners: [{ ownerId: 'SELF', ownerName: 'renov', porsi: 100 }] }],
    transactions: [{ id: 't1', accountId: 'acc1', type: 'income', amount: 50000, date: '2026-08-01' }],
  };
  const els = {
    filterTxTitle: makeEl(),
    filterTxSummary: makeEl(),
    filterTxList: makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {} }),
  };
  const fakeDoc = {
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {}, dataset: {}, querySelector: () => makeEl() }),
  };
  const ctx = loadSource(
    ['modules/shared/ownership-engine.js', 'modules/shared/multi-owner-engine.js', 'modules/finance/filter-laporan.js'],
    { document: fakeDoc, D, sameId: (a, b) => String(a) === String(b), fmt: (n) => 'Rp' + n, escapeHtml: (s) => String(s), txHTML: (t) => `<div data-id="${t.id}"></div>`, curMonth: 7, curYear: 2026, openModal: () => {} },
    ['MultiOwnerEngine']
  );
  assert.doesNotThrow(() => ctx.showFilteredTx('account', 'all', 'Akun Test', 'acc1'));
});
