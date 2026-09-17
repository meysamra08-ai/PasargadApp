(function () {
  'use strict';

  var STORAGE_KEY = 'pasargadDailyAffairsRows';
  var initialized = false;
  var editingId = null;

  function byId(id) { return document.getElementById(id); }
  function faDigits(value) {
    return String(value == null ? '' : value).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[Number(d)]; });
  }
  function enDigits(value) {
    return String(value == null ? '' : value).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); });
  }
  function normalizeDate(value) {
    return enDigits(value).replace(/[.\-]/g, '/').replace(/\s+/g, '').trim();
  }
  function formatJalaliInput(value) {
    var raw = faDigits(value == null ? '' : value).replace(/[^۰-۹0-9]/g, '');
    raw = enDigits(raw).slice(0, 8);
    if (raw.length > 4) raw = raw.slice(0, 4) + '/' + raw.slice(4);
    if (raw.length > 7) raw = raw.slice(0, 7) + '/' + raw.slice(7);
    return faDigits(raw);
  }
  function validJalaliDate(value) {
    return /^(13|14)\d{2}\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])$/.test(normalizeDate(value));
  }
  function jalaliToGregorian(jy, jm, jd) {
    var jy2 = jy - 979, jm2 = jm - 1, days = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor((jy2 % 33 + 3) / 4);
    for (var i = 0; i < jm2; i++) days += i < 6 ? 31 : 30;
    days += jd - 1;
    var gy = 1600 + 400 * Math.floor(days / 146097);
    days %= 146097;
    var leap = true;
    if (days >= 36525) { days--; gy += 100 * Math.floor(days / 36524); days %= 36524; if (days >= 365) days++; else leap = false; }
    gy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days >= 366) { leap = false; days--; gy += Math.floor(days / 365); days %= 365; }
    var gd = days + 1, sal = [0,31,28,31,30,31,30,31,31,30,31,30,31];
    if (leap) sal[2] = 29;
    var gm = 1;
    while (gm <= 12 && gd > sal[gm]) { gd -= sal[gm]; gm++; }
    return [gy, gm, gd];
  }
  function weekday(value) {
    var parts = normalizeDate(value).split('/').map(Number);
    if (parts.length !== 3 || !validJalaliDate(value)) return '';
    var g = jalaliToGregorian(parts[0], parts[1], parts[2]);
    var date = new Date(Date.UTC(g[0], g[1] - 1, g[2]));
    return ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'][date.getUTCDay()];
  }
  function rows() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveRows(value) { localStorage.setItem(STORAGE_KEY, JSON.stringify(value)); }
  function escapeHtml(value) {
    var div = document.createElement('div'); div.textContent = String(value == null ? '' : value); return div.innerHTML;
  }
  function nextId(list) { return list.reduce(function (max, item) { return Math.max(max, Number(item.id) || 0); }, 0) + 1; }
  function currentPersianDate() {
    try {
      var parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
      var values = {};
      parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
      return enDigits(values.year) + '/' + String(values.month).padStart(2, '0') + '/' + String(values.day).padStart(2, '0');
    } catch (e) { return ''; }
  }
  function currentPersianDay() {
    try { return new Intl.DateTimeFormat('fa-IR', { weekday: 'long' }).format(new Date()); } catch (e) { return ''; }
  }
  function setAutomaticDate() {
    var date = currentPersianDate();
    if (byId('dailyDate')) byId('dailyDate').value = date;
    if (byId('dailyDay')) byId('dailyDay').value = currentPersianDay();
  }
  function clearForm() {
    ['dailyDescription', 'dailyFollowDate'].forEach(function (id) { if (byId(id)) byId(id).value = ''; });
    setAutomaticDate();
    editingId = null;
    if (byId('dailySaveButton')) byId('dailySaveButton').textContent = 'ثبت مورد جدید';
    if (byId('dailyCancelButton')) byId('dailyCancelButton').hidden = true;
  }
  function render() {
    var body = byId('dailyAffairsBody');
    if (!body) return;
    var allList = rows().sort(function (a, b) { return Number(b.id) - Number(a.id); });
    var filter = byId('dailyStatusFilter');
    var filterValue = filter ? filter.value : 'all';
    var list = allList.filter(function (item) { return filterValue === 'all' || (filterValue === 'done' ? item.status === 'انجام شد' : item.status !== 'انجام شد'); });
    body.innerHTML = list.length ? list.map(function (item, index) {
      return '<tr>' +
        '<td>' + faDigits(index + 1) + '</td>' +
        '<td>' + escapeHtml(faDigits(item.date)) + '</td>' +
        '<td>' + escapeHtml(item.day || '') + '</td>' +
        '<td class="daily-description-cell">' + escapeHtml(item.description) + '</td>' +
        '<td>' + escapeHtml(faDigits(item.followDate || '')) + '</td>' +
        '<td class="daily-status-cell">' + (item.status === 'انجام شد' ? '<span class="daily-status-pill done">✓ انجام شد</span>' : '<span class="daily-status-pill pending">انجام نشده</span>') + '</td>' +
        '<td class="daily-actions">' + (item.status === 'انجام شد' ? '<button type="button" class="daily-undo-button" data-status-reset="' + item.id + '">بازگشت</button>' : '<button type="button" class="daily-done-button" data-status-done="' + item.id + '">انجام شد</button>') + '<button type="button" data-edit="' + item.id + '">ویرایش</button><button type="button" data-delete="' + item.id + '">حذف</button></td>' +
        '</tr>';
    }).join('') : '<tr><td colspan="7" class="daily-empty">هنوز موردی ثبت نشده است.</td></tr>';
    var count = byId('dailyCount'); if (count) count.textContent = faDigits(allList.length);
    var doneCount = allList.filter(function (item) { return item.status === 'انجام شد'; }).length;
    var doneEl = byId('dailyDoneCount'); if (doneEl) doneEl.textContent = faDigits(doneCount);
    var pendingEl = byId('dailyPendingCount'); if (pendingEl) pendingEl.textContent = faDigits(list.length - doneCount);
  }
  function editItem(id) {
    var item = rows().find(function (row) { return String(row.id) === String(id); });
    if (!item) return;
    editingId = item.id;
    byId('dailyDate').value = item.date || currentPersianDate();
    byId('dailyDay').value = item.day || currentPersianDay();
    byId('dailyDescription').value = item.description || '';
    byId('dailyFollowDate').value = item.followDate || '';
    byId('dailySaveButton').textContent = 'ذخیره ویرایش';
    byId('dailyCancelButton').hidden = false;
    byId('dailyDescription').focus();
  }
  function removeItem(id) {
    var list = rows().filter(function (item) { return String(item.id) !== String(id); });
    saveRows(list); render();
    if (String(editingId) === String(id)) clearForm();
  }
  function submit() {
    var date = normalizeDate(currentPersianDate());
    var day = currentPersianDay();
    var followDate = normalizeDate(byId('dailyFollowDate').value);
    var description = byId('dailyDescription').value.trim();
    if (!validJalaliDate(date)) { alert('تاریخ ثبت را به صورت ۱۴۰۵/۰۶/۲۶ وارد کنید.'); byId('dailyDate').focus(); return; }
    if (followDate && !validJalaliDate(followDate)) { alert('تاریخ پیگیری صحیح نیست.'); byId('dailyFollowDate').focus(); return; }
    if (!description) { alert('شرح پیگیری را وارد کنید.'); byId('dailyDescription').focus(); return; }
    var list = rows();
    var item = { date: date, day: day, description: description, followDate: followDate };
    if (editingId !== null) {
      list = list.map(function (row) { return String(row.id) === String(editingId) ? Object.assign({}, row, item) : row; });
    } else { item.id = nextId(list); list.push(item); }
    saveRows(list); clearForm(); render();
  }
  function setFollowDateTomorrow() {
    var field = byId('dailyFollowDate');
    if (!field) return;
    var tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    try {
      var parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(tomorrow);
      var values = {};
      parts.forEach(function (part) { if (part.type !== 'literal') values[part.type] = part.value; });
      field.value = faDigits(enDigits(values.year) + '/' + String(values.month).padStart(2, '0') + '/' + String(values.day).padStart(2, '0'));
    } catch (e) {
      field.value = faDigits(currentPersianDate());
    }
  }
  function init() {
    if (initialized) { render(); return; }
    initialized = true;
    setAutomaticDate();
    byId('dailySaveButton').addEventListener('click', submit);
    byId('dailyCancelButton').addEventListener('click', clearForm);
    byId('dailyClearButton').addEventListener('click', function () { clearForm(); });
    byId('dailyFollowDate').addEventListener('input', function () { this.value = formatJalaliInput(this.value); });
    byId('dailyTodayButton').addEventListener('click', setFollowDateTomorrow);
    byId('dailyStatusFilter').addEventListener('change', render);
    byId('dailyAffairsBody').addEventListener('click', function (event) {
      var done = event.target.closest('[data-status-done]');
      var reset = event.target.closest('[data-status-reset]');
      var edit = event.target.closest('[data-edit]');
      var del = event.target.closest('[data-delete]');
      if (done || reset) {
        var statusId = (done || reset).getAttribute(done ? 'data-status-done' : 'data-status-reset');
        var nextStatus = done ? 'انجام شد' : 'انجام نشده';
        saveRows(rows().map(function (item) {
          return String(item.id) === String(statusId) ? Object.assign({}, item, { status: nextStatus }) : item;
        }));
        render();
        return;
      }
      if (edit) editItem(edit.getAttribute('data-edit'));
      if (del && confirm('این مورد حذف شود؟')) removeItem(del.getAttribute('data-delete'));
    });
    render();
  }
  window.dailyAffairsInit = init;
})();
