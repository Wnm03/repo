'use strict';
/**
 * s434-linked-account-zero-and-tx-history.test.js — audit 2 laporan user:
 *
 * (1) "Riwayat transaksi tidak muncul saat akun diklik" — showFilteredTx()
 *     (modules/finance/filter-laporan.js) scope 'account' mencocokkan
 *     t.accountId===accId pakai strict equality. Kalau salah satu sisi
 *     angka & sisi lain string (mis. id dari data lama/import), match
 *     selalu gagal walau transaksinya benar-benar ada -> riwayat kosong.
 *     FIX: ganti ke sameId() (helper global, String(a)===String(b)).
 *
 * (2) "Nominal akun tertaut selalu 0" — SUDAH BENAR secara hitungan
 *     (MultiOwnerEngine.selfOwnedValue() SENGAJA cuma kasih porsi Milik
 *     Sendiri, supaya tidak dobel hitung sama Buku Aset -- lihat komentar
 *     panjang di aset.js/akun.js), tapi user tidak tahu KENAPA saldonya 0.
 *     FIX: openActionsMenu() (modules/asset/aset.js) sekarang menampilkan
 *     info numerik porsi Milik Sendiri di baris "🔗 Akun tertaut" -- 0
 *     perubahan hitungan, cuma tampilan.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/loadSource');

function makeEl(initial = {}) {
  return { innerHTML: '', textContent: '', style: {}, ...initial };
}

test('showFilteredTx(scope=account) — accId number vs t.accountId string tetap match (pakai sameId)', () => {
  const els = {
    filterTxTitle: makeEl(),
    filterTxSummary: makeEl(),
    filterTxList: makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {} }),
  };
  const fakeDoc = {
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {}, dataset: {}, querySelector: () => makeEl() }),
  };
  const D = {
    transactions: [
      { id: 't1', accountId: '501', type: 'income', amount: 50000, date: '2026-08-01' },
      { id: 't2', accountId: 501, type: 'expense', amount: 20000, date: '2026-08-02' },
      { id: 't3', accountId: '999', type: 'income', amount: 10000, date: '2026-08-03' },
    ],
  };
  const ctx = loadSource(['modules/finance/filter-laporan.js'], {
    document: fakeDoc,
    D,
    sameId: (a, b) => String(a) === String(b),
    fmt: (n) => 'Rp' + n,
    txHTML: (t) => `<div data-id="${t.id}"></div>`,
    curMonth: 7,
    curYear: 2026,
    openModal: () => {},
  });
  // accId dipanggil sbg angka (501), t.accountId di data ada yg string '501'
  // & ada yg angka 501 -- keduanya HARUS match dgn sameId().
  ctx.showFilteredTx('account', 'all', 'Akun Test', 501);
  assert.equal(els.filterTxList.innerHTML.includes('data-id="t1"'), true, 't1 (accountId string "501") harus ikut match');
  assert.equal(els.filterTxList.innerHTML.includes('data-id="t2"'), true, 't2 (accountId number 501) harus ikut match');
  assert.equal(els.filterTxList.innerHTML.includes('data-id="t3"'), false, 't3 (accountId beda, "999") tidak boleh ikut');
  assert.equal(els.filterTxSummary.textContent.includes('2 transaksi'), true, 'summary harus hitung 2 transaksi yg match');
});

test('showFilteredTx(scope=account) — regresi: accId & accountId sama-sama string tetap match', () => {
  const els = {
    filterTxTitle: makeEl(),
    filterTxSummary: makeEl(),
    filterTxList: makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {} }),
  };
  const fakeDoc = {
    getElementById: (id) => els[id] || null,
    createElement: () => makeEl({ insertAdjacentElement: () => {}, insertAdjacentHTML: () => {}, dataset: {}, querySelector: () => makeEl() }),
  };
  const D = {
    transactions: [
      { id: 't1', accountId: 'acc_abc', type: 'expense', amount: 5000, date: '2026-08-01' },
    ],
  };
  const ctx = loadSource(['modules/finance/filter-laporan.js'], {
    document: fakeDoc,
    D,
    sameId: (a, b) => String(a) === String(b),
    fmt: (n) => 'Rp' + n,
    txHTML: (t) => `<div data-id="${t.id}"></div>`,
    curMonth: 7,
    curYear: 2026,
    openModal: () => {},
  });
  ctx.showFilteredTx('account', 'all', 'Akun Test', 'acc_abc');
  assert.equal(els.filterTxList.innerHTML.includes('data-id="t1"'), true);
});

test('openActionsMenu() — akun tertaut dgn porsi Milik Sendiri < 100% menampilkan info saldo & nilai aset', () => {
  const els = {
    assetActionsTitle: makeEl(),
    assetActionsMeta: makeEl(),
    assetActionsList: makeEl(),
  };
  const fakeDoc = {
    getElementById: (id) => els[id] || null,
  };
  const asset = { id: 'a1', name: 'Rumah Kontrakan', jenis: 'Rumah/Bangunan', nilai: 1000000, accountId: 'acc1', owners: [{ ownerId: 'SELF', porsi: 30, ownerName: 'Milik Sendiri', isSelf: true }, { ownerId: 'inv1', porsi: 70, ownerName: 'Investor A', isSelf: false }] };
  const D = { assets: [asset], accounts: [{ id: 'acc1', name: 'BCA Sewa' }] };
  const MultiOwnerEngine = {
    selfOwnedValue(entity, nilai) {
      const owners = entity.owners || [];
      const selfPorsi = owners.filter((o) => o.isSelf).reduce((s, o) => s + o.porsi, 0);
      return nilai * (selfPorsi / 100);
    },
  };
  const ctx = loadSource(['modules/asset/aset.js'], {
    document: fakeDoc,
    D,
    sameId: (a, b) => String(a) === String(b),
    fmt: (n) => 'Rp' + n,
    escapeHtml: (s) => s,
    MultiOwnerEngine,
    openQS: () => {},
  }, ['Aset']);
  ctx.Aset.openActionsMenu('a1');
  const meta = els.assetActionsMeta.innerHTML;
  assert.equal(meta.includes('BCA Sewa'), true, 'nama akun tertaut harus tetap tampil');
  assert.equal(meta.includes('Rp300000'), true, 'saldo porsi Milik Sendiri (30% x 1.000.000) harus tampil');
  assert.equal(meta.includes('Rp1000000'), true, 'nilai penuh aset harus tampil sbg pembanding');
});
