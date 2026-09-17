/* ==================================================
   Pasargad - گزارش چک‌ها
   منطق گزارش و سال مالی
================================================== */

let allCheques = [];
let selectedChequeId = null;
let activeFiscalYear = localStorage.getItem("pasargadFiscalYear") || "1405";

const persianDigits = "۰۱۲۳۴۵۶۷۸۹";

function toPersianDigits(value) {
    return String(value ?? "").replace(/\d/g, d => persianDigits[Number(d)]);
}

function toEnglishDigits(value) {
    return String(value ?? "")
        .replace(/[۰-۹]/g, d => String(persianDigits.indexOf(d)));
}

function formatDisplayAmount(value) {
    const n = Number(toEnglishDigits(value).replace(/,/g, ""));
    if (!Number.isFinite(n) || n === 0) return "۰";
    return toPersianDigits(n.toLocaleString("en-US"));
}

function getStatusText(status) {
    if (status === "registered") return "ثبت شده";
    if (status === "notRegistered") return "ثبت نشده";
    if (status === "returned") return "عودت شده";
    return status || "-";
}

function getFiscalYears() {
    let years = [];
    try { years = JSON.parse(localStorage.getItem("pasargadFiscalYears") || "[]"); } catch (_) { years = []; }
    if (!Array.isArray(years)) years = [];
    years = years.map(y => toEnglishDigits(y)).filter(y => /^\d{4}$/.test(y));
    years = [...new Set(years)].sort((a, b) => Number(a) - Number(b));
    localStorage.setItem("pasargadFiscalYears", JSON.stringify(years));
    return years;
}

async function setupFiscalYear() {
    const select = document.getElementById("fiscalYear");
    if (!select) return;
    let years;
    try { years = await window.pasargad.getFiscalYears(); } catch (error) { console.error("Fiscal year database error:", error); years = null; }
    if (!Array.isArray(years) || !years.length) years = getFiscalYears();
    years = years.map(y => toEnglishDigits(y)).filter(y => /^\d{4}$/.test(y));
    if (!years.includes(activeFiscalYear)) activeFiscalYear = years[years.length - 1] || "";
    years = [...new Set(years)].sort((a, b) => Number(a) - Number(b));
    localStorage.setItem("pasargadFiscalYears", JSON.stringify(years));
    localStorage.setItem("pasargadFiscalYear", activeFiscalYear);
    select.innerHTML = "";
    years.forEach(year => {
        const option = document.createElement("option");
        option.value = year; option.textContent = toPersianDigits(year); option.selected = year === activeFiscalYear;
        select.appendChild(option);
    });
    if (!select.dataset.bound) {
        select.dataset.bound = "1";
        select.addEventListener("change", function () {
            activeFiscalYear = toEnglishDigits(this.value);
            localStorage.setItem("pasargadFiscalYear", activeFiscalYear);
            updateFiscalYearLabels(); renderCheques(); if (typeof window.customerRefreshForFiscalYear === "function") window.customerRefreshForFiscalYear();
        });
    }
}

async function refreshFiscalYearUI() {
    await setupFiscalYear(); updateFiscalYearLabels(); await loadCheques();
}

function fiscalDialog(options) {
    options = options || {};
    return new Promise(function(resolve) {
        var modal = document.getElementById("fiscalActionModal");
        var title = document.getElementById("fiscalActionTitle");
        var message = document.getElementById("fiscalActionMessage");
        var inputWrap = document.getElementById("fiscalActionInputWrap");
        var input = document.getElementById("fiscalActionInput");
        var ok = document.getElementById("fiscalActionOk");
        var cancel = document.getElementById("fiscalActionCancel");
        if (!modal || !title || !message || !ok || !cancel) { resolve(null); return; }
        title.textContent = options.title || "پیام";
        message.textContent = options.message || "";
        inputWrap.hidden = !options.input;
        input.value = options.value || "";
        input.disabled = !options.input;
        input.readOnly = !options.input;
        input.removeAttribute("disabled");
        if (options.input) {
            input.setAttribute("autocomplete", "off");
            input.setAttribute("inputmode", "numeric");
        }
        ok.textContent = options.okText || "تأیید";
        cancel.textContent = options.cancelText || "انصراف";
        modal.hidden = false;
        var done = function(value) {
            modal.hidden = true;
            ok.onclick = null; cancel.onclick = null;
            modal.onclick = null;
            resolve(value);
        };
        ok.onclick = function() { done(options.input ? input.value : true); };
        cancel.onclick = function() { done(null); };
        modal.onclick = function(e) { if (e.target === modal) done(null); };
        if (options.input) { setTimeout(function(){ input.focus(); input.select(); }, 0); }
        else setTimeout(function(){ ok.focus(); }, 0);
    });
}

