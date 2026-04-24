// Grid.js — Uniform spatial grid, rebuilt every frame

class Grid {
  constructor(w,h,cell) {
    this.cols=Math.ceil(w/cell); this.rows=Math.ceil(h/cell);
    this.cell=cell; this.w=w; this.h=h;
    this.b=new Array(this.cols*this.rows).fill(null);
  }
  clear() { this.b.fill(null); }
  insert(a) {
    const i=this._i(a.pos.x,a.pos.y); if(i<0) return;
    if(!this.b[i]) this.b[i]=[]; this.b[i].push(a);
  }
  query(x,y,r) {
    const out=[],r2=r*r;
    const x0=Math.max(0,Math.floor((x-r)/this.cell)), x1=Math.min(this.cols-1,Math.floor((x+r)/this.cell));
    const y0=Math.max(0,Math.floor((y-r)/this.cell)), y1=Math.min(this.rows-1,Math.floor((y+r)/this.cell));
    for(let cy=y0;cy<=y1;cy++) for(let cx=x0;cx<=x1;cx++) {
      const b=this.b[cy*this.cols+cx]; if(!b) continue;
      for(const a of b) { const dx=a.pos.x-x,dy=a.pos.y-y; if(dx*dx+dy*dy<=r2) out.push(a); }
    }
    return out;
  }
  // Call once after construction (and after any resize/rebuild).
  buildOverlay() {
    this._overlay = document.createElement('canvas');
    this._overlay.width  = this.w;
    this._overlay.height = this.h;
    const oc = this._overlay.getContext('2d');

    // Grid lines
    oc.strokeStyle = 'rgba(80,220,140,0.35)'; oc.lineWidth = 0.8;
    for(let x=0;x<=this.w;x+=this.cell){oc.beginPath();oc.moveTo(x,0);oc.lineTo(x,this.h);oc.stroke();}
    for(let y=0;y<=this.h;y+=this.cell){oc.beginPath();oc.moveTo(0,y);oc.lineTo(this.w,y);oc.stroke();}

    // Static coord labels (faint, drawn once)
    const fs = Math.max(9, Math.round(this.cell*0.18));
    oc.font = `${fs}px monospace`; oc.textAlign='left'; oc.textBaseline='top';
    oc.fillStyle = 'rgba(80,220,140,0.22)';
    for(let cy=0;cy<this.rows;cy++) for(let cx=0;cx<this.cols;cx++)
      oc.fillText(`${cx},${cy}`, cx*this.cell+3, cy*this.cell+2);
  }

  draw(ctx) {
    // 1. Blit the pre-rendered lines + coord labels (one drawImage call)
    if(this._overlay) ctx.drawImage(this._overlay, 0, 0);

    ctx.save();
    const fs = Math.max(9, Math.round(this.cell*0.18));
    ctx.font = `${fs}px monospace`; ctx.textAlign='left'; ctx.textBaseline='top';

    // 2. Only iterate occupied cells for density fill + count badge
    const total = this.cols * this.rows;
    for(let i=0;i<total;i++){
      const b = this.b[i]; if(!b||b.length===0) continue;
      const cx = i % this.cols, cy = Math.floor(i / this.cols);
      const px = cx*this.cell, py = cy*this.cell;

      // Density tint
      const density = Math.min(b.length/6, 1);
      ctx.fillStyle = `rgba(80,220,140,${0.04+density*0.11})`;
      ctx.fillRect(px, py, this.cell, this.cell);

      // Agent count badge
      ctx.fillStyle = `rgba(160,255,190,${Math.min(0.5+b.length*0.1, 1)})`;
      ctx.fillText(`[${b.length}]`, px+3, py+fs+4);
    }

    ctx.restore();
  }
  _i(x,y) {
    const cx=Math.floor(x/this.cell), cy=Math.floor(y/this.cell);
    if(cx<0||cy<0||cx>=this.cols||cy>=this.rows) return -1;
    return cy*this.cols+cx;
  }
}
