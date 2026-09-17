
// Database bridge: works both as a standalone page and inside the main-window iframe.
function pasargadCall(method, ...args) {
    if (window.pasargad && typeof window.pasargad[method] === 'function') {
        return window.pasargad[method](...args);
    }
    if (window.parent && window.parent !== window) {
        return new Promise((resolve, reject) => {
            const id = 'ipc_' + Date.now() + '_' + Math.random().toString(36).slice(2);
            const timer = setTimeout(() => {
                window.removeEventListener('message', onMessage);
                reject(new Error('پاسخ دیتابیس دریافت نشد.'));
            }, 15000);
            function onMessage(event) {
                if (event.origin !== window.location.origin) return;
                const msg = event.data;
                if (!msg || msg.type !== 'pasargad-ipc-response' || msg.id !== id) return;
                clearTimeout(timer);
                window.removeEventListener('message', onMessage);
                if (msg.ok) resolve(msg.result);
                else reject(new Error(msg.error || 'خطای دیتابیس'));
            }
            window.addEventListener('message', onMessage);
            window.parent.postMessage({type:'pasargad-ipc-request', id:id, method:method, args:args}, window.location.origin);
        });
    }
    return Promise.reject(new Error('اتصال به رابط دیتابیس برقرار نیست.'));
}

// ==================================================
// تبدیل اعداد فارسی و عربی به انگلیسی
// ==================================================

function toEnglishDigits(value) {

    if (!value) {
        return "";
    }

    return String(value)
        .replace(
            /[۰-۹]/g,
            digit =>
                String(
                    "۰۱۲۳۴۵۶۷۸۹".indexOf(digit)
                )
        )
        .replace(
            /[٠-٩]/g,
            digit =>
                String(
                    "٠١٢٣٤٥٦٧٨٩".indexOf(digit)
                )
        );
}


// ==================================================
// تبدیل اعداد انگلیسی به فارسی
// ==================================================

function toPersianDigits(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value).replace(
        /\d/g,
        digit =>
            "۰۱۲۳۴۵۶۷۸۹"[
                Number(digit)
            ]
    );
}


// ==================================================
// نمایش خطای داخل فرم
// ==================================================

function showFieldError(message, fieldId) {

    // پاک کردن خطاهای قبلی
    clearFieldErrors();

    const field =
        document.getElementById(fieldId);

    if (!field) {
        return false;
    }


    const container =
        field.closest(".field");


    if (container) {

        container.classList.add(
            "has-error"
        );
    }


    field.classList.add(
        "field-error"
    );


    const errorElement =
        document.getElementById(
            "error-" + fieldId
        );


    if (errorElement) {

        errorElement.textContent =
            message;
    }


    // فوکوس مستقیم
    field.focus({ preventScroll: true });

    return false;
}


// ==================================================
// پاک کردن خطاها
// ==================================================

function clearFieldErrors() {

    const fields =
        document.querySelectorAll(
            ".field"
        );


    fields.forEach(
        function (container) {

            container.classList.remove(
                "has-error"
            );

        }
    );


    const inputs =
        document.querySelectorAll(
            ".field-error"
        );


    inputs.forEach(
        function (input) {

            input.classList.remove(
                "field-error"
            );

        }
    );


    const messages =
        document.querySelectorAll(
            ".field-error-message"
        );


    messages.forEach(
        function (message) {

            message.textContent = "";

        }
    );
}


// ==================================================
// وقتی کاربر شروع به اصلاح فیلد کرد
// خطای همان فیلد حذف شود
// ==================================================

document.addEventListener(
    "input",
    function (event) {

        const field =
            event.target;

        if (
            !field ||
            !field.id
        ) {
            return;
        }


        if (
            !field.classList.contains(
                "field-error"
            )
        ) {
            return;
        }


        field.classList.remove(
            "field-error"
        );


        const container =
            field.closest(".field");


        if (container) {

            container.classList.remove(
                "has-error"
            );
        }


        const errorElement =
            document.getElementById(
                "error-" + field.id
            );


        if (errorElement) {

            errorElement.textContent =
                "";
        }

    }
);


// ==================================================
// بررسی تاریخ شمسی
// ==================================================

