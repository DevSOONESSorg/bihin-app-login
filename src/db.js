// =====================================================
// データベース（SQLite）
// テーブルの定義と、最初に入れるサンプルデータはここにあります。
// DBファイルは data/bihin.db に保存されます。
// =====================================================

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const dates = require('./dates');

const DB_PATH = path.join(__dirname, '..', 'data', 'bihin.db');

// data フォルダがなければ作る
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('foreign_keys = ON');

// ---------- テーブル定義 ----------
// items  : 備品そのもの（1行 = 1つの備品）
// loans  : 貸出の記録（1行 = 1回の貸し借り。returned_on が空なら「まだ返っていない」）
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL,                 -- 備品名
    category   TEXT NOT NULL DEFAULT '',      -- 分類
    location   TEXT NOT NULL DEFAULT '',      -- 保管場所
    status     TEXT NOT NULL DEFAULT 'available', -- available / lent / repair
    note       TEXT NOT NULL DEFAULT '',      -- メモ
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS loans (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    borrower    TEXT NOT NULL,                -- 借りた人
    lent_on     TEXT NOT NULL,                -- 貸出日   (YYYY-MM-DD)
    due_on      TEXT NOT NULL,                -- 返却期限 (YYYY-MM-DD)
    returned_on TEXT,                         -- 返却日   (NULL = 貸出中)
    created_at  TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  );
`);

// ---------- サンプルデータ ----------
// 備品が1件もないときだけ入れる（初回起動時）
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM items').get().c;
  if (count > 0) return;

  const insertItem = db.prepare(
    'INSERT INTO items (name, category, location, status, note) VALUES (?, ?, ?, ?, ?)'
  );
  const insertLoan = db.prepare(
    'INSERT INTO loans (item_id, borrower, lent_on, due_on, returned_on) VALUES (?, ?, ?, ?, ?)'
  );

  const today = dates.today();

  const items = [
    ['ノートPC A-01', 'パソコン', '2階 サーバー室', 'lent', 'Windows11 / 貸出用'],
    ['ノートPC A-02', 'パソコン', '2階 サーバー室', 'available', 'Windows11 / 貸出用'],
    ['ノートPC A-03', 'パソコン', '2階 サーバー室', 'repair', 'キーボード不良で修理中'],
    ['プロジェクター P-1', '周辺機器', '1階 会議室棚', 'lent', 'HDMIケーブル付き'],
    ['モバイルモニター', '周辺機器', '2階 総務ロッカー', 'available', ''],
    ['電動ドライバー', '工具', '倉庫 A棚', 'available', ''],
    ['レーザー距離計', '工具', '倉庫 A棚', 'lent', ''],
    ['ラベルプリンター', '文具', '1階 総務カウンター', 'available', 'テープ在庫は総務へ'],
  ];

  const insertAll = db.transaction(() => {
    const ids = items.map((row) => insertItem.run(...row).lastInsertRowid);

    // 貸出中のもの（1つは返却期限を過ぎている＝延滞）
    insertLoan.run(ids[0], '比嘉', dates.addDays(today, -20), dates.addDays(today, -6), null); // 延滞
    insertLoan.run(ids[3], '金城', dates.addDays(today, -3), dates.addDays(today, 11), null);
    insertLoan.run(ids[6], '宮城', dates.addDays(today, -1), dates.addDays(today, 13), null);

    // 過去に返却済みの記録
    insertLoan.run(ids[1], '大城', dates.addDays(today, -40), dates.addDays(today, -26), dates.addDays(today, -28));
    insertLoan.run(ids[5], '比嘉', dates.addDays(today, -10), dates.addDays(today, 4), dates.addDays(today, -2));
  });
  insertAll();
}

seedIfEmpty();

module.exports = db;
