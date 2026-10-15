import { Pool } from 'pg';

// PostgreSQL コネクションプール
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost/ai_fortune',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  // Render のような外部 PostgreSQL は SSL が必須
  ssl: process.env.DATABASE_URL?.includes('render.com') ? { rejectUnauthorized: false } : false,
});

/**
 * DB クエリ実行（wrapper）
 */
export function query(sql: string, values?: any[]) {
  return pool.query(sql, values);
}

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
        stone_balance INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 既存ユーザー向け: stone_balance カラムが無ければ追加
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS stone_balance INT NOT NULL DEFAULT 0;
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
        character_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 既存DB向け: character_id カラムが無ければ追加（診断履歴にどのキャラで占ったか残すため）
    await client.query(`
      ALTER TABLE readings ADD COLUMN IF NOT EXISTS character_id INT;
    `);

    // 既存DB向け: bazi_key カラム（同一命式・悩みなしの重複診断を検出するため）
    await client.query(`
      ALTER TABLE readings ADD COLUMN IF NOT EXISTS bazi_key VARCHAR(50);
    `);

    // 既存DB向け: western_zodiac_result カラム（ツキ＝西洋占星術専用。他キャラの診断ではNULLのまま）
    await client.query(`
      ALTER TABLE readings ADD COLUMN IF NOT EXISTS western_zodiac_result JSONB;
    `);

    // 既存DB向け: mbti_result カラム（クリ＝16タイプ診断専用。生年月日を使わないため他の列はNULLになる）
    await client.query(`
      ALTER TABLE readings ADD COLUMN IF NOT EXISTS mbti_result JSONB;
    `);

    // 既存DB向け: love_type_result カラム（クリ＝恋愛タイプ診断64専用）
    await client.query(`
      ALTER TABLE readings ADD COLUMN IF NOT EXISTS love_type_result JSONB;
    `);

    // 既存DB向け: met_at カラム（解放後、初対面イベントを再生済みかどうか。unlocked_atとは別で管理する）
    await client.query(`
      ALTER TABLE character_intimacy ADD COLUMN IF NOT EXISTS met_at TIMESTAMP;
    `);
    // 既存ユーザーのナツメ（チュートリアルで既に出会っている）は初対面イベント対象から除外する
    await client.query(`
      UPDATE character_intimacy SET met_at = unlocked_at
      WHERE character_id = 1 AND met_at IS NULL AND unlocked_at IS NOT NULL;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_readings_user_id_created_at ON readings(user_id, created_at DESC);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_readings_user_id_bazi_key ON readings(user_id, bazi_key);
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

    // character_intimacy テーブル（新規）
    await client.query(`
      CREATE TABLE IF NOT EXISTS character_intimacy (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        character_id INT NOT NULL CHECK (character_id BETWEEN 0 AND 4),
        intimacy_level INT NOT NULL DEFAULT 0 CHECK (intimacy_level BETWEEN 0 AND 10),
        total_diagnoses INT NOT NULL DEFAULT 0,
        last_diagnosis_date TIMESTAMP,
        unlocked_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, character_id)
      )
    `);

    // intimacy_points（ハート内の細かい進捗、0-1000）を追加。既存行は intimacy_level*100 で初期値を補完
    await client.query(`
      ALTER TABLE character_intimacy ADD COLUMN IF NOT EXISTS intimacy_points INT NOT NULL DEFAULT 0
        CHECK (intimacy_points BETWEEN 0 AND 1000);
    `);
    await client.query(`
      UPDATE character_intimacy SET intimacy_points = intimacy_level * 100
      WHERE intimacy_points = 0 AND intimacy_level > 0;
    `);

    // character_intimacy インデックス
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_character_intimacy_user_id ON character_intimacy(user_id);
      CREATE INDEX IF NOT EXISTS idx_character_intimacy_character_id ON character_intimacy(character_id);
      CREATE INDEX IF NOT EXISTS idx_character_intimacy_user_char ON character_intimacy(user_id, character_id);
    `);

    // updated_at トリガー
    await client.query(`
      CREATE OR REPLACE FUNCTION update_character_intimacy_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trigger_character_intimacy_updated_at ON character_intimacy;
      CREATE TRIGGER trigger_character_intimacy_updated_at
      BEFORE UPDATE ON character_intimacy
      FOR EACH ROW
      EXECUTE FUNCTION update_character_intimacy_timestamp();
    `);

    // stone_transactions テーブル（石の獲得・消費履歴。残高は users.stone_balance に集約するが、
    // 「今日もうログインボーナスを受け取ったか」等の判定や不正調査のため履歴を残す）
    await client.query(`
      CREATE TABLE IF NOT EXISTS stone_transactions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INT NOT NULL,
        reason VARCHAR(50) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_stone_transactions_user_id ON stone_transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_stone_transactions_user_reason_date
        ON stone_transactions(user_id, reason, created_at);
    `);

    // latest_results テーブル：各診断の「最新の結果」（ルーンストーンなしで見返せる。種類ごとに、ユーザーあたり1件）
    await client.query(`
      CREATE TABLE IF NOT EXISTS latest_results (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(30) NOT NULL,
        payload JSONB NOT NULL,
        saved_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, kind)
      )
    `);

    // diagnosis_jobs テーブル：「受付して、できたら知らせる」診断の、受付状況と結果
    await client.query(`
      CREATE TABLE IF NOT EXISTS diagnosis_jobs (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(30) NOT NULL,
        status VARCHAR(10) NOT NULL DEFAULT 'running',
        http_status INTEGER,
        body JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        finished_at TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_diagnosis_jobs_user ON diagnosis_jobs(user_id, created_at DESC)`);

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
