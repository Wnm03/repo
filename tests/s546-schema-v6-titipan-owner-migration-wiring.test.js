'use strict';
/**
 * s546-schema-v6-titipan-owner-migration-wiring.test.js — DATA_MIGRATIONS
 * toVersion:6 (features-helpers-global-security.js): wiring resmi
 * Investment.migrateLegacyTitipanOwners() (Sesi 545) ke jalur migrasi data
 * formal, supaya jalan otomatis 1x saat boot (D.schemaVersion lama) MAUPUN
 * saat restore backup JSON lama (backup-restore.js juga panggil
 * runDataMigrations() — lihat komentar di file itu), bukan cuma tersedia
 * sebagai fungsi lepas yang harus dipanggil manual (S545).
 *
 * Pola sandbox sama persis tests/s354-billlinkid-dangling-migration.test.js
 * (load file migrasi ASLI + dependency-nya, bukan stub, lalu jalankan
 * runDataMigrations() beneran end-to-end).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/loadSource');

function makeCtx() {
  return loadSource(
    [
      'modules/shared/ownership-engine.js',
      'modules/shared/multi-owner-engine.js',
      'modules/shared/owner-registry.js',
      'modules/asset/investasi.js',
      'modules/shared/features-helpers-global-security.js',
    ],
    {
      DEFAULT_COBEK_KATEGORI: [], DEFAULT_CATS: { income: [], expense: [] }, DEFAULT_ACCOUNTS: [], DEFAULT_SPAREPARTS: [],
      uid: (() => { let n = 0; return () => 'uid_' + (n++); })(),
    },
    ['SCHEMA_VERSION', 'D', 'Investment', 'OwnerRegistry'],
  );
}

test('DATA_MIGRATIONS toVersion:6 — runDataMigrations() otomatis migrasi holding titipan legacy ke ownerId registry', () => {
  const ctx = makeCtx();
  ctx.D.schemaVersion = 5;
  ctx.D.investments = [
    { id: 'h1', name: 'Reksadana A', fundSource: 'titipan', titipanOwner: 'Budi' },
  ];
  ctx.D.debts = [];
  ctx.D.ownerRegistry = [];
  ctx.runDataMigrations(5);
  assert.equal(ctx.D.schemaVersion, ctx.SCHEMA_VERSION, 'schemaVersion harus naik ke SCHEMA_VERSION terbaru (6)');
  const h1 = ctx.D.investments.find((h) => h.id === 'h1');
  assert.ok(Array.isArray(h1.owners), 'holding legacy sekarang punya owners[] eksplisit');
  assert.notEqual(h1.owners[0].ownerId, 'titipan_investor', 'ownerId bukan literal lama lagi');
  assert.equal(h1.owners[0].ownerId, ctx.OwnerRegistry.findOrCreate('Budi'), 'ownerId sinkron dgn OwnerRegistry');
});

test('DATA_MIGRATIONS toVersion:6 — D.investments kosong/tidak ada -> tidak error, schemaVersion tetap naik', () => {
  const ctx = makeCtx();
  ctx.D.schemaVersion = 5;
  ctx.D.investments = [];
  ctx.D.debts = [];
  assert.doesNotThrow(() => ctx.runDataMigrations(5));
  assert.equal(ctx.D.schemaVersion, ctx.SCHEMA_VERSION);
});

test('DATA_MIGRATIONS toVersion:6 — holding yang SUDAH multi-owner (owners[] eksplisit) tidak disentuh migrasi', () => {
  const ctx = makeCtx();
  ctx.D.schemaVersion = 5;
  ctx.D.investments = [
    { id: 'h1', name: 'Reksadana A', fundSource: 'titipan', owners: [{ ownerId: 'owner_manual', porsi: 100, ownerName: 'Budi', isSelf: false }] },
  ];
  ctx.D.debts = [];
  ctx.runDataMigrations(5);
  assert.equal(ctx.D.investments[0].owners[0].ownerId, 'owner_manual');
});

test('DATA_MIGRATIONS toVersion:6 — data user yang SUDAH di schemaVersion 6 -> migrasi tidak jalan ulang (pending filter toVersion>v)', () => {
  const ctx = makeCtx();
  ctx.D.schemaVersion = 6;
  ctx.D.investments = [
    { id: 'h1', name: 'Reksadana A', fundSource: 'titipan', titipanOwner: 'Budi' },
  ];
  ctx.D.debts = [];
  ctx.runDataMigrations(6);
  const h1 = ctx.D.investments.find((h) => h.id === 'h1');
  assert.equal(h1.owners, undefined, 'migrasi toVersion:6 tidak dipanggil lagi krn fromVersion sudah 6');
});
