(() => {
  const { evalNode, countTemplates, isComplete, toText, solvePar, randomExpr } = Logic;
  const $ = id => document.getElementById(id);
  const HAND_MIN = 4, HAND_MAX = 6;

  const atomTests = Object.fromEntries(ATOMS.map(a => [a.key, a.test]));
  const atomByKey = Object.fromEntries(ATOMS.map(a => [a.key, a]));
  const labels = Object.fromEntries(ATOMS.map(a => [a.key, a.label]));
  const FULL = (1 << ANIMALS.length) - 1;
  const atomMasks = ATOMS.map(at => ANIMALS.reduce((m, a, i) => at.test(a) ? m | (1 << i) : m, 0));

  let hand = [];          // animal indices
  let swapped = false;
  let tree = null;        // root expression
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
  const clone = x => (x ? JSON.parse(JSON.stringify(x)) : x);

  // ---------- dealing ----------
  const maskOf = idxs => idxs.reduce((m, i) => m | (1 << i), 0);
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // Deal a hand that is describable by a small hidden expression, so par stays reasonable.
  function dealHand() {
    const keys = ATOMS.map(a => a.key);
    for (let tries = 0; tries < 2000; tries++) {
      const e = randomExpr(2 + Math.floor(Math.random() * 2), keys);
      const set_ = ANIMALS.map((a, i) => i).filter(i => evalNode(e, ANIMALS[i], atomTests) === true);
      if (set_.length >= HAND_MIN && set_.length <= HAND_MAX) return set_;
    }
    return shuffle(ANIMALS.map((_, i) => i)).slice(0, 5);
  }

  function newDeal() {
    hand = dealHand();
    swapped = false;
    tree = null;
    buildCards();
    renderAll();
    computePar();
  }

  function swapCard(handPos) {
    if (swapped) return;
    const others = ANIMALS.map((_, i) => i).filter(i => !hand.includes(i));
    hand[handPos] = others[Math.floor(Math.random() * others.length)];
    swapped = true;
    buildCards();
    renderAll();
    computePar();
  }

  // ---------- par ----------
  function computePar() {
    const token = ++parToken;
    $('par').textContent = '…';
    const gen = solvePar(atomMasks, maskOf(hand), FULL);
    (function step() {
      if (token !== parToken) return;
      const r = gen.next();
      if (!r.done) return void setTimeout(step, 0);
      const v = r.value;
      $('par').textContent = typeof v === 'number' ? v : `${v.atLeast}+`;
      par = v;
      updateStatus();
    })();
  }
  let par = null;

  // ---------- cards ----------
  function tagsOf(a) {
    const col = { bw: 'black & white', brown: 'brown', colorful: 'colorful' }[a.color];
    const legs = a.legs === 0 ? 'no legs' : a.legs === 'many' ? 'many legs' : `${a.legs} legs`;
    return `${col} · ${a.habitats.join('/')} · ${legs}`;
  }

  function makeCard(idx, inHand, handPos) {
    const a = ANIMALS[idx];
    const el = document.createElement('div');
    el.className = 'card' + (inHand ? ' hand' : '');
    el.innerHTML = `<div class="pic"><img alt="" src="images/${a.id}.png"><span class="emoji" hidden>${a.emoji}</span></div>
      <div class="nm">${a.name}</div><div class="tags">${tagsOf(a)}</div><div class="mark"></div>`;
    const img = el.querySelector('img'), em = el.querySelector('.emoji');
    img.onerror = () => { img.remove(); em.hidden = false; };
    if (inHand) {
      const b = document.createElement('button');
      b.className = 'swap'; b.textContent = 'Swap';
      b.onclick = () => swapCard(handPos);
      el.appendChild(b);
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
      del.onclick = e => { e.stopPropagation(); tree = set(clone(tree), path, null); renderAll(); };
      el.append(del);
      wireDrop(el, path);
    }
    el.dataset.path = JSON.stringify(path);
    return el;
  }

  function clearOver() { document.querySelectorAll('.over').forEach(e => e.classList.remove('over')); }

  function wireDrop(el, path) {
    el.addEventListener('dragover', e => { if (!drag) return; e.preventDefault(); e.stopPropagation(); clearOver(); el.classList.add('over'); });
    el.addEventListener('dragleave', () => el.classList.remove('over'));
    el.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); clearOver(); if (drag) dropOn(path); drag = null; });
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
    tree = set(t, path, item);
    renderAll();
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
      el.classList.toggle('wrong', wrong);
      el.classList.toggle('right', v !== undefined && v === inHand && isComplete(tree));
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
    const st = $('status');
    st.className = '';
    if (!tree) { st.textContent = 'Drag pieces into the blank to build a description. Lit cards match.'; return; }
    if (!isComplete(tree)) { st.textContent = 'Fill in every blank. Faded-but-visible cards depend on a blank you haven’t filled.'; return; }
    if (wrongCount === 0) {
      st.className = 'win';
      const parTxt = typeof par === 'number' ? (n === par ? ' — perfect, matches par!' : n < par ? ' — beats par?!' : ` (par ${par})`) : '';
      st.textContent = `Solved with ${n} template${n === 1 ? '' : 's'}${parTxt}. “These animals are ${toText(tree, labels)}.”`;
    } else {
      st.textContent = `${wrongCount} animal${wrongCount === 1 ? ' is' : 's are'} classified wrongly (✕). Missing hand cards or extras are marked.`;
    }
  }

  function renderAll() {
    document.querySelectorAll('.swap').forEach(b => b.disabled = swapped);
    $('workspace').replaceChildren(nodeEl(tree, [], true));
    updateStatus();
  }

  // ---------- init ----------
  buildPalette();
  $('newdeal').onclick = newDeal;
  $('clear').onclick = () => { tree = null; renderAll(); };
  const trash = $('trash');
  trash.addEventListener('dragover', e => { if (drag && drag.path) { e.preventDefault(); trash.classList.add('over'); } });
  trash.addEventListener('dragleave', () => trash.classList.remove('over'));
  trash.addEventListener('drop', e => {
    e.preventDefault(); trash.classList.remove('over');
    if (drag && drag.path) { tree = set(clone(tree), drag.path, null); renderAll(); }
    drag = null;
  });
  newDeal();
})();
