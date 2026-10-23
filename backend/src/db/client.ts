import pg from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

const { Pool, Client } = pg;

const CONNECTION_STRING = () => process.env.DATABASE_URL || 'postgresql://localhost/ai_fortune';
const IS_WORKER = !!process.env.CF_WORKER;

// 外部のDB（Neon・Render など）は SSL が必須。手元（localhost）は不要
const sslFor = (url: string) => (/localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false });

// ───── Cloudflare Workers 用：リクエストごとに接続を作る ─────
// Workers では、ある通信（リクエスト）で作った接続を、別の通信で使い回せない。
// そこで、1つのリクエストの中では1本の接続を使い回し（requestDb）、リクエストが終わったら閉じる
const scope = new AsyncLocalStorage<{ client?: pg.Client; connecting?: Promise<pg.Client> }>();

function newWorkerClient(): pg.Client {
  const url = CONNECTION_STRING();
  return new Client({ connectionString: url, ssl: sslFor(url), connectionTimeoutMillis: 15000 });
}

/** この関数の中の DB 呼び出しが、同じ接続を使うようにする（終わったら閉じる）。Node では、そのまま実行 */
export async function withDbScope<T>(fn: () => Promise<T>): Promise<T> {
  if (!IS_WORKER) return fn();
  const store: { client?: pg.Client; connecting?: Promise<pg.Client> } = {};
  try {
    return await scope.run(store, fn);
  } finally {
    const c = store.client ?? (await store.connecting?.catch(() => undefined));
    if (c) await c.end().catch(() => undefined);
  }
}

async function scopedClient(): Promise<pg.Client> {
  const store = scope.getStore();
  if (!store) {
    // スコープの外（想定外）：その場だけの接続で実行する
    const c = newWorkerClient();
    await c.connect();
    return c;
  }
  if (store.client) return store.client;
  store.connecting ??= (async () => {
    const c = newWorkerClient();
    await c.connect();
    store.client = c;
    return c;
  })();
  return store.connecting;
}

const workerPool = {
  async query(sql: string, values?: any[]) {
    const store = scope.getStore();
    const c = await scopedClient();
    try {
      return await c.query(sql, values);
    } finally {
      if (!store) await c.end().catch(() => undefined);
    }
  },
  /** トランザクション用：専用の接続を作って返す（release で閉じる） */
  async connect() {
    const c = newWorkerClient();
    await c.connect();
    (c as any).release = () => c.end().catch(() => undefined);
    return c as pg.Client & { release: () => void };
  },
};

// ───── Node 用：従来どおりの接続プール ─────
const nodePool = IS_WORKER
  ? null
  : new Pool({
      connectionString: CONNECTION_STRING(),
      max: 20,
      idleTimeoutMillis: 20000,
      // 外部のDBは、しばらく使わないと接続が切れ、つなぎ直しに数秒かかることがある。2秒では短く、診断の結果の保存に失敗していた
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
      ssl: sslFor(CONNECTION_STRING()),
    });

// 使われていない接続が、DB側から切られても、プログラム全体が、止まらないようにする
nodePool?.on('error', (err) => {
  console.error('[db] pool error (ignored):', err.message);
});

