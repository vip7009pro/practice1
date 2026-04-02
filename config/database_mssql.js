const sql = require("mssql");
require("dotenv").config();

const DEFAULT_POOL_SIZE = parseInt(process.env.DB_POOL_MAX || "20", 10) || 20;

const normalizeEnvString = (value) => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const config = {
  user: normalizeEnvString(process.env.DB_USER),
  password: typeof process.env.DB_PASS === "string" ? process.env.DB_PASS : undefined,
  server: normalizeEnvString(process.env.DB_SERVER),
  database: normalizeEnvString(process.env.DB_NAME),
  port: Number.isFinite(parseInt(process.env.DB_PORT || "", 10))
    ? parseInt(process.env.DB_PORT || "", 10)
    : undefined,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
    useUTC: true,
  },
  requestTimeout: 300000,
  connectionTimeout: 300000,
  pool: {
    max: DEFAULT_POOL_SIZE,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const escapeSqlString = (value) => String(value).replace(/'/g, "''");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatSqlValue = (value) => {
  if (value === null || value === undefined) {
    return "NULL";
  }

  if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, "value")) {
    return formatSqlValue(value.value);
  }

  if (value instanceof Date) {
    return `'${value.toISOString().replace("T", " ").replace("Z", "")}'`;
  }

  if (Buffer.isBuffer(value)) {
    return `0x${value.toString("hex")}`;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }

  return `N'${escapeSqlString(String(value))}'`;
};

const interpolateSql = (query, params = {}) => {
  if (!params || typeof params !== "object") {
    return query;
  }

  const paramNames = Object.keys(params).sort((a, b) => b.length - a.length);
  let finalQuery = query;

  for (const name of paramNames) {
    const rawValue = params[name] && typeof params[name] === "object" && Object.prototype.hasOwnProperty.call(params[name], "value")
      ? params[name].value
      : params[name];
    const placeholder = new RegExp(`@${escapeRegExp(name)}\\b`, "g");
    finalQuery = finalQuery.replace(placeholder, formatSqlValue(rawValue));
  }

  return finalQuery;
};

const normalizeQueryResult = (result) => {
  const recordsets = Array.isArray(result?.recordsets) ? result.recordsets : [];
  const recordset = Array.isArray(result?.recordset)
    ? result.recordset
    : (recordsets.length > 0 && Array.isArray(recordsets[0]) ? recordsets[0] : undefined);
  const rowsAffected = Array.isArray(result?.rowsAffected) && result.rowsAffected.length > 0
    ? [...result.rowsAffected]
    : [Array.isArray(recordset) ? recordset.length : 0];

  return {
    recordset,
    recordsets: recordsets.length > 0 ? recordsets : (Array.isArray(recordset) ? [recordset] : []),
    results: recordsets.length > 0 ? recordsets : (Array.isArray(recordset) ? [recordset] : []),
    rowsAffected,
    counts: [...rowsAffected],
    output: result?.output,
    raw: result,
  };
};

class RequestAdapter {
  constructor(pool) {
    this.pool = pool;
    this.params = {};
  }

  input(name, typeOrValue, value) {
    this.params[name] = arguments.length >= 3 ? value : typeOrValue;
    return this;
  }

  async query(queryText) {
    const finalQuery = interpolateSql(queryText, this.params);
    return this.pool.query(finalQuery);
  }
}

class PoolAdapter {
  constructor(pool) {
    this.pool = pool;
  }

  request() {
    return new RequestAdapter(this);
  }

  async query(queryText, params = {}) {
    const finalQuery = interpolateSql(queryText, params);
    const result = await this.pool.request().query(finalQuery);
    return normalizeQueryResult(result);
  }

  async close() {
    return this.pool.close();
  }
}

class DedicatedConnectionAdapter {
  constructor(pool) {
    this.pool = pool;
    this.transaction = null;
    this.promises = {
      beginTransaction: async (...args) => {
        if (this.transaction) {
          throw new Error("Transaction already started");
        }

        this.transaction = new sql.Transaction(this.pool);
        await this.transaction.begin(...args);
      },
      query: async (queryText, params = {}) => {
        const finalQuery = interpolateSql(queryText, params);
        const result = this.transaction
          ? await new sql.Request(this.transaction).query(finalQuery)
          : await this.pool.request().query(finalQuery);
        return normalizeQueryResult(result);
      },
      commit: async () => {
        if (!this.transaction) {
          return;
        }

        await this.transaction.commit();
        this.transaction = null;
      },
      rollback: async () => {
        if (!this.transaction) {
          return;
        }

        try {
          await this.transaction.rollback();
        } finally {
          this.transaction = null;
        }
      },
      close: async () => {
        if (this.transaction) {
          try {
            await this.transaction.rollback();
          } catch (error) {
            console.log("Dedicated connection rollback error:", error?.message || error);
          } finally {
            this.transaction = null;
          }
        }

        await this.pool.close();
      },
    };
  }
}

