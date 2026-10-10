const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const encryption = require('./encryption');

test('encrypted PDF payload survives restart-style decryption and rejects tampering', t => {
  const originalMasterKey = process.env.VAULTX_MASTER_KEY;
  process.env.VAULTX_MASTER_KEY = 'ab'.repeat(32);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vaultx-encryption-test-'));
  t.after(() => {
    if (originalMasterKey === undefined) delete process.env.VAULTX_MASTER_KEY;
    else process.env.VAULTX_MASTER_KEY = originalMasterKey;
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const inputPath = path.join(directory, 'paper.pdf');
  const plaintext = Buffer.from('%PDF-1.7\nVaultX round-trip test data\n%%EOF');
  fs.writeFileSync(inputPath, plaintext);
  const encrypted = encryption.encryptFile(inputPath, directory);
  const metadata = {
    wrappedEncryptionKey: encrypted.wrappedEncryptionKey,
    keyWrappingIv: encrypted.keyWrappingIv,
    keyWrappingTag: encrypted.keyWrappingTag,
    ivHex: encrypted.ivHex,
    tagHex: encrypted.tagHex,
  };

  assert.match(metadata.wrappedEncryptionKey, /^[0-9a-f]{64}$/);
  assert.match(metadata.keyWrappingIv, /^[0-9a-f]{24}$/);
  assert.match(metadata.keyWrappingTag, /^[0-9a-f]{32}$/);
  assert.match(metadata.ivHex, /^[0-9a-f]{24}$/);
  assert.match(metadata.tagHex, /^[0-9a-f]{32}$/);
  assert.equal(fs.existsSync(inputPath), false);
  assert.deepEqual(encryption.decryptFile(encrypted.encryptedFilePath, metadata), plaintext);
  assert.equal(fs.readFileSync(encrypted.encryptedFilePath).includes(plaintext), false);

  const damagedPath = path.join(directory, 'damaged.enc');
  const damagedCiphertext = fs.readFileSync(encrypted.encryptedFilePath);
  damagedCiphertext[0] ^= 0xff;
  fs.writeFileSync(damagedPath, damagedCiphertext);
  assert.throws(() => encryption.decryptFile(damagedPath, metadata));
});
