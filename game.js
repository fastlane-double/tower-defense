// ============================================================
// Tower Defense Game - Vanilla Canvas JS
// ============================================================

// --- SERVER API ---
const API_BASE = 'http://localhost:3000';

// --- PREMIUM SYSTEM ---
// Premium towers unlock via purchase. DEV_MODE bypasses the lock.
let DEV_MODE = false; // set true to unlock all premium towers free
const PREMIUM_TOWER_TYPES = ['tesla', 'frost', 'flame', 'nuke', 'voidray', 'god'];
// Track which premium towers are unlocked (persisted in localStorage)
function getPremiumUnlocked() {
  if (DEV_MODE) return new Set(PREMIUM_TOWER_TYPES);
  try {
    const data = JSON.parse(localStorage.getItem('td_premium') || '[]');
    return new Set(data);
  } catch { return new Set(); }
}
function setPremiumUnlocked(set) {
  localStorage.setItem('td_premium', JSON.stringify([...set]));
}
function unlockPremiumTower(type) {
  const set = getPremiumUnlocked();
  set.add(type);
  setPremiumUnlocked(set);
}
function isPremiumUnlocked(type) {
  return DEV_MODE || getPremiumUnlocked().has(type);
}
function toggleDevMode() {
  DEV_MODE = !DEV_MODE;
  const btn = document.getElementById('dev-mode-btn');
  if (btn) btn.textContent = DEV_MODE ? '🔓 개발 모드 ON' : '🔒 개발 모드 OFF';
  updateTowerButtons();
  updatePremiumUI();
}
// Simulate purchase (in real game this calls payment API)
function purchasePremiumTower(type) {
  const def = TOWER_DEFS[type];
  if (!def || !def.premium) return;
  if (isPremiumUnlocked(type)) return;
  // Show purchase modal
  showPurchaseModal(type);
}

// ============================================================
// SOUND SYSTEM (Web Audio API — no external files)
// ============================================================
let audioCtx = null;
let soundMuted = false;
const MAX_CONCURRENT_SOUNDS = 12;
let _activeSounds = 0;

function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

/**
 * Play a synthesized sound.
 * @param {number} freq      Base frequency in Hz
 * @param {string} type      OscillatorType: 'sine'|'square'|'sawtooth'|'triangle'
 * @param {number} duration  Duration in seconds
 * @param {number} gain      Peak gain (0–1)
 * @param {number} freqEnd   End frequency for sweep (optional, defaults to freq)
 */
function playTone(freq, type = 'sine', duration = 0.15, gain = 0.3, freqEnd = null) {
  if (soundMuted) return;
  if (_activeSounds >= MAX_CONCURRENT_SOUNDS) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== null) {
      osc.frequency.linearRampToValueAtTime(freqEnd, ctx.currentTime + duration);
    }
    vol.gain.setValueAtTime(gain, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    _activeSounds++;
    osc.onended = () => { _activeSounds--; };
  } catch (e) { /* silently ignore audio errors */ }
}

// Named sound effects
function sfxShoot(towerType) {
  if (soundMuted) return;
  const sounds = {
    arrow:   () => playTone(880, 'sawtooth', 0.06, 0.15, 660),
    cannon:  () => playTone(120, 'square',   0.18, 0.35, 60),
    magic:   () => playTone(660, 'sine',     0.12, 0.2,  880),
    sniper:  () => playTone(1200, 'sawtooth',0.08, 0.25, 400),
    poison:  () => playTone(300, 'sine',     0.14, 0.15, 200),
    laser:   () => playTone(800, 'sawtooth', 0.10, 0.2,  1200),
    tesla:   () => playTone(200, 'square',   0.12, 0.3,  800),
    frost:   () => playTone(500, 'triangle', 0.15, 0.2,  300),
    flame:   () => playTone(180, 'sawtooth', 0.14, 0.25, 80),
    nuke:    () => playTone(60,  'square',   0.40, 0.5,  30),
    voidray: () => playTone(1000,'sawtooth', 0.20, 0.3,  400),
    storm:   () => playTone(350, 'sawtooth', 0.12, 0.25, 700),
    gravity: () => playTone(100, 'sine',     0.20, 0.3,  50),
    god:     () => { playTone(440, 'sine', 0.10, 0.35, 880); setTimeout(() => playTone(880, 'sine', 0.08, 0.25, 1760), 50); },
  };
  const fn = sounds[towerType];
  if (fn) fn();
}

function sfxEnemyDeath() {
  playTone(200, 'square', 0.12, 0.2, 80);
}

function sfxTowerPlace() {
  playTone(440, 'sine', 0.1, 0.25, 660);
}

function sfxTowerSell() {
  playTone(330, 'triangle', 0.12, 0.2, 220);
}

function sfxUpgrade() {
  playTone(523, 'sine', 0.08, 0.25);
  setTimeout(() => playTone(659, 'sine', 0.08, 0.25), 80);
  setTimeout(() => playTone(784, 'sine', 0.12, 0.3),  160);
}

function sfxWaveStart() {
  playTone(330, 'square', 0.10, 0.3);
  setTimeout(() => playTone(440, 'square', 0.10, 0.3), 100);
  setTimeout(() => playTone(550, 'square', 0.15, 0.35), 200);
}

function sfxHpLoss() {
  playTone(150, 'sawtooth', 0.25, 0.5, 80);
}

function sfxGameOver() {
  playTone(440, 'sawtooth', 0.3, 0.4, 220);
  setTimeout(() => playTone(220, 'sawtooth', 0.5, 0.4, 110), 300);
}

function sfxVictory() {
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => setTimeout(() => playTone(n, 'sine', 0.3, 0.4), i * 150));
}

function sfxExplosion() {
  playTone(100, 'square', 0.25, 0.4, 40);
}

function sfxNotEnoughGold() {
  playTone(220, 'sawtooth', 0.10, 0.3, 180);
}

function sfxFinalBossSpawn() {
  playTone(60, 'sawtooth', 0.5, 0.5, 30);
  setTimeout(() => playTone(80, 'square', 0.4, 0.4, 40), 200);
  setTimeout(() => playTone(50, 'sawtooth', 0.6, 0.5, 25), 500);
}

function toggleMute() {
  soundMuted = !soundMuted;
  const btn = document.getElementById('mute-btn');
  if (btn) btn.textContent = soundMuted ? '🔇' : '🔊';
  if (soundMuted) stopBgm(); else startBgm();
}

// ============================================================
// BGM SYSTEM
// ============================================================
let bgmNodes = [];
let bgmRunning = false;
let bgmArpTimer = null;
const BGM_SCALE = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88];

function startBgm() {
  if (soundMuted || bgmRunning) return;
  bgmRunning = true;
  try {
    const actx = getAudioCtx();
    const bassOsc = actx.createOscillator(), bassGain = actx.createGain();
    bassOsc.type = 'sine'; bassOsc.frequency.setValueAtTime(65.41, actx.currentTime);
    bassGain.gain.setValueAtTime(0.04, actx.currentTime);
    bassOsc.connect(bassGain); bassGain.connect(actx.destination); bassOsc.start();
    bgmNodes.push(bassOsc, bassGain);
    const padOsc = actx.createOscillator(), padGain = actx.createGain();
    padOsc.type = 'triangle'; padOsc.frequency.setValueAtTime(130.81, actx.currentTime);
    padGain.gain.setValueAtTime(0.025, actx.currentTime);
    padOsc.connect(padGain); padGain.connect(actx.destination); padOsc.start();
    bgmNodes.push(padOsc, padGain);
    let arpIdx = 0;
    function arpStep() {
      if (!bgmRunning || soundMuted) return;
      const note = BGM_SCALE[arpIdx % BGM_SCALE.length];
      const octMult = arpIdx % 14 < 7 ? 2 : 4;
      const ao = actx.createOscillator(), ag = actx.createGain();
      ao.type = 'sine'; ao.frequency.setValueAtTime(note * octMult, actx.currentTime);
      ag.gain.setValueAtTime(0.05, actx.currentTime);
      ag.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.5);
      ao.connect(ag); ag.connect(actx.destination);
      ao.start(actx.currentTime); ao.stop(actx.currentTime + 0.55);
      arpIdx++;
      bgmArpTimer = setTimeout(arpStep, 380);
    }
    bgmArpTimer = setTimeout(arpStep, 500);
  } catch(e) { bgmRunning = false; }
}

function stopBgm() {
  bgmRunning = false;
  if (bgmArpTimer) { clearTimeout(bgmArpTimer); bgmArpTimer = null; }
  for (const node of bgmNodes) { try { node.stop ? node.stop() : node.disconnect(); } catch(e) {} }
  bgmNodes = [];
}


// ============================================================
// PERSONAL BEST SYSTEM — localStorage-persisted high scores
// ============================================================
function getPersonalBest() {
  try {
    return JSON.parse(localStorage.getItem('td_personal_best') || '{}');
  } catch { return {}; }
}

function savePersonalBest(newScore, newWave, newKills, newCombo, won) {
  const pb = getPersonalBest();
  let updated = false;
  if (!pb.bestScore || newScore > pb.bestScore) { pb.bestScore = newScore; updated = true; }
  if (!pb.bestWave || newWave > pb.bestWave) { pb.bestWave = newWave; updated = true; }
  if (!pb.bestKills || newKills > pb.bestKills) { pb.bestKills = newKills; updated = true; }
  if (!pb.bestCombo || newCombo > pb.bestCombo) { pb.bestCombo = newCombo; updated = true; }
  if (!pb.victories) pb.victories = 0;
  if (won) { pb.victories++; updated = true; }
  if (updated) localStorage.setItem('td_personal_best', JSON.stringify(pb));
  return { pb, updated };
}

function getPersonalBestHTML() {
  const pb = getPersonalBest();
  if (!pb.bestScore) return '';
  return [
    '<div style="margin-top:8px;padding:6px 10px;background:rgba(255,215,0,0.08);border:1px solid #ffd70044;border-radius:6px;font-size:0.82em;color:#ccc;">',
    '<span style="color:#ffd700;font-weight:bold;">🏅 최고 기록</span>  ',
    `점수: <b style="color:#ffd700">${pb.bestScore.toLocaleString()}</b>  `,
    `웨이브: <b>${pb.bestWave}</b>  `,
    `처치: <b>${pb.bestKills || 0}</b>  `,
    `콤보: <b>${pb.bestCombo || 0}</b>  `,
    `승리: <b>${pb.victories || 0}</b>회`,
    '</div>',
  ].join('');
}

// ============================================================
// ACHIEVEMENT SYSTEM — milestone rewards & notifications
// ============================================================
const ACHIEVEMENTS = [
  { id: 'first_blood',  name: '첫 피',         desc: '첫 번째 적을 처치하라',         icon: '⚔️',  check: (s) => s.totalKills >= 1 },
  { id: 'century',      name: '백인 학살',       desc: '적 100마리를 처치하라',          icon: '💯',  check: (s) => s.totalKills >= 100 },
  { id: 'combo_master', name: '콤보 마스터',     desc: '20연속 콤보를 달성하라',          icon: '🔥',  check: (s) => s.maxCombo >= 20 },
  { id: 'stage5',       name: '절반의 영웅',     desc: '5단계에 도달하라',               icon: '🌟',  check: (s) => s.currentStage >= 5 },
  { id: 'survivor',     name: '생존의 달인',     desc: '체력 10 이상으로 웨이브 25를 넘겨라', icon: '❤️',  check: (s) => s.currentWave >= 25 && s.hp >= 10 },
  { id: 'rich',         name: '황금 손',         desc: '골드 1000 이상 보유하라',         icon: '💰',  check: (s) => s.gold >= 1000 },
  { id: 'speedrun',     name: '전광석화',        desc: '10분 이내에 5단계를 클리어하라',   icon: '⚡',  check: (s) => s.currentStage >= 6 && s.elapsedSecs < 600 },
  { id: 'perfect',      name: '완벽한 수비',     desc: '모든 웨이브를 클리어하며 승리하라', icon: '🏆',  check: (s) => s.victory && s.hp > 0 },
];

function getUnlockedAchievements() {
  try {
    return new Set(JSON.parse(localStorage.getItem('td_achievements') || '[]'));
  } catch { return new Set(); }
}

function unlockAchievement(id) {
  const set = getUnlockedAchievements();
  if (set.has(id)) return false;
  set.add(id);
  localStorage.setItem('td_achievements', JSON.stringify([...set]));
  return true;
}

function checkAchievements() {
  const now = performance.now();
  const elapsedSecs = sessionStartTime ? (now - sessionStartTime) / 1000 : 9999;
  const state = { totalKills, maxCombo, currentStage, hp, gold, currentWave, victory, elapsedSecs };
  for (const ach of ACHIEVEMENTS) {
    if (ach.check(state)) {
      const justUnlocked = unlockAchievement(ach.id);
      if (justUnlocked) showAchievementNotif(ach);
    }
  }
}

function showAchievementNotif(ach) {
  const notif = document.createElement('div');
  notif.className = 'unlock-notif';
  notif.style.cssText = 'background:linear-gradient(135deg,#1a3a1a,#0a2a0a);border:1px solid #00ff88;color:#00ff88;';
  notif.innerHTML = `<span style="font-size:1.3em">${ach.icon}</span> <b>업적 달성!</b> ${ach.name}<br><span style="color:#aaa;font-size:0.85em">${ach.desc}</span>`;
  document.getElementById('game-container').appendChild(notif);
  setTimeout(() => notif.remove(), 4000);
  spawnFloatingText(canvas.width / 2, canvas.height * 0.3, `🏅 ${ach.name}`, '#00ff88');
}

function getAchievementProgressHTML() {
  const unlocked = getUnlockedAchievements();
  const total = ACHIEVEMENTS.length;
  const count = ACHIEVEMENTS.filter(a => unlocked.has(a.id)).length;
  return `<span style="color:#00ff88">${count}/${total}</span> 업적`;
}

function toggleSpeed() {
  speedMultiplier = speedMultiplier === 1 ? 2 : 1;
  const btn = document.getElementById('speed-btn');
  if (btn) {
    btn.textContent = speedMultiplier === 2 ? '⏩ 2x' : '▶ 1x';
    btn.classList.toggle('active', speedMultiplier === 2);
  }
}

function toggleAutoWave() {
  autoWaveEnabled = !autoWaveEnabled;
  const btn = document.getElementById('auto-wave-btn');
  if (btn) {
    btn.classList.toggle('active', autoWaveEnabled);
  }
  if (autoWaveEnabled && !waveInProgress && !gameOver && !stageTransition && currentWave < TOTAL_WAVES) {
    startNextWave();
  }
}

let playerName = '';
let sessionStartTime = null;

// ── DIFFICULTY SYSTEM ────────────────────────────────────────
let gameDifficulty = 'normal'; // 'normal' or 'hard'

const DIFFICULTY_SETTINGS = {
  normal: {
    label: '일반',
    hp: 20,
    gold: 150,
    enemyHpMultiplier: 1.0,
    enemySpeedMultiplier: 1.0,
    enemyRewardMultiplier: 1.0,  // normal gold rewards
    waveGoldMultiplier: 1.0,     // wave clear gold bonus multiplier
    hpRegenPerWave: 1,           // HP recovered each wave clear
    maxHp: 20,                   // max HP cap for regen
  },
  hard: {
    label: '하드',
    hp: 10,
    gold: 100,
    enemyHpMultiplier: 1.8,      // INCREASED: 1.5 → 1.8 (harder)
    enemySpeedMultiplier: 1.3,   // INCREASED: 1.2 → 1.3 (faster)
    enemyRewardMultiplier: 1.3,  // slightly more gold reward to compensate for difficulty
    waveGoldMultiplier: 0.85,    // 15% less wave clear gold (resource scarcity)
    hpRegenPerWave: 0,           // no HP regen in hard mode
    maxHp: 10,                   // hard mode max HP cap
  },
};

function selectDifficulty(diff) {
  gameDifficulty = diff;
  document.querySelectorAll('.difficulty-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.difficulty === diff);
  });
  const descEl = document.getElementById('difficulty-desc');
  if (diff === 'hard') {
    descEl.textContent = '적 HP ×1.8, 적 속도 ×1.3, 시작 HP 10, 시작 골드 100, HP 회복 없음';
    descEl.style.color = '#e94560';
  } else {
    descEl.textContent = '기본 난이도입니다.';
    descEl.style.color = '#888';
  }
}

async function fetchLeaderboard(containerEl) {
  try {
    const res = await fetch(`${API_BASE}/api/scores?limit=10`);
    if (!res.ok) throw new Error('server unavailable');
    const data = await res.json();
    renderLeaderboard(containerEl, data.scores, playerName);
  } catch {
    containerEl.textContent = '서버 연결 불가 (오프라인 모드)';
  }
}

// Escape HTML to prevent XSS from player names
function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function renderLeaderboard(el, scores, highlight) {
  if (!scores || scores.length === 0) {
    el.textContent = '아직 기록이 없습니다';
    return;
  }
  el.innerHTML = scores.map((s, i) => {
    const mine = highlight && s.player_name === highlight;
    const safeName = escapeHtml(s.player_name);
    const diffBadge = s.difficulty === 'hard' ? ' <span style="color:#e94560;font-size:0.8em">🔴</span>' : '';
    return `<div class="lb-entry${mine ? ' lb-mine' : ''}">
      <span class="lb-rank">#${i + 1}</span>
      <span class="lb-name">${safeName}${diffBadge}</span>
      <span class="lb-score">${s.score.toLocaleString()}</span>
    </div>`;
  }).join('');
}

async function submitScore(result) {
  if (!playerName) return;
  const durationSeconds = sessionStartTime
    ? Math.floor((Date.now() - sessionStartTime) / 1000)
    : 0;
  try {
    // Submit score
    const scoreRes = await fetch(`${API_BASE}/api/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: playerName,
        score,
        wave: currentWave,
        duration_seconds: durationSeconds,
        difficulty: gameDifficulty,
      }),
    });
    const scoreData = scoreRes.ok ? await scoreRes.json() : null;

    // Submit session
    await fetch(`${API_BASE}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        player_name: playerName,
        score,
        wave_reached: currentWave,
        duration_seconds: durationSeconds,
        result,
        difficulty: gameDifficulty,
        started_at: new Date(sessionStartTime).toISOString(),
      }),
    });

    // Show rank
    if (scoreData && scoreData.rank) {
      const rankEl = document.getElementById('rank-display');
      const rankTextEl = document.getElementById('rank-text');
      rankEl.style.display = 'block';
      rankTextEl.textContent = `🏅 랭킹: ${scoreData.rank}위`;
    }

    // Update result leaderboard
    await fetchLeaderboard(document.getElementById('leaderboard-result-list'));
  } catch {
    // Server offline - still show the overlay without rank
  }
}

// Name screen functions
function startGame() {
  const input = document.getElementById('player-name-input');
  const name = input.value.trim();
  if (!name) {
    input.focus();
    input.style.borderColor = '#e94560';
    input.placeholder = '닉네임을 입력해야 시작할 수 있어요!';
    setTimeout(() => {
      input.style.borderColor = '';
      input.placeholder = '닉네임을 입력하세요';
    }, 2000);
    return;
  }
  playerName = name;
  document.getElementById('name-screen').style.display = 'none';
  document.getElementById('game-container').style.display = 'flex';
  const diffLabel = gameDifficulty === 'hard' ? ' 🔴하드' : '';
  document.getElementById('player-name-display').textContent = `👤 ${playerName}${diffLabel}`;
  sessionStartTime = Date.now();
  initGame();
}

function goToMenu() {
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('game-container').style.display = 'none';
  document.getElementById('name-screen').style.display = 'flex';
  playerName = '';
  sessionStartTime = null;
  selectDifficulty(gameDifficulty);
  fetchLeaderboard(document.getElementById('leaderboard-list'));
}

// --- CONSTANTS ---
const TILE = 48;         // tile size in pixels
const COLS = 20;
const ROWS = 13;

// Map layout: 0=grass, 1=path, 2=start, 3=end, 4=blocked(decor)
const MAP_LAYOUT = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [2,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,1,3],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

