require("dotenv").config();
const crypto = require("crypto");
const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

module.exports = {
  API_PORT: parseInt(process.env.API_PORT),
  SOCKET_PORT: parseInt(process.env.SOCKET_PORT),
  corsOptions: {
    origin: [
      "https://www.cmsvina4285.com",
      "http://www.cmsvina4285.com",
      "http://cmsvina4285.com",
      "https://cmsvina4285.com",
      "https://cmsvina4285.com:3001",
      "https://cmsvina4285.com:3006",
      "http://cmsvina4285.com:3006",
      "http://cmsvina4285.com:3001",
      "http://cmsvina4285.com:3000",
      /* "http://192.168.1.136:3001", */
      /* "https://cms.ddns.net:3004",
      "http://cms.ddns.net:3010",
      "https://cms.ddns.net:3010",
      "https://cms.ddns.net:3001",
      "https://cms.ddns.net",
      "http://cms.ddns.net:3000",
      "http://cms.ddns.net:3010",
      "http://cms.ddns.net",
      "https://cms1.ddns.net",
      "https://cms1.ddns.net:3004",
      "http://cms1.ddns.net:3010",
      "https://cms1.ddns.net:3010",
      "https://cms1.ddns.net:3001",
      "https://cms1.ddns.net",
      "http://cms1.ddns.net:3000",
      "http://cms1.ddns.net:3001",
      "http://cms1.ddns.net:3010",
      "http://cms1.ddns.net", */
      "http://localhost:3001",
      "http://localhost:61221",
      "http://localhost:3010",
      "http://cmsvina4285.com:3010",
      /* "http://192.168.1.192",
      "http://192.168.1.2", */
      "http://192.168.1.136:3010",
      "http://222.252.1.63",
      "http://222.252.1.214",
      "http://222.252.1.63:3000",
      /* "http://192.168.1.22:3000",   */
      /* "http://14.160.33.94:3001", */
      "http://localhost:3000",
      "http://localhost",
      /* "http://14.160.33.94",*/
      /* "http://14.160.33.94:3010",
      "http://14.160.33.94:3001",
      "http://14.160.33.94:3030",  */
      "https://script.google.com",
      "https://erp.printvietnam.com.vn",
      "https://wwww.erp.printvietnam.com.vn",
      "http://erp.printvietnam.com.vn",
      "http://wwww.erp.printvietnam.com.vn",
      "*",
    ],
    optionsSuccessStatus: 200,
    credentials: true,
  },
  privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCjeAGJmmsvBQ2D
i+n6/HUnLf0J0Wj0slOIjNNYpJPdEaaycVoGLQ7OnOgC3ibPtVz3W/0xOpjFBNzO
/QcqG+gOZJRs2Z164f6mPo8PVcXy1+R/yfjfKxAgOuKFEceZC3PUvVcn4PmfXVmS
PBukAlLgFwGwLIiBPteMo+FmQPOHEAMAHx6oQN9E6SoRCUwD02kGp6luDC6PBhya
HuVI5P1lxHFFkogtORUCA+8P+BR4gnRFdkkMTS9RTFfe5NbR6fOg2fWPzK+h7HJO
5nNXUb1ukhIE0NQRfiLeaMvpYmHZZCl1M4owfTjFsDD6lC0krggmPe87WWpErCyF
cBZ1dna3AgMBAAECggEAK7QuaQ0dYeVObyCNjlpHshFkCOdxUZaJqcTIzna1x5Fs
CWIvyN3sCwY9K2McakTZVZLE9w/s/yOlKzvP2gy69noiipWFunBIZkbsdZOfiCT7
RMUJYhT/yzYjEKOnwv2iWrrCXfmSk25gP64NT8SFRr8v5tuJJVDZTRMVdIKh+TY7
ye+ZYHn6OvE6g4WFE4uyHewexsT6wnd0/e5NR6nBXP7/U42u6AD6CiU3A5jdMhFA
tzZaIWjnP7ZS+AIw1ukANovj5sc8JCyzUZACM6USrKyBcXCetN/VGmEbDr/58Ozs
F3b2VCKPcDv+ytzy8ZlfmBheBH218xBPLeldGG/WIQKBgQDPW9uCk5LVBEYs/5qZ
Mr5G93C+/q4pjag5bD7lhsiMTdNzPNP6nYMsaD049oLfG+yM1PPsreU6g4Avvqs8
FMAN9WVMzQIoYDdBgY2XPb0Zk/tAMiDbZbe1yup4e4TTnOgZeNexJSh4zYAh+Wf7
87K+SWAMtCTr+D7lD+GNUXOV1wKBgQDJ0H/YPwfmT8CArUptG8Z/DedFNmHRYSab
1lEJ0XOlFsvmBzXIleZfE5EPDTklr3rMFsMyn1XOu/bTDPkjJkZZeuru1pnkCRJv
iyncYBKm6UNL2gkdrgZKGGCujsZ/TGArpxNncfylkjMCcuXuuDhdizGlWwTqLAvD
qS7KzcBKIQKBgCxicR4GEIvgGlVPcPwRzIDMPinjwcvLMpL4BI6ExzChB/3Gq2kd
hhJfTZt/yIuRIpUSkBO9NS/NLgcKPQTjPCjAuioyR5/02F8BKBmTcYKkFkerczUD
FMuo339ikQ/qqhOptiGI3pzc/+xFwmg/xabNde3CMZUA0hWdzJ2/LYqJAoGAHFSY
ndK7WSl47JdnC0oK42sgPCcWND5fHSFI3wf4JAS/OttoQXBJlq84fdRtYUzxABVx
8XlMomjgjWAU2UpWNdl7gWu+zrQ3UlFG3xjdhXDZcZx6CyCS4XPqnpaMZvJhzb72
il8GCHgtkPpwLMLPptITdhMA7Z6hSCZH21Bm3gECgYB1E5tuts7mKt5GBM9HSoS/
QZ8flz50tyO4IltLtbM9m9bXUU17ACq2ifIbWGBPjyWamFRkxCCmXOkl2PhH5ejz
L3oHLUzDJVxcRntmUyszpdY54zDnHbp+bnGnrWn54lXamVqwmT0FIYCif36hu2P1
eeP4GBK09qJiI6HO1Z7p9Q==
-----END PRIVATE KEY-----`,
publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAo3gBiZprLwUNg4vp+vx1
Jy39CdFo9LJTiIzTWKST3RGmsnFaBi0OzpzoAt4mz7Vc91v9MTqYxQTczv0HKhvo
DmSUbNmdeuH+pj6PD1XF8tfkf8n43ysQIDrihRHHmQtz1L1XJ+D5n11ZkjwbpAJS
4BcBsCyIgT7XjKPhZkDzhxADAB8eqEDfROkqEQlMA9NpBqepbgwujwYcmh7lSOT9
ZcRxRZKILTkVAgPvD/gUeIJ0RXZJDE0vUUxX3uTW0enzoNn1j8yvoexyTuZzV1G9
bpISBNDUEX4i3mjL6WJh2WQpdTOKMH04xbAw+pQtJK4IJj3vO1lqRKwshXAWdXZ2
twIDAQAB
-----END PUBLIC KEY-----`,
};