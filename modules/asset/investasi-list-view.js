// investasi-list-view.js — InvestmentListUI: halaman/tab "💹 Investasi" di bawah #page-aset
// (Fase 1, implementasi BUG-INV-001 Opsi 3 — lihat AUDIT-BUILD-UI-INVESTASI-OPSI3.md &
// docs/BUG_REGISTRY.md §0a-8). File BARU, terpisah dari investasi.js (logika murni, 0 DOM)
// & investasi-view.js (InvestmentUI, modal "⚖️ Atur Porsi Kepemilikan") — pola sama persis
// dashboard-hub-favorit.js vs dashboard-hub-favorit-view.js, supaya investasi.js sendiri
// tetap gampang dites lewat loadSource() tanpa DOM.
//
// Scope Fase 1 (sesuai §5 audit "Estimasi & Breakdown Sesi"): halaman list holding + kartu
// ringkasan portofolio (100% reuse Investment.portfolioSummary(), 0 rumus baru) + modal
// tambah/edit holding + wiring CRUD dasar (Investment.addHolding()/updateHolding()/
// deleteHolding(), SUDAH ADA sejak awal, 0 perubahan) + tombol pemicu "⚖️ Atur Porsi
// Kepemilikan" (InvestmentUI.openOwnersModal(), SUDAH ADA sejak S464, cuma 0 caller sampai
// sesi ini). UI Transaksi Beli/Jual/Dividen (§3.3 audit) & UI Watchlist (§3.5 audit) SENGAJA
// di luar scope sesi ini — menyusul di sesi terpisah sesuai breakdown fase di audit.
//
// Keputusan desain (mengikuti rekomendasi §3.2 audit): modal utama (investmentModal) TIDAK
// punya field titipan manual (fundSource/titipanOwner) — delegasi penuh ke owners modal yang
// sudah ada, pola SAMA PERSIS assetModal (yang sejak Sesi C juga membuang input titipan
// manual demi 1 sumber kebenaran a.owners[]/h.owners[]). Field Unit/Harga Rata-rata di modal
// ini SENGAJA tetap bisa diisi manual (beda dari komentar "SELALU diturunkan ulang dari
// riwayat transaksi" di investasi.js) — Fase 1 belum punya UI transaksi (§3.3), jadi input
// manual di sini adalah SATU-SATUNYA cara mengisi data holding sampai Fase 2 selesai; begitu
// UI transaksi ada, recomputeHolding() akan mengambil alih & menimpa nilai manual ini lewat
// jalur normal (0 konflik — recomputeHolding() memang didesain menimpa unit/avgPrice).

