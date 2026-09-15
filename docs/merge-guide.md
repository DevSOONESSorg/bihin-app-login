# 合体手順書：bihin-app に auth-lab のログインを付ける

[bihin-app](https://github.com/DevSOONESSorg/bihin-app)（備品貸出管理）に、[auth-lab](https://github.com/DevSOONESSorg/auth-lab)（ログイン教材）のログイン・権限・ユーザー管理・社員マスタAPI連携を組み込む手順です。

このリポジトリは **その手順を1ステップ＝1コミットで実際にやった結果** です。各ステップの見出しにあるコミットを開くと、そのステップで変わったファイルの差分がそのまま見られます。手順書で分からなければ差分を見る、差分で分からなければ手順書を読む、という使い方ができます。

## 顧客からの依頼（この作業の理由）

> 総務部 新垣です。備品管理システム、便利に使っています。
> ただ、今は誰でも備品を消せてしまうので、**登録・編集・削除・貸出・返却は総務だけ**ができるようにして、**一般社員は見るだけ**にしてほしいです。
> あと、借りる人の名前を毎回手で打つのをやめて、**社員一覧から選べる**ようにできませんか。

## 全体像

```
Step 0   bihin-app をコピーして出発点にする
Step 1   auth/ フォルダと画面2枚をコピー           ← 部品を持ってくる
Step 2   パッケージを2つ追加
Step 3   db.js にテーブルを2つ追加
Step 4   config.js に設定を追加
Step 5   server.js にセッションとログインを組み込む
Step 6   ヘッダーにログイン状態を表示             ← ★ここでログインできる
Step 7   ルートに権限チェックを付ける             ← ★ここで「総務だけ」になる
Step 8   画面のボタンを役割で出し分ける
Step 9   ユーザー管理画面を組み込む
Step 10  社員マスタAPIを追加し、借りる人を選べるようにする（発展）
```

Step 6 まで（約1時間）でログインが動き、Step 8 まで（＋30分）で依頼の前半が完了します。Step 9〜10 は余裕があれば。

## 設計で決めたこと

作業の前に、次の3つを決めています（自分でやる場合は、先に設計メモとして書いてサポーターに見せてください）。

| 決めたこと | 内容 | 理由 |
|---|---|---|
| 誰に何を許すか | 未ログイン：何も見られない／一般社員（staff）：一覧・詳細の閲覧のみ／総務（admin）：すべて | 顧客の依頼のとおり |
| 役割の名前 | auth-lab の `admin` を「総務（管理者）」と表示する。DBの値は変えない | コードをコピーしたまま使えるように、表示名だけ `config.js` で変える |
| 借りる人の保存形式 | 今までどおり **名前の文字列** を `loans.borrower` に保存する。社員番号は保存しない | 既存の貸出データを移行しなくて済む。社員番号で持ち直すのは次の課題に残す |

---

## Step 0：bihin-app をコピーする

コミット：[a295299](https://github.com/DevSOONESSorg/bihin-app-login/commit/a295299)

bihin-app を zip でダウンロードして解凍し、フォルダ名を `bihin-app-login` にする。`docker compose up` で今までどおり動くことを確認してから始める。

---

## Step 1：auth/ フォルダと画面2枚をコピーする

コミット：[4ffd5d0](https://github.com/DevSOONESSorg/bihin-app-login/commit/4ffd5d0)

auth-lab から次をコピーする。

| コピー元（auth-lab） | コピー先（bihin-app-login） |
|---|---|
| `web/src/auth/users.js` | `src/auth/users.js` |
| `web/src/auth/routes.js` | `src/auth/routes.js` |
| `web/src/auth/middleware.js` | `src/auth/middleware.js` |
| `web/src/views/login.ejs` | `src/views/login.ejs` |
| `web/src/views/password.ejs` | `src/views/password.ejs` |

変更は1か所だけ。`src/auth/users.js` の初期ユーザーの表示名を、この会社に合わせる。

```js
// 変更前
create({ username: 'admin', password: 'Taiken-2026', display_name: '情シス 新垣', role: 'admin', must_change_password: 0 });
// 変更後
create({ username: 'admin', password: 'Taiken-2026', display_name: '新垣（総務）', role: 'admin', must_change_password: 0 });
```

**確認**：まだ起動しない（このままだとパッケージがなくてエラーになる）。フォルダ構成だけ確認する。

---

## Step 2：パッケージを2つ追加する

コミット：[d09d49a](https://github.com/DevSOONESSorg/bihin-app-login/commit/d09d49a)

`package.json` の `dependencies` に2行足す。

```json
"bcryptjs": "^2.4.3",
"express-session": "^1.18.1",
```

Docker で動かしているので、パッケージを足したときだけイメージの作り直しが必要。

```bash
docker compose up --build
```

**確認**：起動ログにエラーが出ない（まだログイン画面はない）。

---

## Step 3：db.js にテーブルを2つ追加する

コミット：[0edc6cd](https://github.com/DevSOONESSorg/bihin-app-login/commit/0edc6cd)

`src/db.js` の `db.exec(\`...\`)` の中、`loans` テーブルの定義の後ろに `users` と `audit_logs` のテーブル定義を足す。内容は auth-lab の `web/src/db.js` からそのままコピーでよい（差分を参照）。

**確認**：起動してエラーが出ない。`data/bihin.db` を SQLite Viewer で開くと `users` テーブルがある（まだ空。初期ユーザーは Step 5 で `auth/users.js` が読み込まれたときに入る）。

> 古い `data/bihin.db` が残っていても `CREATE TABLE IF NOT EXISTS` なので問題ない。もし `no such table: users` が出たら `npm run reset` で作り直す。

---

## Step 4：config.js に設定を追加する

コミット：[3c5dcce](https://github.com/DevSOONESSorg/bihin-app-login/commit/3c5dcce)

`src/config.js` の末尾（`};` の前）に、ログイン関連の設定を足す。`auth/` のコードがこれらを参照する。

```js
  SESSION_SECRET: process.env.SESSION_SECRET || 'change-me-session-secret',
  SESSION_MAX_AGE_MS: 30 * 60 * 1000,
  LOGIN_MAX_FAILS: 5,
  LOCK_MINUTES: 10,
  PASSWORD_MIN: 8,
  ROLE_LABELS: {
    admin: '総務（管理者）',
    staff: '一般社員',
  },
```

**確認**：起動してエラーが出ない。

---

## Step 5：server.js にセッションとログインを組み込む

コミット：[19ad1f0](https://github.com/DevSOONESSorg/bihin-app-login/commit/19ad1f0)

`src/server.js` に4か所足す（差分を参照）。

1. 先頭の `require` に `express-session` と `./auth/middleware` を追加
2. `express.static(...)` の後に `app.use(session({...}))` を追加（Cookie の設定。auth-lab の `server.js` と同じ内容）
3. 「どの画面でも使う共通の値」に `res.locals.roleLabels` と `res.locals.currentUser = req.session.user || null` を追加
4. ルーティングの先頭に `app.use('/', require('./auth/routes'))` を追加

あわせて、`.env.example` と `docker-compose.yml` に `SESSION_SECRET` を足す（`.env` にもコピーする）。

**確認**：<http://localhost:3000/login> を開くとログイン画面が出る。`admin` / `Taiken-2026` でログインすると `/items` に戻る。ただし、まだ画面上に「誰がログイン中か」は出ないし、ログインしなくても一覧は見られる。

---

## Step 6：ヘッダーにログイン状態を表示する

コミット：[d227d45](https://github.com/DevSOONESSorg/bihin-app-login/commit/d227d45)

`src/views/partials/header.ejs` のナビの末尾に、ログイン中ならユーザー名とログアウトボタン、未ログインなら「ログイン」リンクを出す。`public/style.css` に `.me` などのスタイルを足す。

**確認**：ログインすると右上に「新垣（総務）（総務（管理者））」とログアウトボタンが出る。ログアウトするとログイン画面に戻る。

**ここまでで「ログインが付いた」状態。** Day 1 の目標はここまで。

---

## Step 7：ルートに権限チェックを付ける

コミット：[aa19ff8](https://github.com/DevSOONESSorg/bihin-app-login/commit/aa19ff8)

`src/routes/items.js` と `src/routes/loans.js` で、各ルートの処理の前にミドルウェアを挟む。

```js
const { requireLogin, requireRole } = require('../auth/middleware');
const adminOnly = requireRole('admin');

router.get('/',          requireLogin, (req, res) => { ... });  // 一覧：ログインしていれば誰でも
router.get('/new',       adminOnly,    (req, res) => { ... });  // 登録：総務だけ
router.post('/',         adminOnly,    (req, res) => { ... });
router.get('/:id',       requireLogin, (req, res) => { ... });  // 詳細：誰でも
router.get('/:id/edit',  adminOnly,    (req, res) => { ... });
router.post('/:id',      adminOnly,    (req, res) => { ... });
router.post('/:id/delete', adminOnly,  (req, res) => { ... });
```

`loans.js` も同様に、貸出中一覧は `requireLogin`、貸出登録と返却は `adminOnly`。`server.js` のトップ（`/`）にも `requireLogin` を付ける。

**確認**：
- ログアウトした状態で `/items` を開くとログイン画面に飛ぶ
- `higa` / `Taiken-2026`（一般社員）でログインし、URL に直接 `/items/new` を打つと **403** になる
- `admin` では今までどおり操作できる

**ここが依頼の本体。** 画面のボタンを隠す前に、URL を直接叩いても通らないことを必ず確認する。

---

## Step 8：画面のボタンを役割で出し分ける

コミット：[638a8d1](https://github.com/DevSOONESSorg/bihin-app-login/commit/638a8d1)

一般社員には、押しても 403 になるボタンを最初から見せない。

| ファイル | 変更 |
|---|---|
| `partials/header.ejs` | 「＋ 備品を登録」を admin のときだけ表示 |
| `items/index.ejs` | 貸出・返却ボタンの列を admin のときだけ表示 |
| `items/show.ejs` | 貸し出す・返却する・編集・削除のブロックを admin のときだけ表示 |
| `loans/index.ejs` | 返却ボタンを admin のときだけ表示 |

書き方はどれも同じ。

```ejs
<% if (currentUser.role === 'admin') { %>
  ...ボタン...
<% } %>
```

**確認**：`higa` でログインすると、一覧・詳細にボタンが一切出ない。`admin` では出る。

> **ボタンを隠すだけでは不十分**な理由：ブラウザの開発者ツールで HTML を書き換えれば、隠したボタンは復活する。URL を直接叩くこともできる。だから Step 7 のルート側のチェックが本体で、Step 8 は「使いやすさ」のための変更。

---

## Step 9：ユーザー管理画面を組み込む

コミット：[ff58c55](https://github.com/DevSOONESSorg/bihin-app-login/commit/ff58c55)

総務が自分でアカウントを発行・無効化できるようにする。auth-lab からコピーするだけ。

| コピー元（auth-lab） | コピー先 |
|---|---|
| `web/src/routes/admin-users.js` | `src/routes/admin-users.js` |
| `web/src/views/admin/*.ejs`（4枚） | `src/views/admin/` |

`src/server.js` に1行、`header.ejs` に admin 向けリンクを1行、`style.css` にバッジ等のスタイルを足す。

```js
app.use('/admin/users', require('./routes/admin-users'));
```

**確認**：`admin` でログインするとヘッダーに「ユーザー管理」が出て、アカウント発行ができる。`higa` で `/admin/users` を開くと 403。

---

## Step 10：社員マスタAPIを追加し、借りる人を選べるようにする（発展）

コミット：[6f47892](https://github.com/DevSOONESSorg/bihin-app-login/commit/6f47892)

依頼の後半「借りる人を社員一覧から選びたい」。auth-lab の `api`（社員マスタAPI）をこのリポジトリに丸ごと入れ、貸出フォームの入力欄をセレクトボックスにする。

1. auth-lab の `api/` フォルダを、このリポジトリの `api/` にコピー
2. auth-lab の `web/src/lib/employeeApi.js` を `src/lib/employeeApi.js` にコピー
3. `src/config.js` に `API_BASE_URL` など API の設定を追加
4. `docker-compose.yml` に `api` サービスを追加し、`app` から `http://api:3000` で呼べるようにする（`.env.example` にも設定を追加）
5. `src/routes/loans.js`：フォーム表示時に `employeeApi.listEmployees()` で社員一覧を取り、`views/loans/form.ejs` に渡す。**API が落ちていても貸出できる**よう、失敗したら空配列にして手入力に戻す
6. `views/loans/form.ejs`：社員一覧があればセレクト、なければ今までの手入力

パッケージは増えないが、`api` サービスを作るので `docker compose up --build`。

**確認**：貸出フォームの「借りる人」がセレクトになり、「比嘉 大樹（営業部）」のように選べる。`docker compose stop api` で API を止めてフォームを開くと、手入力欄に戻り「社員マスタAPIに接続できないため手入力です」と出る。

**設計判断**：`loans.borrower` は名前の文字列のまま。社員番号（`employee_no`）で持ち直すと、社員の名前が変わっても履歴が正しく残るが、既存データの移行が必要になる。これは次の課題として残してある（[README の課題](../README.md#この先の課題) を参照）。

---

## 全ステップ完了後の確認チェックリスト

- [ ] ログアウト状態で `/items` を開くとログイン画面に飛ぶ
- [ ] `higa`（一般社員）は一覧と詳細が見られ、ボタンは出ない
- [ ] `higa` で `/items/new`、`/items/1/edit`、`/admin/users` を直接開くと 403
- [ ] `admin` は登録・編集・削除・貸出・返却・ユーザー管理ができる
- [ ] 貸出フォームで社員一覧から選べる。API を止めると手入力に戻る
- [ ] パスワードを5回間違えるとロックされ、`admin` の「PWリセット」で解除できる
- [ ] 「ボタンを隠すだけではダメな理由」を自分の言葉で言える

## よくあるつまずき

| 症状 | 原因と対処 |
|---|---|
| `Cannot find module 'express-session'` | Step 2 のあと `docker compose up --build` していない |
| `no such table: users` | Step 3 の追加が `db.exec` の中に入っていない。または古い DB → `npm run reset` |
| `roleLabels is not defined` | Step 5 の `res.locals.roleLabels` が抜けている |
| `currentUser is not defined` | Step 5 の `res.locals.currentUser` が抜けている |
| ログインしても一覧が見られる | Step 7 の `requireLogin` が抜けている（Step 6 まではそれで正常） |
| 一般社員なのにボタンが出る | Step 8 の `if (currentUser.role === 'admin')` の閉じ `<% } %>` の位置 |
| 貸出フォームがずっと手入力 | `api` サービスが起動していない。`docker compose ps` で確認。`.env` の `API_AUTH_MODE` が web と api で食い違っている |
