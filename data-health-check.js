// data-health-check.js — Cek integritas data lintas-domain (runDataHealthCheck): transaksi
// dengan akun/tanggal/jumlah tidak valid, ID duplikat, tagihan/aset/BBM dengan tautan akun atau
// kendaraan yang sudah dihapus, dll. Dipisah dari features-aiwidget-reminder-gdrive-search.js
// (Sesi 5 restrukturisasi folder, blok 2 — lihat AUDIT-STRUKTUR-FOLDER.md) murni pengelompokan
// ulang file, BUKAN perubahan perilaku. Taruh di /modules/shared karena baca lintas D.transactions/
// D.bills/D.assets/D.bbmLogs/D.vehicles/D.accounts.
//
// PERUBAHAN SESI INI (S268, audit ringan pra-migrasi bridge scan Keuangan->
// Stok — lihat NEXT_SESSION.md "Kandidat migrasi penuh"): tambah 1 cek warn
// baru "catalogId duplikat" di D.partsStock (baca-saja, 0 perubahan ke cek
// yang sudah ada). Rekomendasi lain hasil audit (audit 1-per-1 ke-9 file
// konsumen sync lain sebelum migrasi VehicleCatalog.getAll() penuh) SENGAJA
// belum dikerjakan sesi ini — di luar cakupan "paling ringan".