// Pre-compute the path waypoints from the map
function buildPath() {
  const path = [];
  // Find start (2)
  let sr = -1, sc = -1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP_LAYOUT[r][c] === 2) { sr = r; sc = c; }
    }
  }
  const visited = Array.from({length: ROWS}, () => new Array(COLS).fill(false));
  let r = sr, c = sc;
  visited[r][c] = true;
  path.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
  const dirs = [[0,1],[1,0],[0,-1],[-1,0]];
  while (true) {
    let moved = false;
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
      if (visited[nr][nc]) continue;
      const t = MAP_LAYOUT[nr][nc];
      if (t === 1 || t === 3) {
        visited[nr][nc] = true;
        r = nr; c = nc;
        path.push({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
        moved = true;
        if (t === 3) return path;
        break;
      }
    }
    if (!moved) break;
  }
  return path;
}

// --- TOWER DEFINITIONS ---
const TOWER_DEFS = {
  arrow: {
    name: '화살 타워',
    cost: 50,
    color: '#4a9e4a',
    accentColor: '#7cfc00',
    range: 3.2 * TILE,
    damage: 20,         // BUFF: 15 → 20
    fireRate: 1100,     // BUFF: 1200 → 1100ms (faster)
    projectileSpeed: 320,
    projectileColor: '#aaff00',
    projectileSize: 4,
    aoeRadius: 0,
    slowFactor: 1,
    poisonDamage: 0,
    sellValue: 25,
    emoji: '🏹',
    upgrades: [
      { name: '강화 화살', cost: 60, description: '데미지 +15, 사거리 +0.5칸', apply: t => { t.damage += 15; t.range += 0.5 * TILE; } },
      { name: '연사 화살', cost: 80, description: '공격속도 35% 증가', apply: t => { t.fireRate = Math.floor(t.fireRate * 0.65); } },
      { name: '관통 화살', cost: 120, description: '데미지 +25, 사거리 +1칸, 관통', apply: t => { t.damage += 25; t.range += 1 * TILE; t.piercing = true; } },
    ],
  },
  cannon: {
    name: '대포 타워',
    cost: 100,
    color: '#8b4513',
    accentColor: '#cd853f',
    range: 2.8 * TILE,  // BUFF: 2.5 → 2.8
    damage: 70,          // BUFF: 60 → 70
    fireRate: 2200,      // BUFF: 2500 → 2200ms
    projectileSpeed: 220,
    projectileColor: '#ff6600',
    projectileSize: 7,
    aoeRadius: TILE * 0.9,  // BUFF: 0.8 → 0.9
    slowFactor: 1,
    poisonDamage: 0,
    sellValue: 50,
    emoji: '💣',
    upgrades: [
      { name: '폭발 강화', cost: 80, description: '범위 +40%, 데미지 +25', apply: t => { t.aoeRadius *= 1.4; t.damage += 25; } },
      { name: '중포', cost: 120, description: '데미지 +50, 발사속도 25% 증가', apply: t => { t.damage += 50; t.fireRate = Math.floor(t.fireRate * 0.75); } },
      { name: '초대형 폭발', cost: 180, description: '범위 2배, 데미지 +80', apply: t => { t.aoeRadius *= 2; t.damage += 80; } },
    ],
  },
  magic: {
    name: '마법 타워',
    cost: 125,
    color: '#6a0dad',
    accentColor: '#da70d6',
    range: 3.8 * TILE,  // BUFF: 3.5 → 3.8
    damage: 35,          // BUFF: 20 → 35 (significant buff - magic was very weak)
    fireRate: 1400,      // BUFF: 1600 → 1400ms
    projectileSpeed: 280,
    projectileColor: '#da70d6',
    projectileSize: 6,
    aoeRadius: TILE * 0.5,  // BUFF: added base AOE
    slowFactor: 0.4,    // BUFF: 0.45 → 0.4 (stronger slow)
    poisonDamage: 0,
    sellValue: 62,
    emoji: '🔮',
    upgrades: [
      { name: '마법 강화', cost: 80, description: '데미지 +20, 감속 강화 (30%)', apply: t => { t.damage += 20; t.slowFactor = 0.3; } },
      { name: '광역 마법', cost: 120, description: '범위 공격 확대 (+50%), 데미지 +15', apply: t => { t.aoeRadius *= 1.5; t.damage += 15; } },
      { name: '시간 정지', cost: 200, description: '감속 최대화, 데미지 +30, 사거리 +1칸', apply: t => { t.slowFactor = 0.2; t.damage += 30; t.range += 1 * TILE; } },
    ],
  },
  sniper: {
    name: '저격 타워',
    cost: 150,
    color: '#1a3a5c',
    accentColor: '#4fc3f7',
    range: 6.0 * TILE,  // BUFF: 5.5 → 6.0
    damage: 100,         // BUFF: 80 → 100
    fireRate: 2800,      // BUFF: 3000 → 2800ms
    projectileSpeed: 700,
    projectileColor: '#4fc3f7',
    projectileSize: 3,
    aoeRadius: 0,
    slowFactor: 1,
    poisonDamage: 0,
    sellValue: 75,
    emoji: '🎯',
    upgrades: [
      { name: '정밀 조준', cost: 100, description: '데미지 +60, 사거리 +1칸', apply: t => { t.damage += 60; t.range += 1 * TILE; } },
      { name: '초음속 탄', cost: 150, description: '탄속 2배, 공격속도 +25%', apply: t => { t.projectileSpeed *= 2; t.fireRate = Math.floor(t.fireRate * 0.75); } },
      { name: '대구경 탄', cost: 250, description: '데미지 +120, 관통 효과, 범위 추가', apply: t => { t.damage += 120; t.piercing = true; t.aoeRadius = TILE * 0.5; } },
    ],
  },
  poison: {
    name: '독 타워',
    cost: 125,           // BUFF: 150 → 125 (better cost efficiency as support tower)
    color: '#1a5c1a',
    accentColor: '#39ff14',
    range: 3.2 * TILE,
    damage: 15,
    fireRate: 1100,      // BUFF: 1200 → 1100ms (slightly faster)
    projectileSpeed: 220,
    projectileColor: '#39ff14',
    projectileSize: 7,
    aoeRadius: TILE * 0.5,
    slowFactor: 0.8,
    poisonDamage: 12,   // BUFF: 10 → 12 DPS
    sellValue: 62,      // = cost / 2
    emoji: '☠️',
    upgrades: [
      { name: '독성 강화', cost: 90, description: '독 데미지 +8 DPS, 감속 강화', apply: t => { t.poisonDamage += 8; t.slowFactor = 0.7; } },
      { name: '광역 독구름', cost: 140, description: '범위 독 공격 확대 (+80%), 데미지 +10', apply: t => { t.aoeRadius *= 1.8; t.damage += 10; } },
      { name: '치명독', cost: 200, description: '독 데미지 +12 DPS, 감속 최대화, 사거리 확대', apply: t => { t.poisonDamage += 12; t.slowFactor = 0.5; t.range += 0.5 * TILE; } },
    ],
  },
  laser: {
    name: '레이저 타워',
    cost: 200,
    color: '#5c1a1a',
    accentColor: '#ff4444',
    range: 4.5 * TILE,  // BUFF: 4.0 → 4.5
    damage: 30,          // BUFF: 25 → 30
    fireRate: 450,       // BUFF: 500 → 450ms
    projectileSpeed: 1200,
    projectileColor: '#ff4444',
    projectileSize: 3,
    aoeRadius: 0,
    slowFactor: 1,
    poisonDamage: 0,
    sellValue: 100,
    emoji: '⚡',
    upgrades: [
      { name: '레이저 강화', cost: 100, description: '데미지 +20, 공격속도 +25%', apply: t => { t.damage += 20; t.fireRate = Math.floor(t.fireRate * 0.75); } },
      { name: '이중 레이저', cost: 160, description: '데미지 2배, 사거리 +0.5칸', apply: t => { t.damage *= 2; t.range += 0.5 * TILE; } },
      { name: '초고출력', cost: 250, description: '데미지 +60, 사거리 +1칸, 공격속도 35% 증가', apply: t => { t.damage += 60; t.range += 1 * TILE; t.fireRate = Math.floor(t.fireRate * 0.65); } },
    ],
  },

  // ===== PREMIUM TOWERS (requires unlock) =====
  tesla: {
    name: '테슬라 타워',
    cost: 300,
    color: '#1a1a5c',
    accentColor: '#00bfff',
    range: 3.5 * TILE,
    damage: 60,
    fireRate: 800,
    projectileSpeed: 900,
    projectileColor: '#00bfff',
    projectileSize: 5,
    aoeRadius: TILE * 0.6,
    slowFactor: 0.5,
    poisonDamage: 0,
    sellValue: 150,
    emoji: '🌩️',
    premium: true,
    premiumPrice: '₩1,200',
    premiumCoinCost: 2400,
    premiumDesc: '체인 번개로 여러 적을 동시에 감전!',
    upgrades: [
      { name: '과부하', cost: 150, description: '데미지 +40, 감전 범위 +50%', apply: t => { t.damage += 40; t.aoeRadius *= 1.5; } },
      { name: '연쇄 번개', cost: 220, description: '데미지 +60, 공격속도 +30%', apply: t => { t.damage += 60; t.fireRate = Math.floor(t.fireRate * 0.7); } },
      { name: '초전도체', cost: 350, description: '데미지 +100, 감속 80%, 사거리 +1칸', apply: t => { t.damage += 100; t.slowFactor = 0.2; t.range += 1 * TILE; } },
    ],
  },
  frost: {
    name: '서리 타워',
    cost: 250,
    color: '#1a3a5c',
    accentColor: '#a0d8ef',
    range: 3.8 * TILE,
    damage: 25,
    fireRate: 1000,
    projectileSpeed: 300,
    projectileColor: '#a0d8ef',
    projectileSize: 8,
    aoeRadius: TILE * 1.2,
    slowFactor: 0.25,
    poisonDamage: 0,
    sellValue: 125,
    emoji: '❄️',
    premium: true,
    premiumPrice: '₩900',
    premiumCoinCost: 1800,
    premiumDesc: '광역 빙결로 적 이동속도를 크게 감소!',
    upgrades: [
      { name: '냉동 강화', cost: 120, description: '광역 범위 +60%, 감속 90%', apply: t => { t.aoeRadius *= 1.6; t.slowFactor = 0.1; } },
      { name: '영구 빙결', cost: 180, description: '데미지 +20, 공격속도 +25%, 사거리 +0.5칸', apply: t => { t.damage += 20; t.fireRate = Math.floor(t.fireRate * 0.75); t.range += 0.5 * TILE; } },
      { name: '절대영도', cost: 300, description: '감속 95%, 범위 2배, 데미지 +40', apply: t => { t.slowFactor = 0.05; t.aoeRadius *= 2; t.damage += 40; } },
    ],
  },
  flame: {
    name: '화염 타워',
    cost: 275,
    color: '#5c2a00',
    accentColor: '#ff8c00',
    range: 2.8 * TILE,
    damage: 45,
    fireRate: 600,
    projectileSpeed: 350,
    projectileColor: '#ff4500',
    projectileSize: 9,
    aoeRadius: TILE * 0.8,
    slowFactor: 1,
    poisonDamage: 15,
    sellValue: 138,
    emoji: '🔥',
    premium: true,
    premiumPrice: '₩900',
    premiumCoinCost: 1800,
    premiumDesc: '화염 폭발과 지속 화상 데미지!',
    upgrades: [
      { name: '업화', cost: 140, description: '데미지 +35, 화상 데미지 +10/초', apply: t => { t.damage += 35; t.poisonDamage += 10; } },
      { name: '광역 화염', cost: 200, description: '범위 +80%, 공격속도 +20%', apply: t => { t.aoeRadius *= 1.8; t.fireRate = Math.floor(t.fireRate * 0.8); } },
      { name: '지옥불', cost: 320, description: '데미지 +60, 화상 +20/초, 범위 +50%', apply: t => { t.damage += 60; t.poisonDamage += 20; t.aoeRadius *= 1.5; } },
    ],
  },
  nuke: {
    name: '핵 타워',
    cost: 500,
    color: '#3a3a00',
    accentColor: '#ffff00',
    range: 3.0 * TILE,
    damage: 500,
    fireRate: 6000,
    projectileSpeed: 180,
    projectileColor: '#ffff00',
    projectileSize: 12,
    aoeRadius: TILE * 2.5,
    slowFactor: 1,
    poisonDamage: 30,
    sellValue: 250,
    emoji: '☢️',
    premium: true,
    premiumPrice: '₩2,400',
    premiumCoinCost: 4800,
    premiumDesc: '거대 핵 폭발로 광역 초대형 피해!',
    upgrades: [
      { name: '핵탄두 강화', cost: 250, description: '데미지 +300, 범위 +30%', apply: t => { t.damage += 300; t.aoeRadius *= 1.3; } },
      { name: '방사능 오염', cost: 350, description: '방사성 데미지 +30/초, 발사속도 +20%', apply: t => { t.poisonDamage += 30; t.fireRate = Math.floor(t.fireRate * 0.8); } },
      { name: '수소폭탄', cost: 500, description: '데미지 +500, 범위 2배, 방사능 +40/초', apply: t => { t.damage += 500; t.aoeRadius *= 2; t.poisonDamage += 40; } },
    ],
  },
  voidray: {
    name: '공허 타워',
    cost: 450,
    color: '#2d0045',
    accentColor: '#cc00ff',
    range: 5.5 * TILE,
    damage: 150,
    fireRate: 1500,
    projectileSpeed: 1500,
    projectileColor: '#cc00ff',
    projectileSize: 6,
    aoeRadius: 0,
    slowFactor: 0.7,
    poisonDamage: 20,
    sellValue: 225,
    emoji: '🌌',
    premium: true,
    premiumPrice: '₩1,800',
    premiumCoinCost: 3600,
    premiumDesc: '초장거리 공허 광선. 단일 최강 피해!',
    upgrades: [
      { name: '공허 증폭', cost: 200, description: '데미지 +100, 사거리 +1칸', apply: t => { t.damage += 100; t.range += 1 * TILE; } },
      { name: '분열 광선', cost: 300, description: '데미지 +150, 관통 효과 추가', apply: t => { t.damage += 150; t.piercing = true; } },
      { name: '차원 붕괴', cost: 450, description: '데미지 +200, 사거리 +1.5칸, 공격속도 +30%', apply: t => { t.damage += 200; t.range += 1.5 * TILE; t.fireRate = Math.floor(t.fireRate * 0.7); } },
    ],
  },

  // ===== NEW REGULAR TOWERS =====
  storm: {
    name: '폭풍 타워',
    cost: 175,
    color: '#2a4a6a',
    accentColor: '#87ceeb',
    range: 4.0 * TILE,
    damage: 40,
    fireRate: 700,
    projectileSpeed: 500,
    projectileColor: '#87ceeb',
    projectileSize: 6,
    aoeRadius: TILE * 0.7,
    slowFactor: 0.6,
    poisonDamage: 0,
    sellValue: 88,
    emoji: '🌪️',
    upgrades: [
      { name: '강풍', cost: 100, description: '데미지 +25, 범위 +40%, 감속 강화', apply: t => { t.damage += 25; t.aoeRadius *= 1.4; t.slowFactor = 0.45; } },
      { name: '번개 폭풍', cost: 160, description: '데미지 +40, 공격속도 +30%', apply: t => { t.damage += 40; t.fireRate = Math.floor(t.fireRate * 0.7); } },
      { name: '태풍의 눈', cost: 250, description: '데미지 +60, 범위 2배, 감속 극대화', apply: t => { t.damage += 60; t.aoeRadius *= 2; t.slowFactor = 0.2; } },
    ],
  },
  gravity: {
    name: '중력 타워',
    cost: 225,
    color: '#1a0033',
    accentColor: '#9966ff',
    range: 3.5 * TILE,
    damage: 55,
    fireRate: 1200,
    projectileSpeed: 250,
    projectileColor: '#9966ff',
    projectileSize: 10,
    aoeRadius: TILE * 1.0,
    slowFactor: 0.3,
    poisonDamage: 5,
    sellValue: 113,
    emoji: '🕳️',
    upgrades: [
      { name: '중력장 강화', cost: 120, description: '감속 극대화 (80%), 범위 +40%', apply: t => { t.slowFactor = 0.2; t.aoeRadius *= 1.4; } },
      { name: '블랙홀', cost: 200, description: '데미지 +50, 지속 피해 +10/초, 사거리 +1칸', apply: t => { t.damage += 50; t.poisonDamage += 10; t.range += 1 * TILE; } },
      { name: '특이점', cost: 320, description: '데미지 +80, 범위 2배, 감속 95%', apply: t => { t.damage += 80; t.aoeRadius *= 2; t.slowFactor = 0.05; } },
    ],
  },

  // ===== OP PREMIUM TOWER ($1 permanent unlock) =====
  god: {
    name: '갓 타워',
    cost: 400,
    color: '#ffd700',
    accentColor: '#ffffff',
    range: 8.0 * TILE,
    damage: 999,
    fireRate: 200,
    projectileSpeed: 2000,
    projectileColor: '#ffd700',
    projectileSize: 10,
    aoeRadius: TILE * 2.0,
    slowFactor: 0.1,
    poisonDamage: 50,
    sellValue: 200,
    emoji: '👑',
    premium: true,
    premiumPrice: '$1.00',
    premiumCoinCost: 9999,
    premiumDesc: '전지전능한 궁극의 타워! $1로 영구 잠금해제. 모든 것을 파괴한다.',
    upgrades: [
      { name: '천벌', cost: 300, description: '데미지 +500, 공격속도 +30%, 범위 +50%', apply: t => { t.damage += 500; t.fireRate = Math.floor(t.fireRate * 0.7); t.aoeRadius *= 1.5; } },
      { name: '심판', cost: 500, description: '데미지 +1000, 사거리 +2칸, 독 +50/초', apply: t => { t.damage += 1000; t.range += 2 * TILE; t.poisonDamage += 50; } },
      { name: '신의 분노', cost: 800, description: '데미지 +2000, 범위 3배, 감속 99%, 관통', apply: t => { t.damage += 2000; t.aoeRadius *= 3; t.slowFactor = 0.01; t.piercing = true; } },
    ],
  },
};

