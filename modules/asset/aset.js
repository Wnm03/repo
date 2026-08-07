// aset.js — Domain Aset & Kekayaan: ALOKASI_PRESETS/AlokasiAset (rekomendasi alokasi dana), Aset (Buku Aset & Kekayaan Bersih), Penyusutan (estimasi nilai buku aset yg menurun nilainya: Garis Lurus/Saldo Menurun/Manual), PajakAset (estimasi PBB aset properti & Zakat Maal per aset zakatable + Ringkasan Pajak), LaporanAset (Laporan Aset gabungan: Daftar Aset, Riwayat Transaksi, Nilai Aset, Penyusutan, Ringkasan Kekayaan — dari sisi aset saja), IDBStore (helper generik penyimpanan IndexedDB), PORTFOLIO_LABELS, TimelineW (timeline tujuan keuangan)
// Dipindah ke modules/asset/aset.js (Sesi 9 restrukturisasi folder — lihat
// docs/FILE-MAP.md & RENCANA-SESI.md; isi & nama file TIDAK berubah, cuma lokasi folder).
// CATATAN: modul-modul ini dipindah ke file baru ini dari features-renovasi-pajak-aset-order.js (v62).
// CATATAN: IDBStore sebenarnya helper GENERIK (bukan spesifik domain Aset) yang dipakai save()/migrasi di features-helpers-global-security.js & self-test — ikut co-located di sini krn memang sudah dari dulu 1 file sama Aset, dipindah apa adanya tanpa isi diubah. Kandidat dipindah lagi ke file sendiri di sesi berikutnya kalau mau lebih rapi.
// TimelineW.goals() memanggil Renov.totals() (sekarang di renovasi.js) lewat variabel global — aman krn dipanggil saat runtime (render), bukan saat file di-load, & renovasi.js tetap ikut ter-load lewat build.js.
// PENTING: file ini HARUS dimuat sesuai urutan build.js (GROUP_A/GROUP_B) karena beberapa modul saling referensi. Urutan grup ini: pajak-pbb-zakat.js, budget.js, car-notes.js, chat-action-handlers.js, edukasi-dana.js, sewakios.js, hidup-seimbang.js, linktx.js, renovasi.js, aset.js, worthit.js