function isValidJalaliDate(value) {
    if (!value) {
        return false;
    }

    value = toEnglishDigits(value).trim();

    const match = value.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);

    if (!match) {
        return false;
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (year < 1300 || year > 1500) {
        return false;
    }

    if (month < 1 || month > 12) {
        return false;
    }

    let maxDay;

    if (month <= 6) {
        maxDay = 31;
    } else if (month <= 11) {
        maxDay = 30;
    } else {
        maxDay = isJalaliLeapYear(year) ? 30 : 29;
    }

    return day >= 1 && day <= maxDay;
}

function isJalaliLeapYear(year) {
    const remainder = year % 33;
    return [1, 5, 9, 13, 17, 22, 26, 30].includes(remainder);
}


// ==================================================
// فرمت تاریخ
// ==================================================

function formatJalaliInput(input) {
    if (!input) return;

    // قالب تاریخ بدون پرش مکان‌نما: فقط رقم‌ها نگه داشته می‌شوند
    // و جداکننده‌ها بین سال/ماه/روز ساخته می‌شوند.
    const raw = toEnglishDigits(input.value || "").replace(/[^0-9]/g, "").slice(0, 8);
    const before = input.value || "";
    const cursor = typeof input.selectionStart === "number" ? input.selectionStart : before.length;
    const digitsBeforeCursor = toEnglishDigits(before.slice(0, cursor)).replace(/[^0-9]/g, "").length;

    let value = raw;
    if (raw.length > 4) value = raw.slice(0, 4) + "/" + raw.slice(4);
    if (raw.length > 6) value = raw.slice(0, 4) + "/" + raw.slice(4, 6) + "/" + raw.slice(6);

    const formatted = toPersianDigits(value);
    if (input.value !== formatted) input.value = formatted;

    let newDigitPos = Math.min(digitsBeforeCursor, raw.length);
    let newPos = newDigitPos;
    if (newDigitPos > 4) newPos += 1;
    if (newDigitPos > 6) newPos += 1;
    try { input.setSelectionRange(newPos, newPos); } catch (e) {}
}


// ==================================================
// فرمت مبلغ
// ==================================================

function formatAmountInput(input) {
    if (!input) return;

    const value = toEnglishDigits(input.value || "").replace(/[^0-9]/g, "");
    if (!value) {
        input.value = "";
        updateAmountInWords("");
        return;
    }

    const formatted = toPersianDigits(Number(value).toLocaleString("en-US"));
    if (input.value !== formatted) input.value = formatted;

    // مبلغ به حروف باید همزمان و خودکار با مبلغ عددی به‌روزرسانی شود.
    updateAmountInWords(value);
}


function threeDigitsToWords(number) {
    const ones = [
        "صفر", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت",
        "هشت", "نه", "ده", "یازده", "دوازده", "سیزده", "چهارده",
        "پانزده", "شانزده", "هفده", "هجده", "نوزده"
    ];

    const tens = [
        "", "", "بیست", "سی", "چهل", "پنجاه", "شصت",
        "هفتاد", "هشتاد", "نود"
    ];

    const hundreds = [
        "", "صد", "دویست", "سیصد", "چهارصد", "پانصد",
        "ششصد", "هفتصد", "هشتصد", "نهصد"
    ];

    number = Number(number);

    if (number < 20) return ones[number];

    if (number < 100) {
        const ten = Math.floor(number / 10);
        const one = number % 10;
        return one ? tens[ten] + " و " + ones[one] : tens[ten];
    }

    const hundred = Math.floor(number / 100);
    const rest = number % 100;

    if (!rest) return hundreds[hundred];

    return hundreds[hundred] + " و " + threeDigitsToWords(rest);
}

function numberToPersianWords(value) {
    const clean = toEnglishDigits(String(value || ""))
        .replace(/,/g, "")
        .trim();

    if (!clean || !/^\d+$/.test(clean)) return "";

    const number = Number(clean);

    if (!Number.isSafeInteger(number)) return "";

    if (number === 0) return "صفر ریال";

    const scales = [
        "", "هزار", "میلیون", "میلیارد",
        "تریلیون", "کوادریلیون"
    ];

    let remaining = number;
    let scaleIndex = 0;
    const parts = [];

    while (remaining > 0) {
        const group = remaining % 1000;

        if (group) {
            let text = threeDigitsToWords(group);

            if (scales[scaleIndex]) {
                text += " " + scales[scaleIndex];
            }

            parts.unshift(text);
        }

        remaining = Math.floor(remaining / 1000);
        scaleIndex++;
    }

    return parts.join(" و ") + " ریال";
}

