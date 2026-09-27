import type { Db } from "./index";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "001_auth",
    sql: `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'admin',
        status TEXT NOT NULL DEFAULT 'active',
        must_change_password INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        last_login_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id INTEGER NOT NULL,
        profile_name TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, profile_name)
      );
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL,
        ip TEXT,
        ua TEXT
      );
      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip TEXT NOT NULL,
        username TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        locked_until INTEGER,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_id INTEGER,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id TEXT,
        at INTEGER NOT NULL,
        ip TEXT,
        detail TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_profiles_user ON user_profiles(user_id);
    `,
  },
  {
    version: 2,
    name: "002_avatar",
    sql: `
      ALTER TABLE users ADD COLUMN avatar TEXT;
    `,
  },
  {
    version: 3,
    name: "003_connections",
    sql: `
      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        url TEXT NOT NULL,
        token TEXT,
        created_at INTEGER NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_connections_default ON connections(is_default);
    `,
  },
  {
    version: 4,
    name: "004_oidc",
    sql: `
      ALTER TABLE users ADD COLUMN external_id TEXT;
      ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'password';
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_external
        ON users(auth_provider, external_id) WHERE external_id IS NOT NULL;
    `,
  },
];

export function migrate(db: Db): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT version FROM _migrations")
      .all()
      .map((row) => (row as { version: number }).version),
  );

  const record = db.prepare(
    "INSERT INTO _migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );

  let latest = 0;
  const pending = MIGRATIONS.slice().sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    if (applied.has(migration.version)) {
      latest = Math.max(latest, migration.version);
      continue;
    }
    const run = db.transaction(() => {
      db.exec(migration.sql);
      record.run(migration.version, migration.name, Date.now());
    });
    run();
    latest = migration.version;
  }

  return latest;
}
