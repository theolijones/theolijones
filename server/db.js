import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true'
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err.message);
});

// ---------------------------------------------------------------------------
// Migration runner
// ---------------------------------------------------------------------------

export async function runMigrations() {
  const client = await pool.connect();
  try {
    // Ensure the bookkeeping table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name       VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMPTZ  DEFAULT NOW()
      );
    `);

    // Collect already-applied migrations
    const { rows: applied } = await client.query(
      'SELECT name FROM _migrations ORDER BY name',
    );
    const appliedSet = new Set(applied.map((r) => r.name));

    // Read migration files from /migrations, sorted by filename
    const migrationsDir = path.resolve(__dirname, '..', 'migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      if (appliedSet.has(file)) {
        console.log(`[DB] Migration already applied: ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
      console.log(`[DB] Applying migration: ${file}`);

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO _migrations (name) VALUES ($1)',
          [file],
        );
        await client.query('COMMIT');
        console.log(`[DB] Migration applied: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[DB] Migration failed (${file}):`, err.message);
        throw err;
      }
    }

    console.log('[DB] All migrations up to date');
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Seed default admin user
// ---------------------------------------------------------------------------

const DEFAULT_ADMIN_EMAIL = 'admin@ipsentinel.local';
const DEFAULT_ADMIN_PASSWORD = 'ChangeMe123!';

export async function seedAdmin() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS count FROM users');

  if (rows[0].count > 0) {
    console.log('[DB] Users table is not empty — skipping admin seed');
    return;
  }

  const hash = await bcrypt.hash(DEFAULT_ADMIN_PASSWORD, 12);

  await pool.query(
    `INSERT INTO users (email, password_hash, role, name)
     VALUES ($1, $2, 'admin', 'Admin')`,
    [DEFAULT_ADMIN_EMAIL, hash],
  );

  console.log('[DB] ============================================');
  console.log('[DB]  Default admin account created');
  console.log(`[DB]  Email:    ${DEFAULT_ADMIN_EMAIL}`);
  console.log(`[DB]  Password: ${DEFAULT_ADMIN_PASSWORD}`);
  console.log('[DB]  ** Change this password immediately **');
  console.log('[DB] ============================================');
}

export default pool;
