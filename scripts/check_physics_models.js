const assert=require("node:assert/strict");
const P=require("../assets/physics-models.js");
const eq=(actual,expected,tol=1e-8)=>assert.ok(Math.abs(actual-expected)<=tol,`${actual} ≠ ${expected}`);
const vv=(a,b,tol)=>a.forEach((x,i)=>eq(x,b[i],tol));

// Distinct out-of-plane components and the zero/orthogonality cases for Biot–Savart.
const p={i:4,dl:2,theta:90,phi:0,x:0,y:12,z:8,probe:50};
const e=P.biot("element",p), reverse=P.biot("element",{...p,i:-4});
const rr=Math.hypot(p.y,p.z), factor=10*p.i*p.dl/rr**3;
vv(e.total,[0,-8*factor,12*factor]);vv(e.total,P.mul(reverse.total,-1));
eq(P.dot(e.total,e.selected.dl),0);eq(P.dot(e.total,e.selected.rv),0);
vv(P.biot("element",{...p,x:16,y:0,z:0}).total,[0,0,0]);
eq(P.length(P.biot("element",{...p,y:24,z:16}).total)*4,P.length(e.total));
const half=24,y=8,z=6,r=Math.hypot(y,z);
const finite=P.biot("straight",{...p,half,x:0,y,z});
eq(P.length(finite.total),(20*p.i/r)*half/Math.hypot(half,r),.001);
vv(P.biot("pair",{...p,spacing:14,relative:1,x:0,y:0,z:0}).total,[0,0,0]);
assert.ok(P.biot("pair",{...p,spacing:14,relative:-1,x:0,y:0,z:0}).total[2]>20);
const loop=P.biot("loop",{...p,radius:9,x:0,y:0,z:10});
eq(loop.total[2],20*Math.PI*p.i*9**2/(9**2+10**2)**1.5,.01);
eq(loop.total[0],0);eq(loop.total[1],0);
assert.ok(P.biot("straight",{...p,half,x:0,y:0,z:0}).unsafe);

const q={q:6,q2:-6,spacing:18,radius:10,voltage:14,gap:18};
const mid=P.electro("charges",q,[0,0,0]);
eq(mid.v,0);assert.ok(mid.e[0]>0);
eq(P.electro("sphere",q,[10,0,0]).v,540);
eq(P.electro("sphere",q,[20,0,0]).e[0],1350);
const same=P.electro("charges",{...q,q2:6},[0,0,0]);
assert.ok(same.v>0);vv(same.e,[0,0,0]);
const x=4,h=.0001;
for(const m of ["charges","plates","sphere"]){
  const at=P.electro(m,q,[x,8,6]), a=P.electro(m,q,[x-h,8,6]), b=P.electro(m,q,[x+h,8,6]);
  eq(at.e[0],-(b.v-a.v)/(2*h/100),.001);
}
vv(P.electro("sphere",q,[0,0,0]).e,[0,0,0]);
eq(P.electro("sphere",q,[0,0,0]).v,P.electro("sphere",q,[10,0,0]).v);
assert.equal(P.electro("sphere",q,[10,0,0]).e,null);
assert.equal(P.electro("plates",q,[-9,0,0]).e,null);
assert.equal(P.electro("plates",q,[9,0,0]).e,null);
eq(P.electro("plates",q,[-9,0,0]).v,q.voltage);
eq(P.electro("plates",q,[9,0,0]).v,0);
assert.ok(P.electro("plates",q,[0,0,0]).e[0]>0);
const renderedLines=paths=>paths.reduce((n,path)=>n+path.sides.length,0);
for(const density of [1,2,3,4,5,6])for(const spacing of [6,18,28])for(const [q1,q2] of [[12,-12],[12,-11],[3,-1],[2,-5],[-9,4],[-2,-4],[0,-1],[0,0]]){
  const config={spacing,q:q1,q2}, pair=P.electricPair(config,density);
  const paths=P.electricStreamlines(config,110,density);
  eq(pair.joined,renderedLines(paths.filter(path=>path.end!==null)));
  eq(pair.distant,renderedLines(paths.filter(path=>path.end===null)));
  if(pair.x!==null)vv(P.electro("charges",config,[pair.x,0,0]).e,[0,0,0],1e-7);
  for(const [x,charge] of [[-spacing/2,q1],[spacing/2,q2]]){
    const touching=paths.filter(path=>path.source===x||path.end===x);
    assert.equal(renderedLines(touching),density*Math.abs(charge),`wrong line count at ${charge} nC, separation ${spacing}, density ${density}`);
  }
}
const unequal={spacing:18,q:5,q2:-1}, unequalPair=P.electricPair(unequal);
assert.deepEqual(unequalPair.counts,[10,2]);
assert.equal(unequalPair.joined,2);
assert.equal(unequalPair.net,4);
assert.ok(unequalPair.x>9);
assert.ok(P.electro("charges",unequal,[unequalPair.x,0,0]).v>0);
assert.equal(P.electricPair({...unequal,q2:-5}).x,null);
assert.equal(P.electricPair({...unequal,q2:5}).x,0);
assert.equal(P.electricPair({...unequal,q:0,q2:0}).all,true);

