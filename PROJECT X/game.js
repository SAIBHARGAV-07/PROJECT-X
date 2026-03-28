// ════════════════════════════════════════════════
//  STARBLASTER — Complete 2D Space Shooter
//  Features: Particles, High Score, Sound Effects,
//            Levels, Lives, Enemies, Power-ups
// ════════════════════════════════════════════════

// ── SOUND ENGINE (Web Audio API — no files needed!) ──
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function getAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}

function playSound(type) {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);

    const now = ac.currentTime;

    if (type === 'shoot') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'explosion') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'hit') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.start(now); osc.stop(now + 0.15);
    } else if (type === 'levelup') {
      [523, 659, 784, 1047].forEach((freq, i) => {
        const o2 = ac.createOscillator();
        const g2 = ac.createGain();
        o2.connect(g2); g2.connect(ac.destination);
        o2.type = 'sine';
        const t = now + i * 0.12;
        o2.frequency.setValueAtTime(freq, t);
        g2.gain.setValueAtTime(0.25, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        o2.start(t); o2.stop(t + 0.2);
      });
    } else if (type === 'powerup') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.3);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'gameover') {
      [300, 250, 200, 150].forEach((freq, i) => {
        const o2 = ac.createOscillator();
        const g2 = ac.createGain();
        o2.connect(g2); g2.connect(ac.destination);
        o2.type = 'sawtooth';
        const t = now + i * 0.18;
        o2.frequency.setValueAtTime(freq, t);
        g2.gain.setValueAtTime(0.25, t);
        g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
        o2.start(t); o2.stop(t + 0.25);
      });
    }
  } catch(e) { /* audio blocked */ }
}

// ── MUSIC ENGINE ──
const MusicEngine = {
  ac: null,
  master: null,
  nodes: [],
  sequence: null,
  beat: null,
  bossLayer: null,
  running: false,
  isMuted: localStorage.getItem('starblaster_music') === 'off',
  mode: 'menu',

  SCALES: {
    menu: [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 659.25],
    game: [110, 146.83, 164.81, 196, 220, 261.63, 329.63, 392],
    boss: [110, 116.54, 130.81, 146.83, 164.81, 174.61, 196, 220],
  },

  _getAC() {
    if (!this.ac) {
      this.ac = getAudio();
      this.master = this.ac.createGain();
      this.master.gain.value = this.isMuted ? 0 : 0.3;
      this.master.connect(this.ac.destination);
    }
    return this.ac;
  },

  start(mode = 'menu') {
    const ac = this._getAC();
    // Always resume — browser may suspend on creation
    ac.resume().then(() => {
      this.mode = mode;
      this.running = true;
      this._stopAll();
      this._startDrone();
      this._startArpeggio();
      this._startBeat();
      if (mode === 'boss') this._startBossLayer();
    });
  },

  setMode(mode) {
    if (!this.running) return this.start(mode);
    if (this.mode === mode) return;
    this.mode = mode;
    const ac = this._getAC();
    ac.resume().then(() => {
      this._stopAll();
      this._startDrone();
      this._startArpeggio();
      this._startBeat();
      if (mode === 'boss') this._startBossLayer();
    });
  },

  stop() {
    this.running = false;
    this._stopAll();
  },

  toggleMute() {
    this.isMuted = !this.isMuted;
    localStorage.setItem('starblaster_music', this.isMuted ? 'off' : 'on');
    if (this.master && this.ac) {
      this.master.gain.linearRampToValueAtTime(
        this.isMuted ? 0 : 0.3,
        this.ac.currentTime + 0.4
      );
    }
    return this.isMuted;
  },

  _stopAll() {
    this.nodes.forEach(n => { try { n.stop(); } catch(e) {} });
    this.nodes = [];
    if (this.sequence) { clearInterval(this.sequence); this.sequence = null; }
    if (this.beat)     { clearInterval(this.beat);     this.beat     = null; }
    if (this.bossLayer){ clearInterval(this.bossLayer); this.bossLayer = null; }
  },

  _node(type, freq, gainVal, detune = 0) {
    const osc  = this.ac.createOscillator();
    const gain = this.ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.value = gainVal;
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    this.nodes.push(osc);
    return { osc, gain };
  },

  _startDrone() {
    const base = this.mode === 'boss' ? 55 : 110;
    // Deep sub-bass
    this._node('sine',     base,       0.5);
    // Harmonic layer
    this._node('triangle', base * 2,   0.15, 8);
    // Shimmering pad
    const { gain: padG } = this._node('sawtooth', base * 1.5, 0.06);

    // LFO tremolo on pad
    const lfo = this.ac.createOscillator();
    const lfoG = this.ac.createGain();
    lfo.frequency.value = this.mode === 'boss' ? 0.5 : 0.18;
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG);
    lfoG.connect(padG.gain);
    lfo.start();
    this.nodes.push(lfo);
  },

  _startArpeggio() {
    const scale   = this.SCALES[this.mode] || this.SCALES.menu;
    const tempo   = this.mode === 'boss' ? 180 : this.mode === 'game' ? 240 : 380;
    const pattern = this.mode === 'boss'
      ? [0, 2, 1, 3, 5, 3, 7, 6]
      : [0, 2, 4, 5, 4, 2, 7, 5];
    let step = 0;

    this.sequence = setInterval(() => {
      if (!this.ac || this.isMuted) return;
      const now  = this.ac.currentTime;
      const freq = scale[pattern[step % pattern.length]];
      const osc  = this.ac.createOscillator();
      const gain = this.ac.createGain();
      osc.type = this.mode === 'boss' ? 'sawtooth' : 'square';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(now);
      osc.stop(now + 0.25);
      step++;
    }, tempo);
  },

  _startBeat() {
    const bpm      = this.mode === 'boss' ? 150 : 120;
    const interval = (60 / bpm) * 1000;
    let tick = 0;

    this.beat = setInterval(() => {
      if (!this.ac || this.isMuted) return;
      const now = this.ac.currentTime;

      // Kick on beats 1 & 3
      if (tick % 4 === 0 || tick % 4 === 2) {
        const k = this.ac.createOscillator();
        const kg = this.ac.createGain();
        k.type = 'sine';
        k.frequency.setValueAtTime(this.mode === 'boss' ? 100 : 80, now);
        k.frequency.exponentialRampToValueAtTime(30, now + 0.18);
        kg.gain.setValueAtTime(0.7, now);
        kg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        k.connect(kg); kg.connect(this.master);
        k.start(now); k.stop(now + 0.25);
      }

      // Hi-hat on every beat
      const h = this.ac.createOscillator();
      const hg = this.ac.createGain();
      h.type = 'square';
      h.frequency.value = 900 + Math.random() * 200;
      hg.gain.setValueAtTime(0.06, now);
      hg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      h.connect(hg); hg.connect(this.master);
      h.start(now); h.stop(now + 0.06);
      tick++;
    }, interval);
  },

  _startBossLayer() {
    this.bossLayer = setInterval(() => {
      if (!this.ac || this.isMuted) return;
      const now = this.ac.currentTime;
      [110, 130.81, 155.56].forEach(f => {
        const o = this.ac.createOscillator();
        const g = this.ac.createGain();
        o.type = 'sawtooth';
        o.frequency.value = f;
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.12, now + 0.06);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        o.connect(g); g.connect(this.master);
        o.start(now); o.stop(now + 0.75);
      });
    }, 1600);
  },
};

// ── CANVAS SETUP ──
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
const bgCanvas  = document.getElementById('bgCanvas');
const bgCtx     = bgCanvas.getContext('2d');

function resizeCanvas() {
  const maxW = Math.min(window.innerWidth, 900);
  const maxH = window.innerHeight - 100;
  canvas.width  = maxW;
  canvas.height = maxH;
  bgCanvas.width  = window.innerWidth;
  bgCanvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ── STARS (background) ──
let stars = [];
let starsLayer2 = [];
let nebulas = [];
const nebulaColors = ['rgba(138,43,226,0.15)', 'rgba(0,191,255,0.12)', 'rgba(75,0,130,0.18)'];

function initStars(c) {
  stars = [];
  starsLayer2 = [];
  nebulas = [];
  // Foreground stars (faster)
  for (let i = 0; i < 80; i++) {
    stars.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 2 + 0.8,
      brightness: Math.random()
    });
  }
  // Background stars (slower)
  for (let i = 0; i < 120; i++) {
    starsLayer2.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * 0.8 + 0.2,
      speed: Math.random() * 0.4 + 0.2,
      brightness: Math.random()
    });
  }
  // Slower, deeper nebulas for parallax
  for (let i = 0; i < 12; i++) {
    nebulas.push({
      x: Math.random() * c.width,
      y: Math.random() * c.height,
      r: Math.random() * c.width * 0.6 + 150,
      color: nebulaColors[Math.floor(Math.random() * nebulaColors.length)],
      speed: Math.random() * 0.15 + 0.05,
      pulse: Math.random() * Math.PI,
      pulseSpeed: 0.005 + Math.random() * 0.01
    });
  }
}

function drawStars(c, ct, sector) {
  const sColor1 = sector ? sector.color1 : 'rgba(138,43,226,0.15)';
  const sColor2 = sector ? sector.color2 : 'rgba(0,191,255,0.12)';

  // Boss Alert Tint
  if (boss) {
    ct.fillStyle = `rgba(255, 0, 0, ${0.05 + 0.05 * Math.sin(frameCount * 0.1)})`;
    ct.fillRect(0, 0, c.width, c.height);
  }

  ct.globalCompositeOperation = 'screen';
  nebulas.forEach((n, i) => {
    n.y += n.speed;
    n.pulse += n.pulseSpeed;
    if (n.y - n.r > c.height) {
      n.y = -n.r;
      n.x = Math.random() * c.width;
    }
    const currentR = n.r * (1 + 0.05 * Math.sin(n.pulse));
    const grd = ct.createRadialGradient(n.x, n.y, 0, n.x, n.y, currentR);
    const color = i % 2 === 0 ? sColor1 : sColor2;
    
    // Deeper gradient stops
    grd.addColorStop(0, color.includes('rgba') ? color : `${color}33`);
    grd.addColorStop(0.4, color.includes('rgba') ? color.replace(/[\d.]+\)$/, '0.1)') : `${color}11`);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    
    ct.beginPath();
    ct.arc(n.x, n.y, currentR, 0, Math.PI*2);
    ct.fillStyle = grd;
    ct.fill();
  });
  ct.globalCompositeOperation = 'source-over';

  // Draw two layers of parallax stars
  [starsLayer2, stars].forEach((layer, idx) => {
    layer.forEach(s => {
      s.y += s.speed;
      if (s.y > c.height) { s.y = 0; s.x = Math.random() * c.width; }
      s.brightness += 0.02;
      const alpha = 0.3 + 0.5 * Math.abs(Math.sin(s.brightness));
      ct.beginPath();
      ct.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ct.fillStyle = `rgba(255,255,255,${alpha})`;
      ct.fill();
    });
  });
}

