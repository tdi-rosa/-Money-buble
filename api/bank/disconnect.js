import {guard,session,api,setCookie,failure} from '../../server/bank.js';
export default async function handler(req,res){try{guard(req,res,'POST');let s;try{s=session(req)}catch{}if(s)await api('/sessions/'+encodeURIComponent(s.sid),{method:'DELETE',req});setCookie(res,'__Host-mb-bank','',0);res.json({disconnected:true})}catch(e){failure(res,e)}}
