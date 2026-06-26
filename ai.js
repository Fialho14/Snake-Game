// Hamiltonian Cycle AI with shortcuts
//
// Algorithm (from devshashtag/snake, adapted):
//   1. Prim's MST on a (COLS/2 × ROWS/2) grid of nodes at odd coordinates
//   2. Wall-follow around the MST to produce a Hamiltonian cycle visiting
//      every cell exactly once — guarantees the snake never dies
//   3. When the snake occupies < ~55% of the grid, take safe shortcuts
//      through the cycle to reach food faster
//
// Public API consumed by game.js:
//   aiDecide() → {x, y} direction for the next step
//   aiReset()  → call at the start of each new game

const AI_STEPS = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];

function aiKey(pos) { return pos.x * 100 + pos.y; }

// ── Cycle state ───────────────────────────────────────────────────────────────
let _cycle    = null;   // [{x,y}] ordered path, length = COLS * ROWS
let _cycleMap = null;   // Map<aiKey → cycleIndex>
let _cycleIdx = 0;      // index of the cell currently being headed toward

function aiReset() {
  _cycle = null;  // regenerate on next aiDecide() call (new random cycle each game)
}

// ── Build Hamiltonian cycle (Prim's MST + wall-follow) ────────────────────────
function _buildCycle() {
  const C = COLS >> 1, R = ROWS >> 1, N = C * R;

  // 1. Nodes at odd grid coordinates
  const nodes = [];
  for (let y = 0; y < R; y++)
    for (let x = 0; x < C; x++)
      nodes.push({ x: x * 2 + 1, y: y * 2 + 1 });

  // 2. All possible edges with random weights
  const rnd = () => (Math.random() * 3 | 0) + 1;
  const edges = [];
  for (let y = 0; y < R; y++)
    for (let x = 0; x < C - 1; x++)
      edges.push({ s: y * C + x, e: y * C + x + 1, w: rnd() });
  for (let x = 0; x < C; x++)
    for (let y = 0; y < R - 1; y++)
      edges.push({ s: y * C + x, e: (y + 1) * C + x, w: rnd() });

  // 3. Prim's MST
  const vis = new Set([0]);
  const mst = [];
  while (vis.size < N) {
    let best = null;
    for (const e of edges) {
      if (vis.has(e.s) === vis.has(e.e)) continue;
      if (!best || e.w < best.w) best = e;
    }
    if (!best) {
      for (let i = 0; i < N; i++) if (!vis.has(i)) { vis.add(i); break; }
    } else {
      mst.push(best);
      vis.add(vis.has(best.e) ? best.s : best.e);
    }
  }

  // 4. Wall points: MST nodes + midpoints between connected nodes
  const pts = new Set();
  for (const e of mst) {
    const a = nodes[e.s], b = nodes[e.e];
    pts.add(`${a.x},${a.y}`);
    pts.add(`${(a.x + b.x) >> 1},${(a.y + b.y) >> 1}`);
    pts.add(`${b.x},${b.y}`);
  }
  const inP = (x, y) => pts.has(`${x},${y}`);

  // 5. Wall-follow from (0,0) to build the full Hamiltonian cycle
  //    d: 0=right  1=down  2=left  3=up
  const cycle = [{ x: 0, y: 0 }];
  const seen  = new Set(['0,0']);
  let cx = 0, cy = 0, d = 0;
  let guard = COLS * ROWS * 20;

  while (cycle.length < COLS * ROWS && guard-- > 0) {
    let nx = cx, ny = cy, moved = false;

    if (d === 0) {        // right
      if      (inP(cx+1,cy+1) && !inP(cx+1,cy))     { nx = cx+1; moved = true; }
      else if (inP(cx,  cy+1) && !inP(cx+1,cy+1))   d = 1;
      else                                             d = 3;
    } else if (d === 1) { // down
      if      (inP(cx,  cy+1) && !inP(cx+1,cy+1))   { ny = cy+1; moved = true; }
      else if (inP(cx,  cy+1) &&  inP(cx+1,cy+1))   d = 0;
      else                                             d = 2;
    } else if (d === 2) { // left
      if      (inP(cx,  cy)   && !inP(cx,  cy+1))   { nx = cx-1; moved = true; }
      else if (!inP(cx, cy+1))                        d = 3;
      else                                             d = 1;
    } else {              // up
      if      (inP(cx+1,cy)   && !inP(cx,  cy))     { ny = cy-1; moved = true; }
      else if (inP(cx+1,cy))                          d = 2;
      else                                             d = 0;
    }

    if (moved) {
      cx = nx; cy = ny;
      const k = `${cx},${cy}`;
      if (!seen.has(k)) { seen.add(k); cycle.push({ x: cx, y: cy }); }
    }
  }

  _cycle    = cycle;
  _cycleMap = new Map(cycle.map((p, i) => [aiKey(p), i]));
  const hi  = _cycleMap.get(aiKey(snake[0])) ?? 0;
  _cycleIdx = (hi + 1) % cycle.length;
}

// ── Main decision function ────────────────────────────────────────────────────
function aiDecide() {
  if (!_cycle) _buildCycle();

  const head     = snake[0];
  const gridSize = COLS * ROWS;
  const len      = snake.length;

  // Advance past the head's current cycle position
  if (aiKey(_cycle[_cycleIdx]) === aiKey(head))
    _cycleIdx = (_cycleIdx + 1) % _cycle.length;

  // ── Shortcuts: skip forward in the cycle when snake is short ─────────────
  if (len < Math.floor(gridSize / 1.8)) {
    const hIdx  = _cycleIdx;
    const aIdx  = _cycleMap.get(aiKey(food));
    const tIdx  = _cycleMap.get(aiKey(snake[len - 1]));
    const limit = len < Math.floor(gridSize / 2);

    // Collect cycle indices of the 4 adjacent cells
    const nbIdxs = [];
    for (const s of AI_STEPS) {
      const nx = head.x + s.x, ny = head.y + s.y;
      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
      const idx = _cycleMap.get(aiKey({ x: nx, y: ny }));
      if (idx !== undefined) nbIdxs.push(idx);
    }

    let newIdx = hIdx;

    // apple < tail < head  (and snake short enough)
    if (aIdx < tIdx && tIdx < hIdx && limit) {
      for (const nb of nbIdxs) {
        if      (nb < aIdx && nb > newIdx) newIdx = nb;
        else if (nb > hIdx)                newIdx = nb;
      }
    // apple ahead of head  (and snake short enough)
    } else if (aIdx > hIdx && limit) {
      for (const nb of nbIdxs) {
        if (nb > hIdx && nb < aIdx && nb > newIdx) {
          if (tIdx > hIdx) { if (nb < tIdx) newIdx = nb; }
          else newIdx = nb;
        }
      }
    // apple ahead, tail on same side as apple (or both behind head)
    } else if (aIdx > hIdx && ((tIdx > aIdx && tIdx > hIdx) || (tIdx < aIdx && tIdx < hIdx))) {
      for (const nb of nbIdxs) {
        if (nb > hIdx && nb < aIdx && nb > newIdx) newIdx = nb;
      }
    // apple behind head
    } else if (aIdx < hIdx) {
      for (const nb of nbIdxs) {
        if (nb > hIdx && nb > newIdx) {
          if (tIdx > hIdx && nb < tIdx) newIdx = nb;
        } else newIdx = nb;
      }
    }

    if (newIdx !== hIdx) _cycleIdx = newIdx;
  }

  const next = _cycle[_cycleIdx];
  return { x: next.x - head.x, y: next.y - head.y };
}
