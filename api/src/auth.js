// =====================================================
// API側の認証（呼び出し元が「正しい相手か」を確かめる）
//
//   none   : 何も確認しない
//   apikey : ヘッダ X-API-Key が設定された鍵と一致するか
//   jwt    : ヘッダ Authorization: Bearer <token> の JWT を検証する
//            （署名が正しいか / 期限切れでないか）
//
// 「ユーザーのログイン」と違い、ここで確認しているのは「人」ではなく「アプリ（サービス）」。
// =====================================================
const jwt = require('jsonwebtoken');
const config = require('./config');

function authenticate(req, res, next) {
  switch (config.AUTH_MODE) {
    case 'none':
      return next();

    case 'apikey': {
      const key = req.get('X-API-Key');
      if (!key) return res.status(401).json({ error: 'X-API-Key ヘッダがありません' });
      if (key !== config.API_KEY) return res.status(401).json({ error: 'APIキーが違います' });
      req.client = { id: 'api-key-client' };
      return next();
    }

    case 'jwt': {
      const header = req.get('Authorization') || '';
      const [scheme, token] = header.split(' ');
      if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Authorization: Bearer <token> がありません' });
      try {
        // verify = 署名の確認 + 期限（exp）の確認。どちらかダメなら例外
        const payload = jwt.verify(token, config.JWT_SECRET);
        req.client = { id: payload.sub, scope: payload.scope };
        return next();
      } catch (e) {
        const msg = e.name === 'TokenExpiredError' ? 'トークンの有効期限が切れています' : 'トークンが不正です（署名が合いません）';
        return res.status(401).json({ error: msg });
      }
    }

    default:
      return res.status(500).json({ error: `不明な認証方式: ${config.AUTH_MODE}` });
  }
}

module.exports = { authenticate };
