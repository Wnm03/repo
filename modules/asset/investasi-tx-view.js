// investasi-tx-view.js — InvestmentTxUI: UI riwayat transaksi Beli/Jual/Dividen per holding
// investasi (Fase 2, implementasi BUG-INV-001 Opsi 3 -- lihat AUDIT-BUILD-UI-INVESTASI-OPSI3.md
// §3.3 "UI Transaksi Beli/Jual/Dividen"). Backend 100% reuse: Investment.addTransaction()/
// deleteTransaction()/getTransactions() (investasi.js, SUDAH ADA & teruji sejak awal -- 0
// rumus/validasi baru ditulis di sini, termasuk average-cost & realizedGain yang otomatis
// dihitung ulang oleh Investment.recomputeHolding() setiap addTransaction()/deleteTransaction()
// dipanggil). File ini murni lapisan UI (baca form -> panggil fungsi backend -> re-render),
// pola SAMA PERSIS investasi-list-view.js/InvestmentListUI & renovItemModal (list riwayat +
// form tambah dalam 1 modal, hapus per-baris, TANPA fitur edit -- backend memang tidak
// menyediakan updateTransaction(), cuma add/delete, jadi "edit" = hapus lalu catat ulang).
//
// Dipicu dari 1 tombol statis di investmentModal ("investmentTxBtn", lihat
// InvestmentListUI.openModal()) yang delegasi ke InvestmentTxUI.openFromEdit() -- pola SAMA
// PERSIS InvestmentListUI.openOwnersModalForEdit().

