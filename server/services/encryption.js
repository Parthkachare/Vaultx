const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12;  // 96 bits (recommended for GCM)
const WRAP_ALGORITHM = 'aes-256-gcm';

function getMasterKey() {
  const value = process.env.VAULTX_MASTER_KEY;
  if (!value || !/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error('VAULTX_MASTER_KEY must be configured as 64 hexadecimal characters.');
  }
  return Buffer.from(value, 'hex');
}

function encryptFile(inputPath, uploadsDir) {
  const plaintext = fs.readFileSync(inputPath);
  const key = crypto.randomBytes(KEY_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16-byte GCM authentication tag

  const encryptedFilename = `${crypto.randomUUID()}.enc`;
  const encryptedPath = path.join(uploadsDir, encryptedFilename);
  const keyWrappingIv = crypto.randomBytes(IV_LENGTH);
  const keyWrapper = crypto.createCipheriv(WRAP_ALGORITHM, getMasterKey(), keyWrappingIv);
  const wrappedKey = Buffer.concat([keyWrapper.update(key), keyWrapper.final()]);
  const keyWrappingTag = keyWrapper.getAuthTag();

  try {
    fs.writeFileSync(encryptedPath, encrypted, { flag: 'wx', mode: 0o600 });
    return {
      encryptedFilePath: encryptedPath,
      encryptedFilename,
      wrappedEncryptionKey: wrappedKey.toString('hex'),
      keyWrappingIv: keyWrappingIv.toString('hex'),
      keyWrappingTag: keyWrappingTag.toString('hex'),
      ivHex: iv.toString('hex'),
      tagHex: tag.toString('hex'),
    };
  } catch (error) {
    if (fs.existsSync(encryptedPath)) fs.unlinkSync(encryptedPath);
    throw error;
  } finally {
    key.fill(0);
    plaintext.fill(0);
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
  }
}

function decryptFile(encryptedPath, metadata) {
  return decryptBuffer(fs.readFileSync(encryptedPath), metadata);
}

function decryptBuffer(encrypted, metadata) {
  const keyUnwrapper = crypto.createDecipheriv(
    WRAP_ALGORITHM,
    getMasterKey(),
    Buffer.from(metadata.keyWrappingIv, 'hex'),
  );
  keyUnwrapper.setAuthTag(Buffer.from(metadata.keyWrappingTag, 'hex'));
  const key = Buffer.concat([
    keyUnwrapper.update(Buffer.from(metadata.wrappedEncryptionKey, 'hex')),
    keyUnwrapper.final(),
  ]);

  try {
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(metadata.ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(metadata.tagHex, 'hex'));
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  } finally {
    key.fill(0);
  }
}

/**
 * Generates a unique paper ID.
 */
function generatePaperId() {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  return `VX-${year}-${rand}`;
}

/**
 * Generates an encryption key ID (reference stored in DB instead of the key itself).
 */
function generateKeyId() {
  return `AES256-${crypto.randomBytes(6).toString('hex')}`;
}

module.exports = { encryptFile, decryptFile, decryptBuffer, generatePaperId, generateKeyId, getMasterKey };
