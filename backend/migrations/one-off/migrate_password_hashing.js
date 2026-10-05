/**
 * PalmTrace Password Hashing Migration (bcrypt)
 * Hashes all plaintext passwords in the `users` table using bcryptjs (saltRounds = 10)
 */
const bcrypt = require('bcryptjs');
const db = require('../../db');

const SALT_ROUNDS = 10;

console.log('--- Starting Password Hashing Migration (bcrypt) ---');

const users = db.all('SELECT id, username, password_hash FROM users');
let updatedCount = 0;

const updateStmt = db.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');

for (const user of users) {
  // If not already a bcrypt hash (bcrypt hashes start with $2a$, $2b$, or $2y$)
  if (!user.password_hash || !user.password_hash.startsWith('$2')) {
    const rawPass = (user.password_hash && user.password_hash.length > 0) ? user.password_hash : '1234';
    const hashed = bcrypt.hashSync(rawPass, SALT_ROUNDS);
    updateStmt.run(hashed, user.id);
    console.log(`✓ Hashed password for user [${user.username}] (${user.id}): ${hashed.substring(0, 15)}...`);
    updatedCount++;
  } else {
    console.log(`- User [${user.username}] (${user.id}) already has a bcrypt hash.`);
  }
}

console.log(`--- Migration complete: ${updatedCount} passwords secured with bcrypt ---`);

// Verification
const sample = db.all('SELECT id, username, password_hash FROM users LIMIT 3');
console.log('Sample users in database:');
sample.forEach(u => console.log(`  ${u.username} => ${u.password_hash}`));