// ── CONTROL SCHEME ──
let controlScheme = localStorage.getItem('starblaster_ctrl') || 'both'; // 'arrows' | 'wasd' | 'both'

const HINT_LABELS = {
  arrows: ['← → ↑ ↓ MOVE', 'SPACE SHOOT', 'P PAUSE'],
  wasd:   ['W A S D MOVE',  'SPACE SHOOT', 'P PAUSE'],
  both:   ['ARROWS/WASD MOVE', 'SPACE SHOOT', 'P PAUSE'],
};

function applyScheme(scheme) {
  controlScheme = scheme;
  localStorage.setItem('starblaster_ctrl', scheme);
  // Update toggle buttons
  document.querySelectorAll('.ctrl-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scheme === scheme);
  });
  // Update hint row
  const hints = HINT_LABELS[scheme];
  const hint  = document.getElementById('controlsHint');
  if (hint) hint.innerHTML = hints.map(h => `<span>${h}</span>`).join('');
}

// Wire toggle buttons
document.querySelectorAll('.ctrl-btn').forEach(btn => {
  btn.addEventListener('click', () => applyScheme(btn.dataset.scheme));
});
// Apply stored preference on load
window.addEventListener('DOMContentLoaded', () => applyScheme(controlScheme));

// ── SECTORS & BIOMES ──
const SECTORS = [
  { name: 'NEBULA REACH', color1: '#bf5fff', color2: '#00e5ff', bg: '#020510' },
  { name: 'CRYSTAL BELT', color1: '#00ffff', color2: '#ffffff', bg: '#000814' },
  { name: 'MAGMA CORE',   color1: '#ff4444', color2: '#ffd700', bg: '#0a0000' },
  { name: 'VOID EDGE',    color1: '#888888', color2: '#ffffff', bg: '#000000' }
];

// ── SHIP SELECTION ──
let selectedShip = localStorage.getItem('starblaster_ship') || 'classic';

const SHIP_STATS = {
  interceptor: { speed: 6.5, maxLives: 2, fireRate: 40, color: '#ff00ff' }, 
  classic:     { speed: 5,   maxLives: 3, fireRate: 18, color: '#00e5ff' },
  juggernaut:  { speed: 3.5, maxLives: 5, fireRate: 24, color: '#ff9f43' }
};

// ── UPGRADES ──
let shipUpgrades = JSON.parse(localStorage.getItem('starblaster_upgrades') || '{}');
if (!shipUpgrades.classic) {
  ['classic', 'interceptor', 'juggernaut'].forEach(s => {
    shipUpgrades[s] = { speed: 0, fireRate: 0, energy: 0 };
  });
}

function saveUpgrades() {
  localStorage.setItem('starblaster_upgrades', JSON.stringify(shipUpgrades));
}

function selectShip(shipId) {
  selectedShip = shipId;
  localStorage.setItem('starblaster_ship', shipId);
  document.querySelectorAll('.ship-card').forEach(card => {
    card.classList.toggle('active', card.dataset.ship === shipId);
  });
  renderUpgradeShop();
  renderSkinSelector();
}

document.querySelectorAll('.ship-card').forEach(card => {
  card.addEventListener('click', () => selectShip(card.dataset.ship));
});

function renderSkinSelector() {
  const container = document.getElementById('skinContainer');
  const section = document.getElementById('skinSection');
  const skins = SHIP_SKINS[selectedShip];
  
  if (!skins || skins.length <= 1) {
    section.style.display = 'none';
    return;
  }
  
  section.style.display = 'flex';
  const activeSkin = activeSkins[selectedShip] || 'default';

  container.innerHTML = skins.map(s => {
    const isLocked = s.req && !achievements.includes(s.req);
    const isActive = s.id === activeSkin;
    return `
      <canvas class="skin-preview-canvas ${isLocked ? 'locked' : ''} ${isActive ? 'active' : ''}" 
              width="60" height="60"
              data-skin-id="${s.id}"
              data-color="${s.color}"
              onclick="${isLocked ? '' : `applySkin('${s.id}')`}"
              title="${s.name}${isLocked ? ' (LOCKED)' : ''}">
      </canvas>
    `;
  }).join('');

  // Draw the previews
  container.querySelectorAll('.skin-preview-canvas').forEach(canv => {
    const pCtx = canv.getContext('2d');
    const color = canv.dataset.color;
    // Draw miniature ship (centered at 30,30)
    drawShip(30, 30, 24, 24, color, false, pCtx, selectedShip);
  });
}

function applySkin(skinId) {
  activeSkins[selectedShip] = skinId;
  localStorage.setItem('starblaster_active_skins', JSON.stringify(activeSkins));
  renderSkinSelector();
  playSound('powerup');
}

function renderUpgradeShop() {
  const shop = document.getElementById('upgradeShop');
  const upgrades = shipUpgrades[selectedShip];
  const statsList = [
    { id: 'speed', label: 'SPEED', icon: '⚡' },
    { id: 'fireRate', label: 'FIRE',  icon: '🔫' },
    { id: 'energy', label: 'EMP',   icon: '💠' }
  ];

  shop.innerHTML = statsList.map(s => {
    const lv = upgrades[s.id];
    const cost = 500 * (lv + 1);
    const canAfford = highScore >= cost;
    const isMax = lv >= 5;

    let dots = '';
    for(let i=0; i<5; i++) {
      dots += `<div class="dot ${i < lv ? 'active' : ''}"></div>`;
    }

    return `
      <div class="upgrade-item">
        <div class="upgrade-info">
          <div class="upgrade-label">${s.icon} ${s.label}</div>
          <div class="upgrade-dots">${dots}</div>
        </div>
        <button class="btn-upgrade" onclick="buyUpgrade('${s.id}')" ${isMax || !canAfford ? 'disabled' : ''}>
          ${isMax ? 'MAX' : cost}
        </button>
      </div>
    `;
  }).join('');
}

// ── SHIP SKINS ──
const SHIP_SKINS = {
  classic:     [ { id: 'default', name: 'NEON', color: '#00e5ff', req: null }, { id: 'gold', name: 'GOLDEN', color: '#ffd700', req: 'kills_100' } ],
  interceptor: [ { id: 'default', name: 'PLASMA', color: '#ff00ff', req: null }, { id: 'void', name: 'VOID', color: '#ffffff', req: 'boss_3' } ],
  juggernaut:  [ { id: 'default', name: 'EMBER', color: '#ff9f43', req: null }, { id: 'toxic', name: 'TOXIC', color: '#39ff14', req: 'upgrade_3' } ]
};

let activeSkins = JSON.parse(localStorage.getItem('starblaster_active_skins') || '{}');

function getShipColor(shipId) {
  const skinId = activeSkins[shipId] || 'default';
  const skin = SHIP_SKINS[shipId].find(s => s.id === skinId);
  return skin ? skin.color : SHIP_STATS[shipId].color;
}

function buyUpgrade(statType) {
  const lv = shipUpgrades[selectedShip][statType];
  const cost = 500 * (lv + 1);
  if (highScore >= cost && lv < 5) {
    highScore -= cost;
    localStorage.setItem('starblaster_hs', highScore);
    shipUpgrades[selectedShip][statType]++;
    stats.upgradesBought++;
    localStorage.setItem('starblaster_stats', JSON.stringify(stats));
    saveUpgrades();
    checkAchievements();
    renderUpgradeShop();
    updateHUD();
    playSound('levelup');
    showToast(`${statType.toUpperCase()} UPGRADED!`);
  }
}

window.addEventListener('DOMContentLoaded', () => {
  selectShip(selectedShip);
  renderUpgradeShop();
});

// ── GAME STATE ──
let score = 0;
let highScore = parseInt(localStorage.getItem('starblaster_hs') || '0');
let lives = 3;
let level = 1;
let gameRunning = false;
let paused = false;
let frameCount = 0;
let invincibleTimer = 0;
let comboCount = 0;
let comboTimer = 0;
let comboMultiplier = 1;
let energy = 0;
let berserkerEnergy = 0;
let drones = [];

// ── ACHIEVEMENTS ──
let stats = JSON.parse(localStorage.getItem('starblaster_stats') || '{"totalKills":0, "bossKills":0, "upgradesBought":0}');
let achievements = JSON.parse(localStorage.getItem('starblaster_achievements') || '[]');

const ACHIEVEMENT_DEFS = [
  { id: 'kills_100', name: 'CENTURION', desc: 'Destroy 100 enemies in total', goal: 100, type: 'totalKills', icon: '🎖️' },
  { id: 'boss_3', name: 'BOSS SLAYER', desc: 'Defeat 3 mighty boss ships', goal: 3, type: 'bossKills', icon: '🏆' },
  { id: 'upgrade_3', name: 'LAB RAT', desc: 'Buy 5 total ship upgrades', goal: 5, type: 'upgradesBought', icon: '🔬' }
];

function checkAchievements() {
  ACHIEVEMENT_DEFS.forEach(def => {
    if (!achievements.includes(def.id) && stats[def.type] >= def.goal) {
      achievements.push(def.id);
      localStorage.setItem('starblaster_achievements', JSON.stringify(achievements));
      showToast(`🎖️ UNLOCKED: ${def.name}`);
      playSound('levelup');
    }
  });
}

