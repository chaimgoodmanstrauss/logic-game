(() => {
  const { evalNode, countTemplates, isComplete, toText, solvePar, randomExpr } = Logic;
  const $ = id => document.getElementById(id);
  const HAND_SIZES = [4, 5, 6];

  const atomTests = Object.fromEntries(ATOMS.map(a => [a.key, a.test]));
  const atomByKey = Object.fromEntries(ATOMS.map(a => [a.key, a]));
  const labels = Object.fromEntries(ATOMS.map(a => [a.key, a.label]));
  const FULL = (1 << ANIMALS.length) - 1;
  const atomMasks = ATOMS.map(at => ANIMALS.reduce((m, a, i) => at.test(a) ? m | (1 << i) : m, 0));

  let hand = [];          // animal indices
  let swapped = false;
  let hiddenExpr = null;  // the generating expression (guarantees a solution until a swap)
  let totalBase = 0, dealBest = 0;
  let tree = null;        // root expression
  let submitted = false;
  let undoStack = [], redoStack = [];
  let drag = null;        // {new:{kind,key|op}} or {path}
  let parToken = 0;
  const cardEls = [];

  // ---------- tree helpers ----------
  const get = (root, path) => path.reduce((n, i) => n.args[i], root);
  function set(root, path, val) {
    if (!path.length) return val;
    get(root, path.slice(0, -1)).args[path[path.length - 1]] = val;
    return root;
  }
  const isPrefix = (p, q) => p.length <= q.length && p.every((v, i) => q[i] === v);
  function commit(next) {
    undoStack.push(tree); redoStack = [];
    tree = next; submitted = false; renderAll();
  }
  function undo() { if (!undoStack.length) return; redoStack.push(tree); tree = undoStack.pop(); submitted = false; renderAll(); }
  function redo() { if (!redoStack.length) return; undoStack.push(tree); tree = redoStack.pop(); submitted = false; renderAll(); }
  const clone = x => (x ? JSON.parse(JSON.stringify(x)) : x);

  // ---------- dealing ----------
  const maskOf = idxs => idxs.reduce((m, i) => m | (1 << i), 0);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Hands already played (per atom count), remembered across reloads so deals don't repeat until the pool is exhausted.
  const SEEN_KEY = 'animal-logic-seen';
  function loadSeen() { try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || {}; } catch { return {}; } }
  function saveSeen(s) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch {} }

  // Work backwards: generate a random expression with `difficulty` atoms until it is true of exactly 5 animals.
  function dealHand(difficulty, size) {
    const seenKey = `${difficulty}-${size}`;
    const keys = ATOMS.map(a => a.key);
    const seen = loadSeen();
    for (let pass = 0; pass < 2; pass++) {
      const used = new Set(seen[seenKey] || []);
      for (let tries = 0; tries < 20000; tries++) {
        const e = randomExpr(difficulty, keys, difficulty >= 3);
        const matches = ANIMALS.map((_, i) => i).filter(i => evalNode(e, ANIMALS[i], atomTests) === true);
        if (matches.length !== size) continue;
        const m = maskOf(matches);
        if (used.has(m) || (hand.length && m === maskOf(hand))) continue;
        seen[seenKey] = [...used, m];
        saveSeen(seen);
        return { cards: shuffle(matches), expr: e };
      }
      seen[seenKey] = []; // every hand at this level has been played: start over
    }
    return null;
  }

  function newDeal() {
    totalBase += dealBest; dealBest = 0;
    const level = $('difficulty').value;
    const size = HAND_SIZES[Math.floor(Math.random() * HAND_SIZES.length)];
    const deal = dealHand(level === 'mix' ? 1 + Math.floor(Math.random() * 4) : +level, size);
    if (!deal) return;
    hand = deal.cards;
    hiddenExpr = deal.expr;
    par = countTemplates(deal.expr); solved = {};
    swapped = false;
    tree = null; undoStack = []; redoStack = []; submitted = false;
    buildCards();
    renderAll();
    computePar();
  }

  const canSwapIn = () => !swapped && drag && drag.swapIn !== undefined;

  function swapCard(handPos, newIdx) {
    hiddenExpr = null; par = null; solved = {};
    hand[handPos] = newIdx; submitted = false;
    swapped = true;
    buildCards();
    renderAll();
    computePar();
  }

  // ---------- par ----------
  function showPar() {
    $('par').textContent = par === null ? '…' : parIsLowerBound ? `${par}+` : par;
  }
  let par = null, parIsLowerBound = false;
  let solved = {};

  // The hidden expression gives an upper bound on par; the solver can only lower it. After a swap the solver is the only source.
  function computePar() {
    const token = ++parToken;
    parIsLowerBound = false;
    showPar();
    const gen = solvePar(atomMasks, maskOf(hand), FULL, 4000, ATOMS.map(a => a.key), solved = {});
    (function step() {
      if (token !== parToken) return;
      const r = gen.next();
      if (!r.done) return void setTimeout(step, 0);
      const v = r.value;
      if (typeof v === 'number') { par = par === null ? v : Math.min(par, v); }
      else if (par === null) { par = v.atLeast; parIsLowerBound = true; }
      showPar();
      updateStatus();
    })();
  }

  function pointsFor(n) {
    if (n <= par) return 100 + 50 * (par - n);
    return Math.max(10, 100 - 25 * (n - par));
  }

  // ---------- cards ----------
  function tagsOf(a) {
    const col = { bw: 'black & white', brown: 'brown', colorful: 'colorful' }[a.color];
    const legs = a.legs === 0 ? 'no\u00a0legs' : a.legs === 'many' ? 'many\u00a0legs' : `${a.legs}\u00a0legs`;
    return `${col} · ${a.habitats.join('/')} · ${legs}`;
  }

  function makeCard(idx, inHand, handPos) {
    const a = ANIMALS[idx];
    const el = document.createElement('div');
    el.className = 'card' + (inHand ? ' hand' : '');
    el.innerHTML = `<div class="pic"><img alt="" src="images/${a.id}.jpg"><span class="emoji" hidden>${a.emoji}</span></div>
      <div class="nm">${a.name}</div><div class="tags">${tagsOf(a)}</div><div class="mark"></div>`;
    const img = el.querySelector('img'), em = el.querySelector('.emoji');
    img.onerror = () => { img.remove(); em.hidden = false; };
    if (inHand) {
      el.addEventListener('dragover', e => { if (canSwapIn()) { e.preventDefault(); el.classList.add('over'); } });
      el.addEventListener('dragleave', () => el.classList.remove('over'));
      el.addEventListener('drop', e => { e.preventDefault(); clearOver(); if (canSwapIn()) swapCard(handPos, drag.swapIn); drag = null; });
    } else if (!swapped) {
      el.draggable = true;
      el.classList.add('swappable');
      el.addEventListener('dragstart', e => { drag = { swapIn: idx }; e.dataTransfer.setData('text/plain', 'card'); e.dataTransfer.effectAllowed = 'move'; });
      el.addEventListener('dragend', () => { drag = null; clearOver(); });
    }
    cardEls[idx] = el;
    return el;
  }

  function buildCards() {
    $('hand').replaceChildren(...hand.map((idx, p) => makeCard(idx, true, p)));
    $('pool').replaceChildren(...ANIMALS.map((_, i) => i).filter(i => !hand.includes(i)).map(i => makeCard(i, false)));
  }

  // ---------- workspace rendering ----------
  function nodeEl(node, path, interactive) {
    if (!node) {
      const s = document.createElement('span');
      s.className = 'slot'; s.textContent = '…';
      s.dataset.path = JSON.stringify(path);
      if (interactive) wireDrop(s, path);
      return s;
    }
    const el = document.createElement('span');
    el.className = 'node';
    if (node.type === 'atom') {
      const at = atomByKey[node.key];
      el.classList.add('atom', at.group);
      el.append(at.label);
    } else {
      el.classList.add('op');
      const kw = t => { const k = document.createElement('span'); k.className = 'kw'; k.textContent = t; return k; };
      const arg = i => nodeEl(node.args[i], [...path, i], interactive);
      if (node.op === 'not') el.append(kw('NOT'), arg(0));
      else if (node.op === 'if') el.append(kw('IF'), arg(0), kw('THEN'), arg(1));
      else el.append(arg(0), kw(node.op.toUpperCase()), arg(1));
    }
    if (interactive) {
      el.draggable = true;
      el.addEventListener('dragstart', e => {
        e.stopPropagation();
        drag = { path };
        e.dataTransfer.setData('text/plain', 'node');
        e.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => { drag = null; clearOver(); });
      const del = document.createElement('button');
      del.className = 'del'; del.textContent = '×'; del.title = 'Remove';
      del.onclick = e => { e.stopPropagation(); commit(set(clone(tree), path, null)); };
      el.append(del);
      wireDrop(el, path);
    }
    el.dataset.path = JSON.stringify(path);
    return el;
  }

  function clearOver() { document.querySelectorAll('.over').forEach(e => e.classList.remove('over')); }

  function wireDrop(el, path) {
    el.addEventListener('dragover', e => { if (!drag || drag.swapIn !== undefined) return; e.preventDefault(); e.stopPropagation(); clearOver(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); clearOver(); if (drag && drag.swapIn === undefined) dropOn(path); drag = null; });
  }

  // Place the dragged item at `path`. Blank → fill it. Filled + template → wrap (existing goes into the template's first blank). Filled + atom → replace.
  function dropOn(path) {
    let t = clone(tree);
    let item;
    if (drag.path) {
      if (isPrefix(drag.path, path)) return; // can't drop a node into itself
      item = get(t, drag.path);
      t = set(t, drag.path, null);
    } else if (drag.atom) {
      item = { type: 'atom', key: drag.atom };
    } else {
      const tpl = TEMPLATES.find(x => x.op === drag.op);
      item = { type: 'op', op: tpl.op, args: Array(tpl.arity).fill(null) };
    }
    const target = get(t, path);
    if (target) {
      if (item.type === 'op') {
        const blank = item.args.indexOf(null);
        if (blank < 0) return;
        item.args[blank] = target;
      }
    }
    commit(set(t, path, item));
  }

  function buildPalette() {
    const pal = $('palette');
    const mk = (cls, text, d) => {
      const el = document.createElement('span');
      el.className = 'node ' + cls; el.textContent = text; el.draggable = true;
      el.addEventListener('dragstart', e => { drag = d; e.dataTransfer.setData('text/plain', text); e.dataTransfer.effectAllowed = 'copy'; });
      el.addEventListener('dragend', () => { drag = null; clearOver(); });
      return el;
    };
    for (const a of ATOMS) pal.append(mk('atom ' + a.group, a.label, { atom: a.key }));
    const sep = document.createElement('span'); sep.className = 'sep'; pal.append(sep);
    for (const t of TEMPLATES) {
      const el = mk('op', '', { op: t.op });
      const kw = x => { const k = document.createElement('span'); k.className = 'kw'; k.textContent = x; return k; };
      const blank = () => { const b = document.createElement('span'); b.className = 'slot'; b.textContent = '…'; b.style.minWidth = '30px'; return b; };
      if (t.op === 'not') el.append(kw('NOT'), blank());
      else if (t.op === 'if') el.append(kw('IF'), blank(), kw('THEN'), blank());
      else el.append(blank(), kw(t.label), blank());
      pal.append(el);
    }
  }

  // ---------- evaluation + status ----------
  function lightCards() {
    let litCount = 0, wrongCount = 0;
    const handSet = new Set(hand);
    ANIMALS.forEach((a, i) => {
      const el = cardEls[i];
      const v = evalNode(tree, a, atomTests);
      el.classList.toggle('lit', v === true);
      el.classList.toggle('dim', v === false);
      el.classList.toggle('maybe', v === undefined && !!tree);
      const inHand = handSet.has(i);
      const wrong = v !== undefined && v !== inHand;
      el.classList.toggle('wrong', submitted && wrong);
      el.classList.toggle('right', submitted && v !== undefined && v === inHand);
      el.querySelector('.mark').textContent = wrong ? '✕' : '✓';
      if (v === true) litCount++;
      if (wrong) wrongCount++;
    });
    return { litCount, wrongCount };
  }

  function updateStatus() {
    const n = countTemplates(tree);
    $('score').textContent = n;
    const { wrongCount } = lightCards();
    $('total').textContent = totalBase + dealBest;
    const complete = isComplete(tree);
    const solvedNow = submitted && complete && wrongCount === 0;
    $('submit').hidden = solvedNow;
    $('submit').disabled = !complete;
    $('clear').hidden = solvedNow;
    const sa = $('showanswer');
    sa.hidden = solvedNow && !(par !== null && n > par);
    sa.textContent = solvedNow ? 'Show par' : 'Show answer';
    const st = $('status');
    st.className = '';
    if (!tree) { st.textContent = ''; return; }
    if (!complete) { st.textContent = ''; return; }
    if (!submitted) { st.textContent = 'Press Submit answer when you’re ready.'; return; }
    if (wrongCount === 0) {
      st.className = 'win';
      if (par === null) { st.textContent = 'Solved — working out par…'; return; }
      const pts = pointsFor(n);
      dealBest = Math.max(dealBest, pts);
      const parTxt = n === par ? ' — par!' : n < par ? ' — under par!' : ` (par ${par})`;
      st.textContent = `Solved with ${n} template${n === 1 ? '' : 's'}${parTxt} +${pts} points. “These animals are ${toText(tree, labels)}.”`;
    } else {
      st.textContent = `${wrongCount} animal${wrongCount === 1 ? ' is' : 's are'} classified wrongly (✕). Keep editing and submit again.`;
    }
  }

  function renderAll() {
    $('undo').disabled = !undoStack.length;
    $('redo').disabled = !redoStack.length;
    $('workspace').replaceChildren(nodeEl(tree, [], true));
    updateStatus();
  }

  // ---------- answer panel ----------
  function showAnswer() {
    const expr = solved.expr || hiddenExpr;
    $('answer-text').textContent = expr
      ? `These animals are ${toText(expr, labels)}.`
      : 'No short answer found within the search limit.';
    $('answer-count').textContent = expr ? `${countTemplates(expr)} template${countTemplates(expr) === 1 ? '' : 's'}` : '';
    $('answer').hidden = false;
  }

  // ---------- init ----------
  $('showanswer').onclick = showAnswer;
  $('answer-close').onclick = () => { $('answer').hidden = true; };
  $('answer-new').onclick = () => { $('answer').hidden = true; newDeal(); };
  buildPalette();
  $('newdeal').onclick = newDeal;
  $('clear').onclick = () => { if (tree) commit(null); };
  $('submit').onclick = () => { submitted = true; renderAll(); };
  $('undo').onclick = undo;
  $('redo').onclick = redo;
  document.addEventListener('keydown', e => {
    if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
    e.preventDefault(); e.shiftKey ? redo() : undo();
  });
  newDeal();
})();