const ALOKASI_PRESETS={
konservatif:{label:'🛡️ Konservatif',desc:'Prioritas jaga nilai pokok, fluktuasi seminimal mungkin. Cocok kalau dana ini penting/darurat atau horison waktu pendek (<2 tahun).',items:[
{name:'Kas / Dana Darurat',pct:40,icon:'💵'},
{name:'RDPU / Deposito',pct:35,icon:'📈'},
{name:'Obligasi / Sukuk Ritel',pct:15,icon:'📜'},
{name:'Emas',pct:10,icon:'🥇'}
]},
moderat:{label:'⚖️ Moderat',desc:'Seimbang antara peluang pertumbuhan & keamanan. Cocok utk horison menengah (3-5 tahun).',items:[
{name:'Kas / Dana Darurat',pct:20,icon:'💵'},
{name:'RDPU / Deposito',pct:25,icon:'📈'},
{name:'Obligasi / Sukuk Ritel',pct:20,icon:'📜'},
{name:'Reksadana Saham / Saham',pct:20,icon:'📊'},
{name:'Emas',pct:15,icon:'🥇'}
]},
agresif:{label:'🚀 Agresif',desc:'Prioritas pertumbuhan jangka panjang, siap terima fluktuasi nilai yang besar. Cocok horison panjang (>5-7 tahun).',items:[
{name:'Kas / Dana Darurat',pct:10,icon:'💵'},
{name:'Obligasi / Sukuk Ritel',pct:15,icon:'📜'},
{name:'Reksadana Saham / Saham',pct:45,icon:'📊'},
{name:'Emas',pct:10,icon:'🥇'},
{name:'Kripto / Alternatif',pct:20,icon:'🪙'}
]}
};
const AlokasiAset={
SUFFIXES:[''],
setRisk(key){
D.assetAllocation=D.assetAllocation||{};
D.assetAllocation.risk=key;
save();
AlokasiAset.renderAll();
},
onDanaInput(suffix){
suffix=suffix||'';
const danaEl=document.getElementById('aaDana'+suffix);
if(!danaEl)return;
D.assetAllocation=D.assetAllocation||{};
D.assetAllocation.dana=parsePzNum(danaEl.value);
save();
AlokasiAset.renderAll();
},
renderAll(){
AlokasiAset.SUFFIXES.forEach(suf=>AlokasiAset.renderOne(suf));
},
renderOne(suffix){
suffix=suffix||'';
const box=document.getElementById('aaResult'+suffix);
if(!box)return;
const chips=document.querySelectorAll('#aaRiskChips'+suffix+' .chip-btn');
const danaEl=document.getElementById('aaDana'+suffix);
const risk=D.assetAllocation&&D.assetAllocation.risk;
chips.forEach(b=>b.classList.remove('active'));
if(risk){
const idx={konservatif:0,moderat:1,agresif:2}[risk];
if(chips[idx])chips[idx].classList.add('active');
}
if(danaEl){
const savedDana=D.assetAllocation&&D.assetAllocation.dana;
danaEl.value=(savedDana!=null&&savedDana!=='')?savedDana:(totalSaldoAkun()||'');
}
if(!risk){box.innerHTML='<div class="u-fs12t2">Pilih dulu salah satu profil risiko di atas ya.</div>';return;}
const preset=ALOKASI_PRESETS[risk];
if(!preset)return;
const dana=danaEl?parsePzNum(danaEl.value):0;
const dd=(D.targets||[]).find(t=>t.isDanaDarurat);
const ddBanner=dd?'':`<div class="u-fs11 u-cacc2 u-r10 u-mb10 u-lh15" style="background:var(--accent2-soft);padding:8px 10px">🚨 Belum ada target yang ditandai <b>Dana Darurat</b>, jadi baris "Kas / Dana Darurat" di bawah masih ilustrasi murni. <span class="u-pointer u-fw600" style="text-decoration:underline" data-action="openTargetModalDanaDarurat">+ Buat targetnya sekarang</span></div>`;
box.innerHTML=ddBanner+'<div class="u-hint10">'+escapeHtml(preset.desc)+'</div>'+
preset.items.map(it=>{
const nominal=Math.round(dana*it.pct/100);
const isDanaDaruratRow=/dana darurat/i.test(it.name);
let ddInfo='';
if(isDanaDaruratRow&&dd){
const ddSaved=dd.accountId?recalcAccBalance(dd.accountId):dd.saved;
const ddPct=Math.min(100,Math.round((ddSaved/dd.amount)*100));
const ddCol=ddPct>=100?'var(--accent3)':ddPct>=50?'var(--accent4)':'var(--accent2)';
ddInfo=`<div style="font-size:11px;color:${ddCol};margin-top:4px;font-weight:600">🎯 "${escapeHtml(dd.name)}": ${fmtFull(ddSaved)} / ${fmtFull(dd.amount)} (${ddPct}%)</div>`;
}
const iconHtml=(typeof FeatureIcons!=='undefined')?FeatureIcons.render(it.icon,{size:14}):(it.icon||'');
return `<div style="display:flex;justify-content:space-between;align-items:${ddInfo?'flex-start':'center'};padding:8px 0;border-bottom:1px solid var(--border)">
          <div><div class="fi-insight-row u-fs13 u-fw600"><span class="fi-insight-icon">${iconHtml}</span><span>${escapeHtml(it.name)}</span></div><div class="u-fs11 u-t2">${it.pct}%</div>${ddInfo}</div>
          <div class="u-fw700 u-fs13" style="white-space:nowrap;padding-left:8px">${fmtFull(nominal)}</div>
        </div>`;
}).join('')+
'<div class="u-fs11 u-t2 u-mt10 u-lh15">⚠️ Ini cuma ilustrasi persentase umum, bukan saran investasi personal/berlisensi. Nama produk, jangka waktu, dan porsi pastinya perlu disesuaikan sama tujuan & riset kamu sendiri, atau konsultasi ke perencana keuangan berlisensi OJK.</div>';
// Widget Rekomendasi AI (invest-ai-widget.js) — opsional, di-guard supaya
// renderOne() tetap aman kalau file itu belum/tidak dimuat. Widget di-APPEND
// ke box yang sama, TIDAK menimpa ilustrasi alokasi di atas.
if(typeof InvestAI!=='undefined')InvestAI.mountInto(box);
},
init(suffix){
AlokasiAset.renderOne(suffix||'');
}
};
if (typeof AlokasiAset !== 'undefined') window.AlokasiAset = AlokasiAset;
// isAssetOwnershipSelf(a) — helper REUSE dari OwnershipEngine (Sesi 193,
// Ownership Sync Asset & Investasi). Balikin true kalau kepemilikan EFEKTIF
// aset ini SELF (termasuk aset lama yg belum punya field `ownership` sama
// sekali — via OwnershipEngine.resolve() otomatis fallback ke SELF/DEFAULT,
// 100% backward compatible, TIDAK ada aset existing yang tiba-tiba
// ke-exclude). Balikin false kalau ownership-nya salah satu dari INVESTOR/
// CUSTOMER/THIRD_PARTY/FAMILY (sesuai spesifikasi sesi ini: aset2 tipe ini
// WAJIB dikecualikan dari agregat Total Aset/Dashboard Aset/AI Insight/Net
// Worth — tapi TIDAK dari Aset.renderList() [Buku Aset], aset & histori
// tersebut tetap tampil & tersimpan apa adanya di daftar, cuma tidak ikut
// dijumlah ke total).
// Guard typeof OwnershipEngine: kalau engine belum dimuat, fallback true
// (anggap SELF/tidak exclude apa pun) — pola sama persis
// isAccOwnershipSelf() (modules/finance/akun.js, Sesi 192).
function isAssetOwnershipSelf(a){
if(typeof OwnershipEngine==='undefined')return true;
return OwnershipEngine.resolve(a).type==='SELF';
}
// syncLinkedAssetNilaiFromAkun() -- Sesi 422f: lengkapi arah sync yang selama
// ini BELUM ADA (dicatat sejak Sesi C: "arah sync SATU ARAH dari Aset->Akun,
// bukan sebaliknya"). Transaksi (bayar/terima/transfer) yang terjadi LANGSUNG
// di akun yang tertaut ke Aset (a.accountId) mengubah recalcAccBalance()
// akun itu, tapi `a.nilai` di Buku Aset sebelumnya tidak pernah ketarik balik
// -- user harus edit manual. Fix: dipanggil dari save() (titik tunggal,
// pola sama invalidateAccBalCache()), tiap aset yang py accountId di-cek:
// kalau saldo akun tertaut BEDA dari `a.nilai` sekarang, `a.nilai` dikoreksi
// mengikuti saldo akun. Idempotent: kalau akun tertaut baru saja disamakan
// oleh Aset.save()/saveOwners() (txDelta pattern), saldo akun = a.nilai ->
// 0 perubahan. Guard: skip aset tanpa accountId / akun yang sudah dihapus.
// SESI 449 (BUG-OWN-002 lanjutan): sebelumnya nilai akun tertaut di-scale
// balik lewat selfPorsi (nilai = ownPortion/selfPorsi%) karena akun tertaut
// dulu cuma nyimpen porsi SELF. Sekarang akun tertaut nyimpen NILAI PENUH
// instrumen (lihat "linkedAccNilai" di Aset.save()/saveOwners()), jadi arah
// sync balik ini juga disederhanakan: a.nilai = saldo akun apa adanya, 0
// scaling/pembagian porsi lagi (MultiOwnerEngine.selfPorsi() TIDAK dipakai
// di sini lagi).
// FIX (BUG-OWN-001, audit s444): sebelum fix ini, koreksi a.nilai di sini
// (arah Akun->Aset, dari transaksi riwayat NYATA yang terjadi langsung di
// akun tertaut) tidak pernah ketarik ke utang "dana titipan" milik owner
// NON-SELF (_syncOwnerDebts(), Buku Utang) -- utang jadi basi merefleksikan
// nilai LAMA, Kekayaan Bersih & Zakat Maal ikut salah hitung. Fix: begitu
// nilaiBaru!=a.nilai (transaksi riwayat beneran mengubah nilai), panggil
// Aset._syncOwnerDebts(a) juga -- guard typeof Aset (fungsi ini murni &
// dites headless tanpa Aset dimuat, lihat tests/asset-nilai-sync-from-akun-
// s422f.test.js) supaya tidak WAJIB Aset ada di scope.
function syncLinkedAssetNilaiFromAkun(){
if(!Array.isArray(D.assets)||typeof recalcAccBalance!=='function')return;
D.assets.forEach((a)=>{
if(!a.accountId)return;
const acc=(D.accounts||[]).find(x=>sameId(x.id,a.accountId));
if(!acc)return;
const nilaiBaru=recalcAccBalance(acc.id);
if(nilaiBaru!==a.nilai){
a.nilai=nilaiBaru;
if(typeof Aset!=='undefined'&&typeof Aset._syncOwnerDebts==='function')Aset._syncOwnerDebts(a);
}
});
}
// AssetInsight — kartu "💡 Insight Aset" di paling atas halaman Aset (page-aset).
// Tujuan: kasih ringkasan cepat yg butuh perhatian, TANPA user perlu buka semua
// card di bawahnya satu-satu (Dashboard Aset, Performa Investasi, Histori
// Kekayaan, dst — semuanya sudah ada datanya, insight ini cuma menyorot bagian
// yg paling relevan). Read-only, tidak nyimpen state sendiri, cuma baca ulang
// D.assets & D.wealthSnapshots tiap kali dipanggil. Dipanggil dari
// Aset.renderList() spy selalu sinkron tiap save/delete/import/scan.
const AssetInsight={
// Ambang persentase 1 kategori aset dianggap "kurang terdiversifikasi".
CONCENTRATION_THRESHOLD:60,
// compute() — DIPISAH dari render() supaya bisa dipakai ulang oleh FinCoach.compute()
// (modules-calc.js) buat sinkronisasi ke widget "🩺 Insight Cepat" di Dashboard, TANPA
// mengubah sedikit pun teks/urutan insight yang sudah ada & sudah dites di aset.test.js —
// murni ekstraksi array `insights` yang sebelumnya dibangun langsung di render().
compute(){
const list=(D.assets||[]).filter(isAssetOwnershipSelf);
const totalNilai=list.reduce((s,a)=>s+(a.nilai||0),0);
const insights=[];
// (1) Konsentrasi kategori — kalau 1 jenis aset mendominasi porsi terbesar,
// user mungkin belum sadar portofolionya kurang terdiversifikasi.
const perKategori={};
list.forEach(a=>{
const j=a.jenis||'Lainnya';
perKategori[j]=(perKategori[j]||0)+(a.nilai||0);
});
const kategoriSorted=Object.entries(perKategori).sort((a,b)=>b[1]-a[1]);
if(kategoriSorted.length&&totalNilai>0){
const[topJenis,topNilai]=kategoriSorted[0];
const pct=topNilai/totalNilai*100;
if(pct>=AssetInsight.CONCENTRATION_THRESHOLD){
insights.push(`⚠️ <b>${Math.round(pct)}%</b> dari total Aset kamu ada di kategori <b>${escapeHtml(topJenis)}</b> — pertimbangkan diversifikasi ke jenis aset lain supaya tidak terlalu bergantung pada satu instrumen.`);
}
}
// (2) Performer terbaik/terburuk — cuma aset yg ada data modalnya (sama
// dgn kriteria di Aset.renderInvestasi(), biar konsisten & tidak keisi
// angka semu dari aset yg belum diisi modalnya).
const tracked=list.map(a=>{
const buku=a.modalInvestasi!=null?a.modalInvestasi:(a.hargaBeli!=null&&a.jumlahUnit!=null?a.hargaBeli*a.jumlahUnit:null);
return{a,buku};
}).filter(x=>x.buku!=null&&x.buku>0);
if(tracked.length){
let best=null,worst=null;
tracked.forEach(({a,buku})=>{
const pct=((a.nilai||0)-buku)/buku*100;
if(!best||pct>best.pct)best={name:a.name,pct};
if(!worst||pct<worst.pct)worst={name:a.name,pct};
});
if(best&&(!worst||best.name!==worst.name||tracked.length===1)){
insights.push(`📈 Performa terbaik: <b>${escapeHtml(best.name)}</b> (${best.pct>=0?'+':''}${best.pct.toFixed(1)}%).`);
}
if(worst&&tracked.length>1&&worst.pct<0){
insights.push(`📉 Perlu dipantau: <b>${escapeHtml(worst.name)}</b> (${worst.pct.toFixed(1)}%) — cek lagi apakah masih sesuai rencana.`);
}
}
// (3) Growth Rate Aktual kekayaan bersih (dari snapshot Histori Kekayaan,
// pakai fungsi yg sama dgn card Histori Kekayaan supaya angkanya konsisten).
if(typeof Kekayaan!=='undefined'){
const cagrResult=Kekayaan.actualCAGR();
if(cagrResult&&!cagrResult.reason){
const pct=cagrResult.cagr*100;
insights.push(`${pct>=0?'🚀':'🔻'} Kekayaan Bersih tumbuh <b>${pct>=0?'+':''}${pct.toFixed(1)}%/tahun</b> (growth rate aktual dari snapshot, bukan asumsi).`);
}
}
return insights;
},
render(){
const card=document.getElementById('assetInsightCard');
const box=document.getElementById('assetInsightBody');
if(!card||!box)return;
const list=(D.assets||[]).filter(isAssetOwnershipSelf);
if(!list.length){card.classList.add('u-dnone');return;}
card.classList.remove('u-dnone');
const totalNilai=list.reduce((s,a)=>s+(a.nilai||0),0);
const insights=AssetInsight.compute();
box.innerHTML=`<div class=\"u-fs20 u-fw700 u-mb4\">${fmtFull(totalNilai)}</div><div class=\"u-fs11 u-t2 u-mb10\">Total nilai ${list.length} aset tercatat</div>`+
(insights.length?insights.map(t=>`<div class=\"u-fs12 u-lh15 u-mb8\">${t}</div>`).join(''):'<div class=\"u-fs12 u-t2 u-lh15\">Belum ada insight khusus — data aset kamu sejauh ini terlihat wajar.</div>');
}
};
const Aset={
editId:null,
_zakatableState:false,
ICON:{'Tanah':'🏞️','Rumah/Bangunan':'🏠','Kendaraan':'🏍️','Emas/Logam Mulia':'🥇','Deposito/Investasi':'📈','Saham':'📊','Reksadana':'💹','Kripto':'🪙','Lainnya':'📦'},
// Ringkasan singkat field kategori-spesifik utk baris di daftar Buku Aset
// (mis. "2022 · 125cc · Pertalite" utk Kendaraan) -- lihat renderJenisFields.
extraLabel(a){
if(a.jenis==='Kendaraan'){
const parts=[];
if(a.vehTahun)parts.push(String(a.vehTahun));
if(a.vehCc)parts.push(a.vehCc+'cc');
if(a.vehBbm)parts.push(a.vehBbm);
return parts.join(' · ');
}
if((a.jenis==='Tanah'||a.jenis==='Rumah/Bangunan')&&a.luasM2)return a.luasM2+' m²';
if(a.jenis==='Emas/Logam Mulia'&&(a.goldBeratGram||a.goldKadar)){
const parts=[];
if(a.goldBeratGram)parts.push(a.goldBeratGram+'g');
if(a.goldKadar)parts.push(a.goldKadar+'');
return parts.join(' · ');
}
return '';
},
openModal(id){
Aset.editId=id||null;
const a=id?D.assets.find(x=>sameId(x.id,id)):null;
document.getElementById('assetModalTitle').textContent=a?'Edit Aset':'Tambah Aset';
document.getElementById('assetName').value=a?a.name:'';
document.getElementById('assetJenis').value=a?a.jenis:'Tanah';
document.getElementById('assetLokasi').value=a?(a.lokasi||''):'';
document.getElementById('assetNilai').value=a?a.nilai:'';
document.getElementById('assetModalInvestasi').value=a&&a.modalInvestasi!=null?a.modalInvestasi:'';
document.getElementById('assetHargaBeli').value=a&&a.hargaBeli!=null?a.hargaBeli:'';
document.getElementById('assetJumlahUnit').value=a&&a.jumlahUnit!=null?a.jumlahUnit:'';
document.getElementById('assetTanggal').value=a?(a.tanggal||''):todayStr();
const accSel=document.getElementById('assetAccId');
if(accSel)accSel.value=a&&a.accountId?String(a.accountId):'';
const scanBox=document.getElementById('assetScanCandidates');
if(scanBox){scanBox.style.display='none';scanBox.innerHTML='';}
Aset._zakatableState=a?!!a.zakatable:false;
const btn=document.getElementById('assetZakatableBtn');
btn.textContent=Aset._zakatableState?'✓ Aktif':'Nonaktif';
btn.className='chip-btn'+(Aset._zakatableState?' active':'');
// Dana Titipan -- Sesi C (tahap terakhir migrasi Dana Titipan -> Multi-Owner Engine):
// dulu di sini toggle+field titipan (bisa diedit langsung) diisi ulang tiap modal
// dibuka. Sekarang PURE read-only lewat _renderTitipanSummary() -- mengatur porsi
// kepemilikan (termasuk dana titipan/patungan) SATU PINTU lewat tombol "⚖️ Atur Porsi
// Kepemilikan" (openOwnersModal(), S392a+), bukan lagi 2 tempat terpisah yang bisa
// gampang divergen satu sama lain.
Aset._renderTitipanSummary(a);
Aset.renderJenisFields(a);
Aset.updateProfitPreview();
// Ownership (S231) — reuse OwnershipEngine, sama pola dgn Akun/Kendaraan. Aset lama tanpa
// field ownership: resolve() fallback ke SELF/DEFAULT (backward compatible).
const ownSel=document.getElementById('assetOwnership');
if(ownSel){
if(typeof OwnershipEngine!=='undefined'){
ownSel.innerHTML=OwnershipEngine.TYPES.map(t=>'<option value="'+t+'">'+escapeHtml(OwnershipEngine.label(t))+'</option>').join('');
ownSel.value=OwnershipEngine.resolve(a||{}).type;
}else{
ownSel.innerHTML='<option value="SELF">Milik Sendiri</option>';
ownSel.value='SELF';
}
}
openModal('assetModal');
},
// FITUR BARU (permintaan user): input Buku Aset dibedakan sesuai kategori --
// Kendaraan -> Tahun/CC/BBM, Tanah & Rumah/Bangunan -> Luas (m2, dipakai juga
// oleh estimasi PBB di PajakAset yang sudah ada), Emas/Logam Mulia -> Berat
// (gram) & Kadar/Karat (field goldBeratGram/goldKadar -- SAMA PERSIS dgn
// field yg dipakai GoldImport, lihat modules/asset/aset-emas-impor.js, biar
// input manual & impor massal nyambung ke skema data yg sama). Kategori lain
// (Deposito/Saham/Reksadana/Kripto/Lainnya) tetap pakai field umum yg sudah
// ada (Modal Investasi/Harga Beli/Jumlah Unit), jadi wrap dikosongkan.
//   onJenisChange() dipanggil dari onchange dropdown Jenis -- render ULANG
//   dgn asset=null (form kosong) krn pindah kategori = data lama kategori
//   sebelumnya sudah tidak relevan. openModal() di atas panggil langsung dgn
//   asset asli (a) supaya field kepril saat Edit Aset.
onJenisChange(){
Aset.renderJenisFields(null);
},
renderJenisFields(a){
const jenis=document.getElementById('assetJenis').value;
const wrap=document.getElementById('assetJenisFieldsWrap');
if(!wrap)return;
if(jenis==='Kendaraan'){
const tahun=a&&a.vehTahun!=null?a.vehTahun:'';
const cc=a&&a.vehCc!=null?a.vehCc:'';
const bbm=a&&a.vehBbm?a.vehBbm:'';
wrap.innerHTML='<div class="u-grid2"><div class="fg"><label class="fl">Tahun</label><input type="text" inputmode="numeric" class="fi" id="assetVehTahun" placeholder="2022" value="'+escapeHtml(String(tahun))+'"></div><div class="fg"><label class="fl">CC</label><input type="text" inputmode="numeric" class="fi" id="assetVehCc" placeholder="125" value="'+escapeHtml(String(cc))+'"></div></div><div class="fg"><label class="fl">Jenis BBM</label><select class="fs" id="assetVehBbm"><option value="">— Pilih —</option><option value="Pertalite">Pertalite</option><option value="Pertamax">Pertamax</option><option value="Pertamax Turbo">Pertamax Turbo</option><option value="Solar">Solar</option><option value="Dexlite">Dexlite</option><option value="Listrik">⚡ Listrik</option><option value="Hybrid">Hybrid</option></select></div>';
document.getElementById('assetVehBbm').value=bbm;
}else if(jenis==='Tanah'||jenis==='Rumah/Bangunan'){
const luas=a&&a.luasM2!=null?a.luasM2:'';
wrap.innerHTML='<div class="fg"><label class="fl">Luas Tanah/Bangunan (m²)</label><input type="text" inputmode="decimal" class="fi" id="assetLuasM2" placeholder="120" value="'+escapeHtml(String(luas))+'"></div><div class="u-fs11 u-t2" style="margin:-6px 0 12px;line-height:1.5">💡 NJOP dipakai dari field "Estimasi Nilai Saat Ini" di bawah — estimasi PBB otomatis muncul di menu 🏛️ Pajak Aset setelah aset ini disimpan.</div>';
}else if(jenis==='Emas/Logam Mulia'){
const gram=a&&a.goldBeratGram!=null?a.goldBeratGram:'';
const kadar=a&&a.goldKadar!=null?a.goldKadar:750;
wrap.innerHTML='<div class="u-grid2"><div class="fg"><label class="fl">Berat (gram)</label><input type="text" inputmode="decimal" class="fi" id="assetGoldGram" placeholder="4.13" value="'+escapeHtml(String(gram))+'"></div><div class="fg"><label class="fl">Kadar/Karat</label><select class="fs" id="assetGoldKadar"><option value="999">24K (999)</option><option value="916">22K (916)</option><option value="875">21K (875)</option><option value="750">18K (750)</option><option value="700">17K (700)</option></select></div></div>';
document.getElementById('assetGoldKadar').value=String(kadar);
}else{
wrap.innerHTML='';
}
},
updateProfitPreview(){
const box=document.getElementById('assetProfitInfo');
if(!box)return;
const nilai=calcPreviewValue(document.getElementById('assetNilai').value);
const modal=calcPreviewValue(document.getElementById('assetModalInvestasi').value);
if(!modal){box.innerHTML='';return;}
const untung=nilai-modal;
const pct=modal?(untung/modal*100):0;
const cls=untung>=0?'green':'red';
box.innerHTML='Estimasi untung/rugi: <b class="'+cls+'">'+(untung>=0?'+':'')+fmtFull(untung)+' ('+(pct>=0?'+':'')+pct.toFixed(2)+'%)</b>';
},
toggleZakatable(){
Aset._zakatableState=!Aset._zakatableState;
const btn=document.getElementById('assetZakatableBtn');
btn.textContent=Aset._zakatableState?'✓ Aktif':'Nonaktif';
btn.className='chip-btn'+(Aset._zakatableState?' active':'');
},
// _renderTitipanSummary(a) -- SESI C (tahap terakhir migrasi Dana Titipan -> Multi-
// Owner Engine): gantiin toggleTitipan()/onTitipanOwnerTypeChange()/
// TITIPAN_OWNER_LABELS lama (dihapus sesi ini) yang dulu render field titipan bisa-
// diedit langsung di assetModal. Sekarang PURE read-only -- cuma nunjukin ringkasan
// singkat pemilik non-SELF aset ini SAAT INI (kalau ada), baca lewat
// MultiOwnerEngine.getOwners() (toleran data lama/baru -- baik yang sudah py `a.owners`
// eksplisit MAUPUN yang masih legacy `titipanAmount` & belum sempat auto-migrate,
// 0 rumus baru ditulis di sini). Mengatur porsi (termasuk titipan/patungan) sekarang
// SATU PINTU lewat tombol "⚖️ Atur Porsi Kepemilikan" (openOwnersModal(), S392a+).
_renderTitipanSummary(a){
const box=document.getElementById('assetTitipanSummary');
if(!box)return;
if(!a||typeof MultiOwnerEngine==='undefined'){box.textContent='';box.classList.add('u-dnone');return;}
const res=MultiOwnerEngine.getOwners(a);
if(!res||!res.ok||!res.isMultiOwner){box.textContent='';box.classList.add('u-dnone');return;}
const nonSelf=res.owners.filter(o=>!o.isSelf);
if(!nonSelf.length){box.textContent='';box.classList.add('u-dnone');return;}
const parts=nonSelf.map(o=>escapeHtml(o.ownerName)+' '+o.porsi+'%').join(', ');
box.innerHTML='💰 Ada dana titipan/patungan: '+parts+' — atur lewat tombol "⚖️ Atur Porsi Kepemilikan" di bawah.';
box.classList.remove('u-dnone');
},
// openOwnersModal(id) -- SESI 392a+392b ("atur porsi kepemilikan majemuk"): baca
// pemilik aset yang sedang tercatat lewat MultiOwnerEngine.getOwners() (S390, 100%
// reuse), disalin ke Aset._ownersDraft (array di memori, BUKAN referensi ke D.assets
// langsung) supaya bisa ditambah/dihapus/diedit lewat addOwnerRow()/removeOwnerRow()/
// onOwnerNameInput()/onOwnerPorsiInput() (392b) sebelum benar-benar disimpan.
// Indikator total porsi interaktif (updateOwnersTotal) & tombol simpan/reset
// (saveOwners/resetOwners) SENGAJA ditunda ke sesi berikutnya (disiplin "1 task = 1
// sesi", sama pola S390->S391->392a->392b). Dipanggil dari tombol "⚖️ Atur Porsi
// Kepemilikan" di assetModal -- tersedia untuk aset yang sudah ada (Aset.editId terisi
// dari openModal()); kalau belum ada aset tersimpan (mis. lagi isi form Tambah Aset
// baru), modal menampilkan pesan supaya aset disimpan dulu.
// selfOwnedNilai(a) -- SESI 393: porsi `a.nilai` yang jadi milik SENDIRI
// (bukan porsi pemilik lain kalau aset ini multi-pemilik), 100% reuse
// MultiOwnerEngine.selfOwnedValue() (S390/393) -- 0 rumus baru di sini.
// Guard typeof MultiOwnerEngine: kalau engine belum dimuat, fallback nilai
// penuh (perilaku SEBELUM Sesi 393, aman & tidak pernah lebih rendah dari
// yang seharusnya). Dipakai PajakAset (Zakat Maal per Aset) & bisa dipakai
// modul lain (mis. Zakat.hitungMaal() di pajak-pbb-zakat.js lewat
// MultiOwnerEngine langsung, tidak perlu import Aset).
selfOwnedNilai(a){
if(typeof MultiOwnerEngine==='undefined')return(a&&a.nilai)||0;
return MultiOwnerEngine.selfOwnedValue(a,(a&&a.nilai)||0);
},
openOwnersModal(){
const id=Aset.editId;
const a=id?D.assets.find(x=>sameId(x.id,id)):null;
document.getElementById('assetOwnersAssetName').textContent=a?('📋 '+a.name):'';
// FIX (audit "Nominal tidak bisa diisi manual", laporan user Agustus 2026):
// buang draft nilai tersirat (lihat _ownersDraftNilai) tiap kali modal
// dibuka ulang -- draft ini HANYA berlaku selama 1 sesi modal terbuka
// (pola sama _ownersDraft), supaya tidak nyangkut dari sesi buka-modal
// sebelumnya kalau user tutup modal tanpa Simpan Porsi.
Aset._ownersDraftNilai=null;
Aset._ownersModalAsset=a;
if(!a){
Aset._ownersDraft=[];
Aset._renderOwnersList();
openModal('assetOwnersModal');
return;
}
const res=typeof MultiOwnerEngine!=='undefined'?MultiOwnerEngine.getOwners(a):null;
if(!res||!res.ok){
Aset._ownersDraft=[];
Aset._renderOwnersList();
openModal('assetOwnersModal');
return;
}
// Salinan (bukan referensi) -- aman diubah lewat addOwnerRow/removeOwnerRow/
// onOwnerNameInput/onOwnerPorsiInput tanpa menyentuh data asli aset sampai
// saveOwners() (ditunda ke sesi berikutnya) benar-benar dipanggil.
Aset._ownersDraft=res.owners.map((o)=>({ownerId:o.ownerId,ownerName:o.ownerName,porsi:o.porsi,isSelf:!!o.isSelf}));
Aset._renderOwnersList();
openModal('assetOwnersModal');
},
// _ownersAssetNilai() -- SESI 429: nilai dasar (Rp) dipakai konversi
// porsi%<->nominal Rp di modal ini, ambil dari `Aset._ownersModalAsset.nilai`
// (field `assetNilai` yang SUDAH ADA di aset.js -- 0 field baru). Balik 0
// kalau aset belum ada/nilai bukan angka positif -- caller (_renderOwnersList/
// onOwnerPorsiInput/onOwnerNominalInput) pakai 0 sbg sinyal "field Nominal
// dinonaktifkan" (lihat _renderOwnersList di bawah), krn tanpa nilai dasar
// konversi Rp<->% tidak bisa dihitung.
_ownersAssetNilai(){
// FIX (audit "Nominal tidak bisa diisi manual", laporan user Agustus 2026):
// kalau user sudah menurunkan nilai dasar dari Nominal (Rp) baris manapun
// (lihat onOwnerNominalInput, cabang nilai<=0 -- aset ini belum py
// "Estimasi Nilai Saat Ini"), pakai nilai tersirat itu DULUAN drpd a.nilai
// asli (yang masih 0/kosong) supaya field Nominal baris LAIN & indikator
// total ikut kehitung benar tanpa harus keluar modal & isi form Aset dulu.
if(typeof Aset._ownersDraftNilai==='number'&&isFinite(Aset._ownersDraftNilai)&&Aset._ownersDraftNilai>0)return Aset._ownersDraftNilai;
const a=Aset._ownersModalAsset;
return (a&&typeof a.nilai==='number'&&isFinite(a.nilai)&&a.nilai>0)?a.nilai:0;
},
// _renderOwnersList() -- SESI 392b: render ulang #assetOwnersList dari Aset._ownersDraft.
// Dipanggil tiap ada tambah/hapus baris (addOwnerRow/removeOwnerRow), TIDAK dipanggil tiap
// karakter diketik di input nama/porsi/nominal (lihat onOwnerNameInput/onOwnerPorsiInput/
// onOwnerNominalInput di bawah) supaya fokus/kursor input tidak hilang tiap ketik.
// SESI 429: tiap baris sekarang juga menampilkan field "Nominal (Rp)" di
// samping "Porsi (%)" -- otomatis terhitung dari porsi% x nilai aset (field
// `nilai` yang sudah ada, 0 field D baru), dua arah (edit salah satu field,
// yang lain ikut update realtime, pola sama persis "Porsi Saya (%)"/"Porsi
// Saya (Rp)" yang sudah dipakai di txCicilanSharedPct/txCicilanSharedNominal
// & billSharedPct).
// FIX (audit "Nominal tidak bisa diisi manual", laporan user Agustus 2026):
// SEBELUMNYA, kalau aset belum punya nilai (Estimasi Nilai Saat Ini
// kosong/0), field Nominal dinonaktifkan (disabled) -- alasan lama:
// konversi Rp<->% butuh nilai dasar, dianggap "tidak ada cara aman
// menebaknya". Ternyata SALAH utk kasus nyata yang dilaporkan user: Porsi
// (%) tiap pemilik SUDAH diisi manual & totalnya SUDAH pas 100%, tapi
// field Nominal tetap kekunci cuma krn "Estimasi Nilai Saat Ini" di form
// Aset utama belum diisi -- padahal justru sebaliknya yang user mau: isi
// Nominal salah satu baris (yang porsinya sudah diketahui) buat MENURUNKAN
// nilai total instrumen itu sendiri. Field Nominal sekarang SELALU
// enabled; arah derivasi baru ini ditangani di onOwnerNominalInput()
// (cabang nilai<=0) lewat _ownersDraftNilai -- lihat komentar di sana.
_renderOwnersList(){
const listBox=document.getElementById('assetOwnersList');
if(!listBox){Aset.updateOwnersTotal();return;}
const draft=Array.isArray(Aset._ownersDraft)?Aset._ownersDraft:[];
if(!Aset._ownersModalAsset){
listBox.innerHTML='<div class="empty"><div class="empty-text">Simpan aset ini dulu (tombol "Simpan Aset") sebelum mengatur porsi kepemilikan.</div></div>';
Aset.updateOwnersTotal();
return;
}
if(!draft.length){
listBox.innerHTML='<div class="empty"><div class="empty-text">Belum ada pemilik. Tap "➕ Tambah Pemilik" di bawah.</div></div>';
Aset.updateOwnersTotal();
return;
}
const nilai=Aset._ownersAssetNilai();
listBox.innerHTML=draft.map((o,i)=>{
const porsiNum=typeof o.porsi==='number'&&isFinite(o.porsi)?o.porsi:null;
const nominalVal=(nilai>0&&porsiNum!==null)?Math.round(nilai*porsiNum/100):'';
return '<div style="margin-bottom:8px">'+
'<div class="u-flex u-gap8" style="align-items:center;margin-bottom:6px">'+
'<input type="text" class="fi" style="flex:1" placeholder="Nama pemilik" value="'+escapeHtml(o.ownerName||'')+'" oninput="Aset.onOwnerNameInput('+i+',this.value)">'+
'<button type="button" class="btn btn-ghost btn-sm" data-action="Aset.removeOwnerRow" data-args=\'['+i+']\' aria-label="Hapus pemilik">✕</button>'+
'</div>'+
'<div class="u-grid2" style="margin-bottom:0">'+
'<div class="fg u-mb0"><label class="fl" style="margin-bottom:2px">Porsi (%)</label><input type="number" class="fi" id="ownerPorsi'+i+'" placeholder="%" inputmode="decimal" value="'+(porsiNum!==null?porsiNum:'')+'" oninput="Aset.onOwnerPorsiInput('+i+',this.value)"></div>'+
'<div class="fg u-mb0"><label class="fl" style="margin-bottom:2px">Nominal (Rp)</label><input type="text" class="fi" id="ownerNominal'+i+'" placeholder="0" inputmode="decimal" value="'+nominalVal+'" oninput="Aset.onOwnerNominalInput('+i+',this.value)"></div>'+
'</div>'+
(nilai>0?'':'<div style="font-size:10.5px;color:var(--text3);margin:-2px 0 4px">Estimasi Nilai Saat Ini aset ini belum diisi -- isi Nominal (Rp) baris yang porsinya sudah kamu tahu, nilai total otomatis dihitung dari situ</div>')+
'<label style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text2);margin-top:4px;cursor:pointer">'+
'<input type="checkbox" style="width:14px;height:14px"'+(o.isSelf?' checked':'')+' onchange="Aset.onOwnerIsSelfToggle('+i+',this.checked)"> 👤 Ini saya (porsi ini dihitung ke Zakat/Pajak milikmu)'+
'</label>'+
'</div>';
}).join('');
Aset.updateOwnersTotal();
},
// updateOwnersTotal() -- SESI 392c: hitung ulang & tampilkan total porsi Aset._ownersDraft
// saat ini di #assetOwnersTotalBox, warna hijau kalau pas 100% / merah kalau belum (kurang
// atau lebih). Dipanggil dari _renderOwnersList() (tiap baris ditambah/dihapus, ATAU tiap
// modal dibuka lewat openOwnersModal->_renderOwnersList) DAN langsung dari atribut oninput
// input porsi tiap baris (lihat _renderOwnersList di atas) supaya update realtime tiap
// ketik tanpa perlu render ulang seluruh list (yang akan menghilangkan fokus input, sama
// disiplin dgn onOwnerPorsiInput sejak 392b). 100% reuse MultiOwnerEngine.totalPorsi()/
// remainingPorsi() (S390) -- TIDAK ada rumus baru, PURE UI (baca draft di memori saja,
// tidak menulis apa pun ke D.assets).
updateOwnersTotal(){
const box=document.getElementById('assetOwnersTotalBox');
// saveBtn -- SESI 392d: tombol Simpan Porsi cuma aktif kalau total porsi PAS 100%
// (sinkron dgn syarat MultiOwnerEngine.validateOwners() yang dipanggil saveOwners()),
// supaya user tidak coba simpan draft yang pasti akan ditolak. Ini PURE UI (baca
// draft, set attribute disabled), 0 rumus baru -- reuse total/sisa yang sudah
// dihitung di bawah untuk box yang sama.
const saveBtn=document.getElementById('assetOwnersSaveBtn');
if(!box){if(saveBtn)saveBtn.disabled=true;return;}
if(!Aset._ownersModalAsset){box.textContent='';box.style.color='';if(saveBtn)saveBtn.disabled=true;return;}
const draft=Array.isArray(Aset._ownersDraft)?Aset._ownersDraft:[];
if(!draft.length){
box.textContent='Belum ada pemilik ditambahkan.';
box.style.color='var(--text2)';
if(saveBtn)saveBtn.disabled=true;
return;
}
if(typeof MultiOwnerEngine==='undefined'){box.textContent='';box.style.color='';if(saveBtn)saveBtn.disabled=true;return;}
const total=MultiOwnerEngine.totalPorsi(draft);
const sisa=MultiOwnerEngine.remainingPorsi(draft);
const isValid=Math.abs(sisa)<=0.01;
box.style.color=isValid?'var(--accent3)':'var(--accent2)';
box.style.fontWeight='700';
box.textContent=isValid?('✅ Total porsi: '+total+'% (pas 100%)'):('⚠️ Total porsi: '+total+'% ('+(sisa>0?('kurang '+sisa+'%'):('lebih '+Math.abs(sisa)+'%'))+')');
if(saveBtn)saveBtn.disabled=!isValid;
},
// addOwnerRow() -- SESI 392b: tambah 1 baris pemilik kosong (nama & porsi kosong, diisi
// user) ke Aset._ownersDraft, lalu render ulang list. Murni ubah draft di memori --
// TIDAK menulis apa pun ke D.assets (sama seperti seluruh modal ini sampai saveOwners(),
// ditunda ke sesi berikutnya).
// SESI 393: baris pertama yang ditambahkan (draft masih kosong) default
// ditandai "👤 Ini saya" (isSelf:true) -- asumsi wajar krn biasanya user
// mulai isi porsi dari dirinya sendiri dulu, baru tambah pemilik lain
// (bisa ditoggle off lewat onOwnerIsSelfToggle() kalau memang bukan).
// Baris ke-2 dst default false supaya total porsi "milik sendiri" tidak
// sengaja kedobel tanpa user sadar.
addOwnerRow(){
if(!Aset._ownersModalAsset){toast('⚠️ Simpan aset ini dulu sebelum mengatur porsi kepemilikan');return;}
Aset._ownersDraft=Array.isArray(Aset._ownersDraft)?Aset._ownersDraft:[];
Aset._ownersDraft.push({ownerId:'',ownerName:'',porsi:0,isSelf:Aset._ownersDraft.length===0});
Aset._renderOwnersList();
},
// removeOwnerRow(i) -- SESI 392b: hapus 1 baris pemilik dari Aset._ownersDraft (index i),
// lalu render ulang list. Sama seperti addOwnerRow(), murni ubah draft di memori.
removeOwnerRow(i){
if(!Array.isArray(Aset._ownersDraft))return;
Aset._ownersDraft.splice(i,1);
Aset._renderOwnersList();
},
// onOwnerNameInput(i,val) / onOwnerPorsiInput(i,val) -- SESI 392b: tulis perubahan
// ketikan user ke Aset._ownersDraft[i], TANPA render ulang list (render ulang hanya
// perlu saat baris ditambah/dihapus, bukan tiap karakter diketik, supaya fokus/kursor
// input tidak hilang). SESI 392c: onOwnerPorsiInput() sekarang juga memanggil
// updateOwnersTotal() supaya indikator total porsi (hijau/merah) ikut update realtime
// tiap ketik -- updateOwnersTotal() sendiri PURE baca #assetOwnersTotalBox +
// Aset._ownersDraft, tidak menyentuh list input lain, jadi aman dipanggil tiap karakter
// tanpa kena masalah fokus/kursor yang sama seperti _renderOwnersList().
onOwnerNameInput(i,val){
if(!Array.isArray(Aset._ownersDraft)||!Aset._ownersDraft[i])return;
Aset._ownersDraft[i].ownerName=val;
},
onOwnerPorsiInput(i,val){
if(!Array.isArray(Aset._ownersDraft)||!Aset._ownersDraft[i])return;
const n=parseFloat(val);
const porsi=isFinite(n)?n:0;
Aset._ownersDraft[i].porsi=porsi;
// SESI 429: sync field Nominal (Rp) baris ini realtime -- ubah value DOM
// langsung (BUKAN _renderOwnersList ulang), sama disiplin dgn kenapa
// _renderOwnersList tidak dipanggil tiap ketik (lihat komentar di atasnya):
// render ulang akan menghilangkan fokus/kursor input yang sedang diketik.
const nilai=Aset._ownersAssetNilai();
if(nilai>0){
const nomEl=document.getElementById('ownerNominal'+i);
if(nomEl)nomEl.value=Math.round(nilai*porsi/100);
}
Aset.updateOwnersTotal();
},
// onOwnerNominalInput(i,val) -- SESI 429: arah sebaliknya dari
// onOwnerPorsiInput() -- user isi Nominal (Rp), porsi% baris ini dihitung
// ulang (nominal/nilaiAset*100, dibulatkan 2 desimal spt remainingPorsi())
// & ditulis ke Aset._ownersDraft[i].porsi (SAMA persis field yang dibaca
// saveOwners()/updateOwnersTotal() -- 0 field baru di draft/D.assets,
// Nominal murni tampilan turunan dari porsi% + nilai aset, TIDAK pernah
// disimpan sbg field sendiri). Field Nominal disabled kalau aset belum
// punya nilai (lihat _renderOwnersList), jadi guard nilai<=0 di sini
// murni jaga-jaga kalau handler terpanggil manual saat disabled.
// SESI 431: setelah porsi baris ini ditulis, sisa nilai aset (nilaiAset -
// nominal baris ini, dijepit ke >=0 -- "sampai 0", TIDAK pernah negatif)
// dibagi RATA ke SEMUA baris pemilik lain lewat _autoDistributeRemaining()
// (baru) supaya total porsi otomatis balik ke 100% tanpa user hitung
// manual tiap baris lain -- lihat komentar _autoDistributeRemaining() utk
// detail rumus & alasan pembulatan sisa ke baris terakhir.
onOwnerNominalInput(i,val){
if(!Array.isArray(Aset._ownersDraft)||!Aset._ownersDraft[i])return;
const nilai=Aset._ownersAssetNilai();
const n=parseFloat(String(val).replace(/[^0-9.-]/g,''));
const nominal=isFinite(n)?n:0;
// FIX (audit "Nominal tidak bisa diisi manual", laporan user Agustus 2026):
// SEBELUMNYA method ini `return` langsung kalau nilai<=0 (aset belum py
// "Estimasi Nilai Saat Ini") -- field Nominal dulu memang disabled di
// kondisi ini jadi handler ini "tidak pernah" kepanggil, TAPI itu blokir
// use-case nyata: user SUDAH tahu Porsi (%) tiap pemilik (total pas 100%,
// lihat baris ini punya draft[i].porsi terisi), yang belum ada cuma total
// Rp instrumennya. Cabang baru ini membalik arah derivasi: dari Nominal +
// Porsi (%) baris INI (bukan nominal/nilai spt cabang normal di bawah),
// tarik nilai TOTAL instrumen tersirat = nominal / (porsi/100), simpan ke
// Aset._ownersDraftNilai (dibaca _ownersAssetNilai(), dipakai saveOwners()
// utk nulis a.nilai beneran). Kalau porsi baris ini JUGA belum diisi
// (0/kosong) -- 0 persamaan 2 unknown, tidak ada cara aman menebak nilai
// dasar, dibiarkan (field tetap bisa diketik, cuma belum ada efek sampai
// Porsi (%)-nya diisi juga).
if(nilai<=0){
const porsiBaris=typeof Aset._ownersDraft[i].porsi==='number'&&isFinite(Aset._ownersDraft[i].porsi)?Aset._ownersDraft[i].porsi:0;
if(porsiBaris<=0||nominal<=0)return;
const nilaiTersirat=Math.round(nominal/(porsiBaris/100));
if(!isFinite(nilaiTersirat)||nilaiTersirat<=0)return;
Aset._ownersDraftNilai=nilaiTersirat;
// Nominal (Rp) baris LAIN ikut tersinkron ke nilai yang baru tersirat --
// porsi baris lain TIDAK berubah (beda dari cabang normal di bawah yang
// panggil _autoDistributeRemaining -- di sini porsi semua baris memang
// sudah fix/diketahui user, cuma tampilan Rp-nya yang menyusul).
Aset._ownersDraft.forEach((o,k)=>{
if(k===i)return;
const nomEl=document.getElementById('ownerNominal'+k);
if(nomEl&&typeof o.porsi==='number'&&isFinite(o.porsi))nomEl.value=Math.round(nilaiTersirat*o.porsi/100);
});
Aset.updateOwnersTotal();
return;
}
const porsi=Math.round((nominal/nilai*100)*100)/100;
Aset._ownersDraft[i].porsi=porsi;
const porsiEl=document.getElementById('ownerPorsi'+i);
if(porsiEl)porsiEl.value=porsi;
Aset._autoDistributeRemaining(i);
Aset.updateOwnersTotal();
},
// _autoDistributeRemaining(editedIndex) -- SESI 431: bagi RATA sisa nilai
// aset ke SEMUA baris pemilik SELAIN `editedIndex` (baris yang baru saja
// diisi nominalnya oleh user lewat onOwnerNominalInput()), supaya total
// porsi seluruh pemilik otomatis kembali ke 100% tanpa user hitung manual
// baris lain satu-satu. Permintaan user: "total aset dikurangi nominal
// pemilik [yang baru diisi] sampai 0 dibagi semua pemilik [lain]".
// Rumus (0 rumus baru di luar yang sudah ada -- reuse `nilai`/`porsi` yang
// sudah dihitung caller):
//   sisaRp = MAX(0, nilaiAset - nominalBarisEdited)   -- dijepit ke >=0,
//     "sampai 0" berarti tidak pernah jadi sisa negatif walau baris yang
//     diedit nominalnya melebihi nilai aset (over-alokasi baris lain jadi
//     0%, bukan minus, konsisten dgn validateOwner() yang menolak porsi<=0).
//   bagianRp = sisaRp / jumlahBarisLain   -- dibagi rata, jumlahBarisLain =
//     draft.length - 1 (SEMUA baris lain, terlepas porsi lama mereka apa).
//   porsiBarisLain = ROUND((bagianRp/nilaiAset*100) * 100) / 100 -- pola
//     pembulatan 2 desimal SAMA PERSIS onOwnerNominalInput()/
//     MultiOwnerEngine.remainingPorsi(), supaya toleransi float konsisten
//     satu tempat (PORSI_EPSILON di multi-owner-engine.js).
// Baris terakhir (index tertinggi di antara baris lain) SENGAJA dapat sisa
// pembulatan (100 - porsi_edited - SUM(porsi baris lain kecuali terakhir))
// alih-alih porsiBarisLain hasil bagi rata mentah -- supaya total PERSIS
// 100% (bukan 99.99/100.01 akibat akumulasi pembulatan 2 desimal tiap
// baris, pola sama dgn kenapa _synthesizeFromTitipan() menghitung
// selfPorsi sbg SISA, bukan dibagi terpisah -- lihat komentar fungsi itu
// di multi-owner-engine.js).
// TIDAK dipanggil dari onOwnerPorsiInput() (SENGAJA) -- trigger auto-bagi
// cuma dari isi Nominal (Rp), sesuai permintaan eksplisit user ("ketika
// mengisi nominal"); edit Porsi (%) manual tetap perilaku lama 0 regresi
// (cuma sync Nominal baris itu sendiri, baris lain TIDAK ikut berubah).
// Parameter:
//   editedIndex (number) -- index baris di Aset._ownersDraft yang baru
//     saja diisi nominalnya (porsi-nya SUDAH ditulis oleh caller sebelum
//     method ini dipanggil).
// Return: tidak ada (void) -- method ini menulis LANGSUNG ke
//   Aset._ownersDraft[*].porsi + DOM #ownerPorsi{i}/#ownerNominal{i} baris
//   lain (pola sama seperti onOwnerPorsiInput/onOwnerNominalInput sendiri:
//   ubah DOM langsung, BUKAN _renderOwnersList ulang, supaya fokus/kursor
//   input yang sedang diketik user tidak hilang).
// SESI 449 (BUG-OWN-002, audit s448): sebelumnya sisa porsi dibagi RATA
// (sisaPorsi/otherIdx.length) ke SEMUA baris lain, terlepas dari porsi lama
// mereka apa. Untuk 2 pemilik ini kebetulan tidak kelihatan (sisa cuma
// jatuh ke 1 baris = otomatis "benar"), tapi utk 3+ pemilik ini salah:
// mis. porsi lama A=70%,B=20%,C=10%, user isi Nominal A jadi lebih kecil
// (porsi A turun ke 40%) -- sisa 60% seharusnya dibagi PROPORSIONAL ke rasio
// lama B:C (20:10 = 2:1), bukan rata 30%/30%. Fix: bagi proporsional ke
// porsi LAMA baris lain (draft[k].porsi SEBELUM method ini menimpanya).
// Fallback ke rata kalau total porsi lama baris lain = 0 (mis. semua baris
// baru ditambah & belum py porsi sama sekali) -- SAMA PERSIS perilaku lama,
// jadi 0 regresi utk kasus itu maupun kasus 2-pemilik yang sudah benar.
_autoDistributeRemaining(editedIndex){
const draft=Array.isArray(Aset._ownersDraft)?Aset._ownersDraft:[];
if(!draft[editedIndex])return;
const nilai=Aset._ownersAssetNilai();
if(nilai<=0)return;
const otherIdx=[];
for(let k=0;k<draft.length;k++){if(k!==editedIndex)otherIdx.push(k);}
if(!otherIdx.length)return;
const editedPorsi=typeof draft[editedIndex].porsi==='number'&&isFinite(draft[editedIndex].porsi)?draft[editedIndex].porsi:0;
const sisaPorsi=Math.max(0,100-editedPorsi);
const lastIdx=otherIdx[otherIdx.length-1];
const oldPorsi={};
let totalOldPorsi=0;
otherIdx.forEach((k)=>{
const p=typeof draft[k].porsi==='number'&&isFinite(draft[k].porsi)?Math.max(0,draft[k].porsi):0;
oldPorsi[k]=p;
totalOldPorsi+=p;
});
let usedPorsi=0;
otherIdx.forEach((k)=>{
if(k===lastIdx)return;
const share=totalOldPorsi>0
?Math.round((sisaPorsi*(oldPorsi[k]/totalOldPorsi))*100)/100
:Math.round((sisaPorsi/otherIdx.length)*100)/100;
draft[k].porsi=share;
usedPorsi+=share;
});
draft[lastIdx].porsi=Math.round((sisaPorsi-usedPorsi)*100)/100;
otherIdx.forEach((k)=>{
const porsiEl=document.getElementById('ownerPorsi'+k);
if(porsiEl)porsiEl.value=draft[k].porsi;
const nomEl=document.getElementById('ownerNominal'+k);
if(nomEl)nomEl.value=Math.round(nilai*draft[k].porsi/100);
});
},
// onOwnerIsSelfToggle(i,checked) -- SESI 393: tandai/lepas baris ke-i draft
// sebagai porsi milik sendiri (dipakai Zakat Maal/Pajak Aset lewat
// MultiOwnerEngine.selfOwnedValue()). TIDAK ada batasan cuma-1-baris --
// user bisa tandai lebih dari 1 baris kalau memang beberapa baris itu
// sama-sama "aku" (mis. dicatat terpisah karena alasan lain), totalnya
// dijumlah apa adanya oleh selfPorsi().
onOwnerIsSelfToggle(i,checked){
if(!Array.isArray(Aset._ownersDraft)||!Aset._ownersDraft[i])return;
Aset._ownersDraft[i].isSelf=!!checked;
},
// saveOwners() -- SESI 392d: tulis Aset._ownersDraft ke D.assets[].owners (baru
// benar-benar tersimpan, sebelumnya cuma draft di memori sejak 392a-392c). Validasi
// & normalisasi 100% reuse MultiOwnerEngine.setOwners() (S390, yang di dalamnya
// panggil validateOwners()) -- TIDAK ada rumus/logic validasi baru ditulis di sini.
// Baris draft yang ownerId-nya masih kosong (baris baru dari addOwnerRow(), belum
// pernah tersimpan) diberi id via uid() (helper global, sudah dipakai di seluruh
// aset.js) sebelum divalidasi -- ownerId dari data lama (hasil MultiOwnerEngine.
// getOwners() di openOwnersModal) tetap dipakai apa adanya.
saveOwners(){
if(!Aset._ownersModalAsset){toast('⚠️ Simpan aset ini dulu sebelum mengatur porsi kepemilikan');return;}
if(typeof MultiOwnerEngine==='undefined'){toast('⚠️ Fitur porsi kepemilikan belum siap dimuat');return;}
const a=D.assets.find(x=>sameId(x.id,Aset._ownersModalAsset.id));
if(!a){toast('⚠️ Aset tidak ditemukan, coba tutup dan buka lagi');return;}
const draft=Array.isArray(Aset._ownersDraft)?Aset._ownersDraft:[];
if(!draft.length){toast('⚠️ Tambahkan minimal 1 pemilik sebelum menyimpan');return;}
for(let i=0;i<draft.length;i++){
if(!draft[i].ownerName||!draft[i].ownerName.trim()){toast('⚠️ Nama pemilik baris ke-'+(i+1)+' wajib diisi');return;}
}
const owners=draft.map((o)=>({
ownerId:(o.ownerId&&String(o.ownerId).trim())?String(o.ownerId).trim():String(uid()),
ownerName:o.ownerName.trim(),
porsi:o.porsi,
isSelf:!!o.isSelf,
}));
const res=MultiOwnerEngine.setOwners(a,owners);
if(!res.ok){toast('⚠️ '+res.reason);return;}
Object.assign(a,{owners:res.entity.owners});
// FIX (audit "Nominal tidak bisa diisi manual", laporan user Agustus 2026):
// kalau user menurunkan nilai dasar lewat Nominal (Rp) selama modal ini
// terbuka (aset belum py "Estimasi Nilai Saat Ini", lihat
// onOwnerNominalInput cabang nilai<=0), tulis ke a.nilai beneran DI SINI --
// SEBELUM blok sync saldo akun tertaut & _syncOwnerDebts() di bawah (yang
// dua-duanya baca a.nilai), supaya keduanya langsung pakai nilai yang baru
// diketahui, bukan 0/kosong seperti sebelumnya.
if(typeof Aset._ownersDraftNilai==='number'&&isFinite(Aset._ownersDraftNilai)&&Aset._ownersDraftNilai>0){
a.nilai=Aset._ownersDraftNilai;
}
// Sesi 422e: SYNC SALDO AKUN TERTAUT ke porsi BARU -- sebelumnya saveOwners()
// cuma nulis owners[]/render ulang tampilan (S422c), tapi baseBalance akun
// tertaut (kalau ADA, lihat assetAccId) tetap pakai nilai LAMA sampai form
// Aset utama dibuka & disimpan ulang secara terpisah. Reuse PERSIS pola
// txDelta dari Aset.save() (baris ~681) -- riwayat transaksi akun (kalau
// sudah ada, mis. sudah dipakai bayar/terima) TIDAK diubah, cuma baseBalance-
// nya digeser supaya recalcAccBalance() = nilai penuh instrumen sekarang.
// SESI 449 (BUG-OWN-002 lanjutan): sebelumnya di sini dipakai
// MultiOwnerEngine.selfOwnedValue(a,a.nilai) (porsi SELF saja) -- diganti
// a.nilai (nilai PENUH), lihat komentar panjang "linkedAccNilai" di Aset.save()
// di atas utk alasan lengkap (exclude dobel-hitung sudah dijamin totalSaldoAkun()
// via linkedAssetAccountIds(), tidak butuh baseBalance/balance dipotong ke
// porsi SELF lagi).
if(a.accountId){
const linkedAcc=D.accounts.find(x=>sameId(x.id,a.accountId));
if(linkedAcc){
const linkedAccNilai=a.nilai||0;
const txDelta=recalcAccBalance(linkedAcc.id)-(linkedAcc.baseBalance!==undefined?linkedAcc.baseBalance:(linkedAcc.balance||0));
linkedAcc.baseBalance=linkedAccNilai-txDelta;
linkedAcc.balance=linkedAccNilai;
// BUGFIX (audit kepemilikan, sama alasan dgn Aset.save()): saveOwners()
// cuma resync saldo, `ownership` akun tertaut tidak ikut disamakan ke
// `a.ownership` -- pakai OwnershipEngine.resolve() (bukan a.ownership
// mentah) supaya aset lama tanpa field ownership tetap fallback SELF
// (konsisten dgn seluruh konsumen OwnershipEngine lain, 0 regresi).
if(typeof OwnershipEngine!=='undefined')linkedAcc.ownership=OwnershipEngine.resolve(a).type;
}
}
// FIX (BUG-OWN-002, audit s444): saveOwners() sudah resync saldo akun tertaut
// ke porsi BARU (blok di atas, S422e) tapi TIDAK pernah memanggil
// _syncOwnerDebts() -- utang "dana titipan" milik owner NON-SELF (Buku Utang,
// lihat _syncOwnerDebts()) tetap kepatok ke porsi LAMA sampai user tidak
// sengaja buka+simpan ulang modal Edit Aset utama (satu-satunya jalur yang
// sebelumnya memanggilnya, _saveInner() baris ~938). Fix: panggil di sini
// juga, pola PERSIS sama (0 rumus baru) -- _syncOwnerDebts() sendiri sudah
// idempotent & aman dipanggil berkali-kali (upsert by linkedOwnerId, hapus
// entry utk owner yg sudah tidak ada di owners[] terbaru).
Aset._syncOwnerDebts(a);
save();
if(typeof AIBus!=="undefined")AIBus.emit("asset.updated",{ownersUpdated:true,editId:a.id});
// nilai tersirat sudah dikomit ke a.nilai di atas -- buang draft-nya supaya
// _ownersAssetNilai() balik baca a.nilai asli (sekarang sudah terisi benar).
Aset._ownersDraftNilai=null;
Aset._ownersModalAsset=a;
Aset._ownersDraft=res.entity.owners.map((o)=>({ownerId:o.ownerId,ownerName:o.ownerName,porsi:o.porsi,isSelf:!!o.isSelf}));
Aset._renderOwnersList();
// Sesi 422c: sebelumnya cuma Aset.renderList() -- porsi berubah juga
// mempengaruhi Kekayaan Bersih/Zakat (lewat Aset.totalValue(), S422c) &
// akun tertaut (badge/saldo di Akun Uang/Laporan/Dashboard), tapi 3 render
// itu TIDAK ikut dipanggil, jadi angkanya baru "sinkron beneran" setelah
// pindah halaman. Fix: samakan pola sync-nya dgn Aset.save() (baris ~739)
// -- 0 rumus baru, cuma nambah pemanggilan fungsi render yang sudah ada.
Aset.renderList();
if(typeof renderKekayaanBersih==='function')renderKekayaanBersih();
if(typeof hitungZakatMaal==='function')hitungZakatMaal();
if(typeof renderAccGrid==='function')renderAccGrid();
if(typeof renderDashAccList==='function')renderDashAccList();
if(typeof renderLapAccList==='function')renderLapAccList();
if(typeof renderDebtList==='function')renderDebtList();
toast('✅ Porsi kepemilikan tersimpan');
},
// resetOwners() -- SESI 392d: buang perubahan draft yang belum disimpan, muat ulang
// Aset._ownersDraft dari data TERSIMPAN di D.assets (via MultiOwnerEngine.getOwners(),
// sama persis logic yang dipakai openOwnersModal() -- 0 rumus baru). Dipakai kalau
// user salah edit & mau mulai ulang dari data terakhir tersimpan TANPA menutup modal.
resetOwners(){
if(!Aset._ownersModalAsset){return;}
const res=typeof MultiOwnerEngine!=='undefined'?MultiOwnerEngine.getOwners(Aset._ownersModalAsset):null;
Aset._ownersDraft=res&&res.ok?res.owners.map((o)=>({ownerId:o.ownerId,ownerName:o.ownerName,porsi:o.porsi,isSelf:!!o.isSelf})):[];
// FIX (audit "Nominal tidak bisa diisi manual", laporan user Agustus 2026):
// nilai tersirat dari Nominal (kalau ada, lihat _ownersDraftNilai) juga
// bagian dari "perubahan draft yang belum disimpan" -- ikut dibuang saat
// Reset Draft, pola sama _ownersDraft di atas.
Aset._ownersDraftNilai=null;
Aset._renderOwnersList();
toast('↺ Draft direset ke data yang terakhir tersimpan');
},
// _syncOwnerDebts(a) — Sesi B (lanjutan MultiOwnerEngine S390/406b): gantiin
// _syncTitipanDebt() lama -- BUKAN cuma 1 entry utang titipan per aset,
// tapi 1 entry utang PER OWNER non-SELF dari MultiOwnerEngine.getOwners(a)
// (toleran: baca `a.owners` eksplisit KALAU ADA, atau disintesis dari
// titipanAmount legacy lewat cabang Sesi 406b -- 0 rumus baru dobel, murni
// pakai apa yang getOwners() sudah balikin). Tiap entry utang ditandai
// `linkedAssetId`/`linkedOwnerId` di OBJECT UTANGNYA SENDIRI (bukan pointer
// tunggal di aset spt titipanDebtLinkId dulu) supaya bisa nampung BERAPA PUN
// owner non-SELF sekaligus per aset -- 1 aset 3 pemilik non-SELF = 3 entry
// utang, dicari/di-update lewat filter linkedAssetId+linkedOwnerId, bukan 1
// field tunggal yang cuma muat 1 id.
// nilai aset (a.nilai) TETAP dicatat penuh & apa adanya; porsi tiap owner
// non-SELF (nilai * porsi/100) otomatis jadi 1 entry utang bernama owner
// itu, sehingga Kekayaan Bersih = Nilai Aset − Utang tiap owner titipan
// (tidak overstated). Owner yang dicabut (tidak ada lagi di getOwners() --
// mis. porsi diubah jadi 0, atau baris ownernya dihapus) -> entry utang
// tertautnya OTOMATIS DIHAPUS, tidak menyisakan sampah (0 UI utk hapus
// manual perlu).
// MIGRASI 1x dari field lama `a.titipanDebtLinkId` (peninggalan
// _syncTitipanDebt() <=Sesi 406b): kalau field itu masih ada & debt-nya
// masih ada di D.debts, debt itu di-TAG linkedAssetId/linkedOwnerId (owner
// id disintesis deterministik persis sama dgn yang dipakai
// MultiOwnerEngine._synthesizeFromTitipan(), jadi otomatis "ketemu" lagi di
// loop di bawah tanpa bikin entry duplikat) lalu field lamanya di-null-kan
// -- TIDAK ada entry utang baru dibuat/dihapus semata krn migrasi ini.
// TIDAK ada wiring baru ke Aset.save() sesi ini di luar 1 rename call site
// yang sudah ada (dari _syncTitipanDebt ke _syncOwnerDebts, supaya save()
// tidak manggil fungsi yang sudah tidak ada) -- migrasi data
// titipanAmount->a.owners yang SEBENARNYA (nulis field `owners` array) &
// perubahan UI assetModal jadi kerjaan Sesi C, sesuai rencana 4 sesi.
_syncOwnerDebts(a){
if(!a||typeof D==='undefined'||!D.debts)return;
if(a.titipanDebtLinkId){
const legacyDebt=D.debts.find(d=>String(d.id)===String(a.titipanDebtLinkId));
if(legacyDebt&&!legacyDebt.linkedAssetId){
legacyDebt.linkedAssetId=a.id;
legacyDebt.linkedOwnerId='titipan_'+(a.titipanOwnerType||'investor');
}
a.titipanDebtLinkId=null;
}
const res=typeof MultiOwnerEngine!=='undefined'?MultiOwnerEngine.getOwners(a):null;
const owners=(res&&res.ok)?res.owners:[];
const nilai=typeof a.nilai==='number'&&isFinite(a.nilai)?a.nilai:0;
const nonSelfOwners=owners.filter(o=>!o.isSelf&&o.porsi>0);
const existingLinked=D.debts.filter(d=>d.linkedAssetId===a.id);
const keepIds=new Set();
nonSelfOwners.forEach(o=>{
const amount=nilai*(o.porsi/100);
const catatan='Dana titipan aset: '+a.name;
let debt=existingLinked.find(d=>d.linkedOwnerId===o.ownerId);
if(debt){
Object.assign(debt,{name:o.ownerName,nilai:amount,catatan,lunas:amount<=0});
}else{
debt={id:uid(),name:o.ownerName,nilai:amount,bunga:0,cicilanBulanan:0,tanggal:todayStr(),jatuhTempo:'',catatan,lunas:amount<=0,linkedAssetId:a.id,linkedOwnerId:o.ownerId};
D.debts.push(debt);
}
keepIds.add(o.ownerId);
});
D.debts=D.debts.filter(d=>!(d.linkedAssetId===a.id&&!keepIds.has(d.linkedOwnerId)));
},
save(){return withSaveGuard('aset','assetModal',Aset._saveInner);},
_saveInner(){
const name=document.getElementById('assetName').value.trim();
if(!name){toast('⚠️ Nama aset wajib diisi');return;}
const jenis=document.getElementById('assetJenis').value;
const lokasi=document.getElementById('assetLokasi').value.trim();
const nilai=parsePzNum(document.getElementById('assetNilai').value);
const modalInvestasi=parsePzNum(document.getElementById('assetModalInvestasi').value)||null;
const hargaBeli=parseDecStr(document.getElementById('assetHargaBeli').value);
const jumlahUnit=parseDecStr(document.getElementById('assetJumlahUnit').value);
const tanggal=document.getElementById('assetTanggal').value||'';
let accountId=document.getElementById('assetAccId').value||null;
// linkedAccNilai -- SESI C (tahap terakhir migrasi Dana Titipan -> Multi-Owner
// Engine) awalnya nulis cuma porsi SELF ke sini (bukan nilai penuh instrumen),
// SUPAYA Total Saldo Akun tidak dobel-hitung dgn Aset.totalValue(). SESI 449
// (BUG-OWN-002 lanjutan, audit s448) REVISI keputusan itu: exclude dobel-hitung
// SUDAH sepenuhnya jadi tanggung jawab totalSaldoAkun() lewat linkedAssetAccountIds()
// (lihat komentar totalSaldoAkun(), akun.js) -- akun tertaut dikecualikan PENUH
// dari Total Saldo Akun terlepas dari nilai apa pun yang tersimpan di
// baseBalance/balance-nya. Jadi menulis porsi SELF-saja ke sini TIDAK PERLU utk
// cegah dobel-hitung, tapi PUNYA efek samping buruk: kalau porsi SELF 0% (mis.
// semua owner "Ini saya"-nya belum dicentang), kartu akun tertaut nampilin
// Rp 0 padahal instrumennya ada isinya -- membingungkan user (dicatat Sesi 434
// sbg gejala, dikasih catatan penjelas doang waktu itu, BUKAN di-fix akarnya).
// Fix: tulis NILAI PENUH instrumen (bukan porsi SELF saja) -- kartu akun
// tertaut sekarang selalu representatif/informatif, exclude dari Kekayaan
// Bersih tetap terjamin oleh totalSaldoAkun() (independen dari field ini).
const linkedAccNilai=nilai;
// BUGFIX-FEATURE: opsi "__new__" = bukan menautkan ke akun yang SUDAH ADA, tapi
// bikin akun baru otomatis dari aset ini -- biar akun itu langsung nongol di
// daftar 🏦 Akun & bisa langsung dipakai buat transaksi (bayar/terima) seperti
// akun biasa, bukan cuma referensi nilai doang. Saldo awal akun = porsi milik
// sendiri (nilai aset dikurangi Dana Titipan, kalau ada). Setelah dibuat, id akun
// baru itu yang dipakai sbg accountId (tetap otomatis dikecualikan dari Total
// Saldo Akun lewat linkedAssetAccountIds(), sama seperti tautan ke akun lama,
// supaya nilainya gak dobel dihitung).
let _createdNewAcc=false;
// Ownership (S231) — dibaca dari dropdown, divalidasi/dinormalisasi via OwnershipEngine.
// Dipindah ke SINI (sebelum blok __new__ di bawah, bukan sesudahnya seperti semula)
// supaya akun baru yang auto-dibuat dari Aset bisa langsung ikut mewarisi ownership
// aset-nya (fix gap dicatat Sesi 311: akun auto-buat selalu ownership SELF/DEFAULT,
// jadi tidak kehitung di Dana Kelolaan/"Dana Investor" walau aset-nya sendiri sudah
// ownership INVESTOR/CUSTOMER/dst).
const ownRawA=document.getElementById('assetOwnership')?.value;
const ownership=(typeof OwnershipEngine!=='undefined'&&OwnershipEngine.isValidType(ownRawA))?OwnershipEngine.normalize(ownRawA):(typeof OwnershipEngine!=='undefined'?OwnershipEngine.DEFAULT:'SELF');
if(accountId==='__new__'){
const newAcc={id:'acc_'+Date.now(),name,emoji:Aset.ICON[jenis]||'📦',baseBalance:linkedAccNilai,balance:linkedAccNilai,includeInBalance:true,ownership};
D.accounts.push(newAcc);
accountId=newAcc.id;
_createdNewAcc=true;
}
// SYNC NOMINAL AKUN TERTAUT (fix: akun yang ditautkan dari Buku Aset sebelumnya
// cuma dapat baseBalance = nilai SEKALI waktu dibuat -- edit nilai aset SESUDAHNYA
// tidak pernah kepropagasi ke akunnya, jadi keduanya cepat divergen. Fix: tiap kali
// aset disimpan (nilai berubah/tidak) & sudah tertaut ke akun YANG SUDAH ADA
// (bukan baru dibuat di blok atas, itu sudah otomatis sama), akun itu di-"koreksi"
// ke nominal = linkedAccNilai (nilai penuh instrumen, SESI 449 lihat komentar di
// atas) SEKARANG, pakai pola txDelta yang SAMA PERSIS dgn _saveAccInner()
// (akun.js) -- riwayat transaksi akun (kalau ada, mis. sudah dipakai bayar/
// terima) TIDAK diubah, cuma baseBalance-nya digeser supaya hasil
// recalcAccBalance() = linkedAccNilai. Buku Aset (variabel `nilai`) TIDAK
// disentuh oleh blok ini sama sekali -- arah sync SATU ARAH dari Aset -> Akun,
// bukan sebaliknya, jadi nilai di Buku Aset tetap ikut update manual tersendiri,
// tidak pernah ketarik balik oleh transaksi yang terjadi di akun tertaut.
if(accountId&&!_createdNewAcc){
const linkedAcc=D.accounts.find(x=>sameId(x.id,accountId));
if(linkedAcc){
const txDelta=recalcAccBalance(linkedAcc.id)-(linkedAcc.baseBalance!==undefined?linkedAcc.baseBalance:(linkedAcc.balance||0));
linkedAcc.baseBalance=linkedAccNilai-txDelta;
linkedAcc.balance=linkedAccNilai;
// BUGFIX (audit kepemilikan): akun EXISTING yang BARU ditautkan (atau sudah
// tertaut & aset ini disimpan ulang) sebelumnya TIDAK ikut mewarisi
// `ownership` aset -- cuma jalur __new__ (buat akun baru dari aset) di atas
// yang mewarisi (lihat komentar Sesi 311). Akibatnya akun lama yang
// ditautkan ke aset ber-ownership non-SELF (mis. INVESTOR) tetap tampil
// SELF/default kalau ownership akun itu belum pernah diisi manual --
// OwnershipEngine jadi TIDAK lagi single source of truth utk akun tertaut.
// Fix: samakan pola __new__ -- akun tertaut SELALU disamakan ke ownership
// aset (Aset -> Akun, arah sync SATU ARAH, sama seperti sync saldo di atas).
if(typeof OwnershipEngine!=='undefined')linkedAcc.ownership=ownership;
}
}
const keuntungan=modalInvestasi?(nilai-modalInvestasi):null;
const keuntunganPct=modalInvestasi?((nilai-modalInvestasi)/modalInvestasi*100):null;
const extra={modalInvestasi,hargaBeli,jumlahUnit,keuntungan,keuntunganPct};
// CATATAN Sesi C: extra.titipanAmount/titipanOwnerType/titipanOwnerName SENGAJA TIDAK
// diisi ulang di sini lagi (field itu sudah tidak ada di assetModal) -- Object.assign()
// di bawah cuma menimpa key yang ADA di extra, jadi titipanAmount lama (aset yang
// belum sempat auto-migrate) TIDAK ikut ke-reset ke 0 tiap kali aset ini disimpan --
// tetap utuh sampai blok AUTO-MIGRATE di bawah benar-benar memindahkannya ke
// `savedAsset.owners`.
// Field kategori-spesifik (lihat Aset.renderJenisFields) -- selalu di-reset dulu
// ke null lalu diisi ULANG sesuai jenis yg dipilih SEKARANG, supaya kalau user
// ganti kategori pas Edit Aset (mis. dari Kendaraan ke Tanah), field kategori
// lama tidak nyangkut jadi data basi di aset ini.
extra.vehTahun=null;extra.vehCc=null;extra.vehBbm=null;
extra.luasM2=null;
extra.goldBeratGram=null;extra.goldKadar=null;
if(jenis==='Kendaraan'){
const vt=document.getElementById('assetVehTahun');
const vc=document.getElementById('assetVehCc');
const vb=document.getElementById('assetVehBbm');
extra.vehTahun=vt&&vt.value!==''?(parseInt(vt.value,10)||null):null;
extra.vehCc=vc&&vc.value!==''?(parseInt(vc.value,10)||null):null;
extra.vehBbm=vb&&vb.value?vb.value:null;
}else if(jenis==='Tanah'||jenis==='Rumah/Bangunan'){
const lm=document.getElementById('assetLuasM2');
extra.luasM2=lm&&lm.value!==''?(parseDecStr(lm.value)||null):null;
}else if(jenis==='Emas/Logam Mulia'){
const gg=document.getElementById('assetGoldGram');
const gk=document.getElementById('assetGoldKadar');
extra.goldBeratGram=gg&&gg.value!==''?(parseDecStr(gg.value)||null):null;
extra.goldKadar=gk&&gk.value?(parseInt(gk.value,10)||null):null;
}
let savedAsset;
if(Aset.editId){
const a=D.assets.find(x=>sameId(x.id,Aset.editId));
if(!a){toast('⚠️ Aset tidak ditemukan, coba tutup dan buka lagi');return;}
Object.assign(a,{name,jenis,lokasi,nilai,tanggal,zakatable:Aset._zakatableState,accountId,ownership},extra);
savedAsset=a;
} else {
savedAsset=Object.assign({id:uid(),name,jenis,lokasi,nilai,tanggal,zakatable:Aset._zakatableState,accountId,ownership},extra);
D.assets.push(savedAsset);
}
// AUTO-MIGRATE (Sesi C -- sesi TERAKHIR dari 4 migrasi Dana Titipan -> Multi-Owner
// Engine, lihat s406b/s407/s408/s409-SESSION-NOTE.md utk 3 sesi sebelumnya): aset yang
// masih py titipanAmount>0 legacy TAPI belum py `owners` eksplisit ditulis PERMANEN ke
// `savedAsset.owners` di titik simpan ini. SEBELUM sesi ini cuma disintesis on-the-fly
// tiap dibaca (MultiOwnerEngine.getOwners()->_synthesizeFromTitipan(), Sesi 406b) --
// TIDAK PERNAH benar-benar ditulis ke data. 100% reuse getOwners()+setOwners() (S390,
// 0 rumus baru) -- getOwners() yang mensintesis 2 baris (SELF+titipan) dari nilai/
// titipanAmount SEBELUM disimpan, lalu setOwners() menormalisasi & menulisnya.
// titipanAmount/titipanOwnerType/titipanOwnerName legacy dikosongkan SETELAH migrasi
// sukses -- representasinya sudah pindah penuh ke `owners` (getOwners() prioritas
// baca #1 ada di `entity.owners`, jadi field lama TIDAK dibaca lagi setelah ini,
// dikosongkan murni buat kebersihan data, bukan krn masih dipakai).
if(typeof MultiOwnerEngine!=='undefined'&&!Array.isArray(savedAsset.owners)&&savedAsset.titipanAmount>0){
const migRes=MultiOwnerEngine.getOwners(savedAsset);
if(migRes&&migRes.ok&&migRes.owners.length>1){
const setRes=MultiOwnerEngine.setOwners(savedAsset,migRes.owners);
if(setRes.ok)Object.assign(savedAsset,{owners:setRes.entity.owners,titipanAmount:0,titipanOwnerType:'',titipanOwnerName:''});
}
}
Aset._syncOwnerDebts(savedAsset);
save();
if(typeof AIBus!=="undefined")AIBus.emit("asset.updated",{jenis,nilai,editId:Aset.editId});
closeModal('assetModal');
Aset.renderList();renderKekayaanBersih();hitungZakatMaal();renderAccGrid();renderDashAccList();renderLapAccList();
if(typeof renderDebtList==='function')renderDebtList();
if(typeof populateAccFilters==='function')populateAccFilters();
toast(_createdNewAcc?'✅ Aset tersimpan & akun baru dibuat':'✅ Aset tersimpan');
},
async delete(id){
if(!await askConfirm('Hapus aset ini dari Buku Aset?',{okText:'Ya, Hapus'}))return;
const a=D.assets.find(x=>sameId(x.id,id));
const hadTitipanDebt=!!(a&&a.titipanDebtLinkId&&D.debts);
if(hadTitipanDebt){
D.debts=D.debts.filter(d=>String(d.id)!==String(a.titipanDebtLinkId));
}
D.assets=D.assets.filter(a=>!sameId(a.id,id));
save();
if(typeof AIBus!=="undefined")AIBus.emit("asset.updated",{deletedId:id});
Aset.renderList();renderKekayaanBersih();hitungZakatMaal();renderAccGrid();renderDashAccList();renderLapAccList();
if(hadTitipanDebt&&typeof renderDebtList==='function')renderDebtList();
},
renderList(){
const el=document.getElementById('assetList');
if(!el)return;
// Ownership Filter UI (S235) — reuse OwnershipEngine.filterByType() apa adanya, TIDAK ada
// filter/logic baru. HANYA memfilter daftar yang DIRENDER di sini; totalValue()/
// renderDashboard()/dst di bawah TETAP dihitung dari D.assets penuh lewat pemanggilan
// masing2 (Jangan mengubah perhitungan). Ini juga mencakup item Investasi (jenis
// "Deposito/Investasi"/"Saham"/"Reksadana"/"Kripto" ikut tampil & difilter di sini,
// karena project ini belum punya daftar Investasi terpisah dari Buku Aset).
const assetOwnFilterEl=document.getElementById('assetOwnFilter');
const assetOwnFilterVal=assetOwnFilterEl?assetOwnFilterEl.value:'ALL';
let list=D.assets||[];
if(assetOwnFilterVal&&assetOwnFilterVal!=='ALL'&&typeof OwnershipEngine!=='undefined'){
const assetOwnFiltered=OwnershipEngine.filterByType(list,assetOwnFilterVal);
if(assetOwnFiltered.ok)list=assetOwnFiltered.items;
}
if(!list.length){el.innerHTML='<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Belum ada aset tercatat</div></div>';Aset.renderDashboard();Aset.renderInvestasi();Penyusutan.renderList();PajakAset.renderList();LaporanAset.renderList();AssetInsight.render();return;}
el.innerHTML=list.map(a=>{
// S306 UI polish: baris tx-meta sebelumnya menggabung jenis · label/extraLabel · lokasi ·
// akun tertaut · kepemilikan · dana titipan · %untung jadi 1 kalimat panjang tanpa jarak
// visual (lebih padat drpd kasus chip Tagihan S299/S304). Sekarang HANYA 2 chip prioritas
// yang tampil di kartu — jenis & 📍 lokasi (reuse class "acc-chip" yang SUDAH ADA, 0 style
// baru). SEMUA detail lain (label tambahan/extraLabel, akun tertaut, kepemilikan/ownership,
// dana titipan, %untung) dipindah jadi baris teks di dalam overflow menu (Aset.
// openActionsMenu di bawah) — dihitung ULANG di sana dari `a`/`id`, BUKAN dikirim lewat
// closure, jadi TIDAK ada variabel sisa yang dihitung di sini tapi tidak dipakai.
const jenisChip=`<span class="acc-chip">${escapeHtml(a.jenis)}</span>`;
const lokasiChip=a.lokasi?` <span class="acc-chip">📍 ${escapeHtml(a.lokasi)}</span>`:'';
return `<div class="tx-item u-pointer" data-action="openAssetModal" data-args="${escapeHtml(JSON.stringify([a.id]))}"><div class="tx-icon u-bgaccsoft">${Aset.ICON[a.jenis]||'📦'}</div><div class="tx-info"><div class="tx-name">${escapeHtml(a.name)}${a.zakatable?' <span class="u-fs10 u-cacc3 u-r6 u-ml4" style="border:1px solid var(--accent3);padding:1px 5px">Zakat</span>':''}</div><div class="tx-meta">${jenisChip}${lokasiChip}</div></div><div class="tx-amount">${fmt(a.nilai)}</div><button class="tx-del" data-stop="1" data-action="Aset.openActionsMenu" data-args="${escapeHtml(JSON.stringify([a.id]))}" aria-label="Aksi lainnya">⋮</button></div>`;
}).join('');
Aset.renderDashboard();
Aset.renderInvestasi();
Penyusutan.renderList();
PajakAset.renderList();
LaporanAset.renderList();
AssetInsight.render();
},
// openActionsMenu(id) — menu overflow "⋮" utk aksi sekunder + detail kartu aset (S306
// UI polish, lanjutan pola S299/S304/S305: SAMA PERSIS openBillActionsMenu() di
// tagihan-kalender.js / openProdusenActionsMenu() di cobek-order.js — reuse penuh modal
// qs-modal-overlay & class .bill-action-row/.bar-icon yang SUDAH ADA, 0 style baru).
// 3 tombol kartu (📜 Riwayat, ⚡ Scan cepat, 🗑 Hapus) dipindah ke sini; tap kartu TETAP
// buka Edit (data-action="openAssetModal" di wrapper div, tidak berubah). Detail meta yang
// sebelumnya digabung di tx-meta (label/extraLabel, akun tertaut, kepemilikan, dana
// titipan, %untung) ditampilkan di #assetActionsMeta — bukan dihapus, cuma dipindah biar
// baris chip di kartu tetap ringkas (jenis + lokasi saja).
openActionsMenu(id){
const a=D.assets.find(x=>sameId(x.id,id));
if(!a)return;
document.getElementById('assetActionsTitle').textContent=`${Aset.ICON[a.jenis]||'📦'} ${a.name}`;
const linkedAcc=a.accountId?D.accounts.find(x=>sameId(x.id,a.accountId)):null;
// Sesi 434 (audit "nominal akun tertaut selalu 0") tadinya nampilin porsi Milik
// Sendiri di sini karena akun tertaut memang cuma disinkron ke porsi SELF saja
// (lihat versi lama komentar ini) -- SESI 449 (BUG-OWN-002 lanjutan) akun tertaut
// sekarang disinkron ke NILAI PENUH instrumen (lihat "linkedAccNilai" di
// Aset.save()/saveOwners()), jadi saldo yang ditampilkan di sini otomatis sama
// dgn a.nilai, tidak lagi butuh catatan "porsi Milik Sendiri" -- dobel-hitung ke
// Kekayaan Bersih tetap dicegah oleh totalSaldoAkun() (linkedAssetAccountIds()),
// independen dari saldo tampilan ini.
const linkMeta=linkedAcc?('🔗 Akun tertaut: '+escapeHtml(linkedAcc.name)+' (saldo '+fmt(recalcAccBalance(linkedAcc.id))+')'):(a.accountId?'🔗 Akun tertaut: (akun terhapus)':'');
const ownResolved=(typeof OwnershipEngine!=='undefined')?OwnershipEngine.resolve(a):null;
const ownMeta=ownResolved?('👤 Kepemilikan: '+escapeHtml(OwnershipEngine.label(ownResolved.type))):'';
const titipanLabel=a.titipanOwnerType==='keluarga'?'Keluarga':(a.titipanOwnerType==='lainnya'?'Pihak Lain':'Investor');
const titipanMeta=a.titipanAmount>0?('💰 Titipan '+escapeHtml(titipanLabel)+': '+fmt(a.titipanAmount)):'';
const extraMeta=Aset.extraLabel(a)?escapeHtml(Aset.extraLabel(a)):'';
const pctMeta=(a.keuntunganPct!=null&&isFinite(a.keuntunganPct))?(`${a.keuntunganPct>=0?'▲':'▼'} ${a.keuntunganPct>=0?'+':''}${a.keuntunganPct.toFixed(2)}%`):'';
const metaRows=[extraMeta,linkMeta,ownMeta,titipanMeta,pctMeta].filter(Boolean);
// Div meta TETAP ada di HTML (bukan dibuat/dihapus dinamis) supaya elemennya selalu bisa
// diambil lewat getElementById; kalau kebetulan kosong (mis. OwnershipEngine belum kemuat),
// disembunyikan lewat display:none — bukan cuma innerHTML='' — supaya padding bawaannya
// (lihat markup di app_production.html/index.html) TIDAK nyisain celah kosong di atas
// daftar aksi.
const metaEl=document.getElementById('assetActionsMeta');
metaEl.innerHTML=metaRows.join('<br>');
metaEl.style.display=metaRows.length?'':'none';
const histRow=linkedAcc?`<div class="bill-action-row" data-action="assetActionHistory" data-args="${escapeHtml(JSON.stringify([id]))}"><span class="bar-icon u-cacc3">📜</span> Riwayat Transaksi</div>`:'';
document.getElementById('assetActionsList').innerHTML=`${histRow}
    <div class="bill-action-row" data-action="assetActionScan" data-args="${escapeHtml(JSON.stringify([id]))}"><span class="bar-icon u-cacc">⚡</span> Update Cepat via Scan</div>
    <div class="bill-action-row danger" data-action="assetActionDelete" data-args="${escapeHtml(JSON.stringify([id]))}"><span class="bar-icon">🗑</span> Hapus</div>`;
openQS('qsAssetActions');
},
// totalValue() — Sesi 193 (Ownership Sync): TAMBAH 1 filter isAssetOwnershipSelf(a)
// (0 logic lama diubah, cuma nambah 1 syarat filter sebelum reduce). Aset
// ber-ownership INVESTOR/CUSTOMER/THIRD_PARTY/FAMILY dikecualikan dari Total
// Aset (dipakai jg oleh Kekayaan.currentNetWorth() & AssetPortfolioAPI —
// keduanya ikut ter-fix otomatis lewat titik ini, 0 perubahan tambahan di
// modul lain), tapi TETAP muncul apa adanya di Aset.renderList() (Buku Aset).
// Sesi 422d (fix #3, lanjutan revert S396 di s422c): filter isAssetOwnershipSelf
// di atas cuma cek field `ownership` (legacy, single value) -- TIDAK tahu soal
// aset MULTI-OWNER (`a.owners[]`, MultiOwnerEngine) yang porsinya kepisah per
// baris. Sebelum sesi ini, aset lolos filter (ownership efektifnya SELF) selalu
// disumbang PENUH `a.nilai`, walau ternyata porsi SELF-nya cuma sebagian (mis.
// 60%) -- overstate Kekayaan Bersih. Fix: reuse PERSIS
// MultiOwnerEngine.selfOwnedValue(a,a.nilai) (S393, pola sama Zakat Maal di
// pajak-pbb-zakat.js) per aset, bukan `a.nilai` mentah. Aset single-owner
// (mayoritas/legacy) TIDAK berubah -- selfOwnedValue() balik nilai penuh kalau
// selfPorsi 100%, 0 regresi.
totalValue(){return(D.assets||[]).filter(isAssetOwnershipSelf).reduce((s,a)=>s+(typeof MultiOwnerEngine!=='undefined'?MultiOwnerEngine.selfOwnedValue(a,a.nilai||0):(a.nilai||0)),0);},
// FITUR BARU: Dashboard Aset — ringkasan Total Aset / Nilai Buku / Nilai Pasar +
// breakdown per kategori (jenis). Nilai Pasar = total a.nilai (estimasi nilai saat
// ini, sesuai yang diisi user di modal Aset). Nilai Buku = total modal/harga
// perolehan (modalInvestasi kalau diisi, atau hargaBeli×jumlahUnit kalau itu yang
// diisi; kalau dua-duanya kosong, dianggap sama dgn Nilai Pasar krn tidak ada data
// modal -- supaya tidak salah tampil "untung/rugi" padahal cuma belum diisi).
// Dipanggil otomatis tiap kali Aset.renderList() jalan (save/delete/import/scan
// semua sudah lewat situ), jadi selalu sinkron tanpa perlu titik panggil baru.
renderDashboard(){
const box=document.getElementById('assetDashboard');
if(!box)return;
// Sesi 193 (Ownership Sync): filter isAssetOwnershipSelf() -- Dashboard Aset
// (ringkasan Total Aset/Nilai Buku/Nilai Pasar/breakdown kategori) HANYA
// menghitung aset ber-ownership SELF, sesuai spesifikasi (dikecualikan dari
// "Dashboard"). Aset non-SELF tetap ada apa adanya di Aset.renderList().
const list=(D.assets||[]).filter(isAssetOwnershipSelf);
box.classList.remove('u-dnone');
if(!list.length){
const t=document.getElementById('assetDashTotal');if(t)t.textContent=fmtFull(0);
const b=document.getElementById('assetDashBuku');if(b)b.textContent=fmtFull(0);
const p=document.getElementById('assetDashPasar');if(p)p.textContent=fmtFull(0);
const s=document.getElementById('assetDashSelisih');if(s)s.textContent='';
const k=document.getElementById('assetDashKategori');if(k)k.innerHTML='<div class="u-fs12 u-t2 u-lh15">Belum ada aset tercatat — tambah aset pertama lewat 📋 Buku Aset di bawah untuk melihat ringkasan di sini.</div>';
const d=document.getElementById('assetDashDiversifikasi');if(d)d.innerHTML='';
return;
}
let totalPasar=0,totalBuku=0;
const perKategori={};
list.forEach(a=>{
const pasar=a.nilai||0;
const buku=a.modalInvestasi!=null?a.modalInvestasi:(a.hargaBeli!=null&&a.jumlahUnit!=null?a.hargaBeli*a.jumlahUnit:pasar);
totalPasar+=pasar;totalBuku+=buku;
const jenis=a.jenis||'Lainnya';
if(!perKategori[jenis])perKategori[jenis]={count:0,nilai:0};
perKategori[jenis].count++;
perKategori[jenis].nilai+=pasar;
});
const selisih=totalPasar-totalBuku;
const selisihPct=totalBuku?(selisih/totalBuku*100):0;
const selisihCls=selisih>=0?'green':'red';
document.getElementById('assetDashTotal').textContent=fmtFull(totalPasar);
document.getElementById('assetDashBuku').textContent=fmtFull(totalBuku);
document.getElementById('assetDashPasar').textContent=fmtFull(totalPasar);
const selEl=document.getElementById('assetDashSelisih');
if(selEl)selEl.innerHTML=`Selisih Buku → Pasar: <b class="${selisihCls}">${fmtFullSigned(selisih)} (${selisih>=0?'+':''}${selisihPct.toFixed(2)}%)</b>`;
const barColors=['var(--accent)','var(--accent2)','var(--accent3)','var(--accent4)'];
// Komposisi Aset + Persentase Kategori: urut dari nilai (Rp) terbesar ke terkecil,
// tiap baris tampilkan ikon/jenis/jumlah unit, nominal, bar proporsional, & %
// terhadap totalPasar (bukan totalBuku, krn ini komposisi kekayaan SEKARANG).
const kategoriRows=Object.entries(perKategori).sort((a,b)=>b[1].nilai-a[1].nilai);
const katBox=document.getElementById('assetDashKategori');
if(katBox){
katBox.innerHTML=kategoriRows.map(([jenis,v],i)=>{
const pct=totalPasar?(v.nilai/totalPasar*100):0;
const icon=Aset.ICON[jenis]||'📦';
const iconHtml=(typeof FeatureIcons!=='undefined')?FeatureIcons.render(icon,{size:14}):icon;
return `<div class="u-mb10">
      <div class="u-flex u-jcb u-aifs u-gap8 u-fs13 u-mb4"><span class="fi-insight-row u-fw600 u-flex1"><span class="fi-insight-icon">${iconHtml}</span><span>${escapeHtml(jenis)} <span class="u-fs11 u-t2">(${v.count})</span></span></span><span class="u-fw700 u-tar" style="white-space:nowrap">${fmt(v.nilai)}</span></div>
      <div class="budget-bar-track"><div class="budget-bar-fill" style="width:${pct}%;background:${barColors[i%barColors.length]}"></div></div>
      <div class="budget-bar-label"><span>${pct.toFixed(1)}% dari total</span></div>
    </div>`;
}).join('');
}
// FITUR BARU: Ringkasan Diversifikasi — simpulkan sebaran aset per kategori jadi
// 1 kalimat + label status, berdasarkan (a) jumlah kategori yang dipegang & (b)
// konsentrasi kategori terbesar (% dari totalPasar). Ambang batas dipilih supaya
// selaras dgn heuristik umum "jangan taruh semua telur di 1 keranjang":
//  - 1 kategori doang -> jelas belum terdiversifikasi sama sekali.
//  - kategori terbesar >=70% -> risiko konsentrasi tinggi meski kategori lain ada.
//  - kategori terbesar >=50% -> lumayan terkonsentrasi, masih perlu diwaspadai.
//  - selain itu (kategori terbesar <50%, jenis kategori >=3) -> dianggap sudah
//    tersebar cukup baik.
const divBox=document.getElementById('assetDashDiversifikasi');
if(divBox){
const jumlahKategori=kategoriRows.length;
if(!jumlahKategori){
divBox.innerHTML='';
} else {
const [topJenis,topV]=kategoriRows[0];
const topPct=totalPasar?(topV.nilai/totalPasar*100):0;
let label,cls,saran;
if(jumlahKategori===1){
label='⚠️ Belum Terdiversifikasi';cls='red';
saran=`Semua aset (100%) masih ada di 1 kategori: <b>${escapeHtml(topJenis)}</b>. Pertimbangkan sebar ke kategori lain (mis. emas, reksadana, atau kas darurat) biar gak terlalu bergantung ke 1 jenis aset.`;
} else if(topPct>=70){
label='⚠️ Konsentrasi Tinggi';cls='red';
saran=`${jumlahKategori} kategori sudah dipegang, tapi <b>${escapeHtml(topJenis)}</b> mendominasi ${topPct.toFixed(1)}% dari total. Risiko konsentrasi masih tinggi kalau nilai kategori itu turun.`;
} else if(topPct>=50){
label='🟡 Cukup Terkonsentrasi';cls='orange';
saran=`${jumlahKategori} kategori tersebar, dgn <b>${escapeHtml(topJenis)}</b> sbg porsi terbesar (${topPct.toFixed(1)}%). Lumayan seimbang, tapi masih ada baiknya dipantau supaya gak makin dominan.`;
} else {
label='✅ Terdiversifikasi Baik';cls='green';
saran=`Aset tersebar di ${jumlahKategori} kategori, tanpa satupun kategori yang mendominasi lebih dari separuh total (terbesar: ${escapeHtml(topJenis)}, ${topPct.toFixed(1)}%).`;
}
divBox.innerHTML=`<div class="u-r10 u-mt10" style="background:var(--accent-soft);padding:8px 10px">
      <div class="u-fs12 u-fw700 ${cls}">${label}</div>
      <div class="u-fs11 u-t2 u-mt4 u-lh15">${saran}</div>
    </div>`;
}
}
},
// FITUR BARU: Ringkasan Performa Investasi — ROI, Capital Gain/Loss, Yield (CAGR
// tahunan), & ringkasan performa portofolio. HANYA mencakup aset yang punya data
// modal (modalInvestasi ATAU hargaBeli×jumlahUnit terisi & >0) -- ini yg disebut
// "dilacak sebagai investasi" di sini, TERLEPAS dari jenis-nya (Tanah/Rumah pun
// ikut kalau memang diisi modalnya), krn definisi "investasi" yg dipakai murni
// berbasis ada/tidaknya data modal utk hitung untung-rugi, bukan kategori. Aset
// tanpa data modal (nilai=modal by default) SENGAJA dikecualikan supaya ROI/Yield
// portofolio gak keisi data semu (untung/rugi 0% terus krn memang belum diisi).
// - ROI: total return keseluruhan portofolio sejak modal awal ((Nilai-Modal)/Modal).
// - Capital Gain/Loss: nominal Rp selisih Nilai vs Modal (bisa +/-).
// - Yield: rata2 tertimbang (bobot=modal) dari CAGR per-aset ((Nilai/Modal)^(365/hari)-1),
//   HANYA aset yg py `tanggal` & sudah lewat >=1 hari -- dipakai buat estimasi
//   "setara berapa %/tahun", beda dari ROI yg cuma total return mentah tanpa
//   memperhitungkan lama waktu investasi.
// Referensi "hari ini" pakai todayStr() (bukan `new Date()` langsung) supaya
// determinstik & gampang di-test (sama seperti dipakai di openModal()).
// Dipanggil otomatis lewat renderList() spy selalu sinkron tiap save/delete/import.
//
// investmentPerformance() — DIPISAH dari renderInvestasi() (Sesi 161, gap
// fix Investment Planner) supaya bisa dipakai ulang oleh
// InvestmentPlannerAPI (modules/finance/investment-planner-api.js) TANPA
// duplikasi formula — pola SAMA PERSIS AssetInsight.compute() vs
// AssetInsight.render() di atas (ekstraksi murni, 0 rumus baru, 0 behavior
// berubah). Filter "tracked" (modalInvestasi ATAU hargaBeli×jumlahUnit
// terisi & >0) TETAP SAMA seperti sebelumnya. Read-only, tidak menyentuh
// DOM sama sekali — caller (renderInvestasi() di bawah, atau
// InvestmentPlannerAPI) yang urus presentasinya masing-masing.
// S261 (Investment Ownership Sync): TAMBAH 1 filter isAssetOwnershipSelf(a)
// di awal (0 rumus baru) — SEBELUM sesi ini, fungsi ini membaca D.assets
// MENTAH tanpa filter ownership, beda dari Aset.totalValue()/AssetInsight
// yang sudah SELF-only sejak S193. Akibatnya aset ber-ownership
// INVESTOR/CUSTOMER/THIRD_PARTY/FAMILY ikut nyasar ke totalModal/
// totalNilai/gain/roiPct/best/worst di sini, DAN ke portfolioOverview()/
// assetAllocation()/investmentRecommendation() InvestmentPlannerAPI
// (modules/finance/investment-planner-api.js) yang 100% reuse fungsi ini.
// Pola filter SAMA PERSIS isAssetOwnershipSelf() yang sudah dipakai
// totalValue()/AssetInsight.compute() di file ini.
investmentPerformance(){
const tracked=(D.assets||[]).filter(isAssetOwnershipSelf).map(a=>{
const buku=a.modalInvestasi!=null?a.modalInvestasi:(a.hargaBeli!=null&&a.jumlahUnit!=null?a.hargaBeli*a.jumlahUnit:null);
return{a,buku};
}).filter(x=>x.buku!=null&&x.buku>0);
if(!tracked.length){
return{holdingsCount:0,totalModal:0,totalNilai:0,gain:0,roiPct:0,yieldPct:null,best:null,worst:null,tracked:[]};
}
let totalModal=0,totalNilai=0,cagrSum=0,cagrWeight=0,best=null,worst=null;
const todayMs=new Date(todayStr()).getTime();
tracked.forEach(({a,buku})=>{
const nilai=a.nilai||0;
totalModal+=buku;totalNilai+=nilai;
const pct=(nilai-buku)/buku*100;
if(!best||pct>best.pct)best={name:a.name,pct};
if(!worst||pct<worst.pct)worst={name:a.name,pct};
if(a.tanggal){
const days=(todayMs-new Date(a.tanggal).getTime())/86400000;
if(days>=1){
const years=days/365;
const cagr=(Math.pow(nilai/buku,1/years)-1)*100;
if(isFinite(cagr)){cagrSum+=cagr*buku;cagrWeight+=buku;}
}
}
});
const gain=totalNilai-totalModal;
const roiPct=totalModal?(gain/totalModal*100):0;
const yieldPct=cagrWeight?(cagrSum/cagrWeight):null;
return{holdingsCount:tracked.length,totalModal,totalNilai,gain,roiPct,yieldPct,best,worst,tracked};
},
renderInvestasi(){
const box=document.getElementById('assetInvestasiDashboard');
if(!box)return;
const perf=Aset.investmentPerformance();
box.classList.remove('u-dnone');
if(!perf.holdingsCount){
const r=document.getElementById('assetInvestasiROI');if(r)r.textContent='—';
const y=document.getElementById('assetInvestasiYield');if(y)y.textContent='—';
const g=document.getElementById('assetInvestasiGain');if(g)g.innerHTML='';
const rk=document.getElementById('assetInvestasiRingkasan');if(rk)rk.innerHTML='<div class="u-fs12 u-t2 u-lh15">Belum ada aset dengan data modal (Modal Investasi, atau Harga Beli × Jumlah Unit) — isi salah satunya di 📋 Buku Aset supaya ROI/Yield bisa dihitung.</div>';
return;
}
const{totalModal,totalNilai,gain,roiPct,yieldPct,best,worst,tracked}=perf;
const gainCls=gain>=0?'green':'red';
const roiEl=document.getElementById('assetInvestasiROI');
if(roiEl)roiEl.innerHTML=`<b class="${gainCls}">${roiPct>=0?'+':''}${roiPct.toFixed(2)}%</b>`;
const gainEl=document.getElementById('assetInvestasiGain');
if(gainEl)gainEl.innerHTML=`<b class="${gainCls}">${fmtFullSigned(gain)} (${roiPct>=0?'+':''}${roiPct.toFixed(2)}%)</b>`;
const yieldEl=document.getElementById('assetInvestasiYield');
if(yieldEl){
yieldEl.innerHTML=(yieldPct==null)?'<span class="u-t2">Belum bisa dihitung (tanggal aset belum diisi / kurang dari 1 hari)</span>':
`<b class="${yieldPct>=0?'green':'red'}">${yieldPct>=0?'+':''}${yieldPct.toFixed(2)}%/tahun</b>`;
}
const ringkasanEl=document.getElementById('assetInvestasiRingkasan');
if(ringkasanEl){
let txt=`Dari <b>${tracked.length}</b> aset yang dilacak sbg investasi (ada data modal), total modal ${fmtFull(totalModal)} kini bernilai ${fmtFull(totalNilai)} — ${gain>=0?'untung':'rugi'} <b class="${gainCls}">${fmtFullSigned(gain)} (${roiPct>=0?'+':''}${roiPct.toFixed(2)}%)</b>`;
if(yieldPct!=null)txt+=`, setara ~${yieldPct>=0?'+':''}${yieldPct.toFixed(2)}%/tahun (CAGR)`;
txt+='.';
if(tracked.length>1&&best&&worst&&best.name!==worst.name){
txt+=` Kinerja terbaik: <b>${escapeHtml(best.name)}</b> (${best.pct>=0?'+':''}${best.pct.toFixed(2)}%), terendah: <b>${escapeHtml(worst.name)}</b> (${worst.pct>=0?'+':''}${worst.pct.toFixed(2)}%).`;
}
ringkasanEl.innerHTML=txt;
}
},
// Riwayat Transaksi -- khusus aset yang sudah ditautkan/punya Akun Transaksi (a.accountId).
// Pakai ulang filterTxModal (sama seperti Riwayat di tab Keuangan/Laporan) lewat scope
// baru 'account' di showFilteredTx() (lihat filter-laporan.js) supaya tidak duplikasi UI.
openTxHistory(id){
const a=D.assets.find(x=>sameId(x.id,id));
if(!a){toast('⚠️ Aset tidak ditemukan');return;}
if(!a.accountId){toast('⚠️ Aset ini belum ditautkan ke Akun Transaksi');return;}
const acc=D.accounts.find(x=>sameId(x.id,a.accountId));
if(!acc){toast('⚠️ Akun Transaksi aset ini sudah terhapus');return;}
if(typeof showFilteredTx!=='function'){toast('⚠️ Fitur riwayat transaksi belum tersedia');return;}
showFilteredTx('account',undefined,'📜 Riwayat: '+acc.name,acc.id);
},
// AsetXLSX (bagian ke-10) — export/import data Buku Aset pakai format .xlsx, GANTI dari
// JSON/CSV sebelumnya (exportJSON/exportCSV/importJSON lama dihapus). Pola sama dgn
// ShopExport/ImportShopExcel di cobek.js: pustaka SheetJS di-lazy-load lewat ensureXLSX()
// (didefinisikan di index.html/app_production.html, sama seperti ensureJsPDF/ensureTesseract).
// Data export SELALU diambil live dari D.assets (bukan cache) biar sinkron pas tombol ditekan.
async _ensureXLSXLib(){
if(typeof XLSX!=='undefined')return true;
try{ await ensureXLSX(); }catch(e){ toast('⚠️ Gagal memuat pustaka Excel, cek koneksi internet'); return false; }
if(typeof XLSX==='undefined'){ toast('⚠️ Pustaka Excel tidak tersedia'); return false; }
return true;
},
async exportXLSX(){
const list=D.assets||[];
if(!list.length){toast('⚠️ Belum ada aset untuk di-export');return;}
if(!await Aset._ensureXLSXLib())return;
const rows=[['Nama','Jenis','Lokasi','Nilai','Modal Investasi','Harga Beli/Unit','Jumlah Unit','Tanggal','Zakatable','Akun Tertaut']];
list.forEach(a=>{
const accName=a.accountId?((D.accounts.find(x=>sameId(x.id,a.accountId))||{}).name||''):'';
rows.push([a.name,a.jenis,a.lokasi||'',a.nilai,a.modalInvestasi!=null?a.modalInvestasi:'',a.hargaBeli!=null?a.hargaBeli:'',a.jumlahUnit!=null?a.jumlahUnit:'',a.tanggal||'',a.zakatable?'Ya':'Tidak',accName]);
});
const wb=XLSX.utils.book_new();
const ws=XLSX.utils.aoa_to_sheet(rows);
XLSX.utils.book_append_sheet(wb,ws,'Buku Aset');
XLSX.writeFile(wb,'aset-W-'+new Date().toISOString().split('T')[0]+'.xlsx');
toast('✅ '+list.length+' aset di-export');
},
// BUGFIX-PROTECTIVE: accountId dari file yang di-import SENGAJA tidak dipakai
// (selalu di-null-kan) -- id akun beda antar perangkat/backup, kalau ikut
// dipakai apa adanya bisa nyambung ke akun yang SALAH (kebetulan id-nya sama
// tapi akun berbeda) tanpa ada peringatan apapun ke user. Lebih aman minta
// user tautkan ulang manual lewat modal Edit Aset kalau memang perlu.
async importXLSX(e){
const file=e.target.files[0];if(!file)return;
if(!await Aset._ensureXLSXLib()){e.target.value='';return;}
let rows;
try{
const buf=await file.arrayBuffer();
const wb=XLSX.read(buf,{type:'array'});
const ws=wb.Sheets[wb.SheetNames[0]];
rows=XLSX.utils.sheet_to_json(ws,{defval:''});
}catch{
toast('❌ File tidak valid / rusak (bukan Excel)!');
e.target.value='';
return;
}
const arr=rows.map(r=>({
name:String(r['Nama']||'').trim(),
jenis:String(r['Jenis']||'').trim(),
lokasi:String(r['Lokasi']||'').trim(),
nilai:r['Nilai'],
modalInvestasi:r['Modal Investasi'],
hargaBeli:r['Harga Beli/Unit'],
jumlahUnit:r['Jumlah Unit'],
tanggal:String(r['Tanggal']||'').trim(),
zakatable:String(r['Zakatable']||'').trim().toLowerCase()==='ya'
}));
const valid=arr.filter(a=>a.name&&a.nilai!==''&&a.nilai!=null&&!isNaN(Number(a.nilai)));
const skipped=arr.length-valid.length;
if(!valid.length){
toast('⚠️ Tidak ada aset valid ditemukan di file ini');
e.target.value='';
return;
}
let msg='Ditemukan '+valid.length+' aset valid'+(skipped?' ('+skipped+' baris dilewati krn nama/nilai tidak lengkap)':'')+'. Aset ini akan DITAMBAHKAN ke Buku Aset yang sudah ada (bukan menimpa). Import sekarang?';
const confirmed=await askConfirm(msg,{danger:false,okText:'Ya, Import',icon:'📥'});
if(!confirmed){e.target.value='';return;}
D.assets=D.assets||[];
valid.forEach(a=>{
const nilai=Number(a.nilai)||0;
const modalInvestasi=a.modalInvestasi!=null&&a.modalInvestasi!==''?Number(a.modalInvestasi):null;
D.assets.push({
id:uid(),
name:String(a.name).trim(),
jenis:Aset.ICON[a.jenis]?a.jenis:'Lainnya',
lokasi:a.lokasi||'',
nilai,
tanggal:a.tanggal||todayStr(),
zakatable:!!a.zakatable,
accountId:null,
modalInvestasi,
hargaBeli:a.hargaBeli!=null&&a.hargaBeli!==''?Number(a.hargaBeli):null,
jumlahUnit:a.jumlahUnit!=null&&a.jumlahUnit!==''?Number(a.jumlahUnit):null,
keuntungan:modalInvestasi?(nilai-modalInvestasi):null,
keuntunganPct:modalInvestasi?((nilai-modalInvestasi)/modalInvestasi*100):null
});
});
save();
Aset.renderList();renderKekayaanBersih();hitungZakatMaal();renderAccGrid();renderDashAccList();renderLapAccList();
toast('✅ '+valid.length+' aset berhasil di-import'+(skipped?' ('+skipped+' dilewati)':''));
e.target.value='';
}
};
// Ekspos ke window — WAJIB supaya delegasi klik global (data-action, di
// features-helpers-global-security.js) bisa menemukan modul ini lewat
// window['Aset'][method]. `const Aset = {...}` di atas HANYA membuat
// binding lexical-scope (bukan properti window), pola fix sama persis
// window.FuelModal di modules/vehicle/fuel-modal.js / window.BBM,Servis,Torsi
// di car-notes.js (Sesi 345) — bug yang sama pernah terjadi & diperbaiki di
// sana. Tanpa baris ini, semua tombol data-action="Aset.xxx" gagal diam-diam.
if (typeof Aset !== 'undefined') window.Aset = Aset;
// ================= PENYUSUTAN ASET (bagian ke-11) =================
// FITUR BARU: Penyusutan (depreciation) — estimasi nilai buku aset yang nilainya
// MENURUN dari waktu ke waktu (kendaraan, bangunan, peralatan, dst), kebalikan
// dari "Ringkasan Performa Investasi" (renderInvestasi) di atas yang fokus ke
// aset yang nilainya naik/fluktuatif. 3 metode didukung, sesuai request:
//  - Garis Lurus (straight-line): beban penyusutan RATA tiap bulan sepanjang
//    umur manfaat, dari (Harga Perolehan − Nilai Residu) / Umur Manfaat, lalu
//    diprorata per bulan berjalan (bukan lompat 1x/tahun) supaya nilai buku
//    berubah halus. Nilai buku dibatasi tidak boleh turun di bawah Nilai Residu.
//  - Saldo Menurun (declining balance): tarif % diterapkan ke NILAI BUKU tahun
//    berjalan (bukan ke harga perolehan awal) tiap tahun PENUH yang sudah
//    lewat, sisa bulan di tahun berjalan diprorata linear dari tarif tahun itu.
//    Nominal penyusutan makin kecil tiap tahun (khas saldo menurun), floor di
//    Nilai Residu.
//  - Manual: TIDAK ada formula otomatis — nilai buku = field "Nilai" aset yang
//    sudah ada, di-update sendiri oleh user scr berkala lewat modal Edit Aset.
//    Fungsi manual() di sini cuma pass-through supaya API hitung() tetap
//    konsisten dipanggil dgn metode apapun tanpa percabangan di caller.
// "Harga Perolehan" dasar hitung diambil dari modalInvestasi (kalau diisi) atau
// hargaBeli×jumlahUnit — SAMA seperti dasar "Nilai Buku" di renderDashboard()/
// renderInvestasi(), supaya satu app konsisten definisi "harga perolehan"-nya.
// Kalau dua2nya kosong, Garis Lurus/Saldo Menurun tidak bisa dihitung (hitung()
// balikin hargaPerolehan:null, ditangani di renderList() dgn pesan minta diisi
// data modal dulu).
// Disimpan per-aset di a.penyusutan={aktif,metode,umurManfaatTahun,nilaiResidu,
// tarifPersen}. SENGAJA tidak dibatasi per jenis aset (siapa pun boleh
// diaktifkan) — sama filosofinya dgn modalInvestasi yg juga lintas-jenis (lihat
// catatan di renderInvestasi()), kartu UI cuma kasih hint aset apa yg lazim.
// Dipanggil dari Aset.renderList() spy selalu sinkron tiap save/delete/import,
// pola sama dgn renderDashboard()/renderInvestasi().
const Penyusutan={
METODE_LABELS:{garisLurus:'Garis Lurus',saldoMenurun:'Saldo Menurun',manual:'Manual'},
DEFAULTS:{metode:'garisLurus',umurManfaatTahun:4,nilaiResidu:0,tarifPersen:25},
// Harga Perolehan dasar hitung: sama dgn definisi "buku" di renderDashboard()/renderInvestasi().
hargaPerolehan(a){
if(!a)return null;
if(a.modalInvestasi!=null)return a.modalInvestasi;
if(a.hargaBeli!=null&&a.jumlahUnit!=null)return a.hargaBeli*a.jumlahUnit;
return null;
},
_monthsBetween(dariStr,keStr){
const dari=new Date(dariStr),ke=new Date(keStr);
if(isNaN(dari)||isNaN(ke))return 0;
let months=(ke.getFullYear()-dari.getFullYear())*12+(ke.getMonth()-dari.getMonth());
if(ke.getDate()<dari.getDate())months-=1;
return Math.max(0,months);
},
// Metode 1: Garis Lurus.
garisLurus(hargaPerolehan,nilaiResidu,umurManfaatTahun,tanggalPerolehan,tanggalHitung){
hargaPerolehan=Number(hargaPerolehan)||0;
nilaiResidu=Number(nilaiResidu)||0;
umurManfaatTahun=Number(umurManfaatTahun)||0;
if(hargaPerolehan<=0||umurManfaatTahun<=0||!tanggalPerolehan){
return{nilaiBuku:hargaPerolehan,akumulasi:0,bebanPerTahun:0,bebanPerBulan:0,bulanBerjalan:0,habisManfaat:false};
}
const nilaiDisusutkan=Math.max(0,hargaPerolehan-nilaiResidu);
const bebanPerTahun=nilaiDisusutkan/umurManfaatTahun;
const bebanPerBulan=bebanPerTahun/12;
const totalBulanManfaat=umurManfaatTahun*12;
const bulanBerjalanRaw=Penyusutan._monthsBetween(tanggalPerolehan,tanggalHitung||tanggalPerolehan);
const bulanEfektif=Math.max(0,Math.min(bulanBerjalanRaw,totalBulanManfaat));
const akumulasi=Math.min(nilaiDisusutkan,bebanPerBulan*bulanEfektif);
const nilaiBuku=Math.max(nilaiResidu,hargaPerolehan-akumulasi);
return{nilaiBuku,akumulasi,bebanPerTahun,bebanPerBulan,bulanBerjalan:bulanEfektif,habisManfaat:bulanBerjalanRaw>=totalBulanManfaat};
},
// Metode 2: Saldo Menurun.
saldoMenurun(hargaPerolehan,tarifPersen,nilaiResidu,tanggalPerolehan,tanggalHitung){
hargaPerolehan=Number(hargaPerolehan)||0;
tarifPersen=Number(tarifPersen)||0;
nilaiResidu=Number(nilaiResidu)||0;
if(hargaPerolehan<=0||tarifPersen<=0||!tanggalPerolehan){
return{nilaiBuku:hargaPerolehan,akumulasi:0,tahunBerjalan:0};
}
const bulanBerjalan=Penyusutan._monthsBetween(tanggalPerolehan,tanggalHitung||tanggalPerolehan);
const tahunPenuh=Math.floor(bulanBerjalan/12);
const sisaBulan=bulanBerjalan%12;
const tarif=Math.min(1,tarifPersen/100);
let nilaiBuku=hargaPerolehan;
for(let i=0;i<tahunPenuh&&nilaiBuku>nilaiResidu;i++){
nilaiBuku=Math.max(nilaiResidu,nilaiBuku*(1-tarif));
}
if(sisaBulan>0&&nilaiBuku>nilaiResidu){
const bebanBulanIni=nilaiBuku*tarif/12*sisaBulan;
nilaiBuku=Math.max(nilaiResidu,nilaiBuku-bebanBulanIni);
}
const akumulasi=Math.max(0,hargaPerolehan-nilaiBuku);
return{nilaiBuku,akumulasi,tahunBerjalan:bulanBerjalan/12};
},
// Metode 3: Manual — pass-through, nilai buku = nilai aset yang diisi user sendiri.
manual(nilaiSaatIni){
return{nilaiBuku:Number(nilaiSaatIni)||0,akumulasi:null,tahunBerjalan:null};
},
// Dispatcher: hitung nilai buku SEKARANG (atau di tanggalHitung tertentu) sesuai
// setting penyusutan yg tersimpan di aset (a.penyusutan). Balikin null kalau
// penyusutan belum diaktifkan utk aset ini.
hitung(a,tanggalHitung){
if(!a||!a.penyusutan||!a.penyusutan.aktif)return null;
const p=a.penyusutan;
const metode=p.metode||'garisLurus';
tanggalHitung=tanggalHitung||todayStr();
if(metode==='manual'){
return Object.assign({metode,hargaPerolehan:Penyusutan.hargaPerolehan(a)},Penyusutan.manual(a.nilai));
}
const hargaPerolehan=Penyusutan.hargaPerolehan(a);
if(hargaPerolehan==null){
return{metode,hargaPerolehan:null,nilaiBuku:a.nilai,akumulasi:null};
}
if(metode==='saldoMenurun'){
return Object.assign({metode,hargaPerolehan},Penyusutan.saldoMenurun(hargaPerolehan,p.tarifPersen,p.nilaiResidu,a.tanggal,tanggalHitung));
}
return Object.assign({metode,hargaPerolehan},Penyusutan.garisLurus(hargaPerolehan,p.nilaiResidu,p.umurManfaatTahun,a.tanggal,tanggalHitung));
},
// Nyalakan/matikan penyusutan utk 1 aset. Saat dinyalakan pertama kali (belum
// pernah punya a.penyusutan sama sekali), isi dgn DEFAULTS supaya field2 di UI
// langsung ada nilainya (bukan kosong/NaN).
toggleAktif(id){
const a=D.assets.find(x=>sameId(x.id,id));
if(!a)return;
a.penyusutan=a.penyusutan||Object.assign({},Penyusutan.DEFAULTS);
a.penyusutan.aktif=!a.penyusutan.aktif;
save();
Penyusutan.renderList();
},
// Update 1 parameter (metode/umurManfaatTahun/nilaiResidu/tarifPersen) dari kontrol
// per-baris di kartu Penyusutan. no-op kalau aset/penyusutan-nya belum ada (mis.
// race condition re-render), TIDAK bikin objek baru di sini spy tidak mem-bypass
// toggleAktif() sbg satu2nya titik nyalain penyusutan.
updateParam(id,field,rawValue){
const a=D.assets.find(x=>sameId(x.id,id));
if(!a||!a.penyusutan)return;
if(field==='metode'){
a.penyusutan.metode=rawValue;
} else if(field==='nilaiResidu'){
a.penyusutan.nilaiResidu=parsePzNum(rawValue);
} else if(field==='umurManfaatTahun'){
a.penyusutan.umurManfaatTahun=parseDecStr(rawValue)||0;
} else if(field==='tarifPersen'){
a.penyusutan.tarifPersen=parseDecStr(rawValue)||0;
}
save();
Penyusutan.renderList();
},
// Render kartu "📉 Penyusutan Aset": 1 baris per aset (toggle aktif + kontrol
// metode & parameter kalau aktif + hasil hitung), plus total Akumulasi
// Penyusutan & total Nilai Buku Sekarang lintas aset yg aktif.
renderList(){
const card=document.getElementById('assetPenyusutanDashboard');
const box=document.getElementById('assetPenyusutanList');
if(!card||!box)return;
const list=D.assets||[];
card.classList.remove('u-dnone');
if(!list.length){
const ta=document.getElementById('assetPenyusutanTotalAkumulasi');if(ta)ta.textContent=fmtFull(0);
const tb=document.getElementById('assetPenyusutanTotalBuku');if(tb)tb.textContent=fmtFull(0);
box.innerHTML='<div class="u-fs12 u-t2 u-lh15">Belum ada aset tercatat — tambah aset pertama lewat 📋 Buku Aset di bawah, lalu aktifkan penyusutan per aset di sini.</div>';
return;
}
let totalAkumulasi=0,totalBuku=0;
box.innerHTML=list.map(a=>{
const aktif=!!(a.penyusutan&&a.penyusutan.aktif);
const p=a.penyusutan||Penyusutan.DEFAULTS;
const icon=Aset.ICON[a.jenis]||'📦';
const iconHtml=(typeof FeatureIcons!=='undefined')?FeatureIcons.render(icon,{size:14}):icon;
let bodyHtml='';
if(aktif){
const hasil=Penyusutan.hitung(a);
const metode=p.metode||'garisLurus';
const metodeOpts=['garisLurus','saldoMenurun','manual'].map(m=>`<option value="${m}" ${m===metode?'selected':''}>${Penyusutan.METODE_LABELS[m]}</option>`).join('');
let fieldsHtml='';
if(metode==='garisLurus'){
fieldsHtml=`<div class="u-grid2 u-gap8 u-mb8">
        <div><label class="fl">Umur Manfaat (tahun)</label><input type="text" inputmode="numeric" class="fi" value="${p.umurManfaatTahun!=null?p.umurManfaatTahun:''}" onchange="Penyusutan.updateParam('${a.id}','umurManfaatTahun',this.value)"></div>
        <div><label class="fl">Nilai Residu (Rp)</label><input type="text" inputmode="numeric" class="fi" value="${p.nilaiResidu!=null?p.nilaiResidu:''}" onchange="Penyusutan.updateParam('${a.id}','nilaiResidu',this.value)"></div>
      </div>`;
} else if(metode==='saldoMenurun'){
fieldsHtml=`<div class="u-grid2 u-gap8 u-mb8">
        <div><label class="fl">Tarif per Tahun (%)</label><input type="text" inputmode="numeric" class="fi" value="${p.tarifPersen!=null?p.tarifPersen:''}" onchange="Penyusutan.updateParam('${a.id}','tarifPersen',this.value)"></div>
        <div><label class="fl">Nilai Residu (Rp)</label><input type="text" inputmode="numeric" class="fi" value="${p.nilaiResidu!=null?p.nilaiResidu:''}" onchange="Penyusutan.updateParam('${a.id}','nilaiResidu',this.value)"></div>
      </div>`;
} else {
fieldsHtml=`<div class="u-fs11 u-t2 u-mb8">Nilai buku = field "Nilai" aset ini, di-update manual sendiri lewat Edit Aset. Tidak ada formula otomatis di metode ini.</div>`;
}
let resultHtml='';
if(metode!=='manual'&&hasil.hargaPerolehan==null){
resultHtml=`<div class="u-fs11 u-cacc2">⚠️ Isi dulu Modal Investasi atau Harga Beli × Jumlah Unit di data aset ini supaya bisa dihitung.</div>`;
} else {
totalBuku+=hasil.nilaiBuku||0;
if(hasil.akumulasi!=null)totalAkumulasi+=hasil.akumulasi;
resultHtml=`<div class="u-fs12"><b>Nilai Buku Sekarang: ${fmtFull(hasil.nilaiBuku)}</b>${hasil.akumulasi!=null?' · Akumulasi Penyusutan: '+fmtFull(hasil.akumulasi):''}</div>`;
if(hasil.habisManfaat)resultHtml+=`<div class="u-fs11 u-t2 u-mt2">✅ Sudah mencapai akhir umur manfaat.</div>`;
}
bodyHtml=`<div class="fg" style="margin-bottom:8px"><label class="fl">Metode</label><select class="fs" onchange="Penyusutan.updateParam('${a.id}','metode',this.value)">${metodeOpts}</select></div>`+fieldsHtml+resultHtml;
}
return `<div class="u-r10 u-mb10" style="border:1px solid var(--border);padding:10px 12px">
      <div class="u-flex u-jcb u-aic u-mb8">
        <div class="fi-insight-row u-fs13 u-fw600"><span class="fi-insight-icon">${iconHtml}</span><span>${escapeHtml(a.name)}</span></div>
        <label class="u-fs11 u-flex u-aic" style="gap:4px"><input type="checkbox" ${aktif?'checked':''} onchange="Penyusutan.toggleAktif('${a.id}')"> Aktif</label>
      </div>
      ${bodyHtml}
    </div>`;
}).join('');
const totalEl=document.getElementById('assetPenyusutanTotalAkumulasi');
if(totalEl)totalEl.textContent=fmtFull(totalAkumulasi);
const bukuEl=document.getElementById('assetPenyusutanTotalBuku');
if(bukuEl)bukuEl.textContent=fmtFull(totalBuku);
// Widget Rekomendasi AI (penyusutan-ai-widget.js) — opsional, di-guard supaya
// renderList() tetap aman kalau file itu belum/tidak dimuat. Container-nya
// (#assetPenyusutanAI) TERPISAH dari #assetPenyusutanList, pola sama dgn
// InvestAI.mountInto() di AlokasiAset.renderOne().
if(typeof PenyusutanAI!=='undefined'){
const aiEl=document.getElementById('assetPenyusutanAI');
if(aiEl)PenyusutanAI.mountInto(aiEl);
}
}
};
// ================= PAJAK ASET (bagian ke-12) =================
// FITUR BARU: Pajak Aset — estimasi 2 kewajiban yang nempel langsung ke aset
// yang tercatat di Buku Aset (BUKAN pengganti kalkulator umum di tab 🕌 Pajak
// yang sudah ada — PPh21/PBB manual/Zakat Maal lengkap dgn aset cair & utang
// -- ini scope-nya sengaja lebih sempit & auto-sync dari Buku Aset):
//  - PBB (Pajak Bumi & Bangunan): khusus aset berjenis 'Tanah' atau
//    'Rumah/Bangunan'. NJOP didekati dari field "Nilai" aset (Buku Aset tidak
//    simpan NJOP resmi terpisah) dikurangi NJOPTKP, dikali tarif PBB-P2.
//    NJOPTKP & tarif adalah SATU setting global (bukan per-aset) krn biasanya
//    sama utk semua properti di 1 daerah yang sama — disimpan di
//    D.pajakAsetSettings, default NJOPTKP Rp12.000.000 & tarif 0,5% (batas
//    maks menurut UU HKPD), TAPI beda tiap Pemda jadi selalu ada disclaimer
//    cek Perda/SPPT setempat (sama semangatnya dgn kartu PBB manual di tab
//    Pajak).
//  - Zakat Maal Aset: breakdown 2,5% KHUSUS dari aset yang ditandai
//    zakatable di Buku Aset (a.zakatable) — beda dari hitungZakatMaal() di
//    tab Pajak yang scope-nya lebih luas (ikut hitung aset cair & kurangi
//    utang). Di sini murni supaya user lihat aset MANA aja yg nyumbang &
//    berapa nominalnya per aset, tanpa perlu buka tab lain.
// Ringkasan Pajak menggabungkan total PBB + total Zakat Maal Aset jadi 1
// estimasi kewajiban tahunan per Buku Aset.
// Dipanggil dari Aset.renderList() spy selalu sinkron tiap save/delete/import,
// pola sama dgn Penyusutan.renderList().
const PajakAset={
DEFAULTS:{njoptkp:12000000,tarifPersen:0.5},
JENIS_PROPERTI:['Tanah','Rumah/Bangunan'],
settings(){
D.pajakAsetSettings=D.pajakAsetSettings||Object.assign({},PajakAset.DEFAULTS);
return D.pajakAsetSettings;
},
// Update setting global NJOPTKP/tarifPersen dari kontrol di kartu Pajak Aset.
updateSetting(field,rawValue){
if(field!=='njoptkp'&&field!=='tarifPersen')return;
const s=PajakAset.settings();
if(field==='njoptkp')s.njoptkp=parsePzNum(rawValue);
else s.tarifPersen=parseDecStr(rawValue)||0;
save();
PajakAset.renderList();
},
// Estimasi PBB 1 aset properti. null kalau bukan jenis Tanah/Rumah-Bangunan.
hitungPBB(a,settings){
if(!a||!PajakAset.JENIS_PROPERTI.includes(a.jenis))return null;
const s=settings||PajakAset.settings();
const njop=a.nilai||0;
const njoptkp=s.njoptkp||0;
const dasar=Math.max(0,njop-njoptkp);
const terutang=Math.round(dasar*(s.tarifPersen||0)/100);
return{njop,njoptkp,dasar,terutang};
},
zakatableAssets(){
return(D.assets||[]).filter(a=>a.zakatable);
},
// Breakdown Zakat Maal 2,5% khusus aset zakatable di Buku Aset (TANPA cek
// haul/nishab terpisah — itu urusan kalkulator Zakat Maal utama di tab Pajak).
// SESI 393: totalNilai sekarang dihitung dari PORSI MILIK SENDIRI tiap aset
// (Aset.selfOwnedNilai(), 100% reuse MultiOwnerEngine.selfOwnedValue() S390)
// -- BUKAN nilai penuh lagi. Aset single-owner (mayoritas — default/legacy)
// tetap balik nilai penuh (selfPorsi 100%, 0 regresi). Aset multi-pemilik yg
// porsi user belum ditandai "👤 Saya" di modal porsi (assetOwnersModal)
// otomatis TIDAK ikut disumbang ke Zakat -- sesuai temuan audit: nilai
// pemilik lain tidak seharusnya kena zakat kamu.
hitungZakatAset(){
const list=PajakAset.zakatableAssets();
const totalNilai=list.reduce((s,a)=>s+Aset.selfOwnedNilai(a),0);
const totalZakat=Math.round(totalNilai*0.025);
return{list,totalNilai,totalZakat};
},
// Render kartu "🧾 Pajak Aset": setting NJOPTKP/tarif, breakdown estimasi PBB
// per aset properti, breakdown Zakat Maal per aset zakatable, & Ringkasan
// Pajak (total gabungan). Kartu disembunyikan kalau tidak ada aset properti
// maupun aset zakatable sama sekali (belum relevan ditampilkan).
renderList(){
const card=document.getElementById('assetPajakDashboard');
const box=document.getElementById('assetPajakList');
if(!card||!box)return;
const properti=(D.assets||[]).filter(a=>PajakAset.JENIS_PROPERTI.includes(a.jenis));
const zakat=PajakAset.hitungZakatAset();
card.classList.remove('u-dnone');
if(!properti.length&&!zakat.list.length){
const tp=document.getElementById('assetPajakTotalPBB');if(tp)tp.textContent=fmtFull(0);
const tz=document.getElementById('assetPajakTotalZakat');if(tz)tz.textContent=fmtFull(0);
box.innerHTML='<div class="u-fs12 u-t2 u-lh15">Belum ada aset properti (tanah/bangunan) atau aset yang ditandai "Zakat" — tandai di 📋 Buku Aset supaya estimasi PBB/Zakat Maal muncul di sini.</div>';
return;
}
const s=PajakAset.settings();
// BUGFIX-PROTECTIVE: tidak overwrite input NJOPTKP/tarif kalau lagi difokus
// user (sedang diketik) supaya re-render (dipicu save/delete aset lain)
// tidak "melompat"/reset kursor di tengah ngetik.
const njoptkpEl=document.getElementById('pajakAsetNjoptkp');
if(njoptkpEl&&document.activeElement!==njoptkpEl)njoptkpEl.value=s.njoptkp;
const tarifEl=document.getElementById('pajakAsetTarif');
if(tarifEl&&document.activeElement!==tarifEl)tarifEl.value=s.tarifPersen;
let totalPBB=0;
const pbbHtml=properti.length?('<div class="u-fs12t2 u-fw700 u-mb6">🏛️ Estimasi PBB</div>'+properti.map(a=>{
const r=PajakAset.hitungPBB(a,s);
totalPBB+=r.terutang;
return `<div class="u-flex u-jcb u-aifs u-gap8 u-fs12 u-mb6"><span class="u-flex1">${Aset.ICON[a.jenis]||'📦'} ${escapeHtml(a.name)}</span><span class="u-fw700 u-tar" style="white-space:nowrap">${fmtFull(r.terutang)}/th</span></div>`;
}).join('')):'';
const zakatHtml=zakat.list.length?('<div class="u-fs12t2 u-fw700 u-mb6 u-mt10">🕌 Zakat Maal per Aset (bukan Kekayaan Bersih)</div>'+zakat.list.map(a=>{
const z=Math.round(Aset.selfOwnedNilai(a)*0.025);
return `<div class="u-flex u-jcb u-aifs u-gap8 u-fs12 u-mb6"><span class="u-flex1">${Aset.ICON[a.jenis]||'📦'} ${escapeHtml(a.name)}</span><span class="u-fw700 u-tar" style="white-space:nowrap">${fmtFull(z)}</span></div>`;
}).join('')):'';
box.innerHTML=(pbbHtml+zakatHtml)||'<div class="u-fs12 u-t2">Belum ada aset Tanah/Rumah-Bangunan atau aset zakatable.</div>';
const pbbEl=document.getElementById('assetPajakTotalPBB');
if(pbbEl)pbbEl.textContent=fmtFull(totalPBB);
const zakatEl=document.getElementById('assetPajakTotalZakat');
if(zakatEl)zakatEl.textContent=fmtFull(zakat.totalZakat);
const totalPajak=totalPBB+zakat.totalZakat;
const ringkasanEl=document.getElementById('assetPajakRingkasan');
if(ringkasanEl){
ringkasanEl.innerHTML=`📋 <b>Ringkasan Pajak:</b> estimasi total kewajiban pajak &amp; zakat dari Buku Aset ±<b>${fmtFull(totalPajak)}</b>/tahun — PBB ${fmtFull(totalPBB)} (${properti.length} aset properti) + Zakat Maal per Aset ${fmtFull(zakat.totalZakat)} (${zakat.list.length} aset zakatable, TIDAK termasuk Piutang/Utang). Estimasi kasar dari data Buku Aset, bukan angka resmi SPPT/lembaga zakat — cek Perda/BAZNAS setempat utk angka pasti. Untuk Zakat Maal lengkap (Saldo+Aset+Piutang−Utang), lihat kartu 💰 Zakat Maal di tab 🕌 Pajak.`;
}
}
};
// ================= LAPORAN ASET (bagian ke-13) =================
// FITUR BARU: Laporan Aset — satu kartu ringkas yang menggabungkan 5 hal yang
// sebelumnya cuma bisa dilihat kepencar di kartu2 lain, supaya bisa dibaca/
// dicetak jadi 1 laporan utuh: (1) Daftar Aset, (2) Riwayat Transaksi (dari
// akun2 yang ditautkan ke aset), (3) Nilai Aset (Pasar vs Buku + breakdown
// kategori — angka SAMA dgn Aset.renderDashboard(), dihitung ulang di sini
// spy modul ini berdiri sendiri/tidak bergantung urutan render kartu lain),
// (4) Penyusutan (ringkasan akumulasi & nilai buku sekarang, KHUSUS aset yg
// penyusutannya sudah Aktif — detail per-metode tetap di kartu 📉 Penyusutan
// Aset), dan (5) Ringkasan Kekayaan (dari Aset) — total nilai, kategori
// terbesar, & berapa yg zakatable. SENGAJA tidak mengulang scope kartu 🏦
// Kekayaan Bersih (renderKekayaanBersih, di luar file ini — itu gabungan
// akun+aset+utang) atau 🧾 Pajak Aset (PajakAset, PBB/Zakat) — laporan ini
// murni rekap sisi ASET saja spy tidak tumpang tindih & gampang dites sendiri.
// build() dipisah dari renderList() (pola sama dgn PajakAset.hitungZakatAset()
// vs renderList()) supaya logic murni bisa dites tanpa DOM.
const LaporanAset={
// Riwayat Transaksi: HANYA mencakup aset yang sudah ditautkan ke Akun Transaksi
// (a.accountId, sama syarat dgn Aset.openTxHistory()). D.transactions diasumsikan
// array flat berisi seluruh transaksi keuangan app (field minimal dipakai di sini:
// accountId, type ['income'|'expense'], amount, date, note) — kalau
// D.transactions belum ada/bukan array, dianggap kosong (tidak error).
riwayatTransaksi(){
const assets=(D.assets||[]).filter(a=>a.accountId);
const allTx=Array.isArray(D.transactions)?D.transactions:[];
const akunTertaut=assets.map(a=>{
const acc=(D.accounts||[]).find(x=>sameId(x.id,a.accountId));
const txAkun=acc?allTx.filter(t=>sameId(t.accountId,acc.id)):[];
const totalMasuk=txAkun.filter(t=>t.type==='income').reduce((s,t)=>s+(t.amount||0),0);
const totalKeluar=txAkun.filter(t=>t.type==='expense').reduce((s,t)=>s+(t.amount||0),0);
return{assetId:a.id,assetName:a.name,accountId:a.accountId,accountName:acc?acc.name:null,accountExists:!!acc,jumlahTx:txAkun.length,totalMasuk,totalKeluar};
});
const accIds=akunTertaut.filter(x=>x.accountExists).map(x=>x.accountId);
const gabungan=allTx.filter(t=>accIds.some(id=>sameId(t.accountId,id)));
const recentTx=gabungan.slice().sort((x,y)=>new Date(y.date||0)-new Date(x.date||0)).slice(0,10);
return{akunTertaut,recentTx,totalTx:gabungan.length};
},
// Nilai Aset: total Nilai Pasar (a.nilai) vs Nilai Buku (modal/harga perolehan,
// definisi SAMA dgn Aset.renderDashboard()) + breakdown per kategori (jenis).
// S201 (Finalisasi Sinkronisasi Lintas Modul): fix — filter isAssetOwnershipSelf
// ditambahkan supaya BENAR-BENAR "SAMA dgn Aset.renderDashboard()" seperti
// diklaim komentar di atas (Sesi 193 sudah menambah filter ini di
// renderDashboard(), tapi LaporanAset.nilaiAset() sempat luput -> Dashboard
// Aset & Laporan Aset bisa beda angka kalau ada aset ber-ownership non-SELF).
// 0 rumus baru — reuse isAssetOwnershipSelf() yang sudah ada apa adanya.
nilaiAset(){
const list=(D.assets||[]).filter(isAssetOwnershipSelf);
let totalPasar=0,totalBuku=0;
const perKategori={};
list.forEach(a=>{
const pasar=a.nilai||0;
const buku=a.modalInvestasi!=null?a.modalInvestasi:(a.hargaBeli!=null&&a.jumlahUnit!=null?a.hargaBeli*a.jumlahUnit:pasar);
totalPasar+=pasar;totalBuku+=buku;
const jenis=a.jenis||'Lainnya';
if(!perKategori[jenis])perKategori[jenis]={count:0,nilai:0};
perKategori[jenis].count++;
perKategori[jenis].nilai+=pasar;
});
const selisih=totalPasar-totalBuku;
const selisihPct=totalBuku?(selisih/totalBuku*100):0;
return{totalPasar,totalBuku,selisih,selisihPct,perKategori};
},
// Penyusutan: rekap ringkas lintas aset yg penyusutannya AKTIF (detail per-metode
// tetap di kartu Penyusutan.renderList() — di sini cuma total utk laporan).
penyusutan(){
const list=(D.assets||[]).filter(a=>a.penyusutan&&a.penyusutan.aktif);
let totalAkumulasi=0,totalBukuSekarang=0,belumLengkap=0;
list.forEach(a=>{
const hasil=Penyusutan.hitung(a);
if(!hasil)return;
if(hasil.metode!=='manual'&&hasil.hargaPerolehan==null){belumLengkap++;return;}
totalBukuSekarang+=hasil.nilaiBuku||0;
if(hasil.akumulasi!=null)totalAkumulasi+=hasil.akumulasi;
});
return{jumlahAktif:list.length,totalAkumulasi,totalBukuSekarang,belumLengkap};
},
// Ringkasan Kekayaan (dari Aset) — SENGAJA cuma sisi aset (bukan gabungan akun+
// utang spt renderKekayaanBersih() global), supaya laporan ini murni & mandiri.
ringkasanKekayaan(){
// S201: filter isAssetOwnershipSelf() supaya jumlahAset KONSISTEN dgn
// totalNilaiPasar/totalNilaiBuku (nilaiAset(), sudah difilter di atas) —
// 1 laporan, 1 populasi aset yang sama, bukan jumlah dari populasi lebih
// besar dipasangkan dgn nilai dari populasi lebih kecil.
const list=(D.assets||[]).filter(isAssetOwnershipSelf);
const nilai=LaporanAset.nilaiAset();
const zakat=(typeof PajakAset!=='undefined'?PajakAset.hitungZakatAset():{totalNilai:0,totalZakat:0,list:[]});
const kategoriRows=Object.entries(nilai.perKategori).sort((a,b)=>b[1].nilai-a[1].nilai);
const terbesar=kategoriRows.length?{jenis:kategoriRows[0][0],pct:nilai.totalPasar?(kategoriRows[0][1].nilai/nilai.totalPasar*100):0}:null;
return{jumlahAset:list.length,jumlahKategori:kategoriRows.length,totalNilaiPasar:nilai.totalPasar,totalNilaiBuku:nilai.totalBuku,totalZakatable:zakat.totalNilai,jumlahZakatable:zakat.list.length,kategoriTerbesar:terbesar};
},
// Gabungan semua data laporan (dipakai renderList() & bisa dipakai eksternal/test
// tanpa DOM sama sekali).
build(){
return{
daftarAset:(D.assets||[]).map(a=>({id:a.id,name:a.name,jenis:a.jenis,icon:Aset.ICON[a.jenis]||'📦',nilai:a.nilai||0,lokasi:a.lokasi||'',tanggal:a.tanggal||'',zakatable:!!a.zakatable,accountId:a.accountId||null})),
riwayatTransaksi:LaporanAset.riwayatTransaksi(),
nilaiAset:LaporanAset.nilaiAset(),
penyusutan:LaporanAset.penyusutan(),
ringkasanKekayaan:LaporanAset.ringkasanKekayaan()
};
},
// Render kartu "📑 Laporan Aset". Kartu disembunyikan kalau belum ada aset sama
// sekali (belum relevan ditampilkan) — pola sama dgn Penyusutan/PajakAset.
// Dipanggil dari Aset.renderList() spy selalu sinkron tiap save/delete/import.
renderList(){
const card=document.getElementById('laporanAsetCard');
if(!card)return;
card.classList.remove('u-dnone');
const data=LaporanAset.build();
// (1) Daftar Aset
const daftarEl=document.getElementById('lapAsetDaftar');
if(daftarEl){
daftarEl.innerHTML=data.daftarAset.map(a=>{
const iconHtml=(typeof FeatureIcons!=='undefined')?FeatureIcons.render(a.icon,{size:14}):(a.icon||'');
return `<div class="lap-aset-row u-fs12"><span class="lap-aset-name fi-insight-row"><span class="fi-insight-icon">${iconHtml}</span><span>${escapeHtml(a.name)}${a.zakatable?' 🕌':''}</span></span><span class="lap-aset-val">${fmtFull(a.nilai)}</span></div>`;
}).join('')||'<div class="u-fs12 u-t2">Belum ada aset tercatat</div>';
}
// (2) Riwayat Transaksi
const riwayatEl=document.getElementById('lapAsetRiwayat');
if(riwayatEl){
const r=data.riwayatTransaksi;
const tertaut=r.akunTertaut.filter(x=>x.accountExists);
if(!tertaut.length){
riwayatEl.innerHTML='<div class="u-fs12 u-t2">Belum ada aset yang ditautkan ke Akun Transaksi.</div>';
} else {
riwayatEl.innerHTML=tertaut.map(x=>`<div class="u-fs12 u-mb6"><b>${escapeHtml(x.assetName)}</b> · 🔗 ${escapeHtml(x.accountName)} — ${x.jumlahTx} transaksi <span class="green">+${fmtFull(x.totalMasuk)}</span> / <span class="red">-${fmtFull(x.totalKeluar)}</span></div>`).join('')+`<div class="u-fs11 u-t2 u-mt6">Total ${r.totalTx} transaksi tercatat lintas akun tertaut.</div>`;
}
}
// (3) Nilai Aset
const nilaiEl=document.getElementById('lapAsetNilai');
if(nilaiEl){
const n=data.nilaiAset;
const cls=n.selisih>=0?'green':'red';
nilaiEl.innerHTML=`<div class="u-fs12 u-mb6">Nilai Pasar: <b>${fmtFull(n.totalPasar)}</b> · Nilai Buku: <b>${fmtFull(n.totalBuku)}</b></div><div class="u-fs12 ${cls}">Selisih: ${fmtFullSigned(n.selisih)} (${n.selisih>=0?'+':''}${n.selisihPct.toFixed(2)}%)</div>`;
}
// (4) Penyusutan
const penyusutanEl=document.getElementById('lapAsetPenyusutan');
if(penyusutanEl){
const p=data.penyusutan;
penyusutanEl.innerHTML=p.jumlahAktif?`<div class="u-fs12">${p.jumlahAktif} aset aktif penyusutan · Akumulasi ${fmtFull(p.totalAkumulasi)} · Nilai Buku Sekarang ${fmtFull(p.totalBukuSekarang)}</div>`:'<div class="u-fs12 u-t2">Belum ada aset yang mengaktifkan penyusutan.</div>';
}
// (5) Ringkasan Kekayaan
const ringkasanEl=document.getElementById('lapAsetRingkasan');
if(ringkasanEl){
const rk=data.ringkasanKekayaan;
let txt=`📦 <b>${rk.jumlahAset}</b> aset di <b>${rk.jumlahKategori}</b> kategori, total nilai pasar <b>${fmtFull(rk.totalNilaiPasar)}</b> (nilai buku ${fmtFull(rk.totalNilaiBuku)})`;
if(rk.kategoriTerbesar)txt+=`. Kategori terbesar: <b>${escapeHtml(rk.kategoriTerbesar.jenis)}</b> (${rk.kategoriTerbesar.pct.toFixed(1)}%)`;
if(rk.jumlahZakatable)txt+=`. ${rk.jumlahZakatable} aset zakatable senilai ${fmtFull(rk.totalZakatable)}`;
txt+='.';
ringkasanEl.innerHTML=txt;
}
}
};
const IDBStore={
_dbPromise:null,
DB_NAME:'kw_idb_v1',
STORE:'kv',
_open(){
if(IDBStore._dbPromise)return IDBStore._dbPromise;
IDBStore._dbPromise=new Promise((resolve,reject)=>{
if(!window.indexedDB){reject(new Error('IndexedDB tidak didukung browser ini'));return;}
let req;
try{ req=indexedDB.open(IDBStore.DB_NAME,1); }catch(e){reject(e);return;}
// BUGFIX (audit "tombol Katalog/Import PDF macet, 0 toast", laporan user): dulu tidak
// ada req.onblocked maupun timeout di sini. indexedDB.open() bisa BLOCKED (mis. tab/
// koneksi lain masih pegang DB versi lama) -- kalau itu terjadi, onsuccess/onerror
// TIDAK PERNAH terpanggil, _dbPromise gantung SELAMANYA, dan setiap fitur yang lewat
// IDBStore (VehicleCatalog/Import PDF Katalog/dll) jadi "tombol mati" tanpa toast
// (promise yang cuma diam menggantung bukan reject, jadi tidak ketangkep .catch() di
// dispatcher klik). Fix: (1) log onblocked biar kelihatan di console, (2) timeout 8
// detik yang reject dgn pesan jelas + reset cache, supaya paling buruk user dapat
// toast error yang bisa dilaporkan, bukan tombol yang diam mati total.
let settled=false;
const timeoutId=setTimeout(()=>{
if(settled)return;
settled=true;
IDBStore._dbPromise=null;
reject(new Error('Membuka IndexedDB terlalu lama (mungkin diblokir tab/koneksi lain) -- coba tutup tab lain yang membuka aplikasi ini, lalu ulangi.'));
},8000);
req.onblocked=()=>{ console.warn('IndexedDB open() diblokir -- kemungkinan ada koneksi lain (tab lain) yang masih terbuka di versi lama.'); };
req.onupgradeneeded=()=>{ try{ req.result.createObjectStore(IDBStore.STORE); }catch(e){} };
req.onsuccess=()=>{
if(settled)return;
settled=true;
clearTimeout(timeoutId);
const db=req.result;
// BUGFIX: kalau koneksi ini ditutup (mis. tab lain upgrade versi DB, atau
// browser menutup koneksi idle) TANPA reset di sini, _dbPromise tetap
// nyimpen janji lama yg resolve ke objek IDBDatabase yg sudah "closing" --
// pemanggilan .transaction() berikutnya lewat cache itu bakal langsung
// lempar InvalidStateError. Makanya begitu koneksi ditutup dgn cara apa
// pun, cache di-null-kan supaya panggilan _open() berikutnya buka koneksi
// baru yang sehat.
db.onversionchange=()=>{ try{db.close();}catch(e){} IDBStore._dbPromise=null; };
db.onclose=()=>{ IDBStore._dbPromise=null; };
resolve(db);
};
req.onerror=()=>{
if(settled)return;
settled=true;
clearTimeout(timeoutId);
IDBStore._dbPromise=null;
reject(req.error||new Error('Gagal membuka IndexedDB'));
};
});
return IDBStore._dbPromise;
},
async get(key){
return IDBStore._withRetry(async()=>{
const db=await IDBStore._open();
return await new Promise((resolve,reject)=>{
const tx=db.transaction(IDBStore.STORE,'readonly');
const req=tx.objectStore(IDBStore.STORE).get(key);
req.onsuccess=()=>resolve(req.result);
req.onerror=()=>reject(req.error||new Error('Gagal membaca dari IndexedDB'));
});
},'get("'+key+'")',undefined);
},
async set(key,value){
return IDBStore._withRetry(async()=>{
const db=await IDBStore._open();
return await new Promise((resolve,reject)=>{
const tx=db.transaction(IDBStore.STORE,'readwrite');
tx.objectStore(IDBStore.STORE).put(value,key);
tx.oncomplete=()=>resolve(true);
tx.onerror=()=>reject(tx.error||new Error('Gagal menulis ke IndexedDB'));
});
},'set("'+key+'")',false);
},
// BARU (item "BELUM DIKERJAKAN" resetApp(): dulu resetApp() cuma localStorage.clear(),
// tidak pernah menyentuh IndexedDB -- lihat docs/CATATAN-CEK-CLAUDE.md). Mengosongkan
// SELURUH object store 'kv' (termasuk kw_v4_mirror, lifeos:store, eie:store, ai:store,
// dst -- semua key yg lewat IDBStore.set()), bukan cuma 1 key, karena reset total memang
// harus membersihkan semua mirror data, bukan cuma mirror utama.
async clear(){
return IDBStore._withRetry(async()=>{
const db=await IDBStore._open();
return await new Promise((resolve,reject)=>{
const tx=db.transaction(IDBStore.STORE,'readwrite');
tx.objectStore(IDBStore.STORE).clear();
tx.oncomplete=()=>resolve(true);
tx.onerror=()=>reject(tx.error||new Error('Gagal mengosongkan IndexedDB'));
});
},'clear()',false);
},
// BUGFIX: pembungkus retry -- kalau kegagalan disebabkan koneksi yg lagi
// closing/invalid (InvalidStateError, atau nama "closing" khas Safari),
// buang cache _dbPromise & coba SEKALI lagi dgn koneksi baru sebelum
// benar-benar menyerah. Menghindari error IndexedDB numpuk terus tiap
// kali koneksi lama jadi basi (mis. abis hot-reload pas dev).
async _withRetry(fn,label,fallback){
try{
return await fn();
}catch(e){
const staleConn=e&&(e.name==='InvalidStateError'||/closing/i.test(e.message||''));
if(staleConn){
IDBStore._dbPromise=null;
try{ return await fn(); }
catch(e2){ console.error('IndexedDB '+label+' gagal (setelah retry):',e2); return fallback; }
}
console.error('IndexedDB '+label+' gagal:',e);
return fallback;
}
}
};
const PORTFOLIO_LABELS={
nilai:/nilai\s*(sekarang|saat\s*ini)/i,
modal:/modal\s*investasi/i,
hargaBeli:/harga\s*(beli|perolehan)/i,
// BUGFIX (laporan user): layar "Detail Portofolio" per-instrumen Bibit pakai label
// "Total Unit" (bukan "Jumlah Unit" seperti halaman Bibit lain) utk field yang sama --
// tambahkan sbg alternatif, TIDAK mengganti "jumlah unit" yang sudah ada.
jumlahUnit:/(?:jumlah|total)\s*unit/i
};
const TimelineW={
avgSurplus(){
if(typeof Pensiun!=='undefined')return Pensiun.avgSurplus();
return{surplus:0,months:0};
},
goals(){
const goals=[];
(D.renovProjects||[]).forEach(p=>{
if(typeof Renov==='undefined')return;
const t=Renov.totals(p);
if(t.sisa>0)goals.push({key:'renov-'+p.id,emoji:'🔨',label:'Renovasi: '+p.name,remaining:t.sisa,kind:'renov'});
});
(D.targets||[]).forEach(t=>{
if(t.isDanaDarurat)return;
const remaining=Math.max(0,(t.amount||0)-(t.saved||0));
if(remaining>0)goals.push({key:'target-'+t.id,emoji:t.emoji||'🎯',label:t.name,remaining,kind:'target'});
});
return goals;
},
waterfall(){
const{surplus,months}=TimelineW.avgSurplus();
const goals=TimelineW.goals();
let cursor=0;
const rows=goals.map(g=>{
const monthsNeeded=surplus>0?Math.ceil(g.remaining/surplus):null;
const startMonth=cursor;
const endMonth=monthsNeeded!=null?cursor+monthsNeeded:null;
if(endMonth!=null)cursor=endMonth;
return{...g,monthsNeeded,startMonth,endMonth};
});
return{rows,surplus,surplusMonths:months};
},
addMonthsToDate(n){
const d=new Date();
d.setDate(1);
d.setMonth(d.getMonth()+n);
return d;
},
render(){
const card=document.getElementById('timelineWCard');
if(!card)return;
const{rows,surplus,surplusMonths}=TimelineW.waterfall();
const pensiunP=D.pensiun||{};
const pensiunAda=pensiunP.usiaSekarang&&pensiunP.usiaPensiun&&pensiunP.accId;
if(!rows.length&&!pensiunAda){card.style.display='none';return;}
card.classList.remove('u-dnone');card.style.display='block';
let body='';
if(surplus<=0){
body+=`<div class="u-fs12 u-cacc2 u-r10 u-mb10 u-lh15" style="background:var(--accent2-soft);padding:8px 10px">⚠️ Rata-rata ${surplusMonths} bulan terakhir belum surplus (pemasukan ≤ pengeluaran), jadi linimasa di bawah belum bisa diproyeksikan realistis. Perbaiki dulu arus kas bulanan atau isi manual di masing-masing modul.</div>`;
} else {
body+=`<div class="u-fs11 u-t2 u-mb10 u-lh15">Diasumsikan seluruh rata-rata surplus ${surplusMonths} bulan terakhir (${fmtFull(surplus)}/bln) dipakai berurutan sesuai urutan di bawah. Ilustrasi, bukan alokasi otomatis.</div>`;
}
body+=rows.map((r,i)=>{
const dateLabel=(r.endMonth!=null)?TimelineW.addMonthsToDate(r.endMonth).toLocaleDateString('id-ID',{month:'long',year:'numeric'}):'—';
const yrs=r.monthsNeeded!=null?Math.floor(r.monthsNeeded/12):null;
const bln=r.monthsNeeded!=null?r.monthsNeeded%12:null;
const durLabel=r.monthsNeeded!=null?`${yrs?yrs+' th ':''}${bln} bln lagi (mulai bulan ke-${r.startMonth+1})`:'—';
return `<div style="display:flex;gap:10px;margin-bottom:${i===rows.length-1&&!pensiunAda?'0':'12px'}">
        <div class="u-flex u-fdcol u-aic">
          <div class="u-bgaccsoft u-flex u-aic u-jcc u-fs13" style="width:26px;height:26px;border-radius:50%">${r.emoji}</div>
          ${(i<rows.length-1||pensiunAda)?'<div class="u-flex1 u-mt2" style="width:2px;background:var(--border)"></div>':''}
        </div>
        <div class="u-flex1" style="padding-bottom:2px">
          <div class="u-fs13 u-fw700">${escapeHtml(r.label)}</div>
          <div class="u-fs11 u-t2 u-mt2">Sisa ${fmt(r.remaining)} · target selesai ~<b>${dateLabel}</b></div>
          <div class="u-fs11 u-t2">${durLabel}</div>
        </div>
      </div>`;
}).join('');
if(pensiunAda){
const n=Pensiun.sisaBulan();
const years=Math.floor(n/12),sisaBln=n%12;
const target=Number(pensiunP.targetDana)||0;
const proyeksi=Pensiun.proyeksi();
const onTrack=target>0&&proyeksi>=target;
body+=`<div class="u-flex u-gap10">
        <div class="u-flex u-fdcol u-aic">
          <div class="u-flex u-aic u-jcc u-fs13" style="width:26px;height:26px;border-radius:50%;background:var(--accent3-soft)">🏖️</div>
        </div>
        <div class="u-flex1">
          <div class="u-fs13 u-fw700">Pensiun (usia ${pensiunP.usiaSekarang}→${pensiunP.usiaPensiun})</div>
          <div class="u-fs11 u-t2 u-mt2">${years>0?years+' th ':''}${sisaBln} bln lagi · proyeksi dana ${fmt(proyeksi)}${target>0?' dari target '+fmt(target):''}</div>
          <div style="margin-top:1px" class="${onTrack?'green':'orange'} u-fs11 u-fw700">${target>0?(onTrack?'✅ Proyeksi on-track':'⚠️ Proyeksi masih kurang '+fmt(target-proyeksi)):'Isi target di modul Pensiun utk cek gap'}</div>
        </div>
      </div>`;
} else if(!rows.length){
card.style.display='none';return;
}
card.innerHTML=`<div class="card-title">🗺️ Linimasa Tujuan Finansial <span class="card-collapse-toggle" id="timelineWCard-chev" data-action="toggleCardCollapse" data-args='["timelineWCard","$event"]' aria-label="Buka/tutup bagian">▾</span></div><div class="card-collapse-body" id="timelineWCard-cbody">`+body+`</div>`;
applyOneCardCollapsePref('timelineWCard');
}
};
// BUGFIX-INTEGRASI: semua modul di atas dideklarasikan `const`, yang TIDAK
// otomatis nempel ke `window` walau file ini di-load lewat <script> biasa
// setAsetTab — split halaman Aset (page-aset) jadi 3 tab (Ringkasan/Buku
// Aset/Analisis & Pajak), pola SAMA PERSIS dgn setKeuanganTab (tx-list-cashflow.js)
// /setShopTab/setCnTab/setPajakTab: toggle class u-dnone per pane, TIDAK ada
// business logic baru. Semua card di dalam pane tetap dirender penuh oleh
// renderAssetList()/AlokasiAset.init()/renderWealthSnapshots() (dipanggil dari
// renderPageContent('aset') di modules-render.js) TERLEPAS dari tab mana yang
// lagi aktif -- sama seperti pola kartu ber-collapse yg sudah ada di app ini,
// cuma sekarang levelnya per-tab, bukan per-kartu.
const ASET_TAB_ORDER=['ringkasan','buku','analisis','manajemen'];
function setAsetTab(t,el){
const asetTabBtns=document.querySelectorAll('#page-aset .cn-tab');
asetTabBtns.forEach(b=>b.classList.remove('active'));
if(el) el.classList.add('active');
else { const idx=ASET_TAB_ORDER.indexOf(t); const btn=asetTabBtns[idx>=0?idx:0]; if(btn) btn.classList.add('active'); }
document.getElementById('asetTab-ringkasan').classList.toggle('u-dnone', t!=='ringkasan');
document.getElementById('asetTab-ringkasan').style.display='';
document.getElementById('asetTab-buku').classList.toggle('u-dnone', t!=='buku');
document.getElementById('asetTab-buku').style.display='';
document.getElementById('asetTab-analisis').classList.toggle('u-dnone', t!=='analisis');
document.getElementById('asetTab-analisis').style.display='';
// Manajemen (dipindah dari Dashboard Hub) — pola sama 3 tab di atas.
document.getElementById('asetTab-manajemen').classList.toggle('u-dnone', t!=='manajemen');
document.getElementById('asetTab-manajemen').style.display='';
}

