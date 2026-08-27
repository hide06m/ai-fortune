import { Pool } from 'pg';

// PostgreSQL コネクションプール
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/ai_fortune',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

/**
 * DB 接続の初期化・テーブル作成
 */
export async function initializeDatabase() {
  try {
    const client = await pool.connect();

    // users テーブル
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255),
        picture TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // インデックス作成
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
    `);

    // readings テーブル（既存）
    await client.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        birth_date DATE,
        birth_time TIME,
        birth_place VARCHAR(255),
        concern TEXT,
        bazi_result JSONB,
        numerology_result JSONB,
        kyusei_result JSONB,
        llm_analysis TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // feedback テーブル（既存）
    await client.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id UUID PRIMARY KEY,
        reading_id UUID REFERENCES readings(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Database initialized successfully');
    client.release();
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

/**
 * ユーザーを取得（email から）
 */
export async function getUserByEmail(email: string) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    throw error;
  }
}

/**
 * ユーザーを取得（google_id から）
 */
export async function getUserByGoogleId(googleId: string) {
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE google_id = $1',
      [googleId]
    );
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error fetching user by google_id:', error);
    throw error;
  }
}

/**
 * 新規ユーザーを作成
 */
export async function createUser(userId: string, googleId: string, email: string, name: string, picture: string | null) {
  try {
    const result = await pool.query(
      `INSERT INTO users (id, google_id, email, name, picture)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, googleId, email, name, picture]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

/**
 * DB コネクション取得
 */
export function getPool() {
  return pool;
}

/**
 * DB 接続テスト
 */
export async function testConnection() {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}
