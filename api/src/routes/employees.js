// =====================================================
// GET /employees          社員一覧
// GET /employees/:no      社員1件
// どちらも auth.js の authenticate を通ってから実行される
// =====================================================
const express = require('express');
const employees = require('../employees');

const router = express.Router();

router.get('/', (req, res) => {
  const dept = req.query.department;
  const list = dept ? employees.filter((e) => e.department === dept) : employees;
  res.json(list);
});

router.get('/:no', (req, res) => {
  const found = employees.find((e) => e.employee_no === req.params.no);
  if (!found) return res.status(404).json({ error: '社員が見つかりません' });
  res.json(found);
});

module.exports = router;
