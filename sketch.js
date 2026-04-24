// sketch.js — main loop, rendering, HUD, input

const canvas = document.getElementById('c');
const ctx    = canvas.getContext('2d');
const chartCanvas = document.getElementById('evo-chart');
const cctx   = chartCanvas.getContext('2d');

// ── Sim state ─────────────────────────────────────────────────────────────
let food=[], herbs=[], preds=[], particles=[];
let foodGrid, herbGrid, predGrid;
let W, H;

// ── Toggles ───────────────────────────────────────────────────────────────
let showPerc=false, showGrid=false, showBehav=true, showEnergy=true, showTrails=false;
let naiveMode=false, hudHidden=false, dayNightAuto=true;

// ── Day/night ─────────────────────────────────────────────────────────────
let dayTick=0;
function getNightFactor() { return 0.5-0.5*Math.cos((dayTick/CFG.DAY_LEN)*Math.PI*2); }
// Pre-compute drain multiplier once per frame (not per-agent)
let _nightDrain=1;

// ── Stats ─────────────────────────────────────────────────────────────────
let herbBorn=0,herbDied=0,predBorn=0,predDied=0,inspId=-1;

// ── Benchmark ─────────────────────────────────────────────────────────────
let warmupStart=0,warmupDone=false,benchStart=0,benchFrames=0,benchFPS=null;

// ── Chart data ────────────────────────────────────────────────────────────
let chartSize=[],chartSpeed=[],chartHPop=[],chartPPop=[],chartTick=0,chartDirty=false;

// ── FPS ───────────────────────────────────────────────────────────────────
let lastFPSTime=performance.now(),fpsFrames=0,currentFPS=0;

// ── Background ───────────────────────────────────────────────────────────
let bgCanvas=null;
function buildBg(){
  bgCanvas=document.createElement('canvas');
  bgCanvas.width=W; bgCanvas.height=H;
  const bc=bgCanvas.getContext('2d');
  bc.fillStyle='#080a12'; bc.fillRect(0,0,W,H);
  const R=38,dx=R*Math.sqrt(3),dy=R*1.5;
  bc.strokeStyle='rgba(255,255,255,0.025)'; bc.lineWidth=0.6;
  for(let row=-1;row<H/dy+2;row++){
    for(let col=-1;col<W/dx+2;col++){
      const ox=col*dx+(row%2)*dx/2, oy=row*dy;
      bc.beginPath();
      for(let i=0;i<6;i++){
        const a=Math.PI/3*i-Math.PI/6;
        const hx=ox+R*0.85*Math.cos(a), hy=oy+R*0.85*Math.sin(a);
        i===0?bc.moveTo(hx,hy):bc.lineTo(hx,hy);
      }
      bc.closePath(); bc.stroke();
    }
  }
}

// ── Particles ─────────────────────────────────────────────────────────────
function spawnKillParticles(x,y){
  for(let i=0;i<8;i++){
    const a=Math.random()*Math.PI*2,s=rnd(1,3.5);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.05,0.10),r:rnd(1.5,3),c:'255,80,30'});
  }
}
function spawnBirthParticles(x,y,isHerb){
  for(let i=0;i<5;i++){
    const a=Math.random()*Math.PI*2,s=rnd(0.5,1.8);
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:rnd(0.06,0.13),r:rnd(1,2.5),c:isHerb?'80,220,255':'255,100,100'});
  }
}
function updateDrawParticles(ctx){
  let i=particles.length;
  while(i--){
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vx*=0.88; p.vy*=0.88; p.life-=p.decay;
    if(p.life<=0){ particles[i]=particles[particles.length-1]; particles.pop(); continue; }
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);
    ctx.fillStyle=`rgba(${p.c},${p.life.toFixed(2)})`; ctx.fill();
  }
}

// ── Swap-remove helper (avoids filter() allocation) ───────────────────────
function swapRemoveDead(arr, diedCounter) {
  let died=0, i=arr.length;
  while(i--){
    if(arr[i].dead){ arr[i]=arr[arr.length-1]; arr.pop(); died++; }
  }
  return died;
}