async function addFiscalYear() {
    const value = await fiscalDialog({
        title: "ایجاد سال مالی",
        message: "سال مالی جدید را وارد کنید.",
        input: true,
        value: "1406",
        okText: "ایجاد سال مالی"
    });
    if (value === null) return;
    const year = toEnglishDigits(value).replace(/\D/g, "");
    if (!/^\d{4}$/.test(year)) {
        await fiscalDialog({title:"ورودی نامعتبر", message:"سال مالی باید دقیقاً ۴ رقم باشد.", okText:"متوجه شدم", cancelText:""});
        return;
    }
    try {
        // جلوگیری قطعی از ایجاد سال همنام، حتی قبل از ارسال به دیتابیس
        const existingYears = await window.pasargad.getFiscalYears();
        const normalizedYears = Array.isArray(existingYears)
            ? existingYears.map(y => toEnglishDigits(y))
            : [];
        if (normalizedYears.includes(year)) {
            await fiscalDialog({title:"سال مالی تکراری", message:"این سال مالی قبلاً ایجاد شده است.", okText:"باشه", cancelText:""});
            return;
        }
        const result = await window.pasargad.createFiscalYear(year);
        if (!result || result.success === false) throw new Error("ایجاد سال مالی انجام نشد.");
        activeFiscalYear = year;
        localStorage.setItem("pasargadFiscalYear", year);
        await refreshFiscalYearUI();
        await fiscalDialog({title:"عملیات موفق", message:"سال مالی " + toPersianDigits(year) + " با موفقیت ایجاد و فعال شد.", okText:"باشه", cancelText:""});
    } catch (error) {
        if (error?.code === "FISCAL_YEAR_EXISTS") await fiscalDialog({title:"سال مالی تکراری", message:"این سال مالی قبلاً ایجاد شده است.", okText:"باشه", cancelText:""});
        else { console.error(error); await fiscalDialog({title:"خطا در ایجاد سال مالی", message:"ایجاد سال مالی انجام نشد. لطفاً دوباره تلاش کنید.", okText:"باشه", cancelText:""}); }
    }
}

async function deleteActiveFiscalYear() {
    const year = activeFiscalYear;
    const confirmed = await fiscalDialog({
        title: "حذف سال مالی",
        message: "آیا از حذف سال مالی " + toPersianDigits(year) + " مطمئن هستید؟\n\nاگر اطلاعاتی در این سال وجود داشته باشد، ابتدا باید سال را خالی کنید.",
        okText: "حذف سال مالی"
    });
    if (!confirmed) return;
    try {
        const deleteResult = await window.pasargad.deleteFiscalYear(year);
        if (!deleteResult || deleteResult.success !== true) {
            throw new Error("حذف سال مالی انجام نشد.");
        }

        // حذف موفق را از فهرست محلی هم خارج می‌کنیم تا UI بلافاصله همان نتیجه دیتابیس را نشان دهد.
        let storedYears = getFiscalYears().filter(y => y !== year);
        activeFiscalYear = storedYears.length ? storedYears[storedYears.length - 1] : "";
        localStorage.setItem("pasargadFiscalYears", JSON.stringify(storedYears));
        localStorage.setItem("pasargadFiscalYear", activeFiscalYear);
        await refreshFiscalYearUI();
        await fiscalDialog({title:"عملیات موفق", message:"سال مالی " + toPersianDigits(year) + " با موفقیت حذف شد.", okText:"باشه", cancelText:""});
    } catch (error) {
        if (error?.code === "FISCAL_YEAR_HAS_DATA") {
            await fiscalDialog({title:"امکان حذف وجود ندارد", message:"این سال مالی دارای " + toPersianDigits(error.count) + " چک است.\n\nابتدا از گزینه «خالی کردن سال مالی» استفاده کنید و سپس دوباره حذف را انجام دهید.", okText:"متوجه شدم", cancelText:""});
        } else { console.error(error); await fiscalDialog({title:"خطا در حذف سال مالی", message:"حذف سال مالی انجام نشد. لطفاً دوباره تلاش کنید.", okText:"باشه", cancelText:""}); }
    }
}

