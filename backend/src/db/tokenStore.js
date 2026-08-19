const { DatabaseSync } = require('node:sqlite')
const path = require('node:path')
const fs = require('node:fs')

// InsanVideo has no visitor-account system of its own. This stores exactly
// one Instagram connection — the site owner's — in a single fixed row.
const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS instagram_connection (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    access_token TEXT NOT NULL,
    ig_user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    connected_at INTEGER NOT NULL
  )
`

function createTokenStore(dbPath) {
  const database = new DatabaseSync(dbPath)
  database.exec(CREATE_TABLE_SQL)

  return {
    saveConnection({ accessToken, igUserId, expiresAt }) {
      database
        .prepare(
          `INSERT INTO instagram_connection (id, access_token, ig_user_id, expires_at, connected_at)
           VALUES (1, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             access_token = excluded.access_token,
             ig_user_id = excluded.ig_user_id,
             expires_at = excluded.expires_at,
             connected_at = excluded.connected_at`
        )
        .run(accessToken, igUserId, expiresAt, Date.now())
    },

    getConnection() {
      const row = database.prepare('SELECT * FROM instagram_connection WHERE id = 1').get()
      if (!row) {
        return null
      }
      return {
        accessToken: row.access_token,
        igUserId: row.ig_user_id,
        expiresAt: row.expires_at,
        connectedAt: row.connected_at,
      }
    },

    clearConnection() {
      database.prepare('DELETE FROM instagram_connection WHERE id = 1').run()
    },

    close() {
      database.close()
    },
  }
}

const DEFAULT_DB_PATH =
  process.env.INSTAGRAM_DB_PATH || path.join(__dirname, '../../data/insanvideo.sqlite')

let defaultStore = null

function getDefaultTokenStore() {
  if (!defaultStore) {
    const dir = path.dirname(DEFAULT_DB_PATH)
    if (DEFAULT_DB_PATH !== ':memory:' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    defaultStore = createTokenStore(DEFAULT_DB_PATH)
  }
  return defaultStore
}

module.exports = { createTokenStore, getDefaultTokenStore, DEFAULT_DB_PATH }
