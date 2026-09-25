const jwt = require("jsonwebtoken");
const { queryDB_New } = require("../config/database");
const { publicKey } = require("../config/env");
const {
  generateSecret,
  verifyTOTP,
  generateBackupCodes,
  generateOtpAuthUri,
} = require("../utils/totpUtils");

const USER_SELECT_FIELDS = `
  ZTBEMPLINFO.EMPL_IMAGE,ZTBEMPLINFO.CTR_CD,ZTBEMPLINFO.EMPL_NO,ZTBEMPLINFO.CMS_ID,
  ZTBEMPLINFO.FIRST_NAME,ZTBEMPLINFO.MIDLAST_NAME,ZTBEMPLINFO.DOB,ZTBEMPLINFO.HOMETOWN,
  ZTBEMPLINFO.SEX_CODE,ZTBEMPLINFO.ADD_PROVINCE,ZTBEMPLINFO.ADD_DISTRICT,ZTBEMPLINFO.ADD_COMMUNE,
  ZTBEMPLINFO.ADD_VILLAGE,ZTBEMPLINFO.PHONE_NUMBER,ZTBEMPLINFO.WORK_START_DATE,ZTBEMPLINFO.PASSWORD,
  ZTBEMPLINFO.EMAIL,ZTBEMPLINFO.WORK_POSITION_CODE,ZTBEMPLINFO.WORK_SHIFT_CODE,ZTBEMPLINFO.POSITION_CODE,
  ZTBEMPLINFO.JOB_CODE,ZTBEMPLINFO.FACTORY_CODE,ZTBEMPLINFO.WORK_STATUS_CODE,ZTBEMPLINFO.REMARK,
  ZTBEMPLINFO.ONLINE_DATETIME,ZTBEMPLINFO.MFA_ENABLED,ZTBEMPLINFO.MFA_SETUP_DATE,
  ZTBSEX.SEX_NAME,ZTBSEX.SEX_NAME_KR,
  ZTBWORKSTATUS.WORK_STATUS_NAME,ZTBWORKSTATUS.WORK_STATUS_NAME_KR,
  ZTBFACTORY.FACTORY_NAME,ZTBFACTORY.FACTORY_NAME_KR,
  ZTBJOB.JOB_NAME,ZTBJOB.JOB_NAME_KR,
  ZTBPOSITION.POSITION_NAME,ZTBPOSITION.POSITION_NAME_KR,
  ZTBWORKSHIFT.WORK_SHIF_NAME,ZTBWORKSHIFT.WORK_SHIF_NAME_KR,
  ZTBWORKPOSITION.SUBDEPTCODE,ZTBWORKPOSITION.WORK_POSITION_NAME,ZTBWORKPOSITION.WORK_POSITION_NAME_KR,ZTBWORKPOSITION.ATT_GROUP_CODE,
  ZTBSUBDEPARTMENT.MAINDEPTCODE,ZTBSUBDEPARTMENT.SUBDEPTNAME,ZTBSUBDEPARTMENT.SUBDEPTNAME_KR,
  ZTBMAINDEPARMENT.MAINDEPTNAME,ZTBMAINDEPARMENT.MAINDEPTNAME_KR
`;

const USER_JOIN_CLAUSES = `
  LEFT JOIN ZTBSEX ON (ZTBSEX.SEX_CODE = ZTBEMPLINFO.SEX_CODE AND ZTBSEX.CTR_CD = ZTBEMPLINFO.CTR_CD)
  LEFT JOIN ZTBWORKSTATUS ON(ZTBWORKSTATUS.WORK_STATUS_CODE = ZTBEMPLINFO.WORK_STATUS_CODE AND ZTBWORKSTATUS.CTR_CD = ZTBEMPLINFO.CTR_CD)
  LEFT JOIN ZTBFACTORY ON (ZTBFACTORY.FACTORY_CODE = ZTBEMPLINFO.FACTORY_CODE AND ZTBFACTORY.CTR_CD = ZTBEMPLINFO.CTR_CD)
  LEFT JOIN ZTBJOB ON (ZTBJOB.JOB_CODE = ZTBEMPLINFO.JOB_CODE AND ZTBJOB.CTR_CD = ZTBEMPLINFO.CTR_CD)
  LEFT JOIN ZTBPOSITION ON (ZTBPOSITION.POSITION_CODE = ZTBEMPLINFO.POSITION_CODE AND ZTBPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD)
  LEFT JOIN ZTBWORKSHIFT ON (ZTBWORKSHIFT.WORK_SHIFT_CODE = ZTBEMPLINFO.WORK_SHIFT_CODE AND ZTBWORKSHIFT.CTR_CD = ZTBEMPLINFO.CTR_CD)
  LEFT JOIN ZTBWORKPOSITION ON (ZTBWORKPOSITION.WORK_POSITION_CODE = ZTBEMPLINFO.WORK_POSITION_CODE AND ZTBWORKPOSITION.CTR_CD = ZTBEMPLINFO.CTR_CD)
  LEFT JOIN ZTBSUBDEPARTMENT ON (ZTBSUBDEPARTMENT.SUBDEPTCODE = ZTBWORKPOSITION.SUBDEPTCODE AND ZTBSUBDEPARTMENT.CTR_CD = ZTBWORKPOSITION.CTR_CD)
  LEFT JOIN ZTBMAINDEPARMENT ON (ZTBMAINDEPARMENT.MAINDEPTCODE = ZTBSUBDEPARTMENT.MAINDEPTCODE AND ZTBMAINDEPARMENT.CTR_CD = ZTBSUBDEPARTMENT.CTR_CD)
`;