const cavity={q:4,q2:8,offset:3};
for(const density of [1,2,3,4,5,6])for(const offset of [0,3,5]){
  const c={...cavity,offset}, paths=P.cavityStreamlines(c,120,density);
  eq(renderedLines(paths.filter(path=>path.end===8)),4*density);
  eq(renderedLines(paths.filter(path=>path.end===13)),4*density);
  eq(renderedLines(paths.filter(path=>path.end===null)),4*density);
  for(const path of paths.filter(path=>path.end!==null))eq(P.length(path.points.at(-1)),path.end,1e-6);
}
const cz=P.cavityZeros(cavity);
eq(cz.eZeros.length,1);
assert.ok(cz.eZeros[0]<-13);
vv(P.electro("cavity",cavity,[cz.eZeros[0],0,0]).e,[0,0,0],1e-4);
eq(P.cavityZeros({...cavity,offset:0,q2:0}).eZeros.length,0);
for(const r of [8,10,13])eq(P.electro("cavity",cavity,[r,0,0]).v,0);
vv(P.electro("cavity",cavity,[10,0,0]).e,[0,0,0]);
const inCavity=[0,1,0], outside=[14,3,0];
assert.ok(P.length(P.electro("cavity",cavity,inCavity).e)>0);
vv(P.electro("cavity",cavity,inCavity).e,P.electro("cavity",{...cavity,q2:-8},inCavity).e);
vv(P.electro("cavity",cavity,outside).e,P.electro("cavity",{...cavity,q:-4},outside).e);

const force={b:.35,v:6,q:2,theta:65,phi:32,i:4,size:18,turns:5,commutate:0};
const m=P.magnetic("particle",force), at=m.at(m.T*.26);
eq(P.length(at.v),force.v);eq(P.dot(at.v,at.f),0);
vv(P.mul(P.sub(m.at(m.T*.26+h).x,m.at(m.T*.26-h).x),1/(2*h)),at.v,.001);
vv(P.mul(P.sub(m.at(m.T*.26+h).v,m.at(m.T*.26-h).v),m.m/(2*h)),at.f,1e-8);
vv(m.at(m.T).x,[0,0,force.v*Math.cos(P.rad(force.theta))*m.T]);
vv(m.at(0).f,P.mul(P.magnetic("particle",{...force,q:-2}).at(0).f,-1));
eq(P.length(P.magnetic("wire",{...force,theta:0}).f),0);
eq(P.length(P.magnetic("wire",{...force,theta:90}).f),.35*4*.18);
eq(P.magnetic("parallel",{i1:6,i2:4,spacing:10}).f,48e-6);
eq(P.magnetic("parallel",{i1:6,i2:-4,spacing:10}).f,-48e-6);
const motor=P.magnetic("motor",{...force,theta:90}), off=P.magnetic("motor",{...force,theta:270});
const on=P.magnetic("motor",{...force,theta:270,commutate:1});
eq(motor.torque[0],force.b*force.i*force.turns*motor.area);
eq(off.torque[0],-motor.torque[0]);eq(on.torque[0],motor.torque[0]);

