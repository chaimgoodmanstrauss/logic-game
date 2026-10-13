// Pure logic: three-valued evaluation of partial expressions, template counting, and a par solver.
// Node shapes: null (blank) | {type:'atom', key} | {type:'op', op, args:[node|null,...]}
// Truth values: true, false, undefined (= unknown, because of a blank).

(function (root) {
  const U = undefined;

  function not3(x) { return x === U ? U : !x; }
  function and3(a, b) { if (a === false || b === false) return false; if (a === U || b === U) return U; return true; }
  function or3(a, b) { if (a === true || b === true) return true; if (a === U || b === U) return U; return false; }

  function evalNode(node, animal, atomTests) {
    if (!node) return U;
    if (node.type === 'atom') return atomTests[node.key](animal);
    const v = node.args.map(a => evalNode(a, animal, atomTests));
    switch (node.op) {
      case 'and': return and3(v[0], v[1]);
      case 'or':  return or3(v[0], v[1]);
      case 'if':  return or3(not3(v[0]), v[1]);
      case 'not': return not3(v[0]);
    }
  }

  function countTemplates(node) {
    if (!node || node.type === 'atom') return 0;
    return 1 + node.args.reduce((s, a) => s + countTemplates(a), 0);
  }

  function isComplete(node) {
    if (!node) return false;
    return node.type === 'atom' || node.args.every(isComplete);
  }

  // Spoken form, e.g. "(brown AND four-legged) OR NOT sea-dwelling"
  function toText(node, labels, top = true) {
    if (!node) return '…';
    if (node.type === 'atom') return labels[node.key];
    const [a, b] = node.args.map(x => toText(x, labels, false));
    let s;
    if (node.op === 'not') s = `NOT ${a}`;
    else if (node.op === 'if') s = `IF ${a} THEN ${b}`;
    else s = `${a} ${node.op.toUpperCase()} ${b}`;
    return top ? s : `(${s})`;
  }

  // Minimum number of templates that yields exactly `target` (bitmask over animals).
  // Generator: yields while working so the UI can stay responsive; returns the cost or {atLeast:k} if the budget ran out.
  function* solvePar(atomMasks, target, full, budgetMs = 4000) {
    const seen = new Set();
    const levels = [];
    const start = Date.now();
    let lastYield = start;

    const L0 = [];
    for (const m of atomMasks) if (!seen.has(m)) { seen.add(m); L0.push(m); }
    levels.push(L0);
    if (seen.has(target)) return 0;

    for (let k = 1; ; k++) {
      const next = [];
      const add = v => { if (!seen.has(v)) { seen.add(v); next.push(v); return v === target; } return false; };
      for (const a of levels[k - 1]) if (add(~a & full)) return k;
      for (let i = 0; i <= k - 1; i++) {
        const j = k - 1 - i;
        const A = levels[i], B = levels[j];
        for (let x = 0; x < A.length; x++) {
          const a = A[x];
          for (let y = 0; y < B.length; y++) {
            const b = B[y];
            if (i <= j) { if (add(a & b)) return k; if (add(a | b)) return k; }
            if (add((~a | b) & full)) return k;
          }
          const now = Date.now();
          if (now - lastYield > 15) {
            if (now - start > budgetMs) return { atLeast: k };
            lastYield = now;
            yield;
          }
        }
      }
      levels.push(next);
    }
  }

  // Random complete expression with exactly n templates over the given atom keys.
  function randomExpr(n, keys) {
    if (n === 0) return { type: 'atom', key: keys[Math.floor(Math.random() * keys.length)] };
    const op = ['and', 'or', 'if', 'not'][Math.floor(Math.random() * 4)];
    if (op === 'not') return { type: 'op', op, args: [randomExpr(n - 1, keys)] };
    const left = Math.floor(Math.random() * n);
    return { type: 'op', op, args: [randomExpr(left, keys), randomExpr(n - 1 - left, keys)] };
  }

  const api = { randomExpr, evalNode, countTemplates, isComplete, toText, solvePar };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