// --- ENEMY DEFINITIONS ---
const ENEMY_DEFS = {
  // Stage 1 enemies
  basic: {
    name: '기본 적',
    hp: 80,
    speed: 80,
    reward: 10,
    color: '#e74c3c',
    size: 12,
    score: 10,
  },
  fast: {
    name: '빠른 적',
    hp: 50,
    speed: 150,
    reward: 15,
    color: '#f39c12',
    size: 10,
    score: 15,
  },
  tank: {
    name: '탱크 적',
    hp: 300,
    speed: 50,
    reward: 30,
    color: '#8e44ad',
    size: 18,
    score: 30,
  },
  boss: {
    name: '보스',
    hp: 800,
    speed: 40,
    reward: 100,
    color: '#e74c3c',
    size: 24,
    score: 100,
  },
  // Stage 2 enemies (stronger variants)
  elite: {
    name: '정예 병사',
    hp: 200,
    speed: 100,
    reward: 25,
    color: '#3498db',
    size: 14,
    score: 25,
    stage: 2,
  },
  phantom: {
    name: '유령 특공대',
    hp: 120,
    speed: 200,
    reward: 30,
    color: '#1abc9c',
    size: 11,
    score: 30,
    stage: 2,
  },
  golem: {
    name: '골렘',
    hp: 800,
    speed: 35,
    reward: 60,
    color: '#7f8c8d',
    size: 22,
    score: 60,
    stage: 2,
  },
  dragon: {
    name: '드래곤',
    hp: 2500,
    speed: 45,
    reward: 200,
    color: '#e67e22',
    size: 28,
    score: 200,
    stage: 2,
  },
  // Stage 3 enemies
  wraith: {
    name: '망령',
    hp: 350,
    speed: 180,
    reward: 40,
    color: '#9b59b6',
    size: 13,
    score: 40,
    stage: 3,
  },
  titan: {
    name: '타이탄',
    hp: 1800,
    speed: 30,
    reward: 90,
    color: '#636e72',
    size: 25,
    score: 90,
    stage: 3,
  },
  hydra: {
    name: '히드라',
    hp: 5000,
    speed: 40,
    reward: 300,
    color: '#00b894',
    size: 30,
    score: 300,
    stage: 3,
  },
  // Stage 4 enemies
  mech: {
    name: '메카 전사',
    hp: 600,
    speed: 90,
    reward: 55,
    color: '#74b9ff',
    size: 16,
    score: 55,
    stage: 4,
  },
  colossus: {
    name: '콜로서스',
    hp: 4000,
    speed: 25,
    reward: 200,
    color: '#2d3436',
    size: 32,
    score: 200,
    stage: 4,
  },
  // Stage 5 enemies
  deathknight: {
    name: '죽음의 기사',
    hp: 1200,
    speed: 70,
    reward: 80,
    color: '#6c5ce7',
    size: 18,
    score: 80,
    stage: 5,
  },
  lich: {
    name: '리치',
    hp: 8000,
    speed: 35,
    reward: 500,
    color: '#a29bfe',
    size: 34,
    score: 500,
    stage: 5,
  },
  // Stage 6-8 enemies (even stronger)
  demon: {
    name: '악마 군주',
    hp: 3000,
    speed: 80,
    reward: 150,
    color: '#d63031',
    size: 22,
    score: 150,
    stage: 6,
  },
  behemoth: {
    name: '비히모스',
    hp: 12000,
    speed: 30,
    reward: 700,
    color: '#e17055',
    size: 36,
    score: 700,
    stage: 6,
  },
  voidbeast: {
    name: '공허 야수',
    hp: 6000,
    speed: 65,
    reward: 300,
    color: '#6c5ce7',
    size: 26,
    score: 300,
    stage: 7,
  },
  abomination: {
    name: '혐오체',
    hp: 20000,
    speed: 28,
    reward: 1000,
    color: '#55efc4',
    size: 38,
    score: 1000,
    stage: 7,
  },
  // Stage 9-10 enemies (final bosses)
  apocalypse: {
    name: '종말의 전령',
    hp: 10000,
    speed: 55,
    reward: 500,
    color: '#fdcb6e',
    size: 24,
    score: 500,
    stage: 9,
  },
  worldeater: {
    name: '세계를 삼키는 자',
    hp: 50000,
    speed: 25,
    reward: 5000,
    color: '#ff0040',
    size: 42,
    score: 5000,
    stage: 10,
  },
  // Final Boss — the ultimate enemy
  finalBoss: {
    name: '파이널 보스: 종말의 지배자',
    hp: 200000,
    speed: 60,
    reward: 20000,
    color: '#ff0000',
    size: 50,
    score: 50000,
    stage: 10,
    regen: 200,         // HP regenerated per second
    speedBoostInterval: 8000,  // ms between speed bursts
    speedBoostDuration: 2000,  // ms each burst lasts
    speedBoostMultiplier: 2.5, // speed multiplier during burst
  },
};

// --- WAVE DEFINITIONS ---
// Each wave: array of {type, count, interval (ms between spawns), delay (ms before first spawn)}
// 10 stages × 5 waves each = 50 total waves
const WAVES_PER_STAGE = 5;
const TOTAL_STAGES = 10;
const TOTAL_WAVES = WAVES_PER_STAGE * TOTAL_STAGES;

// Stage info (name, bonus gold, bonus score, color theme)
const STAGE_INFO = [
  { name: '1단계: 초원의 침략',      grassColor: '#2d5a1b', pathColor: '#c8a96e', bonusGold: 0,   bonusScore: 0    },
  { name: '2단계: 어두운 숲',        grassColor: '#1a2e1a', pathColor: '#8b6914', bonusGold: 100, bonusScore: 500  },
  { name: '3단계: 황무지',          grassColor: '#3d2b1f', pathColor: '#a0522d', bonusGold: 150, bonusScore: 1000 },
  { name: '4단계: 얼음 황야',        grassColor: '#1a2a3a', pathColor: '#4682b4', bonusGold: 200, bonusScore: 1500 },
  { name: '5단계: 화산 지대',        grassColor: '#3a1a00', pathColor: '#8b2500', bonusGold: 250, bonusScore: 2000 },
  { name: '6단계: 악마의 영역',      grassColor: '#2a0000', pathColor: '#8b0000', bonusGold: 300, bonusScore: 3000 },
  { name: '7단계: 공허의 균열',      grassColor: '#1a001a', pathColor: '#4b0082', bonusGold: 400, bonusScore: 4000 },
  { name: '8단계: 차원의 경계',      grassColor: '#000a1a', pathColor: '#191970', bonusGold: 500, bonusScore: 5000 },
  { name: '9단계: 종말의 서막',      grassColor: '#1a0a00', pathColor: '#8b4513', bonusGold: 700, bonusScore: 7500 },
  { name: '10단계: 세계의 끝',       grassColor: '#0a0a0a', pathColor: '#1a1a1a', bonusGold: 1000, bonusScore: 10000 },
];

const WAVE_DEFS = [
  // ===== STAGE 1 (Waves 1-5) — Balanced: more engaging early game =====
  [{type:'basic', count:12, interval:1000, delay:0}, {type:'fast', count:3, interval:1200, delay:4000}],
  [{type:'basic', count:14, interval:900, delay:0}, {type:'fast', count:6, interval:1000, delay:3000}],
  [{type:'fast', count:10, interval:800, delay:0}, {type:'tank', count:3, interval:2500, delay:2000}],
  [{type:'basic', count:16, interval:700, delay:0}, {type:'fast', count:8, interval:600, delay:1000}, {type:'tank', count:4, interval:2200, delay:4000}],
  [{type:'boss', count:2, interval:5000, delay:0}, {type:'tank', count:6, interval:1600, delay:2000}, {type:'fast', count:18, interval:450, delay:1000}], // Stage 1 Final

  // ===== STAGE 2 (Waves 6-10) =====
  [{type:'elite', count:12, interval:900, delay:0}, {type:'basic', count:18, interval:550, delay:2000}],
  [{type:'elite', count:14, interval:800, delay:0}, {type:'phantom', count:8, interval:700, delay:2000}],
  [{type:'golem', count:2, interval:4000, delay:0}, {type:'elite', count:15, interval:700, delay:1000}],
  [{type:'phantom', count:12, interval:700, delay:0}, {type:'elite', count:10, interval:800, delay:1500}, {type:'golem', count:3, interval:3500, delay:3000}],
  [{type:'dragon', count:1, interval:0, delay:0}, {type:'golem', count:4, interval:2500, delay:2000}, {type:'phantom', count:20, interval:400, delay:1000}], // Stage 2 Final

  // ===== STAGE 3 (Waves 11-15) =====
  [{type:'wraith', count:12, interval:800, delay:0}, {type:'elite', count:10, interval:700, delay:2000}],
  [{type:'titan', count:2, interval:5000, delay:0}, {type:'wraith', count:15, interval:700, delay:2000}],
  [{type:'dragon', count:2, interval:5000, delay:0}, {type:'wraith', count:20, interval:600, delay:1000}],
  [{type:'titan', count:3, interval:4000, delay:0}, {type:'wraith', count:18, interval:600, delay:1500}, {type:'phantom', count:15, interval:500, delay:3000}],
  [{type:'hydra', count:1, interval:0, delay:0}, {type:'titan', count:4, interval:3500, delay:3000}, {type:'wraith', count:25, interval:500, delay:1000}], // Stage 3 Final

  // ===== STAGE 4 (Waves 16-20) =====
  [{type:'mech', count:12, interval:900, delay:0}, {type:'elite', count:15, interval:700, delay:2000}],
  [{type:'mech', count:15, interval:800, delay:0}, {type:'titan', count:3, interval:4000, delay:2000}],
  [{type:'colossus', count:1, interval:0, delay:0}, {type:'mech', count:20, interval:700, delay:2000}],
  [{type:'mech', count:25, interval:600, delay:0}, {type:'colossus', count:2, interval:8000, delay:3000}, {type:'dragon', count:2, interval:5000, delay:1000}],
  [{type:'colossus', count:3, interval:6000, delay:0}, {type:'hydra', count:1, interval:0, delay:5000}, {type:'mech', count:30, interval:500, delay:1000}], // Stage 4 Final

  // ===== STAGE 5 (Waves 21-25) =====
  [{type:'deathknight', count:10, interval:900, delay:0}, {type:'mech', count:15, interval:700, delay:2000}],
  [{type:'deathknight', count:15, interval:800, delay:0}, {type:'colossus', count:2, interval:6000, delay:3000}],
  [{type:'lich', count:1, interval:0, delay:0}, {type:'deathknight', count:20, interval:700, delay:2000}],
  [{type:'deathknight', count:25, interval:600, delay:0}, {type:'hydra', count:2, interval:8000, delay:3000}, {type:'colossus', count:3, interval:5000, delay:1000}],
  [{type:'lich', count:2, interval:10000, delay:0}, {type:'deathknight', count:30, interval:500, delay:2000}, {type:'hydra', count:2, interval:7000, delay:4000}], // Stage 5 Final

  // ===== STAGE 6 (Waves 26-30) =====
  [{type:'demon', count:10, interval:900, delay:0}, {type:'deathknight', count:15, interval:700, delay:2000}],
  [{type:'demon', count:15, interval:800, delay:0}, {type:'lich', count:1, interval:0, delay:5000}],
  [{type:'behemoth', count:1, interval:0, delay:0}, {type:'demon', count:20, interval:700, delay:3000}],
  [{type:'demon', count:25, interval:600, delay:0}, {type:'behemoth', count:2, interval:9000, delay:4000}, {type:'lich', count:2, interval:10000, delay:2000}],
  [{type:'behemoth', count:3, interval:8000, delay:0}, {type:'demon', count:30, interval:500, delay:2000}, {type:'lich', count:2, interval:9000, delay:5000}], // Stage 6 Final

  // ===== STAGE 7 (Waves 31-35) =====
  [{type:'voidbeast', count:10, interval:900, delay:0}, {type:'demon', count:15, interval:700, delay:2000}],
  [{type:'voidbeast', count:15, interval:800, delay:0}, {type:'behemoth', count:2, interval:8000, delay:3000}],
  [{type:'abomination', count:1, interval:0, delay:0}, {type:'voidbeast', count:20, interval:700, delay:3000}],
  [{type:'voidbeast', count:25, interval:600, delay:0}, {type:'abomination', count:2, interval:12000, delay:4000}, {type:'behemoth', count:3, interval:7000, delay:2000}],
  [{type:'abomination', count:3, interval:10000, delay:0}, {type:'voidbeast', count:35, interval:400, delay:2000}, {type:'behemoth', count:4, interval:7000, delay:5000}], // Stage 7 Final

  // ===== STAGE 8 (Waves 36-40) =====
  [{type:'voidbeast', count:20, interval:700, delay:0}, {type:'abomination', count:1, interval:0, delay:5000}],
  [{type:'abomination', count:2, interval:10000, delay:0}, {type:'demon', count:25, interval:600, delay:3000}],
  [{type:'abomination', count:3, interval:8000, delay:0}, {type:'voidbeast', count:30, interval:500, delay:2000}],
  [{type:'abomination', count:4, interval:7000, delay:0}, {type:'behemoth', count:4, interval:6000, delay:3000}, {type:'voidbeast', count:35, interval:400, delay:1000}],
  [{type:'abomination', count:5, interval:6000, delay:0}, {type:'voidbeast', count:40, interval:350, delay:2000}, {type:'behemoth', count:5, interval:5000, delay:4000}], // Stage 8 Final

  // ===== STAGE 9 (Waves 41-45) =====
  [{type:'apocalypse', count:5, interval:3000, delay:0}, {type:'abomination', count:3, interval:8000, delay:3000}],
  [{type:'apocalypse', count:8, interval:2500, delay:0}, {type:'voidbeast', count:30, interval:500, delay:2000}],
  [{type:'apocalypse', count:10, interval:2000, delay:0}, {type:'abomination', count:4, interval:7000, delay:3000}],
  [{type:'apocalypse', count:15, interval:1800, delay:0}, {type:'behemoth', count:6, interval:5000, delay:3000}, {type:'abomination', count:5, interval:6000, delay:5000}],
  [{type:'apocalypse', count:20, interval:1500, delay:0}, {type:'abomination', count:6, interval:5000, delay:3000}, {type:'behemoth', count:7, interval:4500, delay:5000}], // Stage 9 Final

  // ===== STAGE 10 (Waves 46-50) - THE END =====
  [{type:'worldeater', count:1, interval:0, delay:0}, {type:'apocalypse', count:10, interval:2000, delay:5000}],
  [{type:'worldeater', count:1, interval:0, delay:0}, {type:'abomination', count:8, interval:5000, delay:5000}, {type:'apocalypse', count:15, interval:1500, delay:3000}],
  [{type:'worldeater', count:2, interval:20000, delay:0}, {type:'apocalypse', count:20, interval:1200, delay:5000}],
  [{type:'worldeater', count:2, interval:18000, delay:0}, {type:'abomination', count:10, interval:4000, delay:5000}, {type:'apocalypse', count:25, interval:1000, delay:3000}],
  [{type:'finalBoss', count:1, interval:0, delay:0}, {type:'worldeater', count:3, interval:15000, delay:8000}, {type:'abomination', count:12, interval:3500, delay:5000}, {type:'apocalypse', count:30, interval:800, delay:3000}], // FINAL WAVE
];

// ============================================================
// GAME STATE
// ============================================================
let canvas, ctx;
let PATH_WAYPOINTS = [];
let towers = [];
let enemies = [];
let projectiles = [];
let particles = [];

let hp = 20;
let gold = 150;
let score = 0;
let currentWave = 0;
let currentStage = 1;
let waveInProgress = false;
let waveEnemyTotal = 0;
let waveEnemyKilled = 0;
let gameOver = false;
let victory = false;
let stageTransition = false; // true when showing stage 2 intro

let selectedTowerType = null;
let sellMode = false;
let hoveredCell = null;
let selectedTower = null;  // currently clicked tower for upgrade shop
let nukeBombs = 0;         // nuke bomb inventory
let nukeBombMode = false;  // true when player is targeting a nuke drop
let speedMultiplier = 1;   // 1 = normal, 2 = fast
let autoWaveEnabled = false; // auto-start next wave
let gamePaused = false;      // pause toggle

// ── COMBO SYSTEM ──────────────────────────────────────────
let comboCount = 0;        // consecutive kills
let comboTimer = 0;        // seconds since last kill
const COMBO_TIMEOUT = 1.5; // seconds before combo resets
let maxCombo = 0;          // best combo this game
let totalKills = 0;        // total enemies defeated

// ── WAVE COUNTDOWN ────────────────────────────────────────
let waveCountdown = 0;     // seconds until wave starts (0 = inactive)
let waveCountdownActive = false;

// ── FLOATING TEXT LABELS ──────────────────────────────────
let floatingTexts = [];    // {x, y, text, color, life, maxLife, vy}

// ── PHASE 3 VISUAL EFFECTS ─────────────────────────────────
// Storm vortex: per-tower angle for spinning particle halo
// Laser beams: track active laser firing state per tower
let _nextTowerId = 1;
let stormVortexAngles = {};   // tower._uid -> angle (radians, incremented each frame)
let laserBeams = [];          // [{sx,sy,ex,ey,alpha,color}] — drawn this frame, cleared next
let teslaArcs = [];           // [{sx,sy,ex,ey,life,maxLife,color,segments}] — decaying lightning arcs

let lastTime = 0;
let animId = null;

// Screen shake state
let screenShakeDuration = 0;
let screenShakeIntensity = 0;

// --- PERFORMANCE: Offscreen map cache ---
let mapCacheCanvas = null;
let mapCacheDirty = true;
let mapCacheStage = -1; // track which stage was cached

// --- PERFORMANCE: Dirty-flag UI to avoid per-frame DOM writes ---
let uiDirty = true;
let prevUiHp = -1, prevUiGold = -1, prevUiWave = -1, prevUiScore = -1, prevUiStage = -1;

// --- PERFORMANCE: unique enemy id counter ---
let nextEnemyId = 1;

// --- PERFORMANCE: Object pools for projectiles & particles ---
const _projectilePool = [];
const _particlePool = [];
const MAX_PARTICLES = 500;
const _enemyPool = [];

function allocProjectile(props) {
  const obj = _projectilePool.pop() || {};
  obj.x = props.x; obj.y = props.y;
  obj.targetEnemy = props.targetEnemy;
  obj.speed = props.speed; obj.damage = props.damage;
  obj.color = props.color; obj.size = props.size;
  obj.aoeRadius = props.aoeRadius; obj.slowFactor = props.slowFactor;
  obj.poisonDamage = props.poisonDamage; obj.piercing = props.piercing;
  obj.dead = false; obj.towerType = props.towerType;
  obj.srcX = props.srcX; obj.srcY = props.srcY;
  obj.prevX = props.x; obj.prevY = props.y;
  return obj;
}

function allocParticle(x, y, vx, vy, life, maxLife, color, size) {
  if (particles.length >= MAX_PARTICLES) return null;
  const obj = _particlePool.pop() || {};
  obj.x = x; obj.y = y; obj.vx = vx; obj.vy = vy;
  obj.life = life; obj.maxLife = maxLife;
  obj.color = color; obj.size = size;
  return obj;
}

function recycleProjectiles() {
  let w = 0;
  for (let i = 0; i < projectiles.length; i++) {
    if (!projectiles[i].dead) {
      projectiles[w++] = projectiles[i];
    } else {
      _projectilePool.push(projectiles[i]);
    }
  }
  projectiles.length = w;
}

function recycleParticles() {
  let w = 0;
  for (let i = 0; i < particles.length; i++) {
    if (particles[i].life > 0) {
      particles[w++] = particles[i];
    } else {
      _particlePool.push(particles[i]);
    }
  }
  particles.length = w;
}

function recycleEnemies() {
  let w = 0;
  for (let i = 0; i < enemies.length; i++) {
    if (!enemies[i].dead && !enemies[i].reached) {
      enemies[w++] = enemies[i];
    } else {
      _enemyPool.push(enemies[i]);
    }
  }
  enemies.length = w;
}

// Spawn queue state
let spawnQueues = [];    // [{type, remaining, interval, nextSpawnAt, delay}]
let waveStartTime = 0;

// --- INIT ---
window.onload = function() {
  // Show name screen first; fetch leaderboard for preview
  fetchLeaderboard(document.getElementById('leaderboard-list'));

  // Allow Enter key to start game
  document.getElementById('player-name-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') startGame();
  });
};



// ── TAB VISIBILITY AUTO-PAUSE ───────────────────────────────────────────────────
let tabHiddenPaused = false;
document.addEventListener('visibilitychange', () => {
  if (document.hidden && waveInProgress && !gameOver && !stageTransition) {
    if (speedMultiplier > 1) { toggleSpeed(); tabHiddenPaused = true; }
  } else if (!document.hidden && tabHiddenPaused) {
    tabHiddenPaused = false;
  }
});

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================
const TOWER_HOTKEYS = {
  '1': 'arrow', '2': 'cannon', '3': 'magic',  '4': 'sniper',
  '5': 'poison','6': 'laser',  '7': 'storm',  '8': 'gravity',
};
function initKeyboardShortcuts() {
  window.addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (gameOver || stageTransition) return;
    if (TOWER_HOTKEYS[e.key]) { e.preventDefault(); selectTower(TOWER_HOTKEYS[e.key]); return; }
    switch (e.key) {
      case ' ': e.preventDefault();
        if (!waveInProgress && !waveCountdownActive && currentWave < TOTAL_WAVES) startNextWave(); break;
      case 'p': case 'P': e.preventDefault(); togglePause(); break;
      case 'f': case 'F': e.preventDefault(); toggleSpeed(); break;
      case 'a': case 'A': e.preventDefault(); toggleAutoWave(); break;
      case 'n': case 'N': e.preventDefault(); toggleNukeBombMode(); break;
      case 's': case 'S': e.preventDefault(); setSellMode(); break;
      case 'm': case 'M': e.preventDefault(); toggleMute(); break;
      case 'Escape': e.preventDefault();
        if (sellMode) { setSellMode(); break; }
        if (selectedTowerType) { selectedTowerType = null; clearTowerShopHint(); updateTowerButtons(); break; }
        if (selectedTower) { selectedTower = null; hideTowerInfo(); break; }
        break;
    }
  });
}

let _gameInitialized = false;
function initGame() {
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  if (!_gameInitialized) {
    window.addEventListener('resize', resizeCanvas);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('mouseleave', () => { hoveredCell = null; });
    initKeyboardShortcuts();
    _gameInitialized = true;
  }

  PATH_WAYPOINTS = buildPath();
  resetGameState();
  updateUI();
  if (animId) cancelAnimationFrame(animId);
  lastTime = performance.now();
  animId = requestAnimationFrame(gameLoop);
  startBgm();
  // Show first-play onboarding hint for new players
  showOnboardingHintIfNew();
}

