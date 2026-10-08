// Pack only the active period. No simulation of the entire bank history and no
// hundreds of physics steps before the worker can answer a gesture.
const clusterCache=new Map();
export function packCluster(items){
  const ordered=[...items].sort((a,b)=>b.amountCents-a.amountCents||String(a.id).localeCompare(String(b.id)));
  const key=JSON.stringify(ordered.map(t=>[t.id,t.amountCents]));
  if(clusterCache.has(key))return clusterCache.get(key);
  const radii=ordered.map(t=>Math.sqrt(Math.max(0,t.amountCents)));
  const placed=[],points=new Map();
  for(let i=0;i<ordered.length;i++){
    const r=radii[i],phase=i*2.3999632297;let best={x:0,y:0,distance:Infinity};
    // Along each ray, merge the intervals blocked by existing circles. This
    // finds the nearest free point without a slow pixel-by-pixel spiral search.
    for(let ray=0;ray<32;ray++){
      const angle=phase+ray*Math.PI/16,c=Math.cos(angle),s=Math.sin(angle),intervals=[];
      for(const b of placed){const projection=b.x*c+b.y*s,perpendicular=b.x*b.x+b.y*b.y-projection*projection,gap=r+b.r+4;
        if(perpendicular>=gap*gap)continue;
        const half=Math.sqrt(Math.max(0,gap*gap-perpendicular)),end=projection+half;
        if(end>=0)intervals.push([Math.max(0,projection-half),end]);
      }
      intervals.sort((a,b)=>a[0]-b[0]);let distance=0;
      for(const [start,end] of intervals){if(start>distance)break;distance=Math.max(distance,end+.0001);}
      if(distance<best.distance)best={x:c*distance,y:s*distance,distance};
    }
    const b={x:best.x,y:best.y,r};points.set(ordered[i].id,b);placed.push(b);
  }
  if(clusterCache.size>=36)clusterCache.delete(clusterCache.keys().next().value);
  clusterCache.set(key,points);return points;
}
