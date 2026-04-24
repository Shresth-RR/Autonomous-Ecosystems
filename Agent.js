// Agent.js
let _uid = 0;

class Agent {
  constructor(x,y,dna) {
    this.id          = _uid++;
    this.pos         = {x,y};
    this.vel         = {x:rnd(-1,1), y:rnd(-1,1)};
    this.acc         = {x:0,y:0};
    this.dna         = dna || randomDNA();
    this.wanderAngle = Math.random()*Math.PI*2;
    this.dead        = false;
    this.state       = 'wander';
    this.age         = 0;
    this.trail       = [];
    this.lastBirth   = -999999;
    this.birthTimer  = 10;
    this._initPhysics();
    this.energy = this.emax * 0.6;
  }

  _initPhysics() {
    const d=this.dna;
    this.size=d.size; this.mass=Math.max(0.3,d.size**3);
    this.maxSpeed=d.maxSpeed; this.maxForce=this.mass*CFG.BASE_FORCE*d.agility;
    this.perception=d.perception; this.emax=80*this.mass; this.r=4+this.size*4;
  }

  applyForce(f) { this.acc.x+=f.x/this.mass; this.acc.y+=f.y/this.mass; }

  integrate(W,H,showTrails,nightDrain) {
    this.vel=vclamp(vadd(this.vel,this.acc),this.maxSpeed);
    this.pos.x=((this.pos.x+this.vel.x)+W)%W;
    this.pos.y=((this.pos.y+this.vel.y)+H)%H;
    this.acc={x:0,y:0}; this.wanderAngle+=rnd(-0.3,0.3); this.age++;
    if(this.birthTimer>0) this.birthTimer--;
    const spd=vmag(this.vel);
    this.energy-=((0.0025*this.mass*spd*spd)+(0.0008*this.perception)+0.02)*nightDrain;
    if(this.energy<=0) this.dead=true;
    if(showTrails){
      this.trail.push({x:this.pos.x,y:this.pos.y});
      if(this.trail.length>20) this.trail.shift();
    } else if(this.trail.length) this.trail.length=0;
  }

  canReproduce(now) {
    return this.energy>CFG.REPRO_THRESH*this.emax
        &&(now-this.lastBirth)>CFG.REPRO_CD
        &&Math.random()<CFG.REPRO_PROB;
  }

  reproduce(Cls,now) {
    const cost=CFG.REPRO_COST*this.emax;
    this.energy-=cost; this.lastBirth=now;
    const c=new Cls(this.pos.x+rnd(-14,14),this.pos.y+rnd(-14,14),mutateDNA(this.dna));
    c.energy=cost; return c;
  }

  _r() { return this.birthTimer>0 ? this.r*(1-(this.birthTimer/10)*0.5) : this.r; }
}

function drawHerbivores(ctx, herbs, opts) {
  if(!herbs.length) return;

  // --- Glows (all same low-opacity fill, single pass) ---
  ctx.beginPath();
  for(let i=0;i<herbs.length;i++){
    const h=herbs[i], r=h._r();
    ctx.moveTo(h.pos.x+r*2.2, h.pos.y);
    ctx.arc(h.pos.x, h.pos.y, r*2.2, 0, Math.PI*2);
  }
  ctx.fillStyle='rgba(80,160,255,0.07)'; ctx.fill();

  // --- Bodies — bucketed by state into 3 color groups ---
  // bucket 0: wander (#55aaff), 1: seek (#3df09a), 2: flee (#ff4455)
  const FILLS  =['#55aaff','#3df09a','#ff4455'];
  const EDGES  =['rgba(180,220,255,0.35)','rgba(180,255,210,0.35)','rgba(255,180,180,0.35)'];
  const buckets=[[],[],[]];

  for(let i=0;i<herbs.length;i++){
    const h=herbs[i];
    const b= opts.behav ? (h.state==='flee'?2 : h.state==='seek'?1 : 0) : 0;
    buckets[b].push(h);
  }

  for(let b=0;b<3;b++){
    const list=buckets[b]; if(!list.length) continue;
    // Fill pass
    ctx.beginPath();
    for(let i=0;i<list.length;i++){
      const h=list[i], r=h._r();
      const vn=vnorm(h.vel);
      const px=-vn.y*r*0.78, py=vn.x*r*0.78;
      ctx.moveTo(h.pos.x+vn.x*r*1.4, h.pos.y+vn.y*r*1.4);
      ctx.lineTo(h.pos.x+px,          h.pos.y+py);
      ctx.lineTo(h.pos.x-px,          h.pos.y-py);
      ctx.closePath();
    }
    ctx.fillStyle=FILLS[b]; ctx.fill();
    // Edge pass (same path geometry — stroke only)
    ctx.beginPath();
    for(let i=0;i<list.length;i++){
      const h=list[i], r=h._r();
      const vn=vnorm(h.vel);
      const px=-vn.y*r*0.78, py=vn.x*r*0.78;
      ctx.moveTo(h.pos.x+vn.x*r*1.4, h.pos.y+vn.y*r*1.4);
      ctx.lineTo(h.pos.x+px,          h.pos.y+py);
      ctx.lineTo(h.pos.x-px,          h.pos.y-py);
      ctx.closePath();
    }
    ctx.strokeStyle=EDGES[b]; ctx.lineWidth=0.6; ctx.stroke();
  }

  // energy bars
  if(opts.energy) {
    for(let i=0;i<herbs.length;i++) _drawEBar(ctx,herbs[i]);
  }

  // inspect ring
  if(opts.inspId>=0){
    for(let i=0;i<herbs.length;i++){
      if(herbs[i].id!==opts.inspId) continue;
      const h=herbs[i], r=h._r();
      ctx.beginPath(); ctx.arc(h.pos.x,h.pos.y,r*2.2,0,Math.PI*2);
      ctx.strokeStyle='#ffe844'; ctx.lineWidth=1.8;
      ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
      break;
    }
  }
}