async function clearActiveFiscalYear() {
    const year = activeFiscalYear;
    const confirmed = await fiscalDialog({
        title: "خالی کردن سال مالی",
        message: "تمام چک‌های سال مالی " + toPersianDigits(year) + " حذف خواهند شد.\n\nاین عملیات قابل برگشت نیست. ادامه می‌دهید؟",
        okText: "ادامه"
    });
    if (!confirmed) return;
    const confirmed2 = await fiscalDialog({
        title: "تأیید نهایی",
        message: "تأیید می‌کنید اطلاعات چک‌های سال مالی " + toPersianDigits(year) + " پاک شود؟",
        okText: "خالی کردن سال مالی"
    });
    if (!confirmed2) return;
    try {
        const result = await window.pasargad.clearFiscalYear(year);
        await loadCheques();
        // اطلاعات محلی کنترل ارسال مربوط به همین سال نیز با «خالی کردن سال مالی» پاک شود.
        localStorage.removeItem("pasargadSendControlRows_" + year);
        localStorage.removeItem("pasargadSendControlTypes_" + year);
        if (typeof window.sendControlInit === "function" && !document.getElementById("sendControl")?.hidden) {
            await window.sendControlInit();
        }
        await fiscalDialog({title:"عملیات موفق", message:toPersianDigits(result?.changes || 0) + " چک و " + toPersianDigits(result?.sendControlChanges || 0) + " رکورد کنترل ارسال از سال مالی " + toPersianDigits(year) + " حذف شد.", okText:"باشه", cancelText:""});
    } catch (error) {
        console.error(error);
        await fiscalDialog({title:"خطا در خالی کردن سال مالی", message:"خالی کردن اطلاعات سال مالی انجام نشد. لطفاً دوباره تلاش کنید.", okText:"باشه", cancelText:""});
    }
}

function updateFiscalYearLabels() {
    const title = `سال مالی ${toPersianDigits(activeFiscalYear)}`;
    ["currentYearTitle", "footerYearTitle"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = title;
    });
}

async function loadCheques() {
    try {
        const result = await window.pasargad.getCheques();
        const rows = Array.isArray(result) ? result : (result?.data || []);
        // SQLite columns are snake_case; normalize them here so the report
        // uses the same camelCase field names as the cheque form.
        allCheques = rows.map(c => ({
            ...c,
            sendDate: c.sendDate ?? c.send_date ?? "",
            branchName: c.branchName ?? c.branch_name ?? "",
            branchCode: c.branchCode ?? c.branch_code ?? "",
            chequeNo: c.chequeNo ?? c.cheque_no ?? "",
            sayadi: c.sayadi ?? "",
            dueDate: c.dueDate ?? c.due_date ?? "",
            accountOwner: c.accountOwner ?? c.account_owner ?? "",
            accountOwnerNationalCode: c.accountOwnerNationalCode ?? c.account_owner_national_code ?? "",
            accountNumber: c.accountNumber ?? c.account_number ?? "",
            drawerName: c.drawerName ?? c.drawer_name ?? "",
            drawerPhone: c.drawerPhone ?? c.drawer_phone ?? "",
            receiverName: c.receiverName ?? c.receiver_name ?? "",
            receiverRegisteredName: c.receiverRegisteredName ?? c.receiver_registered_name ?? "",
            receiverNationalCode: c.receiverNationalCode ?? c.receiver_national_code ?? "",
            registrationDate: c.registrationDate ?? c.registration_date ?? "",
            fiscalYear: c.fiscalYear ?? c.fiscal_year ?? "",
            createdAt: c.createdAt ?? c.created_at ?? ""
        }));
    } catch (error) {
        console.error("Database error:", error);
        allCheques = [];
    }
    renderCheques();
}

function currentStatusFilter() {
    const checked = document.querySelector('input[name="chequeStatus"]:checked');
    return checked?.value || document.getElementById("reportStatus")?.value || "all";
}