// ── Init ──────────────────────────────────────────────────────────────────
function init(){
  W=canvas.width=window.innerWidth;
  H=canvas.height=window.innerHeight;
  _uid=0;
  food=[]; herbs=[]; preds=[]; particles=[];
  for(let i=0;i<CFG.INIT_FOOD;i++) food.push(new Food(Math.random()*W,Math.random()*H));
  for(let i=0;i<CFG.INIT_HERB;i++) herbs.push(new Herbivore(Math.random()*W,Math.random()*H));
  for(let i=0;i<CFG.INIT_PRED;i++) preds.push(new Predator(Math.random()*W,Math.random()*H));
  foodGrid=new Grid(W,H,CFG.GRID_CELL);
  herbGrid=new Grid(W,H,CFG.GRID_CELL);
  predGrid=new Grid(W,H,CFG.GRID_CELL);
  foodGrid.buildOverlay(); herbGrid.buildOverlay(); predGrid.buildOverlay();
  herbBorn=CFG.INIT_HERB; herbDied=0; predBorn=CFG.INIT_PRED; predDied=0;
  chartSize=[]; chartSpeed=[]; chartHPop=[]; chartPPop=[]; chartTick=0; chartDirty=true;
  warmupStart=performance.now(); warmupDone=false; benchFPS=null;
  inspId=-1; dayTick=0;
  buildBg();
}

