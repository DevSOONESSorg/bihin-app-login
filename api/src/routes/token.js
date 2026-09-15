// =====================================================
// POST /token  — アクセストークンの発行（jwt 方式のときだけ意味がある）
//
// 呼ぶ側は client_id / client_secret（＝アプリ用のID・パスワード）を送る。
// 合っていれば、有効期限つきの JWT を返す。これが OAuth 2.0 の
// 「Client Credentials Grant」の最小版。
// =====================================================
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');

const router = express.Router();

router.post('/', (req, res) => {
  const { client_id, client_secret } = req.body || {};
  if (client_id !== config.CLIENT_ID || client_secret !== config.CLIENT_SECRET) {
    return res.status(401).json({ error: 'client_id または client_secret が違います' });
  }
  const token = jwt.sign(
    { sub: client_id, scope: 'employees:read' },   // ペイロード（誰に・何を許すか）
    config.JWT_SECRET,                             // 署名の鍵
    { expiresIn: config.JWT_EXPIRES_IN }           // 期限
  );
  // expires_in は秒で返す（OAuth の慣例）
  const decoded = jwt.decode(token);
  res.json({ access_token: token, token_type: 'Bearer', expires_in: decoded.exp - decoded.iat });
});

module.exports = router;
