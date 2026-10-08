export const MIN_RADIUS=22;
// A 44px touch floor plus proportional area: r² = 22² + scale × cents.
// Saturation bounds the largest bubble; every visible bubble retains its touch floor.
export function bubbleRadii(values,{budget,maxRadius=90}={}){
  const max=Math.max(MIN_RADIUS,maxRadius),floor=MIN_RADIUS**2;
  if(!values.length)return [];
  const area=k=>values.reduce((sum,n)=>sum+Math.min(max**2,floor+k*Math.max(0,n)),0);
  let low=0,high=max**2;
  const target=Math.max(floor*values.length,budget||max**2*values.length);
  for(let i=0;i<60;i++){const mid=(low+high)/2;if(area(mid)>target)high=mid;else low=mid}
  return values.map(n=>Math.sqrt(Math.min(max**2,floor+low*Math.max(0,n))));
}
export function gestureAction({dx,dy,moved,mode,body,group,cancelled}){
  if(cancelled)return 'none';
  if(Math.abs(dx)>65&&Math.abs(dx)>Math.abs(dy)*1.25)return dx<0?'next':'previous';
  if(moved)return 'none';
  if(mode!=='day'&&group)return 'drill';
  return body?'detail':'none';
}