// (bukan module). Dispatcher data-action (mis. data-action="Aset.exportXLSX",
// "AlokasiAset.setRisk", dst di index.html/app_production.html) resolve nama
// aksi lewat window[...], jadi TANPA baris ini semua binding tsb gagal diam2
// di production walau unit test tetap hijau (test harness expose modul
// langsung lewat context, bukan lewat window). Pola sama persis dgn bug
// OngkirCalc di cobek-pricing.js yg sudah pernah kejadian & diperbaiki
// sebelumnya — lihat CLAUDE.md.
// ---------------------------------------------------------------------------
// Smart Delivery Engine, Sesi 5/6: fungsi prediktif domain ASSET.
// Lihat RENCANA-SESI-RINGKAS.md untuk peta 6 sesi. "Inventory" SENGAJA
// DI-SKIP sesi ini (keputusan eksplisit) — lihat catatan sama di
// modules/finance/tx-list-cashflow.js. PURE/read-only, TIDAK PERNAH
// memanggil save(). Belum ada UI/tombol baru, belum ada wiring otomatis
// (itu tugas Sesi 6).
//
// predictAssetValue() SENGAJA tidak menduplikasi Penyusutan.hitung() —
// dia cuma memanggil fungsi itu dengan tanggalHitung di MASA DEPAN (bukan
// hari ini), karena Penyusutan.hitung() memang sudah menerima parameter
// tanggal sembarang, bukan cuma "sekarang". Kalau aset TIDAK punya
// penyusutan aktif, tidak ada model pertumbuhan/penurunan nilai yang bisa
// dipakai (rule-based, bukan tebak-tebakan) — nilai diasumsikan flat, sama
// filosofinya dgn estimateKmPerDay() yg balikin null kalau histori kurang.
// ---------------------------------------------------------------------------

