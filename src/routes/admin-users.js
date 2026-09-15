// =====================================================
// ユーザー管理（情シスの仕事）  /admin/users
//   一覧 / 新規発行 / 編集（表示名・役割） / 無効化・有効化 / パスワードリセット / 監査ログ
// すべて admin 権限が必要
// =====================================================
const express = require('express');
const users = require('../auth/users');
const config = require('../config');
const { requireRole } = require('../auth/middleware');

const router = express.Router();
router.use(requireRole('admin')); // このファイルのルート全部に適用

// 仮パスワードを作る（例: Tmp-8k3f2a）。情シスが本人に伝える
function makeTempPassword() {
  return 'Tmp-' + Math.random().toString(36).slice(2, 8);
}

router.get('/', (req, res) => {
  res.render('admin/users', { title: 'ユーザー管理', list: users.listAll(), roleLabels: config.ROLE_LABELS });
});

router.get('/new', (req, res) => {
  res.render('admin/user-form', {
    title: 'アカウント発行',
    user: { username: '', display_name: '', role: 'staff' },
    roleLabels: config.ROLE_LABELS,
    errors: [],
    action: '/admin/users',
    isNew: true,
  });
});

router.post('/', (req, res) => {
  const username = (req.body.username || '').trim();
  const display_name = (req.body.display_name || '').trim();
  const role = req.body.role;
  const errors = [];
  if (!/^[a-z0-9_.-]{3,20}$/.test(username)) errors.push('ログインIDは半角英数（小文字）3〜20文字にしてください。');
  if (display_name === '') errors.push('表示名を入力してください。');
  if (!config.ROLE_LABELS[role]) errors.push('役割が正しくありません。');
  if (users.findByUsername(username)) errors.push('そのログインIDはすでに使われています。');
  if (errors.length) {
    return res.status(400).render('admin/user-form', {
      title: 'アカウント発行', user: req.body, roleLabels: config.ROLE_LABELS, errors, action: '/admin/users', isNew: true,
    });
  }
  const temp = makeTempPassword();
  users.create({ username, password: temp, display_name, role, must_change_password: 1 });
  users.log(req.session.user.username, 'user_create', username, `role=${role}`);
  // 仮パスワードは「この画面で1回だけ」見せる。DBには残らない（ハッシュだけ）
  res.render('admin/issued', { title: 'アカウントを発行しました', username, display_name, temp });
});

router.get('/:id/edit', (req, res) => {
  const user = users.findById(req.params.id);
  if (!user) return res.status(404).render('error', { title: '見つかりません', message: 'そのユーザーはいません。' });
  res.render('admin/user-form', {
    title: 'ユーザー編集', user, roleLabels: config.ROLE_LABELS, errors: [], action: `/admin/users/${user.id}`, isNew: false,
  });
});

router.post('/:id', (req, res) => {
  const user = users.findById(req.params.id);
  if (!user) return res.status(404).render('error', { title: '見つかりません', message: 'そのユーザーはいません。' });
  const display_name = (req.body.display_name || '').trim();
  const role = req.body.role;
  const errors = [];
  if (display_name === '') errors.push('表示名を入力してください。');
  if (!config.ROLE_LABELS[role]) errors.push('役割が正しくありません。');
  // 自分自身の管理者権限は外せない（最後の管理者がいなくなる事故を防ぐ）
  if (user.id === req.session.user.id && role !== 'admin') errors.push('自分自身の管理者権限は外せません。');
  if (errors.length) {
    return res.status(400).render('admin/user-form', {
      title: 'ユーザー編集', user: { ...req.body, id: user.id, username: user.username }, roleLabels: config.ROLE_LABELS, errors, action: `/admin/users/${user.id}`, isNew: false,
    });
  }
  users.update(user.id, { display_name, role });
  users.log(req.session.user.username, 'user_update', user.username, `role=${role}`);
  res.redirect('/admin/users?msg=' + encodeURIComponent('更新しました。'));
});

router.post('/:id/deactivate', (req, res) => {
  const user = users.findById(req.params.id);
  if (!user) return res.status(404).render('error', { title: '見つかりません', message: 'そのユーザーはいません。' });
  if (user.id === req.session.user.id) {
    return res.redirect('/admin/users?msg=' + encodeURIComponent('自分自身は無効化できません。'));
  }
  users.setActive(user.id, false);
  users.log(req.session.user.username, 'user_deactivate', user.username);
  res.redirect('/admin/users?msg=' + encodeURIComponent(`${user.username} を無効化しました。`));
});

router.post('/:id/activate', (req, res) => {
  const user = users.findById(req.params.id);
  if (!user) return res.status(404).render('error', { title: '見つかりません', message: 'そのユーザーはいません。' });
  users.setActive(user.id, true);
  users.log(req.session.user.username, 'user_activate', user.username);
  res.redirect('/admin/users?msg=' + encodeURIComponent(`${user.username} を有効化しました。`));
});

router.post('/:id/reset-password', (req, res) => {
  const user = users.findById(req.params.id);
  if (!user) return res.status(404).render('error', { title: '見つかりません', message: 'そのユーザーはいません。' });
  const temp = makeTempPassword();
  users.resetPassword(user.id, temp);
  users.log(req.session.user.username, 'password_reset', user.username);
  res.render('admin/issued', { title: 'パスワードをリセットしました', username: user.username, display_name: user.display_name, temp });
});

router.get('/logs', (req, res) => {
  res.render('admin/logs', { title: '監査ログ', logs: users.listLogs(200) });
});

module.exports = router;
