import {packCluster} from './circle-pack.js';
import {bounds} from './periods.js';
// Periods contain individual expenses, never nested day/week containers.
export class ClusterCatalog {
  constructor(items){this.items=items;this.periods=new Map();this.largest=Math.max(1,...items.map(t=>t.amountCents));}
  root(date,mode){
    const range=bounds(date,mode),key=mode+':'+range.start;
    if(!this.periods.has(key)){
      const items=this.items.filter(t=>t.date>=range.start&&t.date<=range.end),points=packCluster(items);
      let x=1,y=1;for(const p of points.values()){x=Math.max(x,Math.abs(p.x)+p.r);y=Math.max(y,Math.abs(p.y)+p.r);}
      this.periods.set(key,{items,points,x,y,range});
    }
    return this.periods.get(key);
  }
  camera({mode='day',date=this.items[0]?.date,width=400,height=400}={}){
    const root=this.root(date,mode),usableX=Math.max(1,width-40)/2,usableY=Math.max(1,height-48)/2;
    // World radii share one monetary unit; the camera crops each physical cloud.
    const scale=Math.max(.000001,Math.min(usableX,usableY)*.88/Math.sqrt(this.largest));
    const fit=r=>Math.min(6,usableX/(r.x*scale+6),usableY/(r.y*scale+6));
    const fitByMode=Object.fromEntries(['day','week','month'].map(m=>[m,fit(this.root(date,m))]));
    return {catalog:this,options:{mode,date,width,height},root,range:root.range,width,height,scale,fitZoom:fit(root),fitByMode,labels:[]};
  }
  layout(options){
    const camera=this.camera(options),{root,width,height,scale,fitZoom,fitByMode,range}=camera;
    const specs=root.items.map(t=>{const p=root.points.get(t.id);return {id:t.id,tx:width/2+p.x*scale,ty:height/2+p.y*scale,targetR:p.r*scale,collisionGap:scale,cluster:true,centerX:width/2,centerY:height/2,
      groupX:p.x*scale,groupY:p.y*scale,dayX:p.x*scale,dayY:p.y*scale,groupId:t.date,transaction:t,persistent:true,inPeriod:true,layoutLocked:false};});
    return {specs,fitZoom,fitByMode,scale,reference:Math.max(root.x,root.y),anchor:{x:width/2,y:height/2},range};
  }
}
let cachedKey=null,cachedCatalog=null;
export function getCatalog(items){const key=JSON.stringify(items.map(t=>[t.id,t.date,t.amountCents]));if(key!==cachedKey){cachedKey=key;cachedCatalog=new ClusterCatalog(items);}return cachedCatalog;}
