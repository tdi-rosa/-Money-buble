import {BubbleField} from './physics.js';
const field=new BubbleField();let revision=0,timer=0,lastTick=0,running=false,options={pixelScale:1,organic:true};
function tick(){timer=0;if(!running)return;
 const now=performance.now(),elapsed=lastTick?Math.min(.05,(now-lastTick)/1000):1/60;lastTick=now;
 field.stepLive(elapsed,options);
 const positions=new Float32Array(field.bodies.length*4);
 for(let i=0;i<field.bodies.length;i++){const b=field.bodies[i];positions[i*4]=b.x;positions[i*4+1]=b.y;positions[i*4+2]=b.vx;positions[i*4+3]=b.vy;}
 self.postMessage({revision,time:field.time,positions},[positions.buffer]);timer=setTimeout(tick,16);
}
self.onmessage=({data})=>{
 if(data.bodies){revision=data.revision;field.bodies=data.bodies;field.time=data.time||0;}
 if(data.options)options=data.options;
 field.dragId=data.dragId??null;field.dragTarget=data.dragTarget??null;
 running=data.running!==false;if(!running){clearTimeout(timer);timer=0;lastTick=0;}else if(!timer)timer=setTimeout(tick,0);
};