function runDataHealthCheck(){
const issues=[];
const accIds=new Set(D.accounts.map(a=>a.id));
const vehIds=new Set(D.vehicles.map(v=>v.id));
const txIds=new Set();
const dupTxIds=[];
D.transactions.forEach(t=>{
if(txIds.has(t.id))dupTxIds.push(t.id); else txIds.add(t.id);
if(t.accountId && !accIds.has(t.accountId)){
issues.push({level:'error',title:'Transaksi dengan akun tidak valid',detail:`"${t.note||t.category||t.id}" (${t.date||'?'}) menunjuk ke akun yang sudah dihapus.`});
}
if(!t.amount || isNaN(t.amount) || t.amount<=0){
issues.push({level:'error',title:'Transaksi dengan jumlah tidak valid',detail:`"${t.note||t.category||t.id}" (${t.date||'?'}) punya jumlah kosong/0/negatif.`});
}
if(!t.date || isNaN(new Date(t.date).getTime())){
issues.push({level:'error',title:'Transaksi dengan tanggal tidak valid',detail:`"${t.note||t.category||t.id}" punya tanggal kosong/rusak.`});
}
// PERUBAHAN SESI 402 (audit ringan, gap sama persis pola assetId Piutang/
// Utang di S401b): D.transactions[].assetId (dipilih via dropdown "Kaitkan
// ke Aset Multi-Owner" di modal Transaksi, lihat modules/finance/
// transaksi.js resolveTxAssetSplit()) bisa jadi orphan kalau asetnya sudah
// dihapus -- rincian pembagian ke pemilik (badge/preview "👥 N pemilik")
// otomatis "hilang" diam-diam (resolveTxAssetSplit balikin {ok:false},
// bukan crash), jadi user tidak pernah diberi tahu tautannya putus. Murni
// baca, sameId() sama persis cek assetId Piutang/Utang di atas (field ini
// juga dibaca lewat sameId() di resolveTxAssetSplit()), 0 perubahan ke cek
// lain.
if(t.assetId && !(D.assets||[]).some(a=>sameId(a.id,t.assetId))){
issues.push({level:'warn',title:'Transaksi tertaut ke Aset Multi-Owner yang sudah dihapus',detail:`"${t.note||t.category||t.id}" (${t.date||'?'}) masih menyimpan tautan ke aset multi-owner yang sudah dihapus -- rincian pembagian ke pemilik tidak lagi ditampilkan, cek/lepas tautannya di modal Transaksi.`});
}
});
if(dupTxIds.length){
issues.push({level:'error',title:'ID transaksi duplikat',detail:`${dupTxIds.length} transaksi punya ID yang sama (bisa bikin data ganda/salah hitung). ID: ${[...new Set(dupTxIds)].slice(0,5).join(', ')}${dupTxIds.length>5?'...':''}`});
}
D.bills.forEach(b=>{
if(b.accountId && !accIds.has(b.accountId)){
issues.push({level:'warn',title:'Tagihan dengan akun tidak valid',detail:`"${escapeHtml(b.name)}" menunjuk ke akun yang sudah dihapus.`});
}
});
(D.assets||[]).forEach(a=>{
if(a.accountId && !accIds.has(a.accountId)){
issues.push({level:'warn',title:'Aset dengan akun tautan tidak valid',detail:`"${escapeHtml(a.name)}" ditautkan ke akun yang sudah dihapus — akun tautan otomatis dianggap kosong, cek/lepas tautannya di modal Aset.`});
}
// PERUBAHAN SESI 501 (F3, AUDIT-SESI-B-PERLUASAN-ASET.md §3.2, follow-up
// dari Sesi B1/B2): aset yang punya KEDUANYA `a.ownership` non-SELF
// (whole-entity, dropdown Kepemilikan) DAN `a.owners[]` EKSPLISIT non-SELF
// (porsi majemuk, modal "Atur Porsi Kepemilikan") sekaligus -- kartu
// "Dana Kelolaan" (DanaKelolaan.sumAssets(), 100% a.nilai sbg 1 tipe
// generik) vs tab "Dana Titipan" (DanaTitipanPortfolioAPI.build(), HANYA
// porsi owners[] per orang) bisa menampilkan pecahan BERBEDA utk aset yang
// sama -- BUKAN dobel-hitung di mana pun (2 angka ini tidak pernah
// dijumlah bareng), tapi bisa bikin user bingung ("kok di Dana Kelolaan
// keitung 100rb, di Dana Titipan cuma 60rb"). Murni deteksi+beritahu
// (level warn, 0 mutasi data, 0 perubahan ke sumAssets()/build() itu
// sendiri -- REKOMENDASI audit F3 SENGAJA bukan mengubah rumus salah satu
// sisi, karena keduanya "benar" utk definisi masing-masing/whole-entity vs
// porsi eksplisit, cuma perlu USER TAHU ada 2 sumber kebenaran berbeda utk
// aset itu). Guard ganda typeof OwnershipEngine/MultiOwnerEngine (pola
// sama semua guard lain di file ini) -- kalau salah satu belum dimuat, cek
// ini diam saja (0 false-positive).
if(typeof OwnershipEngine!=='undefined' && typeof MultiOwnerEngine!=='undefined' && typeof MultiOwnerEngine.getOwners==='function'){
const ownType=OwnershipEngine.resolve?OwnershipEngine.resolve(a).type:'SELF';
if(ownType && ownType!=='SELF'){
const res=MultiOwnerEngine.getOwners(a);
if(res && res.ok && !res.isSynthesized){
const nonSelfPorsi=(res.owners||[]).filter(o=>o&&!o.isSelf&&o.porsi>0).reduce((s,o)=>s+o.porsi,0);
if(nonSelfPorsi>0){
issues.push({level:'warn',title:'Aset dengan kepemilikan ganda (Kepemilikan + Porsi Majemuk) berpotensi tidak sinkron',detail:`"${escapeHtml(a.name)}" punya dropdown Kepemilikan non-SELF (dihitung 100% di kartu Dana Kelolaan) SEKALIGUS Porsi Kepemilikan eksplisit (${nonSelfPorsi}% dihitung di tab Dana Titipan) -- 2 tempat ini bisa menampilkan pecahan berbeda utk aset yang sama. Bukan bug hitung ganda, tapi cek konsistensinya di modal Aset kalau angka terasa janggal.`});
}
}
}
}
});
// PERUBAHAN SESI 293 (audit lanjutan Sesi 292 akun-del-targets-assets-gapfix):
// D.targets punya accountId (dipakai progress "via Akun" — lihat akun.js
// delAcc() & modules-calc.js) tapi belum pernah dicek orphan di sini, gap
// yang sama persis seperti D.assets di atas. Pola SAMA PERSIS cek Aset di
// atas (1 syarat, 1 issue, level warn, 0 logic baru).
(D.targets||[]).forEach(t=>{
if(t.accountId && !accIds.has(t.accountId)){
issues.push({level:'warn',title:'Target Tabungan dengan akun tautan tidak valid',detail:`"${escapeHtml(t.name||'?')}" ditautkan ke akun yang sudah dihapus — saldo tautan otomatis dianggap kosong, cek/lepas tautannya di modal Target Tabungan.`});
}
});
// PERUBAHAN SESI 401b (audit ringan, gap sama persis pola D.targets di atas):
// D.eduFunds[].accountId (Dana Pendidikan) & D.sewaKios.units[].accountId
// (akun tujuan pembayaran sewa) belum pernah dicek orphan, walau field-nya
// sudah ada & dipakai sync saldo (lihat modules/finance/edukasi-dana.js &
// modules/business/sewakios.js). Pola & level SAMA PERSIS cek Target di
// atas. Murni baca, 0 perubahan ke cek lain.
(D.eduFunds||[]).forEach(f=>{
if(f.accountId && !accIds.has(f.accountId)){
issues.push({level:'warn',title:'Dana Pendidikan dengan akun tautan tidak valid',detail:`"${escapeHtml(f.name||'?')}" ditautkan ke akun yang sudah dihapus — "Sudah Terkumpul" tautan otomatis dianggap kosong, cek/lepas tautannya di modal Dana Pendidikan.`});
}
});
((D.sewaKios&&D.sewaKios.units)||[]).forEach(u=>{
if(u.accountId && !accIds.has(u.accountId)){
issues.push({level:'warn',title:'Unit Sewa Kios dengan akun tujuan tidak valid',detail:`"${escapeHtml(u.name||'?')}" menunjuk ke akun tujuan pembayaran sewa yang sudah dihapus, cek/lepas tautannya di modal Unit Kios.`});
}
});
D.bbmLogs.forEach(b=>{
if(b.vehicleId && !vehIds.has(b.vehicleId)){
issues.push({level:'error',title:'Catatan BBM dengan kendaraan tidak valid',detail:`Catatan BBM tgl ${b.date||'?'} menunjuk ke kendaraan yang sudah dihapus.`});
}
if(b.accountId && !accIds.has(b.accountId)){
issues.push({level:'warn',title:'Catatan BBM dengan akun tidak valid',detail:`Catatan BBM tgl ${b.date||'?'} menunjuk ke akun yang sudah dihapus.`});
}
if(b.txLinkId && !txIds.has(b.txLinkId)){
issues.push({level:'warn',title:'Catatan BBM kehilangan transaksi tertaut',detail:`Catatan BBM tgl ${b.date||'?'} seharusnya tertaut ke transaksi keuangan, tapi transaksinya tidak ditemukan.`});
}
});
D.servisLogs.forEach(s=>{
if(s.vehicleId && !vehIds.has(s.vehicleId)){
issues.push({level:'error',title:'Catatan servis dengan kendaraan tidak valid',detail:`Servis "${s.item||'?'}" tgl ${s.date||'?'} menunjuk ke kendaraan yang sudah dihapus.`});
}
if(s.accountId && !accIds.has(s.accountId)){
issues.push({level:'warn',title:'Catatan servis dengan akun tidak valid',detail:`Servis "${s.item||'?'}" tgl ${s.date||'?'} menunjuk ke akun yang sudah dihapus.`});
}
if(s.txLinkId && !txIds.has(s.txLinkId)){
issues.push({level:'warn',title:'Catatan servis kehilangan transaksi tertaut',detail:`Servis "${s.item||'?'}" tgl ${s.date||'?'} seharusnya tertaut ke transaksi keuangan, tapi transaksinya tidak ditemukan.`});
}
});
D.products.forEach(p=>{
if((p.stock||0)<0){
issues.push({level:'error',title:'Stok produk minus',detail:`"${escapeHtml(p.name)}" stoknya ${p.stock} (minus). Cek riwayat transaksi Shop terkait.`});
}
});
const prodIds=new Set(D.products.map(p=>p.id));
(D.cobek||[]).forEach(c=>{
(c.items||[]).forEach(it=>{
if(it.productId && !prodIds.has(it.productId)){
issues.push({level:'error',title:'Transaksi Shop dengan produk tidak valid',detail:`Transaksi Shop tgl ${c.date||'?'} (pelanggan: ${(c.customer&&c.customer.name)||'-'}) berisi item "${it.name||it.productId}" yang produknya sudah dihapus dari etalase.`});
}
});
if(c.accountId && !accIds.has(c.accountId)){
issues.push({level:'warn',title:'Transaksi Shop dengan akun tidak valid',detail:`Transaksi Shop tgl ${c.date||'?'} menunjuk ke akun yang sudah dihapus.`});
}
if(c.txLinkId && !txIds.has(c.txLinkId)){
issues.push({level:'warn',title:'Transaksi Shop kehilangan transaksi tertaut',detail:`Transaksi Shop tgl ${c.date||'?'} seharusnya tertaut ke transaksi keuangan, tapi transaksinya tidak ditemukan.`});
}
});
(D.workDays||[]).forEach(w=>{
if(!w.date || isNaN(new Date(w.date).getTime())){
issues.push({level:'error',title:'Absensi dengan tanggal tidak valid',detail:`Catatan absensi (ID ${w.id}) punya tanggal kosong/rusak.`});
}
if(w.total==null || isNaN(w.total) || w.total<0){
issues.push({level:'error',title:'Absensi dengan total gaji tidak valid',detail:`Absensi tgl ${w.date||'?'} punya total gaji kosong/negatif/rusak.`});
}
});
const wsIds=new Set(),dupWsIds=[],wsDates=new Set(),dupWsDates=[];
(D.wealthSnapshots||[]).forEach(s=>{
if(wsIds.has(s.id))dupWsIds.push(s.id); else wsIds.add(s.id);
if(wsDates.has(s.date))dupWsDates.push(s.date); else wsDates.add(s.date);
if(!s.date || isNaN(new Date(s.date).getTime())){
issues.push({level:'error',title:'Snapshot kekayaan dengan tanggal tidak valid',detail:`Snapshot (ID ${s.id}) punya tanggal kosong/rusak.`});
}
if(s.netWorth==null || isNaN(s.netWorth)){
issues.push({level:'error',title:'Snapshot kekayaan dengan nilai tidak valid',detail:`Snapshot tgl ${s.date||'?'} punya nilai Kekayaan Bersih kosong/rusak (bukan angka). Ini bisa bikin CAGR ikut rusak.`});
}
});
if(dupWsIds.length){
issues.push({level:'error',title:'ID snapshot kekayaan duplikat',detail:`${dupWsIds.length} snapshot punya ID yang sama (kemungkinan dari restore/sync yang tidak bersih). ID: ${[...new Set(dupWsIds)].slice(0,5).join(', ')}${dupWsIds.length>5?'...':''}`});
}
if(dupWsDates.length){
issues.push({level:'warn',title:'Tanggal snapshot kekayaan duplikat',detail:`${dupWsDates.length} tanggal punya lebih dari 1 snapshot (seharusnya cuma 1 snapshot per tanggal). Tanggal: ${[...new Set(dupWsDates)].slice(0,5).join(', ')}${dupWsDates.length>5?'...':''}. Ini bisa bikin CAGR keliru karena tidak jelas snapshot mana yang dipakai sbg titik data.`});
}
const lbIds=new Set(),dupLbIds=[],lbDates=new Set(),dupLbDates=[];
(D.lifeBalanceSnapshots||[]).forEach(s=>{
if(lbIds.has(s.id))dupLbIds.push(s.id); else lbIds.add(s.id);
if(lbDates.has(s.date))dupLbDates.push(s.date); else lbDates.add(s.date);
if(!s.date || isNaN(new Date(s.date).getTime())){
issues.push({level:'error',title:'Snapshot Skor Hidup Seimbang dengan tanggal tidak valid',detail:`Snapshot (ID ${s.id}) punya tanggal kosong/rusak.`});
}
if(s.score==null || isNaN(s.score) || s.score<0 || s.score>100){
issues.push({level:'error',title:'Snapshot Skor Hidup Seimbang dengan nilai tidak valid',detail:`Snapshot tgl ${s.date||'?'} punya skor kosong/rusak/luar rentang 0-100.`});
}
});
if(dupLbIds.length){
issues.push({level:'error',title:'ID snapshot Skor Hidup Seimbang duplikat',detail:`${dupLbIds.length} snapshot punya ID yang sama (kemungkinan dari restore/sync yang tidak bersih). ID: ${[...new Set(dupLbIds)].slice(0,5).join(', ')}${dupLbIds.length>5?'...':''}`});
}
if(dupLbDates.length){
issues.push({level:'warn',title:'Tanggal snapshot Skor Hidup Seimbang duplikat',detail:`${dupLbDates.length} tanggal punya lebih dari 1 snapshot (seharusnya cuma 1 per tanggal). Tanggal: ${[...new Set(dupLbDates)].slice(0,5).join(', ')}${dupLbDates.length>5?'...':''}.`});
}
(D.piutang||[]).forEach(p=>{
if(!p.name || !p.name.trim()){
issues.push({level:'error',title:'Piutang tanpa nama peminjam',detail:`Catatan piutang (ID ${p.id}) tidak punya nama peminjam.`});
}
if(p.nilai==null || isNaN(p.nilai) || p.nilai<0){
issues.push({level:'error',title:'Piutang dengan nilai tidak valid',detail:`Piutang "${p.name||'?'}" punya nilai kosong/negatif/rusak, ikut memengaruhi Kekayaan Bersih & Zakat Maal.`});
}
if(p.jatuhTempo && isNaN(new Date(p.jatuhTempo).getTime())){
issues.push({level:'warn',title:'Piutang dengan tanggal jatuh tempo tidak valid',detail:`Piutang "${p.name||'?'}" punya tanggal jatuh tempo yang tidak terbaca sebagai tanggal.`});
}
// PERUBAHAN SESI 401b (audit ringan): assetId (Kaitkan ke Aset Multi-Owner,
// lihat modules/finance/piutang-utang.js resolveEntryAssetSelfPorsi()) bisa
// jadi orphan kalau asetnya sudah dihapus -- porsi kepemilikan jadi salah
// hitung diam-diam. Pola sama persis cek assetId lain di file ini.
if(p.assetId && !(D.assets||[]).some(a=>sameId(a.id,p.assetId))){
issues.push({level:'warn',title:'Piutang tertaut ke Aset Multi-Owner yang sudah dihapus',detail:`Piutang "${p.name||'?'}" masih menyimpan tautan ke aset multi-owner yang sudah dihapus -- porsi kepemilikan yang dihitung bisa salah, cek/lepas tautannya di modal Piutang.`});
}
});
(D.partsStock||[]).forEach(p=>{
if((p.qty||0)<0){
issues.push({level:'error',title:'Stok sparepart minus',detail:`"${escapeHtml(p.name)}" stoknya ${p.qty} (minus). Cek riwayat pemakaian di catatan servis.`});
}
});
// Cek tambahan (S506 — Vehicle ↔ Asset Identity Link, lihat PROMPT
// IMPLEMENTASI S506 §9): D.vehicles[].assetId (opsional, dibuat lewat "🔗
// Hubungkan ke Buku Aset" di modal Kelola Kendaraan, lihat modules/vehicle/
// vehicle-core.js resolveVehicleAssetLink()/saveVehicle()) bisa jadi orphan
// kalau asetnya sudah dihapus dari Buku Aset -- tautannya "diam-diam putus"
// (field tetap ada di D.vehicles tapi tidak match apa pun, bukan crash).
// Pola & level SAMA PERSIS cek assetId Transaksi/Piutang/Utang di atas.
// Murni baca, TIDAK auto-repair/auto-null/auto-delete (guardrail S506 §9 —
// level warn saja, bukan error yang blokir app).
D.vehicles.forEach(v=>{
if(v.assetId && !(D.assets||[]).some(a=>sameId(a.id,v.assetId))){
issues.push({level:'warn',title:'Kendaraan tertaut ke Buku Aset yang sudah dihapus',detail:`"${escapeHtml(v.name||'?')}" masih menyimpan tautan ke entry Buku Aset yang sudah dihapus -- cek/lepas tautannya di modal Kelola Kendaraan.`});
}
});
// Cek tambahan (S506 §10, duplicate link safety): 1 entry Buku Aset TIDAK
// seharusnya jadi identity >1 kendaraan sekaligus (assetId kependa dipakai
// dobel) -- pola sama persis cek catalogId duplikat (D.partsStock) di bawah.
// Murni deteksi/warning, TIDAK ada aturan bisnis baru yang memblokir/
// menghapus/mengubah data (guardrail S506 §10: "jangan merusak data
// existing").
const vehAssetIdCount={};
D.vehicles.forEach(v=>{
if(v.assetId)vehAssetIdCount[v.assetId]=(vehAssetIdCount[v.assetId]||0)+1;
});
Object.keys(vehAssetIdCount).forEach(aid=>{
if(vehAssetIdCount[aid]>1){
const names=D.vehicles.filter(v=>v.assetId===aid).map(v=>v.name).join(', ');
issues.push({level:'warn',title:'Entry Buku Aset ditautkan ke lebih dari 1 kendaraan',detail:`${vehAssetIdCount[aid]} kendaraan menunjuk ke entry Buku Aset yang sama (${names}) -- cek apakah memang disengaja, lepas tautan salah satunya di modal Kelola Kendaraan kalau keliru.`});
}
});
// Cek tambahan (S268 — bridge scan Keuangan->Stok, lihat NEXT_SESSION.md
// "Kandidat migrasi penuh"): syncPartsStockFromCatalog() di modules/finance/
// tx-stok-sparepart.js MENGASUMSIKAN 1 catalogId cuma nempel ke 1 baris
// D.partsStock (dia pakai .find() pertama yang cocok). Kalau ada 2+ baris
// dgn catalogId sama (mis. dari restore data lama/edit manual), sync jadi
// ambigu (baris mana yg dianggap "sumber kebenaran" berubah-ubah tergantung
// urutan array) -- dan ini juga PERSIS jenis data yang bakal bikin migrasi
// penuh ke VehicleCatalog.getAll() makin berisiko. Cek murni read-only,
// TIDAK mengubah data, TIDAK menyentuh alur sync yang sudah ada.
const catalogIdCount={};
(D.partsStock||[]).forEach(p=>{
if(p.catalogId)catalogIdCount[p.catalogId]=(catalogIdCount[p.catalogId]||0)+1;
});
Object.keys(catalogIdCount).forEach(cid=>{
if(catalogIdCount[cid]>1){
const names=(D.partsStock||[]).filter(p=>p.catalogId===cid).map(p=>p.name).join(', ');
issues.push({level:'warn',title:'Part katalog terhubung ke lebih dari 1 baris stok',detail:`${catalogIdCount[cid]} baris stok sparepart menunjuk ke part katalog yang sama (${names}). Sinkronisasi scan bisa jadi tidak konsisten -- gabungkan/lepas tautan salah satunya.`});
}
});
// Cek tambahan (S276 — audit sinkronisasi lintas-fitur, temuan lanjutan
// dari S274/275): catalogId di D.partsStock bisa jadi ORPHAN kalau part-nya
// sudah dihapus dari Katalog Suku Cadang (VehicleCatalog.remove()) --
// badge "🔗 Katalog" & "📦 Stok N" di VehicleCatalogUI otomatis "hilang"
// begitu itemnya tak ketemu (bukan crash, cuma silently tidak match), jadi
// user tidak pernah diberi tahu tautannya sudah putus. Guard ganda: cuma
// jalan kalau VehicleCatalog sudah dimuat (isLoaded(), Sesi 276) SEKALIGUS
// tersedia (typeof) -- kalau belum/tidak dimuat, cek ini diam saja (0
// false-positive), sama prinsipnya dgn guard typeof lain di seluruh file
// ini. Murni baca (VehicleCatalog.getStore() + D.partsStock), 0 tulis.
if(typeof VehicleCatalog!=='undefined' && typeof VehicleCatalog.isLoaded==='function' && VehicleCatalog.isLoaded() && typeof VehicleCatalog.getStore==='function'){
const catalogIds=new Set((VehicleCatalog.getStore().items||[]).map(it=>it.id));
(D.partsStock||[]).forEach(p=>{
if(p.catalogId && !catalogIds.has(p.catalogId)){
issues.push({level:'warn',title:'Stok sparepart tertaut ke part katalog yang sudah dihapus',detail:`"${escapeHtml(p.name)}" masih menyimpan tautan catalogId ke part di Katalog Suku Cadang yang sudah dihapus/tidak ditemukan -- badge "🔗 Katalog"/"📦 Stok" terkait jadi tidak muncul. Data stok sendiri tetap aman, cek/lepas tautannya kalau perlu.`});
}
});
}
(D.debts||[]).forEach(d=>{
if(!d.name || !d.name.trim()){
issues.push({level:'error',title:'Utang tanpa nama pemberi pinjaman',detail:`Catatan utang (ID ${d.id}) tidak punya nama pemberi pinjaman.`});
}
if(d.nilai==null || isNaN(d.nilai) || d.nilai<0){
issues.push({level:'error',title:'Utang dengan nilai tidak valid',detail:`Utang "${d.name||'?'}" punya nilai kosong/negatif/rusak, ikut memengaruhi Kekayaan Bersih & Zakat Maal.`});
}
if(d.jatuhTempo && isNaN(new Date(d.jatuhTempo).getTime())){
issues.push({level:'warn',title:'Utang dengan tanggal jatuh tempo tidak valid',detail:`Utang "${d.name||'?'}" punya tanggal jatuh tempo yang tidak terbaca sebagai tanggal.`});
}
// PERUBAHAN SESI 401b (audit ringan): sama persis cek assetId Piutang di
// atas, utk Utang.
if(d.assetId && !(D.assets||[]).some(a=>sameId(a.id,d.assetId))){
issues.push({level:'warn',title:'Utang tertaut ke Aset Multi-Owner yang sudah dihapus',detail:`Utang "${d.name||'?'}" masih menyimpan tautan ke aset multi-owner yang sudah dihapus -- porsi kepemilikan yang dihitung bisa salah, cek/lepas tautannya di modal Utang.`});
}
});
// Cek tambahan (S283 — audit data integrity, temuan gap): D.renovProjects[].
// items[] punya accountId & txId (lihat modules/finance/tx-renov.js) persis
// spt bills/wishlist, tapi belum pernah dicek orphan di sini. Pola & level
// disamakan persis dgn cek bills (accountId) & wishlist (txId) di atas.
// Murni baca, 0 perubahan ke cek lain.
(D.renovProjects||[]).forEach(p=>{
(p.items||[]).forEach(it=>{
if(it.accountId && !accIds.has(it.accountId)){
issues.push({level:'warn',title:'Item Renovasi dengan akun tidak valid',detail:`"${escapeHtml(it.name||'?')}" (proyek "${escapeHtml(p.name||'?')}") menunjuk ke akun yang sudah dihapus.`});
}
if(it.txId && !txIds.has(it.txId)){
issues.push({level:'warn',title:'Item Renovasi kehilangan transaksi tertaut',detail:`"${escapeHtml(it.name||'?')}" (proyek "${escapeHtml(p.name||'?')}") ditandai sudah dibayar & tertaut ke transaksi keuangan, tapi transaksinya tidak ditemukan.`});
}
});
});
const catNames=new Set([...D.categories.income,...D.categories.expense].flatMap(c=>[c.id,c.name,...(c.subs||[]).map(s=>s.id)]));
(D.budgets||[]).forEach(b=>{
const ids=b.catIds||(b.catId?[b.catId]:[]);
const invalid=ids.filter(id=>id!=='__total__' && !catNames.has(id));
if(invalid.length){
issues.push({level:'warn',title:'Anggaran dengan kategori tidak valid',detail:`Anggaran "${escapeHtml(b.name)}" merujuk ke kategori yang sudah dihapus/diubah. Buka & simpan ulang anggaran ini untuk memperbaiki.`});
}
});
(D.wishlist||[]).forEach(w=>{
if(!w.name || !w.name.trim()){
issues.push({level:'error',title:'Barang Prioritas Belanja tanpa nama',detail:`Item wishlist (ID ${w.id}) tidak punya nama.`});
}
if(w.price==null || isNaN(w.price) || w.price<=0){
issues.push({level:'error',title:'Barang Prioritas Belanja dengan harga tidak valid',detail:`"${w.name||'?'}" punya harga kosong/0/negatif/rusak.`});
}
if(w.isDiskon && (w.hargaNormal==null || isNaN(w.hargaNormal) || w.hargaNormal<=(w.price||0))){
issues.push({level:'warn',title:'Barang Prioritas Belanja dengan info diskon tidak konsisten',detail:`"${w.name||'?'}" ditandai diskon tapi harga normalnya kosong/lebih kecil-sama dgn harga bayar. Skor prioritasnya bisa jadi kurang akurat.`});
}
if(w.bought && w.txId && !txIds.has(w.txId)){
issues.push({level:'warn',title:'Barang "Sudah Beli" kehilangan transaksi tertaut',detail:`"${w.name||'?'}" ditandai sudah dibeli & tertaut ke transaksi keuangan, tapi transaksinya tidak ditemukan (mungkin terhapus di luar jalur normal). Buka Prioritas Belanja → Sudah Dibeli → ↺ buat kembalikan barang ini ke list aktif kalau memang belum jadi dibeli.`});
}
if(w.bought && !w.txId){
issues.push({level:'warn',title:'Barang "Sudah Beli" tanpa transaksi tertaut',detail:`"${w.name||'?'}" berstatus sudah dibeli tapi tidak punya catatan transaksi terkait di Keuangan (kemungkinan data lama dari sebelum fitur sync 2 arah ditambahkan).`});
}
});
const wlDupCheck=new Map();
(D.wishlist||[]).filter(w=>!w.bought).forEach(w=>{
const key=(w.name||'').trim().toLowerCase();
if(!key)return;
wlDupCheck.set(key,(wlDupCheck.get(key)||0)+1);
});
const wlDupNames=[...wlDupCheck.entries()].filter(([,c])=>c>1).map(([n])=>n);
if(wlDupNames.length){
issues.push({level:'warn',title:'Barang Prioritas Belanja kemungkinan duplikat',detail:`Nama barang yang sama muncul lebih dari 1x di list aktif: ${wlDupNames.slice(0,5).join(', ')}${wlDupNames.length>5?'...':''}. Cek apakah memang 2 barang berbeda atau kepencet tambah dobel.`});
}
const errCount=issues.filter(i=>i.level==='error').length;
const warnCount=issues.filter(i=>i.level==='warn').length;
const summaryEl=document.getElementById('dataHealthSummary');
const listEl=document.getElementById('dataHealthList');
if(!issues.length){
summaryEl.innerHTML='✅ Tidak ditemukan masalah. Data terlihat sehat!';
listEl.innerHTML='';
} else {
summaryEl.innerHTML=`Ditemukan <b>${errCount} error</b> & <b>${warnCount} peringatan</b> dari ${D.transactions.length} transaksi, ${D.bbmLogs.length+D.servisLogs.length} catatan kendaraan, ${(D.cobek||[]).length} transaksi Shop, ${(D.workDays||[]).length} catatan absensi, ${(D.wealthSnapshots||[]).length} snapshot kekayaan, ${(D.piutang||[]).length} piutang, ${(D.debts||[]).length} utang, ${(D.budgets||[]).length} anggaran, ${(D.lifeBalanceSnapshots||[]).length} snapshot Skor Hidup Seimbang & ${(D.wishlist||[]).length} barang Prioritas Belanja.`;
listEl.innerHTML=issues.map(i=>`<div style="padding:10px;border-radius:10px;margin-bottom:8px;background:${i.level==='error'?'var(--accent2-soft)':'var(--accent4-soft)'}">
      <div style="font-weight:700;font-size:13px;color:${i.level==='error'?'var(--accent2)':'var(--accent4)'}">${i.level==='error'?'❌':'⚠️'} ${escapeHtml(i.title)}</div>
      <div class="u-fs12 u-t2 u-mt2">${escapeHtml(i.detail)}</div>
    </div>`).join('');
}
openModal('dataHealthModal');
return issues;
}
