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
    if (!years.includes("1405")) years.push("1405");
    if (!years.includes(activeFiscalYear)) years.push(activeFiscalYear);
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
    if (!years.includes("1405")) years.push("1405");
    if (!years.includes(activeFiscalYear)) activeFiscalYear = years[years.length - 1] || "1405";
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
            updateFiscalYearLabels(); renderCheques();
        });
    }
}

async function refreshFiscalYearUI() {
    await setupFiscalYear(); updateFiscalYearLabels(); await loadCheques();
}

async function addFiscalYear() {
    const value = prompt("سال مالی جدید را وارد کنید:", "1406");
    if (value === null) return;
    const year = toEnglishDigits(value).replace(/\D/g, "");
    if (!/^\d{4}$/.test(year)) { alert("سال مالی باید ۴ رقم باشد."); return; }
    try {
        await window.pasargad.createFiscalYear(year);
        activeFiscalYear = year; localStorage.setItem("pasargadFiscalYear", year);
        await refreshFiscalYearUI(); alert("سال مالی " + toPersianDigits(year) + " با موفقیت ایجاد شد و فعال شد.");
    } catch (error) {
        if (error?.code === "FISCAL_YEAR_EXISTS") alert("این سال مالی قبلاً ایجاد شده است.");
        else { console.error(error); alert("خطایی در ایجاد سال مالی رخ داد."); }
    }
}

async function deleteActiveFiscalYear() {
    const year = activeFiscalYear;
    if (!confirm("آیا از حذف سال مالی " + toPersianDigits(year) + " مطمئن هستید؟\n\nسال مالی فقط در صورتی حذف می‌شود که اطلاعات چکی نداشته باشد.")) return;
    try {
        await window.pasargad.deleteFiscalYear(year);
        const years = await window.pasargad.getFiscalYears();
        activeFiscalYear = years[years.length - 1] || "1405"; localStorage.setItem("pasargadFiscalYear", activeFiscalYear);
        await refreshFiscalYearUI(); alert("سال مالی با موفقیت حذف شد.");
    } catch (error) {
        if (error?.code === "FISCAL_YEAR_HAS_DATA") alert("این سال مالی دارای " + toPersianDigits(error.count) + " چک است. ابتدا آن را خالی کنید.");
        else if (error?.code === "CANNOT_DELETE_LAST_FISCAL_YEAR") alert("حداقل یک سال مالی باید در سیستم باقی بماند.");
        else { console.error(error); alert("خطایی در حذف سال مالی رخ داد."); }
    }
}