function renderAchievements() {
  const list = document.getElementById('achievementsList');
  list.innerHTML = ACHIEVEMENT_DEFS.map(def => {
    const isUnlocked = achievements.includes(def.id);
    return `
      <div class="achievement-card ${isUnlocked ? 'unlocked' : ''}">
        <div class="medal-icon">${isUnlocked ? def.icon : '❓'}</div>
        <div class="achievement-info">
          <div class="achievement-name">${def.name}</div>
          <div class="achievement-desc">${def.desc}</div>
        </div>
      </div>
    `;
  }).join('');
}
// ── PLAYER ──
let player = {};
function resetPlayer() {
  const stats = SHIP_STATS[selectedShip];
  const upgrades = shipUpgrades[selectedShip];
  
  // Apply upgrade multipliers
  const speed = stats.speed * (1 + upgrades.speed * 0.1);
  const fireRate = Math.max(5, stats.fireRate - (upgrades.fireRate * 2)); // Lower is faster

  player = {
    x: canvas.width / 2,
    y: canvas.height - 80,
    w: 38, h: 44,
    speed: speed,
    color: getShipColor(selectedShip),
    shootCooldown: 0,
    shootRate: fireRate,
    multiShot: selectedShip === 'juggernaut', 
    multiShotTimer: 0,
    shieldTimer: 0,
    rapidTimer: 0,
    homingTimer: 0,
    berserkerTimer: 0,
    shipType: selectedShip
  };
}

// ── BULLETS ──
let bullets = [];
function spawnBullet() {
  if (player.shootCooldown > 0) return;
  player.shootCooldown = player.shootRate;
  playSound('shoot');

  if (player.shipType === 'interceptor' && !player.homingTimer) {
    // 💥 KAMEHAMEHA BEAM 💥 (Overrides multishot)
    bullets.push({ 
      x: player.x, 
      y: player.y - 60, 
      w: 36, 
      h: 220, 
      vy: -18, 
      vx: 0, 
      color: '#00ffff', 
      isKamehameha: true, 
      life: 0 
    });
    spawnParticles(player.x, player.y - 20, '#00ffff', 15);
    return;
  }

  if (player.shipType === 'juggernaut' && !player.homingTimer) {
    // ☄️ FLAK CANNON SPREAD ☄️ (Overrides multishot)
    const spread = 5;
    for (let i = 0; i < spread; i++) {
      const angle = -Math.PI/2 + (i - Math.floor(spread/2)) * 0.18;
      bullets.push({ 
        x: player.x, 
        y: player.y - 10, 
        w: 6, h: 12, 
        vy: Math.sin(angle) * 15, 
        vx: Math.cos(angle) * 15, 
        color: '#ff9f43', 
        isFlak: true, 
        life: 0 
      });
    }
    return;
  }

  const isHoming = player.homingTimer > 0;
  const color = isHoming ? '#ff3366' : '#00e5ff';
  const hw = isHoming ? 6 : 4;

  if (player.multiShot) {
    bullets.push({ x: player.x - 12, y: player.y, w: hw, h: 14, vy: -12, vx: isHoming? -1: 0, color: '#ff9f43', homing: isHoming, life: 0 });
    bullets.push({ x: player.x,      y: player.y, w: hw, h: 14, vy: -13, vx: 0, color, homing: isHoming, life: 0 });
    bullets.push({ x: player.x + 12, y: player.y, w: hw, h: 14, vy: -12, vx: isHoming? 1: 0, color: '#ff9f43', homing: isHoming, life: 0 });
  } else {
    bullets.push({ x: player.x, y: player.y, w: hw, h: 14, vy: -13, vx: 0, color, homing: isHoming, life: 0 });
  }
}

// ── ENEMIES & BOSS ──
let enemyBullets = [];
let enemies = [];
const ENEMY_TYPES = [
  { w: 36, h: 28, color: '#ff4444', hp: 1, score: 10,  speed: 1.7, shootChance: 0.003 },  // Diamond
  { w: 44, h: 34, color: '#bf5fff', hp: 2, score: 25,  speed: 1.2, shootChance: 0.005 },  // Saucer
  { w: 54, h: 42, color: '#ffd700', hp: 4, score: 60,  speed: 0.7, shootChance: 0.008 },  // Hexagon
  { w: 24, h: 40, color: '#ff0044', hp: 1, score: 40,  speed: 2.8, shootChance: 0 },      // Kamikaze / Seeker
  { w: 50, h: 22, color: '#00ffaa', hp: 2, score: 50,  speed: 0.85, shootChance: 0.015 },  // Sniper
];

let boss = null;
function spawnBoss() {
  boss = {
    x: canvas.width / 2,
    y: -80,
    w: 140, h: 140,
    hp: 150 + level * 50,
    maxHp: 150 + level * 50,
    score: 1000 + level * 100,
    hitFlash: 0,
    phase: 'entering',
    timer: 0,
    attackPattern: 0,
    vx: 1.5,
    vy: 1.2
  };
  showToast('⚠️ BOSS APPROACHING! ⚠️');
  MusicEngine.setMode('boss');
}

// ── PARTICLES ──
let particles = [];
function spawnParticles(x, y, color, count = 18) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.4;
    const speed = Math.random() * 4 + 1.5;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r:  Math.random() * 4 + 2,
      alpha: 1,
      color,
      decay: Math.random() * 0.025 + 0.018
    });
  }
}

// ── POWER-UPS ──
let powerups = [];
const POWERUP_TYPES = [
  { type: 'multishot', color: '#ff9f43', label: '3X',  emoji: '🔥' },
  { type: 'life',      color: '#ff4444', label: '♥',   emoji: '❤️' },
  { type: 'speed',     color: '#39ff14', label: '>>',  emoji: '⚡' },
  { type: 'shield',    color: '#00e5ff', label: '🛡️',  emoji: '🛡️' },
  { type: 'rapidfire', color: '#ff00ff', label: 'FF',  emoji: '🔫' },
  { type: 'bomb',      color: '#ffd700', label: '💥',  emoji: '💥' },
  { type: 'homing',    color: '#ff3366', label: 'H',   emoji: '🚀' },
  { type: 'drone',     color: '#ffffff', label: '🤖',  emoji: '🤖' },
];

// ── KEYS ──
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') { e.preventDefault(); if (gameRunning && !paused) spawnBullet(); }
  if (e.code === 'KeyP')  togglePause();
  if (e.code === 'KeyR' && gameRunning && !paused) triggerBerserker();
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight') && gameRunning && !paused) {
    e.preventDefault();
    triggerEMP();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ── MOBILE TOUCH CONTROLS ──
const touchMap = {
  'dUp': 'TouchUp', 'dDown': 'TouchDown', 'dLeft': 'TouchLeft', 'dRight': 'TouchRight', 'btnShoot': 'Space'
};

Object.keys(touchMap).forEach(id => {
  const btn = document.getElementById(id);
  if (!btn) return;
  
  const press = (e) => { 
    if(e && e.cancelable) e.preventDefault(); 
    keys[touchMap[id]] = true; 
    btn.classList.add('pressed'); 
  };
  
  const release = (e) => { 
    if(e && e.cancelable) e.preventDefault(); 
    keys[touchMap[id]] = false; 
    btn.classList.remove('pressed'); 
  };

  btn.addEventListener('pointerdown', e => { 
    try { btn.setPointerCapture(e.pointerId); } catch(err) {}
    press(e);
  });
  
  const pointerRelease = e => { 
    try { if (btn.hasPointerCapture(e.pointerId)) btn.releasePointerCapture(e.pointerId); } catch(err) {}
    release(e);
  };

  btn.addEventListener('pointerup', pointerRelease);
  btn.addEventListener('pointercancel', pointerRelease);

  // Fallbacks for older Safari / Android WebViews
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
});

// Mobile Action Buttons (One-off triggers)
const bindAction = (id, action) => {
  const btn = document.getElementById(id);
  if (!btn) return;
  
  let lastTime = 0;
  const trigger = (e) => {
    if(e && e.cancelable) e.preventDefault(); 
    const now = Date.now();
    if(now - lastTime < 100) return; // Debounce double inputs
    lastTime = now;
    
    action();
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 100);
  };

  btn.addEventListener('pointerdown', trigger);
  btn.addEventListener('touchstart', trigger, { passive: false });
};

bindAction('btnEMP', triggerEMP);
bindAction('btnBerserker', triggerBerserker);
bindAction('btnMobilePause', togglePause);


function triggerBerserker() {
  if (berserkerEnergy < 100 || player.berserkerTimer > 0) return;
  berserkerEnergy = 0;
  player.berserkerTimer = 480; // 8 seconds @ 60fps
  player.oldFireRate = player.shootRate;
  player.shootRate /= 2; // Double fire rate
  player.speed *= 1.3;  // 30% speed boost
  playSound('powerup');
  showToast('🔥 BERSERKER MODE! 🔥');
}

// ── UI REFS ──
const scoreDisplay     = document.getElementById('scoreDisplay');
const levelDisplay     = document.getElementById('levelDisplay');
const highScoreDisplay = document.getElementById('highScoreDisplay');
const livesBar         = document.getElementById('livesBar');
const pauseOverlay     = document.getElementById('pauseOverlay');
const menuScreen       = document.getElementById('menuScreen');
const gameScreen       = document.getElementById('gameScreen');
const gameOverScreen   = document.getElementById('gameOverScreen');
const menuHighScore    = document.getElementById('menuHighScore');
const finalScore       = document.getElementById('finalScore');
const finalBest        = document.getElementById('finalBest');
const newBestBanner    = document.getElementById('newBestBanner');
const comboMultiplierText = document.getElementById('comboMultiplierText');
const activeCombos        = document.getElementById('activeCombos');
const energyContainer     = document.getElementById('energyContainer');
const energyBarFill       = document.getElementById('energyBarFill');
const berserkerBarFill    = document.getElementById('berserkerBarFill');

function spawnComboText(msg) {
  const el = document.createElement('div');
  el.className = 'combo-float';
  el.textContent = msg;
  el.style.top = `${Math.random() * 40 + 30}%`;
  el.style.left = `${Math.random() * 40 + 30}%`;
  activeCombos.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function triggerEMP() {
  if (energy < 100) return;
  energy = 0;
  energyBarFill.classList.remove('ready');
  playSound('gameover'); // Deep bass sound
  
  // Spawn massive ring
  particles.push({
    x: player.x, y: player.y,
    vx: 0, vy: 0, r: 10,
    alpha: 1, color: '#00ffff',
    decay: 0.015,
    isEMP: true
  });

  enemies.forEach(e => {
    score += e.score * comboMultiplier;
    spawnParticles(e.x, e.y, e.color, 15);
  });
  asteroids.forEach(a => {
    score += 5 * comboMultiplier;
    spawnParticles(a.x, a.y, '#444', 10);
  });
  enemies = [];
  enemyBullets = [];
  asteroids = [];
  updateHUD();
  showToast('⚡ EMP BLAST! ⚡');
  shakeScreen();
}

// Level-up toast
const toast = document.createElement('div');
toast.id = 'levelUpToast';
gameScreen.appendChild(toast);

function showToast(msg) {
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 1600);
}