const InvestmentListUI = {
  // editId — id holding yang sedang dibuka di investmentModal, null kalau lagi mode Tambah.
  // Dipakai openOwnersModalForEdit()/deleteFromModal() supaya tombol di dalam modal tahu
  // holding mana yang sedang diedit tanpa perlu data-args statis (pola sama persis
  // Aset.editId -> Aset.openOwnersModal()/Aset.save()).
  editId: null,

  // render() — dipanggil dari setAsetTab('investasi') & renderPageContent('aset') (SSOT,
  // sama pola AlokasiAset.init()/renderWealthSnapshots() yang dipanggil di 2 titik yang
  // sama). Aman dipanggil berkali-kali, murni re-render dari D.investments apa adanya.
  render() {
    InvestmentListUI._renderSummary();
    InvestmentListUI._renderList();
    // Fase 3 (BUG-INV-001 Opsi 3, §3.5 audit): render Watchlist bareng di titik SSOT yang
    // sama, pola sama persis kartu ringkasan & daftar holding di atas -- InvestmentWatchUI
    // hidup di file terpisah (investasi-watch-view.js) tapi tetap 1 entry point render()
    // supaya kedua tab call-site yang sudah ada (modules-render.js & aset.js setAsetTab)
    // otomatis ikut me-refresh watchlist tanpa perlu disentuh.
    if (typeof InvestmentWatchUI !== 'undefined') InvestmentWatchUI.render();
  },

  // _renderSummary() — kartu ringkasan portofolio, 100% reuse Investment.portfolioSummary()
  // (SUDAH ADA & sudah difilter ownership-self sejak S193, 0 rumus baru ditulis di sini).
  _renderSummary() {
    const valBox = document.getElementById('investSummaryValue');
    if (!valBox) return; // halaman ini belum ada di DOM (mis. dites via loadSource() tanpa DOM)
    if (typeof Investment === 'undefined') return;
    const s = Investment.portfolioSummary();
    valBox.textContent = fmt(s.totalValue);
    const costBox = document.getElementById('investSummaryCost');
    if (costBox) costBox.textContent = fmt(s.totalCost);
    const gainBox = document.getElementById('investSummaryGain');
    if (gainBox) {
      const cls = s.totalGainLoss >= 0 ? 'green' : 'red';
      gainBox.innerHTML = 'Untung/Rugi belum direalisasi: <b class="' + cls + '">'
        + (s.totalGainLoss >= 0 ? '+' : '') + fmt(s.totalGainLoss)
        + ' (' + (s.roiPct >= 0 ? '+' : '') + s.roiPct.toFixed(2) + '%)</b>';
    }
    const metaBox = document.getElementById('investSummaryMeta');
    if (metaBox) {
      metaBox.textContent = s.holdingsCount + ' holding · Dividen: ' + fmt(s.totalDividend)
        + ' · Realized Gain: ' + fmt(s.totalRealizedGain);
    }
    // investSummaryYield (s476a2) — CAGR tahunan tertimbang, setara "assetInvestasiYield"
    // yang dulu ada di dashboard Buku Aset lama (aset.js renderInvestasi()) supaya paritas
    // fitur terjaga begitu Buku Aset lama disembunyikan (lihat AUDIT ROI/CAGR di
    // docs/s476-PLAN-migrate-investasi-to-holdings.md). Elemen ini opsional di DOM -- kalau
    // belum ditambahkan ke markup, baris ini aman di-skip (guard sama pola box lain di atas).
    const yieldBox = document.getElementById('investSummaryYield');
    if (yieldBox) {
      yieldBox.innerHTML = (s.yieldPct == null)
        ? '<span class="u-t2">Yield/CAGR belum bisa dihitung (isi Tanggal Perolehan di holding masing-masing)</span>'
        : 'Setara ~<b class="' + (s.yieldPct >= 0 ? 'green' : 'red') + '">' + (s.yieldPct >= 0 ? '+' : '') + s.yieldPct.toFixed(2) + '%/tahun</b> (CAGR)';
    }
  },

  // _renderList() — daftar holding, 1 baris per holding (pola tx-item SAMA PERSIS
  // Aset.renderList()) -- tap baris = buka investmentModal dalam mode Edit (bukan sub-menu
  // "⋮" spt Buku Aset, biar Fase 1 tetap sederhana; delete dilakukan dari DALAM modal lewat
  // deleteFromModal(), sesuai scope yang diminta).
  _renderList() {
    const el = document.getElementById('investmentHoldingList');
    if (!el) return;
    if (typeof Investment === 'undefined') { el.innerHTML = ''; return; }
    const holdings = Investment.getHoldings();
    if (!holdings.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">💹</div><div class="empty-text">Belum ada holding investasi tercatat</div></div>';
      return;
    }
    el.innerHTML = holdings.map((h) => {
      const value = Investment.holdingValue(h);
      const gain = Investment.holdingGainLoss(h);
      const roi = Investment.holdingROI(h);
      const cls = gain >= 0 ? 'green' : 'red';
      return '<div class="tx-item u-pointer" data-action="InvestmentListUI.openModal" data-args="' + escapeHtml(JSON.stringify([h.id])) + '">'
        + '<div class="tx-icon u-bgaccsoft">💹</div>'
        + '<div class="tx-info">'
        + '<div class="tx-name">' + escapeHtml(h.name) + '</div>'
        + '<div class="tx-meta"><span class="acc-chip">' + escapeHtml(h.type) + '</span> ' + (h.unit || 0) + ' unit · ROI ' + (roi >= 0 ? '+' : '') + roi.toFixed(1) + '%</div>'
        + '</div>'
        + '<div class="tx-amount"><div>' + fmt(value) + '</div><div class="u-fs11 ' + cls + '">' + (gain >= 0 ? '+' : '') + fmt(gain) + '</div></div>'
        + '</div>';
    }).join('');
  },

  // openModal(id) — buka investmentModal, mode Tambah kalau id kosong, mode Edit (prefill
  // dari holding yang sudah ada) kalau id diisi. Pola SAMA PERSIS Aset.openModal().
  openModal(id) {
    InvestmentListUI.editId = id || null;
    const h = (id && typeof Investment !== 'undefined') ? Investment.getHolding(id) : null;
    const titleEl = document.getElementById('investmentModalTitle');
    if (titleEl) titleEl.textContent = h ? 'Edit Holding' : 'Tambah Holding';
    const nameEl = document.getElementById('investName');
    if (nameEl) nameEl.value = h ? h.name : '';
    const jenisEl = document.getElementById('investJenis');
    if (jenisEl) {
      if (typeof INVESTMENT_TYPES !== 'undefined') {
        jenisEl.innerHTML = INVESTMENT_TYPES.map((t) => '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>').join('');
      }
      jenisEl.value = h ? h.type : 'Saham';
    }
    const unitEl = document.getElementById('investUnit');
    if (unitEl) unitEl.value = (h && h.unit != null) ? h.unit : '';
    const avgEl = document.getElementById('investAvgPrice');
    if (avgEl) avgEl.value = (h && h.avgPrice != null) ? h.avgPrice : '';
    const curEl = document.getElementById('investCurrentPrice');
    if (curEl) curEl.value = (h && h.currentPrice != null) ? h.currentPrice : '';
    const notesEl = document.getElementById('investNotes');
    if (notesEl) notesEl.value = h ? (h.notes || '') : '';
    // investPurchaseDate (s476a2) — opsional, dipakai Investment.holdingYieldPct() utk
    // hitung CAGR holding ini (lihat docs/s476-PLAN-migrate-investasi-to-holdings.md, bagian
    // AUDIT ROI/CAGR). Kosong = CAGR holding ini tidak bisa dihitung (sama pola a.tanggal
    // opsional di Buku Aset lama).
    const dateEl = document.getElementById('investPurchaseDate');
    if (dateEl) dateEl.value = h ? (h.purchaseDate || '') : '';
    // Tombol "⚖️ Atur Porsi Kepemilikan" & "🗑️ Hapus Holding" cuma masuk akal utk holding
    // yang SUDAH tersimpan (butuh id) — disembunyikan di mode Tambah, pola sama persis
    // assetModal (openOwnersModal cuma jalan kalau Aset.editId terisi).
    const ownersBtn = document.getElementById('investmentOwnersBtn');
    if (ownersBtn) ownersBtn.classList.toggle('u-dnone', !h);
    // investmentTxBtn (Fase 2, BUG-INV-001 Opsi 3 §3.3) -- tombol pemicu "💱 Riwayat
    // Transaksi" ke InvestmentTxUI.openFromEdit(), sama pola persis ownersBtn di atas:
    // cuma masuk akal utk holding yang SUDAH tersimpan (butuh id), disembunyikan di mode
    // Tambah.
    const txBtn = document.getElementById('investmentTxBtn');
    if (txBtn) txBtn.classList.toggle('u-dnone', !h);
    const delBtn = document.getElementById('investmentDeleteBtn');
    if (delBtn) delBtn.classList.toggle('u-dnone', !h);
    openModal('investmentModal');
  },

  // openOwnersModalForEdit() — wrapper tipis yang membaca InvestmentListUI.editId lalu
  // delegasi PENUH ke InvestmentUI.openOwnersModal(id) (SUDAH ADA sejak S464, 0 logic baru
  // ditulis di sini) — dibutuhkan krn tombol di dalam modal ini dipasang statis lewat
  // modals.js (bukan di-render ulang tiap buka), jadi tidak bisa langsung
  // data-args='["<id-dinamis>"]' seperti caller yang tahu id-nya dari closure render.
  openOwnersModalForEdit() {
    if (!InvestmentListUI.editId) { toast('⚠️ Simpan holding ini dulu sebelum atur porsi kepemilikan'); return; }
    if (typeof InvestmentUI === 'undefined') { toast('⚠️ Fitur porsi kepemilikan investasi belum siap dimuat'); return; }
    InvestmentUI.openOwnersModal(InvestmentListUI.editId);
  },

  // save() — baca form investmentModal, wire ke Investment.addHolding()/updateHolding()
  // (SUDAH ADA, 0 validasi/rumus baru ditulis di sini — addHolding() sendiri yang melempar
  // Error kalau nama kosong). unit/avgPrice ditulis manual (lihat catatan scope di kepala
  // file) langsung ke object holding setelah updateHolding()/addHolding() (keduanya TIDAK
  // menerima patch unit/avgPrice lewat argumen resmi — field itu didesain diturunkan dari
  // recomputeHolding(), belum ada di Fase 1 ini), lalu save() dipanggil eksplisit supaya
  // perubahan manual ini tetap tersimpan bareng.
  save() {
    if (typeof Investment === 'undefined') { toast('⚠️ Fitur investasi belum siap dimuat'); return; }
    const nameEl = document.getElementById('investName');
    const name = nameEl ? nameEl.value.trim() : '';
    const jenisEl = document.getElementById('investJenis');
    const type = jenisEl ? jenisEl.value : 'Lainnya';
    const unitEl = document.getElementById('investUnit');
    const unit = (unitEl && unitEl.value !== '') ? parseDecStr(unitEl.value) : 0;
    const avgEl = document.getElementById('investAvgPrice');
    const avgPrice = (avgEl && avgEl.value !== '') ? parseDecStr(avgEl.value) : 0;
    const curEl = document.getElementById('investCurrentPrice');
    const currentPrice = (curEl && curEl.value !== '') ? parseDecStr(curEl.value) : 0;
    const notesEl = document.getElementById('investNotes');
    const notes = notesEl ? notesEl.value : '';
    const dateEl = document.getElementById('investPurchaseDate');
    const purchaseDate = dateEl ? (dateEl.value || null) : null;
    let h;
    try {
      if (InvestmentListUI.editId) {
        h = Investment.updateHolding(InvestmentListUI.editId, { name, type, currentPrice, notes, purchaseDate });
      } else {
        h = Investment.addHolding({ name, type, unit, avgPrice, currentPrice: currentPrice || avgPrice, notes, purchaseDate });
      }
    } catch (e) {
      toast('⚠️ ' + ((e && e.message) ? e.message : 'Gagal menyimpan holding'));
      return;
    }
    if (InvestmentListUI.editId && h) {
      h.unit = unit;
      h.avgPrice = avgPrice;
      if (typeof save === 'function') save();
    }
    closeModal('investmentModal');
    InvestmentListUI.render();
    if (typeof renderKekayaanBersih === 'function') renderKekayaanBersih();
    if (typeof hitungZakatMaal === 'function') hitungZakatMaal();
    if (typeof AIBus !== 'undefined') AIBus.emit('investment.updated', { holdingId: h && h.id });
    toast('✅ Holding tersimpan');
  },

  // deleteFromModal() — hapus holding yang SEDANG dibuka di investmentModal (baca
  // InvestmentListUI.editId, bukan argumen — tombolnya statis di modals.js, pola sama
  // openOwnersModalForEdit() di atas). 100% reuse Investment.deleteHolding() (SUDAH ADA,
  // sudah membersihkan D.investmentTx & entry Buku Utang tertaut, 0 logic baru).
  async deleteFromModal() {
    const targetId = InvestmentListUI.editId;
    if (!targetId || typeof Investment === 'undefined') return;
    if (!await askConfirm('Hapus holding investasi ini? Riwayat transaksi & entry Buku Utang titipan yang tertaut ikut terhapus.', { okText: 'Ya, Hapus' })) return;
    Investment.deleteHolding(targetId);
    InvestmentListUI.editId = null;
    closeModal('investmentModal');
    InvestmentListUI.render();
    if (typeof renderKekayaanBersih === 'function') renderKekayaanBersih();
    if (typeof hitungZakatMaal === 'function') hitungZakatMaal();
    if (typeof renderDebtList === 'function') renderDebtList();
    if (typeof AIBus !== 'undefined') AIBus.emit('investment.updated', { deletedId: targetId });
    toast('🗑️ Holding dihapus');
  },
};

if (typeof window !== 'undefined') {
  window.InvestmentListUI = InvestmentListUI;
}
