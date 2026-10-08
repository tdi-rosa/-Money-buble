// A damped spring field with positional circle collisions. No DOM dependency.
export class BubbleField {
  constructor(){this.bodies=[];this.width=400;this.height=400;this.dragId=null;this.dragTarget=null;this.settled=false;this.transition=0;}
  resize(w,h){this.width=w;this.height=h;}
  reconcile(specs){this.settled=false;this.transition=0;const existing=new Map(this.bodies.map(b=>[b.id,b]));const wanted=new Set();for(const s of specs){wanted.add(s.id);let b=existing.get(s.id);if(!b){b={...s,x:s.spawnX??s.tx,y:s.spawnY??s.ty,vx:0,vy:0,r:s.persistent?s.targetR:1,alpha:s.persistent?1:0};this.bodies.push(b)}const from={x:b.x,y:b.y,r:b.r};Object.assign(b,s,{targetAlpha:1,retired:false,from});}for(const b of this.bodies)if(!wanted.has(b.id)){b.retired=true;b.targetAlpha=0;b.targetR=0;}}
  step(dt){this.transition+=dt;dt=Math.min(Math.max(dt,0),this.bodies.every(b=>b.layoutLocked)? .1:1/30);const ease=1-Math.exp(-9*dt),damping=Math.exp(-6.5*dt);for(const b of this.bodies){const progress=Math.min(1,this.transition/.38),t=progress*progress*(3-2*progress);
      if(b.layoutLocked&&b.from){b.r=(b.from.r+(b.targetR-b.from.r)*t)*(1-.12*Math.sin(Math.PI*progress));}else b.r+=(b.targetR-b.r)*ease;b.alpha+=((b.targetAlpha??1)-b.alpha)*ease;if(b.id===this.dragId){if(this.dragTarget){const follow=1-Math.exp(-22*dt),oldX=b.x,oldY=b.y;b.x+=(this.dragTarget.x-b.x)*follow;b.y+=(this.dragTarget.y-b.y)*follow;b.vx=(b.x-oldX)/Math.max(dt,.001)*.35;b.vy=(b.y-oldY)/Math.max(dt,.001)*.35;}continue;}if(b.layoutLocked){b.x=b.from.x+(b.tx-b.from.x)*t;b.y=b.from.y+(b.ty-b.from.y)*t;b.vx=b.vy=0;continue;}b.vx+=(b.tx-b.x)*19*dt;b.vy+=(b.ty-b.y)*19*dt;b.vx*=damping;b.vy*=damping;const speed=Math.hypot(b.vx,b.vy);if(speed>1400){b.vx*=1400/speed;b.vy*=1400/speed}b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.layoutLocked)continue;const pad=b.r+7;if(b.x<pad)b.x+=(pad-b.x)*ease;if(b.x>this.width-pad)b.x+=(this.width-pad-b.x)*ease;if(b.y<pad)b.y+=(pad-b.y)*ease;if(b.y>this.height-pad)b.y+=(this.height-pad-b.y)*ease;}
    // Fully packed targets need no collision work while the user pans or zooms.
    // Offscreen arrivals are not projected on top of one another before entry.
    const visible=this.bodies.filter(b=>b.x+b.r>=0&&b.x-b.r<=this.width&&b.y+b.r>=0&&b.y-b.r<=this.height);
    resolveCollisions(visible,{dragId:this.dragId});
    this.bodies=this.bodies.filter(b=>!b.retired||b.alpha>.015);
    this.settled=this.transition>=.38&&!this.dragId&&this.bodies.every(b=>b.layoutLocked&&!b.retired);
    if(this.settled)for(const b of this.bodies){b.x=b.tx;b.y=b.ty;b.r=b.targetR;b.alpha=b.targetAlpha;b.vx=b.vy=0;}
  }
  // Live springs operate in world space. The camera never changes physical radii.
  stepLive(dt,{viewport=null,pixelScale=1,organic=false}={}){
    const steps=Math.max(1,Math.ceil(Math.min(.05,Math.max(0,dt))*60)),delta=Math.min(.05,Math.max(0,dt))/steps;
    this.time=(this.time||0)+dt;
    const tolerance=.025/Math.max(.01,pixelScale);let contactError=0;
    for(let step=0;step<steps;step++){
      for(const b of this.bodies){
        b.vx=Number.isFinite(b.vx)?b.vx:0;b.vy=Number.isFinite(b.vy)?b.vy:0;
        b.r=b.targetR;b.alpha=1;
        if(b.id===this.dragId&&this.dragTarget){
          const follow=1-Math.exp(-28*delta),oldX=b.x,oldY=b.y;
          b.x+=(this.dragTarget.x-b.x)*follow;b.y+=(this.dragTarget.y-b.y)*follow;
          b.vx=(b.x-oldX)/Math.max(delta,.001)*.25;b.vy=(b.y-oldY)/Math.max(delta,.001)*.25;
        }else{
          const amplitude=organic&&b.inPeriod!==false?Math.min(4/Math.max(.01,pixelScale),Math.max(1/Math.max(.01,pixelScale),b.r*.22)):0,phase=b.phase??0;
          const clustering=b.cluster&&b.inPeriod!==false;
          const x=(clustering?b.centerX:b.motionX??b.tx)+Math.sin(this.time*.9+phase)*amplitude,y=(clustering?b.centerY:b.motionY??b.ty)+Math.cos(this.time*.7+phase)*amplitude,arriving=clustering&&(b.arriving===true||(b.arriving===undefined&&Math.hypot(b.x-b.centerX,b.y-b.centerY)>Math.hypot(b.tx-b.centerX,b.ty-b.centerY)+b.r*2+20)),
            gathering=clustering&&this.time<(b.gatheringUntil??0),damping=Math.exp(-(arriving||gathering?12:clustering?5:12)*delta),spring=arriving||gathering||b.departing?35:clustering?1:55;
          b.vx=(b.vx+(x-b.x)*spring*delta)*damping;b.vy=(b.vy+(y-b.y)*spring*delta)*damping;
          const speed=Math.hypot(b.vx,b.vy),limit=b.travelSpeed/Math.max(.05,pixelScale);if(b.travelSpeed&&speed>limit){b.vx*=limit/speed;b.vy*=limit/speed;}
          b.x+=b.vx*delta;b.y+=b.vy*delta;
        }
      }
      const local=viewport?this.bodies.filter(b=>b.x+b.r>=viewport.left&&b.x-b.r<=viewport.right&&b.y+b.r>=viewport.top&&b.y-b.r<=viewport.bottom):this.bodies;
      contactError=resolveLiveContacts(local,{tolerance,dragId:this.dragId});
    }
    this.settled=!organic&&!this.dragId&&contactError<=tolerance&&this.bodies.every(b=>
      Math.hypot(b.x-(b.motionX??b.tx),b.y-(b.motionY??b.ty))<.08/Math.max(.01,pixelScale)&&Math.hypot(b.vx,b.vy)<.15/Math.max(.01,pixelScale));
    return !this.settled;
  }
  hit(x,y,touchRadius=22){
    const visible=this.bodies.filter(b=>!b.retired&&b.inPeriod!==false&&b.alpha>.08);
    const distance=b=>Math.hypot(x-b.x,y-b.y);
    const dragged=visible.find(b=>b.id===this.dragId);
    if(dragged&&distance(dragged)<=dragged.r)return dragged;
    // Actual painted circles always win over the invisible touch padding.
    return [...visible].reverse().find(b=>distance(b)<=b.r)||visible.filter(b=>distance(b)<=Math.max(touchRadius,b.r)).sort((a,b)=>distance(a)-distance(b))[0];
  }
}

