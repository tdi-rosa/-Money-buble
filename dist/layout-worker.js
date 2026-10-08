import {ClusterCatalog,getCatalog} from './cluster-tree.js';
import {paymentColor} from './core.js';
export function computeLayout({groups,options,catalog}){
  const source=catalog||getCatalog(groups.flatMap(g=>g.items)),result=source.layout(options);
  return {...result,groups:[],specs:result.specs.map(b=>({...b,color:paymentColor(b.transaction)}))};
}
// New data is transferred once. Navigation and previews reuse the same catalog;
// there are no collision simulations, keyframe buffers or histories to repack.
function compact(result){return {...result,specs:result.specs.map(({transaction,color,...s})=>s)};}
let catalog=null,pending=null,scheduled=false;
if(typeof self!=='undefined')self.onmessage=({data})=>{
  if(data.items)catalog=getCatalog(data.items);
  if(data.preview){try{self.postMessage({id:data.id,preview:data.preview,...compact(computeLayout({catalog,options:data.options}))});}catch{}return;}
  pending=data;if(scheduled)return;scheduled=true;
  setTimeout(()=>{scheduled=false;const job=pending;pending=null;try{self.postMessage({id:job.id,...compact(computeLayout({catalog,groups:job.groups,options:job.options}))});}catch(error){self.postMessage({id:job.id,error:String(error.message||error)});}},0);
};