function renderCheques(options) {
    const list = document.getElementById("chequeList");
    if (!list) return;
    options = options || {};

    const search = (document.getElementById("search")?.value || "").trim().toLowerCase();
    const sendDate = toEnglishDigits((document.getElementById("sendDate")?.value || "").trim());
    const reportStatus = document.getElementById("reportStatus")?.value || currentStatusFilter();
    const radioStatus = currentStatusFilter();

    let rows = allCheques.filter(c => toEnglishDigits(c.fiscalYear ?? "") === activeFiscalYear);

    if (sendDate) rows = rows.filter(c => toEnglishDigits(c.sendDate || "").startsWith(sendDate));
    const status = radioStatus !== "all" ? radioStatus : reportStatus;
    if (status !== "all") rows = rows.filter(c => c.status === status);

    const yearRows = allCheques.filter(c => toEnglishDigits(c.fiscalYear ?? "") === activeFiscalYear);
    setText("count", yearRows.filter(c => c.status === "notRegistered").length);
    setText("registeredCount", yearRows.filter(c => c.status === "registered").length);
    setText("totalCount", yearRows.length);

    list.innerHTML = "";
    selectedChequeId = null;
    const editSelectedButton = document.getElementById("editSelectedCheque");
    if (editSelectedButton) editSelectedButton.disabled = true;

    const fragment = document.createDocumentFragment();
    rows.forEach((c, index) => {
        const tr = document.createElement("tr");
        tr.dataset.chequeId = String(Number(c.id));
        const searchText = [
            c.drawerName, c.drawerPhone, c.receiverName,
            c.receiverRegisteredName, c.chequeNo, c.sayadi,
            c.bank, c.branchName, c.accountOwner, c.accountNumber
        ].join(" ").toLowerCase();
        tr.dataset.searchText = searchText;
        tr.dataset.searchTextNormalized = toEnglishDigits(searchText);
        tr.innerHTML = `
            <td>${toPersianDigits(index + 1)}</td>
            <td>${escapeHtml(c.chequeNo || "-")}</td>
            <td>${escapeHtml(c.drawerName || "-")}</td>
            <td>${escapeHtml(c.drawerPhone || "-")}</td>
            <td>${escapeHtml(c.receiverName || "-")}</td>
            <td>${formatDisplayAmount(c.amount)}</td>
            <td>${escapeHtml(c.dueDate || "-")}</td>
            <td>${escapeHtml(c.sendDate || "-")}</td>
            <td><span class="status-badge ${c.status === "registered" ? "registered" : "not-registered"}">${getStatusText(c.status)}</span></td>
            <td class="row-actions">
                <button type="button" class="row-edit" onclick="editCheque(${Number(c.id)})">ویرایش</button>
                <button type="button" class="row-delete" onclick="deleteCheque(${Number(c.id)})">حذف</button>
                <button type="button" class="row-register" onclick="registerCheque(${Number(c.id)})" ${c.status === "registered" ? "disabled" : ""}>تایید چک</button>
            </td>`;
        tr.addEventListener("click", function(event) {
            if (event.target.closest("button")) return;
            selectedChequeId = Number(c.id);
            list.querySelectorAll("tr").forEach(row => row.classList.remove("cheque-row-selected"));
            tr.classList.add("cheque-row-selected");
            if (editSelectedButton) editSelectedButton.disabled = false;
        });
        tr.addEventListener("dblclick", function(event) {
            if (event.target.closest("button")) return;
            editCheque(Number(c.id));
        });
        fragment.appendChild(tr);
    });
    list.appendChild(fragment);

    applyReportSearch();
}

function applyReportSearch() {
    const list = document.getElementById("chequeList");
    const empty = document.getElementById("emptyMessage");
    if (!list) return;

    const searchEl = document.getElementById("search");
    const search = (searchEl?.value || "").trim().toLowerCase();
    const normalizedSearch = toEnglishDigits(search);
    const rows = list.children;
    let visible = 0;

    // فقط روی ردیف‌های موجود کار می‌کنیم؛ هیچ رندر، دیتابیس یا querySelector
    // جداگانه برای هر ردیف هنگام تایپ انجام نمی‌شود.
    for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const text = row.dataset.searchText || "";
        const normalizedText = row.dataset.searchTextNormalized || text;
        const match = !search || text.includes(search) || normalizedText.includes(normalizedSearch);
        if (row.hidden !== !match) row.hidden = !match;
        if (match) visible++;
    }

    if (empty) empty.style.display = visible ? "none" : "block";
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = toPersianDigits(value);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function filterStatus() {
    const checked = document.querySelector('input[name="chequeStatus"]:checked');
    const report = document.getElementById("reportStatus");
    if (checked && report && ["all", "registered", "notRegistered"].includes(checked.value)) {
        report.value = checked.value;
    }
    renderCheques();
}

function scheduleReportSearch() {
    applyReportSearch();
}

function searchCheque() {
    applyReportSearch();
}

function newCheque() {
    if (typeof openChequeFormOverlay === "function") {
        var frame = document.getElementById("chequeFormFrame");
        if (!frame) return;
        // باز شدن فوری: هیچ دسترسی synchronous به DOM داخل iframe انجام نمی‌شود.
        openChequeFormOverlay();
        // هر بار «ثبت چک جدید» یک iframe تازه می‌گیرد تا هیچ وضعیت قفل/readonly
        // از فرم قبلی باقی نماند. پیام reset فقط بعد از load ارسال می‌شود.
        var resetAfterLoad = function () {
            try {
                frame.removeEventListener('load', resetAfterLoad);
                if (frame.contentWindow) {
                    frame.contentWindow.postMessage({type:'pasargad-reset-cheque-form'}, window.location.origin);
                }
            } catch (e) {}
        };
        frame.addEventListener('load', resetAfterLoad, {once:true});
        if (!frame.getAttribute('src')) {
            frame.setAttribute('src', 'cheque.html?new=1&t=' + Date.now());
        }
        return;
    }
    window.location.href = "cheque.html?new=1";
}