// Radius tiers prevent one large expense from putting every small circle in
// the same grid cell. Each pair is considered once, only in neighbouring cells.
export function resolveCollisions(bodies,{iterations=64,tolerance=.001,dragId=null,includeOutgoing=false,impulses=false}={}){
  const visible=bodies.filter(b=>!b.retired&&(includeOutgoing||b.inPeriod!==false)&&b.alpha>=.1);
  if(visible.length<2)return 0;
  const sorted=visible.map(b=>({b,level:Math.ceil(Math.log2(Math.max(4,b.r*2+(b.collisionGap??2))))})).sort((a,b)=>b.level-a.level);
  let residual=0;
  for(let iteration=0;iteration<iterations;iteration++){
    const levels=new Map();let worst=0;
    for(const {b,level} of sorted){
      for(const [tier,grid] of levels){
        const cell=2**tier,gx=Math.floor(b.x/cell),gy=Math.floor(b.y/cell);
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of grid.get((gx+dx)+':'+(gy+dy))||[]){
          const ax=b.x-other.x,ay=b.y-other.y,minimum=b.r+other.r+Math.min(b.collisionGap??2,other.collisionGap??2);
          if(Math.abs(ax)>=minimum||Math.abs(ay)>=minimum)continue;
          const distance=Math.hypot(ax,ay),overlap=minimum-distance;if(overlap<=tolerance)continue;worst=Math.max(worst,overlap);
          let nx,ny;if(distance>.00001){nx=ax/distance;ny=ay/distance;}else{const seed=(String(b.id)+String(other.id)).split('').reduce((n,c)=>n+c.charCodeAt(0),0)*2.3999632297;nx=Math.cos(seed);ny=Math.sin(seed);}
          const invA=b.id===dragId?0:1/Math.max(1,b.r*b.r),invB=other.id===dragId?0:1/Math.max(1,other.r*other.r),total=invA+invB;
          if(!total)continue;const correction=(overlap+tolerance)/total;
          b.x+=nx*correction*invA;b.y+=ny*correction*invA;other.x-=nx*correction*invB;other.y-=ny*correction*invB;
          if(impulses){const closing=((b.vx||0)-(other.vx||0))*nx+((b.vy||0)-(other.vy||0))*ny;
            if(closing<0){const impulse=-1.08*closing/total;b.vx=(b.vx||0)+nx*impulse*invA;b.vy=(b.vy||0)+ny*impulse*invA;other.vx=(other.vx||0)-nx*impulse*invB;other.vy=(other.vy||0)-ny*impulse*invB;}
          }
        }
      }
      if(!levels.has(level))levels.set(level,new Map());const grid=levels.get(level),cell=2**level,key=Math.floor(b.x/cell)+':'+Math.floor(b.y/cell);
      if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);
    }
    residual=worst;if(worst<=tolerance)break;
  }
  return residual;
}