const InvestmentTxUI = {
  // holdingId — id holding yang sedang dibuka riwayat transaksinya di investmentTxModal.
  holdingId: null,
  // type — jenis transaksi yang sedang dipilih di form tambah (beli/jual/dividen).
  type: 'beli',

  // openFromEdit() — dipanggil dari tombol statis di investmentModal. Baca
  // InvestmentListUI.editId (holding yang sedang diedit di modal itu), lalu buka
  // investmentTxModal untuk holding tsb. Guard "simpan dulu" sama persis
  // InvestmentListUI.openOwnersModalForEdit().
  openFromEdit() {
    if (typeof InvestmentListUI === 'undefined' || !InvestmentListUI.editId) {
      if (typeof toast === 'function') toast('⚠️ Simpan holding ini dulu sebelum catat transaksi');
      return;
    }
    InvestmentTxUI.open(InvestmentListUI.editId);
  },

  // open(holdingId) — buka investmentTxModal untuk 1 holding: tampilkan nama & unit
  // terkini di header, reset form tambah ke default (tipe Beli, tanggal hari ini), lalu
  // render riwayat transaksinya.
  open(holdingId) {
    InvestmentTxUI.holdingId = holdingId;
    const h = (typeof Investment !== 'undefined') ? Investment.getHolding(holdingId) : null;
    const nameEl = document.getElementById('investmentTxHoldingName');
    if (nameEl) nameEl.textContent = h ? ('💱 ' + h.name + ' — ' + (h.unit || 0) + ' unit') : '';
    InvestmentTxUI._resetForm();
    InvestmentTxUI.setType('beli');
    InvestmentTxUI.render();
    if (typeof openModal === 'function') openModal('investmentTxModal');
  },

  _resetForm() {
    const dateEl = document.getElementById('investTxDate');
    if (dateEl) dateEl.value = (typeof _invToday === 'function') ? _invToday() : new Date().toISOString().slice(0, 10);
    const qtyEl = document.getElementById('investTxQty');
    if (qtyEl) qtyEl.value = '';
    const priceEl = document.getElementById('investTxPrice');
    if (priceEl) priceEl.value = '';
    const feeEl = document.getElementById('investTxFee');
    if (feeEl) feeEl.value = '';
    const amtEl = document.getElementById('investTxAmount');
    if (amtEl) amtEl.value = '';
    const notesEl = document.getElementById('investTxNotes');
    if (notesEl) notesEl.value = '';
  },

  // setType(type) — toggle 3 tombol Beli/Jual/Dividen (pola type-toggle3 sama persis
  // billModal) & tampilkan/sembunyikan field yang relevan (qty+price utk beli/jual,
  // amount utk dividen).
  setType(type) {
    InvestmentTxUI.type = type;
    ['beli', 'jual', 'dividen'].forEach((t) => {
      const btn = document.getElementById('investTxBtn' + t.charAt(0).toUpperCase() + t.slice(1));
      if (btn) btn.classList.toggle('active', t === type);
    });
    const qtyWrap = document.getElementById('investTxQtyPriceWrap');
    if (qtyWrap) qtyWrap.classList.toggle('u-dnone', type === 'dividen');
    const amtWrap = document.getElementById('investTxAmountWrap');
    if (amtWrap) amtWrap.classList.toggle('u-dnone', type !== 'dividen');
  },

  // render() — daftar riwayat transaksi holding yang sedang dibuka, 100% reuse
  // Investment.getTransactions({investmentId}) (sudah terurut terbaru dulu, 0 sort baru
  // ditulis di sini). realizedGain ditampilkan khusus utk transaksi jual (sudah dihitung
  // otomatis oleh recomputeHolding(), bukan dihitung ulang di UI).
  render() {
    const el = document.getElementById('investmentTxList');
    if (!el) return;
    if (typeof Investment === 'undefined' || !InvestmentTxUI.holdingId) { el.innerHTML = ''; return; }
    const list = Investment.getTransactions({ investmentId: InvestmentTxUI.holdingId });
    if (!list.length) {
      el.innerHTML = '<div class="empty"><div class="empty-icon">💱</div><div class="empty-text">Belum ada transaksi tercatat</div></div>';
      return;
    }
    const iconOf = { beli: '🟢', jual: '🔴', dividen: '💰' };
    const labelOf = { beli: 'Beli', jual: 'Jual', dividen: 'Dividen' };
    el.innerHTML = list.map((t) => {
      const amountText = t.type === 'dividen'
        ? fmt(t.amount)
        : (t.qty || 0) + ' unit @ ' + fmt(t.price || 0);
      const gainText = (t.type === 'jual' && t.realizedGain)
        ? '<div class="u-fs11 ' + (t.realizedGain >= 0 ? 'green' : 'red') + '">' + (t.realizedGain >= 0 ? '+' : '') + fmt(t.realizedGain) + '</div>'
        : '';
      return '<div class="tx-item">'
        + '<div class="tx-icon u-bgaccsoft">' + (iconOf[t.type] || '💱') + '</div>'
        + '<div class="tx-info">'
        + '<div class="tx-name">' + (labelOf[t.type] || t.type) + ' — ' + escapeHtml(t.date || '') + '</div>'
        + '<div class="tx-meta">' + escapeHtml(t.notes || '') + '</div>'
        + '</div>'
        + '<div class="tx-amount"><div>' + amountText + '</div>' + gainText + '</div>'
        + '<button type="button" class="card-setting-btn" data-action="InvestmentTxUI.deleteTx" data-args="' + escapeHtml(JSON.stringify([t.id])) + '" aria-label="Hapus transaksi">🗑️</button>'
        + '</div>';
    }).join('');
  },

  // save() — baca form tambah transaksi, wire ke Investment.addTransaction() (SUDAH ADA,
  // 0 validasi baru ditulis di sini -- addTransaction() sendiri yang melempar Error kalau
  // qty/amount tidak valid atau jual melebihi unit yang dipegang).
  save() {
    if (typeof Investment === 'undefined' || !InvestmentTxUI.holdingId) return;
    const dateEl = document.getElementById('investTxDate');
    const date = dateEl ? dateEl.value : '';
    const feeEl = document.getElementById('investTxFee');
    const fee = (feeEl && feeEl.value !== '') ? parseDecStr(feeEl.value) : 0;
    const notesEl = document.getElementById('investTxNotes');
    const notes = notesEl ? notesEl.value : '';
    const payload = { investmentId: InvestmentTxUI.holdingId, type: InvestmentTxUI.type, date, fee, notes };
    if (InvestmentTxUI.type === 'dividen') {
      const amtEl = document.getElementById('investTxAmount');
      payload.amount = amtEl ? parseDecStr(amtEl.value) : 0;
    } else {
      const qtyEl = document.getElementById('investTxQty');
      const priceEl = document.getElementById('investTxPrice');
      payload.qty = qtyEl ? parseDecStr(qtyEl.value) : 0;
      payload.price = priceEl ? parseDecStr(priceEl.value) : 0;
    }
    try {
      Investment.addTransaction(payload);
    } catch (e) {
      toast('⚠️ ' + ((e && e.message) ? e.message : 'Gagal menyimpan transaksi'));
      return;
    }
    InvestmentTxUI._resetForm();
    InvestmentTxUI.render();
    // Holding & kartu ringkasan portofolio ikut refresh (unit/avgPrice/value berubah
    // setelah recomputeHolding() jalan di dalam addTransaction()).
    if (typeof InvestmentListUI !== 'undefined') InvestmentListUI.render();
    if (typeof renderKekayaanBersih === 'function') renderKekayaanBersih();
    if (typeof hitungZakatMaal === 'function') hitungZakatMaal();
    if (typeof AIBus !== 'undefined') AIBus.emit('investment.updated', { holdingId: InvestmentTxUI.holdingId });
    toast('✅ Transaksi tersimpan');
  },

  // deleteTx(id) — hapus 1 transaksi dari riwayat, 100% reuse Investment.deleteTransaction()
  // (sudah menghitung ulang unit/avgPrice holding via recomputeHolding(), 0 logic baru).
  async deleteTx(id) {
    if (typeof Investment === 'undefined') return;
    if (!await askConfirm('Hapus transaksi ini? Unit & harga rata-rata holding akan dihitung ulang.', { okText: 'Ya, Hapus' })) return;
    Investment.deleteTransaction(id);
    InvestmentTxUI.render();
    if (typeof InvestmentListUI !== 'undefined') InvestmentListUI.render();
    if (typeof renderKekayaanBersih === 'function') renderKekayaanBersih();
    if (typeof hitungZakatMaal === 'function') hitungZakatMaal();
    if (typeof AIBus !== 'undefined') AIBus.emit('investment.updated', { holdingId: InvestmentTxUI.holdingId });
    toast('🗑️ Transaksi dihapus');
  },
};

if (typeof window !== 'undefined') {
  window.InvestmentTxUI = InvestmentTxUI;
}