async function clearActiveFiscalYear() {
    const year = activeFiscalYear;
    if (!confirm("هشدار: تمام چک‌های سال مالی " + toPersianDigits(year) + " حذف خواهند شد.\n\nاین عملیات قابل برگشت نیست. ادامه می‌دهید؟")) return;
    if (!confirm("تأیید نهایی: اطلاعات چک‌های سال مالی " + toPersianDigits(year) + " پاک شود؟")) return;
    try {
        const result = await window.pasargad.clearFiscalYear(year);
        await loadCheques();
        alert(toPersianDigits(result?.changes || 0) + " چک از سال مالی " + toPersianDigits(year) + " حذف شد.");
    } catch (error) { console.error(error); alert("خطایی در خالی کردن سال مالی رخ داد."); }
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

function renderCheques() {
    const list = document.getElementById("chequeList");
    if (!list) return;

    const search = (document.getElementById("search")?.value || "").trim().toLowerCase();
    const sendDate = toEnglishDigits((document.getElementById("sendDate")?.value || "").trim());
    const reportStatus = document.getElementById("reportStatus")?.value || currentStatusFilter();
    const radioStatus = currentStatusFilter();

    let rows = allCheques.filter(c => {
        const year = toEnglishDigits(c.fiscalYear ?? "");
        return year === activeFiscalYear;
    });

    if (search) {
        rows = rows.filter(c => {
            const text = [
                c.drawerName,
                c.drawerPhone,
                c.receiverName,
                c.receiverRegisteredName,
                c.chequeNo,
                c.sayadi,
                c.bank,
                c.branchName,
                c.accountOwner,
                c.accountNumber
            ].join(" ").toLowerCase();
            return text.includes(search) || toPersianDigits(text).includes(search);
        });
    }

    if (sendDate) {
        rows = rows.filter(c => toEnglishDigits(c.registrationDate || "") === sendDate);
    }

    const status = radioStatus !== "all" ? radioStatus : reportStatus;
    if (status !== "all") {
        rows = rows.filter(c => c.status === status);
    }

    const yearRows = allCheques.filter(c => toEnglishDigits(c.fiscalYear ?? "") === activeFiscalYear);
    const registered = yearRows.filter(c => c.status === "registered").length;
    const notRegistered = yearRows.filter(c => c.status === "notRegistered").length;

    setText("count", notRegistered);
    setText("registeredCount", registered);
    setText("totalCount", yearRows.length);

    list.innerHTML = "";
    selectedChequeId = null;
    const editSelectedButton = document.getElementById("editSelectedCheque");
    if (editSelectedButton) editSelectedButton.disabled = true;

    rows.forEach((c, index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${toPersianDigits(index + 1)}</td>
            <td>${escapeHtml(c.chequeNo || "-")}</td>
            <td>${escapeHtml(c.drawerName || "-")}</td>
            <td>${escapeHtml(c.drawerPhone || "-")}</td>
            <td>${escapeHtml(c.receiverName || "-")}</td>
            <td>${formatDisplayAmount(c.amount)}</td>
            <td>${escapeHtml(c.dueDate || "-")}</td>
            <td>${escapeHtml(c.registrationDate || "-")}</td>
            <td><span class="status-badge ${c.status === "registered" ? "registered" : "not-registered"}">${getStatusText(c.status)}</span></td>
            <td class="row-actions">
                <button type="button" class="row-edit" onclick="editCheque(${Number(c.id)})">ویرایش</button>
                <button type="button" class="row-delete" onclick="deleteCheque(${Number(c.id)})">حذف</button>
                <button type="button" class="row-register" onclick="registerCheque(${Number(c.id)})" ${c.status === "registered" ? "disabled" : ""}>ثبت چک</button>
            </td>
        `;
        tr.dataset.chequeId = String(Number(c.id));
        tr.addEventListener("click", function(event) {
            if (event.target.closest("button")) return;
            selectedChequeId = Number(c.id);
            document.querySelectorAll("#chequeList tr").forEach(row => row.classList.remove("cheque-row-selected"));
            tr.classList.add("cheque-row-selected");
            const editButton = document.getElementById("editSelectedCheque");
            if (editButton) editButton.disabled = false;
        });
        tr.addEventListener("dblclick", function(event) {
            if (event.target.closest("button")) return;
            editCheque(Number(c.id));
        });
        list.appendChild(tr);
    });

    const empty = document.getElementById("emptyMessage");
    if (empty) empty.style.display = rows.length ? "none" : "block";
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
    // Intentionally do nothing while typing. This keeps the search field instant.
    // Press Enter to apply the search.
}

function searchCheque() {
    renderCheques();
}

function newCheque() {
    if (typeof openChequeFormOverlay === "function") {
        var frame = document.getElementById("chequeFormFrame");
        if (frame && !frame.src.includes("cheque.html?new=1")) {
            frame.src = "cheque.html?new=1";
        }
        openChequeFormOverlay();
        return;
    }
    window.location.href = "cheque.html?new=1";
}

function editCheque(id) {
    if (!id || typeof openChequeFormOverlay !== "function") return;
    selectedChequeId = Number(id);
    openChequeFormOverlay("cheque.html?editId=" + encodeURIComponent(id) + "&t=" + Date.now());
}

function editSelectedCheque() {
    if (!selectedChequeId) {
        alert("ابتدا یک چک را از جدول انتخاب کنید.");
        return;
    }
    editCheque(selectedChequeId);
}

async function registerCheque(id) {
    const cheque = allCheques.find(c => Number(c.id) === Number(id));
    if (!cheque) return;

    if (cheque.status === "registered") {
        return;
    }

    const number = cheque.chequeNo || "بدون شماره";
    const confirmed = confirm("آیا این چک ثبت شود؟\n\nشماره چک: " + number);
    if (!confirmed) return;

    try {
        const registrationDate = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
            year: "numeric", month: "2-digit", day: "2-digit"
        }).format(new Date());

        const result = await window.pasargad.updateChequeStatus({
            id: Number(id),
            status: "registered",
            registrationDate
        });

        if (result && result.success && result.changes > 0) {
            // بدون خواندن دوباره کل دیتابیس، فقط همان ردیف را در حافظه به‌روز می‌کنیم.
            // این کار باعث می‌شود بعد از «ثبت چک» کادر جستجو هیچ مکثی نداشته باشد.
            const localCheque = allCheques.find(c => Number(c.id) === Number(id));
            if (localCheque) {
                localCheque.status = "registered";
                localCheque.registrationDate = registrationDate;
            }
            // فقط همان ردیف را به‌روزرسانی کن تا فوکوس و فیلدهای گزارش از بین نروند.
            const row = document.querySelector(`#chequeList tr[data-cheque-id="${Number(id)}"]`);
            if (row) {
                const cells = row.querySelectorAll("td");
                // تاریخ ارسال برای ثبت
                if (cells[7]) cells[7].textContent = registrationDate || "-";
                // وضعیت
                if (cells[8]) cells[8].innerHTML = '<span class="status-badge registered">ثبت شده</span>';
                // دکمه ثبت
                const registerButton = row.querySelector(".row-register");
                if (registerButton) { registerButton.disabled = true; registerButton.textContent = "ثبت شده"; }
            }
        } else {
            alert("وضعیت چک تغییر نکرد.");
        }
    } catch (error) {
        console.error("Register cheque error:", error);
        alert("خطا در ثبت وضعیت چک: " + (error?.message || error));
    }
}

async function deleteCheque(id) {
    const cheque = allCheques.find(c => Number(c.id) === Number(id));
    if (!cheque) return;

    const number = cheque.chequeNo || "بدون شماره";
    const name = cheque.drawerName || "بدون نام آورنده";
    const confirmed = confirm("آیا از حذف این چک مطمئن هستید؟\n\nشماره چک: " + number + "\nآورنده: " + name);
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


function printPage() {
    window.print();
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
});