const pool = (nodePool ?? workerPool) as unknown as pg.Pool;

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

    // 既存DB向け: met_at カラム（解放後、初対面イベントを再生済みかどうか。unlocked_atとは別で管理する）
    await client.query(`
      ALTER TABLE character_intimacy ADD COLUMN IF NOT EXISTS met_at TIMESTAMP;
    `);
    // 既存ユーザーのナツメ（チュートリアルで既に出会っている）は初対面イベント対象から除外する
    await client.query(`
      UPDATE character_intimacy SET met_at = unlocked_at
      WHERE character_id = 1 AND met_at IS NULL AND unlocked_at IS NOT NULL;
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

    // 今日の運勢・デイリーミッション
    await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_mission_claims (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day DATE NOT NULL,
        mission_id VARCHAR(30) NOT NULL,
        claimed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, day, mission_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_marks (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day DATE NOT NULL,
        kind VARCHAR(30) NOT NULL,
        PRIMARY KEY (user_id, day, kind)
      )
    `);

    // 図鑑（出会ったタイプ）と、実績のための集計
    await client.query(`
      CREATE TABLE IF NOT EXISTS collection_entries (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(12) NOT NULL,
        code VARCHAR(30) NOT NULL,
        count INT NOT NULL DEFAULT 1,
        first_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, kind, code)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_stats (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(40) NOT NULL,
        value INT NOT NULL DEFAULT 0,
        PRIMARY KEY (user_id, key)
      )
    `);

    // 縁帳（周りの人の記録）：本人だけが見られる。自分の診断結果とは、別の表
    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(30) NOT NULL,
        relation VARCHAR(10) NOT NULL,
        memo VARCHAR(100) NOT NULL DEFAULT '',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_people_user ON people(user_id)`);
    // 招待リンク方式：相手本人が答える（招待トークンは1回限り・期限つき。取り消しトークンは、相手が自分の回答を消すため）
    await client.query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS from_name VARCHAR(30) NOT NULL DEFAULT ''`);
    await client.query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS invite_token VARCHAR(64)`);
    await client.query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS invite_expires TIMESTAMP`);
    await client.query(`ALTER TABLE people ADD COLUMN IF NOT EXISTS revoke_token VARCHAR(64)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_people_invite_token ON people(invite_token)`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_people_revoke_token ON people(revoke_token)`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS person_results (
        person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        kind VARCHAR(12) NOT NULL,
        type_code VARCHAR(20) NOT NULL,
        answers JSONB,
        confidence VARCHAR(10) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (person_id, kind)
      )
    `);

    // ミニゲームの報酬：診断1回につき、1回まで。1日の上限あり（日本時間）
    await client.query(`
      CREATE TABLE IF NOT EXISTS minigame_rewards (
        job_id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        game VARCHAR(30) NOT NULL,
        difficulty VARCHAR(12) NOT NULL,
        stones INT NOT NULL,
        day DATE NOT NULL DEFAULT (((NOW() AT TIME ZONE 'Asia/Tokyo') - INTERVAL '4 hours')::date),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_minigame_rewards_user_day ON minigame_rewards(user_id, day)`);

    // 受信箱：運営からのお知らせ・お詫びの石の配布など。user_id が NULL のものは、全員向け
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_messages (
        id UUID PRIMARY KEY,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        kind VARCHAR(16) NOT NULL DEFAULT 'notice',
        title VARCHAR(80) NOT NULL,
        body TEXT NOT NULL,
        reward_stones INT NOT NULL DEFAULT 0,
        show_on_home BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMP
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_inbox_messages_user ON inbox_messages(user_id, created_at)`);
    // 受信箱の、ユーザーごとの状態（既読・受け取り済み）。受け取りは、1通につき、1人1回（主キーで、二重に渡さない）
    await client.query(`
      CREATE TABLE IF NOT EXISTS inbox_states (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message_id UUID NOT NULL REFERENCES inbox_messages(id) ON DELETE CASCADE,
        read_at TIMESTAMP,
        claimed_at TIMESTAMP,
        PRIMARY KEY (user_id, message_id)
      )
    `);

    // ログインカレンダー：ログインボーナスを受け取った日（朝4時区切りのゲーム日）と、連続ログインのごほうび
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_days (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        day DATE NOT NULL,
        PRIMARY KEY (user_id, day)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS login_streak_rewards (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        streak_start DATE NOT NULL,
        milestone INT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, streak_start, milestone)
      )
    `);

    // 交換所：持っているアイテム（称号・ホームの背景）と、いま身につけているもの
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_items (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_id VARCHAR(40) NOT NULL,
        acquired_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (user_id, item_id)
      )
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profile (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        title_id VARCHAR(40),
        background_id VARCHAR(40)
      )
    `);
    await client.query(`ALTER TABLE user_profile ADD COLUMN IF NOT EXISTS nickname VARCHAR(40)`);
    // 長期ミッションの、受け取り済み（一度きり）
    await client.query(`
      CREATE TABLE IF NOT EXISTS long_claims (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        mission_id VARCHAR(30) NOT NULL,
        PRIMARY KEY (user_id, mission_id)
      )
    `);
    // ウィークリーミッションの、受け取り済み
    await client.query(`
      CREATE TABLE IF NOT EXISTS weekly_claims (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        week DATE NOT NULL,
        mission_id VARCHAR(30) NOT NULL,
        PRIMARY KEY (user_id, week, mission_id)
      )
    `);

    // 手相のPC↔スマホ連携の一時セッション（写真は、最長10分・診断の完了で消す）
    await client.query(`
      CREATE TABLE IF NOT EXISTS palm_sessions (
        token VARCHAR(64) PRIMARY KEY,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        image_base64 TEXT,
        mime_type VARCHAR(64),
        lines JSONB,
        retake_message TEXT,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    // 回数制限（1日の診断回数・招待ページの連打対策）の、カウンター（サーバーが複数ある Workers では、メモリでは数えられない）
    await client.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        hits INT NOT NULL,
        reset_at TIMESTAMPTZ NOT NULL
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
