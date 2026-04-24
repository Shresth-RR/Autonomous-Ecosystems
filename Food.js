// Food.js — food pellets with animated glow

class Food {
  constructor(x,y) {
    this.pos   = {x,y};
    this.dead  = false;
    this.r     = rnd(2.8, 4.5);
    this.pulse = Math.random()*Math.PI*2;
    const rare = Math.random()<0.15;
    this.bonus = rare ? 40 : 25;
    this.halo  = rare ? 'rgba(100,255,180,0.10)' : 'rgba(255,220,50,0.10)';
    this.core  = rare ? '#80ffb4' : '#ffe55a';
  }
  update() { this.pulse += 0.06; }
  draw(ctx) {
    const p=0.82+0.18*Math.sin(this.pulse), {x,y}=this.pos;
    ctx.beginPath(); ctx.arc(x,y,this.r*2.8*p,0,Math.PI*2);
    ctx.fillStyle=this.halo; ctx.fill();
    ctx.beginPath(); ctx.arc(x,y,this.r*p,0,Math.PI*2);
    ctx.fillStyle=this.core; ctx.fill();
  }
}
