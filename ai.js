// Pathfinding AI for Snake
// Globals used from game.js: snake, food, dir, wrapMode, COLS, ROWS

const AI_STEPS = [{x:0,y:-1},{x:1,y:0},{x:0,y:1},{x:-1,y:0}];

function aiKey(pos) { return pos.x * 100 + pos.y; }

function aiNeighbors(pos) {
  const out = [];
  for (const {x:dx, y:dy} of AI_STEPS) {
    let nx = pos.x + dx, ny = pos.y + dy;
    if (wrapMode) { nx = (nx+COLS)%COLS; ny = (ny+ROWS)%ROWS; }
    else if (nx<0||nx>=COLS||ny<0||ny>=ROWS) continue;
    out.push({pos:{x:nx,y:ny}, dir:{x:dx,y:dy}});
  }
  return out;
}

function aiBFS(start, end, blocked) {
  const sk = aiKey(start), ek = aiKey(end);
  if (sk === ek) return [];
  const q = [start], prev = new Map([[sk, null]]), dmap = new Map();
  while (q.length) {
    const cur = q.shift();
    for (const {pos, dir: d} of aiNeighbors(cur)) {
      const nk = aiKey(pos);
      if (prev.has(nk) || blocked.has(nk)) continue;
      prev.set(nk, aiKey(cur)); dmap.set(nk, d);
      if (nk === ek) {
        const path = [];
        for (let c=nk; prev.get(c)!==null; c=prev.get(c)) path.unshift(dmap.get(c));
        return path;
      }
      q.push(pos);
    }
  }
  return null;
}

function aiFlood(start, blocked) {
  const q = [start], vis = new Set([aiKey(start)]);
  while (q.length) {
    const cur = q.shift();
    for (const {pos} of aiNeighbors(cur)) {
      const nk = aiKey(pos);
      if (vis.has(nk) || blocked.has(nk)) continue;
      vis.add(nk); q.push(pos);
    }
  }
  return vis.size;
}

function aiSimulate(snk, steps) {
  const s = snk.map(c=>({...c}));
  for (let i=0; i<steps.length; i++) {
    let nx = s[0].x+steps[i].x, ny = s[0].y+steps[i].y;
    if (wrapMode) { nx=(nx+COLS)%COLS; ny=(ny+ROWS)%ROWS; }
    s.unshift({x:nx, y:ny});
    if (i < steps.length-1) s.pop();
  }
  return s;
}

function aiDecide() {
  const head = snake[0];
  const bodySet   = new Set(snake.map(aiKey));
  const noTailSet = new Set(snake.slice(0,-1).map(aiKey));

  const toFood = aiBFS(head, food, noTailSet);
  if (toFood && toFood.length > 0) {
    const after    = aiSimulate(snake, toFood);
    const aBlocked = new Set(after.slice(0,-1).map(aiKey));
    if (aiBFS(after[0], after[after.length-1], aBlocked) !== null || after.length >= COLS*ROWS-2)
      return toFood[0];
  }

  const toTail = aiBFS(head, snake[snake.length-1], noTailSet);
  if (toTail && toTail.length > 0) return toTail[0];

  let bestDir = null, bestN = -1;
  for (const {pos, dir: d} of aiNeighbors(head)) {
    if (bodySet.has(aiKey(pos))) continue;
    const n = aiFlood(pos, bodySet);
    if (n > bestN) { bestN=n; bestDir=d; }
  }
  return bestDir;
}