// predictAssetValue({assetId, monthsAhead}) — proyeksi nilai buku 1 aset N
// bulan ke depan. Kalau aset punya penyusutan aktif (a.penyusutan.aktif),
// nilai prediksi = Penyusutan.hitung(a, tanggalMasaDepan).nilaiBuku (metode
// Garis Lurus/Saldo Menurun/Manual sesuai setting aset itu). Kalau tidak,
// balikin nilai flat (nilai sekarang) dgn metode:'flat' supaya pemanggil
// tahu ini bukan proyeksi asli, cuma nilai apa adanya.
function predictAssetValue({assetId,monthsAhead=12}={}){
const a=(D.assets||[]).find(x=>sameId(x.id,assetId));
if(!a)return{ok:false,reason:'Aset tidak ditemukan'};
const now=new Date();
const target=new Date(now.getFullYear(),now.getMonth()+monthsAhead,now.getDate());
const targetISO=dateToISO(target);
if(a.penyusutan&&a.penyusutan.aktif&&typeof Penyusutan!=='undefined'){
const hasil=Penyusutan.hitung(a,targetISO);
return{ok:true,assetId,assetName:a.name,nilaiSaatIni:a.nilai,nilaiPrediksi:hasil.nilaiBuku,metode:hasil.metode,monthsAhead,targetDate:targetISO};
}
return{ok:true,assetId,assetName:a.name,nilaiSaatIni:a.nilai,nilaiPrediksi:a.nilai,metode:'flat',monthsAhead,targetDate:targetISO};
}

