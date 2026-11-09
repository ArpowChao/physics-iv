/* Model coordinates in cm for static scenes; electrodynamics quantities use SI. */
(() => {
  const sum = (a,b) => a.map((v,i)=>v+b[i]);
  const mul = (a,s) => a.map(v=>v*s);
  const sub = (a,b) => sum(a,mul(b,-1));
  const dot = (a,b) => a.reduce((n,v,i)=>n+v*b[i],0);
  const cross = ([x,y,z],[a,b,c]) => [y*c-z*b,z*a-x*c,x*b-y*a];
  const length = a => Math.hypot(...a);
  const unit = a => length(a)>0 ? mul(a,1/length(a)) : [0,0,0];
  const clamp = (x,a,b) => Math.min(b,Math.max(a,x));
  const rad = a => a*Math.PI/180, TAU = 2*Math.PI, zero = [0,0,0];
  const sample = (n,fn) => Array.from({length:n+1},(_,i)=>fn(i/n));
  const direction = (theta,phi) => [Math.sin(rad(theta))*Math.cos(rad(phi)),Math.sin(rad(theta))*Math.sin(rad(phi)),Math.cos(rad(theta))];
  const line = (a,b,n=1) => sample(n,u=>sum(a,mul(sub(b,a),u)));
  const ring = (r,z=0,n=100) => sample(n,u=>[r*Math.cos(TAU*u),r*Math.sin(TAU*u),z]);
  const distance = (p,a,b) => {
    const d=sub(b,a), t=clamp(dot(sub(p,a),d)/dot(d,d),0,1);
    return length(sub(p,sum(a,mul(d,t))));
  };
  function biot(mode,p) {
    const point=[p.x,p.y,p.z], r=p.radius||9, s=p.spacing||8;
    const axis=direction(p.theta??90,p.phi??0);
    const paths=mode==="element"?[{nodes:line(mul(axis,-p.dl/2),mul(axis,p.dl/2)),sign:1}]:
      mode==="straight"?[{nodes:line([-p.half,0,0],[p.half,0,0],180),sign:1}]:
      mode==="pair"?[{nodes:line([-24,-s/2,0],[24,-s/2,0],150),sign:1},
        {nodes:line([-24,s/2,0],[24,s/2,0],150),sign:p.relative}]:
      mode==="loop"?[{nodes:ring(r),sign:1}]:
      sample(p.turns-1,u=>({nodes:ring(r,(u-.5)*p.coil,70),sign:1}));
    const seg=paths.flatMap(({nodes,sign})=>nodes.slice(1).map((b,i)=>{
      const a=nodes[i], m=mul(sum(a,b),.5), rv=sub(point,m), d=length(rv);
      const dl=mul(sub(b,a),Math.sign(p.i||1)*sign);
      return {a,b,m,rv,d,dl,bvec:d>1e-8?mul(cross(dl,rv),10*Math.abs(p.i)/d**3):zero,near:distance(point,a,b)<.45};
    }));
    const selected=seg[Math.round((seg.length-1)*(p.probe??0)/100)];
    const angle=selected.d?Math.acos(clamp(dot(unit(selected.dl),unit(selected.rv)),-1,1))/Math.PI*180:null;
    const unsafe=seg.some(s=>s.near);
    const smallElement=mode!=="element"||selected.d>=3*p.dl;
    return {paths,point,selected,total:seg.reduce((acc,s)=>sum(acc,s.bvec),zero),unsafe,angle,smallElement};
  }
  function electro(mode,p,point) {
    const [x]=point;
    if(mode==="plates"){
      const half=p.gap/2, fx=clamp((half-x)/p.gap,0,1);
      return {v:p.voltage*fx,e:Math.abs(x)<=half?[100*p.voltage/p.gap,0,0]:zero};
    }
    if(mode==="sphere"){
      const r=length(point);
      return {v:9000*p.q/Math.max(r,p.radius),e:r<p.radius?zero:mul(point,900000*p.q/r**3)};
    }
    const sources=[[-p.spacing/2,0,0,p.q],[p.spacing/2,0,0,p.q2]];
    let v=0,e=zero;
    for(const [x,y,z,q] of sources){
      if(!q)continue;
      const r=sub(point,[x,y,z]), d=length(r);
      if(d<.45)return null;
      v+=9000*q/d;
      e=sum(e,mul(r,900000*q/d**3));
    }
    return {v,e};
  }
  function magnetic(mode,p) {
    const b=[0,0,p.b], dir=direction(p.theta,p.phi??0);
    if(mode==="parallel"){
      const B=20*Math.abs(p.i1)/p.spacing; // μT; p.spacing is in cm.
      const f=20e-6*p.i1*p.i2/p.spacing;  // N/m on upper wire, toward lower if f > 0.
      return {B,f};
    }
    if(mode==="wire"){
      const dl=mul(dir,p.size/100), f=mul(cross(dl,b),p.i);
      return {b,dl,f};
    }
    if(mode==="motor"){
      const a=rad(p.theta), size=p.size/100, w=size*.68;
      const u=[size/2,0,0], v=[0,w/2*Math.cos(a),w/2*Math.sin(a)];
      const vertices=[sub(mul(u,-1),v),sub(u,v),sum(u,v),sum(mul(u,-1),v)];
      const i=p.i*(p.commutate&&Math.sin(a)<0?-1:1), n=[0,-Math.sin(a),Math.cos(a)];
      const forces=vertices.map((a,k)=>mul(cross(sub(vertices[(k+1)%4],a),b),p.turns*i));
      return {b,vertices,forces,i,n,torque:mul(cross(n,b),p.turns*i*size*w),area:size*w};
    }
    const m=1e-8, q=p.q*1e-6, omega=q*p.b/m, T=TAU/Math.abs(omega);
    const alpha=rad(p.phi), vp=p.v*Math.sin(rad(p.theta)), vz=p.v*dir[2];
    const at=t=>{
      const a=alpha-omega*t;
      const v=[vp*Math.cos(a),vp*Math.sin(a),vz];
      const x=[vp/omega*(Math.sin(alpha)-Math.sin(a)),vp/omega*(Math.cos(a)-Math.cos(alpha)),vz*t];
      return {x,v,f:mul(cross(v,b),q)};
    };
    return {b,m,q,T,r:vp/Math.abs(omega),pitch:Math.abs(vz)*T,at,energy:.5*m*p.v**2};
  }
  function induction(mode,p,t) {
    const T=p.duration, u=clamp(t/T,0,1), loopL=p.size/100, area=loopL**2;
    let flux=0, emf=0, x=0, v=0, overlap=0, angle=0, b=p.b, n=mode==="slide"||mode==="enter"?1:p.turns;
    if(mode==="slide"){
      v=p.speed;
      x=.035+v*t;
      flux=b*loopL*x;
      emf=-b*loopL*v;
    }else if(mode==="enter"){
      v=.44/T; x=-.22+.44*u;
      const left=x-loopL/2,right=x+loopL/2, edge=.13;
      overlap=Math.max(0,Math.min(right,edge)-Math.max(left,-edge));
      const inside=z=>z>=-edge&&z<edge;
      flux=b*loopL*overlap;
      emf=-b*loopL*v*(Number(inside(right))-Number(inside(left)));
    }else if(mode==="rotate"){
      const w=TAU*p.cycles/T;
      angle=w*t; flux=b*area*Math.cos(angle);
      emf=n*b*area*w*Math.sin(angle);
    }else if(mode==="vary"){
      const fraction=clamp((u-.25)/.5,0,1);
      b=p.b+(p.end-p.b)*fraction; flux=b*area;
      emf=u>=.25&&u<.75?-n*area*(p.end-p.b)/(.5*T):0;
    }else{
      // Axis-aligned point dipole; b sets flux density averaged over the coil at z=0.
      x=.24*(2*u-1); v=.48/T;
      const r=loopL/2, den=r*r+x*x, scale=p.pole*b*(Math.PI*r*r)*r**3;
      flux=scale/den**1.5;
      emf=n*3*scale*x*v/den**2.5;
    }
    const i=p.closed?emf/p.resistance:0, heat=i*i*p.resistance;
    return {flux,emf,i,heat,x,v,overlap,angle,b,n,force:mode==="slide"&&v?-heat/v:0};
  }
  const api={sum,mul,sub,dot,cross,length,unit,clamp,rad,TAU,zero,sample,direction,line,ring,biot,electro,magnetic,induction};
  globalThis.EMPhysics=api;
  if(typeof module!=="undefined")module.exports=api;
})();