let poolPromise;

const createPool = async () => {
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  return new PoolAdapter(pool);
};

const openConnection = async () => {
  if (!poolPromise) {
    poolPromise = createPool().catch((err) => {
      console.error("Database connection error:", err);
      poolPromise = null;
      throw err;
    });
  }

  return poolPromise;
};

const openDedicatedConnection = async () => {
  const pool = new sql.ConnectionPool(config);
  await pool.connect();
  return new DedicatedConnectionAdapter(pool);
};

const executeQuery = async (query, params = {}) => {
  const pool = await openConnection();
  const request = pool.request();

  if (params && typeof params === "object") {
    for (const key of Object.keys(params)) {
      request.input(key, params[key]);
    }
  }

  return request.query(query);
};

const queryDB_New = async (query, params = {}) => {
  try {
    const result = await executeQuery(query, params);
    if (result.rowsAffected[0] > 0) {
      if (result.recordset !== undefined) {
        return { tk_status: "OK", data: result.recordset };
      }
      return { tk_status: "OK", message: "Modify data thanh cong" };
    }
    return { tk_status: "NG", message: "Không có dòng dữ liệu nào" };
  } catch (error) {
    console.log("Query error:", error);
    return { tk_status: "NG", message: `${error} ` };
  }
};

const queryDB_New2 = async (baseQuery, params = {}, conditions = []) => {
  try {
    let finalQuery = baseQuery;
    const queryParams = {};

    if (Array.isArray(conditions) && conditions.length > 0) {
      for (const condition of conditions) {
        const { placeholder, clause, paramName, like, skipValues = [] } = condition;
        const currentValue = params[paramName];
        if (currentValue !== undefined && currentValue !== null && !skipValues.includes(currentValue)) {
          let paramValue = currentValue;
          if (like) {
            if (like === "both") {
              paramValue = `%${paramValue}%`;
            } else if (like === "left") {
              paramValue = `%${paramValue}`;
            } else if (like === "right") {
              paramValue = `${paramValue}%`;
            }
          }
          queryParams[paramName] = paramValue;
          finalQuery = finalQuery.replace(placeholder, clause);
        } else {
          finalQuery = finalQuery.replace(placeholder, "");
        }
      }

      const result = await executeQuery(finalQuery, queryParams);
      if (result.rowsAffected[0] > 0) {
        if (result.recordset !== undefined) {
          return { tk_status: "OK", data: result.recordset };
        }
        return { tk_status: "OK", message: "Modify data thanh cong" };
      }
      return { tk_status: "NG", message: "Không có dòng dữ liệu nào" };

    }

    const result = await executeQuery(finalQuery, params);
    if (result.rowsAffected[0] > 0) {
      if (result.recordset !== undefined) {
        return { tk_status: "OK", data: result.recordset };
      }
      return { tk_status: "OK", message: "Modify data thanh cong" };
    }
    return { tk_status: "NG", message: "Không có dòng dữ liệu nào" };
  } catch (error) {
    console.log("Query error:", error);
    return { tk_status: "NG", message: error.toString() };
  }
};

const queryDB = async (query) => {
  try {
    const result = await executeQuery(query);
    if (result.rowsAffected[0] > 0) {
      if (result.recordset !== undefined) {
        return { tk_status: "OK", data: result.recordset };
      }
      return { tk_status: "OK", message: "Modify data thanh cong" };
    }
    return { tk_status: "NG", message: "Không có dòng dữ liệu nào" };
  } catch (error) {
    console.log("Query error:", error);
    return { tk_status: "NG", message: `${error} ` };
  }
};

const closePool = async () => {
  if (poolPromise) {
    const pool = await poolPromise;
    await pool.close();
    poolPromise = null;
    console.log("Database pool closed");
  }
};

function asyncQuery(queryString) {
  return new Promise((resolve) => {
    executeQuery(queryString)
      .then((result) => {
        const rs = result.recordset || [];
        if (rs.length !== 0) {
          resolve(JSON.stringify(rs));
        } else {
          resolve(0);
        }
      })
      .catch(() => {
        resolve(0);
      });
  });
}

module.exports = {
  openConnection,
  openDedicatedConnection,
  queryDB,
  queryDB_New,
  queryDB_New2,
  asyncQuery,
  closePool,
  config,
  formatSqlValue,
  interpolateSql,
};

process.on("SIGINT", async () => {
  await closePool();
  process.exit(0);
});