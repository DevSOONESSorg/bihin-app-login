// =====================================================
// 日付のちょっとした道具
// このアプリでは日付を 'YYYY-MM-DD' の文字列で扱います。
// =====================================================

// Date → 'YYYY-MM-DD'
function format(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 今日の日付 → 'YYYY-MM-DD'
function today() {
  return format(new Date());
}

// 'YYYY-MM-DD' に n 日足す（マイナスなら戻る）
function addDays(ymd, n) {
  const d = new Date(ymd + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return format(d);
}

// 返却期限を過ぎているか？（期限当日はまだ延滞ではない）
function isOverdue(dueOn, returnedOn) {
  if (returnedOn) return false; // 返却済みなら延滞ではない
  return dueOn < today();
}

// 'YYYY-MM-DD' として正しい形か
function isValid(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return false;
  const d = new Date(ymd + 'T00:00:00');
  return !isNaN(d.getTime()) && format(d) === ymd;
}

module.exports = { format, today, addDays, isOverdue, isValid };