function shakeScreen() {
  gameScreen.classList.remove('shake-screen');
  void gameScreen.offsetWidth; // Trigger reflow
  gameScreen.classList.add('shake-screen');
}

// ── BUTTON WIRING ──
document.getElementById('btnPlay').onclick    = startGame;
document.getElementById('btnRestart').onclick = startGame;
document.getElementById('btnMenu').onclick    = goToMenu;
document.getElementById('btnResume').onclick  = togglePause;
document.getElementById('btnQuit').onclick    = () => { gameRunning = false; goToMenu(); };
document.getElementById('btnExport').onclick  = exportSave;
document.getElementById('btnImport').onclick  = importSave;

function exportSave() {
  const saveData = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('starblaster_')) {
      saveData[key] = localStorage.getItem(key);
    }
  }
  const blob = new Blob([JSON.stringify(saveData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `starblaster_save_${new Date().toISOString().slice(0,10)}.sav`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 SAVE EXPORTED');
}

function importSave() {
  const input = document.getElementById('importFile');
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const data = JSON.parse(event.target.result);
        Object.keys(data).forEach(key => {
          if (key.startsWith('starblaster_')) {
            localStorage.setItem(key, data[key]);
          }
        });
        showToast('📥 SAVE IMPORTED! REFRESHING...');
        setTimeout(() => location.reload(), 1500);
      } catch (err) {
        showToast('❌ INVALID SAVE FILE');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

document.getElementById('btnAchievements').onclick = () => {
  renderAchievements();
  document.getElementById('achievementsModal').classList.remove('hidden');
};
document.getElementById('closeAchievements').onclick = () => {
  document.getElementById('achievementsModal').classList.add('hidden');
};

// ── GUIDE MODAL ──
function renderGuideShips() {
  const ships = [
    { id: 'gShipInterceptor', type: 'interceptor', color: '#ff00ff' },
    { id: 'gShipClassic',     type: 'classic',     color: '#00e5ff' },
    { id: 'gShipJuggernaut',  type: 'juggernaut',  color: '#ff9f43' },
  ];
  ships.forEach(s => {
    const c = document.getElementById(s.id);
    if (!c) return;
    const pCtx = c.getContext('2d');
    pCtx.clearRect(0, 0, 80, 80);
    drawShip(40, 45, 28, 30, s.color, false, pCtx, s.type);
  });
}

document.getElementById('btnGuide').onclick = () => {
  document.getElementById('guideModal').classList.remove('hidden');
  // Render ship previews after modal is visible (DOM ready)
  requestAnimationFrame(renderGuideShips);
};
document.getElementById('closeGuide').onclick = () => {
  document.getElementById('guideModal').classList.add('hidden');
};
// Tab switching
document.querySelectorAll('.guide-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.guide-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${target}`).classList.add('active');
    if (target === 'ships') requestAnimationFrame(renderGuideShips);
  });
});

function showScreen(id) {
  ['menuScreen','gameScreen','gameOverScreen'].forEach(s => {
    document.getElementById(s).classList.remove('active');
    document.getElementById(s).style.display = 'none';
  });
  document.getElementById(id).style.display = 'flex';
  document.getElementById(id).classList.add('active');
}

function goToMenu() {
  menuHighScore.textContent = highScore;
  showScreen('menuScreen');
  initStars(bgCanvas);
  requestAnimationFrame(menuLoop);
  MusicEngine.setMode('menu');
}

function togglePause() {
  if (!gameRunning) return;
  paused = !paused;
  pauseOverlay.classList.toggle('hidden', !paused);
  if (!paused) requestAnimationFrame(gameLoop);
}

// ── START GAME ──
// ── START GAME ──
function startGame() {
  score = 0; level = 1; frameCount = 0;
  comboCount = 0; comboTimer = 0; comboMultiplier = 1; energy = 0;
  bullets = []; enemies = []; particles = []; powerups = []; enemyBullets = [];
  asteroids = []; drones = []; invincibleTimer = 0; boss = null;
  resetPlayer();
  lives = SHIP_STATS[selectedShip].maxLives;
  updateHUD();
  initStars(canvas);
  paused = false;
  pauseOverlay.classList.add('hidden');
  showScreen('gameScreen');
  gameRunning = true;
  MusicEngine.start('game');
  requestAnimationFrame(gameLoop);
}

// ── UPDATE HUD ──
function updateHUD() {
  scoreDisplay.textContent     = Math.floor(score);
  levelDisplay.textContent     = level;
  highScoreDisplay.textContent = Math.floor(highScore);

  // Render Hearts for Lives
  const livesContainer = document.getElementById('livesBar');
  livesContainer.innerHTML = '';
  for (let i = 0; i < lives; i++) {
    const heart = document.createElement('div');
    heart.className = 'heart';
    heart.innerHTML = '❤️';
    livesContainer.appendChild(heart);
  }

  if (comboMultiplier > 1) {
    comboMultiplierText.style.display = 'inline';
    comboMultiplierText.textContent = `x${comboMultiplier}`;
  } else {
    comboMultiplierText.style.display = 'none';
  }

  const energyPercent = Math.min(100, energy);
  energyBarFill.style.width = `${energyPercent}%`;
  if (energy >= 100) energyBarFill.classList.add('ready');
  else energyBarFill.classList.remove('ready');

  const berserkerPercent = Math.min(100, berserkerEnergy);
  berserkerBarFill.style.width = `${berserkerPercent}%`;
  if (berserkerEnergy >= 100) berserkerBarFill.classList.add('ready');
  else berserkerBarFill.classList.remove('ready');
}

// ── SPAWN ENEMY ──
function spawnEnemy() {
  const maxIdx = Math.min(2 + Math.floor(level / 3), 4);
  const typeIdx = Math.floor(Math.random() * (maxIdx + 1));
  const t = ENEMY_TYPES[typeIdx];
  const margin = 40;
  enemies.push({
    x: margin + Math.random() * (canvas.width - margin * 2),
    y: -50,
    w: t.w, h: t.h,
    color: t.color,
    hp: t.hp + Math.floor(level / 3),
    maxHp: t.hp + Math.floor(level / 3),
    score: t.score,
    speed: t.speed + level * 0.15,
    shootChance: t.shootChance + level * 0.0005,
    vx: (Math.random() - 0.5) * 1.5,
    hitFlash: 0,
    typeIdx
  });
}

// ── SPAWN POWERUP ──
function spawnPowerup(x, y) {
  if (Math.random() > 0.30) return;  // 30% drop chance
  const t = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({ x, y, w: 28, h: 28, vy: 1.8, ...t, pulse: 0 });
}

// ── ASTEROIDS & HAZARDS ──
let asteroids = [];
let hazards = [];

function spawnIceShard() {
  const size = 15 + Math.random() * 10;
  hazards.push({
    x: Math.random() * canvas.width,
    y: -size,
    w: size, h: size,
    vx: (Math.random() - 0.5) * 3,
    vy: 3 + Math.random() * 2,
    hitFlash: 0,
    type: 'ice'
  });
}
function spawnLavaBurst() {
  const size = 20 + Math.random() * 15;
  hazards.push({
    x: Math.random() * canvas.width,
    y: canvas.height + size,
    w: size, h: size,
    vx: (Math.random() - 0.5) * 2,
    vy: - (4 + Math.random() * 3),
    hitFlash: 0,
    type: 'lava'
  });
}
function spawnGravityWell() {
  const size = 60 + Math.random() * 40;
  hazards.push({
    x: Math.random() * canvas.width,
    y: -size,
    w: size, h: size,
    vx: (Math.random() - 0.5) * 0.5,
    vy: 1.2,
    hitFlash: 0,
    type: 'gravity',
    pullForce: 0.15
  });
}
function spawnAsteroid() {
  const size = Math.random() * 30 + 20;
  asteroids.push({
    x: Math.random() * canvas.width,
    y: -size,
    w: size, h: size,
    hp: Math.ceil(size / 10),
    vx: (Math.random() - 0.5) * 1.5,
    vy: Math.random() * 1.5 + 0.5,
    rot: Math.random() * Math.PI,
    rotSpeed: (Math.random() - 0.5) * 0.05,
    vertices: Array.from({length: 8}, (_, i) => {
      const a = (Math.PI*2/8) * i;
      const r = size/2 * (0.6 + Math.random()*0.4);
      return {x: Math.cos(a)*r, y: Math.sin(a)*r};
    })
  });
}

function drawAsteroid(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.rot);
  ctx.beginPath();
  a.vertices.forEach((v, i) => {
    i === 0 ? ctx.moveTo(v.x, v.y) : ctx.lineTo(v.x, v.y);
  });
  ctx.closePath();
  ctx.fillStyle = '#222';
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  // Crater detail
  ctx.beginPath();
  ctx.arc(a.w/6, -a.h/6, a.w/8, 0, Math.PI*2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  
  ctx.restore();
}

// ── COLLISION (AABB) ──
function hits(a, b) {
  return a.x - a.w/2 < b.x + b.w/2 &&
         a.x + a.w/2 > b.x - b.w/2 &&
         a.y - a.h/2 < b.y + b.h/2 &&
         a.y + a.h/2 > b.y - b.h/2;
}

