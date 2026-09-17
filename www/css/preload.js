const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("pasargad", {
    addCheque: (data) => ipcRenderer.invoke("add-cheque", data),
    getCheques: () => ipcRenderer.invoke("get-cheques"),
    updateCheque: (payload) => ipcRenderer.invoke("update-cheque", payload),
    deleteCheque: (id) => ipcRenderer.invoke("delete-cheque", id),
    updateChequeStatus: (payload) => ipcRenderer.invoke("update-cheque-status", payload),
    getFiscalYears: () => ipcRenderer.invoke("get-fiscal-years"),
    createFiscalYear: (year) => ipcRenderer.invoke("create-fiscal-year", year),
    deleteFiscalYear: (year) => ipcRenderer.invoke("delete-fiscal-year", year),
    clearFiscalYear: (year) => ipcRenderer.invoke("clear-fiscal-year", year),
    hashText: (text) => String(text)
});