function showOnboardingHintIfNew() {
  const seen = localStorage.getItem('td_onboarding_seen');
  if (seen) return;
  localStorage.setItem('td_onboarding_seen', '1');
  const hint = document.getElementById('onboarding-hint');
  if (!hint) return;
  hint.style.display = 'block';
  setTimeout(() => { hint.style.display = 'none'; }, 7000);
}

function resetGameState() {
  towers = [];
  enemies = [];
  projectiles = [];
  particles = [];
  floatingTexts = [];
  spawnQueues = [];
  const diffSettings = DIFFICULTY_SETTINGS[gameDifficulty];
  hp = diffSettings.hp;
  gold = diffSettings.gold;
  score = 0;
  currentWave = 0;
  currentStage = 1;
  waveInProgress = false;
  waveEnemyTotal = 0;
  waveEnemyKilled = 0;
  gameOver = false;
  victory = false;
  stageTransition = false;
  selectedTowerType = null;
  sellMode = false;
  selectedTower = null;
  nukeBombs = 0;
  nukeBombMode = false;
  speedMultiplier = 1;
  autoWaveEnabled = false;
  gamePaused = false;
  screenShakeDuration = 0;
  screenShakeIntensity = 0;
  // Reset performance tracking state
  mapCacheDirty = true;
  mapCacheStage = -1;
  uiDirty = true;
  prevUiHp = -1; prevUiGold = -1; prevUiWave = -1; prevUiScore = -1; prevUiStage = -1;
  prevUiKills = -1; prevUiCombo = -1; prevWaveCountdownCeil = -1; prevWavePreviewKey = -2;
  nextEnemyId = 1;
  _projectilePool.length = 0;
  _particlePool.length = 0;
  comboCount = 0;
  comboTimer = 0;
  maxCombo = 0;
  totalKills = 0;
  waveCountdown = 0;
  waveCountdownActive = false;
  _nextTowerId = 1;
  stormVortexAngles = {};
  laserBeams = [];
  teslaArcs = [];
  document.getElementById('overlay').style.display = 'none';
  document.getElementById('stage-transition-overlay').style.display = 'none';
  document.getElementById('start-wave-btn').disabled = false;
  document.getElementById('sell-btn').classList.remove('active');
  const speedBtn = document.getElementById('speed-btn');
  if (speedBtn) { speedBtn.textContent = '▶ 1x'; speedBtn.classList.remove('active'); }
  const autoWaveBtn = document.getElementById('auto-wave-btn');
  if (autoWaveBtn) { autoWaveBtn.classList.remove('active'); }
  document.getElementById('rank-display').style.display = 'none';
  document.getElementById('leaderboard-result-list').textContent = '불러오는 중...';
  hideTowerInfo();
}

function resizeCanvas() {
  const container = document.getElementById('canvas-container');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  // Scale to fit
  const scaleX = container.clientWidth / canvas.width;
  const scaleY = container.clientHeight / canvas.height;
  const scale = Math.min(scaleX, scaleY);
  canvas.style.width = (canvas.width * scale) + 'px';
  canvas.style.height = (canvas.height * scale) + 'px';
  canvas.style.marginLeft = ((container.clientWidth - canvas.width * scale) / 2) + 'px';
  canvas.style.marginTop = ((container.clientHeight - canvas.height * scale) / 2) + 'px';
}

// ============================================================
// GAME LOOP
// ============================================================
function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // seconds, capped
  lastTime = timestamp;

  if (!gameOver && !gamePaused) {
    update(dt, timestamp);
  }
  render(timestamp);
  if (gamePaused) drawPauseOverlay();
  animId = requestAnimationFrame(gameLoop);
}

function togglePause() {
  if (gameOver || victory) return;
  gamePaused = !gamePaused;
}

function drawPauseOverlay() {
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = `bold ${TILE * 1.5}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 20;
  ctx.fillText('⏸ 일시정지', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = `${TILE * 0.5}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('P 키로 계속', canvas.width / 2, canvas.height / 2 + 30);
  ctx.restore();
}

function update(dt, timestamp) {
  const adt = dt * speedMultiplier;
  updateSpawns(timestamp);
  updateEnemies(adt);
  recycleEnemies();
  updateTowers(adt, timestamp);
  updateProjectiles(adt);
  updateParticles(adt);
  updateFloatingTexts(adt);
  updateComboTimer(adt);
  updateTeslaArcs(adt);
  updateWaveCountdown(dt);
  checkWaveEnd();
  // Only touch DOM when something actually changed
  if (uiDirty) {
    updateUI();
    uiDirty = false;
  }
  // Decay screen shake
  if (screenShakeDuration > 0) {
    screenShakeDuration = Math.max(0, screenShakeDuration - dt);
    if (screenShakeDuration === 0) screenShakeIntensity = 0;
  }
}

// ── COMBO SYSTEM ──────────────────────────────────────────
function updateComboTimer(dt) {
  if (comboCount > 0) {
    comboTimer += dt;
    if (comboTimer >= COMBO_TIMEOUT) {
      comboCount = 0;
      comboTimer = 0;
      uiDirty = true; // combo expired, need UI update
    }
  }
}

function getComboMultiplier() {
  if (comboCount < 5) return 1;
  if (comboCount < 10) return 1.5;
  if (comboCount < 20) return 2;
  return 3;
}

function onEnemyKilled(x, y, baseReward) {
  comboCount++;
  comboTimer = 0;
  totalKills++;
  if (comboCount > maxCombo) maxCombo = comboCount;
  checkAchievements();

  const mult = getComboMultiplier();
  const bonus = Math.floor(baseReward * (mult - 1));

  if (comboCount >= 5) {
    const comboLabel = comboCount >= 20 ? `${comboCount}x MAX COMBO! +${bonus}💰` :
                       comboCount >= 10 ? `${comboCount}x COMBO! +${bonus}💰` :
                       `${comboCount}x コンボ! +${bonus}💰`;
    const color = comboCount >= 20 ? '#ffd700' : comboCount >= 10 ? '#ff8c00' : '#00ff88';
    const comboSize = comboCount >= 20 ? 19 : comboCount >= 10 ? 16 : 14;
    spawnFloatingText(x, y - 20, comboLabel, color, comboSize);
    if (bonus > 0) {
      gold += bonus;
      uiDirty = true;
    }
  } else if (comboCount === 3) {
    spawnFloatingText(x, y - 15, '3 kills!', '#aaffaa');
  }
}

// ── FLOATING TEXT ──────────────────────────────────────────
const MAX_FLOATING_TEXTS = 60;
function spawnFloatingText(x, y, text, color, size = 13) {
  if (floatingTexts.length >= MAX_FLOATING_TEXTS) {
    floatingTexts.shift();
  }
  floatingTexts.push({ x, y, text, color, size, life: 1.2, maxLife: 1.2, vy: -50 });
}

function updateFloatingTexts(dt) {
  for (const ft of floatingTexts) {
    ft.y += ft.vy * dt;
    ft.vy *= 0.92;
    ft.life -= dt;
  }
  let fw = 0;
  for (let i = 0; i < floatingTexts.length; i++) {
    if (floatingTexts[i].life > 0) floatingTexts[fw++] = floatingTexts[i];
  }
  floatingTexts.length = fw;
}

// ── WAVE COUNTDOWN ────────────────────────────────────────
function updateWaveCountdown(dt) {
  if (!waveCountdownActive) return;
  waveCountdown -= dt;
  if (waveCountdown <= 0) {
    waveCountdownActive = false;
    waveCountdown = 0;
    _doStartNextWave();
  }
  uiDirty = true;
}

// ============================================================
// SPAWNING
// ============================================================
function startNextWave() {
  if (waveInProgress || gameOver || stageTransition) return;
  if (currentWave >= TOTAL_WAVES) return;
  if (waveCountdownActive) return;

  // 3-second countdown before wave starts
  waveCountdown = 3;
  waveCountdownActive = true;
  document.getElementById('start-wave-btn').disabled = true;
  uiDirty = true;
}

function _doStartNextWave() {
  if (waveInProgress || gameOver || stageTransition) return;
  if (currentWave >= TOTAL_WAVES) return;

  sfxWaveStart();
  waveInProgress = true;
  if (currentWave === 0 && !sessionStartTime) sessionStartTime = performance.now();
  waveStartTime = performance.now();
  spawnQueues = [];

  const waveDef = WAVE_DEFS[currentWave];
  waveEnemyTotal = 0;
  waveEnemyKilled = 0;
  for (const group of waveDef) {
    waveEnemyTotal += group.count;
    spawnQueues.push({
      type: group.type,
      remaining: group.count,
      interval: group.interval,
      delay: group.delay,
      nextSpawnAt: waveStartTime + group.delay,
    });
  }

  currentWave++;
  uiDirty = true;
}

function updateSpawns(timestamp) {
  if (!waveInProgress) return;
  for (const q of spawnQueues) {
    if (q.remaining <= 0) continue;
    if (timestamp >= q.nextSpawnAt) {
      spawnEnemy(q.type);
      q.remaining--;
      q.nextSpawnAt = timestamp + q.interval / speedMultiplier;
    }
  }
}

function spawnEnemy(type) {
  const def = ENEMY_DEFS[type];
  const diffSettings = DIFFICULTY_SETTINGS[gameDifficulty];
  const enemy = _enemyPool.pop() || {};
  enemy.type = type;
  const adjustedHp = Math.round(def.hp * diffSettings.enemyHpMultiplier);
  const adjustedSpeed = Math.round(def.speed * diffSettings.enemySpeedMultiplier);
  enemy.hp = adjustedHp;
  enemy.maxHp = adjustedHp;
  enemy.speed = adjustedSpeed;
  enemy.baseSpeed = adjustedSpeed;
  enemy.reward = Math.round(def.reward * (diffSettings.enemyRewardMultiplier || 1.0));
  enemy.color = def.color;
  enemy.size = def.size;
  enemy.score = def.score;
  enemy.waypointIndex = 0;
  enemy.x = PATH_WAYPOINTS[0].x;
  enemy.y = PATH_WAYPOINTS[0].y;
  enemy.slowUntil = 0;
  enemy._slowFactor = 1;
  enemy.poisonUntil = 0;
  enemy.poisonDps = 0;
  enemy.dead = false;
  enemy.reached = false;
  enemy.id = nextEnemyId++;
  enemy._hitFlashUntil = 0;
  enemy._dmgAccum = 0;
  enemy._dmgAccumStart = 0;
  enemy.regen = 0;
  enemy.speedBoosting = false;
  enemy.speedBoostEnd = 0;
  // Final boss special abilities
  if (def.regen) enemy.regen = def.regen;
  if (def.speedBoostInterval) {
    enemy.speedBoostInterval = def.speedBoostInterval;
    enemy.speedBoostDuration = def.speedBoostDuration;
    enemy.speedBoostMultiplier = def.speedBoostMultiplier;
    enemy.lastSpeedBoost = performance.now();
    enemy.speedBoosting = false;
    enemy.speedBoostEnd = 0;
  }
  enemies.push(enemy);
  // Announce final boss with screen shake and sound
  if (type === 'finalBoss') {
    screenShakeDuration = 0.5;
    screenShakeIntensity = 7;
    sfxFinalBossSpawn();
  }
}

function checkWaveEnd() {
  if (!waveInProgress) return;
  const allSpawned = spawnQueues.every(q => q.remaining <= 0);
  const allDead = enemies.every(e => e.dead || e.reached);
  if (allSpawned && allDead) {
    waveInProgress = false;
    recycleEnemies();

    if (currentWave >= TOTAL_WAVES && !gameOver) {
      // All waves completed - ultimate victory!
      victory = true;
      gameOver = true;
      showOverlay(true);
    } else if (currentWave % WAVES_PER_STAGE === 0 && !gameOver) {
      // Stage complete - transition to next stage
      const completedStage = currentWave / WAVES_PER_STAGE;
      const nextStage = completedStage + 1;
      const stageData = STAGE_INFO[completedStage]; // 0-indexed, so completedStage index = completedStage
      currentStage = nextStage;
      stageTransition = true;
      gold += stageData.bonusGold;
      score += stageData.bonusScore;
      checkAchievements();
      // Stage clear announcement
      spawnFloatingText(canvas.width / 2, canvas.height * 0.35,
        '🏆 ' + completedStage + '단계 클리어!', '#ffd700');
      showStageTransition(completedStage, nextStage);
    } else {
      document.getElementById('start-wave-btn').disabled = false;
      const diffSettings = DIFFICULTY_SETTINGS[gameDifficulty];
      // Bonus gold between waves (scales with stage), modified by difficulty
      const baseWaveBonusGold = 20 + currentStage * 5;
      const waveBonusGold = Math.floor(baseWaveBonusGold * (diffSettings.waveGoldMultiplier || 1.0));
      const interestGold = Math.min(80, Math.floor(gold * 0.02));
      gold += waveBonusGold + interestGold;
      spawnWaveClearCelebration(currentWave, waveBonusGold, interestGold);
      // HP regen on wave clear — use difficulty settings (hard mode: no regen)
      const hpRegenAmount = diffSettings.hpRegenPerWave || 0;
      const maxHpCap = diffSettings.maxHp || 20;
      if (hpRegenAmount > 0 && hp < maxHpCap) {
        hp = Math.min(maxHpCap, hp + hpRegenAmount);
        spawnFloatingText(canvas.width / 2, canvas.height * 0.45, '+1 HP', '#ff6b6b', 14);
        uiDirty = true;
      }
      // Auto-wave: start next wave after a short delay
      if (autoWaveEnabled) {
        setTimeout(() => {
          if (autoWaveEnabled && !waveInProgress && !gameOver && !stageTransition) startNextWave();
        }, 500);
      }
    }
  }
}

function showStageTransition(completedStage, nextStage) {
  const overlay = document.getElementById('stage-transition-overlay');
  const stageData = STAGE_INFO[completedStage]; // data for completed stage
  const nextData = STAGE_INFO[nextStage - 1];   // data for next stage (0-indexed)
  const content = document.getElementById('stage-transition-content');
  if (content) {
    const stageEmojis = ['', '🌿', '🌲', '🏜️', '❄️', '🌋', '👿', '🌀', '🌌', '☄️', '💀'];
    const nextEmoji = stageEmojis[nextStage] || '⚔️';
    content.innerHTML = `
      <div class="stage-badge">${nextEmoji} ${completedStage}단계 클리어!</div>
      <h1>${nextData ? nextData.name : '최종 클리어!'}</h1>
      <p>보너스: 💰${stageData.bonusGold} 코인 | 🏆+${stageData.bonusScore} 점수 획득!</p>
      <div class="stage2-warning">
        <p>다음 단계에서 더 강력한 적이 등장합니다!</p>
      </div>
      <p class="stage-auto">잠시 후 자동으로 시작됩니다...</p>
    `;
  }
  overlay.style.display = 'flex';
  // Auto-hide after 4 seconds
  setTimeout(() => {
    overlay.style.display = 'none';
    stageTransition = false;
    document.getElementById('start-wave-btn').disabled = false;
    if (autoWaveEnabled && !waveInProgress && !gameOver) {
      setTimeout(() => startNextWave(), 500);
    }
  }, 4000);
}

// ============================================================
// ENEMIES
// ============================================================
function updateEnemies(dt) {
  const now = performance.now();
  for (const enemy of enemies) {
    if (enemy.dead || enemy.reached) continue;

    // Apply poison DOT
    if (enemy.poisonUntil && now < enemy.poisonUntil && enemy.poisonDps > 0) {
      enemy.hp -= enemy.poisonDps * dt;
      if (enemy.hp <= 0) {
        enemy.dead = true;
        gold += enemy.reward;
        score += enemy.score;
        waveEnemyKilled++;
        uiDirty = true;
        spawnDeathParticles(enemy.x, enemy.y, '#39ff14');
        onEnemyKilled(enemy.x, enemy.y, enemy.reward);
        continue;
      }
    }

    // Final boss regeneration
    if (enemy.regen && enemy.hp < enemy.maxHp) {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.regen * dt);
    }

    // Final boss speed boost ability
    if (enemy.speedBoostInterval) {
      if (!enemy.speedBoosting && now - enemy.lastSpeedBoost >= enemy.speedBoostInterval) {
        enemy.speedBoosting = true;
        enemy.speedBoostEnd = now + enemy.speedBoostDuration;
        enemy.lastSpeedBoost = now;
      }
      if (enemy.speedBoosting && now >= enemy.speedBoostEnd) {
        enemy.speedBoosting = false;
      }
    }

    // Update speed (slow effect + speed boost)
    let baseSpeed = enemy.baseSpeed;
    if (enemy.speedBoosting) baseSpeed *= enemy.speedBoostMultiplier;
    const slow = now < enemy.slowUntil ? baseSpeed * (1 - (1 - getSlowFactor(enemy))) : baseSpeed;
    enemy.speed = slow;

    // Flush damage accumulator after 200ms batch window
    if (enemy._dmgAccum && now - enemy._dmgAccumStart > 200) {
      spawnFloatingText(enemy.x + (Math.random() - 0.5) * 10, enemy.y - enemy.size - 4, '-' + enemy._dmgAccum, '#ff4444');
      enemy._dmgAccum = 0;
    }

    // Move along path
    if (enemy.waypointIndex >= PATH_WAYPOINTS.length) {
      // Reached end
      enemy.reached = true;
      waveEnemyKilled++;
      hp--;
      uiDirty = true;
      sfxHpLoss();
      screenShakeDuration = 0.2;
      screenShakeIntensity = 4;
      if (hp <= 0) { hp = 0; gameOver = true; showOverlay(false); }
      continue;
    }
    const target = PATH_WAYPOINTS[enemy.waypointIndex];
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = enemy.speed * dt;
    if (dist === 0 || step >= dist) {
      enemy.x = target.x;
      enemy.y = target.y;
      enemy.waypointIndex++;
    } else {
      enemy.x += (dx / dist) * step;
      enemy.y += (dy / dist) * step;
    }
  }
}

function getSlowFactor(enemy) {
  // Find active slow from any projectile that hit
  return enemy._slowFactor !== undefined ? enemy._slowFactor : 1;
}

// ============================================================
// TOWERS
// ============================================================
function findTarget(tower) {
  const rangeSq = tower.range * tower.range;
  const mode = tower.targetingMode || 'first';
  let target = null;

  if (mode === 'first') {
    let bestWp = -1, bestProgressSq = Infinity;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reached) continue;
      const dx = enemy.x - tower.cx, dy = enemy.y - tower.cy;
      if (dx * dx + dy * dy > rangeSq) continue;
      const wp = enemy.waypointIndex;
      if (wp > bestWp) {
        bestWp = wp;
        if (wp < PATH_WAYPOINTS.length) {
          const tw = PATH_WAYPOINTS[wp];
          const ex = tw.x - enemy.x, ey = tw.y - enemy.y;
          bestProgressSq = ex * ex + ey * ey;
        } else { bestProgressSq = 0; }
        target = enemy;
      } else if (wp === bestWp && wp < PATH_WAYPOINTS.length) {
        const tw = PATH_WAYPOINTS[wp];
        const ex = tw.x - enemy.x, ey = tw.y - enemy.y;
        const pSq = ex * ex + ey * ey;
        if (pSq < bestProgressSq) { bestProgressSq = pSq; target = enemy; }
      }
    }
  } else if (mode === 'last') {
    let worstWp = Infinity, worstProgressSq = -1;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reached) continue;
      const dx = enemy.x - tower.cx, dy = enemy.y - tower.cy;
      if (dx * dx + dy * dy > rangeSq) continue;
      const wp = enemy.waypointIndex;
      if (wp < worstWp) {
        worstWp = wp;
        if (wp < PATH_WAYPOINTS.length) {
          const tw = PATH_WAYPOINTS[wp];
          const ex = tw.x - enemy.x, ey = tw.y - enemy.y;
          worstProgressSq = ex * ex + ey * ey;
        } else { worstProgressSq = 0; }
        target = enemy;
      } else if (wp === worstWp && wp < PATH_WAYPOINTS.length) {
        const tw = PATH_WAYPOINTS[wp];
        const ex = tw.x - enemy.x, ey = tw.y - enemy.y;
        const pSq = ex * ex + ey * ey;
        if (pSq > worstProgressSq) { worstProgressSq = pSq; target = enemy; }
      }
    }
  } else if (mode === 'strong') {
    let bestHp = -1;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reached) continue;
      const dx = enemy.x - tower.cx, dy = enemy.y - tower.cy;
      if (dx * dx + dy * dy > rangeSq) continue;
      if (enemy.hp > bestHp) { bestHp = enemy.hp; target = enemy; }
    }
  } else if (mode === 'weak') {
    let lowestHp = Infinity;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reached) continue;
      const dx = enemy.x - tower.cx, dy = enemy.y - tower.cy;
      if (dx * dx + dy * dy > rangeSq) continue;
      if (enemy.hp < lowestHp) { lowestHp = enemy.hp; target = enemy; }
    }
  } else { // close
    let minDistSq = rangeSq;
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reached) continue;
      const dx = enemy.x - tower.cx, dy = enemy.y - tower.cy;
      const dSq = dx * dx + dy * dy;
      if (dSq <= minDistSq) { minDistSq = dSq; target = enemy; }
    }
  }
  return target;
}

