export function ownsSimulationFrame(result,revision,source,current,running){
  return running&&result.revision===revision&&source===current;
}
export function targetCloudRadius(specs,width,height){
  return specs.reduce((r,b)=>Math.max(r,Math.hypot(b.tx-width/2,b.ty-height/2)+b.targetR),0)*1.08;
}
export function projectCameraPoint(point,from,to){
  if(!from||!to)return point;
  return {
    x:to.cameraX+((point.x-from.cameraX)*from.scale+(from.panX||0)-(to.panX||0)+(from.width-to.width)/2)/to.scale,
    y:to.cameraY+((point.y-from.cameraY)*from.scale+(from.panY||0)-(to.panY||0)+(from.height-to.height)/2)/to.scale
  };
}
// Departures keep their screen trajectory and size while the retained cloud zooms.
// Their reprojected circles still participate in the same collision solver.
export function reprojectDeparture(body,camera){
  if(!body.departing||!camera)return;
  const old=body.departureView;
  if(old){
    const p=projectCameraPoint(body,old,camera),target=projectCameraPoint({x:body.motionX,y:body.motionY},old,camera),scale=old.scale/camera.scale;
    body.x=p.x;body.y=p.y;body.motionX=target.x;body.motionY=target.y;
    body.vx=(body.vx||0)*scale;body.vy=(body.vy||0)*scale;
    body.targetR*=scale;body.r=body.targetR;
  }
  body.departureView={...camera};
}
