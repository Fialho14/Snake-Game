const COLS = 20, ROWS = 20, CELL = 26;

const canvas = document.getElementById('canvas');
const ctx    = canvas.getContext('2d');
canvas.width  = COLS * CELL;
canvas.height = ROWS * CELL;

const scoreEl      = document.getElementById('score');
const bestEl       = document.getElementById('best');
const levelEl      = document.getElementById('level');
const overlay      = document.getElementById('overlay');
const overlayIcon  = document.getElementById('overlay-icon');
const overlayTitle = document.getElementById('overlay-title');
const overlaySub   = document.getElementById('overlay-sub');
const btnPlay      = document.getElementById('btn-play');
const btnWrap      = document.getElementById('btn-wrap');
const btnAI        = document.getElementById('btn-ai');
const btnTheme     = document.getElementById('btn-theme');
const btnSound     = document.getElementById('btn-sound');

// ── Colors (two themes) ──────────────────────────────────────────────────────
const THEME = {
  light: { bg:'#f2f2f7', dot:'rgba(60,60,67,0.18)', green:'#34c759', greenMid:'#28a046', greenDim:'#1e7a35', red:'#ff3b30' },
  dark:  { bg:'#1c1c1e', dot:'rgba(255,255,255,0.07)', green:'#30d158', greenMid:'#25a244', greenDim:'#1a6e2e', red:'#ff453a' },
};
let C = {...THEME.light};

// ── Speed settings ────────────────────────────────────────────────────────────
const SPEED_SETTINGS = {
  slow:   { base: 240, min: 130 },
  normal: { base: 160, min: 58  },
  fast:   { base: 90,  min: 32  },
};
let speedKey = 'normal';
function speed(lvl) {
  const {base, min} = SPEED_SETTINGS[speedKey];
  return Math.max(min, base - (lvl - 1) * 13);
}

// ── Sound ─────────────────────────────────────────────────────────────────────
let audioCtx = null;
let soundOn  = localStorage.getItem('snakeSound') === 'true';

function getAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function tone(freq, dur, type = 'sine', vol = 0.15) {
  if (!soundOn) return;
  const ac = getAudio();
  const osc = ac.createOscillator(), g = ac.createGain();
  osc.connect(g); g.connect(ac.destination);
  osc.type = type; osc.frequency.value = freq;
  g.gain.setValueAtTime(vol, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  osc.start(); osc.stop(ac.currentTime + dur);
}

function playEat()  { tone(880, 0.08); tone(1320, 0.07); }
function playDie()  { tone(200, 0.15, 'sawtooth', 0.18); tone(140, 0.3, 'sawtooth', 0.12); }
function playLevel(){ tone(660, 0.06); tone(880, 0.06); tone(1100, 0.12); }

// ── Game state ────────────────────────────────────────────────────────────────
const DIR = { UP:{x:0,y:-1}, DOWN:{x:0,y:1}, LEFT:{x:-1,y:0}, RIGHT:{x:1,y:0} };
const OPP = { UP:'DOWN', DOWN:'UP', LEFT:'RIGHT', RIGHT:'LEFT' };
const KEY_MAP = {
  ArrowUp:'UP', ArrowDown:'DOWN', ArrowLeft:'LEFT', ArrowRight:'RIGHT',
  w:'UP', s:'DOWN', a:'LEFT', d:'RIGHT',
  W:'UP', S:'DOWN', A:'LEFT', D:'RIGHT',
};

let snake, prevSnake, dir, inputQueue, food;
let score, best, level, running, paused, wrapMode, isAI, darkMode;
let dying, dyingStart;
let lastStepTime, stepDuration, loopId, rafId, aiRestartTimer;
let overlayState = 'start';

best     = parseInt(localStorage.getItem('snakeBest') || '0');
wrapMode = false;
isAI     = false;
darkMode = localStorage.getItem('snakeDark') === 'true';
bestEl.textContent = best;

if (darkMode) applyTheme(true, false);
if (soundOn)  btnSound.textContent = '🔊';

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(dark, save = true) {
  darkMode = dark;
  C = {...THEME[dark ? 'dark' : 'light']};
  document.body.dataset.theme = dark ? 'dark' : '';
  btnTheme.textContent = dark ? '☀️' : '🌙';
  if (save) localStorage.setItem('snakeDark', dark);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function randomCell(excl) {
  let p;
  do { p = {x: Math.floor(Math.random()*COLS), y: Math.floor(Math.random()*ROWS)}; }
  while (excl.some(s => s.x===p.x && s.y===p.y));
  return p;
}

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

// ── Game logic ────────────────────────────────────────────────────────────────
function initGame() {
  const mx = Math.floor(COLS/2), my = Math.floor(ROWS/2);
  snake      = [{x:mx,y:my},{x:mx-1,y:my},{x:mx-2,y:my}];
  prevSnake  = snake.map(s => ({...s}));
  dir        = {...DIR.RIGHT};
  inputQueue = [];
  score = 0; level = 1;
  paused = false; dying = false;
  scoreEl.textContent = 0;
  levelEl.textContent = 1;
  food         = randomCell(snake);
  running      = true;
  lastStepTime = performance.now();
  stepDuration = speed(1);
}

function step() {
  prevSnake    = snake.map(s => ({...s}));
  lastStepTime = performance.now();

  if (inputQueue.length) dir = inputQueue.shift();

  const head = {x: snake[0].x + dir.x, y: snake[0].y + dir.y};

  if (wrapMode) {
    head.x = (head.x + COLS) % COLS;
    head.y = (head.y + ROWS) % ROWS;
  } else if (head.x < 0 || head.x >= COLS || head.y < 0 || head.y >= ROWS) {
    startDying(); return;
  }

  if (snake.some(s => s.x===head.x && s.y===head.y)) { startDying(); return; }

  snake.unshift(head);
  if (head.x===food.x && head.y===food.y) {
    score++;
    scoreEl.textContent = score;
    playEat();
    const nl = 1 + Math.floor(score / 5);
    if (nl !== level) {
      level = nl; levelEl.textContent = level;
      playLevel();
      clearInterval(loopId);
      stepDuration = speed(level);
      loopId = setInterval(tick, stepDuration);
    }
    food = randomCell(snake);
  } else {
    snake.pop();
  }
}

function tick() {
  if (!running || paused || dying) return;
  if (isAI && inputQueue.length === 0) {
    const move = aiDecide();
    if (move && !(move.x === -dir.x && move.y === -dir.y))
      inputQueue.push(move);
  }
  step();
}

function startDying() {
  running = false; dying = true;
  dyingStart = performance.now();
  playDie();
  clearInterval(loopId);
  setTimeout(endGame, 680);
}

function endGame() {
  dying = false;
  cancelAnimationFrame(rafId);
  if (score > best) {
    best = score;
    localStorage.setItem('snakeBest', best);
    bestEl.textContent = best;
  }

  if (isAI) {
    overlayState = 'gameover';
    overlayIcon.textContent  = '🤖';
    overlayTitle.textContent = 'AI died';
    overlaySub.innerHTML     = score > 0
      ? `Score <b>${score}</b>${score===best && score>0 ? ' · New Best 🎉' : ''}`
      : 'Restarting...';
    btnPlay.textContent = 'Restart AI';
    btnPlay.className   = 'ai-btn';
    overlay.classList.remove('hidden');
    aiRestartTimer = setTimeout(() => { if (isAI) startGame(); }, 1800);
  } else {
    overlayState = 'gameover';
    overlayIcon.textContent  = '💀';
    overlayTitle.textContent = 'Game Over';
    overlaySub.innerHTML     = score > 0
      ? `Score <b>${score}</b>${score===best && score>0 ? ' · New Best 🎉' : ''}`
      : 'Better luck next time';
    btnPlay.textContent = 'Try Again';
    btnPlay.className   = '';
    overlay.classList.remove('hidden');
  }
}

function startGame() {
  clearTimeout(aiRestartTimer);
  overlay.classList.add('hidden');
  clearInterval(loopId);
  cancelAnimationFrame(rafId);
  initGame();
  loopId = setInterval(tick, stepDuration);
  rafId  = requestAnimationFrame(animate);
}

function pauseGame() {
  paused = true; overlayState = 'paused';
  overlayIcon.textContent  = '⏸';
  overlayTitle.textContent = 'Paused';
  overlaySub.innerHTML     = 'Press <b>Space</b> to continue';
  btnPlay.textContent      = 'Resume';
  btnPlay.className        = '';
  overlay.classList.remove('hidden');
}

function resumeGame() {
  paused = false; overlayState = 'start';
  lastStepTime = performance.now();
  overlay.classList.add('hidden');
}

// ── Render ────────────────────────────────────────────────────────────────────
function animate(now) {
  rafId = requestAnimationFrame(animate);
  const raw = Math.min((now - lastStepTime) / stepDuration, 1);
  draw(easeInOut(raw), now);
}

function lerpColor(a, b, t) {
  const p = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
  const [r1,g1,b1] = p(a), [r2,g2,b2] = p(b);
  return `rgb(${~~(r1+(r2-r1)*t)},${~~(g1+(g2-g1)*t)},${~~(b1+(b2-b1)*t)})`;
}

function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }

function draw(t, now) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = C.dot;
  for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
    ctx.beginPath();
    ctx.arc(x*CELL + CELL/2, y*CELL + CELL/2, 1, 0, Math.PI*2);
    ctx.fill();
  }

  {
    const pad=5, r=7, fw=CELL-pad*2;
    ctx.shadowColor = C.red; ctx.shadowBlur = 10;
    ctx.fillStyle = C.red;
    rr(food.x*CELL+pad, food.y*CELL+pad, fw, fw, r); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    rr(food.x*CELL+pad+2, food.y*CELL+pad+2, fw-4, fw*0.38, r-2); ctx.fill();
  }

  const flashOn = dying && now !== undefined && Math.sin((now - dyingStart) / 80) > 0;
  const len = snake.length;

  snake.forEach((seg, i) => {
    const prev = prevSnake[i] || seg;
    let dx = seg.x - prev.x, dy = seg.y - prev.y;
    if (Math.abs(dx) > 1) dx = 0;
    if (Math.abs(dy) > 1) dy = 0;
    const gx = prev.x + dx * t, gy = prev.y + dy * t;
    const px = gx * CELL, py = gy * CELL;

    const bodyT     = i / Math.max(len-1, 1);
    const baseColor = i===0 ? C.green : lerpColor(C.greenMid, C.greenDim, Math.min(bodyT*1.4, 1));
    const color     = flashOn ? C.red : baseColor;
    const pad       = i===0 ? 3 : 4;
    const radius    = i===0 ? 9 : 7;

    if (i===0 && !dying) { ctx.shadowColor=C.green; ctx.shadowBlur=12; }
    else { ctx.shadowBlur=0; }

    ctx.fillStyle = color;
    rr(px+pad, py+pad, CELL-pad*2, CELL-pad*2, radius); ctx.fill();

    if (!flashOn) {
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      rr(px+pad+1, py+pad+1, CELL-pad*2-2, (CELL-pad*2)*0.4, radius-2); ctx.fill();
    }

    if (i===0) {
      ctx.shadowBlur = 0;
      const cx = gx*CELL + CELL/2, cy = gy*CELL + CELL/2;
      const er=2.2, eo=4.2;
      let e1x,e1y,e2x,e2y;
      if      (dir.x===1)  {e1x=cx+4;  e1y=cy-eo; e2x=cx+4;  e2y=cy+eo;}
      else if (dir.x===-1) {e1x=cx-4;  e1y=cy-eo; e2x=cx-4;  e2y=cy+eo;}
      else if (dir.y===-1) {e1x=cx-eo; e1y=cy-4;  e2x=cx+eo; e2y=cy-4;}
      else                 {e1x=cx-eo; e1y=cy+4;  e2x=cx+eo; e2y=cy+4;}
      ctx.fillStyle = flashOn ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)';
      ctx.beginPath(); ctx.arc(e1x,e1y,er,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(e2x,e2y,er,0,Math.PI*2); ctx.fill();
      if (!flashOn) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(e1x-.6,e1y-.6,er*.45,0,Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(e2x-.6,e2y-.6,er*.45,0,Math.PI*2); ctx.fill();
      }
    }
  });
  ctx.shadowBlur = 0;
}

