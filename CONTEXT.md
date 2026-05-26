# Current Context

- Entry point: [index.js](index.js)
- There is a geo-IP middleware in `index.js`, but `GEOIP_BYPASS = true`, so it returns early and does not block requests.
- If bypass is turned off, only country `VN` is allowed and other countries receive HTTP 403 with `Access denied: country not allowed`.
- CORS middleware runs before the geo-IP check.