import {packCluster} from './circle-pack.js';
import {bounds,monday} from './periods.js';
function node(parts){
  if(!parts.length)return {points:new Map(),centers:new Map(),radius:1};
  const packed=packCluster(parts.map(p=>({id:p.id,amountCents:(p.radius+4)**2}))),circles=[...packed.values()];
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const b of circles){left=Math.min(left,b.x-b.r);right=Math.max(right,b.x+b.r);top=Math.min(top,b.y-b.r);bottom=Math.max(bottom,b.y+b.r);}
  const cx=(left+right)/2,cy=(top+bottom)/2,centers=new Map(),points=new Map();let radius=1;
  for(const part of parts){const p=packed.get(part.id),center={x:p.x-cx,y:p.y-cy};centers.set(part.id,center);radius=Math.max(radius,Math.hypot(center.x,center.y)+part.radius);
    for(const [id,b] of part.points)points.set(id,{x:center.x+b.x,y:center.y+b.y,r:b.r});
  }
  return {centers,points,radius};
}
function dayNode(items){
  const points=packCluster(items),parts=[...points];if(!parts.length)return {points:new Map(),radius:1};
  let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
  for(const [,b] of parts){left=Math.min(left,b.x-b.r);right=Math.max(right,b.x+b.r);top=Math.min(top,b.y-b.r);bottom=Math.max(bottom,b.y+b.r);}
  const cx=(left+right)/2,cy=(top+bottom)/2,centered=new Map();let radius=1;
  for(const [id,b] of parts){const p={x:b.x-cx,y:b.y-cy,r:b.r};centered.set(id,p);radius=Math.max(radius,Math.hypot(p.x,p.y)+p.r);}
  return {points:centered,radius};
}
export class ClusterCatalog {
  constructor(items){
    this.items=items;this.days=new Map();this.weeks=new Map();this.months=new Map();
    const byDay=new Map();for(const t of items){if(!byDay.has(t.date))byDay.set(t.date,[]);byDay.get(t.date).push(t);}
    const byWeek=new Map();for(const [date,rows] of [...byDay].sort(([a],[b])=>a.localeCompare(b))){const d=dayNode(rows);this.days.set(date,d);const week=monday(date);if(!byWeek.has(week))byWeek.set(week,[]);byWeek.get(week).push({id:date,...d});}
    for(const [week,parts] of byWeek){const w=node(parts);w.dayCenters=w.centers;this.weeks.set(week,w);}
    const byMonth=new Map();for(const date of this.days.keys()){const month=date.slice(0,7),week=monday(date);if(!byMonth.has(month))byMonth.set(month,new Set());byMonth.get(month).add(week);}
    for(const [month,weeks] of byMonth){const m=node([...weeks].sort().map(id=>({id,...this.weeks.get(id)})));m.weekCenters=m.centers;m.dayCenters=new Map();
      for(const [week,c] of m.weekCenters)for(const [date,d] of this.weeks.get(week).dayCenters)m.dayCenters.set(date,{x:c.x+d.x,y:c.y+d.y});
      this.months.set(month,m);
    }
    this.referenceXY={day:{x:1,y:1},week:{x:1,y:1},month:{x:1,y:1}};
    const dates=new Map(items.map(t=>[t.id,t.date]));
    const measure=(mode,root,month)=>{
      const origins=mode==='day'?[{x:0,y:0}]:[...root.dayCenters].filter(([d])=>!month||d.startsWith(month)).map(([,c])=>c);origins.push({x:0,y:0});
      let minX=0,maxX=0,minY=0,maxY=0;for(const c of origins){minX=Math.min(minX,c.x);maxX=Math.max(maxX,c.x);minY=Math.min(minY,c.y);maxY=Math.max(maxY,c.y);}
      const ref=this.referenceXY[mode];
      for(const [id,p] of root.points){if(month&&!dates.get(id).startsWith(month))continue;ref.x=Math.max(ref.x,p.x+p.r-minX,maxX-p.x+p.r);ref.y=Math.max(ref.y,p.y+p.r-minY,maxY-p.y+p.r);}
    };
    for(const d of this.days.values())measure('day',d);
    for(const w of this.weeks.values())measure('week',w);
    for(const [month,m] of this.months)measure('month',m,month);
    for(const axis of ['x','y']){this.referenceXY.week[axis]=Math.max(this.referenceXY.day[axis],this.referenceXY.week[axis]);this.referenceXY.month[axis]=Math.max(this.referenceXY.week[axis],this.referenceXY.month[axis]);}
    this.reference=Object.fromEntries(Object.entries(this.referenceXY).map(([mode,r])=>[mode,Math.max(r.x,r.y)]));
  }
  camera({mode='day',date=this.items[0]?.date,width=400,height=400}={}){
    const range=bounds(date,mode),root=mode==='day'?this.days.get(date):mode==='week'?this.weeks.get(monday(date)):this.months.get(date.slice(0,7));
    const origin=mode==='day'?{x:0,y:0}:root?.dayCenters.get(date)||root?.weekCenters?.get(monday(date))||{x:0,y:0};
    const usableX=Math.max(1,width-40)/2,usableY=Math.max(1,height-48)/2,scale=Math.max(.000001,Math.min(usableX/this.referenceXY.day.x,usableY/this.referenceXY.day.y));
    const fitByMode=Object.fromEntries(Object.entries(this.referenceXY).map(([mode,r])=>[mode,Math.min(1,usableX/(r.x*scale),usableY/(r.y*scale))])),fitZoom=fitByMode[mode];
    return {catalog:this,options:{mode,date,width,height},root,origin,range,width,height,scale,fitZoom,fitByMode,labels:[]};
  }
  layout(options){
    const camera=this.camera(options),{root,origin,range,width,height,scale,fitZoom,fitByMode}=camera,mode=options.mode,date=options.date,week=monday(date);
    const specs=[];
    for(const t of this.items){if(t.date<range.start||t.date>range.end)continue;const p=root.points.get(t.id),day=root.dayCenters?.get(t.date)||{x:0,y:0},wk=root.weekCenters?.get(monday(t.date))||{x:0,y:0};
      const group=mode==='month'?wk:day;
      specs.push({id:t.id,tx:width/2+(p.x-origin.x)*scale,ty:height/2+(p.y-origin.y)*scale,targetR:p.r*scale,collisionGap:2*scale,
        groupX:(group.x-origin.x)*scale,groupY:(group.y-origin.y)*scale,dayX:(day.x-origin.x)*scale,dayY:(day.y-origin.y)*scale,
        groupId:t.date,transaction:t,persistent:true,inPeriod:true,layoutLocked:true});
    }
    return {specs,fitZoom,fitByMode,scale,reference:this.reference[mode],anchor:{x:width/2,y:height/2},range};
  }
}
let cachedKey=null,cachedCatalog=null;
export function getCatalog(items){const key=JSON.stringify(items.map(t=>[t.id,t.date,t.amountCents]));if(key!==cachedKey){cachedKey=key;cachedCatalog=new ClusterCatalog(items);}return cachedCatalog;}
