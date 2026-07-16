// ============================================================
// Penyimpanan (localStorage)
// ============================================================
const KEY_CUSTOMERS = 'jt_customers';       // [{id, name}]
const KEY_APPOINTMENTS = 'jt_appointments'; // [{id, customerId, date, time}]

function load(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; }
  catch { return []; }
}
function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

let customers = load(KEY_CUSTOMERS);
let appointments = load(KEY_APPOINTMENTS);
const nextId = (arr) => arr.reduce((m, x) => Math.max(m, x.id), 0) + 1;

const visitCount = (customerId) =>
  appointments.filter((a) => a.customerId === customerId).length;

function findCustomerByName(name) {
  const q = name.trim().toLowerCase();
  return customers.find((c) => c.name.toLowerCase() === q) || null;
}

function searchCustomerList(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  return customers
    .filter((c) => c.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name, 'id'))
    .slice(0, 8)
    .map((c) => ({ ...c, visits: visitCount(c.id) }));
}

// ============================================================
// Elemen & util tampilan
// ============================================================
const $ = (id) => document.getElementById(id);
const nameInput = $('name'), sug = $('sug'), badge = $('badge');
const historyBox = $('history'), historyList = $('historyList');
let selectedCustomer = null; // {id, name, visits} jika cocok dengan customer lama
let activeIdx = -1;

const hariBulan = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID',
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
const nameOf = (id) => (customers.find((c) => c.id === id) || { name: '?' }).name;

function toast(msg, isErr) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.className = 'toast', 3000);
}

// ============================================================
// Autocomplete nama customer
// ============================================================
nameInput.addEventListener('input', () => {
  selectedCustomer = null;
  const q = nameInput.value.trim();
  if (!q) { closeSug(); updateBadge(); return; }

  // Deteksi otomatis: nama persis sama dengan customer lama
  const exact = findCustomerByName(q);
  if (exact) selectCustomer({ ...exact, visits: visitCount(exact.id) }, false);
  else updateBadge();

  renderSug(searchCustomerList(q).filter((r) => !exact || r.id !== exact.id));
});

function renderSug(rows) {
  sug.innerHTML = '';
  activeIdx = -1;
  if (!rows.length) { closeSug(); return; }
  rows.forEach((r) => {
    const d = document.createElement('div');
    d.innerHTML = '<span></span><span class="meta"></span>';
    d.firstChild.textContent = r.name;
    d.lastChild.textContent = r.visits + 'x kunjungan';
    d.onmousedown = (e) => { e.preventDefault(); selectCustomer(r, true); };
    sug.appendChild(d);
  });
  sug.classList.add('open');
}

function closeSug() { sug.classList.remove('open'); sug.innerHTML = ''; activeIdx = -1; }

nameInput.addEventListener('keydown', (e) => {
  const items = [...sug.children];
  if (!items.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    activeIdx = (activeIdx + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items.forEach((el, i) => el.classList.toggle('active', i === activeIdx));
  } else if (e.key === 'Enter' && activeIdx >= 0) {
    e.preventDefault();
    items[activeIdx].dispatchEvent(new MouseEvent('mousedown'));
  } else if (e.key === 'Escape') closeSug();
});
nameInput.addEventListener('blur', () => setTimeout(closeSug, 120));

function selectCustomer(c, fill) {
  selectedCustomer = c;
  if (fill) { nameInput.value = c.name; closeSug(); }
  updateBadge();
  showHistory(c.id);
}

function updateBadge() {
  historyBox.classList.remove('show');
  if (selectedCustomer) {
    badge.className = 'badge known';
    badge.textContent = '✓ Customer terdeteksi: ' + selectedCustomer.name +
      ' (' + selectedCustomer.visits + 'x kunjungan)';
  } else if (nameInput.value.trim().length >= 2) {
    badge.className = 'badge new';
    badge.textContent = 'Customer baru — akan otomatis tersimpan.';
  } else {
    badge.className = 'badge';
  }
}

function showHistory(customerId) {
  const rows = appointments
    .filter((a) => a.customerId === customerId)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time))
    .slice(0, 5);
  if (!rows.length) return;
  historyList.innerHTML = '';
  rows.forEach((r) => {
    const li = document.createElement('li');
    li.textContent = hariBulan(r.date) + ' — ' + r.time;
    historyList.appendChild(li);
  });
  historyBox.classList.add('show');
}

