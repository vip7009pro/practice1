# Current Context

- Entry point: [index.js](index.js)
- There is a geo-IP middleware in `index.js`, but `GEOIP_BYPASS = true`, so it returns early and does not block requests.
- If bypass is turned off, only country `VN` is allowed and other countries receive HTTP 403 with `Access denied: country not allowed`.
- CORS middleware runs before the geo-IP check.
- **File Upload Improvement (2026-06-24)**: Updated `routes/fileUpload.js` to automatically check and recursively create `TEMP_UPLOAD_FOLDER` (via `fs.mkdirSync`) if it doesn't exist, resolving the 400 Bad Request error when uploading files.
- **NCR Database & API Updates (2026-06-24)**: Added `COUNTERMEASURE` (VARCHAR(10) DEFAULT 'N') and `COUNTERMEASURE_EXT` (VARCHAR(10) DEFAULT '') columns to table `ZTB_IQC_NCRTB`. Added backend endpoints `update_ncr_process_status` and `update_ncr_countermeasure` in `services/qcService.js`. Explicitly populated these columns in `insertNCRData`.