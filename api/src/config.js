// =====================================================
// 社員マスタAPI の設定（値は .env → docker-compose.yml 経由で入る）
// =====================================================
module.exports = {
  APP_NAME: '社員マスタAPI',
  AUTH_MODE: process.env.API_AUTH_MODE || 'none',   // none / apikey / jwt
  API_KEY: process.env.API_KEY || '',
  CLIENT_ID: process.env.API_CLIENT_ID || '',
  CLIENT_SECRET: process.env.API_CLIENT_SECRET || '',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-jwt-secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '10m',
};