// ============================================================
// Simpan jadwal
// ============================================================
$('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const cleanName = nameInput.value.trim().replace(/\s+/g, ' ');
  const date = $('date').value, time = $('time').value;
  if (!cleanName || !date || !time) { toast('Nama, tanggal, dan jam wajib diisi.', true); return; }

  // Auto-deteksi: pakai customer lama jika nama sudah ada (abaikan besar/kecil huruf)
  let customer = findCustomerByName(cleanName);
  const isNew = !customer;
  if (isNew) {
    customer = { id: nextId(customers), name: cleanName };
    customers.push(customer);
    save(KEY_CUSTOMERS, customers);
  }

  const dup = appointments.find((a) =>
    a.customerId === customer.id && a.date === date && a.time === time);
  if (dup) { toast(customer.name + ' sudah punya jadwal di tanggal dan jam yang sama.', true); return; }

  const newId = nextId(appointments);
  appointments.push({ id: newId, customerId: customer.id, date, time });
  save(KEY_APPOINTMENTS, appointments);

  let msg = isNew
    ? 'Jadwal tersimpan. ' + customer.name + ' terdaftar sebagai customer baru.'
    : 'Jadwal tersimpan untuk ' + customer.name + ' (customer lama).';
  if (!filteredRows().some((a) => a.id === newId)) {
    msg += ' Pilih "Semua" untuk melihatnya.';
  }
  toast(msg);
  nameInput.value = ''; $('time').value = '';
  selectedCustomer = null;
  updateBadge();
  renderList();
  nameInput.focus();
});

// ============================================================
// Filter daftar jadwal
// ============================================================
let filterMode = 'today'; // 'today' | 'week' | 'all' | 'date'

function thisWeekRange() { // Senin s.d. Minggu pekan berjalan
  const d = new Date();
  const offset = (d.getDay() + 6) % 7; // 0 = Senin
  const mon = new Date(d); mon.setDate(d.getDate() - offset);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  const iso = (x) => x.toLocaleDateString('sv-SE');
  return [iso(mon), iso(sun)];
}

function filteredRows() {
  let rows = appointments.slice();
  if (filterMode === 'today') {
    rows = rows.filter((a) => a.date === today());
  } else if (filterMode === 'week') {
    const [mon, sun] = thisWeekRange();
    rows = rows.filter((a) => a.date >= mon && a.date <= sun);
  } else if (filterMode === 'date') {
    const start = $('filterStart').value, end = $('filterEnd').value;
    rows = rows.filter((a) => (!start || a.date >= start) && (!end || a.date <= end));
  }
  return rows.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function setFilter(mode) {
  filterMode = mode;
  document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.f === mode));
  const active = mode === 'date';
  $('filterStart').classList.toggle('active', active);
  $('filterEnd').classList.toggle('active', active);
  if (!active) { $('filterStart').value = ''; $('filterEnd').value = ''; }
  renderList();
}

document.querySelectorAll('.chip').forEach((c) =>
  c.addEventListener('click', () => setFilter(c.dataset.f)));
['filterStart', 'filterEnd'].forEach((id) =>
  $(id).addEventListener('change', () => {
    if ($('filterStart').value || $('filterEnd').value) setFilter('date');
    else setFilter('today');
  }));

// ============================================================
// Mode pilih: hapus banyak jadwal sekaligus
// ============================================================
let selectMode = false;
const selected = new Set();

function updateSelectBar() {
  $('selCount').textContent = selected.size + ' dipilih';
  $('selDelete').disabled = selected.size === 0;
  const visible = filteredRows();
  $('selAll').textContent =
    visible.length && visible.every((r) => selected.has(r.id)) ? 'Batal Semua' : 'Pilih Semua';
}

function setSelectMode(on) {
  selectMode = on;
  selected.clear();
  $('selectBtn').classList.toggle('on', on);
  $('selectBar').hidden = !on;
  renderList();
  if (on) updateSelectBar();
}

$('selectBtn').addEventListener('click', () => setSelectMode(!selectMode));
$('selCancel').addEventListener('click', () => setSelectMode(false));