function updateTowers(dt, timestamp) {
  for (const tower of towers) {
    tower.cooldownLeft -= dt * 1000; // ms
    if (tower.cooldownLeft > 0) continue;

    const target = findTarget(tower);
    if (!target) continue;

    // Fire!
    tower.cooldownLeft = tower.fireRate;
    tower.angle = Math.atan2(target.y - tower.cy, target.x - tower.cx);
    fireProjectile(tower, target);
  }
}

function fireProjectile(tower, target) {
  sfxShoot(tower.type);
  const def = TOWER_DEFS[tower.type];
  projectiles.push(allocProjectile({
    x: tower.cx,
    y: tower.cy,
    targetEnemy: target,
    speed: tower.projectileSpeed || def.projectileSpeed,
    damage: tower.damage,
    color: def.projectileColor,
    size: def.projectileSize,
    aoeRadius: tower.aoeRadius,
    slowFactor: tower.slowFactor,
    poisonDamage: tower.poisonDamage || 0,
    piercing: tower.piercing || false,
    towerType: tower.type,
    srcX: tower.cx,
    srcY: tower.cy,
    towerRef: tower,
  }));
}

function updateProjectiles(dt) {
  // Clear laser beams from last frame before rebuilding
  laserBeams.length = 0;
  for (const p of projectiles) {
    if (p.dead) continue;
    if (!p.targetEnemy || p.targetEnemy.dead || p.targetEnemy.reached) {
      p.dead = true;
      continue;
    }
    const dx = p.targetEnemy.x - p.x;
    const dy = p.targetEnemy.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = p.speed * dt;
    if (step >= dist) {
      // Hit!
      // Record laser beam flash at moment of impact
      if (p.towerType === 'laser' || p.towerType === 'voidray') {
        laserBeams.push({ sx: p.srcX, sy: p.srcY, ex: p.targetEnemy.x, ey: p.targetEnemy.y, alpha: 0.9, color: p.color });
      }
      hitEnemy(p);
      p.dead = true;
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
      // Record active laser beam this frame (in-flight)
      if (p.towerType === 'laser' || p.towerType === 'voidray') {
        laserBeams.push({ sx: p.srcX, sy: p.srcY, ex: p.x, ey: p.y, alpha: 0.6, color: p.color });
      }
    }
  }
  recycleProjectiles();
}

function hitEnemy(p) {
  const _validTowerRef = p.towerRef && towers.includes(p.towerRef) ? p.towerRef : null;
  if (p.aoeRadius > 0) {
    // AOE damage (squared distance avoids sqrt per enemy)
    const aoeRadSq = p.aoeRadius * p.aoeRadius;
    const isTesla = p.towerType === 'tesla' || p.towerType === 'god';
    for (const enemy of enemies) {
      if (enemy.dead || enemy.reached) continue;
      const dx = enemy.x - p.targetEnemy.x;
      const dy = enemy.y - p.targetEnemy.y;
      if (dx * dx + dy * dy <= aoeRadSq) {
        dealDamage(enemy, p.damage, p.slowFactor, p.poisonDamage, _validTowerRef);
        // Tesla/God: spawn chain lightning arc from primary target to each secondary
        if (isTesla && enemy !== p.targetEnemy) {
          spawnTeslaArc(p.targetEnemy.x, p.targetEnemy.y, enemy.x, enemy.y, p.color);
        }
      }
    }
    // Tesla: arc from tower to primary target
    if (isTesla) {
      spawnTeslaArc(p.srcX, p.srcY, p.targetEnemy.x, p.targetEnemy.y, p.color);
    }
    // Explosion particle
    const expColor = p.poisonDamage > 0 ? '#39ff14' : p.towerType === 'tesla' ? '#00bfff' : '#ff6600';
    spawnExplosion(p.targetEnemy.x, p.targetEnemy.y, expColor);
    sfxExplosion();
  } else {
    const _wasAlive = p.targetEnemy.hp > 0;
    const _validTower = p.towerRef && towers.includes(p.towerRef) ? p.towerRef : null;
    dealDamage(p.targetEnemy, p.damage, p.slowFactor, p.poisonDamage, _validTower);
    if (_wasAlive && p.targetEnemy.dead && _validTower) {
      _validTower.kills = (_validTower.kills || 0) + 1;
    }
  }
  // Hit spark
  spawnSpark(p.targetEnemy.x, p.targetEnemy.y, p.color);
}

function dealDamage(enemy, dmg, slowFactor, poisonDmgPerSec, towerRef) {
  const now = performance.now();
  // Slow synergy: +25% damage to already-slowed enemies
  let finalDmg = dmg;
  if (now < enemy.slowUntil) {
    finalDmg = Math.floor(dmg * 1.25);
  }
  // Poison synergy: +15% damage to poisoned enemies
  if (enemy.poisonUntil && now < enemy.poisonUntil) {
    finalDmg = Math.floor(finalDmg * 1.15);
  }
  // Critical hit: 15% chance for 2x damage
  let isCrit = false;
  if (Math.random() < 0.15) {
    finalDmg = Math.floor(finalDmg * 2);
    isCrit = true;
  }
  enemy.hp -= finalDmg;
  if (towerRef) towerRef.totalDamage = (towerRef.totalDamage || 0) + finalDmg;
  enemy._hitFlashUntil = now + (isCrit ? 150 : 80);
  // Boss milestone: trigger screen shake + flash at 75%, 50%, 25%
  if (enemy.maxHp >= 500) {
    const pct = enemy.hp / enemy.maxHp;
    const prev = (enemy.hp + finalDmg) / enemy.maxHp;
    for (const threshold of [0.75, 0.5, 0.25]) {
      if (prev > threshold && pct <= threshold) {
        screenShakeDuration = 0.25;
        screenShakeIntensity = 5;
        spawnFloatingText(enemy.x, enemy.y - enemy.size - 20, threshold === 0.25 ? '⚠️ HP 25%!' : threshold === 0.5 ? '⚠️ HP 50%!' : '⚠️ HP 75%!', '#ff4444');
        sfxHpLoss();
        break;
      }
    }
  }
  // Critical hit: show golden popup immediately
  if (isCrit) {
    spawnFloatingText(enemy.x + (Math.random() - 0.5) * 12, enemy.y - enemy.size - 10, '💥 ' + finalDmg, '#ffd700', 16);
  }
  // Damage number popup (throttled: batch rapid hits within 200ms)
  const dmgNow = performance.now();
  if (!enemy._dmgAccum || dmgNow - enemy._dmgAccumStart > 200) {
    if (enemy._dmgAccum) {
      spawnFloatingText(enemy.x + (Math.random() - 0.5) * 10, enemy.y - enemy.size - 4, '-' + enemy._dmgAccum, isCrit ? '#ffd700' : '#ff4444');
    }
    enemy._dmgAccum = finalDmg;
    enemy._dmgAccumStart = dmgNow;
  } else {
    enemy._dmgAccum += finalDmg;
  }
  if (slowFactor < 1) {
    const wasNotSlowed = !(now < enemy.slowUntil);
    enemy.slowUntil = now + 1500;
    enemy._slowFactor = slowFactor;
    if (wasNotSlowed && slowFactor <= 0.35) {
      spawnFloatingText(enemy.x, enemy.y - 18, '❄ FROZEN', '#a0e8ff');
    } else if (wasNotSlowed) {
      spawnFloatingText(enemy.x, enemy.y - 18, '❄ SLOW', '#87ceeb');
    }
  }
  if (poisonDmgPerSec > 0) {
    // Apply poison: stack with existing if stronger
    const wasNotPoisoned = !enemy.poisonUntil || now >= enemy.poisonUntil;
    if (!enemy.poisonUntil || enemy.poisonDps < poisonDmgPerSec) {
      enemy.poisonDps = poisonDmgPerSec;
    }
    enemy.poisonUntil = now + 3000; // 3 second poison duration
    if (wasNotPoisoned) {
      spawnFloatingText(enemy.x, enemy.y - 18, '☠ POISON', '#39ff14');
    }
  }
  if (enemy.hp <= 0) {
    // Flush remaining damage accumulator on death
    if (enemy._dmgAccum) {
      spawnFloatingText(enemy.x, enemy.y - enemy.size - 4, '-' + enemy._dmgAccum, '#ff4444');
      enemy._dmgAccum = 0;
    }
    enemy.dead = true;
    gold += enemy.reward;
    score += enemy.score;
    waveEnemyKilled++;
    uiDirty = true;
    spawnDeathParticles(enemy.x, enemy.y, enemy.color);
    sfxEnemyDeath();
    onEnemyKilled(enemy.x, enemy.y, enemy.reward);
  }
}

// ============================================================
// PARTICLES
// ============================================================
function pushParticle(p) { if (p) particles.push(p); }

function spawnSpark(x, y, color) {
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 60;
    pushParticle(allocParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.3, 0.3, color, 2 + Math.random() * 2));
  }
}

function spawnExplosion(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const speed = 60 + Math.random() * 80;
    pushParticle(allocParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.6, 0.6, color, 4 + Math.random() * 4));
  }
}

function spawnDeathParticles(x, y, color) {
  for (let i = 0; i < 8; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 30 + Math.random() * 70;
    pushParticle(allocParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 50, 0.5, 0.5, color, 3 + Math.random() * 3));
  }
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 80 * dt; // gravity
    p.life -= dt;
  }
  recycleParticles();
}

// ============================================================
// INPUT HANDLING
// ============================================================
function onMouseMove(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  hoveredCell = { col: Math.floor(mx / TILE), row: Math.floor(my / TILE), mx, my };
}

function onCanvasClick(e) {
  if (gameOver) return;
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;
  const col = Math.floor(mx / TILE);
  const row = Math.floor(my / TILE);

  if (nukeBombMode) {
    dropNukeBomb(mx, my);
    return;
  }

  if (sellMode) {
    trySellTower(col, row);
    return;
  }

  if (selectedTowerType) {
    tryPlaceTower(col, row, selectedTowerType);
  } else {
    // Show tower info / upgrade shop if clicked on existing tower
    const t = towers.find(t => t.col === col && t.row === row);
    if (t) {
      selectedTower = t;
      showUpgradeShop(t);
    } else {
      selectedTower = null;
      hideUpgradeShop();
    }
  }
}

function tryPlaceTower(col, row, type) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const tile = MAP_LAYOUT[row][col];
  if (tile !== 0) return; // must be grass
  if (towers.find(t => t.col === col && t.row === row)) return; // occupied

  const def = TOWER_DEFS[type];
  if (def.premium && !isPremiumUnlocked(type)) {
    // Show purchase modal instead of placing
    showPurchaseModal(type);
    selectedTowerType = null;
    updateTowerButtons();
    return;
  }
  if (gold < def.cost) { flashGold(); return; }

  gold -= def.cost;
  sfxTowerPlace();
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  towers.push({
    ...def,
    _uid: _nextTowerId++,
    type,
    col, row, cx, cy,
    range: def.range,
    damage: def.damage,
    fireRate: def.fireRate,
    poisonDamage: def.poisonDamage || 0,
    cooldownLeft: 0,
    angle: 0,
    upgradeLevel: 0,   // number of upgrades applied
    totalSpent: def.cost,
    placedAt: performance.now(), // for placement animation
    targetingMode: 'first', // first|last|strong|close
    kills: 0,
    totalDmgDealt: 0,
  });
  uiDirty = true;
  updateUI();
}

function trySellTower(col, row) {
  const idx = towers.findIndex(t => t.col === col && t.row === row);
  if (idx === -1) return;
  // Use half of total spent (consistent with upgrade shop sell)
  delete stormVortexAngles[towers[idx]._uid];
  gold += Math.floor(towers[idx].totalSpent / 2);
  towers.splice(idx, 1);
  sfxTowerSell();
  uiDirty = true;
  updateUI();
}

function selectTower(type) {
  const def = TOWER_DEFS[type];
  if (def && def.premium && !isPremiumUnlocked(type)) {
    showPurchaseModal(type);
    return;
  }
  if (sellMode) setSellMode(); // turn off sell mode
  if (selectedTowerType === type) {
    selectedTowerType = null;
    clearTowerShopHint();
  } else {
    selectedTowerType = type;
    showTowerShopHint(type);
  }
  updateTowerButtons();
  hideTowerInfo();
}

function showTowerShopHint(type) {
  const def = TOWER_DEFS[type];
  if (!def) return;
  const aps = 1000 / def.fireRate;
  const dps = (def.damage * aps + (def.poisonDamage || 0)).toFixed(1);
  let hint = `⚡ DPS: ${dps}`;
  if (def.slowFactor < 1) hint += ` | 감속 ${Math.round((1-def.slowFactor)*100)}%`;
  if (def.aoeRadius > 0) hint += ` | AoE ${(def.aoeRadius/TILE).toFixed(1)}칸`;
  const el = document.getElementById('tower-shop-hint');
  if (el) { el.textContent = hint; el.style.display = ''; }
}

function clearTowerShopHint() {
  const el = document.getElementById('tower-shop-hint');
  if (el) el.style.display = 'none';
}

function setSellMode() {
  sellMode = !sellMode;
  if (sellMode) { selectedTowerType = null; nukeBombMode = false; }
  updateTowerButtons();
  updateNukeBombUI();
  const btn = document.getElementById('sell-btn');
  btn.classList.toggle('active', sellMode);
}

// ============================================================
// NUKE BOMB SKILL
// ============================================================
const NUKE_BOMB_COIN_COST = 500;   // 500 coins = 3 bombs
const NUKE_BOMB_DAMAGE    = 9999;  // effectively kills everything
const NUKE_BOMB_RADIUS    = TILE * 4.5; // huge AoE

function buyNukeBombCash() {
  // Simulated cash purchase: $1 = 3 bombs
  nukeBombs += 3;
  updateNukeBombUI();
  const notif = document.createElement('div');
  notif.className = 'unlock-notif';
  notif.textContent = `✅ 핵폭탄 3개 구매 완료! (총 ${nukeBombs}개)`;
  document.getElementById('game-container').appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function buyNukeBombCoin() {
  if (gold < NUKE_BOMB_COIN_COST) { flashGold(); return; }
  gold -= NUKE_BOMB_COIN_COST;
  nukeBombs += 3;
  updateUI();
  const notif = document.createElement('div');
  notif.className = 'unlock-notif';
  notif.textContent = `✅ 핵폭탄 3개 구매! (-💰${NUKE_BOMB_COIN_COST}, 총 ${nukeBombs}개)`;
  document.getElementById('game-container').appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

function toggleNukeBombMode() {
  if (nukeBombs <= 0) return;
  nukeBombMode = !nukeBombMode;
  if (nukeBombMode) {
    selectedTowerType = null;
    sellMode = false;
    updateTowerButtons();
    const btn = document.getElementById('sell-btn');
    if (btn) btn.classList.remove('active');
  }
  updateNukeBombUI();
}

function dropNukeBomb(mx, my) {
  if (nukeBombs <= 0) { nukeBombMode = false; updateNukeBombUI(); return; }
  nukeBombs--;
  nukeBombMode = false;

  // Deal damage to all enemies in radius (squared distance)
  const nukeRadSq = NUKE_BOMB_RADIUS * NUKE_BOMB_RADIUS;
  let killed = 0;
  for (const enemy of enemies) {
    if (enemy.dead || enemy.reached) continue;
    const dx = enemy.x - mx;
    const dy = enemy.y - my;
    if (dx * dx + dy * dy <= nukeRadSq) {
      dealDamage(enemy, NUKE_BOMB_DAMAGE, 1, 0);
      killed++;
    }
  }

  // Big nuclear explosion visual
  spawnNukeExplosion(mx, my);
  sfxNukeExplosion();

  // Strong screen shake
  screenShakeDuration = 0.4;
  screenShakeIntensity = 9;

  updateUI();
}

function sfxNukeExplosion() {
  if (soundMuted) return;
  // Deep rumble + high pitched flash
  playTone(50,  'square',   0.6, 0.6, 20);
  setTimeout(() => playTone(800, 'sawtooth', 0.3, 0.4, 100), 100);
  setTimeout(() => playTone(200, 'square',   0.5, 0.5, 30), 300);
}

function spawnNukeExplosion(x, y) {
  const nukeColors = ['#ff4500', '#ff8c00', '#ffff00', '#ff0000', '#fff700'];
  // Massive fireball particles
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 300;
    const color = nukeColors[Math.floor(Math.random() * nukeColors.length)];
    const life = 0.8 + Math.random() * 0.6;
    pushParticle(allocParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, life, 1.4, color, 6 + Math.random() * 12));
  }
  // Shockwave ring particles
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const speed = NUKE_BOMB_RADIUS / 0.5;
    pushParticle(allocParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 0.5, 0.5, '#ffffff', 5 + Math.random() * 5));
  }
  // Mushroom cloud smoke (rising)
  for (let i = 0; i < 20; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 20 + Math.random() * 60;
    const life = 1.2 + Math.random() * 0.4;
    pushParticle(allocParticle(x + (Math.random() - 0.5) * 40, y, Math.cos(angle) * speed * 0.3, -(120 + Math.random() * 80), life, 1.6, '#888', 12 + Math.random() * 16));
  }
}

function updateTowerButtons() {
  const HOTKEY_BADGE = { arrow:'1', cannon:'2', magic:'3', sniper:'4', poison:'5', laser:'6', storm:'7', gravity:'8' };
  for (const type of Object.keys(TOWER_DEFS)) {
    const btn = document.getElementById('btn-' + type);
    if (!btn) continue;
    const def = TOWER_DEFS[type];
    const locked = def.premium && !isPremiumUnlocked(type);
    btn.classList.toggle('selected', selectedTowerType === type);
    btn.classList.toggle('sell-mode', sellMode);
    btn.classList.toggle('not-affordable', !locked && gold < def.cost);
    btn.classList.toggle('premium-locked', locked);
    if (HOTKEY_BADGE[type] && !btn.querySelector('.hotkey-badge')) {
      const badge = document.createElement('span');
      badge.className = 'hotkey-badge';
      badge.textContent = HOTKEY_BADGE[type];
      badge.style.cssText = 'position:absolute;top:2px;left:3px;font-size:9px;color:#ffd700;font-weight:bold;opacity:0.75;pointer-events:none;';
      btn.style.position = 'relative';
      btn.appendChild(badge);
    }
  }
  if (!selectedTowerType) clearTowerShopHint();
}

function updatePremiumUI() {
  for (const type of PREMIUM_TOWER_TYPES) {
    const btn = document.getElementById('btn-' + type);
    if (!btn) continue;
    const locked = !isPremiumUnlocked(type);
    const lockEl = btn.querySelector('.premium-lock-badge');
    if (lockEl) lockEl.style.display = locked ? 'flex' : 'none';
    const priceEl = btn.querySelector('.tower-cost');
    if (priceEl) {
      const def = TOWER_DEFS[type];
      priceEl.textContent = locked ? `🔒 ${def.premiumPrice}` : `💰 ${def.cost}`;
    }
  }
}

function cycleTargetingMode(tower) {
  const modes = ['first', 'last', 'strong', 'close', 'weak'];
  const idx = modes.indexOf(tower.targetingMode || 'first');
  tower.targetingMode = modes[(idx + 1) % modes.length];
  showTowerInfo(tower); // refresh display
}

