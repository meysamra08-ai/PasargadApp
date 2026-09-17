const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} = require("electron");

const path = require("path");
const fs = require("fs");

const database =
    require("./database/db");


function createWindow() {

    const win = new BrowserWindow({

        width: 1200,

        height: 800,

        minWidth: 900,

        minHeight: 650,

        autoHideMenuBar: true,

        webPreferences: {

            preload:
                path.join(__dirname, "preload.js"),

            contextIsolation: true,

            nodeIntegration: false

        }

    });


    win.loadFile("index.html");

    win.on("close", (event) => {
        if (allowWindowClose) return;
        event.preventDefault();
        win.webContents.send("request-backup-before-exit");
    });

}


/* =========================
   ثبت چک
========================= */

ipcMain.handle(
    "add-cheque",
    async (event, data) => {

        try {

            const result = await database.addCheque(data);
            if (result && result.success) scheduleAutoBackup();
            return result;

        } catch (error) {

            console.error(error);

            return {
                success: false,
                error: error && error.message ? error.message : String(error)
            };

        }

    }
);


/* =========================
   ویرایش چک
========================= */

ipcMain.handle(
    "update-cheque",
    async (event, payload) => {
        try {
            const result = await database.updateCheque(payload.id, payload.data);
            if (result && result.success) scheduleAutoBackup();
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
);


/* =========================
   حذف چک
========================= */

ipcMain.handle(
    "delete-cheque",
    async (event, id) => {
        try {
            const result = await database.deleteCheque(id);
            if (result && result.success) scheduleAutoBackup();
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
);


/* =========================
   ثبت وضعیت چک
========================= */

ipcMain.handle(
    "update-cheque-status",
    async (event, payload) => {
        try {
            const result = await database.updateChequeStatus(
                Number(payload.id),
                payload.status
            );
            if (result && result.success) scheduleAutoBackup();
            return result;
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
);

// تایید چک در پردازش جداگانه انجام می‌شود تا حتی در صورت کندی/قفل SQLite،
// پردازش اصلی رابط کاربری و فیلد جستجو هرگز متوقف نشود.
ipcMain.on(
    "confirm-cheque-status",
    (event, payload) => {
        const id = Number(payload && payload.id);
        const status = String((payload && payload.status) || "registered");
        if (!id) return;
        try {
            const { fork } = require("child_process");
            const path = require("path");
            const worker = fork(path.join(__dirname, "database", "confirm-worker.js"), [], {
                stdio: "ignore",
                detached: true
            });
            worker.send({ id, status }, () => {
                try { worker.disconnect(); } catch (e) {}
            });
            worker.unref();
        } catch (error) {
            console.error("Confirm cheque worker error:", error);
        }
    }
);


/* =========================
   مدیریت مشتریان
========================= */
ipcMain.handle("get-customers", async () => {
    try { return await database.getCustomers(); }
    catch (error) { console.error(error); return { success:false, error:error.message }; }
});
ipcMain.handle("add-customer", async (event, data) => {
    try {
        const result = await database.addCustomer(data || {});
        if (result && result.success) scheduleAutoBackup();
        return result;
    } catch (error) {
        console.error(error);
        return { success:false, error:error.message };
    }
});

/* =========================
   مدیریت سال مالی
========================= */

ipcMain.handle("find-cheque-by-number", async (event, chequeNo) => await database.findChequeByNumber(chequeNo));
ipcMain.handle("get-fiscal-years", async () => await database.getFiscalYears());
ipcMain.handle("create-fiscal-year", async (event, year) => { const r = await database.createFiscalYear(year); if (r && r.success) scheduleAutoBackup(); return r; });
ipcMain.handle("delete-fiscal-year", async (event, year) => { const r = await database.deleteFiscalYear(year); if (r && r.success) scheduleAutoBackup(); return r; });
ipcMain.handle("clear-fiscal-year", async (event, year) => { const r = await database.clearFiscalYear(year); if (r && r.success) scheduleAutoBackup(); return r; });
ipcMain.handle("get-printers", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    try { return win ? await win.webContents.getPrintersAsync() : []; } catch(e) { return []; }
});
ipcMain.handle("get-print-settings", async () => printSettings);
ipcMain.handle("save-print-settings", async (event, settings) => {
    printSettings = {...printSettings, ...(settings||{})};
    printSettings.copies=Math.max(1,Math.min(5,Number(printSettings.copies)||1));
    savePrintSettingsFile();
    return {success:true, settings:printSettings};
});
ipcMain.handle("print-current-page", async (event, settings) => {
    try {
        const win=BrowserWindow.fromWebContents(event.sender); if(!win) return {success:false,error:"پنجره چاپ پیدا نشد."};
        await win.webContents.print(printOptions(settings));
        return {success:true};
    } catch(e) { return {success:false,error:e&&e.message?e.message:String(e)}; }
});
ipcMain.handle("preview-current-page", async (event, settings) => {
    try {
        const win=BrowserWindow.fromWebContents(event.sender); if(!win) return {success:false,error:"پنجره اصلی پیدا نشد."};
        const opts=printOptions(settings);
        delete opts.silent; delete opts.deviceName;
        const pdf=await win.webContents.printToPDF(opts);
        const previewPath=path.join(app.getPath("temp"),"pasargad-print-preview.pdf");
        fs.writeFileSync(previewPath,pdf);
        const preview=new BrowserWindow({width:1000,height:800,autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false}});
        await preview.loadURL("file://"+previewPath);
        return {success:true};
    } catch(e) { return {success:false,error:e&&e.message?e.message:String(e)}; }
});

const appearanceSettingsPath = path.join(app.getPath("userData"), "appearance-settings.json");
let appearanceSettings = {
    companyName: "نرم افزار مدیریت چک پاسارگاد",
    logoPath: "",
    signer1: "",
    signer2: ""
};
try {
    if (fs.existsSync(appearanceSettingsPath)) {
        appearanceSettings = {...appearanceSettings, ...JSON.parse(fs.readFileSync(appearanceSettingsPath, "utf8"))};
    }
} catch(e) { console.error("Appearance settings load error:", e); }
function saveAppearanceSettingsFile(){ try { fs.writeFileSync(appearanceSettingsPath, JSON.stringify(appearanceSettings,null,2), "utf8"); } catch(e){ console.error("Appearance settings save error:", e); } }
ipcMain.handle("get-appearance-settings", async () => appearanceSettings);
ipcMain.handle("save-appearance-settings", async (event, settings) => {
    appearanceSettings = {...appearanceSettings, ...(settings||{})};
    appearanceSettings.companyName = String(appearanceSettings.companyName || "نرم افزار مدیریت چک پاسارگاد").trim() || "نرم افزار مدیریت چک پاسارگاد";
    appearanceSettings.signer1 = String(appearanceSettings.signer1 || "").trim();
    appearanceSettings.signer2 = String(appearanceSettings.signer2 || "").trim();
    saveAppearanceSettingsFile();
    return {success:true, settings:appearanceSettings};
});
ipcMain.handle("choose-appearance-logo", async () => {
    const result = await dialog.showOpenDialog({properties:["openFile"], filters:[{name:"تصویر", extensions:["png","jpg","jpeg","webp"]}]});
    if (result.canceled || !result.filePaths[0]) return {success:false,canceled:true};
    const source = result.filePaths[0];
    const ext = path.extname(source).toLowerCase() || ".png";
    const dest = path.join(app.getPath("userData"), "customer-logo" + ext);
    try { fs.copyFileSync(source, dest); appearanceSettings.logoPath = dest; saveAppearanceSettingsFile(); return {success:true, path:dest}; }
    catch(e){ return {success:false,error:e.message}; }
});

function escHtml(value){ return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
function fileUrl(filePath){ if(!filePath) return ""; return "file:///" + String(filePath).replace(/\\/g,"/").split(" ").join("%20"); }
function buildReportHtml(payload){
    const settings = payload?.settings || {};
    const html = String(payload?.html || "");
    const fiscalYearRaw = String(payload?.fiscalYear || "");
    const fiscalYear = fiscalYearRaw.replace(/^\s*سال مالی\s*/u, "").trim();
    const company = escHtml(appearanceSettings.companyName || "نرم افزار مدیریت چک پاسارگاد");
    const logo = appearanceSettings.logoPath ? `<img class="customer-logo" src="${fileUrl(appearanceSettings.logoPath)}" alt="لوگوی مشتری">` : `<div class="logo-placeholder">لوگو</div>`;
    // لوگوی پاسارگاد همیشه از فایل داخلی خود نرم‌افزار خوانده می‌شود و
    // هیچ‌وقت از تنظیمات ظاهری مشتری استفاده نمی‌کند.
    const softwareLogoPath = path.join(__dirname, "assets", "logo.png");
    const softwareLogo = `<div class="software-brand"><img class="software-logo" src="${fileUrl(softwareLogoPath)}" alt="لوگوی نرم‌افزار پاسارگاد"><div class="software-name">نرم افزار مدیریت چک پاسارگاد</div></div>`;
    const s1 = escHtml(appearanceSettings.signer1 || "");
    const s2 = escHtml(appearanceSettings.signer2 || "");
    const dateText = settings.showDate === false ? "" : new Date().toLocaleString("fa-IR");
    return {html, fiscalYear, company, logo, softwareLogo, s1, s2, dateText};
}

ipcMain.handle("preview-report", async (event, payload) => {
    try {
        const settings = payload?.settings || {};
        const built = buildReportHtml(payload);
        if (!built.html) return {success:false,error:"محتوای گزارش برای پیش‌نمایش وجود ندارد."};
        const paper = settings.paper === "A5" ? "A5" : settings.paper === "Letter" ? "Letter" : "A4";
        const orientation = settings.orientation === "landscape" ? "landscape" : "portrait";
        const margin = settings.margins === "minimum" ? "8mm" : settings.margins === "maximum" ? "20mm" : "12mm";
        const previewPath = path.join(app.getPath("temp"), "pasargad-report-preview.html");
        const previewHtml = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>${built.company}</title><style>
@page{size:${paper} ${orientation};margin:${margin}}
*{box-sizing:border-box;font-family:"B Titr","Titr",Tahoma,sans-serif}
body{margin:0;padding:28px;background:#f2f5f7;color:#17232b;direction:rtl}.preview-page{background:#fff;min-height:calc(100vh - 56px);padding:24px;box-shadow:0 2px 12px rgba(0,0,0,.12)}
.report-head{display:grid;grid-template-columns:120px 1fr 120px;align-items:start;gap:16px;direction:ltr;border-bottom:0;padding-bottom:0;margin-bottom:6px}.report-head-side{width:120px;display:flex;align-items:center}.report-head-side.software{justify-content:flex-start}.report-head-side.customer{justify-content:flex-end}.software-brand{display:flex;flex-direction:column;align-items:center}.software-logo,.customer-logo{width:72px;height:72px;object-fit:contain}.software-name{font-size:10px;font-weight:normal;line-height:1.3;margin-top:3px;white-space:nowrap}.logo-placeholder{width:72px;height:72px;border:1px dashed #aab5ba;display:flex;align-items:center;justify-content:center;font-size:11px;color:#7a858b}.report-company{text-align:center;direction:rtl;font-size:28px;font-weight:bold}.report-year{text-align:center;font-size:12px;color:#52616a;width:42%;margin:2px auto 14px;padding-top:4px;border-top:1px solid #b8c1c5}.table-panel{width:100%}.table-header{text-align:center;font-size:21px;font-weight:bold;margin-bottom:12px}table{width:100%;border-collapse:collapse}thead th{height:42px;padding:7px;background:#dcebf1;border:1px solid #a5b1b6;font-size:12px;font-weight:bold;white-space:nowrap}tbody td{height:40px;padding:7px;text-align:center;border:1px solid #b8c1c5;font-size:13px}tbody tr:nth-child(10n){break-after:page;page-break-after:always}tbody tr:nth-child(even){background:#f8fafb}.status-badge{display:inline-block;padding:3px 8px;border-radius:8px;font-size:10px}.status-badge.registered{background:#e2f1e3;color:#27652c;border:1px solid #a8cbaa}.status-badge.not-registered{background:#f8e5e5;color:#8a2d2d;border:1px solid #d8aaaa}.print-status-badge{display:inline-flex;align-items:center;justify-content:center;min-width:85px;padding:5px 10px;border-radius:4px;font-size:11px;font-weight:bold;line-height:1.4;white-space:nowrap}.print-status-badge.registered{background:#d7ecd9;color:#286334;border:1px solid #a8cbaa}.print-status-badge.not-registered{background:#f4d2d2;color:#8a2b2b;border:1px solid #d8aaaa}.report-signatures{display:flex;justify-content:space-between;gap:40px;margin-top:90px}.signature-box{width:220px;height:auto;border:0;padding:0;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;font-size:14px}.signature-name{font-weight:bold;margin-top:0;font-size:16px}.report-date{text-align:center;color:#68747a;font-size:10px;margin-top:18px}@media print{body{background:#fff;padding:0}.preview-page{box-shadow:none;min-height:auto;padding:0}}
</style></head><body><div class="preview-page"><div class="report-head"><div class="report-head-side software">${built.softwareLogo}</div><div class="report-company">${built.company}</div><div class="report-head-side customer">${built.logo}</div></div><div class="report-year">سال مالی ${escHtml(built.fiscalYear)}</div>${built.html.replace(/<div class="table-header">[\s\S]*?<\/div>/, "")}<div class="report-signatures"><div class="signature-box">امضا و مهر<br><span class="signature-name">${built.s2}</span></div><div class="signature-box">امضا و مهر<br><span class="signature-name">${built.s1}</span></div></div>${built.dateText?`<div class="report-date">${escHtml(built.dateText)}</div>`:""}</div></body></html>`;
        fs.writeFileSync(previewPath, previewHtml, "utf8");
        const preview = new BrowserWindow({width:orientation==="landscape"?1200:950,height:orientation==="landscape"?850:1050,autoHideMenuBar:true,backgroundColor:"#f2f5f7",webPreferences:{contextIsolation:true,nodeIntegration:false}});
        await preview.loadFile(previewPath);
        return {success:true};
    } catch(e) { return {success:false,error:e&&e.message?e.message:String(e)}; }
});

ipcMain.handle("print-report", async (event, payload) => {
    try {
        const settings = payload?.settings || {};
        const built = buildReportHtml(payload);
        if (!built.html) return {success:false,error:"محتوای گزارش برای چاپ وجود ندارد."};
        const paper = settings.paper === "A5" ? "A5" : settings.paper === "Letter" ? "Letter" : "A4";
        const orientation = settings.orientation === "landscape" ? "landscape" : "portrait";
        const margin = settings.margins === "minimum" ? "8mm" : settings.margins === "maximum" ? "20mm" : "12mm";
        const printPath = path.join(app.getPath("temp"), "pasargad-report-print.html");
        const html = `<!doctype html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><style>@page{size:${paper} ${orientation};margin:${margin}}*{box-sizing:border-box;font-family:"B Titr","Titr",Tahoma,sans-serif}body{margin:0;color:#17232b}.report-head{display:grid;grid-template-columns:120px 1fr 120px;align-items:start;gap:16px;direction:ltr;border-bottom:0;padding-bottom:0;margin-bottom:6px}.report-head-side{width:90px}.report-head-side.software{text-align:center;justify-self:start}.report-head-side.customer{text-align:center;justify-self:end}.software-brand{display:flex;flex-direction:column;align-items:center}.software-logo,.customer-logo{width:58px;height:58px;object-fit:contain}.software-name{font-size:8px;font-weight:normal;line-height:1.3;margin-top:2px;white-space:nowrap}.logo-placeholder{width:58px;height:58px;border:1px dashed #aab5ba;text-align:center;padding-top:20px;font-size:9px}.report-company{text-align:center;direction:rtl;font-size:24px;font-weight:bold}.report-year{text-align:center;font-size:10px;color:#52616a;width:42%;margin:2px auto 12px;padding-top:3px;border-top:1px solid #b8c1c5}.table-panel{width:100%}.table-header{text-align:center;font-size:19px;font-weight:bold;margin-bottom:8px}table{width:100%;border-collapse:collapse}thead th{padding:6px;background:#dcebf1;border:1px solid #a5b1b6;font-size:10px;white-space:nowrap}tbody td{padding:6px;text-align:center;border:1px solid #b8c1c5;font-size:11px}tbody tr:nth-child(10n){break-after:page;page-break-after:always}.status-badge{display:inline-block;min-width:70px;padding:3px 8px;border-radius:3px;font-size:9px;line-height:1.4;font-weight:normal}.print-status-badge{display:inline-flex !important;align-items:center !important;justify-content:center !important;min-width:85px !important;padding:5px 10px !important;border-radius:4px !important;font-size:11px !important;font-weight:bold !important;line-height:1.4 !important;white-space:nowrap !important}.print-status-badge.registered{background:#d7ecd9 !important;color:#286334 !important;border:1px solid #a8cbaa !important}.print-status-badge.not-registered{background:#f4d2d2 !important;color:#8a2b2b !important;border:1px solid #d8aaaa !important}.report-signatures{display:flex;justify-content:space-between;gap:30px;margin-top:85px}.signature-box{width:190px;height:auto;border:0;padding:0;text-align:center;display:flex;flex-direction:column;justify-content:flex-end;font-size:14px}.signature-name{font-weight:bold;margin-top:0;font-size:16px}.report-date{text-align:center;font-size:8px;margin-top:10px}</style></head><body><div class="report-head"><div class="report-head-side software">${built.softwareLogo}</div><div class="report-company">${built.company}</div><div class="report-head-side customer">${built.logo}</div></div><div class="report-year">سال مالی ${escHtml(built.fiscalYear)}</div>${built.html.replace(/<div class="table-header">[\s\S]*?<\/div>/, "")}<div class="report-signatures"><div class="signature-box">امضا و مهر<br><span class="signature-name">${built.s2}</span></div><div class="signature-box">امضا و مهر<br><span class="signature-name">${built.s1}</span></div></div>${built.dateText?`<div class="report-date">${escHtml(built.dateText)}</div>`:""}</body></html>`;
        fs.writeFileSync(printPath, html, "utf8");
        const printWin = new BrowserWindow({show:false,webPreferences:{contextIsolation:true,nodeIntegration:false}});
        await printWin.loadFile(printPath);
        await new Promise(r=>setTimeout(r,150));
        const opts=printOptions(settings);
        await printWin.webContents.print(opts);
        setTimeout(()=>{try{printWin.close();}catch(e){}},300);
        return {success:true};
    } catch(e){ return {success:false,error:e&&e.message?e.message:String(e)}; }
});

/* =========================
   پشتیبان گیری و بازیابی
========================= */

const printSettingsPath = path.join(app.getPath("userData"), "print-settings.json");
let printSettings = { printerName: "", paper: "A4", orientation: "portrait", margins: "default", copies: 1, showDate: true };
function loadPrintSettings() {
    try { if (fs.existsSync(printSettingsPath)) { const cfg=JSON.parse(fs.readFileSync(printSettingsPath,"utf8")); printSettings={...printSettings,...cfg}; } } catch(e) { console.error("Print settings load error:",e); }
}
function savePrintSettingsFile() { try { fs.writeFileSync(printSettingsPath, JSON.stringify(printSettings,null,2), "utf8"); } catch(e) { console.error("Print settings save error:",e); } }
function printOptions(settings) {
    const s={...printSettings,...(settings||{})};
    const paperMap={A4:{width:210000,height:297000},A5:{width:148000,height:210000},Letter:{width:215900,height:279400}};
    const margins={default:{top:0.4,bottom:0.4,left:0.4,right:0.4},minimum:{top:0.1,bottom:0.1,left:0.1,right:0.1},maximum:{top:0.8,bottom:0.8,left:0.8,right:0.8}};
    return {silent:!!s.printerName, deviceName:s.printerName||undefined, landscape:s.orientation==="landscape", copies:Math.max(1,Math.min(5,Number(s.copies)||1)), pageSize:paperMap[s.paper]||paperMap.A4, margins:{marginType:"custom", ...(margins[s.margins]||margins.default)}, printBackground:true};
}

const backupConfigPath = path.join(app.getPath("userData"), "backup-config.json");
let backupSecondPath = "";
let autoBackupTimer = null;
let autoBackupDebounce = null;

function loadBackupConfig() {
    try {
        if (fs.existsSync(backupConfigPath)) {
            const cfg = JSON.parse(fs.readFileSync(backupConfigPath, "utf8"));
            backupSecondPath = typeof cfg.secondPath === "string" ? cfg.secondPath : "";
        }
    } catch (e) { backupSecondPath = ""; }
}
function saveBackupConfig() {
    try {
        fs.mkdirSync(path.dirname(backupConfigPath), { recursive: true });
        fs.writeFileSync(backupConfigPath, JSON.stringify({ secondPath: backupSecondPath }, null, 2), "utf8");
    } catch (e) { console.error("Backup config error:", e); }
}
function backupStamp() { return new Date().toISOString().replace(/[:.]/g, "-"); }
async function createBackupInternal() {
    const backupFolder = path.join(app.getPath("userData"), "backups");
    if (!fs.existsSync(backupFolder)) fs.mkdirSync(backupFolder, { recursive: true });
    const name = "pasargad-backup-" + backupStamp() + ".db";
    const primaryPath = path.join(backupFolder, name);
    const result = await database.backupDatabase(primaryPath);
    let secondPath = "";
    let secondSuccess = true;
    if (backupSecondPath) {
        try {
            if (!fs.existsSync(backupSecondPath)) fs.mkdirSync(backupSecondPath, { recursive: true });
            secondPath = path.join(backupSecondPath, name);
            fs.copyFileSync(primaryPath, secondPath);
        } catch (e) {
            secondSuccess = false;
            console.error("Second backup path error:", e);
        }
    }
    return { success: secondSuccess, path: primaryPath, secondPath, secondSuccess, result, error: secondSuccess ? "" : "ذخیره در مسیر پشتیبان دوم انجام نشد." };
}
async function runAutoBackup() {
    try { await createBackupInternal(); } catch (e) { console.error("Automatic backup error:", e); }
}
function scheduleAutoBackup() {
    clearTimeout(autoBackupDebounce);
    autoBackupDebounce = setTimeout(runAutoBackup, 15000);
}

ipcMain.handle("create-backup", async () => {
    try { return await createBackupInternal(); }
    catch (error) { console.error("Backup error:", error); return { success: false, error: error && error.message ? error.message : String(error) }; }
});

ipcMain.handle("get-backup-settings", async () => ({ secondPath: backupSecondPath }));
ipcMain.handle("choose-backup-second-path", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win, { title: "انتخاب مسیر پشتیبان دوم", properties: ["openDirectory", "createDirectory"] });
    if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true };
    backupSecondPath = result.filePaths[0];
    saveBackupConfig();
    return { success: true, path: backupSecondPath };
});
ipcMain.handle("clear-backup-second-path", async () => { backupSecondPath = ""; saveBackupConfig(); return { success: true }; });

ipcMain.handle("restore-backup", async (event, backupPath) => {
    try {
        if (!backupPath || !fs.existsSync(backupPath)) return { success: false, error: "فایل پشتیبان پیدا نشد." };
        const ok = await database.restoreDatabase(backupPath);
        if (!ok || !ok.success) return { success: false, error: (ok && ok.error) || "بازیابی انجام نشد." };
        setTimeout(() => { app.relaunch(); app.exit(0); }, 300);
        return { success: true };
    } catch (error) { console.error("Restore error:", error); return { success: false, error: error && error.message ? error.message : String(error) }; }
});

loadBackupConfig();
loadPrintSettings();
setInterval(runAutoBackup, 5 * 60 * 1000);

let allowWindowClose = false;



/* =========================
   دریافت چک ها
========================= */

ipcMain.handle(
    "get-cheques",
    async () => {

        try {

            return await database.getCheques();

        } catch (error) {

            console.error(error);

            throw error;

        }

    }
);


ipcMain.on("backup-before-exit-done", (event, success) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return;
    if (success) {
        allowWindowClose = true;
        win.close();
    }
});

/* =========================
   اجرای برنامه
========================= */

app.whenReady().then(() => {

    createWindow();


    app.on(
        "activate",
        () => {

            if (
                BrowserWindow
                    .getAllWindows()
                    .length === 0
            ) {

                createWindow();

            }

        }
    );

});


app.on(
    "window-all-closed",
    () => {

        if (process.platform !== "darwin") {

            app.quit();

        }

    }
);