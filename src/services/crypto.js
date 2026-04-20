// src/services/crypto.js
// AES-256-GCM encryption for credentials stored in the DB
const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(b => b.toString('base64')).join('.');
}

function decrypt(ciphertext) {
  const [ivB64, tagB64, dataB64] = ciphertext.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

module.exports = { encrypt, decrypt };
