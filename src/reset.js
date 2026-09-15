// =====================================================
// データを初期状態に戻す
//   npm run reset  （Docker のときは docker compose run --rm app npm run reset）
// DBファイルを消すだけ。次に起動したときサンプルデータが入り直します。
// =====================================================
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'bihin.db');
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('データを初期化しました:', DB_PATH);
} else {
  console.log('DBファイルはまだありません。起動するとサンプルデータ入りで作られます。');
}