// Resting circles remain collision obstacles, but only disturbed circles query
// neighbours. A contact wakes its neighbour in the same pass.
function resolveLiveContacts(bodies,{tolerance,dragId}){
  const active=new Set(bodies.filter(b=>b.id===dragId||Math.hypot(b.vx,b.vy)>tolerance||Math.hypot(b.x-(b.motionX??b.tx),b.y-(b.motionY??b.ty))>tolerance));
  if(!active.size)return 0;let residual=0;
  for(let iteration=0;iteration<(bodies.length<=200?8:3);iteration++){
    const tiers=new Map();
    for(const b of bodies){const level=Math.ceil(Math.log2(Math.max(4,b.r*2+(b.collisionGap??2)))),cell=2**level;
      if(!tiers.has(level))tiers.set(level,new Map());const grid=tiers.get(level),key=Math.floor(b.x/cell)+':'+Math.floor(b.y/cell);
      if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);
    }
    const queue=[...active],seen=new Set();let worst=0;
    for(let i=0;i<queue.length;i++){
      const b=queue[i];
      for(const [level,grid] of tiers){
        const cell=2**level,reach=b.r+cell/2+(b.collisionGap??2),minX=Math.floor((b.x-reach)/cell),maxX=Math.floor((b.x+reach)/cell),minY=Math.floor((b.y-reach)/cell),maxY=Math.floor((b.y+reach)/cell);
        const buckets=[];
        if((maxX-minX+1)*(maxY-minY+1)>grid.size*2){for(const [key,bucket] of grid){const [x,y]=key.split(':').map(Number);if(x>=minX&&x<=maxX&&y>=minY&&y<=maxY)buckets.push(bucket);}}
        else for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){const bucket=grid.get(x+':'+y);if(bucket)buckets.push(bucket);}
        for(const bucket of buckets)for(const other of bucket){
          if(b===other)continue;const pair=String(b.id)<String(other.id)?JSON.stringify([b.id,other.id]):JSON.stringify([other.id,b.id]);if(seen.has(pair))continue;seen.add(pair);
          const ax=b.x-other.x,ay=b.y-other.y,minimum=b.r+other.r+Math.min(b.collisionGap??2,other.collisionGap??2);
          if(Math.abs(ax)>=minimum||Math.abs(ay)>=minimum)continue;const distance=Math.hypot(ax,ay),overlap=minimum-distance;if(overlap<=tolerance)continue;
          if(b.inPeriod!==false&&other.inPeriod!==false){if(b.arriving===true&&other.arriving!==true)b.arriving=false;if(other.arriving===true&&b.arriving!==true)other.arriving=false;}
          worst=Math.max(worst,overlap);const nx=distance>.00001?ax/distance:1,ny=distance>.00001?ay/distance:0,invA=b.id===dragId?0:1/Math.max(1,b.r*b.r),invB=other.id===dragId?0:1/Math.max(1,other.r*other.r),total=invA+invB;if(!total)continue;
          const correction=(overlap+tolerance)/total;b.x+=nx*correction*invA;b.y+=ny*correction*invA;other.x-=nx*correction*invB;other.y-=ny*correction*invB;
          const closing=(b.vx-other.vx)*nx+(b.vy-other.vy)*ny;if(closing<0){const impulse=-1.08*closing/total;b.vx+=nx*impulse*invA;b.vy+=ny*impulse*invA;other.vx-=nx*impulse*invB;other.vy-=ny*impulse*invB;}
          if(!active.has(other)){active.add(other);queue.push(other);}
        }
      }
    }
    residual=worst;if(worst<=tolerance)break;
  }
  return residual;
}
