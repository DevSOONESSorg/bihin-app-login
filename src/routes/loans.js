// =====================================================
// 貸出・返却に関する画面
//   貸出中一覧 / 貸出登録 / 返却
// URL はすべて /loans から始まります
// =====================================================

const express = require('express');
const db = require('../db');
const config = require('../config');
const dates = require('../dates');

const router = express.Router();

// ---------- 貸出中一覧 ----------
// /loans            → 貸出中すべて
// /loans?overdue=1  → 返却期限を過ぎているものだけ
router.get('/', (req, res) => {
  const onlyOverdue = req.query.overdue === '1';

  let sql = `
    SELECT loans.*, items.name AS item_name, items.category
    FROM loans
    JOIN items ON items.id = loans.item_id
    WHERE loans.returned_on IS NULL
  `;
  const params = [];
  if (onlyOverdue) {
    sql += ' AND loans.due_on < ?';
    params.push(dates.today());
  }
  sql += ' ORDER BY loans.due_on ASC';

  const loans = db.prepare(sql).all(...params).map((loan) => ({
    ...loan,
    overdue: dates.isOverdue(loan.due_on, loan.returned_on),
  }));

  res.render('loans/index', { title: onlyOverdue ? '延滞一覧' : '貸出中一覧', loans, onlyOverdue });
});

// ---------- 貸出登録 ----------
router.get('/new/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).render('error', { title: '見つかりません', message: 'その備品はありません。' });
  if (item.status !== 'available') {
    return res.redirect(`/items/${item.id}?msg=` + encodeURIComponent('在庫ありの備品だけ貸し出せます。'));
  }
  const today = dates.today();
  res.render('loans/form', {
    title: '貸出登録',
    item,
    loan: { borrower: '', lent_on: today, due_on: dates.addDays(today, config.DEFAULT_LOAN_DAYS) },
    errors: [],
  });
});

router.post('/new/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).render('error', { title: '見つかりません', message: 'その備品はありません。' });

  const borrower = (req.body.borrower || '').trim();
  const lentOn = req.body.lent_on;
  const dueOn = req.body.due_on;

  // 入力チェック
  const errors = [];
  if (borrower === '') errors.push('借りる人の名前を入力してください。');
  if (borrower.length > config.BORROWER_MAX) errors.push(`名前は${config.BORROWER_MAX}文字以内にしてください。`);
  if (!dates.isValid(lentOn)) errors.push('貸出日の形式が正しくありません。');
  if (!dates.isValid(dueOn)) errors.push('返却期限の形式が正しくありません。');
  if (dates.isValid(lentOn) && dates.isValid(dueOn) && dueOn < lentOn) errors.push('返却期限は貸出日より後にしてください。');
  if (item.status !== 'available') errors.push('この備品は今は貸し出せません。');

  if (errors.length) {
    return res.status(400).render('loans/form', {
      title: '貸出登録',
      item,
      loan: { borrower, lent_on: lentOn, due_on: dueOn },
      errors,
    });
  }

  // 貸出記録を作り、備品のステータスを「貸出中」にする（2つまとめて実行）
  const lend = db.transaction(() => {
    db.prepare('INSERT INTO loans (item_id, borrower, lent_on, due_on) VALUES (?, ?, ?, ?)').run(
      item.id, borrower, lentOn, dueOn
    );
    db.prepare("UPDATE items SET status = 'lent' WHERE id = ?").run(item.id);
  });
  lend();

  res.redirect(`/items/${item.id}?msg=` + encodeURIComponent(`${borrower}さんに貸し出しました。`));
});

// ---------- 返却 ----------
router.post('/:loanId/return', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.loanId);
  if (!loan) return res.status(404).render('error', { title: '見つかりません', message: 'その貸出記録はありません。' });
  if (loan.returned_on) {
    return res.redirect(`/items/${loan.item_id}?msg=` + encodeURIComponent('すでに返却済みです。'));
  }

  const giveBack = db.transaction(() => {
    db.prepare('UPDATE loans SET returned_on = ? WHERE id = ?').run(dates.today(), loan.id);
    db.prepare("UPDATE items SET status = 'available' WHERE id = ?").run(loan.item_id);
  });
  giveBack();

  res.redirect(`/items/${loan.item_id}?msg=` + encodeURIComponent('返却しました。'));
});

module.exports = router;
