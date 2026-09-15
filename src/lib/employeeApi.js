// =====================================================
// 社員マスタAPI を呼ぶ側（クライアント）のコード
//
// 3つの認証方式を、環境変数 API_AUTH_MODE で切り替えられるようにしてある。
//   none   : 何も付けない（誰でも呼べる。第3段の最初の状態）
//   apikey : ヘッダに X-API-Key を付ける
//   jwt    : まず /token に client_id / client_secret を送ってアクセストークンをもらい、
//            以後は Authorization: Bearer <token> を付ける（OAuth 2.0 の Client Credentials と同じ形）
// =====================================================
const config = require('../config');

let cachedToken = null;      // もらったトークン
let cachedTokenExp = 0;      // その有効期限（ミリ秒）

async function getToken() {
  // 期限内ならそのまま使う（毎回もらいに行かない）
  if (cachedToken && Date.now() < cachedTokenExp - 5000) return cachedToken;

  const res = await fetch(`${config.API_BASE_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: config.API_CLIENT_ID, client_secret: config.API_CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`トークン取得に失敗しました（${res.status}）。client_id / client_secret を確認してください。`);
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExp = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

async function authHeaders() {
  switch (config.API_AUTH_MODE) {
    case 'apikey':
      return { 'X-API-Key': config.API_KEY };
    case 'jwt':
      return { Authorization: `Bearer ${await getToken()}` };
    default:
      return {};
  }
}

async function listEmployees() {
  const res = await fetch(`${config.API_BASE_URL}/employees`, { headers: await authHeaders() });
  if (res.status === 401) throw new Error('401 Unauthorized：APIに認証を拒否されました。認証方式と鍵が合っているか確認してください。');
  if (res.status === 403) throw new Error('403 Forbidden：認証は通ったが権限がありません。');
  if (!res.ok) throw new Error(`APIエラー（${res.status}）`);
  return res.json();
}

module.exports = { listEmployees };