/**
 * 1. Lấy trạng thái MFA của user hiện tại
 */
exports.getMfaStatus = async (req, res, DATA) => {
  try {
    const emplNo = req.payload_data?.EMPL_NO || DATA?.EMPL_NO;
    const ctrCd = req.payload_data?.CTR_CD || DATA?.CTR_CD || "002";

    if (!emplNo) {
      return res.send({ tk_status: "NG", message: "Không tìm thấy thông tin tài khoản" });
    }

    const query = `
      SELECT EMPL_NO, MFA_ENABLED, MFA_SETUP_DATE
      FROM ZTBEMPLINFO
      WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO
    `;
    const result = await queryDB_New(query, { CTR_CD: ctrCd, EMPL_NO: emplNo });

    if (result.tk_status === "OK" && result.data.length > 0) {
      const row = result.data[0];
      return res.send({
        tk_status: "OK",
        data: {
          mfa_enabled: Boolean(row.MFA_ENABLED),
          setup_date: row.MFA_SETUP_DATE,
        },
      });
    }

    return res.send({ tk_status: "NG", message: "Không tìm thấy người dùng" });
  } catch (error) {
    console.error("getMfaStatus error:", error);
    return res.send({ tk_status: "NG", message: error.message });
  }
};

/**
 * 2. Khởi tạo quy trình thiết lập MFA (tạo secret & URL QR Code)
 */
exports.setupMfa = async (req, res, DATA) => {
  try {
    const emplNo = req.payload_data?.EMPL_NO || DATA?.EMPL_NO;
    const ctrCd = req.payload_data?.CTR_CD || DATA?.CTR_CD || "002";

    if (!emplNo) {
      return res.send({ tk_status: "NG", message: "Không tìm thấy thông tin tài khoản" });
    }

    const secret = generateSecret(20);
    const otpauthUrl = generateOtpAuthUri(emplNo, "CMS_ERP", secret);

    // Ký secret vào một token tạm thời có hạn 10 phút
    const tempSetupToken = jwt.sign(
      { empl_no: emplNo, ctr_cd: ctrCd, secret: secret, type: "MFA_SETUP" },
      "nguyenvanhung",
      { expiresIn: "10m" }
    );

    return res.send({
      tk_status: "OK",
      data: {
        secret: secret,
        otpauth_url: otpauthUrl,
        temp_setup_token: tempSetupToken,
      },
    });
  } catch (error) {
    console.error("setupMfa error:", error);
    return res.send({ tk_status: "NG", message: error.message });
  }
};

/**
 * 3. Xác thực mã OTP 6 số và kích hoạt MFA chính thức
 */