const TARGET_MODE_LABELS = { first: '⬆ 선두', last: '⬇ 후미', strong: '💪 강함', close: '📍 근접', weak: '💀 약함' };

function showTowerInfo(tower) {
  const el = document.getElementById('tower-selected-info');
  el.style.display = 'block';
  document.getElementById('selected-tower-name').textContent = TOWER_DEFS[tower.type].name;
  const modeLabel = TARGET_MODE_LABELS[tower.targetingMode || 'first'];
  const killInfo = (tower.kills || 0) > 0 ? `<br>💀 처치: ${tower.kills}마리` : '';
  document.getElementById('selected-tower-stats').innerHTML =
    `데미지: ${tower.damage}<br>사거리: ${(tower.range / TILE).toFixed(1)} 칸<br>공격속도: ${(1000 / tower.fireRate).toFixed(1)}/초<br>타겟팅: <span style="color:#ffd700;cursor:pointer;" onclick="cycleTargetingMode(window._selectedTower)">${modeLabel} 🔄</span><br>판매: 💰${tower.sellValue}${killInfo}`;
  window._selectedTower = tower;
}

function hideTowerInfo() {
  document.getElementById('tower-selected-info').style.display = 'none';
}

function showUpgradeShop(tower) {
  const def = TOWER_DEFS[tower.type];
  const shop = document.getElementById('upgrade-shop');
  const title = document.getElementById('upgrade-shop-title');
  const stats = document.getElementById('upgrade-shop-stats');
  const btnsContainer = document.getElementById('upgrade-shop-btns');
  const sellSpan = document.getElementById('upgrade-sell-value');

  title.textContent = `${def.emoji} ${def.name}`;

  const poisonInfo = tower.poisonDamage > 0 ? `<br>독 데미지: ${tower.poisonDamage}/초` : '';
  const slowInfo = tower.slowFactor < 1 ? `<br>감속: ${Math.round((1 - tower.slowFactor) * 100)}%` : '';
  const aoeInfo = tower.aoeRadius > 0 ? `<br>범위: ${(tower.aoeRadius / TILE).toFixed(1)} 칸` : '';
  const aps = 1000 / tower.fireRate;
  const dps = (tower.damage * aps + (tower.poisonDamage || 0)).toFixed(1);
  const killsInfo = (tower.kills || 0) > 0 ? ` | 💀 ${tower.kills}처치` : '';
  const totalDmg = tower.totalDamage || 0;
  const dmgStr = totalDmg >= 1000 ? `${(totalDmg / 1000).toFixed(1)}K` : totalDmg;
  const dmgInfo = totalDmg > 0 ? ` | 🔥 ${dmgStr}` : '';
  stats.innerHTML =
    `데미지: ${tower.damage}${poisonInfo}${slowInfo}${aoeInfo}<br>` +
    `사거리: ${(tower.range / TILE).toFixed(1)} 칸<br>` +
    `공격속도: ${aps.toFixed(1)}/초<br>` +
    `<span style="color:#00ff88;font-weight:bold;">⚡ DPS: ${dps}</span>${killsInfo}${dmgInfo}<br>` +
    `업그레이드: ${tower.upgradeLevel}/${def.upgrades.length}`;

  // Sell value: half of total spent
  const sv = Math.floor(tower.totalSpent / 2);
  sellSpan.textContent = sv;
  document.getElementById('upgrade-sell-btn').onclick = () => sellSelectedTower();

  // Build upgrade buttons
  btnsContainer.innerHTML = '';
  def.upgrades.forEach((upg, idx) => {
    const applied = tower.upgradeLevel > idx;
    const isNext = tower.upgradeLevel === idx;
    const canAfford = gold >= upg.cost;

    const btn = document.createElement('button');
    btn.className = 'upgrade-btn' +
      (applied ? ' applied' : '') +
      (isNext && !applied ? (canAfford ? '' : ' cant-afford') : '');
    btn.disabled = applied || (!isNext);
    btn.innerHTML =
      `<span class="upg-name">${upg.name}</span>` +
      `<span class="upg-desc">${upg.description}</span>` +
      (applied ? `<span class="upg-cost">✅ 완료</span>` : `<span class="upg-cost">💰 ${upg.cost}</span>`);
    if (isNext && !applied) {
      btn.onclick = () => applyUpgrade(tower, idx);
    }
    btnsContainer.appendChild(btn);
  });

  // Wire targeting mode buttons
  const tgtBtns = shop.querySelectorAll('.targeting-btn');
  tgtBtns.forEach(b => {
    b.classList.toggle('active', b.dataset.mode === (tower.targetingMode || 'first'));
    b.onclick = () => {
      tower.targetingMode = b.dataset.mode;
      tgtBtns.forEach(bb => bb.classList.toggle('active', bb === b));
    };
  });

  shop.style.display = 'block';
}

function hideUpgradeShop() {
  document.getElementById('upgrade-shop').style.display = 'none';
  selectedTower = null;
  window._selectedTower = null;
}

function applyUpgrade(tower, upgradeIdx) {
  const def = TOWER_DEFS[tower.type];
  const upg = def.upgrades[upgradeIdx];
  // Upgrade particle burst
  const burstColor = upgradeIdx >= 2 ? '#ffd700' : def.accentColor;
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2;
    const speed = 60 + Math.random() * 80;
    pushParticle(allocParticle(tower.cx, tower.cy,
      Math.cos(angle) * speed, Math.sin(angle) * speed,
      0.5 + Math.random() * 0.4, 0.9, burstColor, 3 + Math.random() * 3));
  }
  if (gold < upg.cost) { flashGold(); return; }
  if (tower.upgradeLevel !== upgradeIdx) return; // only apply in order

  gold -= upg.cost;
  tower.totalSpent += upg.cost;
  upg.apply(tower);
  tower.upgradeLevel++;
  tower.sellValue = Math.floor(tower.totalSpent / 2);
  sfxUpgrade();

  updateUI();
  showUpgradeShop(tower); // refresh shop display
}

function sellSelectedTower() {
  if (!selectedTower) return;
  const sv = Math.floor(selectedTower.totalSpent / 2);
  gold += sv;
  sfxTowerSell();
  delete stormVortexAngles[selectedTower._uid];
  const idx = towers.indexOf(selectedTower);
  if (idx !== -1) towers.splice(idx, 1);
  hideUpgradeShop();
  updateUI();
}

function flashGold() {
  const el = document.getElementById('gold-display');
  el.style.color = '#e74c3c';
  setTimeout(() => { el.style.color = ''; }, 400);
  sfxNotEnoughGold();
  // Shake the relevant button
  const target = selectedTowerType
    ? document.getElementById('btn-' + selectedTowerType)
    : document.getElementById('gold-display');
  if (target) {
    target.classList.remove('shake');
    void target.offsetWidth; // reflow to restart animation
    target.classList.add('shake');
    setTimeout(() => target.classList.remove('shake'), 400);
  }
}

function showPurchaseModal(type) {
  const def = TOWER_DEFS[type];
  if (!def) return;
  const modal = document.getElementById('purchase-modal');
  const title = document.getElementById('purchase-modal-title');
  const desc = document.getElementById('purchase-modal-desc');
  const price = document.getElementById('purchase-modal-price');
  const coinOption = document.getElementById('purchase-modal-coin-option');
  const coinBtn = document.getElementById('purchase-coin-btn');
  if (!modal) return;
  title.textContent = `${def.emoji} ${def.name}`;
  desc.textContent = def.premiumDesc || '';
  price.textContent = def.premiumPrice || '';
  modal.dataset.towerType = type;

  // Show coin purchase option if available
  if (coinOption && coinBtn && def.premiumCoinCost) {
    coinOption.style.display = 'block';
    const canAfford = gold >= def.premiumCoinCost;
    coinBtn.textContent = `💰 ${def.premiumCoinCost.toLocaleString()} 코인으로 구매`;
    coinBtn.disabled = !canAfford;
    coinBtn.style.background = canAfford ? '#ffd700' : '#666';
    coinBtn.style.color = canAfford ? '#000' : '#aaa';
    coinBtn.title = canAfford ? '' : `코인 부족 (보유: ${gold}, 필요: ${def.premiumCoinCost})`;
  } else if (coinOption) {
    coinOption.style.display = 'none';
  }

  modal.style.display = 'flex';
}

function closePurchaseModal() {
  const modal = document.getElementById('purchase-modal');
  if (modal) modal.style.display = 'none';
}

// Simulated purchase: in production, calls payment gateway
function confirmPurchase() {
  const modal = document.getElementById('purchase-modal');
  if (!modal) return;
  const type = modal.dataset.towerType;
  unlockPremiumTower(type);
  closePurchaseModal();
  updateTowerButtons();
  updatePremiumUI();
  // Show unlock notification
  const notif = document.createElement('div');
  notif.className = 'unlock-notif';
  notif.textContent = `✅ ${TOWER_DEFS[type].name} 잠금 해제!`;
  document.getElementById('game-container').appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// Coin-based purchase for premium towers
function confirmCoinPurchase() {
  const modal = document.getElementById('purchase-modal');
  if (!modal) return;
  const type = modal.dataset.towerType;
  const def = TOWER_DEFS[type];
  if (!def || !def.premiumCoinCost) return;
  if (gold < def.premiumCoinCost) { flashGold(); return; }
  gold -= def.premiumCoinCost;
  unlockPremiumTower(type);
  closePurchaseModal();
  updateTowerButtons();
  updatePremiumUI();
  updateUI();
  const notif = document.createElement('div');
  notif.className = 'unlock-notif';
  notif.textContent = `✅ ${def.name} 코인으로 잠금 해제! (-💰${def.premiumCoinCost.toLocaleString()})`;
  document.getElementById('game-container').appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// ============================================================
// UI UPDATE
// ============================================================
// Track previous values for dirty-flag UI (combo/kills)
let prevUiKills = -1, prevUiCombo = -1;
let prevWaveCountdownCeil = -1;
let prevWavePreviewKey = -2;

function updateUI() {
  // Only touch DOM elements whose values actually changed
  if (hp !== prevUiHp) {
    const hpEl = document.getElementById('hp-display');
    hpEl.textContent = hp;
    // Color HP display based on how low it is relative to max
    const diffSettings = DIFFICULTY_SETTINGS[gameDifficulty];
    const maxHp = diffSettings.maxHp || 20;
    const hpRatio = hp / maxHp;
    hpEl.style.color = hpRatio <= 0.2 ? '#e74c3c' : hpRatio <= 0.5 ? '#f39c12' : '';
    const hpMaxEl = document.getElementById('hp-max-display');
    if (hpMaxEl) hpMaxEl.textContent = ` /${maxHp}`;
    prevUiHp = hp;
  }
  if (gold !== prevUiGold) {
    document.getElementById('gold-display').textContent = gold;
    prevUiGold = gold;
    updateTowerButtons();
    updateNukeBombUI();
    if (gold >= 1000) checkAchievements();
  }
  if (currentWave !== prevUiWave) {
    document.getElementById('wave-display').textContent = `${currentWave}/${TOTAL_WAVES}`;
    prevUiWave = currentWave;
  }
  if (score !== prevUiScore) {
    document.getElementById('score-display').textContent = score;
    prevUiScore = score;
  }
  if (currentStage !== prevUiStage) {
    const stageEl = document.getElementById('stage-display');
    if (stageEl) stageEl.textContent = `${currentStage}/10`;
    const stageNameEl = document.getElementById('stage-name-display');
    if (stageNameEl) stageNameEl.textContent = STAGE_INFO[currentStage - 1]?.name || '';
    prevUiStage = currentStage;
    mapCacheDirty = true;
    updatePremiumUI();
  }

  // Kill count (only update on change)
  if (totalKills !== prevUiKills) {
    const killEl = document.getElementById('kill-display');
    if (killEl) killEl.textContent = totalKills;
    prevUiKills = totalKills;
  }

  // Wave countdown button label
  const cdCeil = waveCountdownActive ? Math.ceil(waveCountdown) : -1;
  if (cdCeil !== prevWaveCountdownCeil) {
    const startBtn = document.getElementById('start-wave-btn');
    if (startBtn) {
      if (waveCountdownActive) {
        startBtn.textContent = `⏳ ${cdCeil}초...`;
      } else if (!waveInProgress && currentWave < TOTAL_WAVES) {
        startBtn.textContent = '▶ 웨이브 시작';
      }
    }
    prevWaveCountdownCeil = cdCeil;
  }

  // Combo display (only update on change)
  if (comboCount !== prevUiCombo) {
    const comboEl = document.getElementById('combo-display');
    if (comboEl) {
      if (comboCount >= 5) {
        const mult = getComboMultiplier();
        comboEl.textContent = `🔥 ${comboCount}연속 (x${mult})`;
        comboEl.style.color = comboCount >= 20 ? '#ffd700' : comboCount >= 10 ? '#ff8c00' : '#00ff88';
      } else {
        comboEl.textContent = '';
      }
    }
    prevUiCombo = comboCount;
  }

  // Next wave enemy preview (only update when wave state changes)
  const previewKey = waveInProgress ? -1 : currentWave;
  if (previewKey !== prevWavePreviewKey) {
    const previewEl = document.getElementById('wave-preview');
    if (previewEl) {
      if (currentWave < TOTAL_WAVES && !waveInProgress) {
        previewEl.innerHTML = getNextWavePreview(currentWave);
        previewEl.style.display = '';
      } else {
        previewEl.style.display = 'none';
      }
    }
    prevWavePreviewKey = previewKey;
  }
}

function getNextWavePreview(waveIdx) {
  if (waveIdx >= WAVE_DEFS.length) return '';
  const waveDef = WAVE_DEFS[waveIdx];
  const ICONS = {
    basic:'👾', fast:'💨', tank:'🛡️', boss:'👹',
    elite:'⚔️', phantom:'👻', golem:'🗿', dragon:'🐉',
    wraith:'💀', titan:'🦾', hydra:'🐍',
    mech:'🤖', colossus:'🧱',
    deathknight:'⚰️', lich:'🧙',
    demon:'👺', behemoth:'🦏',
    voidbeast:'🌑', abomination:'🧟',
    apocalypse:'☄️', worldeater:'🌍',
    finalBoss:'👿',
  };
  const parts = waveDef.map(g => {
    const icon = ICONS[g.type] || '?';
    return `${icon}×${g.count}`;
  });
  const threat = getWaveThreatLevel(waveIdx);
  return `<span style="font-size:0.7em;color:#aaa;">다음 웨이브: </span>${parts.join(' ')} <span style="color:${threat.color};font-size:0.75em;font-weight:bold;">${threat.label}</span>`;
}

function updateNukeBombUI() {
  const countEl = document.getElementById('nuke-bomb-count');
  if (countEl) countEl.textContent = nukeBombs;
  const useBtn = document.getElementById('nuke-bomb-use-btn');
  if (useBtn) {
    if (nukeBombMode) {
      useBtn.textContent = '☢️ 폭탄 투하 중... (취소: 다시 클릭)';
      useBtn.style.background = '#ff4500';
    } else {
      useBtn.textContent = '☢️ 핵폭탄 투하 (클릭으로 지점 선택)';
      useBtn.style.background = nukeBombs > 0 ? '#8b0000' : '#333';
    }
    useBtn.disabled = nukeBombs <= 0 && !nukeBombMode;
  }
  const coinBtn = document.getElementById('nuke-bomb-buy-coin-btn');
  if (coinBtn) {
    coinBtn.disabled = gold < 500;
    coinBtn.style.background = gold >= 500 ? '#ff8c00' : '#555';
  }
}

function getScoreGrade(s, won) {
  if (!won) {
    if (s >= 50000) return { grade: 'B', color: '#4fc3f7' };
    if (s >= 20000) return { grade: 'C', color: '#aaa' };
    return { grade: 'D', color: '#888' };
  }
  if (s >= 300000) return { grade: 'S+', color: '#ffd700' };
  if (s >= 200000) return { grade: 'S',  color: '#ffd700' };
  if (s >= 120000) return { grade: 'A',  color: '#00ff88' };
  if (s >= 60000)  return { grade: 'B',  color: '#4fc3f7' };
  return { grade: 'C', color: '#aaa' };
}


// ── WAVE CLEAR CELEBRATION ──────────────────────────────────────────────
function spawnWaveClearCelebration(wave, bonusGold, interestGold) {
  const cx = canvas.width / 2;
  const cy = canvas.height * 0.22;
  const interestStr = (interestGold > 0) ? ' (+' + interestGold + '💵)' : '';
  spawnFloatingText(cx, cy, 'WAVE ' + wave + ' CLEAR!  +' + bonusGold + '💰' + interestStr, '#ffd700');
  const coinColors = ['#ffd700', '#ffec6e', '#ffe44d', '#ffbb00'];
  for (let i = 0; i < 14; i++) {
    const angle = -Math.PI * 0.8 + Math.random() * Math.PI * 1.6;
    const speed = 60 + Math.random() * 120;
    if (particles.length < MAX_PARTICLES) {
      particles.push({ x: cx + (Math.random()-0.5)*30, y: cy+10,
        vx: Math.cos(angle)*speed, vy: Math.sin(angle)*speed-30,
        life: 0.8 + Math.random()*0.5, maxLife: 1.3,
        color: coinColors[Math.floor(Math.random()*coinColors.length)],
        size: 3 + Math.random()*4 });
    }
  }
  sfxWaveStart();
}


// ── WAVE THREAT INDICATOR ────────────────────────────────────────────────────
function getWaveThreatLevel(waveIdx) {
  if (waveIdx >= WAVE_DEFS.length) return { level: 0, label: '', color: '#555' };
  const waveDef = WAVE_DEFS[waveIdx];
  const bossTypes = ['finalBoss','worldeater','abomination','behemoth','hydra','lich','colossus','dragon','titan','boss'];
  const eliteTypes = ['apocalypse','voidbeast','demon','deathknight','mech','wraith','phantom','golem','elite'];
  let score = 0;
  let totalCount = 0;
  for (const g of waveDef) {
    totalCount += g.count;
    if (bossTypes.includes(g.type)) score += g.count * 10;
    else if (eliteTypes.includes(g.type)) score += g.count * 3;
    else if (g.type === 'fast') score += g.count * 1.5;
    else if (g.type === 'tank') score += g.count * 2;
    else score += g.count;
  }
  if (score >= 80)  return { level: 5, label: '☠ 극한', color: '#ff0000' };
  if (score >= 40)  return { level: 4, label: '🔴 위험', color: '#ff4444' };
  if (score >= 20)  return { level: 3, label: '🟠 강함', color: '#ff8c00' };
  if (score >= 10)  return { level: 2, label: '🟡 보통', color: '#ffd700' };
  return            { level: 1, label: '🟢 쉬움', color: '#00ff88' };
}

function showOverlay(won) {
  stopBgm();
  const overlay = document.getElementById('overlay');
  overlay.style.display = 'flex';
  const { grade, color: gradeColor } = getScoreGrade(score, won);
  const gradeHTML = `<div id="score-grade" style="font-size:2.8em;font-weight:bold;color:${gradeColor};text-shadow:0 0 20px ${gradeColor};margin:6px 0;">${grade}</div>`;
  const diffTag = gameDifficulty === 'hard' ? ' <span style="color:#e94560;font-weight:bold;">[하드]</span>' : '';
  if (won) {
    document.getElementById('overlay-title').textContent = '🏆 최종 승리!';
    document.getElementById('overlay-title').style.color = '#ffd700';
    const { pb: pbWin } = savePersonalBest(score, currentWave, totalKills, maxCombo, true);
    const pbWinHTML = getPersonalBestHTML();
    const isNewBestWin = pbWin.bestScore === score ? ' <span style="color:#ffd700;font-size:0.8em">★ 최고기록!</span>' : '';
    document.getElementById('overlay-msg').innerHTML =
      `축하합니다! 10단계 ${TOTAL_WAVES}웨이브 클리어!${diffTag}<br>최종 ���수: ${score.toLocaleString()}${isNewBestWin}${gradeHTML}처치: ${totalKills}마리 | 최대 콤보: ${maxCombo}연속<br><small style="color:#aaa">업적: ${getAchievementProgressHTML()}</small>${pbWinHTML}`;
    sfxVictory();
    spawnVictoryFireworks();
  } else {
    document.getElementById('overlay-title').textContent = '💀 게임 오버';
    document.getElementById('overlay-title').style.color = '#e94560';
    const { pb: pbLose } = savePersonalBest(score, currentWave, totalKills, maxCombo, false);
    const pbLoseHTML = getPersonalBestHTML();
    document.getElementById('overlay-msg').innerHTML =
      `적이 성에 도달했습니다.${diffTag}<br>최종 점수: ${score.toLocaleString()} | 웨이브: ${currentWave} | ${currentStage}단계${gradeHTML}처��: ${totalKills}마리 | 최대 콤보: ${maxCombo}연속<br><small style="color:#aaa">업적: ${getAchievementProgressHTML()}</small>${pbLoseHTML}`;
    sfxGameOver();
  }
  // Submit score to server
  submitScore(won ? 'victory' : 'defeat');
}

// ── VICTORY FIREWORKS ────────────────────────────────────
function spawnVictoryFireworks() {
  const colors = ['#ffd700', '#ff4500', '#00ffff', '#ff00ff', '#00ff88', '#ff8c00', '#ffffff'];
  let count = 0;
  const maxBursts = 12;

  function burst() {
    if (count >= maxBursts || !gameOver) return;
    count++;
    const x = 50 + Math.random() * (canvas.width - 100);
    const y = 30 + Math.random() * (canvas.height * 0.6);
    const color = colors[Math.floor(Math.random() * colors.length)];
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const speed = 80 + Math.random() * 160;
      pushParticle(allocParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, 1.0 + Math.random() * 0.8, 1.8, color, 3 + Math.random() * 5));
    }
    // Screen flash
    screenShakeDuration = 0.1;
    screenShakeIntensity = 2;
    setTimeout(burst, 400 + Math.random() * 600);
  }
  burst();
}

