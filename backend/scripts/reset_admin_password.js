// Emergency reset of administrator passwords (run on the server machine only).
// Usage: npm run reset-admin -- "NewStrongPassword"
const db = require('../db');
const bcrypt = require('bcryptjs');

const newPass = process.argv[2];
if (!newPass || newPass.length < 8) {
  console.error('Usage: npm run reset-admin -- "NewPassword"   (8 characters minimum)');
  process.exit(1);
}
const newHash = bcrypt.hashSync(newPass, 10);

const admins = db.all("SELECT id, username FROM users WHERE role IN ('admin', 'super_admin')");

for (const u of admins) {
  db.run(
    "UPDATE users SET password_hash = ?, must_change_password = 0, reset_token_hash = NULL, reset_token_expires_at = NULL WHERE id = ?",
    newHash,
    u.id
  );
  try { db.run('DELETE FROM auth_sessions WHERE user_id = ?', u.id); } catch {}
  console.log(`Password reset for '${u.username}' (ID: ${u.id}).`);
}
