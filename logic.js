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

  function rebuild(vec, prov, keys) {
    const p = prov.get(vec);
    if (p[0] === 'atom') return { type: 'atom', key: keys[p[1]] };
    return { type: 'op', op: p[0], args: p.slice(1).map(v => rebuild(v, prov, keys)) };
  }

  // Minimum number of templates that yields exactly `target` (bitmask over animals).
  // Generator: yields while working so the UI can stay responsive; returns the cost or {atLeast:k} if the budget ran out.
  function* solvePar(atomMasks, target, full, budgetMs = 4000, keys = null, out = null) {
    const seen = new Set();
    const prov = new Map(); // vector -> how it was first built (cheapest)
    const finish = k => { if (out && keys) out.expr = rebuild(target, prov, keys); return k; };
    const levels = [];
    const start = Date.now();
    let lastYield = start;

    const L0 = [];
    atomMasks.forEach((m, i) => { if (!seen.has(m)) { seen.add(m); L0.push(m); prov.set(m, ['atom', i]); } });
    levels.push(L0);
    if (seen.has(target)) return finish(0);

    for (let k = 1; ; k++) {
      const next = [];
      const add = (v, p) => { if (!seen.has(v)) { seen.add(v); next.push(v); prov.set(v, p); return v === target; } return false; };
      for (const a of levels[k - 1]) if (add(~a & full, ['not', a])) return finish(k);
      for (let i = 0; i <= k - 1; i++) {
        const j = k - 1 - i;
        const A = levels[i], B = levels[j];
        for (let x = 0; x < A.length; x++) {
          const a = A[x];
          for (let y = 0; y < B.length; y++) {
            const b = B[y];
            if (i <= j) { if (add(a & b, ['and', a, b])) return finish(k); if (add(a | b, ['or', a, b])) return finish(k); }
            if (add((~a | b) & full, ['if', a, b])) return finish(k);
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

  // Random complete expression using exactly k distinct atoms (k-1 binary templates, plus an optional NOT). `easy`: mostly AND/OR, no NOT.
  function randomExpr(k, keys, easy = false) {
    const pool = keys.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const build = n => {
      let node;
      if (n === 1) node = { type: 'atom', key: pool.pop() };
      else {
        const left = 1 + Math.floor(Math.random() * (n - 1));
        const r = Math.random();
        const op = easy ? (r < 0.15 ? 'if' : r < 0.575 ? 'and' : 'or') : ['and', 'or', 'if'][Math.floor(r * 3)];
        node = { type: 'op', op, args: [build(left), build(n - left)] };
      }
      return !easy && Math.random() < 0.2 ? { type: 'op', op: 'not', args: [node] } : node;
    };
    return build(k);
  }

  const api = { randomExpr, evalNode, countTemplates, isComplete, toText, solvePar };
  if (typeof module !== 'undefined') module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