// ── Update ────────────────────────────────────────────────────────────────
function update(now){
  if(dayNightAuto) dayTick++;
  const nightFactor=getNightFactor();
  // Cache drain multiplier for all agents this frame
  _nightDrain = lerp(1, CFG.NIGHT_DRAIN, nightFactor);

  // Rebuild grids
  foodGrid.clear(); herbGrid.clear(); predGrid.clear();
  for(let i=0;i<food.length;i++)  foodGrid.insert(food[i]);
  for(let i=0;i<herbs.length;i++) herbGrid.insert(herbs[i]);
  for(let i=0;i<preds.length;i++) predGrid.insert(preds[i]);

  // Food
  for(let i=0;i<food.length;i++) food[i].update();
  herbDied += swapRemoveDead(food, 0); // reuse helper, dead food just vanishes
  // (re-count properly below — food doesn't count toward herbDied, just purge)
  // Actually purge food separately:
  { let i=food.length; while(i--){ if(food[i].dead){food[i]=food[food.length-1];food.pop();} } }

  const fRate=CFG.FOOD_RATE*lerp(1,0.4,nightFactor);
  while(food.length<CFG.MAX_FOOD&&Math.random()<fRate)
    food.push(new Food(Math.random()*W,Math.random()*H));

  // Herbivores
  const newH=[];
  for(let i=0;i<herbs.length;i++){
    const h=herbs[i]; if(h.dead){herbDied++;continue;}
    h.update(foodGrid,predGrid,W,H,now,!naiveMode,food,preds,showTrails,_nightDrain);
    if(h.dead){herbDied++;continue;}
    if(herbs.length+newH.length<CFG.MAX_HERB&&h.canReproduce(now)){
      const c=h.reproduce(Herbivore,now);
      spawnBirthParticles(c.pos.x,c.pos.y,true);
      newH.push(c); herbBorn++;
    }
  }
  // Swap-remove dead herbs, then append newborns
  { let i=herbs.length; while(i--){ if(herbs[i].dead){herbs[i]=herbs[herbs.length-1];herbs.pop();} } }
  for(let i=0;i<newH.length;i++) herbs.push(newH[i]);

  // Predators
  const newP=[];
  for(let i=0;i<preds.length;i++){
    const p=preds[i]; if(p.dead){predDied++;continue;}
    const kill=p.update(herbGrid,W,H,now,!naiveMode,herbs,showTrails,_nightDrain);
    if(kill) spawnKillParticles(kill.killX,kill.killY);
    if(p.dead){predDied++;continue;}
    if(preds.length+newP.length<CFG.MAX_PRED&&p.canReproduce(now)){
      const c=p.reproduce(Predator,now);
      spawnBirthParticles(c.pos.x,c.pos.y,false);
      newP.push(c); predBorn++;
    }
  }
  { let i=preds.length; while(i--){ if(preds[i].dead){preds[i]=preds[preds.length-1];preds.pop();} } }
  for(let i=0;i<newP.length;i++) preds.push(newP[i]);

  // Benchmark
  const elapsed=(now-warmupStart)/1000;
  if(!warmupDone&&elapsed>=30){warmupDone=true;benchStart=now;benchFrames=0;}
  if(warmupDone){
    benchFrames++;
    if((now-benchStart)>=1000) benchFPS=((benchFrames/((now-benchStart)/1000)).toFixed(1));
  }

  // Chart sample every ~10 s
  chartTick++;
  if(chartTick%600===0){
    chartSize.push(avgDNA(herbs,'size')||0);
    chartSpeed.push(avgDNA(herbs,'maxSpeed')||0);
    chartHPop.push(herbs.length);
    chartPPop.push(preds.length);
    if(chartSize.length>60){chartSize.shift();chartSpeed.shift();chartHPop.shift();chartPPop.shift();}
    chartDirty=true;
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────
function draw(){
  const nightFactor=getNightFactor();

  ctx.drawImage(bgCanvas,0,0);

  // Night overlay — one cheap fillRect
  if(nightFactor>0.01){
    ctx.fillStyle=`rgba(0,5,28,${(nightFactor*0.68).toFixed(2)})`; ctx.fillRect(0,0,W,H);
  }
  if(showTrails){
    ctx.fillStyle='rgba(8,10,18,0.28)'; ctx.fillRect(0,0,W,H);
  }

  if(showGrid) foodGrid.draw(ctx);

  // Night dims everything via globalAlpha — free, no per-agent rgba needed
  ctx.globalAlpha = lerp(1, 0.72, nightFactor);

  // Food
  for(let i=0;i<food.length;i++) food[i].draw(ctx);

  // Trails (before bodies)
  if(showTrails){
    drawAllTrails(ctx,herbs,80,180,255);
    drawAllTrails(ctx,preds,255,70,70);
  }

  // Perception circles (single path per type)
  if(showPerc){
    drawAllPerception(ctx,herbs,'rgba(100,200,255,0.22)');
    drawAllPerception(ctx,preds,'rgba(255,80,80,0.18)');
  }

  // Batched agent draw
  const opts={behav:showBehav,energy:showEnergy,inspId};
  drawHerbivores(ctx,herbs,opts);
  drawPredators(ctx,preds,opts);

  ctx.globalAlpha=1;

  updateDrawParticles(ctx);

  // Inspection panel
  let insp=null;
  if(inspId>=0){
    for(let i=0;i<herbs.length;i++) if(herbs[i].id===inspId){insp=herbs[i];break;}
    if(!insp) for(let i=0;i<preds.length;i++) if(preds[i].id===inspId){insp=preds[i];break;}
  }
  if(insp&&!insp.dead) drawInspect(insp);

  if(chartDirty){ drawChart(); chartDirty=false; }
  updateDayIndicator(nightFactor);
}

// ── Inspect panel ─────────────────────────────────────────────────────────
function drawInspect(a){
  const px=Math.min(a.pos.x+22,W-196),py=Math.max(a.pos.y-10,8);
  ctx.fillStyle='rgba(8,10,22,0.92)';
  ctx.strokeStyle=a.type==='herb'?'rgba(80,200,255,0.5)':'rgba(255,80,80,0.5)';
  ctx.lineWidth=1; ctx.beginPath(); ctx.roundRect(px,py,190,172,7); ctx.fill(); ctx.stroke();
  ctx.font='bold 11px monospace';
  ctx.fillStyle=a.type==='herb'?'#55ccff':'#ff6666';
  ctx.fillText(`[${a.type.toUpperCase()} #${a.id}]`,px+9,py+17);
  ctx.font='10px monospace'; ctx.fillStyle='#bbb';
  const d=a.dna;
  [`State:   ${a.state}`,`Energy:  ${a.energy.toFixed(1)} / ${a.emax.toFixed(1)}`,
   `Age:     ${a.age} frames`,`Size:    ${d.size.toFixed(3)}  Mass: ${a.mass.toFixed(3)}`,
   `Speed:   ${d.maxSpeed.toFixed(3)}`,`Agility: ${d.agility.toFixed(3)}`,
   `Percep:  ${d.perception.toFixed(1)}`,`wFood:   ${d.foodWeight.toFixed(3)}`,
   `wFear:   ${d.fearWeight.toFixed(3)}`,`wHunt:   ${d.huntWeight.toFixed(3)}`,
   a.type==='pred'?`Kills:   ${a.kills}`:'',
  ].forEach((l,i)=>{if(l) ctx.fillText(l,px+9,py+33+i*13);});
}

// ── Chart — only redrawn when data changes ────────────────────────────────
function drawChart(){
  const cw=chartCanvas.offsetWidth, ch=chartCanvas.offsetHeight;
  // Only resize canvas element if dimensions actually changed
  if(chartCanvas.width!==cw) chartCanvas.width=cw;
  if(chartCanvas.height!==ch) chartCanvas.height=ch;
  cctx.clearRect(0,0,cw,ch);
  const n=chartSize.length;
  cctx.font='8.5px monospace';
  cctx.fillStyle='#6effa0'; cctx.fillText('DNA TRENDS',6,11);
  cctx.fillStyle='#555';    cctx.fillText('│ POPULATION',80,11);
  if(n<2){cctx.fillStyle='#333';cctx.font='9px monospace';cctx.fillText('Collecting…',16,ch/2);return;}
  const pad={l:8,r:8,t:16,b:18},pw=cw-pad.l-pad.r,ph=ch-pad.t-pad.b;
  cctx.strokeStyle='rgba(255,255,255,0.04)'; cctx.lineWidth=0.5;
  for(let i=0;i<=3;i++){const y=pad.t+i/3*ph;cctx.beginPath();cctx.moveTo(pad.l,y);cctx.lineTo(cw-pad.r,y);cctx.stroke();}
  function line(data,color,lo,hi){
    cctx.strokeStyle=color; cctx.lineWidth=1.5; cctx.lineJoin='round'; cctx.beginPath();
    for(let i=0;i<n;i++){
      const x=pad.l+i/(n-1)*pw, y=pad.t+ph-clamp((data[i]-lo)/(hi-lo),0,1)*ph;
      i===0?cctx.moveTo(x,y):cctx.lineTo(x,y);
    }
    cctx.stroke();
    const last=data[n-1];
    cctx.fillStyle=color; cctx.font='8px monospace';
    const ly=pad.t+ph-clamp((last-lo)/(hi-lo),0,1)*ph;
    cctx.fillText(last.toFixed(1),pad.l+pw-18,clamp(ly+3,pad.t+8,pad.t+ph));
  }
  line(chartSize,'#66ddff',0.4,1.8);
  line(chartSpeed,'#ff8866',0.5,4.5);
  line(chartHPop,'rgba(80,180,255,0.55)',0,CFG.MAX_HERB);
  line(chartPPop,'rgba(255,80,80,0.55)',0,CFG.MAX_PRED*3);
  cctx.font='7.5px monospace';
  cctx.fillStyle='#66ddff'; cctx.fillText('■Sz',pad.l,ch-3);
  cctx.fillStyle='#ff8866'; cctx.fillText('■Sp',pad.l+24,ch-3);
  cctx.fillStyle='rgba(80,180,255,0.8)'; cctx.fillText('■H',pad.l+50,ch-3);
  cctx.fillStyle='rgba(255,80,80,0.8)';  cctx.fillText('■P',pad.l+66,ch-3);
}

// ── Day indicator ─────────────────────────────────────────────────────────
const _dayEl=document.querySelector('#day-indicator');
function updateDayIndicator(nightFactor){
  if(!_dayEl) return;
  if(!dayNightAuto){_dayEl.textContent='☀ DAY (auto off)';_dayEl.style.color='#666';return;}
  if(nightFactor>0.5){_dayEl.textContent='🌙 NIGHT';_dayEl.style.color='#8899ff';}
  else{_dayEl.textContent='☀ DAY';_dayEl.style.color='#ffdd88';}
}

// ── HUD ───────────────────────────────────────────────────────────────────
const _hudEl=document.getElementById('hud');
function updateHUD(now){
  fpsFrames++;
  const dt=now-lastFPSTime; if(dt<500) return;
  currentFPS=Math.round(fpsFrames/(dt/1000)); fpsFrames=0; lastFPSTime=now;
  _hudEl.classList.toggle('hidden',hudHidden);
  if(hudHidden) return;
  document.getElementById('nf').textContent=food.length;
  document.getElementById('nh').textContent=herbs.length;
  document.getElementById('np').textContent=preds.length;
  document.getElementById('fps').textContent=currentFPS;
  const mel=document.getElementById('mode');
  mel.textContent=naiveMode?'Naive O(n²)':'Grid'; mel.style.color=naiveMode?'#f88':'#6f6';
  const wu=(now-warmupStart)/1000;
  document.getElementById('bench').textContent=
    !warmupDone?`${Math.floor(wu)}s/30s`:(benchFPS?benchFPS+' avg':'…');
  const fmt=v=>v===null?'-':v.toFixed(2);
  document.getElementById('hs').textContent=fmt(avgDNA(herbs,'size'));
  document.getElementById('hsp').textContent=fmt(avgDNA(herbs,'maxSpeed'));
  document.getElementById('hp').textContent=fmt(avgDNA(herbs,'perception'));
  document.getElementById('ps').textContent=fmt(avgDNA(preds,'size'));
  document.getElementById('psp').textContent=fmt(avgDNA(preds,'maxSpeed'));
  document.getElementById('pp').textContent=fmt(avgDNA(preds,'perception'));
  document.getElementById('hb').textContent=herbBorn;
  document.getElementById('hd').textContent=herbDied;
  document.getElementById('pb').textContent=predBorn;
  document.getElementById('pd').textContent=predDied;
}

// ── Input ─────────────────────────────────────────────────────────────────
window.addEventListener('keydown',e=>{
  switch(e.key.toUpperCase()){
    case 'P':showPerc=!showPerc;break;
    case 'G':showGrid=!showGrid;break;
    case 'B':showBehav=!showBehav;break;
    case 'T':showTrails=!showTrails;break;
    case 'E':showEnergy=!showEnergy;break;
    case 'H':hudHidden=!hudHidden;break;
    case 'D':dayNightAuto=!dayNightAuto;break;
    case 'R':init();break;
    case 'F':for(let i=0;i<20;i++) food.push(new Food(Math.random()*W,Math.random()*H));break;
    case 'M':naiveMode=!naiveMode;break;
    case '=':case '+':
      for(let i=0;i<5;i++) herbs.push(new Herbivore(Math.random()*W,Math.random()*H));
      herbBorn+=5;break;
    case '-':case '_':herbs.splice(0,Math.min(5,herbs.length));break;
  }
});

canvas.addEventListener('mousedown',e=>{
  const rect=canvas.getBoundingClientRect();
  const mx=e.clientX-rect.left, my=e.clientY-rect.top;
  let best=null,bestD=500;
  for(let i=0;i<herbs.length;i++){const dd=d2(mx,my,herbs[i].pos.x,herbs[i].pos.y);if(dd<bestD){bestD=dd;best=herbs[i];}}
  for(let i=0;i<preds.length;i++){const dd=d2(mx,my,preds[i].pos.x,preds[i].pos.y);if(dd<bestD){bestD=dd;best=preds[i];}}
  inspId=best?best.id:-1;
});

window.addEventListener('resize',()=>init());

// ── Loop ──────────────────────────────────────────────────────────────────
function loop(now){
  update(now);
  draw();
  updateHUD(now);
  requestAnimationFrame(loop);
}

init();
requestAnimationFrame(loop);
