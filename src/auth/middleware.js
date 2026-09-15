// =====================================================
// 「ログインしていないと通さない」「この役割でないと通さない」
//
// 使い方（ルートの前に挟む）:
//   router.get('/secret', requireLogin, (req, res) => { ... });
//   router.post('/items/:id/delete', requireRole('admin'), (req, res) => { ... });
//
// 仕組み:
//   ログイン成功時に req.session.user にユーザー情報を入れる（auth/routes.js）。
//   ブラウザには「セッションID」だけが Cookie で渡され、中身はサーバー側にある。
//   毎回のリクエストで express-session が Cookie からセッションを復元してくれるので、
//   ここでは req.session.user があるかどうかを見るだけでよい。
// =====================================================

function requireLogin(req, res, next) {
  if (!req.session.user) {
    // ログイン後に元のページへ戻れるよう、行き先を覚えておく
    req.session.returnTo = req.originalUrl;
    return res.redirect('/login?msg=' + encodeURIComponent('ログインしてください。'));
  }
  // 初期パスワードのままの人は、まずパスワード変更させる
  if (req.session.user.must_change_password && req.path !== '/password') {
    return res.redirect('/password?msg=' + encodeURIComponent('初期パスワードを変更してください。'));
  }
  next();
}

function requireRole(role) {
  return function (req, res, next) {
    if (!req.session.user) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/login?msg=' + encodeURIComponent('ログインしてください。'));
    }
    if (req.session.user.role !== role) {
      // 403 = 誰かは分かっているが、権限がない（401 は「誰か分からない」）
      return res.status(403).render('error', {
        title: '権限がありません',
        message: `この操作には「${role}」の権限が必要です。`,
      });
    }
    next();
  };
}

module.exports = { requireLogin, requireRole };