function restartGame() {
  sessionStartTime = Date.now();
  resetGameState();
  updateUI();
}

// ============================================================
// RENDERING
// ============================================================
function render(timestamp) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Screen shake — use sine-based smooth shake instead of random jitter
  if (screenShakeDuration > 0) {
    const t = timestamp;
    const sx = Math.sin(t * 0.07) * screenShakeIntensity * (screenShakeDuration / 0.5);
    const sy = Math.cos(t * 0.09) * screenShakeIntensity * (screenShakeDuration / 0.5);
    ctx.save();
    ctx.translate(sx, sy);
  }

  // Draw map from offscreen cache (huge perf win)
  if (mapCacheDirty || mapCacheStage !== currentStage) {
    rebuildMapCache();
  }
  if (mapCacheCanvas) {
    ctx.drawImage(mapCacheCanvas, 0, 0);
  } else {
    drawMap();
    drawPathHighlight();
  }
  drawTowerRangePreview();
  drawTowers();
  drawEnemies();
  drawProjectiles();
  drawTeslaArcs();
  drawParticles();
  drawHoverCell();
  drawFloatingTexts();
  drawWaveCountdown();

  if (screenShakeDuration > 0) {
    ctx.restore();
  }

  // Wave progress + FPS overlay (drawn outside shake transform)
  drawEnemyTooltip();
  drawWaveProgress();
  drawSpeedIndicator();
  drawFps();
}

function drawSpeedIndicator() {
  if (speedMultiplier <= 1) return;
  const now = performance.now();
  const pulse = 0.7 + 0.3 * Math.sin(now / 200);
  ctx.save();
  ctx.globalAlpha = pulse;
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = '#ff8c00';
  ctx.shadowBlur = 12;
  ctx.fillText('⏩ 2x', 8, 48);
  ctx.restore();
}

function drawFloatingTexts() {
  for (const ft of floatingTexts) {
    const alpha = ft.life / ft.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${ft.size || 13}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 6;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.restore();
  }
}

function drawWaveCountdown() {
  if (!waveCountdownActive || waveCountdown <= 0) return;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const secs = Math.ceil(waveCountdown);

  // Spawn point warning pulse
  if (PATH_WAYPOINTS.length > 0) {
    const sp = PATH_WAYPOINTS[0];
    const blink = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 200));
    ctx.save();
    ctx.globalAlpha = blink * 0.8;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, TILE * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#ff2200';
    ctx.fill();
    ctx.globalAlpha = blink;
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('!', sp.x, sp.y);
    ctx.restore();
  }
  // frac: how far through this second (1=just ticked, 0=about to tick)
  const frac = waveCountdown - Math.floor(waveCountdown); // 0..1
  const scale = 1 + frac * 0.5; // 1.5x at tick, shrinks to 1x as second ends
  const alpha = 0.5 + frac * 0.5; // fade in at each tick
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.font = `bold ${TILE * 2}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = secs <= 1 ? '#ff4444' : '#ffd700';
  ctx.shadowColor = secs <= 1 ? '#ff0000' : '#ff8c00';
  ctx.shadowBlur = 30;
  ctx.fillText(secs.toString(), 0, 0);
  ctx.restore();
}

// Rebuild the static map cache to an offscreen canvas
function rebuildMapCache() {
  if (!mapCacheCanvas) {
    mapCacheCanvas = document.createElement('canvas');
  }
  mapCacheCanvas.width = COLS * TILE;
  mapCacheCanvas.height = ROWS * TILE;
  const mctx = mapCacheCanvas.getContext('2d');
  // Temporarily swap ctx so drawMap/drawPathHighlight render to cache
  const origCtx = ctx;
  ctx = mctx;
  drawMap();
  drawPathHighlight();
  ctx = origCtx;
  mapCacheDirty = false;
  mapCacheStage = currentStage;
}

// Seeded pseudo-random for deterministic tile decoration
function tileRand(col, row, seed) {
  let h = (col * 374761393 + row * 668265263 + seed * 2246822519) >>> 0;
  h ^= h >> 13; h = Math.imul(h, 1540483477); h ^= h >> 15;
  return (h >>> 0) / 0xffffffff;
}

function drawMap() {
  const stageData = STAGE_INFO[currentStage - 1] || STAGE_INFO[0];
  const stage = currentStage;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const tile = MAP_LAYOUT[r][c];
      const x = c * TILE;
      const y = r * TILE;
      if (tile === 0) {
        drawGrassTile(x, y, c, r, stageData, stage);
      } else if (tile === 1) {
        drawPathTile(x, y, c, r, stageData, stage);
      } else if (tile === 2) {
        drawPathTile(x, y, c, r, stageData, stage);
        // Start marker — bright glowing flag
        ctx.save();
        ctx.shadowColor = '#27ae60';
        ctx.shadowBlur = 12;
        ctx.font = `${TILE * 0.62}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('⚑', x + TILE / 2, y + TILE / 2);
        ctx.restore();
      } else if (tile === 3) {
        drawPathTile(x, y, c, r, stageData, stage);
        // End / castle marker — glowing castle
        ctx.save();
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 18;
        ctx.font = `${TILE * 0.68}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🏰', x + TILE / 2, y + TILE / 2);
        ctx.restore();
      }
    }
  }
}

// Stage-specific grass accent colors (lighter blade/detail color)
const GRASS_ACCENT = [
  '#3a7a20','#243e24','#5a3e28','#2a3d55','#5c2800',
  '#3d0000','#2e0035','#001428','#2e1400','#181818',
];
// Stage-specific path edge/shadow colors
const PATH_EDGE = [
  '#a08040','#6b5210','#7a3a1a','#2a5a8a','#6a1800',
  '#6a0000','#360060','#10104a','#6a3000','#101010',
];

function drawGrassTile(x, y, col, row, stageData, stage) {
  const baseColor = stageData.grassColor;
  const accentColor = GRASS_ACCENT[stage - 1] || GRASS_ACCENT[0];

  // Base fill
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y, TILE, TILE);

  // Subtle radial gradient highlight (top-left light source)
  const grad = ctx.createRadialGradient(x + TILE * 0.35, y + TILE * 0.3, 0, x + TILE / 2, y + TILE / 2, TILE * 0.75);
  grad.addColorStop(0, 'rgba(255,255,255,0.07)');
  grad.addColorStop(1, 'rgba(0,0,0,0.18)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, TILE, TILE);

  // Stage-specific terrain decoration
  ctx.save();
  ctx.globalAlpha = 0.55;
  const r1 = tileRand(col, row, 1);
  const r2 = tileRand(col, row, 2);
  const r3 = tileRand(col, row, 3);

  if (stage <= 2) {
    // Grass blades
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.2;
    const bladeCount = 3 + Math.floor(r1 * 3);
    for (let i = 0; i < bladeCount; i++) {
      const bx = x + 4 + tileRand(col, row, 10 + i) * (TILE - 8);
      const by = y + 8 + tileRand(col, row, 20 + i) * (TILE - 16);
      const h = 5 + tileRand(col, row, 30 + i) * 7;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.quadraticCurveTo(bx + 3, by - h * 0.5, bx + (r2 > 0.5 ? 2 : -2), by - h);
      ctx.stroke();
    }
  } else if (stage <= 4) {
    // Rocky terrain — small pebbles
    if (r1 < 0.35) {
      ctx.fillStyle = accentColor;
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 2; i++) {
        const px = x + 6 + tileRand(col, row, 40 + i) * (TILE - 12);
        const py = y + 6 + tileRand(col, row, 50 + i) * (TILE - 12);
        const pr = 2 + tileRand(col, row, 60 + i) * 4;
        ctx.beginPath();
        ctx.ellipse(px, py, pr, pr * 0.65, r2 * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (stage <= 6) {
    // Embers / scorched marks
    if (r1 < 0.3) {
      ctx.fillStyle = r2 > 0.5 ? '#ff4500' : '#ff8c00';
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.arc(x + 8 + r2 * (TILE - 16), y + 8 + r3 * (TILE - 16), 2 + r1 * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // Void cracks / starfield
    if (r1 < 0.25) {
      ctx.strokeStyle = stage >= 9 ? '#ff0040' : '#9966ff';
      ctx.lineWidth = 0.8;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.moveTo(x + r1 * TILE, y + r2 * TILE);
      ctx.lineTo(x + r3 * TILE, y + tileRand(col, row, 70) * TILE);
      ctx.stroke();
    }
  }
  ctx.restore();

  // Very subtle grid border
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x, y, TILE, TILE);
}

function drawPathTile(x, y, col, row, stageData, stage) {
  const baseColor = stageData.pathColor;
  const edgeColor = PATH_EDGE[stage - 1] || PATH_EDGE[0];

  // Base path color
  ctx.fillStyle = baseColor;
  ctx.fillRect(x, y, TILE, TILE);

  // Inner gradient — sunken path look
  const grad = ctx.createLinearGradient(x, y, x + TILE, y + TILE);
  grad.addColorStop(0, 'rgba(255,255,255,0.08)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.0)');
  grad.addColorStop(1, 'rgba(0,0,0,0.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, TILE, TILE);

  // Path surface texture
  ctx.save();
  ctx.globalAlpha = 0.45;

  if (stage <= 3) {
    // Dirt/gravel stones
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const lx = x + 7 + i * 13 + tileRand(col, row, 5 + i) * 4;
      const ly1 = y + 4 + tileRand(col, row, 15 + i) * 5;
      const ly2 = y + TILE - 4 - tileRand(col, row, 25 + i) * 5;
      ctx.beginPath();
      ctx.moveTo(lx, ly1);
      ctx.lineTo(lx + tileRand(col, row, 35 + i) * 6 - 3, ly2);
      ctx.stroke();
    }
    // Pebbles
    ctx.fillStyle = edgeColor;
    ctx.globalAlpha = 0.25;
    for (let i = 0; i < 2; i++) {
      const pr = 1.5 + tileRand(col, row, 45 + i) * 2.5;
      const px = x + 5 + tileRand(col, row, 55 + i) * (TILE - 10);
      const py = y + 5 + tileRand(col, row, 65 + i) * (TILE - 10);
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.65, tileRand(col, row, 75 + i) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (stage <= 6) {
    // Stone slabs with cracks
    ctx.strokeStyle = edgeColor;
    ctx.lineWidth = 0.8;
    // Main slab lines
    ctx.beginPath();
    ctx.moveTo(x + TILE * 0.33, y + 2);
    ctx.lineTo(x + TILE * 0.33, y + TILE - 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + TILE * 0.67, y + 2);
    ctx.lineTo(x + TILE * 0.67, y + TILE - 2);
    ctx.stroke();
    // Horizontal crack
    if (tileRand(col, row, 80) > 0.5) {
      ctx.beginPath();
      ctx.moveTo(x + 3, y + TILE * 0.5);
      ctx.lineTo(x + TILE - 3, y + TILE * 0.5 + (tileRand(col, row, 85) - 0.5) * 6);
      ctx.stroke();
    }
  } else {
    // Dark energy / void paving
    ctx.strokeStyle = stage >= 9 ? 'rgba(255,0,64,0.5)' : 'rgba(150,0,255,0.45)';
    ctx.lineWidth = 0.7;
    // Hexagonal-ish pattern
    for (let i = 0; i < 2; i++) {
      const cx2 = x + TILE * (0.25 + i * 0.5);
      const cy2 = y + TILE / 2;
      const r = TILE * 0.2;
      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const angle = (a / 6) * Math.PI * 2 - Math.PI / 6;
        const px = cx2 + Math.cos(angle) * r;
        const py = cy2 + Math.sin(angle) * r;
        a === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();

  // Inset border edge shadow
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, TILE - 1.5, TILE - 1.5);
}

function drawPathHighlight() {
  // Subtle path highlight
  ctx.strokeStyle = 'rgba(255,220,100,0.15)';
  ctx.lineWidth = TILE * 0.8;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  PATH_WAYPOINTS.forEach((pt, i) => {
    if (i === 0) ctx.moveTo(pt.x, pt.y);
    else ctx.lineTo(pt.x, pt.y);
  });
  ctx.stroke();

  // Direction arrows along the path
  const arrowSpacing = TILE * 2.5;
  let travelled = 0;
  for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
    const prev = PATH_WAYPOINTS[i - 1];
    const cur = PATH_WAYPOINTS[i];
    const sdx = cur.x - prev.x;
    const sdy = cur.y - prev.y;
    const segLen = Math.sqrt(sdx * sdx + sdy * sdy);
    if (segLen === 0) continue;
    const ux = sdx / segLen, uy = sdy / segLen;
    let d = arrowSpacing - (travelled % arrowSpacing);
    while (d < segLen) {
      const ax = prev.x + ux * d;
      const ay = prev.y + uy * d;
      const angle = Math.atan2(uy, ux);
      const sz = TILE * 0.22;
      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(sz, 0);
      ctx.lineTo(-sz * 0.6, -sz * 0.7);
      ctx.lineTo(-sz * 0.6, sz * 0.7);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,220,100,0.25)';
      ctx.fill();
      ctx.restore();
      d += arrowSpacing;
    }
    travelled += segLen;
  }
}

function drawTowerRangePreview() {
  if (!hoveredCell || !selectedTowerType || sellMode) return;
  const { col, row } = hoveredCell;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
  const tile = MAP_LAYOUT[row][col];
  if (tile !== 0) return;
  if (towers.find(t => t.col === col && t.row === row)) return;
  const def = TOWER_DEFS[selectedTowerType];
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  ctx.beginPath();
  ctx.arc(cx, cy, def.range, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawHoverCell() {
  if (!hoveredCell) return;
  const { col, row } = hoveredCell;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

  // Nuke bomb targeting reticle
  if (nukeBombMode) {
    const cx = col * TILE + TILE / 2;
    const cy = row * TILE + TILE / 2;
    // Danger zone circle
    ctx.beginPath();
    ctx.arc(cx, cy, NUKE_BOMB_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,50,0,0.12)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,80,0,0.7)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Crosshair
    ctx.strokeStyle = 'rgba(255,200,0,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy);
    ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,50,0,0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  const tile = MAP_LAYOUT[row][col];
  const x = col * TILE;
  const y = row * TILE;
  const hasTower = towers.find(t => t.col === col && t.row === row);
  if (tile === 0 && !hasTower && selectedTowerType && !sellMode) {
    const def = TOWER_DEFS[selectedTowerType];
    const canAfford = gold >= def.cost;
    ctx.fillStyle = canAfford ? 'rgba(100,200,100,0.3)' : 'rgba(200,50,50,0.3)';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = canAfford ? 'rgba(100,255,100,0.8)' : 'rgba(255,80,80,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  } else if (hasTower && sellMode) {
    ctx.fillStyle = 'rgba(255,100,0,0.3)';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = 'rgba(255,140,0,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  }
}

function drawTowers() {
  for (const tower of towers) {
    const def = TOWER_DEFS[tower.type];
    const x = tower.col * TILE;
    const y = tower.row * TILE;
    const cx = tower.cx;
    const cy = tower.cy;

    const now = performance.now();

    // Placement pulse animation (first 600ms after placement)
    if (tower.placedAt) {
      const elapsed = now - tower.placedAt;
      if (elapsed < 600) {
        const t = elapsed / 600;
        const radius = TILE * 0.5 + t * TILE * 1.2;
        ctx.globalAlpha = (1 - t) * 0.5;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.strokeStyle = def.accentColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.globalAlpha = 1;
      } else {
        tower.placedAt = 0;
      }
    }

    // Hovered tower range preview (dim, no fill)
    if (tower !== selectedTower && hoveredCell && hoveredCell.mx !== undefined) {
      const dx = hoveredCell.mx - cx, dy = hoveredCell.my - cy;
      if (dx * dx + dy * dy <= TILE * TILE * 0.36) {
        ctx.beginPath();
        ctx.arc(cx, cy, tower.range, 0, Math.PI * 2);
        ctx.strokeStyle = def.accentColor + '55';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Selected tower range indicator
    if (tower === selectedTower) {
      // Check if any enemy is currently in range
      const rangeSq = tower.range * tower.range;
      const hasTarget = enemies.some(e => !e.dead && !e.reached &&
        (e.x - cx) * (e.x - cx) + (e.y - cy) * (e.y - cy) <= rangeSq);
      ctx.beginPath();
      ctx.arc(cx, cy, tower.range, 0, Math.PI * 2);
      const pulse = 0.08 + 0.04 * Math.sin(now / 300);
      ctx.fillStyle = hasTarget ? `rgba(100,255,120,${pulse})` : `rgba(255,255,255,${pulse})`;
      ctx.fill();
      ctx.strokeStyle = hasTarget ? '#44ff66' : def.accentColor + '66';
      ctx.lineWidth = hasTarget ? 2 : 1.5;
      ctx.stroke();
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, y + TILE - 4, TILE * 0.38, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Base platform
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.roundRect(x + 6, y + 6, TILE - 12, TILE - 12, 4);
    ctx.fill();

    // Tower body
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, TILE - 20, TILE - 20, 4);
    ctx.fill();

    // Accent border
    ctx.strokeStyle = def.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x + 10, y + 10, TILE - 20, TILE - 20, 4);
    ctx.stroke();

    // Barrel/gun pointing at last target
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(tower.angle);
    ctx.fillStyle = def.accentColor;
    ctx.fillRect(0, -3, TILE * 0.35, 6);
    ctx.restore();

    // ── PHASE 3: Tower-specific ambient effects ──
    if (tower.type === 'storm') {
      // Spinning vortex halo: 6 small dots orbiting the tower
      const tUid = tower._uid;
      if (stormVortexAngles[tUid] === undefined) stormVortexAngles[tUid] = 0;
      stormVortexAngles[tUid] += 0.04;
      const vAngle = stormVortexAngles[tUid];
      const vRadius = TILE * 0.38;
      for (let vi = 0; vi < 6; vi++) {
        const va = vAngle + (vi / 6) * Math.PI * 2;
        const vx = cx + Math.cos(va) * vRadius;
        const vy = cy + Math.sin(va) * vRadius;
        const vAlpha = 0.4 + 0.3 * Math.sin(vAngle * 3 + vi);
        ctx.globalAlpha = vAlpha;
        ctx.beginPath();
        ctx.arc(vx, vy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#87ceeb';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (tower.type === 'poison') {
      // Pulsing poison cloud: semi-transparent green ring showing AoE
      const cloudPulse = 0.05 + 0.03 * Math.sin(now / 400);
      ctx.globalAlpha = cloudPulse;
      ctx.beginPath();
      ctx.arc(cx, cy, tower.aoeRadius || TILE * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#39ff14';
      ctx.fill();
      ctx.globalAlpha = 0.25;
      ctx.beginPath();
      ctx.arc(cx, cy, tower.aoeRadius || TILE * 0.5, 0, Math.PI * 2);
      ctx.strokeStyle = '#39ff14';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // ── God tower divine aura ──
    if (tower.type === 'god') {
      const godAngle = now / 1800;
      for (let ring = 0; ring < 3; ring++) {
        const rAngle = godAngle + (ring / 3) * Math.PI * 2;
        const hue = ((now / 30 + ring * 120) % 360);
        ctx.globalAlpha = 0.18 - ring * 0.04;
        ctx.beginPath();
        ctx.arc(cx, cy, TILE * 0.55 + ring * 4, rAngle, rAngle + Math.PI * 1.5);
        ctx.strokeStyle = 'hsl(' + hue + ',100%,70%)';
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      const divPulse = 0.06 + 0.04 * Math.sin(now / 500);
      ctx.globalAlpha = divPulse;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 0.68, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // ── UPGRADE VISUAL DIFFERENTIATION ──
    if (tower.upgradeLevel >= 1) {
      ctx.strokeStyle = def.accentColor;
      ctx.lineWidth = tower.upgradeLevel >= 2 ? 3.5 : 2.5;
      if (tower.upgradeLevel >= 2) { ctx.shadowColor = def.accentColor; ctx.shadowBlur = 10; }
      ctx.beginPath();
      ctx.roundRect(x + 10, y + 10, TILE - 20, TILE - 20, 4);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    if (tower.upgradeLevel >= 3) {
      const sparkAngle = now / 600;
      for (let s = 0; s < 8; s++) {
        const sa = sparkAngle + (s / 8) * Math.PI * 2;
        const sx2 = cx + Math.cos(sa) * TILE * 0.42;
        const sy2 = cy + Math.sin(sa) * TILE * 0.42;
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(sparkAngle * 4 + s);
        ctx.beginPath();
        ctx.arc(sx2, sy2, 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffd700';
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Upgrade level indicator (pips with level-based colors)
    if (tower.upgradeLevel > 0) {
      for (let u = 0; u < tower.upgradeLevel; u++) {
        const ux = cx - (tower.upgradeLevel - 1) * 4 + u * 8;
        const uy = y + TILE - 7;
        const pipColor = tower.upgradeLevel >= 3 ? '#ffd700' : tower.upgradeLevel >= 2 ? def.accentColor : '#aaaaaa';
        ctx.beginPath();
        ctx.arc(ux, uy, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = pipColor;
        ctx.fill();
      }
    }

    // Emoji icon
    ctx.font = `${TILE * 0.45}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(def.emoji, cx, cy);
  }
}

