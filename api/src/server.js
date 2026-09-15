// =====================================================
// 社員マスタAPI 起動の入口（JSONだけを返す。画面はない）
// =====================================================
const express = require('express');
const config = require('./config');
const { authenticate } = require('./auth');

const app = express();
app.use(express.json());

// 動作確認用（認証なしで見られる）
app.get('/', (req, res) => {
  res.json({
    name: config.APP_NAME,
    auth_mode: config.AUTH_MODE,
    endpoints: ['POST /token', 'GET /employees', 'GET /employees/:no'],
    hint: {
      none: 'そのまま GET /employees を呼べます',
      apikey: 'ヘッダ X-API-Key: <API_KEY> を付けて呼びます',
      jwt: 'まず POST /token に {client_id, client_secret} を送り、返った access_token を Authorization: Bearer <token> で付けます',
    }[config.AUTH_MODE],
  });
});

app.use('/token', require('./routes/token'));
app.use('/employees', authenticate, require('./routes/employees'));

app.use((req, res) => res.status(404).json({ error: 'not found' }));

app.listen(3000, () => {
  console.log(`${config.APP_NAME} を起動しました（認証方式: ${config.AUTH_MODE}） → http://localhost:${process.env.HOST_PORT || 3000}`);
});