// ── DRAW PLAYER SHIP ──
function drawShip(cx, cy, w, h, color, flicker, targetCtx = ctx, shipType = player?.shipType || 'classic') {
  if (flicker && Math.floor(Date.now() / 80) % 2 === 0) return;
  targetCtx.save();
  targetCtx.translate(cx, cy);

  // Animated Engine Thrust
  const thrustLength = 15 + Math.random() * 12;
  const grd = targetCtx.createLinearGradient(0, h/2, 0, h/2 + thrustLength);
  grd.addColorStop(0, 'rgba(0, 255, 255, 0.9)');
  grd.addColorStop(0.5, 'rgba(0, 150, 255, 0.6)');
  grd.addColorStop(1, 'rgba(0, 255, 255, 0)');
  
  targetCtx.beginPath();
  if (shipType === 'interceptor') {
    targetCtx.moveTo(-4, h/2 - 2); targetCtx.lineTo(4, h/2 - 2); targetCtx.lineTo(0, h/2 + thrustLength * 1.5);
  } else if (shipType === 'juggernaut') {
    targetCtx.moveTo(-10, h/2 - 2); targetCtx.lineTo(10, h/2 - 2); targetCtx.lineTo(0, h/2 + thrustLength * 0.8);
  } else {
    targetCtx.moveTo(-6, h/2 - 2); targetCtx.lineTo(6, h/2 - 2); targetCtx.lineTo(0, h/2 + thrustLength);
  }
  targetCtx.closePath();
  targetCtx.fillStyle = grd;
  targetCtx.fill();

  // Ship Geometries
  if (shipType === 'interceptor') {
    targetCtx.beginPath();
    targetCtx.moveTo(0, -h/2 - 4);
    targetCtx.lineTo(w/2, h/3 + 4);
    targetCtx.lineTo(0, h/2);
    targetCtx.lineTo(-w/2, h/3 + 4);
    targetCtx.closePath();
    targetCtx.fillStyle = color;
    targetCtx.shadowColor = color;
    targetCtx.shadowBlur = 10;
    targetCtx.fill();
    targetCtx.strokeStyle = '#fff';
    targetCtx.lineWidth = 1.5;
    targetCtx.stroke();
  } 
  else if (shipType === 'juggernaut') {
    targetCtx.beginPath();
    targetCtx.moveTo(0, -h/2.5);
    targetCtx.lineTo(w/2 + 6, -h/4);
    targetCtx.lineTo(w/2 + 6, h/2);
    targetCtx.lineTo(w/4, h/2 + 4);
    targetCtx.lineTo(-w/4, h/2 + 4);
    targetCtx.lineTo(-w/2 - 6, h/2);
    targetCtx.lineTo(-w/2 - 6, -h/4);
    targetCtx.closePath();
    targetCtx.fillStyle = '#112233';
    targetCtx.fill();
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = 2;
    targetCtx.stroke();
    targetCtx.fillStyle = color;
    targetCtx.shadowColor = color;
    targetCtx.shadowBlur = 8;
    targetCtx.fillRect(-w/4, -h/4, w/2, h/1.5);
  } 
  else {
    targetCtx.beginPath();
    targetCtx.moveTo(0, -h/4);
    targetCtx.lineTo(w/2 + 8, h/2);
    targetCtx.lineTo(w/2, h/2 + 4);
    targetCtx.lineTo(w/4, h/4);
    targetCtx.moveTo(0, -h/4);
    targetCtx.lineTo(-w/2 - 8, h/2);
    targetCtx.lineTo(-w/2, h/2 + 4);
    targetCtx.lineTo(-w/4, h/4);
    targetCtx.fillStyle = '#112233';
    targetCtx.fill();
    targetCtx.strokeStyle = color;
    targetCtx.lineWidth = 1.5;
    targetCtx.stroke();

    const hullGrd = targetCtx.createLinearGradient(0, -h/2, 0, h/2);
    hullGrd.addColorStop(0, '#ffffff');
    hullGrd.addColorStop(0.3, color);
    hullGrd.addColorStop(1, '#005577');
    targetCtx.beginPath();
    targetCtx.moveTo(0, -h/2);
    targetCtx.lineTo(w/2.5, h/2);
    targetCtx.lineTo(0, h/2 - 6);
    targetCtx.lineTo(-w/2.5, h/2);
    targetCtx.closePath();
    targetCtx.fillStyle = hullGrd;
    targetCtx.shadowColor = color;
    targetCtx.shadowBlur = 10;
    targetCtx.fill();
    targetCtx.strokeStyle = 'rgba(255,255,255,0.6)';
    targetCtx.lineWidth = 1.5;
    targetCtx.stroke();
  }

  targetCtx.beginPath();
  if (shipType === 'interceptor') {
    targetCtx.moveTo(0, -h/4); targetCtx.lineTo(4, -h/8); targetCtx.lineTo(0, h/6); targetCtx.lineTo(-4, -h/8);
  } else if (shipType === 'juggernaut') {
    targetCtx.moveTo(-10, -h/6); targetCtx.lineTo(10, -h/6); targetCtx.lineTo(12, 0); targetCtx.lineTo(-12, 0);
  } else {
    targetCtx.moveTo(0, -h/4); targetCtx.lineTo(w/5, 0); targetCtx.lineTo(0, h/8); targetCtx.lineTo(-w/5, 0);
  }
  targetCtx.closePath();
  targetCtx.fillStyle = 'rgba(200, 255, 255, 0.9)';
  targetCtx.shadowColor = '#ffffff';
  targetCtx.shadowBlur = 8;
  targetCtx.fill();

  targetCtx.restore();
}

// ── DRAW ENEMY SHIP ──
function drawEnemyShip(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  const isHit = e.hitFlash > 0;
  const color = isHit ? '#ffffff' : e.color;
  const coreColor = isHit ? '#ffffff' : '#ffffff';

  if (e.typeIdx === 0) {
    // ✦ Type 0: Diamond (Fast) ✦
    // Outer spikes
    ctx.beginPath();
    ctx.moveTo(0, -e.h/2);
    ctx.lineTo(e.w/2, 0);
    ctx.lineTo(0, e.h/2);
    ctx.lineTo(-e.w/2, 0);
    ctx.closePath();
    ctx.fillStyle = isHit ? '#ffffff' : '#221111';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.stroke();
    // Inner glowing core
    ctx.beginPath();
    ctx.moveTo(0, -e.h/4);
    ctx.lineTo(e.w/4, 0);
    ctx.lineTo(0, e.h/4);
    ctx.lineTo(-e.w/4, 0);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  } 
  else if (e.typeIdx === 1) {
    // 🛸 Type 1: Saucer (Medium) 🛸
    // Bottom plate
    ctx.beginPath();
    ctx.ellipse(0, Number(4), e.w/2, e.h/4, 0, 0, Math.PI*2);
    ctx.fillStyle = isHit ? '#ffffff' : '#331133';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    // Top dome
    ctx.beginPath();
    ctx.ellipse(0, -Number(4), e.w/2.5, e.h/3.5, 0, Math.PI, Math.PI*2);
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.fill();
    // Porthole lights
    ctx.shadowBlur = 5;
    ctx.fillStyle = '#ffffff';
    for(let i=-1; i<=1; i++) {
       ctx.beginPath();
       ctx.arc(i * (e.w/3.5), Number(2), 2.5, 0, Math.PI*2);
       ctx.fill();
    }
  } 
  else if (e.typeIdx === 2) {
    // ⬢ Type 2: Hexagon (Heavy) ⬢
    // Dark base hull
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI/3)*i - Math.PI/2;
      i === 0 ? ctx.moveTo(Math.cos(a)*e.w/2, Math.sin(a)*e.h/2)
              : ctx.lineTo(Math.cos(a)*e.w/2, Math.sin(a)*e.h/2);
    }
    ctx.closePath();
    ctx.fillStyle = isHit ? '#ffffff' : '#1a1a00';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Layered armor plating
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = (Math.PI/3)*i - Math.PI/2;
        i === 0 ? ctx.moveTo(Math.cos(a)*e.w/2.8, Math.sin(a)*e.h/2.8)
                : ctx.lineTo(Math.cos(a)*e.w/2.8, Math.sin(a)*e.h/2.8);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();

    // Central pulsing cannon nub
    const pulse = 2 + Math.sin(frameCount * 0.1) * 1.5;
    ctx.beginPath();
    ctx.arc(0, e.h/3, pulse, 0, Math.PI*2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  }
  else if (e.typeIdx === 3) {
    // 🚀 Type 3: Kamikaze (Seeker) 🚀
    ctx.beginPath();
    ctx.moveTo(0, e.h/2);
    ctx.lineTo(e.w/2, -e.h/2);
    ctx.lineTo(0, -e.h/4);
    ctx.lineTo(-e.w/2, -e.h/2);
    ctx.closePath();
    ctx.fillStyle = isHit ? '#ffffff' : '#330011';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    // Engine glow
    ctx.beginPath();
    ctx.arc(0, -e.h/4, 4, 0, Math.PI*2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  else if (e.typeIdx === 4) {
    // 🎯 Type 4: Sniper 🎯
    ctx.beginPath();
    ctx.moveTo(0, e.h/2);
    ctx.lineTo(e.w/2, -e.h/2);
    ctx.lineTo(e.w/4, -e.h/2);
    ctx.lineTo(e.w/4, -e.h/4);
    ctx.lineTo(-e.w/4, -e.h/4);
    ctx.lineTo(-e.w/4, -e.h/2);
    ctx.lineTo(-e.w/2, -e.h/2);
    ctx.closePath();
    ctx.fillStyle = isHit ? '#ffffff' : '#003322';
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    // Sniper Eye
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-2, e.h/4, 4, 6);
  }

  // HP bar (if > 1 max hp)
  if (e.maxHp > 1) {
    const bw = e.w * 0.8;
    const bh = 4;
    const bx = -bw/2;
    const by = -e.h/2 - 12;
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#333';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = e.hp/e.maxHp > 0.5 ? '#39ff14' : e.hp/e.maxHp > 0.25 ? '#ffd700' : '#ff4444';
    ctx.fillRect(bx, by, bw * (e.hp/e.maxHp), bh);
  }

  ctx.restore();
}