function editCheque(id) {
    if (!id || typeof openChequeFormOverlay !== "function") return;
    selectedChequeId = Number(id);
    // فرم ویرایش اطلاعات همان ردیف را از حافظه گزارش دریافت می‌کند تا
    // برای باز شدن فرم دوباره کل جدول از دیتابیس خوانده نشود. این کار فقط
    // مسیر بارگذاری فرم ویرایش را سریع می‌کند و منطق ذخیره را تغییر نمی‌دهد.
    const cheque = allCheques.find(c => Number(c.id) === Number(id));
    try {
        if (cheque) sessionStorage.setItem("pasargadEditingCheque", JSON.stringify(cheque));
        else sessionStorage.removeItem("pasargadEditingCheque");
    } catch (_) {}
    openChequeFormOverlay("cheque.html?editId=" + encodeURIComponent(id) + "&t=" + Date.now());
}

function editSelectedCheque() {
    if (!selectedChequeId) {
        alert("ابتدا یک چک را از جدول انتخاب کنید.");
        return;
    }
    editCheque(selectedChequeId);
}


function showChequeConfirm(title, message) {
    return new Promise(function(resolve) {
        var modal = document.getElementById("chequeConfirmModal");
        var titleEl = document.getElementById("chequeConfirmTitle");
        var messageEl = document.getElementById("chequeConfirmMessage");
        var yes = document.getElementById("chequeConfirmYes");
        var no = document.getElementById("chequeConfirmNo");
        if (!modal || !titleEl || !messageEl || !yes || !no) {
            resolve(window.confirm(title + "\n\n" + message));
            return;
        }
        titleEl.textContent = title;
        messageEl.textContent = message;
        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        var done = function(value) {
            modal.hidden = true;
            modal.setAttribute("aria-hidden", "true");
            yes.removeEventListener("click", onYes);
            no.removeEventListener("click", onNo);
            document.removeEventListener("keydown", onKey);
            resolve(value);
        };
        var onYes = function() { done(true); };
        var onNo = function() { done(false); };
        var onKey = function(e) {
            if (e.key === "Escape") { e.preventDefault(); done(false); }
            else if (e.key === "Enter") { e.preventDefault(); done(true); }
        };
        yes.addEventListener("click", onYes);
        no.addEventListener("click", onNo);
        document.addEventListener("keydown", onKey);
        setTimeout(function(){ try { no.focus(); } catch(e) {} }, 0);
    });
}

async function registerCheque(id) {
    const cheque = allCheques.find(c => Number(c.id) === Number(id));
    if (!cheque || cheque.status === "registered") return;

    const number = cheque.chequeNo || "بدون شماره";
    const confirmed = await showChequeConfirm("آیا این چک تایید شود؟", "شماره چک: " + number);
    if (!confirmed) return;

    // تغییر UI کاملاً محلی و فوری است. ذخیره دیتابیس به صورت one-way ارسال می‌شود
    // تا هیچ عملیات IPC/SQLite مسیر تایپ و جستجوی گزارش را متوقف نکند.
    cheque.status = "registered";

    const row = document.querySelector(`#chequeList tr[data-cheque-id="${Number(id)}"]`);
    if (row) {
        const cells = row.querySelectorAll("td");
        if (cells[8]) {
            cells[8].innerHTML = '<span class="status-badge registered">ثبت شده</span>';
        }
        const registerButton = row.querySelector(".row-register");
        if (registerButton) {
            registerButton.disabled = true;
            registerButton.textContent = "تایید شده";
        }
    }

    try {
        if (window.pasargad && typeof window.pasargad.confirmChequeStatus === "function") {
            window.pasargad.confirmChequeStatus({ id: Number(id), status: "registered" });
        }
    } catch (error) {
        console.error("Confirm cheque status send error:", error);
    }
}

async function deleteCheque(id) {
    const cheque = allCheques.find(c => Number(c.id) === Number(id));
    if (!cheque) return;

    const number = cheque.chequeNo || "بدون شماره";
    const name = cheque.drawerName || "بدون نام آورنده";
    const confirmed = await showChequeConfirm(
        "حذف چک",
        "آیا از حذف این چک مطمئن هستید؟\n\nشماره چک: " + number + "\nآورنده: " + name
    );
    if (!confirmed) return;

    try {
        const result = await window.pasargad.deleteCheque(Number(id));
        if (result && result.success && result.changes > 0) {
            await loadCheques();
        } else {
            alert("چک مورد نظر پیدا نشد یا حذف نشد.");
        }
    } catch (error) {
        console.error("Delete error:", error);
        alert("خطایی در حذف چک رخ داد.");
    }
}


