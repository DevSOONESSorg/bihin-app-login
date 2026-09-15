// =====================================================
// 備品に関する画面
//   一覧 / 登録 / 詳細 / 編集 / 削除
// URL はすべて /items から始まります
// =====================================================

const express = require('express');
const db = require('../db');
const config = require('../config');
const dates = require('../dates');

const router = express.Router();

// 備品1件を、貸出中の情報（借りた人・期限）つきで取り出す
const SELECT_ITEM_WITH_LOAN = `
  SELECT items.*,
         loans.id       AS loan_id,
         loans.borrower AS borrower,
         loans.lent_on  AS lent_on,
         loans.due_on   AS due_on
  FROM items
  LEFT JOIN loans ON loans.item_id = items.id AND loans.returned_on IS NULL
`;

// 入力チェック。問題があればメッセージの配列を返す（なければ空の配列）
function validateItem(body) {
  const errors = [];
  const name = (body.name || '').trim();
  if (name === '') errors.push('備品名を入力してください。');
  if (name.length > config.ITEM_NAME_MAX) errors.push(`備品名は${config.ITEM_NAME_MAX}文字以内にしてください。`);
  if (!config.STATUS_LABELS[body.status]) errors.push('ステータスの値が正しくありません。');
  return errors;
}

// ---------- 一覧 ----------
// /items?q=検索語&status=lent
router.get('/', (req, res) => {
  const q = (req.query.q || '').trim();
  const status = req.query.status || '';

  const where = [];
  const params = [];
  if (q !== '') {
    where.push('items.name LIKE ?');
    params.push(`%${q}%`);
  }
  if (status !== '') {
    where.push('items.status = ?');
    params.push(status);
  }

  const orderBy = config.ITEM_SORT === 'newest' ? 'items.id DESC' : 'items.name ASC';
  const sql =
    SELECT_ITEM_WITH_LOAN +
    (where.length ? ' WHERE ' + where.join(' AND ') : '') +
    ' ORDER BY ' + orderBy;

  const items = db.prepare(sql).all(...params).map((item) => ({
    ...item,
    overdue: item.due_on ? dates.isOverdue(item.due_on, null) : false,
  }));

  // 画面上部の件数
  const counts = {
    total: db.prepare('SELECT COUNT(*) AS c FROM items').get().c,
    lent: db.prepare("SELECT COUNT(*) AS c FROM items WHERE status = 'lent'").get().c,
    overdue: db
      .prepare('SELECT COUNT(*) AS c FROM loans WHERE returned_on IS NULL AND due_on < ?')
      .get(dates.today()).c,
  };

  res.render('items/index', { title: '備品一覧', items, q, status, counts });
});

// ---------- 登録 ----------
router.get('/new', (req, res) => {
  res.render('items/form', {
    title: '備品を登録',
    item: { name: '', category: config.CATEGORIES[0], location: '', status: 'available', note: '' },
    categories: config.CATEGORIES,
    errors: [],
    action: '/items',
  });
});

router.post('/', (req, res) => {
  const errors = validateItem(req.body);
  if (errors.length) {
    return res.status(400).render('items/form', {
      title: '備品を登録',
      item: req.body,
      categories: config.CATEGORIES,
      errors,
      action: '/items',
    });
  }
  db.prepare('INSERT INTO items (name, category, location, status, note) VALUES (?, ?, ?, ?, ?)').run(
    req.body.name.trim(),
    req.body.category || '',
    (req.body.location || '').trim(),
    req.body.status,
    (req.body.note || '').trim()
  );
  res.redirect('/items?msg=' + encodeURIComponent('備品を登録しました。'));
});

// ---------- 詳細（貸出履歴つき） ----------
router.get('/:id', (req, res) => {
  const item = db.prepare(SELECT_ITEM_WITH_LOAN + ' WHERE items.id = ?').get(req.params.id);
  if (!item) return res.status(404).render('error', { title: '見つかりません', message: 'その備品はありません。' });

  const history = db
    .prepare('SELECT * FROM loans WHERE item_id = ? ORDER BY id DESC')
    .all(item.id)
    .map((loan) => ({ ...loan, overdue: dates.isOverdue(loan.due_on, loan.returned_on) }));

  res.render('items/show', { title: item.name, item, history });
});

// ---------- 編集 ----------
router.get('/:id/edit', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).render('error', { title: '見つかりません', message: 'その備品はありません。' });
  res.render('items/form', {
    title: '備品を編集',
    item,
    categories: config.CATEGORIES,
    errors: [],
    action: `/items/${item.id}`,
  });
});

router.post('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).render('error', { title: '見つかりません', message: 'その備品はありません。' });

  const errors = validateItem(req.body);
  // 貸出中の備品のステータスは、返却処理で戻すので手で変えられないようにする
  if (item.status === 'lent' && req.body.status !== 'lent') {
    errors.push('貸出中の備品は、先に返却処理をしてください。');
  }
  if (errors.length) {
    return res.status(400).render('items/form', {
      title: '備品を編集',
      item: { ...req.body, id: item.id },
      categories: config.CATEGORIES,
      errors,
      action: `/items/${item.id}`,
    });
  }
  db.prepare('UPDATE items SET name = ?, category = ?, location = ?, status = ?, note = ? WHERE id = ?').run(
    req.body.name.trim(),
    req.body.category || '',
    (req.body.location || '').trim(),
    req.body.status,
    (req.body.note || '').trim(),
    item.id
  );
  res.redirect(`/items/${item.id}?msg=` + encodeURIComponent('備品を更新しました。'));
});

// ---------- 削除 ----------
router.post('/:id/delete', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).render('error', { title: '見つかりません', message: 'その備品はありません。' });
  if (item.status === 'lent') {
    return res.redirect(`/items/${item.id}?msg=` + encodeURIComponent('貸出中の備品は削除できません。'));
  }
  db.prepare('DELETE FROM items WHERE id = ?').run(item.id); // 貸出履歴も一緒に消える（ON DELETE CASCADE）
  res.redirect('/items?msg=' + encodeURIComponent('備品を削除しました。'));
});

module.exports = router;
