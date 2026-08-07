'use strict';
// tests/asset-owners-linked-account-resync-s422e.test.js — Sesi 422e:
// saveOwners() (modal ⚖️ Atur Porsi Kepemilikan) sekarang ikut resync
// baseBalance/balance akun tertaut (a.accountId) ke ownPortion porsi BARU,
// reuse pola txDelta yang sama dgn Aset.save() (S-C). Sebelum sesi ini,
// ubah porsi lewat modal TIDAK pernah kepropagasi ke saldo akun tertaut --
// cuma ke Kekayaan Bersih/Zakat (S422d) & tampilan render (S422c).

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/loadSource');

function makeCtx(D) {
  let _n = 0;
  return loadSource(
    ['modules/shared/ownership-engine.js', 'modules/shared/multi-owner-engine.js', 'modules/finance/akun.js', 'modules/asset/aset.js'],
    {
      D,
      escapeHtml: (s) => String(s),
      uid: () => 'owner_' + (_n += 1),
      sameId: (a, b) => String(a) === String(b),
      save: () => { if (typeof invalidateAccBalCache === 'function') invalidateAccBalCache(); },
      toast: () => {},
    },
    ['OwnershipEngine', 'MultiOwnerEngine', 'Aset', 'recalcAccBalance']
  );
}

test('saveOwners() — porsi SELF diubah -> baseBalance akun tertaut ikut resync (0 transaksi historis)', () => {
  const D = {
    assets: [{ id: 'as1', name: 'Ruko Patungan', nilai: 1000000000, accountId: 'acc1', owners: [{ ownerId: 'SELF', porsi: 60 }, { ownerId: 'budi', porsi: 40, ownerName: 'Budi' }] }],
    accounts: [{ id: 'acc1', name: 'Rek Patungan', baseBalance: 600000000, includeInBalance: true }],
    transactions: [],
  };
  const ctx = makeCtx(D);
  ctx.Aset.renderList = () => {};
  ctx.Aset._ownersModalAsset = D.assets[0];
  ctx.Aset._ownersDraft = [
    { ownerId: 'SELF', ownerName: 'Milik Sendiri', porsi: 80, isSelf: true },
    { ownerId: 'budi', ownerName: 'Budi', porsi: 20, isSelf: false },
  ];
  ctx.Aset.saveOwners();
  const acc = D.accounts.find((a) => a.id === 'acc1');
  // porsi SELF naik 60% -> 80%, ownPortion baru = 1000000000*80% = 800000000
  assert.equal(acc.baseBalance, 800000000);
  assert.equal(acc.balance, 800000000);
});

test('saveOwners() — akun tertaut sudah punya riwayat transaksi -> txDelta tetap dipertahankan (bukan ditimpa)', () => {
  const D = {
    assets: [{ id: 'as1', name: 'Ruko Patungan', nilai: 1000000000, accountId: 'acc1', owners: [{ ownerId: 'SELF', porsi: 60 }, { ownerId: 'budi', porsi: 40, ownerName: 'Budi' }] }],
    accounts: [{ id: 'acc1', name: 'Rek Patungan', baseBalance: 600000000, includeInBalance: true }],
    // transaksi manual di akun tertaut: +50000000 (mis. bayar sewa masuk)
    transactions: [{ id: 't1', accountId: 'acc1', type: 'income', amount: 50000000, date: '2026-01-01' }],
  };
  const ctx = makeCtx(D);
  ctx.Aset.renderList = () => {};
  ctx.Aset._ownersModalAsset = D.assets[0];
  ctx.Aset._ownersDraft = [
    { ownerId: 'SELF', ownerName: 'Milik Sendiri', porsi: 80, isSelf: true },
    { ownerId: 'budi', ownerName: 'Budi', porsi: 20, isSelf: false },
  ];
  ctx.Aset.saveOwners();
  const acc = D.accounts.find((a) => a.id === 'acc1');
  // ownPortion baru = 800000000, txDelta lama (+50000000) TETAP dipertahankan
  // di atas baseBalance baru (bukan ditimpa/dihilangkan): baseBalance jadi
  // 800000000-50000000=750000000, supaya baseBalance+tx = 800000000 lagi.
  assert.equal(acc.baseBalance, 750000000);
  assert.equal(acc.balance, 800000000);
});

test('saveOwners() — aset TIDAK tertaut ke akun apa pun -> tidak ada perubahan D.accounts (0 regresi)', () => {
  const D = {
    assets: [{ id: 'as1', name: 'Tanah Patungan', nilai: 1000000000, owners: [{ ownerId: 'SELF', porsi: 60 }, { ownerId: 'budi', porsi: 40, ownerName: 'Budi' }] }],
    accounts: [{ id: 'acc1', name: 'Kas', baseBalance: 100000, includeInBalance: true }],
    transactions: [],
  };
  const ctx = makeCtx(D);
  ctx.Aset.renderList = () => {};
  ctx.Aset._ownersModalAsset = D.assets[0];
  ctx.Aset._ownersDraft = [
    { ownerId: 'SELF', ownerName: 'Milik Sendiri', porsi: 80, isSelf: true },
    { ownerId: 'budi', ownerName: 'Budi', porsi: 20, isSelf: false },
  ];
  ctx.Aset.saveOwners();
  assert.equal(D.accounts[0].baseBalance, 100000);
});