// ── DRAW BULLET ──
function drawBullet(b, isEnemy) {
  ctx.save();
  ctx.translate(b.x, b.y);

  if (b.isKamehameha) {
    const pulseW = b.w * (0.8 + 0.2 * Math.sin(b.life * 0.5));
    const gradient = ctx.createLinearGradient(-Math.abs(pulseW)/2, 0, Math.abs(pulseW)/2, 0);
    gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
    gradient.addColorStop(0.2, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(0.5, '#ffffff');
    gradient.addColorStop(0.8, 'rgba(0, 255, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
    
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#00ffff';
    ctx.shadowBlur = 20;
    ctx.fillRect(-pulseW/2, -b.h/2, pulseW, b.h);
    
    // Core intense white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-pulseW/6, -b.h/2, pulseW/3, b.h);
  } else if (b.homing) {
    ctx.rotate(Math.atan2(b.vy, b.vx) + Math.PI/2);
    ctx.beginPath();
    ctx.moveTo(0, -b.h/2);
    ctx.lineTo(b.w, b.h/2);
    ctx.lineTo(-b.w, b.h/2);
    ctx.closePath();
    ctx.fillStyle = b.color;
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 12;
    ctx.fill();
    
    // Smoke trail
    if (b.life % 2 === 0) {
      spawnParticles(b.x, b.y + b.h/2, '#ffffff', 1);
    }
  } else {
    ctx.shadowColor = b.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = b.color;
    ctx.fillRect(-b.w/2, -b.h/2, b.w, b.h);
  }

  ctx.restore();
}

// ── DRAW POWERUP ──
function drawPowerup(p) {
  p.pulse += 0.08;
  const scale = 1 + 0.12 * Math.sin(p.pulse);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(scale, scale);

  // Glow ring
  ctx.beginPath();
  ctx.arc(0, 0, p.w * 0.65, 0, Math.PI*2);
  ctx.strokeStyle = p.color;
  ctx.lineWidth = 2;
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 18;
  ctx.stroke();

  // Box
  ctx.fillStyle = `${p.color}33`;
  ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);

  // Label
  ctx.shadowBlur = 0;
  ctx.font = 'bold 13px Orbitron, monospace';
  ctx.fillStyle = p.color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(p.label, 0, 0);

  ctx.restore();
}

// ── DRAW BOSS ──
function drawBoss(b) {
  ctx.save();
  ctx.translate(b.x, b.y);

  const isHit = b.hitFlash > 0;
  const color = isHit ? '#ffffff' : '#ff2244';

  // Rotating Outer Ring
  ctx.save();
  ctx.rotate(frameCount * 0.015);
  ctx.beginPath();
  for(let i=0; i<8; i++){
    ctx.moveTo(b.w/2.4, 0);
    ctx.lineTo(b.w/2.8, 12);
    ctx.lineTo(b.w/2.8, -12);
    ctx.rotate(Math.PI/4);
  }
  ctx.closePath();
  ctx.fillStyle = isHit ? '#ffffff' : '#220011';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.stroke();
  ctx.restore();

  // Central Hub Armor
  ctx.beginPath();
  ctx.moveTo(0, -b.h/2.5);
  ctx.lineTo(b.w/3, -b.h/4);
  ctx.lineTo(b.w/3, b.h/4);
  ctx.lineTo(0, b.h/2.5);
  ctx.lineTo(-b.w/3, b.h/4);
  ctx.lineTo(-b.w/3, -b.h/4);
  ctx.closePath();
  ctx.fillStyle = '#0a0a0a';
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Primary Cannon (bottom)
  ctx.fillStyle = '#333';
  ctx.fillRect(-12, b.h/2.5, 24, 18);
  ctx.fillStyle = '#ff2244';
  ctx.fillRect(-8, b.h/2.5 + 10, 16, 8);

  // Core Eye
  const eyePulse = 6 + Math.sin(frameCount * 0.1) * 2;
  ctx.beginPath();
  ctx.arc(0, 0, eyePulse, 0, Math.PI*2);
  ctx.fillStyle = isHit ? '#ffffff' : '#00e5ff';
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 20;
  ctx.fill();

  ctx.restore();

  // Boss Health Bar (HUD)
  if (b.phase !== 'entering') {
    ctx.save();
    const barW = Math.min(400, canvas.width - 80);
    const barX = canvas.width/2 - barW/2;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(barX, 48, barW, 12);
    ctx.fillStyle = '#ff2244';
    ctx.shadowColor = '#ff2244';
    ctx.shadowBlur = 10;
    ctx.fillRect(barX, 48, barW * (b.hp / b.maxHp), 12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, 48, barW, 12);
    ctx.font = '700 12px Orbitron, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 0;
    ctx.fillText('BOSS', canvas.width/2, 40);
    ctx.restore();
  }
}

// ── GAME OVER ──
function triggerGameOver() {
  gameRunning = false;
  MusicEngine.stop();
  playSound('gameover');
  spawnParticles(player.x, player.y, '#ff4444', 40);

  const isNew = score > highScore;
  if (isNew) { highScore = score; localStorage.setItem('starblaster_hs', highScore); }

  finalScore.textContent    = score;
  finalBest.textContent     = highScore;
  newBestBanner.style.display = isNew ? 'block' : 'none';

  // Let particles render briefly
  setTimeout(() => showScreen('gameOverScreen'), 600);
}

// ── LEVEL UP ──
function levelUp() {
  level++;
  playSound('levelup');
  
  const sectorIdx = Math.min(SECTORS.length - 1, Math.floor((level - 1) / 5));

  if (level % 5 === 0) {
    spawnBoss();
  } else if (level % 5 === 1) {
    showToast(`🚀 ENTERING ${SECTORS[sectorIdx].name} 🚀`);
  } else {
    showToast(`⭐ LEVEL ${level} ⭐`);
  }
  updateHUD();
}

// ── SPAWN INTERVALS (dynamic by level) ──
let enemySpawnTimer = 0;
function enemySpawnInterval() { return Math.max(35, 110 - level * 6); }

// ── MAIN GAME LOOP ──
function gameLoop() {
  if (!gameRunning || paused) return;
  frameCount++;

  // ─ Sector logic
  const sectorIdx = Math.min(SECTORS.length - 1, Math.floor((level - 1) / 5));
  const currentSector = SECTORS[sectorIdx];

  // ─ Clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ─ Starfield
  ctx.fillStyle = currentSector.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawStars(canvas, ctx, currentSector);

  // ─ Player movement (respects control scheme, touch works always)
  const useArrows = controlScheme === 'arrows' || controlScheme === 'both';
  const useWASD   = controlScheme === 'wasd'   || controlScheme === 'both';
  
  if ((useArrows && keys['ArrowLeft'])  || (useWASD && keys['KeyA']) || keys['TouchLeft'])  player.x -= player.speed;
  if ((useArrows && keys['ArrowRight']) || (useWASD && keys['KeyD']) || keys['TouchRight']) player.x += player.speed;
  if ((useArrows && keys['ArrowUp'])    || (useWASD && keys['KeyW']) || keys['TouchUp'])    player.y -= player.speed * 0.8;
  if ((useArrows && keys['ArrowDown'])  || (useWASD && keys['KeyS']) || keys['TouchDown'])  player.y += player.speed * 0.8;

  // Clamp
  player.x = Math.max(player.w/2, Math.min(canvas.width  - player.w/2, player.x));
  player.y = Math.max(player.h/2, Math.min(canvas.height - player.h/2, player.y));

  // Auto-shoot
  if (keys['Space'] && gameRunning) spawnBullet();
  if (player.shootCooldown > 0) player.shootCooldown--;

  // Power-up timers
  if (player.multiShotTimer > 0) {
    player.multiShotTimer--;
    if (player.multiShotTimer === 0 && selectedShip !== 'juggernaut') player.multiShot = false;
  }
  if (player.shieldTimer > 0)  player.shieldTimer--;
  if (player.rapidTimer > 0) {
    player.rapidTimer--;
    if (player.rapidTimer === 0) player.shootRate = SHIP_STATS[selectedShip].fireRate;
  }
  if (player.berserkerTimer > 0) {
    player.berserkerTimer--;
    if (player.berserkerTimer === 0) {
      player.shootRate = player.oldFireRate;
      player.speed /= 1.3;
      showToast('🔥 BERSERKER EXPIRED');
    }
  }
  if (player.homingTimer > 0) player.homingTimer--;
  if (invincibleTimer > 0) invincibleTimer--;

  // Combo Drain
  if (comboTimer > 0) {
    comboTimer--;
    if (comboTimer === 0) {
      comboCount = 0;
      if (comboMultiplier > 1) {
        comboMultiplier = 1;
        updateHUD();
      }
    }
  }

  // ─ Spawn enemies (only if no boss)
  if (!boss) {
    enemySpawnTimer++;
    if (enemySpawnTimer >= enemySpawnInterval()) {
      enemySpawnTimer = 0;
      spawnEnemy();
      if (level >= 3 && Math.random() < 0.3) spawnEnemy(); // bonus spawn
    }
  }

  // ─ Level up on score (only if no boss is currently active, so we don't skip boss fight via score)
  const nextLevelScore = level * 200;
  if (score >= nextLevelScore && !boss) {
    levelUp();
    if (boss) {
      stats.bossKills++;
      localStorage.setItem('starblaster_stats', JSON.stringify(stats));
      checkAchievements();
    }
  }

  // ─ Boss Logic
  if (boss) {
    if (boss.hitFlash > 0) boss.hitFlash--;
    if (boss.phase === 'entering') {
      boss.y += boss.vy;
      if (boss.y >= 120) {
        boss.phase = 'attacking';
        boss.y = 120;
      }
    } else if (boss.phase === 'attacking') {
      boss.timer++;
      
      // Move side to side
      boss.x += boss.vx;
      if (boss.x < boss.w/2 + 30 || boss.x > canvas.width - boss.w/2 - 30) boss.vx *= -1;
      
      // Change Attack pattern every 3 seconds
      if (boss.timer % 180 === 0) boss.attackPattern = Math.floor(Math.random() * 3);
      
      // Execute attacks
      if (boss.attackPattern === 0 && boss.timer % 30 === 0) {
        // Aimed burst at player
        const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
        enemyBullets.push({ x: boss.x, y: boss.y + boss.h/2, w: 10, h: 10, vy: Math.sin(angle)*6, vx: Math.cos(angle)*6, color: '#ff3333' });
      } else if (boss.attackPattern === 1 && boss.timer % 12 === 0) {
        // Spiral Spray
        const angle = (boss.timer * 0.1) % (Math.PI * 2);
        enemyBullets.push({ x: boss.x, y: boss.y + boss.h/2, w: 8, h: 8, vy: Math.sin(angle)*5, vx: Math.cos(angle)*5, color: '#ff00ff' });
      } else if (boss.attackPattern === 2 && boss.timer % 60 === 0) {
        // Shotgun wave
        for(let i=-2; i<=2; i++){
          enemyBullets.push({ x: boss.x, y: boss.y + boss.h/2, w: 6, h: 18, vy: 5, vx: i*1.8, color: '#ffd700' });
        }
      }
    }
  }

  // ─ Move bullets
  bullets = bullets.filter(b => {
    b.life++;
    if (b.isFlak && b.life > 20) {
      spawnParticles(b.x, b.y, '#ff9f43', 3);
      return false; 
    }
    if (b.homing) {
      const target = enemies[0] || boss;
      if (target) {
        const angle = Math.atan2(target.y - b.y, target.x - b.x);
        b.vx += Math.cos(angle) * 1.5;
        b.vy += Math.sin(angle) * 1.5;
        // Limit speed
        const speed = Math.hypot(b.vx, b.vy);
        if (speed > 14) {
          b.vx = (b.vx / speed) * 14;
          b.vy = (b.vy / speed) * 14;
        }
      }
    }
    b.y += b.vy;
    if (b.vx) b.x += b.vx;
    return b.y > -20 && b.y < canvas.height + 20 && b.x > -20 && b.x < canvas.width + 20;
  });

  // ─ Move enemy bullets
  enemyBullets = enemyBullets.filter(b => {
    b.y += b.vy;
    if (b.vx) b.x += b.vx;
    return b.y < canvas.height + 20 && b.x > -20 && b.x < canvas.width + 20;
  });

  // ─ Move enemies
  enemies.forEach(e => {
    if (e.typeIdx === 3) {
      // Kamikaze Seeker AI
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      e.vx = Math.cos(angle) * e.speed;
      e.vy = Math.sin(angle) * e.speed;
      e.y += e.vy;
      e.x += e.vx;
    } else if (e.typeIdx === 4 && e.y >= 60) {
      // Sniper stops at y=60
      e.y = 60;
      e.x += e.vx;
    } else {
      e.y += e.speed;
      e.x += e.vx;
    }

    if (e.x < e.w/2 || e.x > canvas.width - e.w/2) e.vx *= -1;
    if (e.hitFlash > 0) e.hitFlash--;
    
    // Shoot
    if (e.typeIdx === 4 && Math.random() < e.shootChance && e.y >= 60) {
      // Sniper thin fast bullet aimed at player
      const angle = Math.atan2(player.y - e.y, player.x - e.x);
      enemyBullets.push({ x: e.x, y: e.y + e.h/2, w: 2, h: 20, vy: Math.sin(angle)*7, vx: Math.cos(angle)*7, color: '#00ffaa' });
    } else if (Math.random() < e.shootChance && e.y > 0 && e.typeIdx !== 3 && e.typeIdx !== 4) {
      enemyBullets.push({ x: e.x, y: e.y + e.h/2, w: 4, h: 12, vy: 4 + level*0.2, color: '#ff4444' });
    }
  });
  enemies = enemies.filter(e => e.y < canvas.height + 60);

  // ─ Spawn & Move Asteroids
  if (Math.random() < 0.003 + level * 0.0006) spawnAsteroid();
  
  if (currentSector.name === 'CRYSTAL BELT' && Math.random() < 0.02) spawnIceShard();
  if (currentSector.name === 'MAGMA CORE'   && Math.random() < 0.025) spawnLavaBurst();
  if (currentSector.name === 'VOID EDGE'    && Math.random() < 0.01) spawnGravityWell();

  asteroids = asteroids.filter(a => {
    a.x += a.vx;
    a.y += a.vy;
    a.rot += a.rotSpeed;
    if (a.x < -a.w || a.x > canvas.width + a.w) return false;
    return a.y < canvas.height + a.h;
  });

  hazards = hazards.filter(h => {
    h.y += h.vy;
    h.x += h.vx;

    // Special Hazard Effects
    if (h.type === 'gravity') {
      const dist = Math.hypot(player.x - h.x, player.y - h.y);
      if (dist < h.w * 2) {
        const angle = Math.atan2(h.y - player.y, h.x - player.x);
        player.x += Math.cos(angle) * h.pullForce * 15;
        player.y += Math.sin(angle) * h.pullForce * 15;
      }
    }

    if (h.type === 'lava') return h.y > -40; // Lava moves up
    return h.y < canvas.height + 40;
  });

  hazards.forEach(h => {
    if (hits(h, player)) {
      if (player.shieldTimer > 0) {
        player.shieldTimer = 0;
        h._dead = true;
        spawnParticles(h.x, h.y, '#00e5ff', 15);
        playSound('hit');
        showToast('🛡️ SHIELD BROKEN!');
      } else {
        lives--;
        invincibleTimer = 140;
        h._dead = true;
        playSound('explosion');
        spawnParticles(h.x, h.y, '#ffffff', 20);
        updateHUD();
        shakeScreen();
        if (lives <= 0) triggerGameOver();
      }
    }
  });
  hazards = hazards.filter(h => !h._dead);
  
  // ─ Move powerups
  powerups.forEach(p => p.y += p.vy);
  powerups = powerups.filter(p => p.y < canvas.height + 40);

  // ─ Bullet vs Asteroid collisions
  bullets.forEach(b => {
    asteroids.forEach(a => {
      if (!b._dead && a.hp > 0 && hits(b, a)) {
        if (!b.isKamehameha) b._dead = true;
        a.hp -= b.isKamehameha ? 2 : 1;
        spawnParticles(b.x, b.y, '#666', 4);
        if (a.hp <= 0) {
           a._dead = true;
           spawnParticles(a.x, a.y, '#444', 15);
           playSound('hit');
           score += 5;
           updateHUD();
        }
      }
    });
  });
  asteroids = asteroids.filter(a => !a._dead);
  bullets = bullets.filter(b => !b._dead);

  // ─ Enemy bullets vs Asteroids (Asteroids absorb them)
  enemyBullets.forEach(b => {
    asteroids.forEach(a => {
      if (!b._dead && hits(b, a)) {
        b._dead = true;
        spawnParticles(b.x, b.y, '#666', 4);
      }
    });
  });
  enemyBullets = enemyBullets.filter(b => !b._dead);

  // ─ Bullet vs Enemy collisions
  bullets.forEach((b, bi) => {
    enemies.forEach((e, ei) => {
      if (!b._dead && !e._dead && hits(b, e)) {
        if (!b.isKamehameha) b._dead = true;
        e.hp -= b.isKamehameha ? 2 : 1;
        e.hitFlash = 6;
        spawnParticles(b.x, b.y, e.color, 6);
        if (e.hp <= 0) {
          comboCount++;
          comboTimer = 150; // 2.5 seconds
          const oldMult = comboMultiplier;
          comboMultiplier = 1 + Math.floor(comboCount / 5);
          if (comboMultiplier > oldMult && comboMultiplier <= 5) {
            spawnComboText(`x${comboMultiplier} COMBO!`);
            playSound('levelup');
          }

          if (energy < 100) {
            energy += 5;
            if (energy > 100) energy = 100;
          }
          if (berserkerEnergy < 100) {
            berserkerEnergy += 8;
            if (berserkerEnergy > 100) berserkerEnergy = 100;
          }

          stats.totalKills++;
          localStorage.setItem('starblaster_stats', JSON.stringify(stats));
          checkAchievements();

          score += e.score * comboMultiplier;
          updateHUD();
          spawnParticles(e.x, e.y, e.color, 22);
          playSound('explosion');
          spawnPowerup(e.x, e.y);
          e._dead = true;
        } else {
          playSound('hit');
        }
      }
    });
  });
  bullets  = bullets.filter(b => !b._dead);
  enemies  = enemies.filter(e => !e._dead);

  // ─ Bullet vs Boss collisions
  if (boss && boss.phase === 'attacking') {
    bullets.forEach((b) => {
      if (!b._dead && hits(b, boss)) {
        if (!b.isKamehameha) b._dead = true;
        boss.hp -= b.isKamehameha ? 2 : 1;
        boss.hitFlash = 6;
        spawnParticles(b.x, b.y, '#ff3333', 6);
        if (boss.hp <= 0 && !boss._dead) {
          boss._dead = true;
          score += boss.score;
          updateHUD();
          spawnParticles(boss.x, boss.y, '#ff0000', 100);
          playSound('explosion');
          // Shower player with powerups upon defeating boss
          for(let i=0; i<4; i++) spawnPowerup(boss.x + (Math.random()*60-30), boss.y + (Math.random()*60-30));
          showToast('🏆 BOSS DEFEATED! 🏆');
          boss = null;
          enemyBullets = []; // clear remaining boss bullets
        } else {
          playSound('hit');
        }
      }
    });
    bullets = bullets.filter(b => !b._dead);
  }

  // ─ Enemy bullet vs Player
  if (invincibleTimer === 0) {
    enemyBullets.forEach(b => {
      if (hits(b, player)) {
        b._dead = true;
        if (player.shieldTimer > 0) {
          // Shield absorbs the hit
          player.shieldTimer = 0;
          spawnParticles(player.x, player.y, '#00e5ff', 20);
          playSound('hit');
          showToast('🛡️ SHIELD BROKEN!');
        } else {
          lives--;
          invincibleTimer = 120;
          playSound('hit');
          spawnParticles(player.x, player.y, '#00e5ff', 14);
          updateHUD();
          if (lives <= 0) triggerGameOver();
        }
      }
    });
    enemyBullets = enemyBullets.filter(b => !b._dead);

    // ─ Boss body vs Player
    if (boss && hits(boss, player)) {
      if (player.shieldTimer > 0) {
        player.shieldTimer = 0;
        showToast('🛡️ SHIELD BROKEN!');
      } else {
        lives--;
        invincibleTimer = 140;
        updateHUD();
        if (lives <= 0) triggerGameOver();
      }
    }

    // ─ Asteroid vs Player
    asteroids.forEach(a => {
      if (hits(a, player)) {
        if (player.shieldTimer > 0) {
          player.shieldTimer = 0;
          a._dead = true;
          spawnParticles(a.x, a.y, '#444', 20);
          playSound('hit');
          showToast('🛡️ SHIELD BROKEN!');
        } else {
          lives--;
          invincibleTimer = 140;
          a._dead = true;
          playSound('explosion');
          spawnParticles(a.x, a.y, '#444', 20);
          spawnParticles(player.x, player.y, '#00e5ff', 20);
          updateHUD();
          shakeScreen();
          if (lives <= 0) triggerGameOver();
        }
      }
    });
    asteroids = asteroids.filter(a => !a._dead);

    // ─ Enemy body vs Player
    enemies.forEach(e => {
      if (hits(e, player)) {
        if (player.shieldTimer > 0) {
          player.shieldTimer = 0;
          spawnParticles(e.x, e.y, e.color, 20);
          e._dead = true;
          playSound('explosion');
          showToast('🛡️ SHIELD BROKEN!');
        } else {
          lives--;
          invincibleTimer = 140;
          playSound('explosion');
          spawnParticles(e.x, e.y, e.color, 20);
          e._dead = true;
          updateHUD();
          shakeScreen();
          if (lives <= 0) triggerGameOver();
        }
      }
    });
    enemies = enemies.filter(e => !e._dead);
  }

  // ─ Player vs Powerup
  powerups.forEach(p => {
    if (hits(p, player)) {
      p._dead = true;
      playSound('powerup');
      if (p.type === 'multishot') {
        player.multiShot = true;
        player.multiShotTimer = 420;
        showToast('🔥 TRIPLE SHOT!');
      } else if (p.type === 'life' && lives < 5) {
        lives++;
        updateHUD();
        showToast('❤️ EXTRA LIFE!');
      } else if (p.type === 'speed') {
        player.speed = 8;
        setTimeout(() => player.speed = 5, 5000);
        showToast('⚡ SPEED BOOST!');
      } else if (p.type === 'shield') {
        player.shieldTimer = 360;  // 6 seconds
        showToast('🛡️ SHIELD ON!');
      } else if (p.type === 'rapidfire') {
        player.rapidTimer = 480;   // 8 seconds — halves shoot rate
        player.shootRate = Math.max(5, Math.floor(SHIP_STATS[selectedShip].fireRate / 2));
        showToast('🔫 RAPID FIRE!');
      } else if (p.type === 'homing') {
        player.homingTimer = 420;  // 7 seconds
        showToast('🚀 HOMING MISSILES!');
      } else if (p.type === 'drone') {
        const angle = drones.length * Math.PI * 0.6;
        drones.push({
          x: player.x, y: player.y,
          offsetX: Math.cos(angle) * 45,
          offsetY: 20,
          shootCooldown: 30
        });
        showToast('🤖 DRONE SUPPORT!');
      } else if (p.type === 'bomb') {
        // Destroy ALL on-screen enemies
        enemies.forEach(e => {
          score += e.score;
          spawnParticles(e.x, e.y, e.color, 20);
          playSound('explosion');
        });
        enemies = [];
        updateHUD();
        showToast('💥 BOMB! SCREEN CLEAR!');
      }
      spawnParticles(p.x, p.y, p.color, 14);
    }
  });
  powerups = powerups.filter(p => !p._dead);

  // ─ Support Drones logic
  drones.forEach(d => {
    // Follow player with lag
    const targetX = player.x + d.offsetX;
    const targetY = player.y + d.offsetY;
    d.x += (targetX - d.x) * 0.1;
    d.y += (targetY - d.y) * 0.1;

    // Firing logic
    d.shootCooldown--;
    if (d.shootCooldown <= 0) {
      const nearest = enemies[0] || boss;
      if (nearest) {
        bullets.push({ 
          x: d.x, y: d.y, w: 3, h: 8, 
          vy: -14, vx: (nearest.x - d.x) * 0.02, 
          color: '#ffffff', life: 0 
        });
        d.shootCooldown = 45;
      }
    }
  });

  // ─ Update particles
  particles.forEach(p => {
    if (p.isEMP) {
      p.r += 35; 
      p.alpha -= p.decay;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.alpha -= p.decay;
      p.r *= 0.97;
    }
  });
  particles = particles.filter(p => p.alpha > 0.02);

  // ════ DRAW ════

  // Particles (behind ships)
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    if (p.isEMP) {
      ctx.lineWidth = 15;
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.stroke();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  });

  // Power-ups
  powerups.forEach(drawPowerup);

  // Drones
  drones.forEach(d => {
    ctx.save();
    ctx.translate(d.x, d.y);
    ctx.rotate(frameCount * 0.1);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#00ffaa';
    ctx.shadowBlur = 10;
    ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  });

  // Enemy bullets
  enemyBullets.forEach(b => drawBullet(b, true));

  // Player bullets
  bullets.forEach(b => drawBullet(b, false));

  // Enemies
  enemies.forEach(drawEnemyShip);

  // Asteroids
  asteroids.forEach(drawAsteroid);

  // Hazards
  hazards.forEach(h => {
    ctx.save();
    ctx.translate(h.x, h.y);
    
    if (h.type === 'ice') {
      ctx.rotate(frameCount * 0.05);
      ctx.beginPath();
      ctx.moveTo(0, -h.h/2);
      ctx.lineTo(h.w/2, 0);
      ctx.lineTo(0, h.h/2);
      ctx.lineTo(-h.w/2, 0);
      ctx.closePath();
      ctx.fillStyle = 'rgba(200, 255, 255, 0.6)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fill();
    } 
    else if (h.type === 'lava') {
      const pulse = 0.8 + 0.2 * Math.sin(frameCount * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, h.w/2 * pulse, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, h.w/2);
      grd.addColorStop(0, '#ffff00');
      grd.addColorStop(0.4, '#ff4400');
      grd.addColorStop(1, 'rgba(255, 68, 0, 0)');
      ctx.fillStyle = grd;
      ctx.fill();
      // Glow
      ctx.shadowColor = '#ff4400';
      ctx.shadowBlur = 15;
      ctx.fill();
    }
    else if (h.type === 'gravity') {
      ctx.rotate(frameCount * -0.02);
      // Outer ring
      ctx.beginPath();
      ctx.arc(0, 0, h.w/2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(191, 95, 255, 0.4)';
      ctx.setLineDash([5, 10]);
      ctx.lineWidth = 2;
      ctx.stroke();
      // Inner core
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(0, 0, h.w/4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fill();
      ctx.strokeStyle = '#bf5fff';
      ctx.stroke();
    }

    ctx.restore();
  });

  // Boss
  if (boss) drawBoss(boss);

  // Player
  if (player.berserkerTimer > 0) {
    const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.2);
    ctx.save();
    ctx.shadowColor = '#ff3e5e';
    ctx.shadowBlur = 20 + pulse * 15;
    ctx.globalAlpha = 0.4 + pulse * 0.3;
    drawShip(player.x, player.y, player.w + 10, player.h + 10, '#ff3e5e', false);
    ctx.restore();
  }
  drawShip(player.x, player.y, player.w, player.h, player.color, invincibleTimer > 0);

  // Shield ring
  if (player.shieldTimer > 0) {
    const pulse = 0.6 + 0.4 * Math.sin(frameCount * 0.15);
    ctx.save();
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.w * 0.9 + 8, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0,229,255,${pulse})`;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 16;
    ctx.stroke();
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillStyle = '#00e5ff';
    ctx.textAlign = 'center';
    ctx.shadowBlur = 6;
    ctx.fillText(`🛡️ ${Math.ceil(player.shieldTimer / 60)}s`, player.x, player.y + player.h/2 + 22);
    ctx.restore();
  }

  // Active power-up indicators (stacked below ship)
  let indicatorY = player.y + player.h/2 + (player.shieldTimer > 0 ? 36 : 18);
  const drawIndicator = (emoji, timer, color) => {
    ctx.save();
    ctx.font = '700 10px Orbitron, monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.fillText(`${emoji} ${Math.ceil(timer / 60)}s`, player.x, indicatorY);
    ctx.restore();
    indicatorY += 16;
  };
  if (player.multiShot)          drawIndicator('🔥', player.multiShotTimer || 9999, '#ff9f43');
  if (player.rapidTimer > 0)     drawIndicator('🔫', player.rapidTimer,     '#ff00ff');
  if (player.homingTimer > 0)    drawIndicator('🚀', player.homingTimer,    '#ff3366');

  requestAnimationFrame(gameLoop);
}

// ── PILOT RECORD ──
function updatePilotRecord() {
  const statKills = document.getElementById('statKills');
  const statBosses = document.getElementById('statBosses');
  const statUpgrades = document.getElementById('statUpgrades');

  if (statKills) statKills.textContent = stats.kills || 0;
  if (statBosses) statBosses.textContent = stats.bossesDefeated || 0;
  
  // Count total upgrades across all ships
  let upgradeCount = 0;
  Object.values(shipUpgrades).forEach(ship => {
    upgradeCount += (ship.speed || 0) + (ship.fireRate || 0) + (ship.energy || 0);
  });
  if (statUpgrades) statUpgrades.textContent = upgradeCount;

  updateAchievementPreview(upgradeCount);
}

function updateAchievementPreview(totalUpgrades) {
  const bar = document.getElementById('previewBarFill');
  const percentText = document.getElementById('previewPercent');
  const hint = document.getElementById('previewHint');
  if (!bar) return;

  const milestones = [
    { label: 'Alien Slayer', target: 500, current: stats.kills || 0, unit: 'kills' },
    { label: 'Galaxy Guardian', target: 10, current: stats.bossesDefeated || 0, unit: 'bosses' },
    { label: 'Master Engineer', target: 15, current: totalUpgrades, unit: 'upgrades' }
  ];

  // Find the first milestone that isn't completed yet
  const next = milestones.find(m => m.current < m.target) || milestones[milestones.length - 1];
  const percent = Math.min(100, Math.floor((next.current / next.target) * 100));

  bar.style.width = `${percent}%`;
  percentText.textContent = `${percent}%`;
  
  if (next.current >= next.target) {
    hint.textContent = "🏆 ALL PREVIEW RANKS ACHIEVED! Check Medals for more.";
  } else {
    hint.textContent = `Progress: ${next.current}/${next.target} ${next.unit} to reach '${next.label}' rank.`;
  }
}

// ── MENU LOOP (animated starfield) ──
function menuLoop() {
  if (document.getElementById('menuScreen').classList.contains('active')) {
    bgCtx.fillStyle = '#020510';
    bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
    drawStars(bgCanvas, bgCtx);
    requestAnimationFrame(menuLoop);
  }
}

// ── INIT ──
updateHUD();
updatePilotRecord();
menuHighScore.textContent = highScore;
initStars(bgCanvas);
showScreen('menuScreen');
menuLoop();

// Start menu music on first user interaction (browser policy)
document.body.addEventListener('click', function startMusicOnce() {
  MusicEngine.start('menu');
  document.body.removeEventListener('click', startMusicOnce);
}, { once: true });

// Mute button wiring
const btnMusicToggle = document.getElementById('btnMusicToggle');
if (btnMusicToggle) {
  // Reflect stored state on load
  if (MusicEngine.isMuted) btnMusicToggle.textContent = '🔇 MUSIC: OFF';
  btnMusicToggle.onclick = () => {
    const muted = MusicEngine.toggleMute();
    btnMusicToggle.textContent = muted ? '🔇 MUSIC: OFF' : '🔊 MUSIC: ON';
  };
}
