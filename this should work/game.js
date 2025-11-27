
(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const GROUND_Y = H - 84; // ground top

  const UI = {
    start: document.getElementById('btnStart'),
    pause: document.getElementById('btnPause'),
    mute: document.getElementById('btnMute'),
    restart: document.getElementById('btnRestart'),
    overlay: document.getElementById('overlay'),
    score: document.getElementById('score'),
    high: document.getElementById('high')
  };

  // --- Audio (WebAudio, no external files) ---
  const Audio = (() => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    const ctxA = new AudioCtx();
    let masterGain = ctxA.createGain();
    masterGain.gain.value = 0.4;
    masterGain.connect(ctxA.destination);
    let musicOsc = null;
    let muted = false;

    function startMusic() {
      if (musicOsc) return;
      musicOsc = ctxA.createOscillator();
      musicOsc.type = 'sine';
      const gain = ctxA.createGain();
      gain.gain.value = 0.07;
      const lfo = ctxA.createOscillator();
      lfo.type = 'sine'; lfo.frequency.value = 0.3;
      const lfoGain = ctxA.createGain();
      lfoGain.gain.value = 25;
      lfo.connect(lfoGain); lfoGain.connect(musicOsc.frequency);
      musicOsc.connect(gain).connect(masterGain);
      musicOsc.frequency.value = 220;
      musicOsc.start(); lfo.start();
    }
    function stopMusic(){ if(musicOsc){ try{ musicOsc.stop(); }catch{} musicOsc.disconnect(); musicOsc=null; }}
    function blip(freq=440, dur=0.08){
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0, ctxA.currentTime);
      g.gain.linearRampToValueAtTime(0.5, ctxA.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
      o.connect(g).connect(masterGain); o.start(); o.stop(ctxA.currentTime + dur);
    }
    function setMuted(m) { muted = m; masterGain.gain.value = m ? 0 : 0.4; }
    function isMuted(){ return muted; }
    return { startMusic, stopMusic, blip, setMuted, isMuted };
  })();

  // --- Game State ---
  let state = {
    running: false,
    paused: false,
    speed: 6,
    score: 0,
    high: Number(localStorage.getItem('runner.high')||0),
    tick: 0
  };
  UI.high.textContent = state.high;

  const player = {
    x: 120, y: GROUND_Y-60, w: 50, h: 60,
    vy: 0, onGround: true, slide: false, slideTimer: 0,
    anim: 0
  };

  const keys = new Set();
  document.addEventListener('keydown', e => {
    keys.add(e.key.toLowerCase());
    try { Audio.startMusic(); } catch {}
  });
  document.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));

  const obstacles = [];
  const coins = [];
  const pUps = [];

  const rand = (min,max)=>Math.random()*(max-min)+min;
  const chance = p=>Math.random()<p;

  function rectsOverlap(a,b){ return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

  function spawnObstacle(){
    const types = ['box','spike','moving'];
    const t = types[Math.floor(rand(0, types.length))];
    let o;
    if (t==='box') o = {x: W+20, y: GROUND_Y-40, w: 40, h: 40, type:t};
    else if (t==='spike') o = {x: W+20, y: GROUND_Y-30, w: 36, h: 30, type:t};
    else o = {x: W+20, y: GROUND_Y-50, w: 40, h: 50, type:t, vy: rand(-1.5, -0.5)};
    obstacles.push(o);
  }
  function spawnCoinLine(){
    const y = rand(GROUND_Y-200, GROUND_Y-80);
    for(let i=0;i<5;i++) coins.push({x: W + i*38, y, r: 9});
  }
  function spawnPowerUp(){
    const kinds = ['shield','boost','magnet'];
    const k = kinds[Math.floor(rand(0,kinds.length))];
    pUps.push({x: W+20, y: rand(GROUND_Y-220,GROUND_Y-80), w: 28, h: :k, dur: 6});
  }

  const effects = { shield:0, boost:0, magnet:0 };

  const bg = {
    hills: Array.from({length:5}, (_,i)=>({x: i*260, y: GROUND_Y-120, w: 240, h: 100})),
    clouds: Array.from({length:6}, (_,i)=>({x: rand(0,W), y: rand(30,140), r: rand(20,40)}))
  };

  let last = performance.now();
  function loop(t){
    if(!state.running || state.paused){ requestAnimationFrame(loop); return; }
    const dt = (t - last)/16.67;
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function start(){
    state.running = true; state.paused = false; state.score = 0; state.speed = 6; state.tick = 0;
    obstacles.length = 0; coins.length = 0; pUps.length = 0;
    effects.shield = effects.boost = effects.magnet = 0;
    player.x = 120; player.y = GROUND_Y-60; player.vy = 0; player.onGround = true; player.slide=false; player.slideTimer = 0;
    UI.overlay.classList.remove('show');
    try { Audio.startMusic(); } catch {}
    requestAnimationFrame(loop);
  }

  function restart(){ UI.overlay.querySelector('.panel h1').textContent = 'Endless Runner+'; start(); }
  function pause(){ state.paused = !state.paused; }

  function update(dt){
    state.tick += dt;
    if (state.tick % 600 < 1) state.speed += 0.15;

    if (keys.has('w') && player.onGround) { player.vy = -12.5; player.onGround = false; Audio.blip(660); }
    if (keys.has('s') && player.onGround && !player.slide) { player.slide = true; player.slideTimer = 30; Audio.blip(300); }
    if (keys.has('a')) player.x -= 0.8 * dt * (effects.boost?1.6:1);
    if (keys.has('d')) player.x += 0.8 * dt * (effects.boost?1.6:1);
    player.x = Math.max(50, Math.min(player.x, W/2));

    player.vy += 0.6 * dt;
    player.y += player.vy * dt;
    if (player.y >= GROUND_Y - (player.slide?36:60)) { player.y = GROUND_Y - (player.slide?36:60); player.vy = 0; player.onGround = true; }
    if (player.slide) { player.slideTimer -= dt; if (player.slideTimer <= 0) player.slide = false; }

    if (chance(0.03 * dt)) spawnObstacle();
    if (chance(0.02 * dt)) spawnCoinLine();
    if (chance(0.004 * dt)) spawnPowerUp();

    bg.hills.forEach(h=>{ h.x -= state.speed*0.25*dt; if(h.x + h.w < 0) h.x = W + rand(40,120); });
    bg.clouds.forEach(c=>{ c.x -= 0.4*dt; if(c.x + c.r*2 < 0) { c.x = W + rand(0,80); c.y = rand(30,160);} });

    obstacles.forEach(o=>{ o.x -= state.speed * dt; if (o.type==='moving') { o.y += o.vy * dt; if(o.y < GROUND_Y-200 || o.y > GROUND_Y-50) o.vy *= -1; } });
    while(obstacles.length && obstacles[0].x + obstacles[0].w < 0) obstacles.shift();

    coins.forEach(c=> c.x -= state.speed * dt);
    while(coins.length && coins[0].x + coins[0].r < 0) coins.shift();

    pUps.forEach(p=> p.x -= state.speed * dt);
    while(pUps.length && pUps[0].x + pUps[0].w < 0) pUps.shift();

    if (effects.magnet>0){
      coins.forEach(c=>{
        const dx = player.x + player.w/2 - c.x; const dy = player.y + (player.slide?18:30) - c.y;
        const d = Math.hypot(dx,dy);
        if(d < 140){ c.x += dx/d * 2.2 * dt; c.y += dy/d * 2.2 * dt; }
      });
    }

    const pRect = {x:player.x, y:player.y, w:player.w, h:(player.slide?36:60)};
    for(const o of obstacles){
      if (rectsOverlap(pRect,{x:o.x,y:o.y,w:o.w,h:o.h})){
        if (effects.shield>0){ effects.shield = 0; Audio.blip(200); player.x -= 20; continue; }
        gameOver(); return;
      }
    }
    for(let i=coins.length-1;i>=0;i--){ const c = coins[i]; const dx = (player.x+player.w/2)-c.x; const dy=(player.y+(player.slide?18:30))-c.y; if(Math.hypot(dx,dy) < c.r + 18){ coins.splice(i,1); state.score += 25; Audio.blip(880,0.05); } }
    for(let i=pUps.length-1;i>=0;i--){ const p = pUps[i]; if(rectsOverlap(pRect,{x:p.x,y:p.y,w:p.w,h:p.h})){
      pUps.splice(i,1);
      if(p.kind==='shield') effects.shield = p.dur;
      if(p.kind==='boost') effects.boost = p.dur;
      if(p.kind==='magnet') effects.magnet = p.dur;
      Audio.blip(520,0.12);
    } }

    ['shield','boost','magnet'].forEach(k=>{ if(effects[k]>0){ effects[k]-=dt/60; if(effects[k]<0) effects[k]=0; } });

    state.score += Math.floor(1 * dt);
    UI.score.textContent = state.score;
  }

  function gameOver(){
    state.running = false; state.paused = false; Audio.blip(160,0.25); Audio.stopMusic();
    if (state.score > state.high){ state.high = state.score; localStorage.setItem('runner.high', String(state.high)); }
    UI.high.textContent = state.high;
    const panel = UI.overlay.querySelector('.panel');
    panel.innerHTML = `<h1>Game Over</h1>
      <p>Score: <strong>${state.score}</strong></p>
      <p>Best: <strong>${state.high}</strong></p>
      <p><small>Press <b>R</b> or click to play again</small></p>
      <button id="btnPlayAgain">Play Again</button>`;
    UI.overlay.classList.add('show');
    document.getElementById('btnPlayAgain').onclick = restart;
  }

  function draw(){
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = '#aee9ff'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = '#fff'; bg.clouds.forEach(c=>{ drawCloud(c.x,c.y,c.r); });
    ctx.fillStyle = '#7cc46b'; bg.hills.forEach(h=>{ drawHill(h.x,h.y,h.w,h.h); });
    ctx.fillStyle = '#3fa34d'; ctx.fillRect(0,GROUND_Y,W,H-GROUND_Y);
    ctx.fillStyle = '#2e7d32'; for(let x=0;x<W; x+=40){ ctx.fillRect(x,GROUND_Y+40,20,8); }
    coins.forEach(c=>{ drawCoin(c.x,c.y,c.r); });
    pUps.forEach(p=>{ drawPowerUp(p); });
    obstacles.forEach(o=>{ drawObstacle(o); });
    drawPlayer();
    drawBadges();
  }

  function drawCloud(x,y,r){ ctx.save(); ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.arc(x+r*0.9,y+5,r*0.9,0,Math.PI*2); ctx.arc(x-r*0.9,y+8,r*0.8,0,Math.PI*2); ctx.fill(); ctx.restore(); }
  function drawHill(x,y,w,h){ ctx.save(); ctx.beginPath(); ctx.moveTo(x,y+h); ctx.quadraticCurveTo(x+w*0.5,y-h*0.6, x+w, y+h); ctx.fill(); ctx.restore(); }
  function drawCoin(x,y,r){ ctx.save(); ctx.fillStyle='#f1c40f'; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#d4a20f'; ctx.lineWidth=3; ctx.stroke(); ctx.restore(); }
  function drawPowerUp(p){ ctx.save(); if(p.kind==='shield'){ ctx.strokeStyle='#3498db'; ctx.lineWidth=3; ctx.beginPath(); ctx.rect(p.x,p.y,p.w,p.h); ctx.stroke(); ctx.fillStyle='rgba(52,152,219,.2)'; ctx.fillRect(p.x,p.y,p.w,p.h); }
    else if(p.kind==='boost'){ ctx.fillStyle='#e67e22'; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.fillStyle='#fff'; ctx.fillRect(p.x+6,p.y+6,p.w-12,p.h-12); }
    else { ctx.fillStyle='#2ecc71'; ctx.fillRect(p.x,p.y,p.w,p.h); ctx.fillStyle='#27ae60'; ctx.fillRect(p.x+6,p.y+6,p.w-12,p.h-12); }
    ctx.restore(); }
  function drawObstacle(o){ ctx.save(); if(o.type==='box'){ ctx.fillStyle='#8d6e63'; ctx.fillRect(o.x,o.y,o.w,o.h); }
    else if(o.type==='spike'){ ctx.fillStyle='#666'; ctx.beginPath(); ctx.moveTo(o.x,o.y+o.h); ctx.lineTo(o.x+o.w*0.5,o.y); ctx.lineTo(o.x+o.w,o.y+o.h); ctx.closePath(); ctx.fill(); }
    else { ctx.fillStyle='#b71c1c'; ctx.fillRect(o.x,o.y,o.w,o.h); }
    ctx.restore(); }
  function drawPlayer(){ ctx.save(); const h = (player.slide?36:60), w = player.w;
    ctx.globalAlpha = 0.25; ctx.fillStyle='#000'; ctx.beginPath(); ctx.ellipse(player.x+w/2, player.y+h, 18,6,0,0,Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    const colors = ['#1E88E5','#1976D2','#1565C0','#0D47A1'];
    const c = colors[Math.floor((state.tick/8)%colors.length)];
    ctx.fillStyle=c; ctx.fillRect(player.x, player.y, w, h);
    ctx.fillStyle='#fff'; ctx.fillRect(player.x+10, player.y+8, 22, 16); ctx.fillStyle='#000'; ctx.fillRect(player.x+14, player.y+14, 6,6); ctx.fillRect(player.x+22, player.y+14, 6,6);
    ctx.restore(); }
  function drawBadges(){
    const labels = [];
    if(effects.shield>0) labels.push('🛡️');
    if(effects.boost>0) labels.push('⚡');
    if(effects.magnet>0) labels.push('🧲');
    const s = labels.join(' ');
    if(!s) return;
    ctx.save(); ctx.font='20px system-ui'; ctx.fillStyle='#000'; ctx.fillText(s, player.x+player.w+8, player.y+20); ctx.restore();
  }

  UI.start.onclick = start;
  UI.restart.onclick = restart;
  UI.pause.onclick = ()=>{ pause(); };
  UI.mute.onclick = ()=>{ const m = !Audio.isMuted(); Audio.setMuted(m); };

  document.addEventListener('keydown', e=>{
    const k = e.key.toLowerCase();
    if(k==='p') pause();
    if(k==='m') UI.mute.click();
    if(k==='r') restart();
  });

})();