$('selAll').addEventListener('click', () => {
  const visible = filteredRows();
  const allSelected = visible.length && visible.every((r) => selected.has(r.id));
  selected.clear();
  if (!allSelected) visible.forEach((r) => selected.add(r.id));
  renderList();
  updateSelectBar();
});

$('selDelete').addEventListener('click', () => {
  if (!selected.size) return;
  if (!confirm('Hapus ' + selected.size + ' jadwal yang dipilih?')) return;
  appointments = appointments.filter((a) => !selected.has(a.id));
  save(KEY_APPOINTMENTS, appointments);
  const n = selected.size;
  setSelectMode(false);
  toast(n + ' jadwal dihapus.');
});

// ============================================================
// Ubah jadwal
// ============================================================
let editingId = null;

function openEdit(apptId) {
  const a = appointments.find((x) => x.id === apptId);
  if (!a) return;
  editingId = apptId;
  const c = customers.find((x) => x.id === a.customerId);
  $('editName').textContent = c ? c.name : '?';
  $('editDate').value = a.date;
  $('editTime').value = a.time;
  $('editSheet').hidden = false;
}

function closeEdit() {
  editingId = null;
  $('editSheet').hidden = true;
}

$('editCancel').addEventListener('click', closeEdit);
$('editSheet').addEventListener('click', (e) => {
  if (e.target === $('editSheet')) closeEdit();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('editSheet').hidden) closeEdit();
});

$('editSave').addEventListener('click', () => {
  const a = appointments.find((x) => x.id === editingId);
  if (!a) { closeEdit(); return; }
  const date = $('editDate').value, time = $('editTime').value;
  if (!date || !time) { toast('Tanggal dan jam wajib diisi.', true); return; }

  const dup = appointments.find((x) =>
    x.id !== a.id && x.customerId === a.customerId && x.date === date && x.time === time);
  if (dup) {
    const c = customers.find((x) => x.id === a.customerId);
    toast((c ? c.name : 'Customer') + ' sudah punya jadwal di tanggal dan jam yang sama.', true);
    return;
  }

  a.date = date;
  a.time = time;
  save(KEY_APPOINTMENTS, appointments);
  closeEdit();
  renderList();
  toast('Jadwal berhasil diubah.');
});

// ============================================================
// Daftar jadwal (render)
// ============================================================
function renderList() {
  const list = $('list');
  list.innerHTML = '';
  const rows = filteredRows();
  if (selectMode) {
    // Lepas pilihan pada jadwal yang tidak lagi tampil karena ganti filter
    const visibleIds = new Set(rows.map((r) => r.id));
    [...selected].forEach((id) => { if (!visibleIds.has(id)) selected.delete(id); });
    updateSelectBar();
  }
  if (!rows.length) {
    const msg = filterMode === 'today' ? 'Tidak ada jadwal hari ini.'
      : filterMode === 'week' ? 'Tidak ada jadwal minggu ini.'
      : filterMode === 'date' ? 'Tidak ada jadwal pada rentang tanggal tersebut.'
      : 'Belum ada jadwal. Tambahkan lewat form di samping.';
    list.innerHTML = '<div class="empty">' + msg + '</div>';
    return;
  }
  let lastDate = null;
  rows.forEach((r) => {
    if (r.date !== lastDate) {
      const h = document.createElement('div');
      h.className = 'day-head';
      h.textContent = hariBulan(r.date);
      list.appendChild(h);
      lastDate = r.date;
    }
    const visits = visitCount(r.customerId);
    const el = document.createElement('div');
    el.className = 'appt';
    if (selectMode) {
      el.classList.add('selectable');
      if (selected.has(r.id)) el.classList.add('selected');
      el.innerHTML =
        '<span class="check">✓</span>' +
        '<div class="when"><div class="t"></div></div>' +
        '<div class="who"><div class="n"></div><div class="v"></div></div>';
      el.onclick = () => {
        if (selected.has(r.id)) selected.delete(r.id); else selected.add(r.id);
        el.classList.toggle('selected', selected.has(r.id));
        updateSelectBar();
      };
    } else {
      el.innerHTML =
        '<div class="when"><div class="t"></div></div>' +
        '<div class="who"><div class="n"></div><div class="v"></div></div>' +
        '<button class="edit" title="Ubah jadwal">Ubah</button>' +
        '<button class="del" title="Hapus jadwal">Hapus</button>';
      el.querySelector('.edit').onclick = () => openEdit(r.id);
      el.querySelector('.del').onclick = () => {
        if (!confirm('Hapus jadwal ' + nameOf(r.customerId) + ' pada ' + hariBulan(r.date) + ' ' + r.time + '?')) return;
        appointments = appointments.filter((a) => a.id !== r.id);
        save(KEY_APPOINTMENTS, appointments);
        toast('Jadwal dihapus.');
        renderList();
      };
    }
    el.querySelector('.t').textContent = r.time;
    el.querySelector('.n').textContent = nameOf(r.customerId);
    el.querySelector('.v').textContent = visits > 1 ? 'customer lama · ' + visits + 'x kunjungan' : 'customer baru';
    list.appendChild(el);
  });
}

