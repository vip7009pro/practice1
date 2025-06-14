const crypto = require("crypto");

// Hàm giải mã ở backend, trả về JSON object
function decryptData(privateKey, { encryptedData, encryptedKey, iv }) {
    try {
      // Giải mã khóa AES bằng privateKey
      const encryptedKeyBuffer = Buffer.from(encryptedKey, 'base64');
      const decryptedKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        encryptedKeyBuffer
      );
  
      // Chuyển iv thành buffer
      const ivBuffer = Buffer.from(iv, 'base64');
  
      // Tách authentication tag từ encryptedData (16 bytes cuối)
      const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
      const authTagLength = 16; // AES-GCM tag length
      const authTag = encryptedDataBuffer.slice(-authTagLength);
      const cipherText = encryptedDataBuffer.slice(0, -authTagLength);
  
      // Giải mã dữ liệu bằng AES-GCM
      const decipher = crypto.createDecipheriv('aes-256-gcm', decryptedKey, ivBuffer);
      decipher.setAuthTag(authTag); // Set authentication tag
  
      // Cập nhật và hoàn tất giải mã
      let decrypted = decipher.update(cipherText);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
  
      // Parse chuỗi thành JSON object
      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }
  
  module.exports = { decryptData };