const { google } = require('googleapis');
const fs = require('fs');

// Thông tin xác thực
const credentials = require('path/to/your/credentials.json');
const token = require('path/to/your/token.json');

// ID của tệp tin trên Google Drive
const fileId = 'your_file_id_here';

// Tạo client từ thông tin xác thực
const client = new google.auth.OAuth2(
  credentials.installed.client_id,
  credentials.installed.client_secret,
  credentials.installed.redirect_uris[0]
);

client.setCredentials(token);

// Tạo API Google Drive
const drive = google.drive({ version: 'v3', auth: client });

// Kiểm tra sự tồn tại của tệp tin
async function checkFileExistence(fileId) {
  try {
    const response = await drive.files.get({ fileId });
    return true; // Tệp tin tồn tại
  } catch (error) {
    if (error.response && error.response.status === 404) {
      return false; // Tệp tin không tồn tại
    } else {
      throw error;
    }
  }
}

// Sử dụng ví dụ:
checkFileExistence(fileId)
  .then(exists => {
    if (exists) {
      console.log('Tệp tin tồn tại trên Google Drive.');
    } else {
      console.log('Tệp tin không tồn tại trên Google Drive.');
    }
  })
  .catch(error => {
    console.error('Lỗi khi kiểm tra tệp tin:', error);
  });