// ============================================================
// Salin jadwal dalam format WhatsApp
// ============================================================
function buildWhatsAppText() {
  const rows = filteredRows();
  if (!rows.length) return null;
  let lines = ['*JADWAL TREATMENT* 💆'];
  let lastDate = null;
  let n = 0;
  rows.forEach((r) => {
    if (r.date !== lastDate) {
      lines.push('', '📅 *' + hariBulan(r.date) + '*');
      lastDate = r.date;
      n = 0;
    }
    n++;
    lines.push(n + '. ' + r.time + ' — ' + nameOf(r.customerId));
  });
  return lines.join('\n');
}

$('waBtn').addEventListener('click', async () => {
  const text = buildWhatsAppText();
  if (!text) { toast('Belum ada jadwal untuk disalin.', true); return; }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback untuk browser/konteks tanpa Clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
  toast('Jadwal tersalin — tinggal paste di WhatsApp.');
});

// ============================================================
// Export & Import data
// ============================================================
$('exportBtn').addEventListener('click', () => {
  if (!customers.length && !appointments.length) { toast('Belum ada data untuk di-export.', true); return; }
  const payload = {
    app: 'jadwal-treatment', version: 1, exportedAt: new Date().toISOString(),
    customers, appointments,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'jadwal-treatment-' + today() + '.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Data ter-export sebagai file JSON.');
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async () => {
  const file = $('importFile').files[0];
  $('importFile').value = '';
  if (!file) return;
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { toast('File tidak bisa dibaca — bukan JSON valid.', true); return; }
  if (!Array.isArray(data.customers) || !Array.isArray(data.appointments)) {
    toast('Format file tidak dikenali.', true); return;
  }

  // Gabungkan: customer dicocokkan berdasarkan nama, jadwal duplikat dilewati
  let newCust = 0, newAppt = 0;
  const idMap = new Map(); // id di file -> id di penyimpanan ini
  data.customers.forEach((c) => {
    if (!c || typeof c.name !== 'string' || !c.name.trim()) return;
    const name = c.name.trim().replace(/\s+/g, ' ');
    let existing = findCustomerByName(name);
    if (!existing) {
      existing = { id: nextId(customers), name };
      customers.push(existing);
      newCust++;
    }
    idMap.set(c.id, existing.id);
  });
  data.appointments.forEach((a) => {
    if (!a || !idMap.has(a.customerId)) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || '') || !/^\d{2}:\d{2}$/.test(a.time || '')) return;
    const cid = idMap.get(a.customerId);
    if (appointments.some((x) => x.customerId === cid && x.date === a.date && x.time === a.time)) return;
    appointments.push({ id: nextId(appointments), customerId: cid, date: a.date, time: a.time });
    newAppt++;
  });
  save(KEY_CUSTOMERS, customers);
  save(KEY_APPOINTMENTS, appointments);
  renderList();
  toast('Import selesai: ' + newCust + ' customer baru, ' + newAppt + ' jadwal ditambahkan.');
});

// ============================================================
// PWA & inisialisasi awal
// ============================================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

$('date').value = today(); // hari ini, format YYYY-MM-DD
renderList();

if (new URLSearchParams(location.search).get('action') === 'add') {
  nameInput.focus();
  nameInput.scrollIntoView({ block: 'center' });
}