exports.verifyAndEnableMfa = async (req, res, DATA) => {
  try {
    const { otp_code, temp_setup_token } = DATA || req.body || {};
    const emplNo = req.payload_data?.EMPL_NO || DATA?.EMPL_NO;
    const ctrCd = req.payload_data?.CTR_CD || DATA?.CTR_CD || "002";

    if (!otp_code || !temp_setup_token) {
      return res.send({ tk_status: "NG", message: "Vui lòng nhập đầy đủ mã xác thực" });
    }

    let decoded;
    try {
      decoded = jwt.verify(temp_setup_token, "nguyenvanhung");
    } catch (tokenErr) {
      return res.send({
        tk_status: "NG",
        message: "Phiên kích hoạt đã hết hạn, vui lòng thao tác lại từ đầu",
      });
    }

    if (decoded.type !== "MFA_SETUP" || decoded.empl_no !== emplNo) {
      return res.send({ tk_status: "NG", message: "Yêu cầu kích hoạt không hợp lệ" });
    }

    const secret = decoded.secret;
    const isValid = verifyTOTP(otp_code, secret, 1);

    if (!isValid) {
      return res.send({
        tk_status: "NG",
        message: "Mã xác thực Google Authenticator không chính xác hoặc đã trễ giờ",
      });
    }

    // Sinh 8 mã dự phòng khôi phục
    const backupCodes = generateBackupCodes(8);
    const backupCodesJson = JSON.stringify(backupCodes);

    const updateQuery = `
      UPDATE ZTBEMPLINFO
      SET MFA_ENABLED = 1,
          MFA_SECRET = @MFA_SECRET,
          MFA_BACKUP_CODES = @MFA_BACKUP_CODES,
          MFA_SETUP_DATE = GETDATE()
      WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO
    `;

    const result = await queryDB_New(updateQuery, {
      CTR_CD: ctrCd,
      EMPL_NO: emplNo,
      MFA_SECRET: secret,
      MFA_BACKUP_CODES: backupCodesJson,
    });

    if (result.tk_status === "OK") {
      return res.send({
        tk_status: "OK",
        message: "Đã kích hoạt xác thực 2 bước (Google Authenticator) thành công!",
        data: {
          backup_codes: backupCodes,
        },
      });
    }

    return res.send({ tk_status: "NG", message: "Lỗi lưu cấu hình MFA vào cơ sở dữ liệu" });
  } catch (error) {
    console.error("verifyAndEnableMfa error:", error);
    return res.send({ tk_status: "NG", message: error.message });
  }
};

/**
 * 4. Hủy kích hoạt MFA (yêu cầu mật khẩu hoặc OTP để bảo mật)
 */
exports.disableMfa = async (req, res, DATA) => {
  try {
    const { password, otp_code } = DATA || req.body || {};
    const emplNo = req.payload_data?.EMPL_NO || DATA?.EMPL_NO;
    const ctrCd = req.payload_data?.CTR_CD || DATA?.CTR_CD || "002";

    if (!emplNo) {
      return res.send({ tk_status: "NG", message: "Không tìm thấy thông tin tài khoản" });
    }

    if (!password && !otp_code) {
      return res.send({
        tk_status: "NG",
        message: "Vui lòng nhập mật khẩu hoặc mã xác thực để tắt tính năng",
      });
    }

    // Lấy thông tin user hiện tại
    const selectQuery = `
      SELECT PASSWORD, MFA_SECRET, MFA_ENABLED
      FROM ZTBEMPLINFO
      WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO
    `;
    const userResult = await queryDB_New(selectQuery, { CTR_CD: ctrCd, EMPL_NO: emplNo });

    if (userResult.tk_status !== "OK" || userResult.data.length === 0) {
      return res.send({ tk_status: "NG", message: "Không tìm thấy tài khoản" });
    }

    const userData = userResult.data[0];
    let isAuthorized = false;

    // Kiểm tra qua password
    if (password && userData.PASSWORD === password) {
      isAuthorized = true;
    }
    // Hoặc kiểm tra qua OTP
    else if (otp_code && userData.MFA_SECRET && verifyTOTP(otp_code, userData.MFA_SECRET, 1)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      return res.send({
        tk_status: "NG",
        message: "Mật khẩu hoặc mã xác thực không đúng. Không thể tắt MFA.",
      });
    }

    const updateQuery = `
      UPDATE ZTBEMPLINFO
      SET MFA_ENABLED = 0,
          MFA_SECRET = NULL,
          MFA_BACKUP_CODES = NULL,
          MFA_SETUP_DATE = NULL
      WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO
    `;

    const updateResult = await queryDB_New(updateQuery, {
      CTR_CD: ctrCd,
      EMPL_NO: emplNo,
    });

    if (updateResult.tk_status === "OK") {
      return res.send({
        tk_status: "OK",
        message: "Đã tắt xác thực 2 bước thành công!",
      });
    }

    return res.send({ tk_status: "NG", message: "Lỗi cập nhật trạng thái MFA" });
  } catch (error) {
    console.error("disableMfa error:", error);
    return res.send({ tk_status: "NG", message: error.message });
  }
};