async function loadPrintSettings() {
    try {
        const results = await Promise.all([window.pasargad.getPrintSettings(), window.pasargad.getPrinters()]);
        const settings = results[0] || {}; const printers = results[1] || [];
        const printer = document.getElementById("printPrinter");
        if (printer) {
            printer.innerHTML = '<option value="">پرینتر پیش‌فرض سیستم</option>';
            printers.forEach(function(p){ const o=document.createElement("option"); o.value=p.name||p.deviceName||""; o.textContent=p.displayName||p.name||p.deviceName||"پرینتر"; if(o.value) printer.appendChild(o); });
        }
        const map={printPrinter:settings.printerName||"",printPaper:settings.paper||"A4",printOrientation:settings.orientation||"portrait",printMargins:settings.margins||"default",printCopies:String(settings.copies||1),printShowDate:settings.showDate===false?"no":"yes"};
        Object.keys(map).forEach(function(id){const el=document.getElementById(id);if(el)el.value=map[id];});
    } catch(e){ console.error("Print settings load error:",e); }
}
function getPrintSettingsFromForm(){return {printerName:document.getElementById("printPrinter")?.value||"",paper:document.getElementById("printPaper")?.value||"A4",orientation:document.getElementById("printOrientation")?.value||"portrait",margins:document.getElementById("printMargins")?.value||"default",copies:Number(document.getElementById("printCopies")?.value||1),showDate:(document.getElementById("printShowDate")?.value||"yes")==="yes"};}
async function savePrintSettings(){try{const r=await window.pasargad.savePrintSettings(getPrintSettingsFromForm());const m=document.getElementById("printMessage");if(m)m.textContent=r&&r.success?"تنظیمات چاپ با موفقیت ذخیره شد.":"ذخیره تنظیمات چاپ انجام نشد.";return !!(r&&r.success);}catch(e){const m=document.getElementById("printMessage");if(m)m.textContent="خطا در ذخیره تنظیمات چاپ.";return false;}}
async function printChequeReport(){
    window.customerPrintMode = false;
    const modal = document.getElementById("reportPrintModal");
    const printer = document.getElementById("reportPrintPrinter");
    if (!modal || !printer) return;

    try {
        const results = await Promise.all([
            window.pasargad.getPrintSettings(),
            window.pasargad.getPrinters()
        ]);
        const settings = results[0] || {};
        const printers = results[1] || [];

        printer.innerHTML = '<option value="">انتخاب پرینتر</option>';
        printers.forEach(function(p){
            const name = p.name || p.deviceName || "";
            if (!name) return;
            const o = document.createElement("option");
            o.value = name;
            o.textContent = p.displayName || name;
            printer.appendChild(o);
        });

        const savedPrinter = settings.printerName || "";
        printer.value = savedPrinter;
        if (!printer.value && printer.options.length > 1) printer.selectedIndex = 1;

        const map = {
            reportPrintPaper: settings.paper || "A4",
            reportPrintOrientation: settings.orientation || "portrait",
            reportPrintMargins: settings.margins || "default",
            reportPrintCopies: String(settings.copies || 1),
            reportPrintShowDate: settings.showDate === false ? "no" : "yes"
        };
        Object.keys(map).forEach(function(id){
            const el = document.getElementById(id);
            if (el) el.value = map[id];
        });

        const message = document.getElementById("reportPrintMessage");
        if (message) {
            message.textContent = printer.options.length > 1
                ? "تنظیمات چاپ گزارش را انتخاب کنید و سپس «چاپ» را بزنید."
                : "هیچ پرینتری در سیستم پیدا نشد.";
        }
        modal.hidden = false;
        setTimeout(function(){ printer.focus(); }, 0);
    } catch (e) {
        console.error("Report print settings error:", e);
    }
}


function buildPrintableCustomerClone() {
    const profile = document.querySelector("#customerProfilePanel");
    if (!profile || profile.hidden) throw new Error("پرونده مشتری باز نیست.");
    const clone = profile.cloneNode(true);
    clone.hidden = false;
    clone.querySelectorAll(".customer-profile-actions, .customer-profile-head, .customer-follow-done, button").forEach(el => el.remove());
    clone.querySelectorAll(".customer-card").forEach(el => { el.style.boxShadow = "none"; });
    return clone;
}

function buildPrintableSendControlClone() {
    const panel = document.querySelector("#sendControl .send-control-report-card");
    if (!panel) throw new Error("گزارش وضعیت ارسال پیدا نشد.");
    const clone = panel.cloneNode(true);
    clone.querySelectorAll(".send-report-tools, .send-status-btn, button").forEach(el => el.remove());
    return clone;
}

