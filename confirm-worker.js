const database = require('./database/db');

process.on('message', async (payload) => {
    try {
        const id = Number(payload && payload.id);
        const status = String((payload && payload.status) || 'registered');
        if (!id) return;
        await database.updateChequeStatus(id, status);
    } catch (error) {
        console.error('Confirm worker error:', error);
    }
});
