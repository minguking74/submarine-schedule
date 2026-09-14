import pg from 'pg';

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required (Supabase Postgres connection string)');
}

const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
});

/** Rewrites sqlite-style `?` / `@name` placeholders into Postgres `$1, $2, ...`. */
function normalize(sql, args) {
  if (/@[a-zA-Z_][a-zA-Z0-9_]*/.test(sql)) {
    const names = [];
    const text = sql.replace(/@([a-zA-Z_][a-zA-Z0-9_]*)/g, (_, name) => {
      names.push(name);
      return `$${names.length}`;
    });
    const obj = args[0] ?? {};
    return { text, values: names.map((n) => obj[n] ?? null) };
  }
  if (sql.includes('?')) {
    let i = 0;
    const text = sql.replace(/\?/g, () => `$${++i}`);
    return { text, values: args };
  }
  return { text: sql, values: args };
}

// Thin async wrapper providing the same .prepare(sql).run/get/all(...) shape used
// throughout this codebase, backed by `pg` against Supabase Postgres instead of
// the previous node:sqlite/better-sqlite3-style local file database.
export const db = {
  pool,
  exec: (sql) => pool.query(sql),
  prepare: (sql) => ({
    run: async (...args) => {
      const { text, values } = normalize(sql, args);
      const result = await pool.query(text, values);
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
    },
    get: async (...args) => {
      const { text, values } = normalize(sql, args);
      const result = await pool.query(text, values);
      return result.rows[0];
    },
    all: async (...args) => {
      const { text, values } = normalize(sql, args);
      const result = await pool.query(text, values);
      return result.rows;
    },
  }),
};