function buildPrintableReportClone() {
    const tablePanel = document.querySelector("#cheques .table-panel");
    if (!tablePanel) throw new Error("گزارش چک‌ها پیدا نشد.");
    const reportClone = tablePanel.cloneNode(true);
    // ستون عملیات را حذف می‌کنیم؛ ستون وضعیت باید باقی بماند.
    reportClone.querySelectorAll(".row-actions").forEach(el => el.remove());
    reportClone.querySelectorAll("th:last-child").forEach(el => el.remove());
    reportClone.querySelectorAll("tbody tr").forEach(tr => {
        const statusCell = tr.querySelector("td:nth-child(9)");
        if (statusCell) {
            const badge = statusCell.querySelector(".status-badge");
            const registered = !!badge && badge.classList.contains("registered");
            const statusText = registered ? "ثبت شده" : (badge ? "ثبت نشده" : (statusCell.textContent || "-"));
            statusCell.innerHTML = `<span class="print-status-badge ${registered ? "registered" : "not-registered"}">${statusText}</span>`;
            const statusBadge = statusCell.querySelector(".print-status-badge");
            if (statusBadge) {
                statusBadge.setAttribute("style", registered
                    ? "display:inline-flex !important;align-items:center !important;justify-content:center !important;min-width:85px !important;padding:5px 10px !important;border-radius:4px !important;font-family:'B Titr','Titr',Tahoma,sans-serif !important;font-size:11px !important;font-weight:bold !important;line-height:1.4 !important;background:#d7ecd9 !important;color:#286334 !important;border:1px solid #a8cbaa !important;white-space:nowrap !important;"
                    : "display:inline-flex !important;align-items:center !important;justify-content:center !important;min-width:85px !important;padding:5px 10px !important;border-radius:4px !important;font-family:'B Titr','Titr',Tahoma,sans-serif !important;font-size:11px !important;font-weight:bold !important;line-height:1.4 !important;background:#f4d2d2 !important;color:#8a2b2b !important;border:1px solid #d8aaaa !important;white-space:nowrap !important;");
            }
        }
    });
    return reportClone;
}

async function previewReportFromModal(){
    const message = document.getElementById("reportPrintMessage");
    const printer = document.getElementById("reportPrintPrinter");
    const settings = {
        printerName: printer?.value || "",
        paper: document.getElementById("reportPrintPaper")?.value || "A4",
        orientation: document.getElementById("reportPrintOrientation")?.value || "portrait",
        margins: document.getElementById("reportPrintMargins")?.value || "default",
        copies: Number(document.getElementById("reportPrintCopies")?.value || 1),
        showDate: (document.getElementById("reportPrintShowDate")?.value || "yes") === "yes"
    };
    if (message) message.textContent = "در حال آماده‌سازی پیش‌نمایش...";
    try {
        await window.pasargad.savePrintSettings(settings);
        const reportClone = window.customerPrintMode ? buildPrintableCustomerClone() : (window.sendControlPrintMode ? buildPrintableSendControlClone() : buildPrintableReportClone());
        const title = document.getElementById("currentYearTitle")?.textContent || "";
        const r = await window.pasargad.previewReport({
            settings,
            title: window.customerPrintMode ? "پرونده مشتری" : (window.sendControlPrintMode ? "گزارش وضعیت ارسال" : "گزارش چک‌ها"),
            fiscalYear: title,
            html: reportClone.outerHTML
        });
        if (!r || !r.success) {
            if (message) message.textContent = (r && r.error) || "پیش‌نمایش گزارش انجام نشد.";
        } else if (message) {
            message.textContent = "پیش‌نمایش آماده شد.";
        }
    } catch (e) {
        console.error("Report preview error:", e);
        if (message) message.textContent = "خطا در پیش‌نمایش گزارش.";
    }
}

function closeReportPrintModal(){
    const modal = document.getElementById("reportPrintModal");
    if (modal) modal.hidden = true;
}

async function confirmReportPrint(){
    const printer = document.getElementById("reportPrintPrinter");
    const message = document.getElementById("reportPrintMessage");
    if (!printer || !printer.value) {
        if (message) message.textContent = "لطفاً ابتدا یک پرینتر را انتخاب کنید.";
        if (printer) printer.focus();
        return;
    }

    const settings = {
        printerName: printer.value,
        paper: document.getElementById("reportPrintPaper")?.value || "A4",
        orientation: document.getElementById("reportPrintOrientation")?.value || "portrait",
        margins: document.getElementById("reportPrintMargins")?.value || "default",
        copies: Number(document.getElementById("reportPrintCopies")?.value || 1),
        showDate: (document.getElementById("reportPrintShowDate")?.value || "yes") === "yes"
    };

    if (message) message.textContent = "در حال چاپ...";
    try {
        await window.pasargad.savePrintSettings(settings);
        const reportClone = window.customerPrintMode ? buildPrintableCustomerClone() : (window.sendControlPrintMode ? buildPrintableSendControlClone() : buildPrintableReportClone());
        const r = await window.pasargad.printReport({settings, fiscalYear: document.getElementById("currentYearTitle")?.textContent || "", html: reportClone.outerHTML});
        if (r && r.success) {
            closeReportPrintModal();
        } else if (message) {
            message.textContent = (r && r.error) || "عملیات چاپ انجام نشد.";
        }
    } catch (e) {
        console.error("Report print error:", e);
        if (message) message.textContent = "خطا در چاپ گزارش.";
    }
}