function drawPredators(ctx, preds, opts) {
  if(!preds.length) return;

  // --- Glows ---
  ctx.beginPath();
  for(let i=0;i<preds.length;i++){
    const p=preds[i], r=p._r();
    ctx.moveTo(p.pos.x+r*2.2, p.pos.y);
    ctx.arc(p.pos.x, p.pos.y, r*2.2, 0, Math.PI*2);
  }
  ctx.fillStyle='rgba(255,60,60,0.08)'; ctx.fill();

  // --- Outer ring (all same stroke) ---
  ctx.beginPath();
  for(let i=0;i<preds.length;i++){
    const p=preds[i], r=p._r();
    ctx.moveTo(p.pos.x+r*1.7, p.pos.y);
    ctx.arc(p.pos.x, p.pos.y, r*1.7, 0, Math.PI*2);
  }
  ctx.strokeStyle='rgba(255,80,80,0.28)'; ctx.lineWidth=1; ctx.stroke();

  // --- Bodies: wander vs hunt ---
  const wanderers=[], hunters=[];
  for(let i=0;i<preds.length;i++)
    (preds[i].state==='hunt'?hunters:wanderers).push(preds[i]);

  function drawDiamonds(list, fillColor) {
    if(!list.length) return;
    ctx.beginPath();
    for(let i=0;i<list.length;i++){
      const p=list[i], r=p._r();
      const vn=vnorm(p.vel);
      const px=-vn.y*r*0.9, py=vn.x*r*0.9;
      ctx.moveTo(p.pos.x+vn.x*r*1.6,  p.pos.y+vn.y*r*1.6);
      ctx.lineTo(p.pos.x+px,           p.pos.y+py);
      ctx.lineTo(p.pos.x-vn.x*r*0.8,  p.pos.y-vn.y*r*0.8);
      ctx.lineTo(p.pos.x-px,           p.pos.y-py);
      ctx.closePath();
    }
    ctx.fillStyle=fillColor; ctx.fill();
    ctx.strokeStyle='rgba(255,180,180,0.22)'; ctx.lineWidth=0.7; ctx.stroke();
  }
  drawDiamonds(wanderers,'#c03030');
  drawDiamonds(hunters,  '#ff3838');

  // --- Energy bars ---
  if(opts.energy){
    for(let i=0;i<preds.length;i++) _drawEBar(ctx,preds[i]);
  }

  // --- Inspect ring ---
  if(opts.inspId>=0){
    for(let i=0;i<preds.length;i++){
      if(preds[i].id!==opts.inspId) continue;
      const p=preds[i], r=p._r();
      ctx.beginPath(); ctx.arc(p.pos.x,p.pos.y,r*2.5,0,Math.PI*2);
      ctx.strokeStyle='#ffe844'; ctx.lineWidth=1.8;
      ctx.setLineDash([4,3]); ctx.stroke(); ctx.setLineDash([]);
      break;
    }
  }
}

// Energy bar — plain fillRect, no roundRect (faster)
function _drawEBar(ctx, a) {
  const frac=clamp(a.energy/a.emax,0,1);
  const bw=a.r*2.6, bh=3, bx=a.pos.x-bw/2, by=a.pos.y-a.r-8;
  ctx.fillStyle='rgba(0,0,0,0.45)'; ctx.fillRect(bx,by,bw,bh);
  ctx.fillStyle=frac<0.3?'#f43':frac>0.6?'#3d8':'#f93';
  ctx.fillRect(bx,by,bw*frac,bh);
}

// Trails — one stroke per agent but minimal state changes
function drawAllTrails(ctx, agents, r, g, b) {
  ctx.lineWidth=1;
  for(let i=0;i<agents.length;i++){
    const t=agents[i].trail; if(t.length<2) continue;
    ctx.beginPath(); ctx.moveTo(t[0].x,t[0].y);
    for(let j=1;j<t.length;j++) ctx.lineTo(t[j].x,t[j].y);
    ctx.strokeStyle=`rgba(${r},${g},${b},0.3)`; ctx.stroke();
  }
}

// Perception — all agents in one path
function drawAllPerception(ctx, agents, color) {
  ctx.beginPath();
  for(let i=0;i<agents.length;i++)
    ctx.arc(agents[i].pos.x,agents[i].pos.y,agents[i].perception,0,Math.PI*2);
  ctx.strokeStyle=color; ctx.lineWidth=0.5;
  ctx.setLineDash([3,5]); ctx.stroke(); ctx.setLineDash([]);
}

