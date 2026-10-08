const clamp=x=>Math.max(0,Math.min(1,x));
// A damped free surface. Its trapezoidal mean stays at the actual money level.
export class FluidSurface {
  constructor(count=19){this.level=0;this.target=0;this.velocity=0;this.offsets=new Float64Array(count);this.speeds=new Float64Array(count);}
  set(ratio,animate=true){
    this.target=clamp(Number.isFinite(ratio)?ratio:0);
    if(!animate){this.level=this.target;this.velocity=0;this.offsets.fill(0);this.speeds.fill(0);return;}
    const impulse=Math.max(-.16,Math.min(.16,(this.target-this.level)*10));
    for(let i=0;i<this.speeds.length;i++)this.speeds[i]+=Math.sin(i*.6)*impulse;
  }
  step(dt){
    const steps=Math.max(1,Math.ceil(Math.min(.05,dt)*120)),d=Math.min(.05,dt)/steps;
    for(let k=0;k<steps;k++){
      this.velocity+=((this.target-this.level)*120-this.velocity*23)*d;this.level=clamp(this.level+this.velocity*d);
      for(let i=0;i<this.offsets.length;i++){
        const x=this.offsets[i],left=this.offsets[Math.max(0,i-1)],right=this.offsets[Math.min(this.offsets.length-1,i+1)];
        this.speeds[i]+=(-x*70+(left+right-2*x)*160-this.speeds[i]*9)*d;
      }
      for(let i=0;i<this.offsets.length;i++)this.offsets[i]+=this.speeds[i]*d;
    }
    const moving=Math.abs(this.level-this.target)>1e-5||Math.abs(this.velocity)>1e-4||this.offsets.some(x=>Math.abs(x)>1e-5)||this.speeds.some(x=>Math.abs(x)>1e-4);
    if(!moving)this.set(this.target,false);return moving;
  }
  points(){
    const n=this.offsets.length,last=n-1;
    let mean=0;for(let i=0;i<n;i++)mean+=this.offsets[i]*((i===0||i===last)?.5:1)/last;
    const extent=Math.max(...this.offsets.map(x=>Math.abs(x-mean))),amplitude=Math.min(.006,this.level*.25,(1-this.level)*.25),scale=extent>amplitude?amplitude/extent:1;
    return Array.from(this.offsets,(x,i)=>({x:this.level+(x-mean)*scale,y:i/last}));
  }
}
export class FluidGauge {
  constructor(gauge){
    this.surface=new FluidSurface();this.path=gauge.querySelector('path');this.marker=gauge.querySelector('.gauge-previous');this.cue=document.getElementById('walletDelta');this.raf=0;this.last=0;this.previous=null;
    document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(this.raf);this.raf=0;this.surface.set(this.surface.target,false);this.paint();}});
  }
  update(value,{privacy=false,reduced=false,format}={}){
    const ratio=privacy ? .5 : (value?.ratio??0),old=this.previous;
    const changed=old&&value&&old.amount!==value.amount;
    this.cue.textContent=changed&&!privacy?(value.amount>old.amount?'+':'−')+format(Math.abs(value.amount-old.amount)):'';
    this.cue.title='Variation depuis la période précédente';this.cue.classList.toggle('visible',!!this.cue.textContent);
    clearTimeout(this.cueTimer);this.cueTimer=setTimeout(()=>this.cue.classList.remove('visible'),3000);
    this.marker.hidden=!changed||privacy||!old.reference||!value.reference||old.reference!==value.reference;
    this.marker.style.left=(old?.ratio??0)*100+'%';this.marker.classList.toggle('visible',!this.marker.hidden);
    clearTimeout(this.markerTimer);this.markerTimer=setTimeout(()=>this.marker.classList.remove('visible'),2400);
    this.previous=value;cancelAnimationFrame(this.raf);this.raf=0;this.last=0;
    this.surface.set(ratio,!!old&&!reduced&&!privacy&&!document.hidden);this.paint();
    if(!reduced&&!privacy&&!document.hidden)this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  frame(time){
    this.raf=0;const moving=this.surface.step(this.last?(time-this.last)/1000:1/60);this.last=time;this.paint();
    if(moving&&!document.hidden)this.raf=requestAnimationFrame(t=>this.frame(t));
  }
  paint(){
    const points=this.surface.points();this.path.setAttribute('d','M0 0 '+points.map(p=>`L${(p.x*1000).toFixed(4)} ${(p.y*100).toFixed(4)}`).join(' ')+' L0 100 Z');
  }
}
