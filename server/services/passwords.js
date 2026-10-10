const bcrypt = require('bcrypt');

module.exports = {
  comparePassword: (plaintext, passwordHash) => bcrypt.compare(plaintext, passwordHash),
  hashPassword: plaintext => bcrypt.hash(plaintext, 12),
};