// ═══════════════════════════════════════════════════════════════════════════
class Herbivore extends Agent {
  constructor(x,y,dna) { super(x,y,dna); this.type='herb'; }

  update(foodGrid,predGrid,W,H,now,useGrid,allFood,allPred,showTrails,nightDrain) {
    let nearFood,nearPred;
    if(useGrid){
      nearFood=foodGrid.query(this.pos.x,this.pos.y,this.perception);
      nearPred=predGrid.query(this.pos.x,this.pos.y,this.perception);
    } else {
      const p2=this.perception**2;
      nearFood=allFood.filter(f=>d2(this.pos.x,this.pos.y,f.pos.x,f.pos.y)<=p2);
      nearPred=allPred.filter(p=>d2(this.pos.x,this.pos.y,p.pos.x,p.pos.y)<=p2);
    }
    let closestPred=null,fearLevel=0;
    for(const p of nearPred){
      const t=1-Math.sqrt(d2(this.pos.x,this.pos.y,p.pos.x,p.pos.y))/this.perception;
      if(t>fearLevel){fearLevel=t;closestPred=p;}
    }
    let closestFood=null,bestFD=Infinity;
    for(const f of nearFood){
      const dist=Math.sqrt(d2(this.pos.x,this.pos.y,f.pos.x,f.pos.y));
      if(dist<bestFD){bestFD=dist;closestFood=f;}
    }
    const hunger=1-this.energy/this.emax;
    let sx=0,sy=0;
    if(fearLevel>0.8&&closestPred){
      this.state='flee';
      const f=steerFlee(this.pos,this.vel,closestPred.pos,this.maxSpeed,this.maxForce);
      sx+=f.x*this.dna.fearWeight*2; sy+=f.y*this.dna.fearWeight*2;
    } else {
      if(closestFood&&hunger>0.25){
        this.state='seek';
        const f=steerArrival(this.pos,this.vel,closestFood.pos,this.maxSpeed,this.maxForce,40);
        const w=this.dna.foodWeight*hunger*1.6; sx+=f.x*w; sy+=f.y*w;
      }
      if(closestPred){
        this.state=fearLevel>0.4?'flee':(closestFood?'seek':'wander');
        const f=steerFlee(this.pos,this.vel,closestPred.pos,this.maxSpeed,this.maxForce);
        const w=this.dna.fearWeight*fearLevel*2.2; sx+=f.x*w; sy+=f.y*w;
      }
      if(!closestFood&&!closestPred){
        this.state='wander';
        const f=steerWander(this.vel,this.wanderAngle,this.maxForce);
        sx+=f.x; sy+=f.y;
      }
    }
    this.applyForce(vclamp({x:sx,y:sy},this.maxForce));
    this.integrate(W,H,showTrails,nightDrain);
    for(const f of nearFood){
      if(!f.dead&&d2(this.pos.x,this.pos.y,f.pos.x,f.pos.y)<(6*this.size)**2){
        this.energy=Math.min(this.emax,this.energy+(f.bonus||25));
        f.dead=true; break;
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
class Predator extends Agent {
  constructor(x,y,dna) { super(x,y,dna); this.type='pred'; this.kills=0; }

  update(herbGrid,W,H,now,useGrid,allHerb,showTrails,nightDrain) {
    let nearHerb;
    if(useGrid) nearHerb=herbGrid.query(this.pos.x,this.pos.y,this.perception);
    else {
      const p2=this.perception**2;
      nearHerb=allHerb.filter(h=>d2(this.pos.x,this.pos.y,h.pos.x,h.pos.y)<=p2);
    }
    let closestHerb=null,bestHD=Infinity;
    for(const h of nearHerb){
      if(h.dead) continue;
      const dist=Math.sqrt(d2(this.pos.x,this.pos.y,h.pos.x,h.pos.y));
      if(dist<bestHD){bestHD=dist;closestHerb=h;}
    }
    const hunger=1-this.energy/this.emax;
    let sx=0,sy=0;
    if(closestHerb){
      this.state='hunt';
      const f=steerArrival(this.pos,this.vel,closestHerb.pos,this.maxSpeed,this.maxForce,30);
      const w=this.dna.huntWeight*(0.5+hunger); sx+=f.x*w; sy+=f.y*w;
    } else {
      this.state='wander';
      const f=steerWander(this.vel,this.wanderAngle,this.maxForce);
      sx+=f.x; sy+=f.y;
    }
    this.applyForce(vclamp({x:sx,y:sy},this.maxForce));
    this.integrate(W,H,showTrails,nightDrain);
    for(const h of nearHerb){
      if(!h.dead&&d2(this.pos.x,this.pos.y,h.pos.x,h.pos.y)<(7*this.size)**2&&this.size>=h.size*0.85){
        this.energy=Math.min(this.emax,this.energy+50+20*h.mass);
        h.dead=true; this.kills++;
        return {killX:h.pos.x,killY:h.pos.y};
      }
    }
    return null;
  }
}
