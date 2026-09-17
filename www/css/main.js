const {
    app,
    BrowserWindow,
    ipcMain
} = require("electron");

const path = require("path");

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

}


/* =========================
   ثبت چک
========================= */

ipcMain.handle(
    "add-cheque",
    async (event, data) => {

        try {

            return await database.addCheque(data);

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
            return await database.updateCheque(payload.id, payload.data);
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
            return await database.deleteCheque(id);
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
            return await database.updateChequeStatus(
                Number(payload.id),
                payload.status,
                payload.registrationDate || ""
            );
        } catch (error) {
            console.error(error);
            throw error;
        }
    }
);


/* =========================
   مدیریت سال مالی
========================= */

ipcMain.handle("get-fiscal-years", async () => await database.getFiscalYears());
ipcMain.handle("create-fiscal-year", async (event, year) => await database.createFiscalYear(year));
ipcMain.handle("delete-fiscal-year", async (event, year) => await database.deleteFiscalYear(year));
ipcMain.handle("clear-fiscal-year", async (event, year) => await database.clearFiscalYear(year));


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