async function printPage(){await savePrintSettings();try{const r=await window.pasargad.printCurrentPage(getPrintSettingsFromForm());if(!r||!r.success){const m=document.getElementById("printMessage");if(m)m.textContent=(r&&r.error)||"عملیات چاپ انجام نشد.";}}catch(e){const m=document.getElementById("printMessage");if(m)m.textContent="خطا در چاپ گزارش.";}}
async function previewPrint(){await savePrintSettings();try{const r=await window.pasargad.previewCurrentPage(getPrintSettingsFromForm());if(!r||!r.success){const m=document.getElementById("printMessage");if(m)m.textContent=(r&&r.error)||"پیش‌نمایش چاپ انجام نشد.";}}catch(e){const m=document.getElementById("printMessage");if(m)m.textContent="خطا در پیش‌نمایش چاپ.";}}

async function loadAppearanceSettings(){
    try{
        const s=await window.pasargad.getAppearanceSettings();
        const company=document.getElementById("appearanceCompanyName"); const signer1=document.getElementById("appearanceSigner1"); const signer2=document.getElementById("appearanceSigner2"); const logo=document.getElementById("appearanceLogoPath"); const splash=document.getElementById("splashImagePath");
        if(company) company.value=s?.companyName||"نرم افزار مدیریت چک پاسارگاد";
        if(signer1) signer1.value=s?.signer1||"";
        if(signer2) signer2.value=s?.signer2||"";
        if(logo) logo.textContent=s?.logoPath?"لوگوی انتخاب‌شده است.":"لوگویی انتخاب نشده است.";
        try{const sp=await window.pasargad.getSplashImage();if(splash)splash.textContent=sp?.path?"تصویر صفحه شروع انتخاب‌شده است.":"تصویر پیش‌فرض استفاده می‌شود.";}catch(_){}
    }catch(e){console.error("Appearance settings load error:",e);}
}
async function saveAppearance(){
    const r=await window.pasargad.saveAppearanceSettings({companyName:document.getElementById("appearanceCompanyName")?.value||"",signer1:document.getElementById("appearanceSigner1")?.value||"",signer2:document.getElementById("appearanceSigner2")?.value||""});
    const m=document.getElementById("appearanceMessage"); if(m)m.textContent=r?.success?"تنظیمات ظاهری با موفقیت ذخیره شد.":"ذخیره تنظیمات انجام نشد.";
}
async function chooseSplashImage(){
    const r=await window.pasargad.chooseSplashImage(); const m=document.getElementById("appearanceMessage");
    if(r?.success){const e=document.getElementById("splashImagePath");if(e)e.textContent="تصویر صفحه شروع انتخاب و ذخیره شد.";if(m)m.textContent="تصویر صفحه شروع با موفقیت تغییر کرد.";} else if(!r?.canceled && m)m.textContent=r?.error||"انتخاب تصویر صفحه شروع انجام نشد.";
}
async function chooseAppearanceLogo(){
    const r=await window.pasargad.chooseAppearanceLogo(); const m=document.getElementById("appearanceMessage");
    if(r?.success){const e=document.getElementById("appearanceLogoPath");if(e)e.textContent="لوگوی انتخاب‌شده است.";if(m)m.textContent="لوگوی مشتری انتخاب و ذخیره شد.";} else if(!r?.canceled && m)m.textContent=r?.error||"انتخاب لوگو انجام نشد.";
}

document.addEventListener("DOMContentLoaded", async function () {
    await setupFiscalYear();
    updateFiscalYearLabels();
    const addButton = document.getElementById("addFiscalYear");
    if (addButton) addButton.addEventListener("click", addFiscalYear);
    const deleteButton = document.getElementById("deleteFiscalYear");
    if (deleteButton) deleteButton.addEventListener("click", deleteActiveFiscalYear);
    const clearButton = document.getElementById("clearFiscalYear");
    if (clearButton) clearButton.addEventListener("click", clearActiveFiscalYear);
    loadCheques();
    loadPrintSettings();
    loadAppearanceSettings();
});
