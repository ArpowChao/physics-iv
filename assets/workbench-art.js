(() => {
  const {sum,sub,mul,dot,cross,length,unit,clamp,TAU}=EMPhysics;
  const materials={
    copper:{edge:"#753b23",mid:"#bd693d",light:"#ffd4a1",rgb:[193,108,62]},
    steel:{edge:"#314755",mid:"#778f9a",light:"#eaf5f5",rgb:[122,147,160]},
    brass:{edge:"#926129",mid:"#d09b48",light:"#fff0b5",rgb:[205,156,85]},
    red:{edge:"#782e37",mid:"#bb4c54",light:"#ffd0c2",rgb:[177,67,75]},
    blue:{edge:"#143a63",mid:"#376da1",light:"#bce7fa",rgb:[55,113,157]},
    glass:{edge:"#4c95ad",mid:"#7fcddd",light:"#e0fbfa",rgb:[115,193,206]},
    conductor:{edge:"#245a70",mid:"#6fa2b2",light:"#dff4f8",rgb:[126,168,184]}
  };
  const pair=point=>point.map(n=>n.toFixed(2)).join(",");
  const poly=(points,fill,attrs="")=>`<polygon points="${points.map(pair).join(" ")}" fill="${fill}" ${attrs}/>`;
  const stroke=(points,color,width,opacity=1)=>points.length>1?
    `<polyline points="${points.map(pair).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`:"";
  const sphereCoords=(latitude,longitude,r=1)=>[
    r*Math.cos(latitude)*Math.cos(longitude),r*Math.cos(latitude)*Math.sin(longitude),r*Math.sin(latitude)
  ];
  const orbGradients=Object.entries({
    red:["#fff1d9","#e36d63","#7e2535"],
    blue:["#f0fdff","#65b0de","#174579"],
    copper:["#ffeac3","#cf8757","#7b3520"],
    steel:["#fff","#91b1bd","#304a59"],
    conductor:["#f6feff","#7eb1c4","#234f63"],
    particle:["#fff","#c3fdfa","#3e9edb"],
    spark:["#fff","#ffe6a8","#f7894c"]
  }).map(([name,[light,mid,dark]])=>`<radialGradient id="art-orb-${name}" cx="32%" cy="24%" r="76%"><stop stop-color="${light}"/><stop offset=".48" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/></radialGradient>`).join("");
  const defs=`<defs>
    ${orbGradients}
    <radialGradient id="art-lab" cx="46%" cy="35%" r="74%"><stop stop-color="#fffdf7"/><stop offset=".6" stop-color="#f0f2eb"/><stop offset="1" stop-color="#dbe5e4"/></radialGradient>
    <radialGradient id="art-beam" cx="51%" cy="46%" r="68%"><stop stop-color="#173345"/><stop offset=".6" stop-color="#112432"/><stop offset="1" stop-color="#0b1622"/></radialGradient>
    <radialGradient id="art-space" cx="54%" cy="57%" r="76%"><stop stop-color="#1a354b"/><stop offset=".51" stop-color="#0c2033"/><stop offset="1" stop-color="#050e20"/></radialGradient>
    <radialGradient id="art-sea" cx="34%" cy="24%" r="78%"><stop stop-color="#3b8da8"/><stop offset=".5" stop-color="#145676"/><stop offset="1" stop-color="#071f3c"/></radialGradient>
    <radialGradient id="art-earth-light" cx="35%" cy="25%" r="77%"><stop offset=".35" stop-color="#e8ffef" stop-opacity=".17"/><stop offset=".7" stop-color="#0b2a4f" stop-opacity=".12"/><stop offset="1" stop-color="#03152d" stop-opacity=".83"/></radialGradient>
    <radialGradient id="art-halo"><stop offset=".91" stop-color="#559fd2" stop-opacity="0"/><stop offset=".95" stop-color="#76dfff" stop-opacity=".77"/><stop offset="1" stop-color="#4898ce" stop-opacity="0"/></radialGradient>
    <radialGradient id="art-particle-halo"><stop stop-color="#d8ffff" stop-opacity=".94"/><stop offset=".34" stop-color="#70e6f6" stop-opacity=".38"/><stop offset="1" stop-color="#38bcf9" stop-opacity="0"/></radialGradient>
    <radialGradient id="art-spark-halo"><stop stop-color="#fff5c5" stop-opacity=".94"/><stop offset=".36" stop-color="#ffb255" stop-opacity=".5"/><stop offset="1" stop-color="#ff7426" stop-opacity="0"/></radialGradient>
    <radialGradient id="art-aurora-halo"><stop stop-color="#a2ffe0" stop-opacity=".55"/><stop offset=".5" stop-color="#43f7a6" stop-opacity=".27"/><stop offset="1" stop-color="#24bfa8" stop-opacity="0"/></radialGradient>
    <linearGradient id="art-curtain" x2="0%" y2="100%"><stop stop-color="#c396ff" stop-opacity="0"/><stop offset=".54" stop-color="#58f3b1" stop-opacity=".48"/><stop offset="1" stop-color="#acffbe" stop-opacity=".83"/></linearGradient>
    <radialGradient id="art-shadow"><stop stop-color="#233c44" stop-opacity=".23"/><stop offset="1" stop-color="#233c44" stop-opacity="0"/></radialGradient>
    <radialGradient id="art-cavity-well" cx="62%" cy="66%" r="74%"><stop stop-color="#f7fbfc"/><stop offset=".68" stop-color="#dbe8ec"/><stop offset="1" stop-color="#8daab7"/></radialGradient>
  </defs>`;
  function makeArt({width,height,theme,project,scale,toward,append}){
    const dark=theme!=="lab";
    const circles=(point,r,fill,attrs="")=>{
      const [x,y]=project(point);
      append(`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${fill}" ${attrs}/>`);
    };
    function backdrop(){
      let base=`<rect width="${width}" height="${height}" fill="url(#art-${theme})"/>`;
      if(theme==="space"){
        for(let i=0;i<91;i++){
          const x=((i*139.41+i*i*3.61)%width).toFixed(1),y=((i*67.27+i*i*.95)%height).toFixed(1);
          base+=`<circle cx="${x}" cy="${y}" r="${i%17===0?1.25:.46}" fill="#e6f4ff" opacity="${i%17===0?.65:.32}"/>`;
        }
      }else if(theme==="lab"){
        base+=`<ellipse cx="${width/2}" cy="${height*.76}" rx="${width*.33}" ry="${height*.075}" fill="url(#art-shadow)" opacity=".55"/>`;
      }
      return defs+base;
    }
    function tube(nodes,r,material="copper",opacity=1){
      const colors=materials[material];
      const points=nodes.map(project), width=clamp(2*r*scale,2,68);
      if(points.length===2&&length(sub(points[0],points[1]))<.1){
        const finish=material==="glass"||material==="brass"?"steel":material;
        circles(nodes[0],width/2,`url(#art-orb-${finish})`,`opacity="${opacity}"`);
        return;
      }
      const highlight=points.map(([x,y])=>[x-width*.08,y-width*.19]);
      append(`<g opacity="${opacity}">${stroke(points,colors.edge,width+1.5,.93)}${stroke(points,colors.mid,width*.86)}
        ${stroke(highlight,colors.light,width*.24,.74)}</g>`);
    }
    function splitTube(nodes,r,material,isFront,drawMiddle){
      const sides=[[],[]];
      for(let i=1;i<nodes.length;i++){
        const a=nodes[i-1],b=nodes[i],side=sides[Number(isFront(mul(sum(a,b),.5)))];
        const run=side.at(-1);
        if(run?.at(-1)===a)run.push(b);
        else side.push([a,b]);
      }
      sides[0].forEach(run=>tube(run,r,material));
      drawMiddle();
      sides[1].forEach(run=>tube(run,r,material));
    }
    function slab(vertices,offset,material="steel",opacity=1){
      const [a,b,c]=vertices, normal=cross(sub(b,a),sub(c,b));
      const outline=dot(normal,offset)<0?[...vertices].reverse():vertices;
      const front=outline.map(v=>sum(v,mul(offset,.5))),back=outline.map(v=>sub(v,mul(offset,.5)));
      const faces=[front,[...back].reverse(),...front.map((a,i)=>{
        const j=(i+1)%front.length;
        return [front[j],a,back[i],back[j]];
      })];
      const light=unit([-.48,-.38,.79]);
      const color=materials[material].rgb;
      const records=faces.map(face=>{
        const normal=unit(cross(sub(face[1],face[0]),sub(face[2],face[1])));
        const depth=face.reduce((sum,v)=>sum+dot(v,toward),0)/face.length;
        const shade=.69+.48*Math.max(0,dot(normal,light));
        const fill=`rgb(${color.map(v=>Math.round(clamp(v*shade,0,255))).join(",")})`;
        return {depth,draw:poly(face.map(project),fill,'stroke="'+fill+'" stroke-width=".48" stroke-linejoin="round"')};
      }).sort((a,b)=>a.depth-b.depth);
      append(`<g opacity="${opacity}">${records.map(face=>face.draw).join("")}</g>`);
    }
    function orb(point,r,kind="steel",highlight=false,opacity=1){
      const radius=clamp(r*scale,4.5,160);
      if(highlight)circles(point,radius*3.2,kind==="spark"?"url(#art-spark-halo)":"url(#art-particle-halo)");
      circles(point,radius,`url(#art-orb-${kind})`,`opacity="${opacity}" stroke="#f9ffff" stroke-opacity=".6" stroke-width=".9"`);
    }
    function trail(nodes,color="#83e8ef",opacity=1,width=2.1){
      const points=nodes.map(project);
      append(stroke(points,color,width*4,.11*opacity)+stroke(points,color,width*2,.22*opacity)+stroke(points,color,width,opacity));
    }
    function earth(){
      const center=project([0,0,0]);
      circles([0,0,0],scale*1.055,"url(#art-halo)");
      circles([0,0,0],scale,"url(#art-sea)");
      for(const ring of EM.earthLand){
        const clipped=[];
        let a=ring.at(-1), da=dot(a,toward);
        for(const b of ring){
          const db=dot(b,toward);
          if((da>=0)!==(db>=0)){
            const fraction=da/(da-db);
            clipped.push({point:unit(sum(a,mul(sub(b,a),fraction))),horizon:true});
          }
          if(db>=0)clipped.push({point:b,horizon:false});
          a=b;da=db;
        }
        if(clipped.length<3)continue;
        const screen=[];
        for(let i=0;i<clipped.length;i++){
          const v=clipped[i], next=clipped[(i+1)%clipped.length], xy=project(v.point);
          screen.push(xy);
          if(!v.horizon||!next.horizon)continue;
          const end=project(next.point);
          const from=Math.atan2(xy[1]-center[1],xy[0]-center[0]);
          const to=Math.atan2(end[1]-center[1],end[0]-center[0]);
          const span=(to-from+3*Math.PI)%TAU-Math.PI;
          for(let f=1/12;f<1;f+=1/12){
            const angle=from+span*f;
            screen.push([center[0]+scale*Math.cos(angle),center[1]+scale*Math.sin(angle)]);
          }
        }
        const mean=clipped.reduce((n,v)=>n+v.point[2],0)/clipped.length;
        append(poly(screen,Math.abs(mean)>.93?"#c3d9df":Math.abs(mean)>.65?"#6f9993":"#689e81",'stroke="#9abd9f" stroke-width=".37" stroke-opacity=".45"'));
      }
      circles([0,0,0],scale,"url(#art-earth-light)");
      circles([0,0,0],scale,"none",'stroke="#95e1fb" stroke-width="1.4" stroke-opacity=".78"');
    }
    const frontOfEarth=point=>dot(point,toward)>=0||length(cross(point,toward))>=1;
    function curtain(latitude,longitude,radius,toEarth){
      const onShell=(lat,phi,r)=>toEarth(sphereCoords(lat,phi,r));
      for(let row=0;row<3;row++){
        const lower=[], upper=[], visible=[];
        for(let i=0;i<=82;i++){
          const u=i/82, phi=longitude+(u-.5)*(2.8-row*.15);
          const lat=latitude+Math.sign(latitude)*(.008*row+.014*Math.sin(u*16+row)+.006*Math.cos(u*32+row));
          const bottom=onShell(lat,phi,radius);
          const height=(.013+.009*Math.sin(u*19+row)**2)*Math.sin(Math.PI*u)**.7;
          lower.push(bottom);upper.push(onShell(lat,phi,radius+height));
          visible.push(frontOfEarth(bottom));
        }
        for(let i=1;i<lower.length;i++){
          if(!visible[i-1]||!visible[i])continue;
          const opacity=(.99-row*.21)*Math.sin(Math.PI*i/lower.length)**.65;
          if(i%3===0)circles(lower[i],scale*.043,"url(#art-aurora-halo)",`opacity="${opacity*.44}"`);
          append(poly([lower[i-1],lower[i],upper[i],upper[i-1]].map(project),"url(#art-curtain)",`opacity="${opacity}"`));
          append(stroke([lower[i-1],lower[i]].map(project),"#96ffd3",1.5,opacity));
          if(i%2===0)append(stroke([lower[i],upper[i]].map(project),i%5===0?"#b796fa":"#68f6c7",.7,opacity*.21));
        }
      }
    }
    return {dark,backdrop,tube,splitTube,slab,orb,trail,earth,frontOfEarth,curtain,depth:point=>dot(point,toward)};
  }
  EM.makeWorkbenchArt=makeArt;
})();
