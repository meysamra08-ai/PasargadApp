const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'pasargad.db');
const db = new sqlite3.Database(dbPath);
db.configure('busyTimeout', 1000);
process.on('message', (payload) => {
  const id = Number(payload && payload.id);
  const status = String((payload && payload.status) || 'registered');
  if (!id) return;
  db.run('UPDATE cheques SET status = ? WHERE id = ?', [status, id], (err) => {
    if (err) console.error('Confirm worker DB error:', err);
    process.exitCode = err ? 1 : 0;
    db.close(() => process.exit(err ? 1 : 0));
  });
});