// Enemy tier: 3=boss, 2=elite, 1=stage2+, 0=basic
function getEnemyTier(type) {
  const bosses = ['finalBoss','worldeater','abomination','behemoth','hydra','lich','colossus','dragon','titan','boss'];
  if (bosses.includes(type)) return 3;
  const elites = ['apocalypse','voidbeast','demon','deathknight','mech','wraith','phantom','golem','elite'];
  if (elites.includes(type)) return 2;
  const def = ENEMY_DEFS[type];
  if (def && def.stage && def.stage >= 2) return 1;
  return 0;
}

const ENEMY_INNER = {
  basic:'#ff9999', fast:'#ffcc77', tank:'#cc99ff', boss:'#ff7777',
  elite:'#88bbff', phantom:'#99ffee', golem:'#dddddd', dragon:'#ffbb66',
  wraith:'#cc99ff', titan:'#bbbbdd', hydra:'#55ffdd',
  mech:'#bbddff', colossus:'#9999aa',
  deathknight:'#bb99ff', lich:'#eeccff',
  demon:'#ff8888', behemoth:'#ffbb99',
  voidbeast:'#cc99ff', abomination:'#99ffcc',
  apocalypse:'#ffeedd', worldeater:'#ff99bb',
  finalBoss:'#ffdddd',
};

function shadeColor(hex, amt) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, Math.min(255, (n >> 16) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
  const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
  return `rgb(${r},${g},${b})`;
}

// Pre-computed tier cache to avoid repeated array.includes() each frame
const _enemyTierCache = {};
function getEnemyTierCached(type) {
  if (_enemyTierCache[type] === undefined) _enemyTierCache[type] = getEnemyTier(type);
  return _enemyTierCache[type];
}
// Reusable draw list to avoid allocation each frame
const _drawList = [];

function drawEnemies() {
  const now = performance.now();
  // Reuse draw list to avoid allocating a new array each frame
  _drawList.length = 0;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e.dead && !e.reached) _drawList.push(e);
  }
  _drawList.sort((a, b) => getEnemyTierCached(a.type) - getEnemyTierCached(b.type));

  for (const enemy of _drawList) {
    const slowed = now < enemy.slowUntil;
    const poisoned = enemy.poisonUntil && now < enemy.poisonUntil;
    const tier = getEnemyTier(enemy.type);
    const { x, y, size, color, hp: ehp, maxHp } = enemy;
    const hpRatio = ehp / maxHp;
    const eid = enemy.id || 0;

    // --- Final Boss: rotating fire ring ---
    if (enemy.type === 'finalBoss') {
      ctx.save();
      const ringCount = 6;
      const ringRadius = size + 20;
      const rotSpeed = now / 600;
      for (let i = 0; i < ringCount; i++) {
        const angle = rotSpeed + (i / ringCount) * Math.PI * 2;
        const fx = x + Math.cos(angle) * ringRadius;
        const fy = y + Math.sin(angle) * ringRadius;
        const fireGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, 8);
        fireGrad.addColorStop(0, '#ffff00');
        fireGrad.addColorStop(0.5, '#ff4400');
        fireGrad.addColorStop(1, '#ff000000');
        ctx.beginPath();
        ctx.arc(fx, fy, 8, 0, Math.PI * 2);
        ctx.fillStyle = fireGrad;
        ctx.fill();
      }
      // Speed boost visual: outer lightning ring
      if (enemy.speedBoosting) {
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.arc(x, y, size + 28, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      // Regen visual: green shimmer when regenerating
      if (enemy.regen && enemy.hp < enemy.maxHp) {
        const regenPulse = 0.3 + 0.3 * Math.sin(now / 200);
        ctx.beginPath();
        ctx.arc(x, y, size + 5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(50, 255, 50, ${regenPulse})`;
        ctx.fill();
      }
      ctx.restore();
    }

    // --- Pulsing outer aura (tier 1+) ---
    if (tier >= 1) {
      const pulse = 0.5 + 0.5 * Math.sin(now / 350 + eid * 1.3);
      const auraR = size + 4 + pulse * (tier >= 3 ? 10 : tier === 2 ? 6 : 3);
      const auraGrad = ctx.createRadialGradient(x, y, size * 0.5, x, y, auraR);
      auraGrad.addColorStop(0, color + '55');
      auraGrad.addColorStop(1, color + '00');
      ctx.beginPath();
      ctx.arc(x, y, auraR, 0, Math.PI * 2);
      ctx.fillStyle = auraGrad;
      ctx.fill();
    }

    // Boss double ring (+ extra ring for finalBoss)
    if (tier >= 3) {
      const pulse2 = 0.5 + 0.5 * Math.sin(now / 200 + eid * 0.7 + Math.PI);
      ctx.beginPath();
      ctx.arc(x, y, size + 12 + pulse2 * 8, 0, Math.PI * 2);
      ctx.strokeStyle = color + '55';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, size + 7, 0, Math.PI * 2);
      ctx.strokeStyle = color + '88';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (enemy.type === 'finalBoss') {
        const pulse3 = 0.5 + 0.5 * Math.sin(now / 150 + eid * 0.5);
        ctx.beginPath();
        ctx.arc(x, y, size + 18 + pulse3 * 12, 0, Math.PI * 2);
        ctx.strokeStyle = '#ff440088';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // --- Shadow ---
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.85, size * 0.75, size * 0.28, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.fill();

    // --- Body with radial gradient ---
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    let coreColor = color;
    let hlColor = ENEMY_INNER[enemy.type] || '#ffffff';
    if (poisoned) { coreColor = '#39ff14'; hlColor = '#aaffaa'; }
    else if (slowed) { coreColor = '#9b59b6'; hlColor = '#ddaaff'; }

    const bodyGrad = ctx.createRadialGradient(
      x - size * 0.3, y - size * 0.3, size * 0.05,
      x, y, size
    );
    bodyGrad.addColorStop(0, hlColor);
    bodyGrad.addColorStop(0.5, coreColor);
    bodyGrad.addColorStop(1, shadeColor(coreColor, -55));
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // --- Hit flash overlay ---
    if (enemy._hitFlashUntil && now < enemy._hitFlashUntil) {
      const flashAlpha = (enemy._hitFlashUntil - now) / 80;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${(0.45 * flashAlpha).toFixed(2)})`;
      ctx.fill();
    }

    // --- Outline ---
    const outlineC = poisoned ? '#00ff00' : slowed ? '#da70d6' :
      tier >= 3 ? 'rgba(255,255,255,0.8)' : tier >= 2 ? color : 'rgba(255,255,255,0.4)';
    ctx.strokeStyle = outlineC;
    ctx.lineWidth = tier >= 3 ? 3 : tier >= 2 ? 2.5 : tier >= 1 ? 2 : 1.5;
    ctx.stroke();

    // --- Specular highlight ---
    ctx.beginPath();
    ctx.arc(x - size * 0.28, y - size * 0.3, size * 0.27, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fill();

    // --- Frost crystal overlay (deep slow ≤0.35 slowFactor) ---
    if (slowed && enemy._slowFactor !== undefined && enemy._slowFactor <= 0.35) {
      const remaining = (enemy.slowUntil - now) / 1500; // 0..1 freshness
      const iceAlpha = Math.min(0.55, remaining * 0.6);
      ctx.globalAlpha = iceAlpha;
      // 6-pointed snowflake arms
      ctx.save();
      ctx.translate(x, y);
      ctx.strokeStyle = '#a0e8ff';
      ctx.lineWidth = 1.2;
      for (let arm = 0; arm < 6; arm++) {
        ctx.save();
        ctx.rotate((arm / 6) * Math.PI * 2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, size * 0.85);
        ctx.moveTo(0, size * 0.35);
        ctx.lineTo(-size * 0.18, size * 0.53);
        ctx.moveTo(0, size * 0.35);
        ctx.lineTo(size * 0.18, size * 0.53);
        ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }


    // --- Enemy name label (boss & elite) ---
    if (tier >= 2) {
      const def = ENEMY_DEFS[enemy.type];
      const label = def ? (def.name || enemy.type) : enemy.type;
      ctx.save();
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      const barY2 = y - size - 12;
      ctx.fillStyle = tier >= 3 ? '#ff4444' : '#88bbff';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 3;
      ctx.fillText(label, x, barY2);
      ctx.restore();
    }
    // --- Enemy icon ---
    ctx.save();
    const ICONS = {
      basic:'👾', fast:'💨', tank:'🛡️', boss:'👹',
      elite:'⚔️', phantom:'👻', golem:'🗿', dragon:'🐉',
      wraith:'💀', titan:'🦾', hydra:'🐍',
      mech:'🤖', colossus:'🧱',
      deathknight:'⚰️', lich:'🧙',
      demon:'👺', behemoth:'🦏',
      voidbeast:'🌑', abomination:'🧟',
      apocalypse:'☄️', worldeater:'🌍',
      finalBoss:'👿',
    };
    const icon = ICONS[enemy.type] || '★';
    const iconSz = tier >= 3 ? size * 1.0 : tier >= 2 ? size * 0.95 : size * 0.82;
    if (tier >= 3) { ctx.shadowColor = color; ctx.shadowBlur = 14; }
    ctx.font = `${iconSz}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);
    ctx.restore();

    // Boss crown / elite star
    if (tier >= 3) {
      ctx.save();
      ctx.font = `${size * 0.55}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 12;
      ctx.fillText('👑', x, y - size - 5);
      ctx.restore();
    } else if (tier === 2) {
      ctx.save();
      ctx.font = `bold ${size * 0.42}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd700';
      ctx.shadowColor = '#ffd700';
      ctx.shadowBlur = 6;
      ctx.fillText('★', x + size * 0.68, y - size * 0.68);
      ctx.restore();
    }

    // --- Final Boss name label ---
    if (enemy.type === 'finalBoss') {
      ctx.save();
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ff4444';
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 8;
      ctx.fillText('⚠ 파이널 보스 ⚠', x, y - size - 28);
      ctx.restore();
    }

    // --- HP bar (premium styled) ---
    const barW = Math.max(size * 2 + 8, enemy.type === 'finalBoss' ? 100 : tier >= 3 ? 72 : tier >= 2 ? 50 : 38);
    const barH = enemy.type === 'finalBoss' ? 10 : tier >= 3 ? 8 : tier >= 2 ? 6 : 5;
    const barX = x - barW / 2;
    const barY = y - size - (enemy.type === 'finalBoss' ? 22 : tier >= 3 ? 18 : 13);

    ctx.fillStyle = '#111';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(barX, barY, barW, barH);

    const hpC1 = hpRatio > 0.6 ? '#2ecc71' : hpRatio > 0.3 ? '#f39c12' : '#e74c3c';
    const hpC2 = hpRatio > 0.6 ? '#27ae60' : hpRatio > 0.3 ? '#e67e22' : '#c0392b';
    const hpGrad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    hpGrad.addColorStop(0, hpC1);
    hpGrad.addColorStop(1, hpC2);
    ctx.fillStyle = hpGrad;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW * hpRatio, barH * 0.4);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 0.75;
    ctx.strokeRect(barX, barY, barW, barH);

    if (tier >= 3) {
      ctx.save();
      ctx.font = 'bold 8px sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${Math.ceil(hpRatio * 100)}%`, x, barY + barH / 2);
      ctx.restore();
    }
  }
}

function drawProjectiles() {
  // Draw laser beams (recorded during updateProjectiles this frame)
  for (const beam of laserBeams) {
    const grad = ctx.createLinearGradient(beam.sx, beam.sy, beam.ex, beam.ey);
    grad.addColorStop(0, beam.color + '00');
    grad.addColorStop(0.2, beam.color);
    grad.addColorStop(0.8, beam.color);
    grad.addColorStop(1, '#ffffff');
    // Outer glow
    ctx.globalAlpha = beam.alpha * 0.3;
    ctx.beginPath();
    ctx.moveTo(beam.sx, beam.sy);
    ctx.lineTo(beam.ex, beam.ey);
    ctx.strokeStyle = beam.color;
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Core beam
    ctx.globalAlpha = beam.alpha;
    ctx.beginPath();
    ctx.moveTo(beam.sx, beam.sy);
    ctx.lineTo(beam.ex, beam.ey);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    // Bright white core line
    ctx.globalAlpha = beam.alpha * 0.8;
    ctx.beginPath();
    ctx.moveTo(beam.sx, beam.sy);
    ctx.lineTo(beam.ex, beam.ey);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (const p of projectiles) {
    // Skip laser/voidray projectile dot — the beam line above handles rendering
    if (p.towerType === 'laser' || p.towerType === 'voidray') continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    // Trail effect — fading trail from previous position
    if (p.prevX !== undefined) {
      const tdx = p.x - p.prevX;
      const tdy = p.y - p.prevY;
      const tLen = Math.sqrt(tdx * tdx + tdy * tdy);
      if (tLen > 2) {
        const steps = Math.min(4, Math.floor(tLen / 4));
        for (let i = 1; i <= steps; i++) {
          const t = i / (steps + 1);
          ctx.globalAlpha = (1 - t) * 0.35;
          ctx.beginPath();
          ctx.arc(p.x - tdx * t, p.y - tdy * t, p.size * (1 - t * 0.5), 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    p.prevX = p.x;
    p.prevY = p.y;
    // Outer glow
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size + 3, 0, Math.PI * 2);
    ctx.fillStyle = p.color + '33';
    ctx.fill();
    // Inner bright core
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff77';
    ctx.fill();
  }
}


// ── TESLA CHAIN LIGHTNING ──────────────────────────────────
function spawnTeslaArc(sx, sy, ex, ey, color) {
  const segments = [];
  const steps = 6 + Math.floor(Math.random() * 4);
  let px = sx, py = sy;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const nx = sx + (ex - sx) * t + (Math.random() - 0.5) * 22;
    const ny = sy + (ey - sy) * t + (Math.random() - 0.5) * 22;
    segments.push({ x1: px, y1: py, x2: nx, y2: ny });
    px = nx; py = ny;
  }
  // final segment to target
  segments[segments.length - 1].x2 = ex;
  segments[segments.length - 1].y2 = ey;
  teslaArcs.push({ segments, life: 0.18, maxLife: 0.18, color });
}

function updateTeslaArcs(dt) {
  for (const arc of teslaArcs) arc.life -= dt;
  let w = 0;
  for (let i = 0; i < teslaArcs.length; i++) {
    if (teslaArcs[i].life > 0) teslaArcs[w++] = teslaArcs[i];
  }
  teslaArcs.length = w;
}

function drawTeslaArcs() {
  for (const arc of teslaArcs) {
    const alpha = arc.life / arc.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha * 0.85;
    ctx.lineCap = 'round';
    // Outer glow
    ctx.strokeStyle = arc.color;
    ctx.lineWidth = 4;
    ctx.shadowColor = arc.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (const seg of arc.segments) {
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
    // White core
    ctx.globalAlpha = alpha * 0.7;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 0;
    ctx.beginPath();
    for (const seg of arc.segments) {
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Enemy tooltip on hover ---
function drawEnemyTooltip() {
  if (!hoveredCell || !hoveredCell.mx) return;
  const { mx, my } = hoveredCell;
  // Find nearest enemy under cursor
  let hovered = null;
  let minDist = Infinity;
  for (const e of enemies) {
    if (e.dead || e.reached) continue;
    const dx = e.x - mx, dy = e.y - my;
    const d = dx * dx + dy * dy;
    if (d < e.size * e.size && d < minDist) { minDist = d; hovered = e; }
  }
  if (!hovered) return;
  const def = ENEMY_DEFS[hovered.type];
  const name = def ? def.name : hovered.type;
  const hpPct = Math.ceil((hovered.hp / hovered.maxHp) * 100);
  const label = `${name}  HP ${Math.ceil(hovered.hp)}/${hovered.maxHp} (${hpPct}%)`;
  const pad = 6, th = 18;
  ctx.save();
  ctx.font = 'bold 11px sans-serif';
  const tw = ctx.measureText(label).width;
  let tx = mx + 10, ty = my - 24;
  if (tx + tw + pad * 2 > canvas.width) tx = mx - tw - pad * 2 - 10;
  if (ty < 4) ty = my + 16;
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.beginPath();
  ctx.roundRect(tx, ty, tw + pad * 2, th, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, tx + pad, ty + th / 2);
  ctx.restore();
}

// --- Wave progress bar (top-right, below FPS) ---
function drawWaveProgress() {
  if (!waveInProgress || waveEnemyTotal === 0) return;
  const progress = Math.min(waveEnemyKilled / waveEnemyTotal, 1);
  const barW = 140, barH = 6;
  const barX = canvas.width - barW - 8;
  const barY = 34;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(barX, barY, barW, barH);
  const grad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
  grad.addColorStop(0, '#2ecc71');
  grad.addColorStop(1, '#27ae60');
  ctx.fillStyle = grad;
  ctx.fillRect(barX, barY, barW * progress, barH);
  ctx.save();
  ctx.font = '9px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText(`${waveEnemyKilled}/${waveEnemyTotal}`, barX - 4, barY - 1);
  ctx.restore();
}

// --- FPS counter (debug overlay, top-right corner) ---
let _fpsFrames = 0, _fpsLast = performance.now(), _fpsDisplay = 0;
function drawFps() {
  _fpsFrames++;
  const now = performance.now();
  if (now - _fpsLast >= 500) {
    _fpsDisplay = Math.round(_fpsFrames / ((now - _fpsLast) / 1000));
    _fpsFrames = 0;
    _fpsLast = now;
  }
  ctx.save();
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = _fpsDisplay >= 55 ? 'rgba(46,204,113,0.8)' : _fpsDisplay >= 30 ? 'rgba(241,196,15,0.8)' : 'rgba(231,76,60,0.8)';
  ctx.fillText(`${_fpsDisplay} FPS`, canvas.width - 6, 4);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillText(`E:${_drawList.length} P:${particles.length}`, canvas.width - 6, 18);
  ctx.restore();
}