function updateAmountInWords(value) {
    const field = document.getElementById("amountInWords");

    if (field) {
        field.value = numberToPersianWords(value);
    }
}


// ==================================================
// فرمت کد ملی
// ==================================================

function formatNationalCode(input) {

    let value =
        toEnglishDigits(
            input.value
        );


    value =
        value.replace(
            /[^0-9]/g,
            ""
        );


    if (value.length > 10) {

        value =
            value.substring(
                0,
                10
            );
    }


    const formatted = toPersianDigits(value);
    if (input.value !== formatted) input.value = formatted;
}


// ==================================================
// فرمت شماره حساب
// ==================================================

function formatAccountNumber(input) {

    let value =
        toEnglishDigits(
            input.value
        );


    value =
        value.replace(
            /[^0-9]/g,
            ""
        );


    const formatted = toPersianDigits(value);
    if (input.value !== formatted) input.value = formatted;
}


// ==================================================
// فرمت تلفن
// ==================================================

function formatPhone(input) {

    let value =
        toEnglishDigits(
            input.value
        );


    value =
        value.replace(
            /[^0-9]/g,
            ""
        );


    if (value.length > 11) {

        value =
            value.substring(
                0,
                11
            );
    }


    const formatted = toPersianDigits(value);
    if (input.value !== formatted) input.value = formatted;
}


// ==================================================
// فرمت شناسه صیادی
// ==================================================

function formatSayadi(input) {

    let value =
        toEnglishDigits(
            input.value
        );


    value =
        value.replace(
            /[^0-9]/g,
            ""
        );


    if (value.length > 16) {

        value =
            value.substring(
                0,
                16
            );
    }


    const formatted = toPersianDigits(value);
    if (input.value !== formatted) input.value = formatted;
}


// ==================================================
// فرمت شماره چک
// ==================================================

function formatChequeNumber(input) {

    let value =
        toEnglishDigits(
            input.value
        );


    value =
        value.replace(
            /[^0-9]/g,
            ""
        );


    const formatted = toPersianDigits(value);
    if (input.value !== formatted) input.value = formatted;
}


