const { google } = require('googleapis');
const fs = require('fs');

// Replace with your own OAuth client credentials
const CLIENT_ID = '927215160794-is7u3pak1ddhr12nctpenteueroi6psp.apps.googleusercontent.com';
const CLIENT_SECRET = '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';
const REDIRECT_URI = 'YOUR_REDIRECT_URI';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];

const credentials = {
  client_id: CLIENT_ID,
  client_secret: CLIENT_SECRET,
  redirect_uris: [REDIRECT_URI],
};

const auth = new google.auth.OAuth2(
  credentials.client_id,
  credentials.client_secret,
  credentials.redirect_uris[0]
);

// Generate an authentication URL and log in to your Google account to obtain the token
const authUrl = auth.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
});

console.log(`Authorize this app by visiting this URL: ${authUrl}`);

// Handle the OAuth2 callback to get the access token
// After obtaining the token, store it securely and use it in your application
const TOKEN = 'YOUR_ACCESS_TOKEN';
auth.setCredentials({ access_token: TOKEN });

// Use the Google Drive API to read a text file
const drive = google.drive({ version: 'v3', auth });

// Replace with the file ID of the text file you want to read
const fileId = '10dJDjoOhkW9aFkim2f0-TeUTLiptcA7i';

drive.files.get({ fileId, alt: 'media' }, (err, { data }) => {
  if (err) {
    console.error('Error reading the file:', err);
    return;
  }

  fs.writeFileSync('downloaded-file.txt', data);
  console.log('File downloaded successfully.');
});