const i={b:.4,end:-.2,size:12,speed:.12,duration:1.4,turns:12,cycles:1,pole:1,closed:1,resistance:4};
const read=(m,f,extra={})=>P.induction(m,{...i,...extra},f*i.duration);
for(const [mode,f] of [["slide",.3],["enter",.18],["enter",.82],["magnet",.38],["rotate",.25],["vary",.5]]){
  const at=read(mode,f), deriv=(read(mode,f+h).flux-read(mode,f-h).flux)/(2*h*i.duration);
  eq(at.emf,-at.n*deriv,1e-5);
}
const slide=read("slide",.3), open=read("slide",.3,{closed:0});
eq(slide.emf,-i.b*.12*i.speed);eq(slide.heat,-slide.force*slide.v);
eq(open.emf,slide.emf);eq(open.i,0);eq(open.heat,0);
assert.ok(read("enter",.5).flux>0);eq(read("enter",.5).emf,0);
assert.ok(read("magnet",.38).emf*read("magnet",.62).emf<0);
assert.ok(read("magnet",.38).emf<0);
const magnet=P.magnetFlux(i);
eq(read("magnet",.5).flux,magnet.centerField*Math.PI*(i.size/200)**2);
assert.ok(magnet.centerField>0&&magnet.centerField<i.b);
eq(P.magnetFlux({...i,size:18}).radius,magnet.radius);
eq(read("magnet",.38).emf,-read("magnet",.38,{pole:-1}).emf);
eq(read("magnet",.38).flux,read("magnet",.62).flux);
eq(read("magnet",.5).emf,0);eq(read("rotate",.25).flux,0);
eq(read("vary",.1).emf,0);eq(read("vary",.9).emf,0);

const accel={initial:80,voltage:400,b:.65,crossings:8};
for(const config of [accel,{initial:20,voltage:50},{initial:400,voltage:1200}]){
  const lin=P.linearAcceleration(config);
  eq(lin.at(0).energy,config.initial);
  eq(lin.at(1).energy,config.initial+4*config.voltage);
  for(const [j,gap] of lin.gaps.entries()){
    const t=lin.at(gap.centerTime/lin.duration), a=lin.tubes[j], b=lin.tubes[j+1];
    eq(t.energy,config.initial+(j+.5)*config.voltage);
    eq(t.position,(gap.start+gap.end)/2);
    if(j)eq(gap.centerTime-lin.gaps[j-1].centerTime,1/(2*lin.frequency),1e-14);
    assert.ok(b.end-b.start>a.end-a.start);
    eq(lin.at((b.startTime+b.endTime)/(2*lin.duration)).energy,config.initial+(j+1)*config.voltage);
  }
}
const cy=P.cyclotron(accel);
for(let i=1;i<cy.arcs.length;i++){
  vv(cy.arcs[i].point(0),cy.arcs[i-1].point(1));
  eq(cy.arcs[i].energy-cy.arcs[i-1].energy,400);
  eq(cy.arcs[i].radius/cy.arcs[i-1].radius,Math.sqrt(cy.arcs[i].energy/cy.arcs[i-1].energy));
}
for(const arc of cy.arcs){
  const t=.26, a=arc.point(t-h), b=arc.point(t), c=arc.point(t+h);
  const v=P.sub(c,a), curvature=P.sub(P.sum(a,c),P.mul(b,2));
  assert.ok(P.dot(P.unit(P.cross(v,[0,0,accel.b])),P.unit(curvature))>.999999);
}
const atmosphere=P.aurora({shell:2.5,pitch:0,longitude:37,hemisphere:1});
assert.ok(atmosphere.reachesAtmosphere);
eq((P.length(atmosphere.point(atmosphere.end))-1)*atmosphere.earthKm,110);
const mirror=P.aurora({shell:2.5,pitch:55,longitude:37,hemisphere:-1});
assert.ok(!mirror.reachesAtmosphere);
eq(Math.sin(P.rad(55))**2*mirror.ratio(mirror.end),1);
eq(mirror.latitudeAt(.5),-mirror.end);
eq(mirror.latitudeAt(.3),mirror.latitudeAt(.7));
eq(P.length(mirror.magneticToEarth(mirror.point(mirror.end))),P.length(mirror.point(mirror.end)));
const transformer=P.transformer({primary:150,secondary:300,voltage:60,frequency:60,load:100,closed:0});
eq(transformer.secondary,120);eq(transformer.current,0);
eq(transformer.at(.25).flux,0);eq(transformer.at(.25).secondary,120*Math.SQRT2);
const wave=P.emWave({frequency:300,angle:37,phase:24});
vv(P.cross(wave.electric,wave.magnetic),[1,0,0]);
eq(wave.at(20),wave.at(20+wave.wavelength));
console.log("Verified electromagnetic models, accelerator energy, magnetic mirroring, transformer ratios and plane wave orientation.");