/**
 * 5. Xác thực mã OTP 2FA trong màn hình Login và cấp Token đầy đủ
 */
exports.verifyMfaLogin = async (req, res, DATA) => {
  try {
    const { temp_token, otp_code, user, ctr_cd } = DATA || req.body || {};

    if (!temp_token || !otp_code) {
      return res.send({
        tk_status: "NG",
        message: "Vui lòng cung cấp mã xác thực 2 bước",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(temp_token, "nguyenvanhung");
    } catch (err) {
      return res.send({
        tk_status: "NG",
        message: "Phiên xác thực 2 bước đã hết hạn. Vui lòng đăng nhập lại từ đầu.",
      });
    }

    if (decoded.type !== "MFA_PENDING") {
      return res.send({ tk_status: "NG", message: "Yêu cầu xác thực không hợp lệ" });
    }

    const username = decoded.empl_no || user;
    const branch = decoded.ctr_cd || ctr_cd || "002";

    // Lấy thông tin user đầy đủ cùng secret MFA
    const selectQuery = `
      SELECT ${USER_SELECT_FIELDS}, ZTBEMPLINFO.MFA_SECRET, ZTBEMPLINFO.MFA_BACKUP_CODES
      FROM ZTBEMPLINFO
      ${USER_JOIN_CLAUSES}
      WHERE ZTBEMPLINFO.CTR_CD = @CTR_CD AND ZTBEMPLINFO.EMPL_NO = @EMPL_NO
    `;

    const userResult = await queryDB_New(selectQuery, {
      CTR_CD: branch,
      EMPL_NO: username,
    });

    if (userResult.tk_status !== "OK" || userResult.data.length === 0) {
      return res.send({ tk_status: "NG", message: "Không tìm thấy thông tin tài khoản" });
    }

    const userRow = userResult.data[0];
    const cleanOtp = String(otp_code).trim().toUpperCase();
    let isCodeValid = false;

    // 1. Kiểm tra nếu là mã TOTP 6 số từ Google Authenticator
    if (/^\d{6}$/.test(cleanOtp) && userRow.MFA_SECRET) {
      isCodeValid = verifyTOTP(cleanOtp, userRow.MFA_SECRET, 1);
    }

    // 2. Nếu không đúng hoặc là mã dự phòng, kiểm tra trong MFA_BACKUP_CODES
    if (!isCodeValid && userRow.MFA_BACKUP_CODES) {
      try {
        const backupList = JSON.parse(userRow.MFA_BACKUP_CODES);
        const matchedIndex = backupList.findIndex(
          (code) => String(code).trim().toUpperCase() === cleanOtp
        );

        if (matchedIndex !== -1) {
          isCodeValid = true;
          // Loại bỏ mã dự phòng đã sử dụng
          backupList.splice(matchedIndex, 1);
          await queryDB_New(
            `UPDATE ZTBEMPLINFO SET MFA_BACKUP_CODES = @MFA_BACKUP_CODES WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`,
            {
              CTR_CD: branch,
              EMPL_NO: username,
              MFA_BACKUP_CODES: JSON.stringify(backupList),
            }
          );
        }
      } catch (parseErr) {
        console.error("Lỗi parse backup codes:", parseErr);
      }
    }

    if (!isCodeValid) {
      return res.send({
        tk_status: "NG",
        message: "Mã xác thực không chính xác. Vui lòng kiểm tra lại ứng dụng Google Authenticator.",
      });
    }

    // Đăng nhập 2 bước thành công! Cấp Token JWT 24h đầy đủ
    // Xóa trường nhạy cảm trước khi đóng gói payload
    delete userRow.MFA_SECRET;
    delete userRow.MFA_BACKUP_CODES;

    // Reset LOGIN_ATTEMPT
    await queryDB_New(
      `UPDATE ZTBEMPLINFO SET LOGIN_ATTEMPT = 0, ONLINE_DATETIME = GETDATE() WHERE CTR_CD = @CTR_CD AND EMPL_NO = @EMPL_NO`,
      { CTR_CD: branch, EMPL_NO: username }
    );

    const token = jwt.sign(
      { payload: JSON.stringify([userRow]) },
      "nguyenvanhung",
      { expiresIn: "24h" }
    );

    res.cookie("token", token);
    return res.send({
      tk_status: "OK",
      token_content: token,
      userData: [userRow],
      publicKey: publicKey,
    });
  } catch (error) {
    console.error("verifyMfaLogin error:", error);
    return res.send({ tk_status: "NG", message: error.message });
  }
};