// ==================================================
// ==================================================
// ==================================================
// فرمت سریع فیلدهای ثبت چک
// ==================================================
(function setupChequeFieldFormatting() {
    function formatDateWhileTyping(input) {
        if (!input) return;
        const old = input.value || "";
        const cursor = typeof input.selectionStart === "number" ? input.selectionStart : old.length;
        const digitsBefore = toEnglishDigits(old.slice(0, cursor)).replace(/[^0-9]/g, "").length;
        const raw = toEnglishDigits(old).replace(/[^0-9]/g, "").slice(0, 8);
        let formatted = raw;
        if (raw.length > 4) formatted = raw.slice(0, 4) + "/" + raw.slice(4);
        if (raw.length > 6) formatted = raw.slice(0, 4) + "/" + raw.slice(4, 6) + "/" + raw.slice(6);
        formatted = toPersianDigits(formatted);
        if (input.value !== formatted) input.value = formatted;
        let pos = Math.min(digitsBefore, raw.length);
        if (pos > 4) pos++;
        if (pos > 6) pos++;
        try { input.setSelectionRange(pos, pos); } catch (_) {}
    }

    function formatAmountWhileTyping(input) {
        if (!input) return;
        const old = input.value || "";
        const cursor = typeof input.selectionStart === "number" ? input.selectionStart : old.length;
        const digitsBefore = toEnglishDigits(old.slice(0, cursor)).replace(/[^0-9]/g, "").length;
        const raw = toEnglishDigits(old).replace(/[^0-9]/g, "");
        const grouped = raw ? Number(raw).toLocaleString("en-US") : "";
        const formatted = toPersianDigits(grouped);
        if (input.value !== formatted) input.value = formatted;
        let pos = 0, seen = 0;
        while (pos < formatted.length && seen < digitsBefore) {
            if (/[۰-۹]/.test(formatted[pos])) seen++;
            pos++;
        }
        try { input.setSelectionRange(pos, pos); } catch (_) {}
        updateAmountInWords(raw);
    }

    function bind() {
        const sendDate = document.getElementById("sendDate");
        const dueDate = document.getElementById("dueDate");
        const amount = document.getElementById("amount");

        [sendDate, dueDate].forEach(function (input) {
            if (!input || input.__jalaliBound) return;
            input.__jalaliBound = true;
            input.addEventListener("input", function () { formatDateWhileTyping(input); });
        });

        if (amount && !amount.__amountBound) {
            amount.__amountBound = true;
            amount.addEventListener("input", function () { formatAmountWhileTyping(amount); });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", bind, { once: true });
    } else {
        bind();
    }
})();

// ==================================================
// ثبت چک
// ==================================================

// پیام موفقیت غیرمسدودکننده؛ برای جلوگیری از قفل شدن فرم از alert استفاده نمی‌کند.
function showChequeSuccessMessage() {
    var old = document.getElementById("chequeSuccessMessage");
    if (old) old.remove();
    var box = document.createElement("div");
    box.id = "chequeSuccessMessage";
    box.textContent = "چک با موفقیت ثبت شد.";
    box.style.cssText = "position:fixed;z-index:99999;top:24px;left:50%;transform:translateX(-50%);background:#1f7a3a;color:#fff;padding:12px 28px;border-radius:8px;font-size:16px;font-weight:bold;box-shadow:0 6px 20px rgba(0,0,0,.18);";
    document.body.appendChild(box);
}

async function saveCheque() {

    clearFieldErrors();


    // ==================================================
    // مشخصات چک
    // اختیاری
    // ==================================================

    const sendDate =
        document.getElementById(
            "sendDate"
        )?.value.trim() || "";


    const bank =
        document.getElementById(
            "bank"
        )?.value.trim() || "";


    const branchName =
        document.getElementById(
            "branchName"
        )?.value.trim() || "";


    const chequeNo =
        document.getElementById(
            "chequeNo"
        )?.value.trim() || "";


    const sayadi =
        document.getElementById(
            "sayadi"
        )?.value.trim() || "";


    const dueDate =
        document.getElementById(
            "dueDate"
        )?.value.trim() || "";


    const amountInput =
        document.getElementById(
            "amount"
        )?.value.trim() || "";


    // ==================================================
    // صاحب حساب
    // اختیاری
    // ==================================================

    const accountOwner =
        document.getElementById(
            "accountOwner"
        )?.value.trim() || "";


    const accountOwnerNationalCode =
        document.getElementById(
            "accountOwnerNationalCode"
        )?.value.trim() || "";


    const accountNumber =
        document.getElementById(
            "accountNumber"
        )?.value.trim() || "";


    // ==================================================
    // آورنده
    // اجباری
    // ==================================================

    const drawerName =
        document.getElementById(
            "drawerName"
        )?.value.trim() || "";


    const drawerPhone =
        document.getElementById(
            "drawerPhone"
        )?.value.trim() || "";


    // ==================================================
    // دریافت‌کننده
    // اجباری
    // ==================================================

    const receiverName =
        document.getElementById(
            "receiverName"
        )?.value.trim() || "";


    const receiverRegisteredName =
        document.getElementById(
            "receiverRegisteredName"
        )?.value.trim() || "";


    const receiverNationalCode =
        document.getElementById(
            "receiverNationalCode"
        )?.value.trim() || "";


    // ==================================================
    // توضیحات
    // ==================================================

    const description =
        document.getElementById(
            "description"
        )?.value.trim() || "";


    // ==================================================
    // سال مالی
    // ==================================================

    const fiscalYear =
        document.getElementById(
            "fiscalYear"
        )?.value || "1405";


    // ==================================================
    // تاریخ ارسال
    // ==================================================

    if (
        sendDate &&
        !isValidJalaliDate(
            sendDate
        )
    ) {

        return showFieldError(
            "تاریخ ارسال صحیح نیست. مثال: ۱۴۰۵/۰۶/۱۵",
            "sendDate"
        );
    }


    // ==================================================
    // تاریخ سررسید
    // ==================================================

    if (
        dueDate &&
        !isValidJalaliDate(
            dueDate
        )
    ) {

        return showFieldError(
            "تاریخ سررسید صحیح نیست. مثال: ۱۴۰۵/۰۷/۰۱",
            "dueDate"
        );
    }


    // ==================================================
    // مبلغ
    // ==================================================

    const cleanAmount =
        toEnglishDigits(
            amountInput
        ).replace(
            /,/g,
            ""
        );


    if (
        cleanAmount &&
        Number(cleanAmount) < 0
    ) {

        return showFieldError(
            "مبلغ صحیح نیست.",
            "amount"
        );
    }


    // ==================================================
    // کد ملی صاحب حساب
    // ==================================================

    const cleanOwnerNationalCode =
        toEnglishDigits(
            accountOwnerNationalCode
        );


    if (
        cleanOwnerNationalCode &&
        !/^\d{10}$/.test(
            cleanOwnerNationalCode
        )
    ) {

        return showFieldError(
            "کد ملی صاحب حساب باید دقیقاً ۱۰ رقم باشد.",
            "accountOwnerNationalCode"
        );
    }


    // ==================================================
    // نام آورنده
    // ==================================================

    if (!drawerName) {

        return showFieldError(
            "نام آورنده چک را وارد کنید.",
            "drawerName"
        );
    }


    // ==================================================
    // تلفن آورنده
    // ==================================================

    if (!drawerPhone) {

        return showFieldError(
            "شماره تلفن آورنده چک را وارد کنید.",
            "drawerPhone"
        );
    }


    const cleanDrawerPhone =
        toEnglishDigits(
            drawerPhone
        );


    if (
        !/^0\d{10}$/.test(
            cleanDrawerPhone
        )
    ) {

        return showFieldError(
            "شماره تلفن باید ۱۱ رقم باشد. مثال: 09121234567",
            "drawerPhone"
        );
    }


    // ==================================================
    // واگذار شده به
    // ==================================================

    if (!receiverName) {

        return showFieldError(
            "قسمت «واگذار شده به» را وارد کنید.",
            "receiverName"
        );
    }


    // ==================================================
    // نام ثبت شده
    // ==================================================

    if (!receiverRegisteredName) {

        return showFieldError(
            "نام ثبت شده دریافت‌کننده را وارد کنید.",
            "receiverRegisteredName"
        );
    }


    // ==================================================
    // کد ملی دریافت‌کننده
    // ==================================================

    const cleanReceiverNationalCode =
        toEnglishDigits(
            receiverNationalCode
        );


    if (!cleanReceiverNationalCode) {

        return showFieldError(
            "کد ملی ثبت شده دریافت‌کننده را وارد کنید.",
            "receiverNationalCode"
        );
    }


    if (
        !/^\d{10}$/.test(
            cleanReceiverNationalCode
        )
    ) {

        return showFieldError(
            "کد ملی ثبت شده باید دقیقاً ۱۰ رقم باشد.",
            "receiverNationalCode"
        );
    }


    // ==================================================
    // سال مالی
    // ==================================================

    const cleanFiscalYear =
        toEnglishDigits(
            fiscalYear
        );


    if (
        !/^\d{4}$/.test(
            cleanFiscalYear
        )
    ) {

        return showFieldError(
            "سال مالی صحیح نیست.",
            "fiscalYear"
        );
    }


    // ==================================================
    // اطلاعات نهایی
    // ==================================================

    const data = {

        sendDate:
            toEnglishDigits(
                sendDate
            ),

        bank:
            bank,

        branchName:
            branchName,

        chequeNo:
            toEnglishDigits(
                chequeNo
            ),

        sayadi:
            toEnglishDigits(
                sayadi
            ),

        dueDate:
            toEnglishDigits(
                dueDate
            ),

        amount:
            cleanAmount
                ? Number(cleanAmount)
                : 0,

        accountOwner:
            accountOwner,

        accountOwnerNationalCode:
            cleanOwnerNationalCode,

        accountNumber:
            toEnglishDigits(
                accountNumber
            ),

        drawerName:
            drawerName,

        drawerPhone:
            cleanDrawerPhone,

        receiverName:
            receiverName,

        receiverRegisteredName:
            receiverRegisteredName,

        receiverNationalCode:
            cleanReceiverNationalCode,

        description:
            description,

        status:
            (window.__editingCheque && window.__editingCheque.status) || "notRegistered",

        registrationDate:
            (window.__editingCheque && window.__editingCheque.registration_date) || "",

        fiscalYear:
            cleanFiscalYear
    };


    // ==================================================
    // هشدار شماره چک تکراری
    // فقط برای ثبت چک جدید؛ ویرایش چک فعلی بدون این هشدار انجام می‌شود.
    // ==================================================

    if (!window.__editingCheque && chequeNo) {
        try {
            const duplicateRows = await pasargadCall('findChequeByNumber', chequeNo);
            if (Array.isArray(duplicateRows) && duplicateRows.length > 0) {
                const first = duplicateRows[0] || {};
                const yearText = first.fiscal_year ? `سال مالی ${toPersianDigits(first.fiscal_year)}` : "";
                const countText = duplicateRows.length > 1 ? `\nاین شماره قبلاً ${toPersianDigits(duplicateRows.length)} بار ثبت شده است.` : "";
                const duplicateMessage =
                    "شماره چک «" + toPersianDigits(chequeNo) + "» قبلاً ثبت شده است." +
                    (yearText ? "\n" + yearText : "") +
                    countText +
                    "\n\nآیا با ثبت چک جدید با همین شماره موافق هستید؟";

                let confirmed = false;
                if (window.parent && window.parent !== window && typeof window.parent.showChequeConfirm === "function") {
                    confirmed = await window.parent.showChequeConfirm("هشدار چک تکراری", duplicateMessage);
                } else {
                    confirmed = window.confirm(duplicateMessage);
                }
                if (!confirmed) return;
            }
        } catch (duplicateError) {
            console.error("Duplicate cheque number check error:", duplicateError);
            // در صورت خطا در بررسی، ثبت چک متوقف نمی‌شود.
        }
    }


    // ==================================================
    // ذخیره در دیتابیس
    // ==================================================

    try {

        let result;

        if (window.__editingCheque && window.__editingCheque.id) {
            result = await pasargadCall('updateCheque', {
                id: Number(window.__editingCheque.id),
                data: data
            });
        } else {
            result = await pasargadCall('addCheque', data);
        }


        if (
            result &&
            result.success
        ) {

            // بعد از ذخیره موفق، هیچ alert یا refresh سنگینی را قبل از بستن فرم اجرا نمی‌کنیم.
            // alert قبلی و refresh هم‌زمان می‌توانست مسیر UI فرم جدید را کند/قفل کند.
            showChequeSuccessMessage();
            if (window.parent && window.parent !== window && typeof window.parent.closeChequeFormOverlay === "function") {
                setTimeout(function () {
                    window.parent.closeChequeFormOverlay();
                    if (typeof window.parent.refreshChequeReport === "function") {
                        setTimeout(function () { try { window.parent.refreshChequeReport(); } catch (e) {} }, 0);
                    }
                }, 700);
            } else {
                setTimeout(function () { window.location.href = "index.html"; }, 700);
            }

            return;
        }


        alert(
            "خطا در ثبت چک:\n\n" +
            (
                result?.error ||
                "خطای نامشخص"
            )
        );


    } catch (error) {

        console.error(
            "Database error:",
            error
        );


        const dbError =
            error && error.message
                ? error.message
                : String(error || "خطای نامشخص");

        alert(
            "خطا در ثبت اطلاعات در دیتابیس:\n\n" +
            dbError
        );
    }
}


// ==================================================
// آماده‌سازی فرم برای ثبت چک جدید
// ==================================================
function resetChequeFormForNew() {
    window.__editingCheque = null;

    document.querySelectorAll('input, select, textarea').forEach(function (el) {
        if (el.id === 'fiscalYear') return;
        if (el.type === 'button' || el.type === 'submit' || el.type === 'hidden') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = false;
        } else {
            el.value = '';
        }
        el.disabled = false;
        el.readOnly = false;
        if (el.id === 'sendDate') {
            el.disabled = true;
            el.readOnly = true;
            el.tabIndex = -1;
        }
    });

    clearFieldErrors();

    const systemSendDate = document.getElementById('sendDate');
    if (systemSendDate) {
        systemSendDate.disabled = true;
        systemSendDate.readOnly = true;
        systemSendDate.tabIndex = -1;
        systemSendDate.value = '';
    }

    const title = document.querySelector('title');
    if (title) title.textContent = 'ثبت چک - پاسارگاد';

    document.querySelectorAll('button').forEach(function (btn) {
        if (btn.textContent.includes('ویرایش چک')) {
            btn.textContent = btn.textContent.replace('ویرایش چک', 'ثبت چک');
        }
    });

    const fiscal = document.getElementById('fiscalYear');
    if (fiscal && !fiscal.value) {
        fiscal.value = localStorage.getItem('pasargadFiscalYear') || '1405';
    }
}