// netWorthForecast({monthsAhead}) — proyeksi Kekayaan Bersih N bulan ke
// depan, dari Kekayaan.currentNetWorth() (nilai sekarang) di-compound pakai
// dua sumber, sesuai data yang tersedia (fallback berjenjang, tidak pernah
// mengarang angka):
//  1) Kekayaan.actualCAGR() — kalau histori snapshot (D.wealthSnapshots)
//     cukup (≥2 titik, rentang ≥25 hari, baseline & terakhir positif),
//     pakai growth rate historis nyata (metode:'cagr-snapshot').
//  2) predictCashflow() (tx-list-cashflow.js) — kalau snapshot belum cukup,
//     pakai proyeksi surplus/defisit kas bulanan (incAvg-expAvg) sbg
//     pertumbuhan kekayaan bersih linear (metode:'cashflow-delta'). Ini
//     TIDAK memperhitungkan perubahan nilai aset non-kas (mis. penyusutan),
//     jadi lebih kasar drpd opsi 1.
//  3) Kalau keduanya tidak tersedia, balikin {ok:false} apa adanya.
function netWorthForecast({monthsAhead=6}={}){
if(typeof Kekayaan==='undefined')return{ok:false,reason:'Kekayaan belum dimuat'};
const netWorthNow=Kekayaan.currentNetWorth();
const cagrResult=Kekayaan.actualCAGR();
const now=new Date();
const months=[];
if(cagrResult&&cagrResult.cagr!=null){
const monthlyRate=Math.pow(1+cagrResult.cagr,1/12)-1;
let nw=netWorthNow;
for(let i=1;i<=monthsAhead;i++){
nw=nw*(1+monthlyRate);
const d=new Date(now.getFullYear(),now.getMonth()+i,1);
months.push({month:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'),netWorthProjected:nw});
}
return{ok:true,netWorthNow,metode:'cagr-snapshot',monthlyRate,months,projectedEnd:nw};
}
if(typeof predictCashflow==='function'){
const cf=predictCashflow({monthsAhead});
if(cf.ok){
let nw=netWorthNow;
cf.months.forEach((m)=>{
nw+=cf.monthlyNet;
months.push({month:m.month,netWorthProjected:nw});
});
return{ok:true,netWorthNow,metode:'cashflow-delta',monthlyNet:cf.monthlyNet,months,projectedEnd:nw};
}
}
return{ok:false,reason:'Data histori (snapshot kekayaan / transaksi) belum cukup untuk proyeksi'};
}

// ---------------------------------------------------------------------------
// Smart Delivery Engine, Sesi 8: rule domain ASSET utk AIDecision (lanjutan
// Sesi 7 — lihat RENCANA-SESI-RINGKAS.md). Rule: "proyeksi Kekayaan Bersih N
// bulan ke depan (netWorthForecast()) TURUN dari nilai sekarang" — dgn kata
// lain, tren negatif (bukan ambang nominal, karena "berapa Rp yang wajar
// turun" beda-beda per orang; tren negatif sudah cukup jadi sinyal awal).
// Cooldown lebih panjang (168 jam = mingguan) drpd rule finance karena aset &
// kekayaan bersih berubah lambat, tidak perlu re-alert tiap kali ada 1
// transaksi aset. TIDAK menduplikasi apa pun di UI Laporan Aset — rule ini
// masuk decisionLog AIDecision (dailyBriefing/simulate), bukan render kartu.
// ---------------------------------------------------------------------------

// _assetNetWorthDeclineCheck() — helper dipakai condition() & action().
function _assetNetWorthDeclineCheck(){
if(typeof netWorthForecast!=='function')return{trigger:false};
const fc=netWorthForecast({monthsAhead:6});
if(!fc.ok)return{trigger:false};
return{trigger:fc.projectedEnd<fc.netWorthNow,netWorthNow:fc.netWorthNow,projectedEnd:fc.projectedEnd,metode:fc.metode};
}

// ---------------------------------------------------------------------------
// Rule kedua ASSET (keputusan produk dikonfirmasi user): 'asset-zakat-due' —
// ada aset zakatable di Buku Aset dgn estimasi Zakat Maal (PajakAset.
// hitungZakatAset(), sudah ada) > 0. Ini PENGINGAT BERKALA (cooldown
// mingguan, sama spt asset-networth-declining), BUKAN pengecekan "sudah/belum
// dibayar" — app ini TIDAK menyimpan histori tanggal pembayaran zakat/haul
// sama sekali (dicek: tidak ada field itu di data manapun), jadi rule ini
// SENGAJA tidak berpura-pura tahu status bayar, cuma mengingatkan berkala
// selama estimasi Zakat Maal >= ambang nominal (default Rp0, artinya sama
// spt semula: trigger begitu ada zakat sama sekali) — sama semangatnya dgn
// hitungZakatAset() sendiri yang juga "TANPA cek haul/nishab terpisah".
// Ambang BISA DIATUR user (Sesi lanjutan, pola sama dgn getAIFinance-
// OverspendThreshold/getAIDeliveryThinMarginThreshold) lewat
// D.profile.aiAssetZakatMinThresholdRp, field baru di Pengaturan > 🤖 AI
// Asisten — berguna kalau user mau di-skip untuk zakat estimasi yang masih
// kecil/receh.
// ---------------------------------------------------------------------------
const AI_ASSET_ZAKAT_MIN_DEFAULT_RP=0;

// getAIAssetZakatMinThreshold()/setAIAssetZakatMinThreshold(rp) — getter/
// setter D.profile.aiAssetZakatMinThresholdRp, dipakai field Pengaturan
// (renderSettings()/autoSaveProfile()) & rule di bawah. Dijaga >=0.
function getAIAssetZakatMinThreshold(){
const v=D.profile&&D.profile.aiAssetZakatMinThresholdRp;
return(typeof v==='number'&&v>=0)?v:AI_ASSET_ZAKAT_MIN_DEFAULT_RP;
}
function setAIAssetZakatMinThreshold(rp){
const n=parseFloat(rp);
D.profile.aiAssetZakatMinThresholdRp=(Number.isFinite(n)&&n>=0)?n:AI_ASSET_ZAKAT_MIN_DEFAULT_RP;
return D.profile.aiAssetZakatMinThresholdRp;
}

function _assetZakatDueCheck(){
if(typeof PajakAset==='undefined'||typeof PajakAset.hitungZakatAset!=='function')return{trigger:false};
const z=PajakAset.hitungZakatAset();
const minThreshold=getAIAssetZakatMinThreshold();
return{trigger:z.totalZakat>minThreshold,totalNilai:z.totalNilai,totalZakat:z.totalZakat,jumlah:z.list.length,minThreshold};
}

let _assetAIRulesRegistered=false;
// registerAssetAIRules() — dipanggil sekali saat boot (self-test.js init()),
// idempotent lewat guard, return false kalau AIDecision belum ada.
function registerAssetAIRules(){
if(_assetAIRulesRegistered)return false;
if(typeof AIDecision==='undefined'||!AIDecision.rules||typeof AIDecision.rules.register!=='function')return false;
AIDecision.rules.register({
id:'asset-networth-declining',
category:'asset',
severity:'warning',
weight:4,
cooldownHours:168,
description:'Proyeksi Kekayaan Bersih 6 bulan ke depan (netWorthForecast) turun dari nilai sekarang.',
condition:()=>_assetNetWorthDeclineCheck().trigger,
action:()=>{
const c=_assetNetWorthDeclineCheck();
const fmt=typeof fmtFull==='function'?fmtFull:(n=>'Rp '+Math.round(n||0).toLocaleString('id-ID'));
return{message:`Proyeksi Kekayaan Bersih 6 bulan ke depan turun dari ${fmt(c.netWorthNow)} ke ${fmt(c.projectedEnd)} (metode: ${c.metode}).`};
},
});
AIDecision.rules.register({
id:'asset-zakat-due',
category:'asset',
severity:'info',
weight:3,
cooldownHours:168,
description:'Ada aset zakatable di Buku Aset dengan estimasi Zakat Maal di atas ambang nominal (bisa diatur user, default Rp0) — pengingat berkala, TIDAK mengecek status sudah/belum dibayar (app belum menyimpan histori pembayaran zakat).',
condition:()=>_assetZakatDueCheck().trigger,
action:()=>{
const c=_assetZakatDueCheck();
const fmt=typeof fmtFull==='function'?fmtFull:(n=>'Rp '+Math.round(n||0).toLocaleString('id-ID'));
return{message:`Estimasi Zakat Maal dari ${c.jumlah} aset zakatable (total nilai ${fmt(c.totalNilai)}) sekitar ${fmt(c.totalZakat)} — cek kartu 🧾 Pajak Aset kalau belum dibayar tahun ini.`};
},
});
if(typeof AssetOwnershipSplitPresenter!=='undefined'){
AIDecision.rules.register({
id:'asset-multi-owner-porsi-incomplete',
category:'asset',
severity:'warning',
weight:4,
cooldownHours:72,
description:'Ada aset dgn porsi kepemilikan (owners) sudah mulai diisi tapi belum valid/belum total 100%.',
condition:()=>AssetOwnershipSplitPresenter.incompletePortions().items.length>0,
action:()=>{
const items=AssetOwnershipSplitPresenter.incompletePortions().items;
const names=items.slice(0,3).map(x=>x.name).join(', ');
return{message:`${items.length} aset punya porsi kepemilikan belum lengkap (${names}${items.length>3?', dst':''}) — cek & lengkapi jadi total 100%.`};
},
});
AIDecision.rules.register({
id:'asset-multi-owner-profit-split-info',
category:'asset',
severity:'info',
weight:2,
cooldownHours:168,
description:'Ringkasan pembagian keuntungan otomatis utk aset multi-pemilik (>=2 pemilik dgn porsi valid).',
condition:()=>AssetOwnershipSplitPresenter.summary().items.some(x=>x.keuntungan>0),
action:()=>{
const items=AssetOwnershipSplitPresenter.summary().items.filter(x=>x.keuntungan>0);
const fmt=typeof fmtFull==='function'?fmtFull:(n=>'Rp '+Math.round(n||0).toLocaleString('id-ID'));
const top=items[0];
const rincian=top.splits.map(s=>`${s.ownerName} ${s.porsi}% (${fmt(s.bagian)})`).join(', ');
return{message:`${items.length} aset multi-pemilik untung — "${top.name}" untung ${fmt(top.keuntungan)}, dibagi: ${rincian}.`};
},
});
}
_assetAIRulesRegistered=true;
return true;
}

Object.assign(window,{ALOKASI_PRESETS,AlokasiAset,AssetInsight,Aset,Penyusutan,PajakAset,LaporanAset,IDBStore,PORTFOLIO_LABELS,TimelineW});
