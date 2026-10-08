// A damped spring field with positional circle collisions. No DOM dependency.
export class BubbleField {
  constructor(){this.bodies=[];this.width=400;this.height=400;this.dragId=null;this.dragTarget=null;}
  resize(w,h){this.width=w;this.height=h;}
  reconcile(specs){const existing=new Map(this.bodies.map(b=>[b.id,b]));const wanted=new Set();for(const s of specs){wanted.add(s.id);let b=existing.get(s.id);if(!b){b={...s,x:s.spawnX??s.tx,y:s.spawnY??s.ty,vx:0,vy:0,r:1,alpha:0};this.bodies.push(b)}Object.assign(b,s,{targetAlpha:1,retired:false});}for(const b of this.bodies)if(!wanted.has(b.id)){b.retired=true;b.targetAlpha=0;b.targetR=0;}}
  step(dt){dt=Math.min(Math.max(dt,0),this.bodies.every(b=>b.layoutLocked)? .1:1/30);const ease=1-Math.exp(-9*dt),damping=Math.exp(-6.5*dt);for(const b of this.bodies){b.r+=(b.targetR-b.r)*ease;b.alpha+=((b.targetAlpha??1)-b.alpha)*ease;if(b.id===this.dragId){if(this.dragTarget){const follow=1-Math.exp(-22*dt),oldX=b.x,oldY=b.y;b.x+=(this.dragTarget.x-b.x)*follow;b.y+=(this.dragTarget.y-b.y)*follow;b.vx=(b.x-oldX)/Math.max(dt,.001)*.35;b.vy=(b.y-oldY)/Math.max(dt,.001)*.35;}continue;}if(b.layoutLocked){b.x+=(b.tx-b.x)*ease;b.y+=(b.ty-b.y)*ease;b.vx=b.vy=0;continue;}b.vx+=(b.tx-b.x)*19*dt;b.vy+=(b.ty-b.y)*19*dt;b.vx*=damping;b.vy*=damping;const speed=Math.hypot(b.vx,b.vy);if(speed>1400){b.vx*=1400/speed;b.vy*=1400/speed}b.x+=b.vx*dt;b.y+=b.vy*dt;if(b.layoutLocked)continue;const pad=b.r+7;if(b.x<pad)b.x+=(pad-b.x)*ease;if(b.x>this.width-pad)b.x+=(this.width-pad-b.x)*ease;if(b.y<pad)b.y+=(pad-b.y)*ease;if(b.y>this.height-pad)b.y+=(this.height-pad-b.y)*ease;}
    resolveCollisions(this.bodies,{dragId:this.dragId});
    this.bodies=this.bodies.filter(b=>!b.retired||b.alpha>.015);
  }
  hit(x,y){const visible=this.bodies.filter(b=>!b.retired&&b.alpha>.08),distance=b=>Math.hypot(x-b.x,y-b.y);return [...visible].reverse().find(b=>distance(b)<=b.r)||visible.filter(b=>distance(b)<=22).sort((a,b)=>distance(a)-distance(b))[0];}
}

// Rebuild the broad phase after each projection: corrections can create new neighbours.
export function resolveCollisions(bodies,{iterations=64,tolerance=.001,dragId=null}={}){
  const visible=bodies.filter(b=>!b.retired&&b.alpha>=.1);
  if(visible.length<2)return;
  const cell=Math.max(12,...visible.map(b=>b.r*2+8));
  for(let iteration=0;iteration<iterations;iteration++){
    const grid=new Map();let worst=0;
    for(const b of visible){
      const gx=Math.floor(b.x/cell),gy=Math.floor(b.y/cell);
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(const other of grid.get((gx+dx)+(gy+dy)*65536)||[]){
        const ax=b.x-other.x,ay=b.y-other.y,distance=Math.hypot(ax,ay),gap=Math.min(b.collisionGap??2,other.collisionGap??2);
        const overlap=b.r+other.r+gap-distance;if(overlap<=tolerance)continue;worst=Math.max(worst,overlap);
        let nx,ny;if(distance>.00001){nx=ax/distance;ny=ay/distance;}else{const seed=(String(b.id)+String(other.id)).split('').reduce((n,c)=>n+c.charCodeAt(0),0)*2.3999632297;nx=Math.cos(seed);ny=Math.sin(seed);}
        const invA=b.id===dragId?0:1/Math.max(1,b.r*b.r),invB=other.id===dragId?0:1/Math.max(1,other.r*other.r),total=invA+invB;
        if(!total)continue;const correction=(overlap+tolerance)/total;
        b.x+=nx*correction*invA;b.y+=ny*correction*invA;other.x-=nx*correction*invB;other.y-=ny*correction*invB;
      }
      const key=Math.floor(b.x/cell)+Math.floor(b.y/cell)*65536;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(b);
    }
    if(worst<=tolerance)break;
  }
}
