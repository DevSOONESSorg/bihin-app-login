// =====================================================
// ログイン / ログアウト / パスワード変更
// =====================================================
const express = require('express');
const users = require('./users');
const config = require('../config');
const { requireLogin } = require('./middleware');

const router = express.Router();

// ---------- ログイン画面 ----------
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { title: 'ログイン', username: '', errors: [] });
});

// ---------- ログイン処理 ----------
router.post('/login', (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';
  const fail = (message) => {
    users.log(username || '(空)', 'login_failed', null, message);
    // 「IDが違う」「パスワードが違う」を区別して教えない（攻撃者にヒントを与えないため）
    return res.status(401).render('login', { title: 'ログイン', username, errors: [message] });
  };

  const user = users.findByUsername(username);
  if (!user) return fail('ログインIDまたはパスワードが違います。');
  if (!user.is_active) return fail('このアカウントは無効化されています。情シスに連絡してください。');
  if (users.isLocked(user)) return fail(`パスワードを${config.LOGIN_MAX_FAILS}回間違えたためロック中です。${config.LOCK_MINUTES}分後に再度お試しください。`);

  if (!users.checkPassword(password, user.password_hash)) {
    const result = users.recordLoginFailure(user.id, config.LOGIN_MAX_FAILS, config.LOCK_MINUTES);
    if (result.locked) return fail(`パスワードを${config.LOGIN_MAX_FAILS}回間違えたためロックしました。`);
    return fail(`ログインIDまたはパスワードが違います。（あと${result.remaining}回でロック）`);
  }

  // ---- ここから成功 ----
  users.recordLoginSuccess(user.id);
  users.log(user.username, 'login');

  // セッション固定攻撃を防ぐため、ログイン成功時にセッションIDを作り直す
  req.session.regenerate((err) => {
    if (err) throw err;
    req.session.user = users.publicUser(user);   // ← これが「ログイン済み」の印
    const returnTo = req.session.returnTo || '/';
    delete req.session.returnTo;
    res.redirect(returnTo);
  });
});

// ---------- ログアウト ----------
router.post('/logout', (req, res) => {
  const name = req.session.user ? req.session.user.username : '(未ログイン)';
  req.session.destroy(() => {
    users.log(name, 'logout');
    res.clearCookie('sid');
    res.redirect('/login?msg=' + encodeURIComponent('ログアウトしました。'));
  });
});

// ---------- パスワード変更（本人） ----------
router.get('/password', requireLogin, (req, res) => {
  res.render('password', { title: 'パスワード変更', errors: [] });
});

router.post('/password', requireLogin, (req, res) => {
  const current = req.body.current || '';
  const next1 = req.body.next1 || '';
  const next2 = req.body.next2 || '';
  const user = users.findById(req.session.user.id);

  const errors = [];
  if (!users.checkPassword(current, user.password_hash)) errors.push('現在のパスワードが違います。');
  if (next1.length < config.PASSWORD_MIN) errors.push(`新しいパスワードは${config.PASSWORD_MIN}文字以上にしてください。`);
  if (next1 !== next2) errors.push('新しいパスワード（確認）が一致しません。');
  if (next1 === current && next1 !== '') errors.push('現在と同じパスワードは使えません。');
  if (errors.length) return res.status(400).render('password', { title: 'パスワード変更', errors });

  users.changePassword(user.id, next1);
  users.log(user.username, 'password_change');
  req.session.user.must_change_password = false;
  res.redirect('/?msg=' + encodeURIComponent('パスワードを変更しました。'));
});

module.exports = router;
