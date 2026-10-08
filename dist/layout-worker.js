import {periodCamera,expenseBubbles} from './bubble-layout.js';
import {paymentColor} from './core.js';
export function computeLayout({groups,options}){
  const camera=periodCamera(groups,options);
  return {groups:camera.labels,specs:expenseBubbles(groups,paymentColor,options,camera)};
}
if(typeof self!=='undefined')self.onmessage=({data})=>{
  try{const result=computeLayout(data);if(!data.warm)self.postMessage({id:data.id,...result});}
  catch(error){if(!data.warm)self.postMessage({id:data.id,error:String(error.message||error)});}
};