window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'pasargad-reset-cheque-form') {
        resetChequeFormForNew();
    }
});

// ==================================================
// بارگذاری چک برای ویرایش
// ==================================================

function setEditField(id, value, digits) {
    const el = document.getElementById(id);
    if (!el) return;
    const text = value === null || value === undefined ? "" : String(value);
    el.value = digits ? toPersianDigits(text) : text;
}

async function loadChequeForEdit() {
    const params = new URLSearchParams(window.location.search);
    const editId = Number(params.get("editId"));
    if (!editId) return;

    try {
        // در حالت ویرایش، ابتدا از رکوردی که گزارش در حافظه دارد استفاده می‌کنیم.
        // در نتیجه باز شدن فرم منتظر دریافت کل لیست چک‌ها نمی‌ماند.
        let cheque = null;
        try {
            const cached = sessionStorage.getItem("pasargadEditingCheque");
            if (cached) {
                const parsed = JSON.parse(cached);
                if (parsed && Number(parsed.id) === editId) cheque = parsed;
            }
        } catch (_) {}

        if (!cheque) {
            const rows = await pasargadCall('getCheques');
            cheque = (Array.isArray(rows) ? rows : []).find(c => Number(c.id) === editId);
        }

        if (!cheque) {
            alert("چک مورد نظر پیدا نشد.");
            goBack();
            return;
        }

        window.__editingCheque = cheque;

        setEditField("sendDate", cheque.send_date, true);
        const editSendDate = document.getElementById("sendDate");
        if (editSendDate) {
            editSendDate.disabled = true;
            editSendDate.readOnly = true;
            editSendDate.tabIndex = -1;
        }
        setEditField("bank", cheque.bank);
        setEditField("branchName", cheque.branch_name);
        setEditField("chequeNo", cheque.cheque_no, true);
        setEditField("sayadi", cheque.sayadi, true);
        setEditField("dueDate", cheque.due_date, true);
        setEditField("amount", cheque.amount, true);
        setEditField("accountOwner", cheque.account_owner);
        setEditField("accountOwnerNationalCode", cheque.account_owner_national_code, true);
        setEditField("accountNumber", cheque.account_number, true);
        setEditField("drawerName", cheque.drawer_name);
        setEditField("drawerPhone", cheque.drawer_phone, true);
        setEditField("receiverName", cheque.receiver_name);
        setEditField("receiverRegisteredName", cheque.receiver_registered_name);
        setEditField("receiverNationalCode", cheque.receiver_national_code, true);
        setEditField("description", cheque.description);
        setEditField("fiscalYear", cheque.fiscal_year || "1405");

        const title = document.querySelector("title");
        if (title) title.textContent = "ویرایش چک - پاسارگاد";
        document.querySelectorAll("button").forEach(btn => {
            if (btn.textContent.includes("ثبت چک")) btn.textContent = btn.textContent.replace("ثبت چک", "ویرایش چک");
        });
    } catch (error) {
        console.error("Load edit error:", error);
        alert("خطایی در دریافت اطلاعات چک رخ داد.");
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const params = new URLSearchParams(window.location.search);
    const isNewCheque = params.get("new") === "1";

    if (isNewCheque) {
        // New-cheque mode must always start with a completely clean form.
        resetChequeFormForNew();
        return;
    }

    loadChequeForEdit();
});


// ==================================================
// بازگشت
// ==================================================

function goBack() {

    if (window.parent && window.parent !== window && typeof window.parent.closeChequeFormOverlay === "function") {
        window.parent.closeChequeFormOverlay();
    } else {
        window.location.href = "index.html";
    }
}