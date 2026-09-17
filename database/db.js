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

            db.run(`
                CREATE TABLE IF NOT EXISTS customers (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    mobile TEXT,
                    phone TEXT,
                    address TEXT,
                    notes TEXT,
                    fiscal_year TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS customer_contacts (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    contact_date TEXT,
                    contact_type TEXT,
                    subject TEXT,
                    notes TEXT,
                    follow_up_date TEXT,
                    follow_up_text TEXT,
                    follow_up_done INTEGER DEFAULT 0,
                    fiscal_year TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
                )
            `);

            db.run(`
                CREATE TABLE IF NOT EXISTS send_control_records (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id INTEGER NOT NULL,
                    customer_name TEXT NOT NULL,
                    invoice_date TEXT,
                    invoice_no TEXT,
                    document_type TEXT,
                    send_date TEXT,
                    status TEXT DEFAULT 'not-sent',
                    fiscal_year TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
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
                    // سال مالی اطلاعات مدیریت مشتریان
                    // --------------------------------------

                    function ensureCustomerFiscalYear() {
                        db.all(`PRAGMA table_info(customers)`, [], (customerInfoError, customerColumns) => {
                            if (customerInfoError) { reject(customerInfoError); return; }
                            const hasCustomerFiscalYear = (customerColumns || []).some(c => c.name === 'fiscal_year');
                            const ensureContacts = () => {
                                db.all(`PRAGMA table_info(customer_contacts)`, [], (contactInfoError, contactColumns) => {
                                    if (contactInfoError) { reject(contactInfoError); return; }
                                    const hasContactFiscalYear = (contactColumns || []).some(c => c.name === 'fiscal_year');
                                    const finish = () => {
                                        db.run(`UPDATE customer_contacts SET fiscal_year = (SELECT fiscal_year FROM customers WHERE customers.id = customer_contacts.customer_id) WHERE fiscal_year IS NULL OR fiscal_year = ''`, err => {
                                            if (err) { reject(err); return; }
                                            resolve();
                                        });
                                    };
                                    if (hasContactFiscalYear) { finish(); return; }
                                    db.run(`ALTER TABLE customer_contacts ADD COLUMN fiscal_year TEXT`, err => {
                                        if (err) { reject(err); return; }
                                        finish();
                                    });
                                });
                            };
                            if (hasCustomerFiscalYear) {
                                db.run(`UPDATE customers SET fiscal_year = '1405' WHERE fiscal_year IS NULL OR fiscal_year = ''`, err => {
                                    if (err) { reject(err); return; }
                                    ensureContacts();
                                });
                                return;
                            }
                            db.run(`ALTER TABLE customers ADD COLUMN fiscal_year TEXT`, err => {
                                if (err) { reject(err); return; }
                                db.run(`UPDATE customers SET fiscal_year = '1405' WHERE fiscal_year IS NULL OR fiscal_year = ''`, err2 => {
                                    if (err2) { reject(err2); return; }
                                    ensureContacts();
                                });
                            });
                        });
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
                                        const afterChequeYears = () => ensureCustomerFiscalYear();
                                        if (!pending) { afterChequeYears(); return; }
                                        rows.forEach(row => {
                                            db.run(`INSERT OR IGNORE INTO fiscal_years (year) VALUES (?)`, [String(row.fiscal_year)], err => {
                                                if (err) { reject(err); return; }
                                                pending--;
                                                if (pending === 0) afterChequeYears();
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
            db.run(`DELETE FROM fiscal_years WHERE year = ?`, [value], function(error) {
                if (error) { reject(error); return; }
                resolve({ success: true, changes: this.changes, year: value });
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
            const chequeChanges = this.changes;
            db.run(`DELETE FROM send_control_records WHERE fiscal_year = ?`, [value], function(sendError) {
                if (sendError) { reject(sendError); return; }
                resolve({ success: true, changes: chequeChanges, sendControlChanges: this.changes, year: value });
            });
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

function getCurrentJalaliDateTime() {
    const now = new Date();
    const dateParts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
        year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    const map = {};
    for (const part of dateParts) {
        if (part.type !== "literal") map[part.type] = part.value;
    }
    const time = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit", minute: "2-digit", hour12: false
    }).format(now);
    return `${map.year}/${map.month}/${map.day} - ${time}`;
}

async function addCheque(data) {

    await databaseReady;

    // تاریخ ارسال برای ثبت، زمان ذخیره شدن چک در دیتابیس است.
    // مقدار ارسالی فرم برای این فیلد نادیده گرفته می‌شود تا تاریخ کاملاً خودکار باشد.
    const automaticSendDate = getCurrentJalaliDateTime();


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

async function findChequeByNumber(chequeNo) {

    await databaseReady;

    const value = String(chequeNo || "").trim();
    if (!value) return [];

    return new Promise((resolve, reject) => {
        db.all(
            `SELECT id, cheque_no, fiscal_year, drawer_name, receiver_name, status
             FROM cheques
             WHERE cheque_no = ?
             ORDER BY id DESC`,
            [value],
            (error, rows) => {
                if (error) {
                    console.error("خطا در بررسی شماره چک تکراری:", error);
                    reject(error);
                    return;
                }
                resolve(rows || []);
            }
        );
    });
}


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
    status
) {

    await databaseReady;


    return new Promise(
        (resolve, reject) => {

            db.run(
                `
                    UPDATE cheques

                    SET
                        status = ?

                    WHERE id = ?
                `,
                [
                    status,
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



async function restoreDatabase(sourcePath) {
    await databaseReady;
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(sourcePath)) return reject(new Error("فایل پشتیبان پیدا نشد."));
        const tempPath = dbPath + ".restore-temp";
        try {
            fs.copyFileSync(sourcePath, tempPath);
            // اعتبارسنجی فایل پشتیبان قبل از جایگزینی
            const checkDb = new sqlite3.Database(tempPath, sqlite3.OPEN_READONLY, (openErr) => {
                if (openErr) {
                    try { fs.unlinkSync(tempPath); } catch (e) {}
                    return reject(openErr);
                }
                checkDb.get("PRAGMA integrity_check", (err, row) => {
                    checkDb.close(() => {
                        if (err || !row || String(row.integrity_check).toLowerCase() !== "ok") {
                            try { fs.unlinkSync(tempPath); } catch (e) {}
                            return reject(err || new Error("فایل پشتیبان سالم نیست."));
                        }
                        db.close((closeErr) => {
                            if (closeErr) {
                                try { fs.unlinkSync(tempPath); } catch (e) {}
                                return reject(closeErr);
                            }
                            try {
                                fs.copyFileSync(tempPath, dbPath);
                                fs.unlinkSync(tempPath);
                                resolve({ success: true });
                            } catch (copyErr) {
                                try { fs.unlinkSync(tempPath); } catch (e) {}
                                reject(copyErr);
                            }
                        });
                    });
                });
            });
        } catch (e) {
            try { fs.unlinkSync(tempPath); } catch (x) {}
            reject(e);
        }
    });
}

async function backupDatabase(destinationPath) {
    await databaseReady;
    return new Promise((resolve, reject) => {
        try {
            db.backup(destinationPath, (error) => {
                if (error) { reject(error); return; }
                resolve({ success: true, path: destinationPath });
            });
        } catch (error) {
            reject(error);
        }
    });
}

// ==================================================
// مدیریت مشتریان - مستقل از منطق ثبت چک
// ==================================================
async function getCustomers(data){
 await databaseReady; const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,'');
 return new Promise((resolve,reject)=>db.all(`SELECT c.id,c.name,c.mobile,c.phone,c.address,c.notes,COALESCE((SELECT contact_date FROM customer_contacts cc WHERE cc.customer_id=c.id AND cc.fiscal_year=? ORDER BY cc.id DESC LIMIT 1),'') AS last_contact FROM customers c WHERE c.fiscal_year=? ORDER BY c.id DESC`,[fiscalYear,fiscalYear],(e,rows)=>e?reject(e):resolve({success:true,customers:rows||[]})));
}
function normalizeCustomerName(v){return String(v||'').trim().replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/‌/g,' ').replace(/\s+/g,' ').toLowerCase();}
function normalizeCustomerNumber(v){return String(v||'').replace(/[۰-۹]/g,d=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))).replace(/\D/g,'');}
async function findDuplicateCustomer(data, excludeId){
 const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,'');
 const name=normalizeCustomerName(data?.name);
 const mobile=normalizeCustomerNumber(data?.mobile);
 const phone=normalizeCustomerNumber(data?.phone);
 return new Promise((resolve,reject)=>db.all(`SELECT id,name,mobile,phone FROM customers WHERE fiscal_year=?`,[fiscalYear],(e,rows)=>{
   if(e)return reject(e);
   const dup=(rows||[]).find(r=>Number(r.id)!==Number(excludeId||0) && (
      (name && normalizeCustomerName(r.name)===name) ||
      (mobile && normalizeCustomerNumber(r.mobile)===mobile) ||
      (phone && normalizeCustomerNumber(r.phone)===phone)
   ));
   resolve(dup||null);
 }));
}
async function addCustomer(data){
 await databaseReady; const name=String(data?.name||'').trim(); const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,''); if(!name)return {success:false,error:'نام مشتری الزامی است.'};
 const duplicate=await findDuplicateCustomer({...data,fiscalYear});
 if(duplicate){
   if(normalizeCustomerName(duplicate.name)===normalizeCustomerName(name)) return {success:false,error:'مشتری با این نام و نام خانوادگی قبلاً ثبت شده است.'};
   if(normalizeCustomerNumber(duplicate.mobile) && normalizeCustomerNumber(data?.mobile)===normalizeCustomerNumber(duplicate.mobile)) return {success:false,error:'این شماره موبایل قبلاً برای مشتری دیگری ثبت شده است.'};
   if(normalizeCustomerNumber(duplicate.phone) && normalizeCustomerNumber(data?.phone)===normalizeCustomerNumber(duplicate.phone)) return {success:false,error:'این شماره تلفن قبلاً برای مشتری دیگری ثبت شده است.'};
   return {success:false,error:'اطلاعات مشتری تکراری است.'};
 }
 return new Promise((resolve,reject)=>db.run(`INSERT INTO customers(name,mobile,phone,address,notes,fiscal_year) VALUES(?,?,?,?,?,?)`,[name,String(data.mobile||'').trim(),String(data.phone||'').trim(),String(data.address||'').trim(),String(data.notes||'').trim(),fiscalYear],function(err){err?reject(err):resolve({success:true,id:this.lastID})}));
}
async function updateCustomer(data){
 await databaseReady; const id=Number(data?.id),name=String(data?.name||'').trim(); const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,''); if(!id||!name)return {success:false,error:'اطلاعات مشتری کامل نیست.'};
 const duplicate=await findDuplicateCustomer({...data,fiscalYear},id);
 if(duplicate){
   if(normalizeCustomerName(duplicate.name)===normalizeCustomerName(name)) return {success:false,error:'مشتری دیگری با این نام و نام خانوادگی قبلاً ثبت شده است.'};
   if(normalizeCustomerNumber(duplicate.mobile) && normalizeCustomerNumber(data?.mobile)===normalizeCustomerNumber(duplicate.mobile)) return {success:false,error:'این شماره موبایل قبلاً برای مشتری دیگری ثبت شده است.'};
   if(normalizeCustomerNumber(duplicate.phone) && normalizeCustomerNumber(data?.phone)===normalizeCustomerNumber(duplicate.phone)) return {success:false,error:'این شماره تلفن قبلاً برای مشتری دیگری ثبت شده است.'};
   return {success:false,error:'اطلاعات مشتری تکراری است.'};
 }
 return new Promise((resolve,reject)=>db.run(`UPDATE customers SET name=?,mobile=?,phone=?,address=?,notes=? WHERE id=? AND fiscal_year=?`,[name,String(data.mobile||'').trim(),String(data.phone||'').trim(),String(data.address||'').trim(),String(data.notes||'').trim(),id,fiscalYear],function(err){err?reject(err):resolve({success:this.changes>0})}));
}
async function deleteCustomer(data){
 await databaseReady; const n=Number(data?.id ?? data); const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,''); if(!n)return {success:false,error:'شناسه مشتری نامعتبر است.'};
 return new Promise((resolve,reject)=>db.serialize(()=>{db.run(`DELETE FROM customer_contacts WHERE customer_id=? AND fiscal_year=?`,[n,fiscalYear],e=>{if(e)return reject(e);db.run(`DELETE FROM customers WHERE id=? AND fiscal_year=?`,[n,fiscalYear],function(err){err?reject(err):resolve({success:this.changes>0})})})}));
}
async function getCustomerProfile(data){
 await databaseReady; const n=Number(data?.id ?? data); const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,''); if(!n)return {success:false,error:'شناسه مشتری نامعتبر است.'};
 return new Promise((resolve,reject)=>db.get(`SELECT id,name,mobile,phone,address,notes FROM customers WHERE id=? AND fiscal_year=?`,[n,fiscalYear],(e,customer)=>{if(e)return reject(e);if(!customer)return resolve({success:false,error:'مشتری پیدا نشد.'});db.all(`SELECT id,contact_date,contact_type,subject,notes,follow_up_date,follow_up_text,follow_up_done AS done FROM customer_contacts WHERE customer_id=? AND fiscal_year=? ORDER BY id DESC`,[n,fiscalYear],(e2,contacts)=>{if(e2)return reject(e2);resolve({success:true,customer,contacts:contacts||[],followUps:(contacts||[]).filter(x=>x.follow_up_date)})})}));
}
async function getCustomerFollowUps(data){
 await databaseReady; const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,'');
 return new Promise((resolve,reject)=>db.all(`SELECT cc.id,cc.customer_id,c.name AS customer_name,cc.follow_up_date,cc.follow_up_text FROM customer_contacts cc INNER JOIN customers c ON c.id=cc.customer_id WHERE cc.fiscal_year=? AND c.fiscal_year=? AND COALESCE(cc.follow_up_date,'')<>'' AND COALESCE(cc.follow_up_done,0)=0 ORDER BY cc.follow_up_date ASC, cc.id ASC`,[fiscalYear,fiscalYear],(e,rows)=>e?reject(e):resolve({success:true,followUps:rows||[]})));
}
async function addCustomerContact(data){
 await databaseReady; const customerId=Number(data?.customerId); const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,''); if(!customerId)return {success:false,error:'مشتری نامعتبر است.'};
 return new Promise((resolve,reject)=>db.run(`INSERT INTO customer_contacts(customer_id,contact_date,contact_type,subject,notes,follow_up_date,follow_up_text,fiscal_year) VALUES(?,?,?,?,?,?,?,?)`,[customerId,String(data.contactDate||'').trim(),String(data.contactType||'').trim(),String(data.subject||'').trim(),String(data.notes||'').trim(),String(data.followUpDate||'').trim(),String(data.followUpText||'').trim(),fiscalYear],function(e){e?reject(e):resolve({success:true,id:this.lastID})}));
}


async function getSendControlRecords(data){
    await databaseReady;
    const fiscalYear = String(data?.fiscalYear || '1405').replace(/[^0-9]/g,'');
    const customerId = data?.customerId ? Number(data.customerId) : null;
    return new Promise((resolve,reject)=>{
        let sql = `SELECT id, customer_id AS customerId, customer_name AS customerName, invoice_date AS invoiceDate, invoice_no AS invoiceNo, document_type AS documentType, send_date AS sendDate, status, fiscal_year AS fiscalYear, created_at AS createdAt FROM send_control_records WHERE fiscal_year = ?`;
        const params=[fiscalYear];
        if(customerId){ sql += ` AND customer_id = ?`; params.push(customerId); }
        sql += ` ORDER BY id DESC`;
        db.all(sql,params,(e,rows)=>e?reject(e):resolve({success:true,records:rows||[]}));
    });
}

async function addSendControlRecord(data){
    await databaseReady;
    const customerId=Number(data?.customerId);
    const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,'');
    const customerName=String(data?.customerName||'').trim();
    if(!customerId||!customerName)return {success:false,error:'مشتری نامعتبر است.'};
    return new Promise((resolve,reject)=>db.run(`INSERT INTO send_control_records (customer_id,customer_name,invoice_date,invoice_no,document_type,send_date,status,fiscal_year) VALUES (?,?,?,?,?,?,?,?)`,[customerId,customerName,String(data?.invoiceDate||'').trim(),String(data?.invoiceNo||'').trim(),String(data?.documentType||'').trim(),String(data?.sendDate||'').trim(),String(data?.status||'not-sent'),fiscalYear],function(e){e?reject(e):resolve({success:true,id:this.lastID})}));
}

async function updateSendControlCustomerName(data){
    await databaseReady;
    const customerId=Number(data?.customerId);
    const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,'');
    const customerName=String(data?.customerName||'').trim();
    if(!customerId||!customerName)return {success:false,error:'اطلاعات مشتری نامعتبر است.'};
    return new Promise((resolve,reject)=>db.run(`UPDATE send_control_records SET customer_name=? WHERE customer_id=? AND fiscal_year=?`,[customerName,customerId,fiscalYear],function(e){e?reject(e):resolve({success:true,changes:this.changes})}));
}

async function updateSendControlStatus(data){
    await databaseReady;
    const id=Number(data?.id);
    const fiscalYear=String(data?.fiscalYear||'1405').replace(/[^0-9]/g,'');
    if(!id)return {success:false,error:'شناسه رکورد نامعتبر است.'};
    return new Promise((resolve,reject)=>db.run(`UPDATE send_control_records SET status=?, send_date=? WHERE id=? AND fiscal_year=?`,[String(data?.status||'sent'),String(data?.sendDate||'').trim(),id,fiscalYear],function(e){e?reject(e):resolve({success:this.changes>0})}));
}

async function updateCustomerFollowUp(data){
    await databaseReady;
    const contactId = Number(data?.contactId);
    const done = data?.done ? 1 : 0;
    if (!contactId) return { success:false, error:'شناسه پیگیری نامعتبر است.' };

    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE customer_contacts SET follow_up_done = ? WHERE id = ? AND fiscal_year = ?`,
            [done, contactId, String(data?.fiscalYear||'1405').replace(/[^0-9]/g,'')],
            function(error){
                if (error) { reject(error); return; }
                resolve({ success: this.changes > 0 });
            }
        );
    });
}

// ==================================================

module.exports = {

    addCheque,
    getCustomers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    getCustomerProfile,
    getCustomerFollowUps,
    addCustomerContact,
    updateCustomerFollowUp,
    getSendControlRecords,
    addSendControlRecord,
    updateSendControlStatus,
    updateSendControlCustomerName,

    getCheques,
    findChequeByNumber,

    getFiscalYears,
    createFiscalYear,
    deleteFiscalYear,
    clearFiscalYear,

    updateCheque,

    deleteCheque,

    updateChequeStatus,
    backupDatabase,
    restoreDatabase

};