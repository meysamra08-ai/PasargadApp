const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const databaseFolder = __dirname;

if (!fs.existsSync(databaseFolder)) {
    fs.mkdirSync(databaseFolder, {
        recursive: true
    });
}

const dbPath = path.join(
    databaseFolder,
    "pasargad.db"
);

const db = new sqlite3.Database(dbPath);

// جلوگیری از خطای SQLITE_BUSY هنگام نوشتن هم‌زمان و پایدارتر شدن اتصال
db.configure("busyTimeout", 5000);


// ==================================================
// آماده سازی کامل دیتابیس
// ==================================================

const databaseReady = new Promise(
    (resolve, reject) => {

        db.serialize(() => {

            // ------------------------------------------
            // ساخت جدول در صورت نبودن
            // ------------------------------------------

            db.run(`
                CREATE TABLE IF NOT EXISTS fiscal_years (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    year TEXT UNIQUE NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS cheques (

                    id INTEGER PRIMARY KEY AUTOINCREMENT,

                    send_date TEXT,

                    bank TEXT,

                    branch_name TEXT,

                    branch_code TEXT,

                    cheque_no TEXT,

                    sayadi TEXT,

                    due_date TEXT,

                    amount INTEGER,

                    account_owner TEXT,

                    account_owner_national_code TEXT,

                    account_number TEXT,

                    drawer_name TEXT,

                    drawer_phone TEXT,

                    receiver_name TEXT,

                    receiver_registered_name TEXT,

                    receiver_national_code TEXT,

                    description TEXT,

                    status TEXT DEFAULT 'notRegistered',

                    registration_date TEXT,

                    fiscal_year TEXT,

                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // ------------------------------------------
            // بررسی ساختار فعلی دیتابیس
            // ------------------------------------------

            db.all(
                `PRAGMA table_info(cheques)`,
                [],
                (error, columns) => {

                    if (error) {

                        reject(error);

                        return;
                    }

                    const existingColumns =
                        columns.map(
                            column => column.name
                        );


                    // --------------------------------------
                    // ستون‌هایی که باید وجود داشته باشند
                    // --------------------------------------

                    const requiredColumns = [

                        ["branch_name", "TEXT"],

                        ["branch_code", "TEXT"],

                        ["account_owner", "TEXT"],

                        [
                            "account_owner_national_code",
                            "TEXT"
                        ],

                        ["account_number", "TEXT"],

                        ["drawer_name", "TEXT"],

                        ["drawer_phone", "TEXT"],

                        ["receiver_name", "TEXT"],

                        [
                            "receiver_registered_name",
                            "TEXT"
                        ],

                        [
                            "receiver_national_code",
                            "TEXT"
                        ],

                        ["registration_date", "TEXT"],

                        ["fiscal_year", "TEXT"]
                    ];


                    const columnsToAdd =
                        requiredColumns.filter(
                            ([name]) =>
                                !existingColumns.includes(
                                    name
                                )
                        );


                    // --------------------------------------
                    // اگر ستونی نیاز به اضافه شدن دارد
                    // --------------------------------------

                    let remaining =
                        columnsToAdd.length;


                    if (remaining === 0) {

                        migrateOldData();

                        return;
                    }


                    columnsToAdd.forEach(
                        ([name, type]) => {

                            db.run(
                                `
                                    ALTER TABLE cheques
                                    ADD COLUMN ${name} ${type}
                                `,
                                error => {

                                    if (error) {

                                        reject(error);

                                        return;
                                    }


                                    remaining--;


                                    if (
                                        remaining === 0
                                    ) {

                                        migrateOldData();
                                    }
                                }
                            );
                        }
                    );


                    // --------------------------------------
                    // انتقال اطلاعات دیتابیس قدیمی
                    // --------------------------------------

                    function migrateOldData() {

                        const tasks = [];


                        // صاحب چک قدیمی
                        if (
                            existingColumns.includes(
                                "owner"
                            )
                        ) {

                            tasks.push(`
                                UPDATE cheques
                                SET account_owner = owner
                                WHERE
                                    (
                                        account_owner IS NULL
                                        OR account_owner = ''
                                    )
                                    AND owner IS NOT NULL
                                    AND owner != ''
                            `);
                        }


                        // کد ملی قدیمی
                        if (
                            existingColumns.includes(
                                "national_code"
                            )
                        ) {

                            tasks.push(`
                                UPDATE cheques
                                SET
                                    account_owner_national_code =
                                        national_code
                                WHERE
                                    (
                                        account_owner_national_code IS NULL
                                        OR account_owner_national_code = ''
                                    )
                                    AND national_code IS NOT NULL
                                    AND national_code != ''
                            `);
                        }


                        // واگذار شده قدیمی
                        if (
                            existingColumns.includes(
                                "assign_to"
                            )
                        ) {

                            tasks.push(`
                                UPDATE cheques
                                SET receiver_name = assign_to
                                WHERE
                                    (
                                        receiver_name IS NULL
                                        OR receiver_name = ''
                                    )
                                    AND assign_to IS NOT NULL
                                    AND assign_to != ''
                            `);
                        }


                        // نام ثبت شده قدیمی
                        if (
                            existingColumns.includes(
                                "registered_name"
                            )
                        ) {

                            tasks.push(`
                                UPDATE cheques
                                SET
                                    receiver_registered_name =
                                        registered_name
                                WHERE
                                    (
                                        receiver_registered_name IS NULL
                                        OR receiver_registered_name = ''
                                    )
                                    AND registered_name IS NOT NULL
                                    AND registered_name != ''
                            `);
                        }


                        // تلفن قدیمی
                        if (
                            existingColumns.includes(
                                "owner_phone"
                            )
                        ) {

                            tasks.push(`
                                UPDATE cheques
                                SET drawer_phone = owner_phone
                                WHERE
                                    (
                                        drawer_phone IS NULL
                                        OR drawer_phone = ''
                                    )
                                    AND owner_phone IS NOT NULL
                                    AND owner_phone != ''
                            `);
                        }


                        // ----------------------------------
                        // اجرای انتقال‌ها
                        // ----------------------------------

                        let index = 0;


                        function nextTask() {

                            if (
                                index >=
                                tasks.length
                            ) {

                                setFiscalYear();

                                return;
                            }


                            db.run(
                                tasks[index],
                                error => {

                                    if (error) {

                                        reject(error);

                                        return;
                                    }


                                    index++;

                                    nextTask();
                                }
                            );
                        }


                        nextTask();
                    }


                    // --------------------------------------
                    // سال مالی رکوردهای قدیمی
                    // --------------------------------------

                    function setFiscalYear() {

                        db.run(
                            `
                                UPDATE cheques

                                SET fiscal_year = '1405'

                                WHERE
                                    fiscal_year IS NULL
                                    OR fiscal_year = ''
                            `,
                            error => {

                                if (error) {

                                    reject(error);

                                    return;
                                }


                                db.run(`INSERT OR IGNORE INTO fiscal_years (year) VALUES ('1405')`, error2 => {
                                    if (error2) { reject(error2); return; }
                                    db.all(`SELECT DISTINCT fiscal_year FROM cheques WHERE fiscal_year IS NOT NULL AND fiscal_year != ''`, [], (error3, rows) => {
                                        if (error3) { reject(error3); return; }
                                        let pending = rows.length;
                                        if (!pending) { resolve(); return; }
                                        rows.forEach(row => {
                                            db.run(`INSERT OR IGNORE INTO fiscal_years (year) VALUES (?)`, [String(row.fiscal_year)], err => {
                                                if (err) { reject(err); return; }
                                                pending--;
                                                if (pending === 0) resolve();
                                            });
                                        });
                                    });
                                });
                            }
                        );
                    }
                }
            );
        });
    }
);


// ==================================================
// مدیریت سال مالی
// ==================================================

async function getFiscalYears() {
    await databaseReady;
    return new Promise((resolve, reject) => {
        db.all(`SELECT year FROM fiscal_years ORDER BY CAST(year AS INTEGER) ASC`, [], (error, rows) => {
            if (error) { reject(error); return; }
            resolve(rows.map(r => String(r.year)));
        });
    });
}

async function createFiscalYear(year) {
    await databaseReady;
    const value = String(year || '').replace(/[^0-9]/g, '');
    if (!/^\d{4}$/.test(value)) throw Object.assign(new Error('INVALID_FISCAL_YEAR'), { code: 'INVALID_FISCAL_YEAR' });
    return new Promise((resolve, reject) => {
        db.run(`INSERT INTO fiscal_years (year) VALUES (?)`, [value], function(error) {
            if (error) {
                if (String(error.message || '').includes('UNIQUE')) {
                    reject(Object.assign(new Error('FISCAL_YEAR_EXISTS'), { code: 'FISCAL_YEAR_EXISTS' }));
                    return;
                }
                reject(error); return;
            }
            resolve({ success: true, year: value, id: this.lastID });
        });
    });
}

async function deleteFiscalYear(year) {
    await databaseReady;
    const value = String(year || '').replace(/[^0-9]/g, '');
    return new Promise((resolve, reject) => {
        db.get(`SELECT COUNT(*) AS count FROM cheques WHERE fiscal_year = ?`, [value], (countError, row) => {
            if (countError) { reject(countError); return; }
            if (Number(row.count) > 0) {
                reject(Object.assign(new Error('FISCAL_YEAR_HAS_DATA'), { code: 'FISCAL_YEAR_HAS_DATA', count: Number(row.count) }));
                return;
            }
            db.get(`SELECT COUNT(*) AS count FROM fiscal_years`, [], (yearsError, yearsRow) => {
                if (yearsError) { reject(yearsError); return; }
                if (Number(yearsRow.count) <= 1) {
                    reject(Object.assign(new Error('CANNOT_DELETE_LAST_FISCAL_YEAR'), { code: 'CANNOT_DELETE_LAST_FISCAL_YEAR' }));
                    return;
                }
                db.run(`DELETE FROM fiscal_years WHERE year = ?`, [value], function(error) {
                    if (error) { reject(error); return; }
                    resolve({ success: true, changes: this.changes, year: value });
                });
            });
        });
    });
}

async function clearFiscalYear(year) {
    await databaseReady;
    const value = String(year || '').replace(/[^0-9]/g, '');
    return new Promise((resolve, reject) => {
        db.run(`DELETE FROM cheques WHERE fiscal_year = ?`, [value], function(error) {
            if (error) { reject(error); return; }
            resolve({ success: true, changes: this.changes, year: value });
        });
    });
}


// ==================================================
// ثبت چک
// ==================================================

function getTodayJalali() {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
        year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(new Date());
    const map = {};
    for (const part of parts) {
        if (part.type !== "literal") map[part.type] = part.value;
    }
    return `${map.year}/${map.month}/${map.day}`;
}

async function addCheque(data) {

    await databaseReady;

    // تاریخ ارسال برای ثبت، زمان ذخیره شدن چک در دیتابیس است.
    // مقدار ارسالی فرم برای این فیلد نادیده گرفته می‌شود تا تاریخ کاملاً خودکار باشد.
    const automaticSendDate = getTodayJalali();


    return new Promise(
        (resolve, reject) => {

            const sql = `

                INSERT INTO cheques (

                    send_date,

                    bank,

                    branch_name,

                    branch_code,

                    cheque_no,

                    sayadi,

                    due_date,

                    amount,

                    account_owner,

                    account_owner_national_code,

                    account_number,

                    drawer_name,

                    drawer_phone,

                    receiver_name,

                    receiver_registered_name,

                    receiver_national_code,

                    description,

                    status,

                    registration_date,

                    fiscal_year

                )

                VALUES (

                    ?, ?, ?, ?, ?,

                    ?, ?, ?,

                    ?, ?, ?,

                    ?, ?,

                    ?, ?, ?,

                    ?,

                    ?, ?, ?

                )
            `;


            const values = [

                automaticSendDate,

                data.bank || "",

                data.branchName || "",

                data.branchCode || "",

                data.chequeNo || "",

                data.sayadi || "",

                data.dueDate || "",

                Number(data.amount) || 0,

                data.accountOwner || "",

                data.accountOwnerNationalCode || "",

                data.accountNumber || "",

                data.drawerName || "",

                data.drawerPhone || "",

                data.receiverName || "",

                data.receiverRegisteredName || "",

                data.receiverNationalCode || "",

                data.description || "",

                data.status || "notRegistered",

                data.registrationDate || "",

                data.fiscalYear || "1405"
            ];


            db.run(
                sql,
                values,
                function (error) {

                    if (error) {

                        console.error(
                            "خطا در ثبت چک:",
                            error
                        );

                        reject(error);

                        return;
                    }


                    resolve({

                        success: true,

                        id: this.lastID
                    });
                }
            );
        }
    );
}


// ==================================================
// ویرایش چک
// ==================================================

async function updateCheque(id, data) {

    await databaseReady;

    return new Promise((resolve, reject) => {

        const sql = `
            UPDATE cheques SET
                send_date = ?,
                bank = ?,
                branch_name = ?,
                branch_code = ?,
                cheque_no = ?,
                sayadi = ?,
                due_date = ?,
                amount = ?,
                account_owner = ?,
                account_owner_national_code = ?,
                account_number = ?,
                drawer_name = ?,
                drawer_phone = ?,
                receiver_name = ?,
                receiver_registered_name = ?,
                receiver_national_code = ?,
                description = ?,
                status = ?,
                registration_date = ?,
                fiscal_year = ?
            WHERE id = ?
        `;

        const values = [
            data.sendDate || "",
            data.bank || "",
            data.branchName || "",
            data.branchCode || "",
            data.chequeNo || "",
            data.sayadi || "",
            data.dueDate || "",
            Number(data.amount) || 0,
            data.accountOwner || "",
            data.accountOwnerNationalCode || "",
            data.accountNumber || "",
            data.drawerName || "",
            data.drawerPhone || "",
            data.receiverName || "",
            data.receiverRegisteredName || "",
            data.receiverNationalCode || "",
            data.description || "",
            data.status || "notRegistered",
            data.registrationDate || "",
            data.fiscalYear || "1405",
            id
        ];

        db.run(sql, values, function(error) {
            if (error) {
                console.error("خطا در ویرایش چک:", error);
                reject(error);
                return;
            }
            resolve({ success: true, changes: this.changes });
        });
    });
}


// ==================================================
// حذف چک
// ==================================================

async function deleteCheque(id) {

    await databaseReady;

    return new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM cheques WHERE id = ?`,
            [id],
            function(error) {
                if (error) {
                    console.error("خطا در حذف چک:", error);
                    reject(error);
                    return;
                }
                resolve({ success: true, changes: this.changes });
            }
        );
    });
}


// ==================================================
// دریافت چک‌ها
// ==================================================

async function getCheques() {

    await databaseReady;


    return new Promise(
        (resolve, reject) => {

            db.all(
                `
                    SELECT *
                    FROM cheques
                    ORDER BY id DESC
                `,
                [],
                (error, rows) => {

                    if (error) {

                        console.error(
                            "خطا در دریافت چک‌ها:",
                            error
                        );

                        reject(error);

                        return;
                    }


                    resolve(rows);
                }
            );
        }
    );
}


// ==================================================
// تغییر وضعیت چک
// ==================================================

async function updateChequeStatus(
    id,
    status,
    registrationDate
) {

    await databaseReady;


    return new Promise(
        (resolve, reject) => {

            db.run(
                `
                    UPDATE cheques

                    SET
                        status = ?,
                        registration_date = ?

                    WHERE id = ?
                `,
                [
                    status,
                    registrationDate || "",
                    id
                ],
                function (error) {

                    if (error) {

                        console.error(
                            "خطا در تغییر وضعیت:",
                            error
                        );

                        reject(error);

                        return;
                    }


                    resolve({

                        success: true,

                        changes:
                            this.changes
                    });
                }
            );
        }
    );
}


// ==================================================

module.exports = {

    addCheque,

    getCheques,

    getFiscalYears,
    createFiscalYear,
    deleteFiscalYear,
    clearFiscalYear,

    updateCheque,

    deleteCheque,

    updateChequeStatus

};