// ── Input ─────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === ' ') {
    e.preventDefault();
    if (overlayState === 'paused') { resumeGame(); return; }
    if (running && !dying)         { pauseGame();  return; }
    return;
  }
  const k = KEY_MAP[e.key];
  if (!k) return;
  e.preventDefault();
  if (isAI) return;
  if (overlayState === 'paused') { resumeGame(); return; }
  if (!running && !dying)        { startGame();  return; }
  if (!running || dying)         { return; }
  const last    = inputQueue.length ? inputQueue[inputQueue.length-1] : dir;
  const lastKey = Object.keys(DIR).find(d => DIR[d].x===last.x && DIR[d].y===last.y);
  if (k !== OPP[lastKey] && inputQueue.length < 3) inputQueue.push({...DIR[k]});
});

// ── Button handlers ───────────────────────────────────────────────────────────
btnPlay.addEventListener('click', () => {
  if (overlayState === 'paused') resumeGame();
  else startGame();
});

btnWrap.addEventListener('click', () => {
  wrapMode = !wrapMode;
  btnWrap.classList.toggle('on', wrapMode);
});

btnAI.addEventListener('click', () => {
  isAI = !isAI;
  btnAI.classList.toggle('on', isAI);
  clearTimeout(aiRestartTimer);
  if (isAI && !overlay.classList.contains('hidden')) {
    overlayIcon.textContent  = '🤖';
    overlayTitle.textContent = 'Snake AI';
    overlaySub.innerHTML     = 'Watch the AI play in real time';
    btnPlay.textContent      = 'Watch AI';
    btnPlay.className        = 'ai-btn';
    overlayState             = 'start';
  } else if (!isAI && !overlay.classList.contains('hidden') && overlayState === 'start') {
    overlayIcon.textContent  = '🐍';
    overlayTitle.textContent = 'Snake';
    overlaySub.innerHTML     = 'Use arrow keys or WASD to move';
    btnPlay.textContent      = 'Play';
    btnPlay.className        = '';
  }
});

btnTheme.addEventListener('click', () => applyTheme(!darkMode));

btnSound.addEventListener('click', () => {
  soundOn = !soundOn;
  btnSound.textContent = soundOn ? '🔊' : '🔇';
  localStorage.setItem('snakeSound', soundOn);
  if (soundOn) tone(880, 0.06);
});

document.querySelectorAll('.seg').forEach(btn => {
  btn.addEventListener('click', () => {
    speedKey = btn.dataset.s;
    document.querySelectorAll('.seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (running) {
      clearInterval(loopId);
      stepDuration = speed(level);
      loopId = setInterval(tick, stepDuration);
    }
  });
});

// Initial static draw
draw(1, null);
