// =====================================================
// ユーザーの読み書きと、パスワードの扱い
//
// ★ここが一番大事★
//   パスワードは絶対にそのまま保存しない。
//   bcrypt で「ハッシュ」に変換して保存し、ログイン時は
//   入力されたパスワードをもう一度ハッシュして「一致するか」だけを見る。
//   ハッシュから元のパスワードは戻せない → DBが漏れてもパスワードは漏れない。
// =====================================================
const bcrypt = require('bcryptjs');
const db = require('../db');

const HASH_ROUNDS = 10; // 大きいほど安全だが遅くなる。10〜12 が一般的

function hashPassword(plain) {
  return bcrypt.hashSync(plain, HASH_ROUNDS);
}

function checkPassword(plain, hash) {
  return bcrypt.compareSync(plain, hash);
}

function findByUsername(username) {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username);
}

function findById(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function listAll() {
  return db.prepare('SELECT * FROM users ORDER BY id').all();
}

function create({ username, password, display_name, role, must_change_password = 1 }) {
  return db
    .prepare(
      `INSERT INTO users (username, password_hash, display_name, role, must_change_password)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(username, hashPassword(password), display_name, role, must_change_password ? 1 : 0);
}

function update(id, { display_name, role }) {
  db.prepare('UPDATE users SET display_name = ?, role = ? WHERE id = ?').run(display_name, role, id);
}

// 退職・休職などは「削除」ではなく「無効化」。履歴（誰が借りたか等）が壊れないようにするため
function setActive(id, active) {
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(active ? 1 : 0, id);
}

// 管理者によるパスワードリセット：仮パスワードにして、次回ログイン時に本人が変える
function resetPassword(id, tempPassword) {
  db.prepare(
    'UPDATE users SET password_hash = ?, must_change_password = 1, failed_count = 0, locked_until = NULL WHERE id = ?'
  ).run(hashPassword(tempPassword), id);
}

// 本人によるパスワード変更
function changePassword(id, newPassword) {
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
    hashPassword(newPassword),
    id
  );
}

function recordLoginFailure(id, maxFails, lockMinutes) {
  const user = findById(id);
  const fails = user.failed_count + 1;
  if (fails >= maxFails) {
    const until = new Date(Date.now() + lockMinutes * 60 * 1000);
    db.prepare('UPDATE users SET failed_count = ?, locked_until = ? WHERE id = ?').run(
      fails,
      until.toISOString(),
      id
    );
    return { locked: true };
  }
  db.prepare('UPDATE users SET failed_count = ? WHERE id = ?').run(fails, id);
  return { locked: false, remaining: maxFails - fails };
}

function recordLoginSuccess(id) {
  db.prepare(
    "UPDATE users SET failed_count = 0, locked_until = NULL, last_login_at = datetime('now', 'localtime') WHERE id = ?"
  ).run(id);
}

function isLocked(user) {
  return user.locked_until && new Date(user.locked_until) > new Date();
}

// 画面やセッションに入れてよい情報だけを取り出す（password_hash は絶対に含めない）
function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    display_name: user.display_name,
    role: user.role,
    must_change_password: user.must_change_password === 1,
  };
}

// 監査ログ
function log(actor, action, target = null, detail = null) {
  db.prepare('INSERT INTO audit_logs (actor, action, target, detail) VALUES (?, ?, ?, ?)').run(
    actor,
    action,
    target,
    detail
  );
}

function listLogs(limit = 100) {
  return db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit);
}

// ---------- 初期データ ----------
// ユーザーが1人もいないときだけ作る。パスワードは教材用のダミー。本番では絶対に使わない。
// ※ 'password' のような有名な文字列にすると、Chrome が「漏えいしたパスワードです」と警告を出すので避けている
function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;
  create({ username: 'admin', password: 'Taiken-2026', display_name: '新垣（総務）', role: 'admin', must_change_password: 0 });
  create({ username: 'higa', password: 'Taiken-2026', display_name: '比嘉', role: 'staff', must_change_password: 0 });
  create({ username: 'kinjo', password: 'Taiken-2026', display_name: '金城', role: 'staff', must_change_password: 1 });
  log('system', 'seed', null, '初期ユーザーを作成');
}
seedIfEmpty();

module.exports = {
  hashPassword,
  checkPassword,
  findByUsername,
  findById,
  listAll,
  create,
  update,
  setActive,
  resetPassword,
  changePassword,
  recordLoginFailure,
  recordLoginSuccess,
  isLocked,
  publicUser,
  log,
  listLogs,
};
