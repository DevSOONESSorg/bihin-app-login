// =====================================================
// アプリの入口（ここから起動します）
//   npm run dev  または  docker compose up
// =====================================================

const path = require('path');
const express = require('express');
const config = require('./config');

const app = express();

// 画面（HTML）は src/views の .ejs ファイルで作る
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// フォームから送られた値を req.body で受け取れるようにする
app.use(express.urlencoded({ extended: false }));

// public フォルダ（CSSなど）をそのまま配信する
app.use(express.static(path.join(__dirname, '..', 'public')));

// どの画面でも使う共通の値
app.use((req, res, next) => {
  res.locals.appName = config.APP_NAME;
  res.locals.statusLabels = config.STATUS_LABELS;
  res.locals.msg = req.query.msg || ''; // 「登録しました」などのメッセージ
  next();
});

// ---------- 画面ごとの処理（ルーティング） ----------
app.get('/', (req, res) => res.redirect('/items'));
app.use('/items', require('./routes/items'));
app.use('/loans', require('./routes/loans'));

// 該当する画面がないとき
app.use((req, res) => {
  res.status(404).render('error', { title: 'ページが見つかりません', message: `${req.path} はありません。` });
});

// 想定外のエラーが起きたとき
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).render('error', { title: 'エラーが発生しました', message: err.message });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`${config.APP_NAME} を起動しました → http://localhost:${process.env.HOST_PORT || PORT}`);
});
