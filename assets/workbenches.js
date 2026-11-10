(() => {
  const P=EMPhysics, {sum,sub,mul,dot,cross,length,unit,clamp,rad,TAU,sample,ring,zero}=P;
  const C={ink:"#17343e",muted:"#526d76",grid:"#d3e3e5",teal:"#136d60",blue:"#245aa4",amber:"#975215",violet:"#783ea0",red:"#aa3545",white:"#f4fafb"};
  const darkColors=new Map([[C.ink,"#ddf8ff"],[C.muted,"#9bbbc9"],[C.grid,"#2b485c"],[C.teal,"#7de2ce"],[C.blue,"#8cbdfb"],[C.amber,"#ffcb83"],[C.violet,"#d5b8ff"],[C.red,"#fda9a8"]]);
  const fmt=(x,d=2)=>Number.isFinite(x)?(Math.abs(x)<.5*10**-d?0:x).toLocaleString("en-US",{maximumFractionDigits:d}):"—";
  const vec=(x,d=2)=>"("+x.map(v=>fmt(v,d)).join(", ")+")";
  const mag=(x,u,d=2)=>fmt(length(x),d)+" "+u;
  const ctl=(key,label,min,max,step,value,unit="")=>({key,label,min,max,step,value,unit});
  const pick=(key,label,choices,value)=>({key,label,choices,value});
  const item=(key,label,value)=>[key,label,value];
  const txt=(s)=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const planes={
    xy:{axes:[0,1],normal:[0,0,1]},
    xz:{axes:[0,2],normal:[0,-1,0]},
    yz:{axes:[1,2],normal:[1,0,0]}
  };
  function planePoint(axes,a,b,origin=zero){
    const point=[...origin];
    point[axes[0]]=a;
    point[axes[1]]=b;
    return point;
  }
  const path=(points,color,w=1.8,dash="")=>points.length?`<polyline fill="none" points="${points.map(v=>v.map(n=>n.toFixed(2)).join(",")).join(" ")}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${dash?`stroke-dasharray="${dash}"`:""}/>`:"";
  const arrow2=(a,b,c,w=2)=>{
    const d=sub(b,a), n=length(d);
    if(n<2)return "";
    const [x,y]=unit(d), tip=clamp(n*.42,3,9), h=sub(b,mul([x,y],tip));
    return path([a,b],c,w)+`<polygon fill="${c}" points="${[b,sum(h,mul([-y,x],tip*.5)),sub(h,mul([-y,x],tip*.5))].map(v=>v.join(",")).join(" ")}"/>`;
  };
  function scene(camera,extent=30,label="實驗模型",grid=true){
    extent=camera.comparisonExtent??extent;
    const plane=planes[camera.plane];
    const W=560,H=390,yaw=rad(camera.yaw??0),pitch=rad(camera.pitch??0);
    const scale=H*(plane ? .445 : .41)/extent*camera.zoom;
    const axes=plane?.axes||[0,1];
    const right=plane?planePoint(axes,1,0):[Math.cos(yaw),-Math.sin(yaw),0];
    const up=plane?planePoint(axes,0,1):[Math.sin(yaw)*Math.sin(pitch),Math.cos(yaw)*Math.sin(pitch),Math.cos(pitch)];
    const toward=cross(right,up);
    const proj=point=>[W/2+scale*dot(point,right),H/2-scale*dot(point,up)];
    const theme=camera.theme||"lab", tags=[], probes=[];
    let topBand="";
    const art=EM.makeWorkbenchArt({width:W,height:H,theme,project:proj,scale,toward,append:markup=>{out+=markup;}});
    let out=art.backdrop();
    const color=c=>art.dark?(darkColors.get(c)||c):c;
    const draw=(nodes,c,w,d,opacity=1)=>{
      const line=path(nodes.map(proj),color(c),w,d);
      out+=opacity===1?line:`<g opacity="${opacity}">${line}</g>`;
    };
    const polygon=(nodes,fill,opacity=.17)=>{out+=`<polygon points="${nodes.map(x=>proj(x).join(",")).join(" ")}" fill="${color(fill)}" opacity="${opacity}"/>`;};
    const arrow=(a,b,c,w=2.3,tag,always=false)=>{
      if(!camera.analysis&&!always)return;
      c=color(c);
      const start=proj(a),end=proj(b);
      const delta=sub(b,a), normal=dot(delta,toward);
      if(length(sub(end,start))<2){
        if(w<1.8||length(delta)<1e-8)return;
        normalGlyph(...start,c,normal>0);
      }else{
        out+=arrow2(start,end,c,w);
        if(plane&&tag&&w>=1.8&&Math.abs(normal)>length(delta)*.04)normalGlyph(start[0]-9,start[1]+9,c,normal>0);
      }
      if(tag&&(camera.labels||always))tags.push([end,tag,c]);
    };
    function normalGlyph(x,y,c,front){
      out+=`<circle cx="${x}" cy="${y}" r="6" fill="${C.white}" stroke="${c}" stroke-width="1.8" data-normal="${front?"out":"in"}"/>`;
      out+=front?`<circle cx="${x}" cy="${y}" r="2" fill="${c}"/>`:
        path([[x-2.7,y-2.7],[x+2.7,y+2.7]],c,1.4)+path([[x+2.7,y-2.7],[x-2.7,y+2.7]],c,1.4);
    }
    function mark(v,c,tag,r=4){
      const [x,y]=proj(v);
      out+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${color(c)}" stroke="${C.white}" stroke-width="1.3"/>`;
      if(tag&&camera.labels)tags.push([[x,y],tag,color(c)]);
    }
    function probe(v,tag="P"){
      const [x,y]=proj(v);
      art.orb(v,5.7/scale,"steel");
      if(tag&&camera.labels)tags.push([[x,y],tag,color(C.ink)]);
      probes.push(`<circle cx="${x}" cy="${y}" r="15" fill="transparent" data-probe="true"/>`);
    }
    function charge(v,positive,r=10){
      const [x,y]=proj(v), arm=r*.4;
      art.orb(v,r/scale,positive?"red":"blue");
      out+=`<path d="M${x-arm} ${y}h${2*arm}${positive?` M${x} ${y-arm}v${2*arm}`:""}" stroke="#fff" stroke-width="${r*.17}" stroke-linecap="round"/>`;
    }
    function landmark(v,tag,c,kind){
      const [x,y]=proj(v);
      if(x<8||x>W-8||y<8||y>H-8)return;
      out+=`<path data-landmark="${kind}" d="M${x} ${y-6}l6 6-6 6-6-6Z" fill="#fff" stroke="${c}" stroke-width="2"/>`;
      tags.push([[x,y],tag,c]);
    }
    function surface(faces){
      const sorted=faces.map(([nodes,fill])=>({nodes,fill,depth:nodes.reduce((n,p)=>n+dot(p,toward),0)/nodes.length}));
      sorted.sort((a,b)=>a.depth-b.depth);
      out+='<g data-potential-surface="true">';
      for(const {nodes,fill} of sorted){
        const vertices=nodes.map(p=>proj(p).map(x=>x.toFixed(2)).join(",")).join(" ");
        out+=`<polygon points="${vertices}" fill="${fill}" stroke="#243347" stroke-opacity=".13" stroke-width=".5"/>`;
      }
      out+="</g>";
    }
    function annulus(outer,inner,fill){
      const loop=nodes=>"M"+nodes.map(p=>proj(p).join(",")).join("L")+"Z";
      out+=`<path d="${loop(outer)}${loop(inner)}" fill="${fill}" fill-rule="evenodd"/>`;
    }
    function fieldKey(pair,zeroLabel){
      const distant=pair.net<0?"由無窮遠進入":"通往無窮遠";
      const key=(x,label,c)=>`<path d="M${x} -17h20" stroke="${c}" stroke-width="4" stroke-linecap="round"/><text x="${x+29}" y="-11" fill="${C.ink}">${txt(label)}</text>`;
      topBand=`<g data-field-key="true" font-size="19" font-weight="650">
        <rect x="0" y="-62" width="${W}" height="62" fill="#fffdf8"/>
        <path d="M0 -.5h${W}" stroke="#cad7d5"/>
        <text x="16" y="-38" fill="${C.ink}">Q₁ ${pair.counts[0]} 條　 Q₂ ${pair.counts[1]} 條</text>
        <text x="${W-16}" y="-38" text-anchor="end" fill="${C.violet}">${txt(pair.x===null?zeroLabel:"E = 0　"+zeroLabel)}</text>
        ${key(18,"相連 "+lineCount(pair.joined),linkedLine)}
        ${key(216,distant+" "+lineCount(2*Math.abs(pair.net))+(camera.electroLinkedOnly?"（暫藏）":""),distantLine)}
      </g>`;
    }
    const g=extent*.85;
    if(grid&&camera.grid!==false){
      for(let i=-4;i<=4;i++){
        const a=g*i/4;
        draw([planePoint(axes,-g,a),planePoint(axes,g,a)],C.grid,1);
        draw([planePoint(axes,a,-g),planePoint(axes,a,g)],C.grid,1);
      }
    }
    if(grid&&camera.axes!==false){
      const activeAxes=plane?axes:[0,1,2];
      activeAxes.forEach(axis=>arrow(zero,zero.map((_,i)=>i===axis?g:0),C.muted,1.1,camera.labels?"xyz"[axis]:"",true));
    }
    return {...art,draw,polygon,arrow,dot:mark,probe,charge,landmark,surface,annulus,fieldKey,project:proj,scale,finish(){
      // Keep vector tags readable and inside the viewport; place overlapping labels on nearby rows.
      const used=[];
      const labels=tags.map(([[x,y],text,color])=>{
        if(x<0||y<0||x>W||y>H)return "";
        const w=Math.max(17,10+Array.from(text).length*10), px=clamp(x+6,2,W-w-2);
        let py=clamp(y-12,12,H-10);
        for(let i=0;i<6&&used.some(([a,b,c])=>px<c+2&&px+w>a-2&&Math.abs(py-b)<16);i++)py=clamp(py+(py>H-26?-19:18),12,H-10);
        used.push([px,py,px+w]);
        return `<text x="${px+5}" y="${py+1}" class="bench-plot-label" font-size="15" fill="${color}">${txt(text)}</text>`;
      }).join("");
      const view=plane?camera.plane.toUpperCase()+" 平面投影":"3D 空間";
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${topBand?-62:0} ${W} ${H+(topBand?62:0)}" data-theme="${theme}" data-projection="${camera.plane||"3d"}" data-right="${right}" data-up="${up}" data-scale="${scale}" role="img" aria-label="${txt(view+"・"+label)}">${out}${labels}${probes.join("")}${topBand}</svg>`;
    }};
  }
  function chart(xmax,series,at,xlabel="時間 t（s）",xmin=0){
    const W=560,H=series.length*112+33,L=89,R=535, span=xmax-xmin, X=x=>L+(R-L)*(x-xmin)/span;
    let out="";
    series.forEach(({values,name,unit,color,absolute=false,zeroes=[]},i)=>{
      const amplitude=Math.max(0,...values.filter(([,v])=>Number.isFinite(v)).map(([,v])=>Math.abs(v))), high=amplitude||1, y=26+112*i;
      const min=absolute?0:-high, max=high;
      const Y=n=>y+74-(n-min)/(max-min)*74;
      for(const f of [0,.25,.5,.75,1])out+=path([[X(xmin+span*f),y],[X(xmin+span*f),y+74]],C.grid,1);
      out+=path([[L,Y(0)],[R,Y(0)]],C.muted,1)+path([[L,y],[R,y]],C.grid,1);
      out+=`<text x="12" y="${y-9}" fill="${color}" font-size="16" font-weight="700">${txt(name)}（${txt(unit)}）</text>`;
      const tick=high>=100000||high<.001?high.toExponential(1):fmt(high,high>=10?1:3);
      if(amplitude)out+=`<text x="82" y="${y+10}" text-anchor="end" fill="${C.muted}" font-size="15">${tick}</text>${min<0?`<text x="82" y="${y+78}" text-anchor="end" fill="${C.muted}" font-size="15">−${tick}</text>`:""}`;
      out+=`<text x="82" y="${Y(0)+5}" text-anchor="end" fill="${C.muted}" font-size="15">0</text>`;
      let run=[];
      for(const [t,n] of values) {
        if(Number.isFinite(n))run.push([X(t),Y(n)]);
        else{out+=path(run,color,2.6);run=[];}
      }
      out+=path(run,color,2.6);
      if(Number.isFinite(at)&&at>=xmin&&at<=xmax)out+=path([[X(at),y],[X(at),y+74]],C.ink,1.1,"4 4");
      for(const z of zeroes.filter(z=>z>=xmin&&z<=xmax)){
        out+=`<circle data-axis-zero="true" cx="${X(z)}" cy="${Y(0)}" r="4.5" fill="#fff" stroke="${color}" stroke-width="2"><title>x = ${fmt(z,2)} cm</title></circle>`;
      }
    });
    for(const f of [0,.25,.5,.75,1])out+=`<text x="${X(xmin+span*f)}" y="${H-22}" text-anchor="middle" fill="${C.muted}" font-size="13">${fmt(xmin+span*f,2)}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" data-start="${L/W}" data-end="${R/W}" role="img" aria-label="${txt(series.map(s=>s.name).join("、")+"對"+xlabel+"的圖；虛線是目前位置")}">${out}<text x="${R}" y="${H-3}" text-anchor="end" fill="${C.muted}" font-size="15">${txt(xlabel)}</text></svg>`;
  }
  const xyz=(x,y,z)=>[ctl("x","P：x", -28,28,.5,x,"cm"),ctl("y","P：y",-28,28,.5,y,"cm"),ctl("z","P：z",-28,28,.5,z,"cm")];
  const I=ctl("i","電流 I",-8,8,.5,4,"A");
  const probe=ctl("probe","選取電流元位置",0,100,1,52,"%");
  const radius=ctl("radius","線圈半徑 R",4,15,.5,9,"cm");
  const pointArrow=(s,a,v,size,c,tag,w=2.4,always=false)=>{if(length(v)>1e-9)s.arrow(a,sum(a,mul(unit(v),size)),c,w,tag,always);};
  const sceneOut=(s,rows,legend,note,graph="")=>({diagram:s.finish(),rows,legend,note,graph});
  const biotModes=[
    {id:"element",title:"單一電流元",controls:[I,ctl("dl","電流元長 Δℓ",.5,5,.5,2,"cm"),ctl("theta","Δℓ 與 +z 夾角",0,180,5,90,"°"),ctl("phi","Δℓ 方位角",0,360,5,0,"°"),...xyz(5,12,8)],
      task:"將 Δℓ 設為 +x，先令 P 在 x 軸上，再移到 y 軸和 z 軸，觀察三維叉積。固定角度，把 r 加倍，比較 ΔB。"},
    {id:"straight",title:"有限／近似長直導線",controls:[I,ctl("half","導線半長",5,35,1,24,"cm"),probe,...xyz(0,8,6)],
      task:"在導線中垂面固定 P，增加線段長度，看看合磁場如何接近長直導線的 μ₀I/(2πr)。"},
    {id:"compass",title:"通電導線與指南針",controls:[I,ctl("distance","指南針到導線的距離",3,24,1,8,"cm"),ctl("earth","水平地磁分量",0,60,5,25,"μT")],
      task:"在 XY 平面讀指南針的偏轉角。反轉電流，觀察導線磁場的方向與合磁場如何改變。"},
    {id:"pair",title:"雙平行導線",controls:[I,ctl("spacing","導線間距",4,22,1,14,"cm"),pick("relative","兩線電流方向",[[1,"同向"],[-1,"反向"]],-1),probe,...xyz(0,0,0)],
      task:"在兩線的正中間切換同向與反向。哪些分量相消？再讓 P 離開兩線所在平面。"},
    {id:"loop",title:"圓線圈",controls:[I,radius,probe,...xyz(0,0,10)],
      task:"讓 P 先在圓線圈中心，再沿 z 軸移動；觀察單段磁場的分量如何疊加成軸向磁場。"},
    {id:"solenoid",title:"有限長螺線管",controls:[I,radius,ctl("coil","繞組長度",8,42,1,26,"cm"),ctl("turns","線圈匝數",3,30,1,16,"匝"),probe,...xyz(0,0,0)],
      task:"在管中心、端口和管外量測。用長螺線管近似比較，找出它在哪些位置會偏離有限線圈的結果。"}
  ];
  function drawCompass(p,camera){
    const s=scene(camera,29,"長直導線、地磁與指南針偏轉");
    const point=[p.distance,0,0], wire=[0,20*p.i/p.distance,0], earth=[p.earth,0,0], total=sum(wire,earth);
    s.tube([[0,0,-23],[0,0,23]],.85);
    if(p.i)pointArrow(s,[0,0,-7],[0,0,p.i],14,C.amber,"I");
    const dial=ring(4.8,0,48).slice(0,-1).map(v=>sum(point,v));
    s.slab(dial,[0,0,.7],"steel");
    s.polygon(dial.map(v=>sum(v,[0,0,.38])),"#f8f6e9",1);
    const pivot=sum(point,[0,0,.43]), axis=length(total)?unit(total):[1,0,0], wing=[-axis[1],axis[0],0];
    for(const angle of [-90,-60,-30,0,30,60,90]){
      const a=rad(angle), direction=[Math.cos(a),Math.sin(a),0];
      s.draw([sum(pivot,mul(direction,angle===0?3.6:4.18)),sum(pivot,mul(direction,4.64))],C.muted,angle===0?1.5:.8);
    }
    const needleBase=[sum(pivot,mul(wing,.92)),sub(pivot,mul(wing,.92))];
    s.polygon([...needleBase,sum(pivot,mul(axis,4.1))],C.red,length(total)?1:.34);
    s.polygon([...needleBase,sub(pivot,mul(axis,4.1))],C.blue,length(total)?1:.34);
    s.dot(pivot,C.muted,"",2.4);
    pointArrow(s,point,earth,9,C.blue,"地磁");
    pointArrow(s,point,wire,9,C.violet,"導線磁場");
    pointArrow(s,point,total,13,C.teal,"N",2.9);
    return sceneOut(s,[item("wire","導線的磁場",fmt(wire[1],2)+" μT（沿 y）"),item("total","合磁場量值",mag(total,"μT")),
      item("angle","指南針偏轉角（從 +x 量起）",length(total)?fmt(Math.atan2(total[1],total[0])*180/Math.PI,1)+"°":"合磁場為零")],
      [[C.amber,"導線電流 I"],[C.blue,"地磁"],[C.violet,"導線磁場"],[C.teal,"指南針北端指向"]],
      "導線磁場採長直導線近似，地磁僅取水平分量。兩磁場相加後決定指南針的水平指向。");
  }
  const biot={
    id:"biot",title:"必歐－沙伐定律：三維磁場工作臺",sections:["2-1","2-2"],modes:biotModes,
    description:"轉動空間視角，移動觀測點 P，逐段追蹤電流元、位置向量、分磁場與合磁場。",
    formula:"ΔB = (μ₀ / 4π) · I(Δℓ × r̂) / r²",
    camera:{yaw:-32,pitch:25,zoom:1},
    draw(mode,p,camera){
      if(mode==="compass")return drawCompass(p,camera);
      const m=P.biot(mode,p), e=m.selected, single=mode==="element";
      const extent=single?Math.max(23,e.d+8):mode==="straight"?Math.max(24,p.half):
        mode==="solenoid"?Math.max(21,p.coil*.62,p.radius*1.4):24;
      const s=scene(camera,extent,"電流分布與觀測點 P 的磁場向量");
      const direction=unit(e.dl), planeEdge=single?mul(direction,Math.min(18,e.d)):e.dl;
      if(camera.analysis)s.polygon([e.m,sum(e.m,planeEdge),m.point],C.amber,single ? .16 : .07);
      if(mode==="element"){
        const wire=mul(direction,Math.min(28,extent));
        s.tube([sub(e.m,wire),sum(e.m,wire)],.92);
      }else{
        [...m.paths].sort((a,b)=>s.depth(a.nodes[0])-s.depth(b.nodes[0])).forEach(({nodes,sign})=>{
          s.tube(nodes,mode==="solenoid"?.29:.62);
          const k=Math.floor(nodes.length*.3), a=nodes[k], b=nodes[Math.min(k+3,nodes.length-1)];
          const dir=mul(unit(sub(b,a)),Math.sign(p.i)*sign);
          if(p.i)pointArrow(s,a,dir,3.9,C.amber,"I",2.5);
        });
      }
      s.tube([e.a,e.b],single?1.08:.84,"brass");
      if(single&&camera.comparisonExtent&&!camera.analysis)s.draw([e.m,m.point],C.muted,1.2,"4 4");
      s.probe(m.point); s.arrow(e.m,m.point,C.blue,1.9,"r");
      const plane=planes[camera.plane];
      const trueAngle=!plane||(Math.abs(dot(e.dl,plane.normal))<1e-8&&Math.abs(dot(e.rv,plane.normal))<1e-8);
      if(camera.analysis&&trueAngle&&m.angle>1&&m.angle<179){
        const a=unit(e.dl), b=unit(sub(unit(e.rv),mul(a,dot(a,unit(e.rv))))), arc=Math.min(5.8,e.d*.33), angle=rad(m.angle);
        const offset=u=>sum(e.m,sum(mul(a,arc*Math.cos(u*angle)),mul(b,arc*Math.sin(u*angle))));
        s.draw(sample(28,offset),C.muted,1.35,"3 2");s.dot(offset(.55),C.muted,"θ",2);
      }
      pointArrow(s,e.m,e.dl,7,C.amber,"Δℓ");
      const valid=!m.unsafe&&m.smallElement;
      if(valid&&p.i){
        pointArrow(s,m.point,e.bvec,9,C.violet,"ΔB");
        if(mode!=="element")pointArrow(s,m.point,m.total,14,C.teal,"B",3.2);
      }
      const rows=[item("r","電流元到 P 的距離",fmt(e.d)+" cm"),item("theta","Δℓ 與 r 夾角",m.angle===null?"—":fmt(m.angle,1)+"°")];
      if(!single)rows.push(item("part","選取電流元 ΔB（x, y, z）",valid?vec(e.bvec,3)+" μT":"—"));
      rows.push(item("total",single?"磁場量值 |ΔB|":"磁場量值 |B|",valid?mag(m.total,"μT",3):"—"),
        item("vector",single?"磁場 ΔB（x, y, z）":"合磁場 B（x, y, z）",valid?vec(m.total,3)+" μT":"—"));
      if(mode==="straight"){
        const r=Math.hypot(p.y,p.z);
        rows.push(item("ideal","長直導線近似（同一垂距）",r>=.45?fmt(20*Math.abs(p.i)/r,3)+" μT":"—"));
      }
      if(mode==="solenoid")rows.push(item("ideal","長螺線管內部近似",fmt(40*Math.PI*Math.abs(p.i)*p.turns/p.coil,3)+" μT"));
      return sceneOut(s,rows,[[C.amber,"電流／Δℓ"],[C.blue,"電流元指向 P 的 r"],[C.violet,"分磁場 ΔB"],[C.teal,"向量和 B"]],
        !m.smallElement?"r 小於電流元長的 3 倍，不能把這段視為小電流元；請把 P 移遠或縮短 Δℓ。":m.unsafe?"P 太接近理想細導線；線徑未納入模型，此處不顯示量值。":
        "Δℓ 沿傳統電流方向，公式中的 I 取量值。滑桿的正負表示電流相對基準的方向。箭長示意，分量用全域 x、y、z 座標。有限線段與螺線管以電流元疊加，省略外部回路，螺線管以同軸圓圈近似。");
    }
  };
  const chargeControls=[ctl("q","左側電荷 Q₁",-12,12,1,6,"nC"),ctl("q2","右側電荷 Q₂",-12,12,1,-6,"nC"),
    ctl("spacing","電荷間距",6,28,1,18,"cm"),...xyz(0,8,2)];
  const pairMode=mode=>mode==="charges"||mode==="field-lines";
  const linkedLine="#b05219", distantLine="#377b76";
  const fieldPlane=([x,y],angle)=>[x,y*Math.cos(angle),y*Math.sin(angle)];
  const lineCount=n=>n+" 條";
  const electricExtent=(mode,camera,pair)=>camera.electroRange==="far"?
    Math.max(mode==="cavity"?120:100,Math.abs(pair?.x??0)*1.24):mode==="cavity"?33:25;
  let streamlineCache;

  function drawStream(s,points,camera,extent,sign,guide=false,color=C.teal){
    const split=!camera.plane&&camera.electroDepth!=="section";
    const width=color===linkedLine?2.45:1.45;
    if(!split)s.draw(points,color,width);
    else{
      const opacity=front=>guide?(front?.21:.10):front?.95:camera.electroDepth==="front"?0:.33;
      let run=[points[0]], front=s.depth(points[0])>=0;
      for(let i=1;i<points.length;i++){
        const next=points[i], before=points[i-1], depth=s.depth(next), nextFront=depth>=0;
        if(nextFront!==front){
          const cut=sum(next,mul(sub(before,next),depth/(depth-s.depth(before))));
          if(opacity(front))s.draw([...run,cut],color,guide?1:width,undefined,opacity(front));
          run=[cut];
          front=nextFront;
        }
        run.push(next);
      }
      if(opacity(front))s.draw(run,color,guide?1:width,undefined,opacity(front));
    }
    if(guide)return;
    const total=points.length;
    for(let i=2;i<total;i++){
      const a=points[i-2],b=points[i], [x,y]=s.project(b);
      if(x<24||x>536||y<23||y>367||length(sub(s.project(a),[x,y]))<6)continue;
      if(length(sub(b,points[0]))<extent*.12||(split&&s.depth(b)<0))continue;
      s.arrow(sign>0?a:b,sign>0?b:a,color,1.15,undefined,true);
      break;
    }
  }
  function conductorSection(s,camera,outer,inner=0){
    const axes=(planes[camera.plane]||planes.xy).axes;
    const section=r=>ring(r,0,80).map(([u,v])=>planePoint(axes,u,v));
    if(!camera.plane){
      s.draw(ring(outer).map(([x,y])=>[x,0,y]),"#5c8ea3",1.05,"4 3",.35);
      s.draw(ring(outer).map(([x,y])=>[0,x,y]),"#5c8ea3",1.05,"4 3",.35);
    }
    const shell=section(outer);
    if(inner){
      const cavity=section(inner);
      s.annulus(shell,cavity,"#91b7c4");
      s.draw(cavity,"#28647c",1.35);
    }else s.polygon(shell,"#6fa2b2",.43);
    s.draw(shell,"#28647c",1.45);
  }
  function drawElectricLines(s,mode,p,camera,extent){
    const cavity=mode==="cavity", sphere=mode==="sphere", pair=pairMode(mode);
    const shape=cavity?P.cavityGeometry(p):null;
    if(sphere)conductorSection(s,camera,p.radius);
    if(cavity)conductorSection(s,camera,shape.outer,shape.inner);
    if(!sphere&&camera.plane==="yz"){
      for(const y of [-.48,0,.48])for(const z of [-.48,0,.48]){
        const origin=[0,y*extent,z*extent], field=P.electro(mode,p,origin)?.e||zero;
        pointArrow(s,origin,field,extent*.14,C.teal,undefined,2,true);
      }
      return;
    }
    const main=camera.plane==="xz"?Math.PI/2:0, far=extent*3.5;
    const spatial=!camera.plane&&camera.electroDepth==="depth";
    if(sphere){
      const count=2*Math.abs(p.q);
      for(let i=0;i<count;i++){
        const theta=TAU*(i+.5)/count, a=fieldPlane([Math.cos(theta),Math.sin(theta)],main);
        const rays=sample(24,u=>mul(a,p.radius+u*(far-p.radius)));
        if(spatial&&i%Math.max(2,Math.ceil(count/6))===0){
          drawStream(s,rays.map(([x,y])=>[x,0,y]),camera,extent,Math.sign(p.q),true);
        }
        drawStream(s,rays,camera,extent,Math.sign(p.q));
      }
    }else{
      const key=[mode,p.q,p.q2,p.spacing,p.offset,far].join("/");
      if(streamlineCache?.key!==key){
        streamlineCache={key,paths:cavity?P.cavityStreamlines(p,far):P.electricStreamlines(p,far)};
      }
      const {paths}=streamlineCache;
      const layer=(angle,guide,selected,color)=>selected.forEach(({points,sign},i)=>{
        if(guide&&i%Math.max(2,Math.ceil(selected.length/5))!==0)return;
        for(const side of [-1,1]){
          const trace=points.map(([x,y])=>fieldPlane([x,side*y],angle));
          drawStream(s,trace,camera,extent,sign,guide,color);
        }
      });
      if(pair){
        const linked=paths.filter(path=>path.end!==null);
        if(!camera.electroLinkedOnly){
          const distant=paths.filter(path=>path.end===null);
          if(spatial)layer(Math.PI/2,true,distant,distantLine);
          layer(main,false,distant,distantLine);
        }
        layer(main,false,linked,linkedLine);
      }else{
        if(spatial)layer(Math.PI/2,true,paths,C.teal);
        layer(main,false,paths,C.teal);
      }
      const charges=cavity?[[p.offset,p.q],[shape.external,p.q2]]:pair?[[-p.spacing/2,p.q],[p.spacing/2,p.q2]]:[];
      const radius=camera.electroRange==="far"?clamp(s.scale*(p.spacing??shape.external)*.26,4.5,9):10;
      charges.filter(([,q])=>q).sort(([a],[b])=>s.depth([a,0,0])-s.depth([b,0,0]))
        .forEach(([x,q])=>s.charge([x,0,0],q>0,radius));
    }
  }
  function potentialTerrain(s,mode,p,camera,extent){
    const point=[p.x,p.y,p.z], axes=(planes[camera.plane]||planes.xy).axes;
    const cap=mode==="plates"?30:mode==="sphere"?9000:12000, bound=extent*.83;
    const fixed=[0,1,2].find(i=>!axes.includes(i));
    const cut=pairMode(mode)||mode==="cavity"?zero:point;
    const poles=pairMode(mode)?[[-p.spacing/2,p.q],[p.spacing/2,p.q2]]:mode==="cavity"?[[p.offset,p.q],[P.cavityGeometry(p).external,p.q2]]:[];
    const evaluate=(a,b)=>{
      const xyz=planePoint(axes,a,b,cut), at=P.electro(mode,p,xyz);
      const singular=poles.find(([x,q])=>q&&length(sub(xyz,[x,0,0]))<.45);
      return clamp(at?.v??Math.sign(singular?.[1]??0)*cap,-cap,cap);
    };
    function terrainPoint(a,b,v){
      return camera.plane?planePoint(axes,a,b):[a,b,.57*extent*v/cap];
    }
    const refine=(axis,extra)=>[...new Set([...axis,...extra.filter(x=>Math.abs(x)<bound)])].sort((a,b)=>a-b);
    const axis=sample(34,u=>bound*(2*u-1));
    const xs=axes[0]===0?refine(axis,poles.filter(([,q])=>q).flatMap(([x])=>[x-1,x-.5,x,x+.5,x+1])):axis;
    const ys=refine(axis,[-1,-.5,0,.5,1]);
    const grid=ys.map(b=>xs.map(a=>({v:evaluate(a,b),a,b})));
    const first=grid[0][0].v;
    const uniform=grid.every(row=>row.every(({v})=>Math.abs(v-first)<1e-8))?first:null;
    const faces=[], levels=[];
    for(let j=1;j<ys.length;j++)for(let i=1;i<xs.length;i++){
      const corners=[grid[j-1][i-1],grid[j-1][i],grid[j][i],grid[j][i-1]];
      const avg=corners.reduce((n,c)=>n+c.v,0)/4, t=Math.min(1,Math.abs(avg/cap))**.46;
      const mid=[222,232,229], tone=avg<0?[33,72,153]:[183,46,37];
      const fill=`rgb(${mid.map((v,k)=>Math.round(v+(tone[k]-v)*t)).join(",")})`;
      faces.push([corners.map(({a,b,v})=>terrainPoint(a,b,v)),fill]);
      const cuts=[];
      corners.forEach((a,k)=>{
        const b=corners[(k+1)%4];
        if((a.v>=0)===(b.v>=0))return;
        const t=a.v/(a.v-b.v);
        cuts.push(terrainPoint(a.a+t*(b.a-a.a),a.b+t*(b.b-a.b),0));
      });
      if(cuts.length===2)levels.push(cuts);
    }
    s.surface(faces);
    for(const segment of levels)s.draw(segment,"#253c48",1.4);
    if(Math.abs(point[fixed]-cut[fixed])<1e-8&&Math.abs(point[axes[0]])<bound&&Math.abs(point[axes[1]])<bound){
      const [a,b]=axes.map(i=>point[i]);
      s.dot(terrainPoint(a,b,evaluate(a,b)),C.ink,"P");
    }
    return {cap,slice:"xyz"[fixed]+" = "+fmt(cut[fixed])+" cm",bound,uniform,pointAt:(a,b)=>terrainPoint(a,b,evaluate(a,b))};
  }
  function axisProfile(mode,p,camera,extent,pair){
    let min=-extent*1.5,max=extent*1.5;
    const half=p.spacing/2, zeros=pair?.potentialZeroes||[];
    const outerZero=zeros[1];
    // In a far-field comparison of unequal opposite charges, magnify the side containing the null.
    const zoomProfile=camera.electroRange==="far"&&outerZero!==undefined;
    if(zoomProfile){
      const x=Math.abs(pair.x);
      const edge=half+(Math.abs(outerZero)-half)*.6, end=x+Math.max(x*.75,p.spacing);
      [min,max]=pair.x>0?[edge,end]:[-end,-edge];
    }
    const points=sample(430,u=>min+(max-min)*u);
    if(pair)points.push(-half,half,...zeros,...(pair.x===null?[]:[pair.x]));
    if(mode==="sphere")points.push(-p.radius,p.radius);
    if(mode==="cavity"){
      const {inner,outer,external}=P.cavityGeometry(p);
      points.push(-outer,-inner,inner,outer,p.offset,external);
    }
    const rows=points.filter(x=>x>=min&&x<=max).sort((a,b)=>a-b).map(x=>[x,P.electro(mode,p,[x,0,0])]);
    const fields=rows.map(([,m])=>m?.e?.[0]??0);
    const limit=zoomProfile?Math.max(1,3*Math.min(Math.max(...fields),-Math.min(...fields))):75000;
    const graph=chart(max,[
      {name:"沿軸電場 Eₓ",unit:"N/C",values:rows.map(([x,m])=>[x,m?.e?clamp(m.e[0],-limit,limit):null]),zeroes:pair&&pair.x!==null?[pair.x]:[],color:C.violet},
      {name:"沿軸電位 V",unit:"V",values:rows.map(([x,m])=>[x,m?clamp(m.v,-12000,12000):null]),zeroes:zeros,color:C.teal}
    ],p.y===0&&p.z===0?p.x:null,"x 軸（y = z = 0，cm）",min);
    return graph;
  }
  const electro={
    id:"potential-map",title:"靜電力、電力線與電位",sections:["1-1","1-2","1-3"],
    description:"同時量電位 V 與電場 E；沿切片讀等電位線，記錄起點 A，再用檢驗電荷比較電力作功。",
    camera:{yaw:22,pitch:52,zoom:1},
    modes:[
      {id:"charges",title:"點電荷電位地形",camera:{yaw:20,pitch:37,zoom:1},electroViews:["surface","contours","lines"],controls:chargeControls,
        task:"等量異號時，將 P 放到 x = 0 的平面。比較 V = 0 與 E 是否也為零，再把右側電荷改為同號。"},
      {id:"field-lines",title:"電力線與庫侖力",electroViews:["lines","surface"],controls:[pick("vectors","測點箭頭",[[0,"隱藏"],[1,"電場 E"],[2,"靜電力 F"]],0),...chargeControls.map(c=>c.key==="z"?{...c,value:0}:c)],
        task:"先將右側電荷設為 0，再加上同號或異號場源。只反轉檢驗電荷的符號，觀察電場與受力的差別。"},
      {id:"plates",title:"平行導體板",controls:[ctl("voltage","板間電位差",2,30,1,14,"V"),ctl("gap","板間距",6,28,1,18,"cm"),...xyz(0,5,4)],
        task:"先只改 y、z，再改 x。哪些移動讓電位改變？固定電位差再改板間距，觀察 V(x) 的斜率。"},
      {id:"sphere",title:"帶電金屬球",electroViews:["lines","surface","contours"],controls:[ctl("q","金屬球總電量 Q",-12,12,1,6,"nC"),ctl("radius","球半徑",4,15,.5,10,"cm"),...xyz(6,1,0)],
        task:"從球內移到球外，找出 V 不變、E = 0 的範圍。注意 V 在球面連續，E 則有內外之分。"},
      {id:"cavity",title:"接地空腔金屬球",electroViews:["lines","surface"],
        controls:[ctl("q","腔內點電荷",-12,12,1,4,"nC"),ctl("q2","外部點電荷",-12,12,2,8,"nC"),ctl("offset","腔內電荷 x",0,5,.5,3,"cm"),...xyz(0,0,0)],
        task:"移動腔內電荷，觀察電力線如何終止於腔壁。再改變外部電荷，比較腔內與金屬中的電場。"}
    ].map(m=>({...m,controls:[...m.controls,pick("test","檢驗電荷 q",[[1,"+1 nC"],[-1,"−1 nC"],[2,"+2 nC"],[-2,"−2 nC"]],1)]})),
    draw(mode,p,camera,state){
      const point=[p.x,p.y,p.z], at=P.electro(mode,p,point), atA=state.a?P.electro(mode,p,state.a):null;
      const pair=pairMode(mode)?P.electricPair(p):null;
      const view=camera.electroDisplay||(mode==="field-lines"||mode==="sphere"||mode==="cavity"?"lines":mode==="charges"?"surface":"contours");
      const extent=mode==="plates"?32:electricExtent(mode,camera,pair);
      const s=scene(camera,extent,view==="surface"?"電位地形":view==="lines"?"電力線與電場":"等電位切片");
      const axes=(planes[camera.plane]||planes.xy).axes;
      const fixed=[0,1,2].find(i=>!axes.includes(i));
      let slice="xyz"[fixed]+" = "+fmt(view==="lines"?0:point[fixed])+" cm";
      let terrain=null, flatValue;
      const spacing=mode==="plates"?p.voltage/5:mode==="sphere"?Math.max(100,Math.abs(9000*p.q/p.radius)/5):
        Math.max(100,Math.round(Math.max(Math.abs(p.q),Math.abs(p.q2))*1.7)*100);
      if(view==="lines"){
        drawElectricLines(s,mode,p,camera,extent);
      }else if(view==="surface"){
        terrain=potentialTerrain(s,mode,p,camera,extent);
        slice=terrain.slice;
      }else{
        const bounds=extent*.84, count=30, inc=2*bounds/count;
        const slicePoint=(a,b)=>planePoint(axes,a,b,point);
        if(mode==="sphere"){
          const sectionRadius=Math.sqrt(Math.max(0,p.radius**2-point[fixed]**2));
          if(sectionRadius){
            const edge=ring(sectionRadius).map(([a,b])=>slicePoint(a,b));
            s.polygon(edge,"#6fa2b2",.32);
            s.draw(edge,C.muted,1.2);
          }
        }
        const vGrid=sample(count,v=>sample(count,u=>P.electro(mode,p,slicePoint(-bounds+2*bounds*u,-bounds+2*bounds*v))?.v));
        const sliceValues=vGrid.flat().filter(Number.isFinite);
        if(sliceValues.length>0&&Math.max(...sliceValues)-Math.min(...sliceValues)<1e-8){
          flatValue=sliceValues[0];
          s.polygon([slicePoint(-bounds,-bounds),slicePoint(bounds,-bounds),slicePoint(bounds,bounds),slicePoint(-bounds,bounds)],C.violet,.12);
        }
        const levels=(mode==="plates"?[1,2,3,4]:[-4,-3,-2,-1,0,1,2,3,4]).map(i=>i*spacing);
        for(const level of levels)for(let j=0;j<count;j++)for(let i=0;i<count;i++){
          const a=-bounds+i*inc,b=-bounds+j*inc;
          const pts=[slicePoint(a,b),slicePoint(a+inc,b),slicePoint(a+inc,b+inc),slicePoint(a,b+inc)];
          const vals=[vGrid[j][i],vGrid[j][i+1],vGrid[j+1][i+1],vGrid[j+1][i]];
          if(vals.some(v=>v===undefined))continue;
          const cuts=[];
          for(let k=0;k<4;k++){const l=(k+1)%4, v=vals[k], u=vals[l];if((v>=level)!==(u>=level))cuts.push(sum(pts[k],mul(sub(pts[l],pts[k]),(level-v)/(u-v))));}
          const color=level===0?C.violet:level>0?C.amber:C.blue;
          if(cuts.length>=2)s.draw(cuts.slice(0,2),color,level===0?2.1:1.1);
          if(cuts.length===4)s.draw(cuts.slice(2),color,1.1);
        }
        if(pair&&camera.plane!=="yz"&&Math.abs(point[fixed])<1e-8){
          if(p.q)s.charge([-p.spacing/2,0,0],p.q>0);
          if(p.q2)s.charge([p.spacing/2,0,0],p.q2>0);
        }else if(mode==="plates"){
          for(const x of [-p.gap/2,p.gap/2].sort((a,b)=>s.depth([a,0,0])-s.depth([b,0,0]))){
            const face=x+Math.sign(x)*.725;
            const nodes=[[face,-26,-26],[face,26,-26],[face,26,26],[face,-26,26]];
            s.slab(nodes,[1.45,0,0],x<0?"copper":"steel",.62);
            if(camera.labels)s.dot([face,-25,24],x<0?C.amber:C.blue,x<0?"＋":"−",4);
          }
        }
      }
      const force=at?.e?mul(at.e,p.test):null;
      if(view!=="surface"){
        if(state.a)s.dot(state.a,C.violet,"A",4.5);
        s.probe(point);
        if(at?.e&&p.vectors!==0){
          const showForce=p.vectors===2;
          pointArrow(s,point,showForce?force:at.e,extent*.43,showForce?C.violet:C.blue,showForce?"F":"E",2.4,!!p.vectors);
        }
      }
      const nullAt=pair&&pair.x!==null?P.electro(mode,p,[pair.x,0,0]):null;
      let nullShown=false;
      if(nullAt&&(camera.plane!=="yz"||pair.x===0)&&(view!=="contours"||point[fixed]===0)){
        const mark=terrain?terrain.pointAt(pair.x,0):[pair.x,0,0];
        const [x,y]=s.project(mark);
        nullShown=x>=8&&x<=552&&y>=8&&y<=382&&(!terrain||Math.abs(pair.x)<=terrain.bound);
        if(nullShown)s.landmark(mark,"E = 0",C.violet,"electric-null");
      }
      const fieldDisplay=at?.e?mag(at.e,"N/C",2):at?"表面兩側值不同":"—";
      const rows=[item("potential","P 點電位 V",at?fmt(at.v,2)+" V":"—"),item("field","P 點電場 |E|",fieldDisplay),
        item("vector","P 點電場 E（x, y, z）",at?.e?vec(at.e,1)+" N/C":"—"),item("energy","P 點電位能 qV",at?fmt(p.test*at.v,2)+" nJ":"—"),
        item("slice","顯示切面",slice)];
      if(mode==="field-lines")rows.push(item("force","靜電力 F（x, y, z）",force?vec(force,1)+" nN":"—"));
      else rows.push(item("work","由 A 至 P，靜電力作功",at&&atA?fmt(p.test*(atA.v-at.v),2)+" nJ":state.a?"—":"請先記錄 A"));
      if(view==="contours")rows.push(item("levels","等電位線級距",fmt(spacing)+" V"));
      const facts=[];
      if(pair){
        const boundary=2*Math.abs(pair.net);
        const zeroLabel=pair.all?"各處皆為零":pair.x===null?"無有限零點":"x = "+fmt(pair.x,2)+" cm";
        if(view==="lines"&&camera.plane!=="yz")s.fieldKey(pair,zeroLabel);
        rows.push(item("q1-lines","Q₁ 出入的線",lineCount(pair.counts[0])),item("q2-lines","Q₂ 出入的線",lineCount(pair.counts[1])),
          item("joined","連接兩電荷",lineCount(pair.joined)),item("null","電場零點",zeroLabel));
        if(view==="lines")facts.push(["Q₁",fmt(p.q)+" nC · "+lineCount(pair.counts[0])],["Q₂",fmt(p.q2)+" nC · "+lineCount(pair.counts[1])],
          ["兩電荷相連",lineCount(pair.joined)],[pair.net<0?"從無窮遠進入":"通往無窮遠",lineCount(boundary)]);
        facts.push(["E = 0",zeroLabel+(nullAt?" · V = "+fmt(nullAt.v,2)+" V":"")]);
        if(pair.potentialZeroes.length)facts.push(["軸上 V = 0",pair.potentialZeroes.map(x=>fmt(x,2)).join("、")+" cm"]);
      }else if(mode==="sphere"&&view==="lines"){
        facts.push(["球面"+(p.q<0?"進線":"出線"),lineCount(2*Math.abs(p.q))],["金屬內","E = 0"]);
      }else if(mode==="cavity"&&view==="lines"){
        facts.push(["腔內電荷與內壁相連",lineCount(2*Math.abs(p.q))],["外部電荷與外壁相連",lineCount(Math.abs(p.q2))],
          [p.q2<0?"從無窮遠進入":"通往無窮遠",lineCount(Math.abs(p.q2))],["接地金屬","E = 0 · V = 0"]);
      }
      const model=mode==="plates"?"理想無限大平行板，負板為 0 V。":
        mode==="cavity"?"接地同心球殼的內半徑為 8 cm、外半徑為 13 cm，外部點電荷在 x = 26 cm。腔內、腔外分別用球面鏡像電荷計算。":
        "以無窮遠為 0 V。";
      let caption=view==="surface"?(camera.plane?"色階顯示電位 V。":"地形高度是電位 V。")+"紅正藍負，深色線標出零電位交界。切面 "+slice+"，顯示範圍 ±"+fmt(terrain.cap,0)+" V。":
        view==="lines"?(camera.plane==="yz"&&mode!=="sphere"?"YZ 顯示 x = 0 切片的局部電場。線數以含 x 軸的參考切面為準。":
          "參考切面每 1 nC 畫 2 條線。"+(camera.plane?"":camera.electroDepth==="front"?"目前顯示朝向觀察者的前側。":
            camera.electroDepth==="section"?"目前只顯示 XY 參考切面。":"深色為前側，淡線標出後側與輔助切面。")):
        "曲線連接等電位位置，切面 "+slice+"。"+(flatValue===undefined?"":"這一整片同為 "+fmt(flatValue)+" V。");
      if(nullAt&&!nullShown&&view!=="contours"){
        caption+=camera.plane==="yz"?" 切到 XY 或 XZ 可沿兩電荷連線找零點。":camera.electroRange!=="far"?" 零點在這個畫框外，切到遠場查看。":" 可由沿軸剖面查看零點。";
      }
      if(view==="lines"&&mode==="cavity")caption+=" 藍色環是接地金屬的剖面，中央是空腔。";
      if(view==="lines"&&mode==="sphere")caption+=" 藍色圓面是金屬球的剖面。";
      if(view==="lines"&&pair&&camera.electroLinkedOnly&&camera.plane!=="yz"){
        caption+=pair.joined?" 目前只顯示橘色相連線。":" 這組電荷的相連線數為 0。";
      }
      if(terrain?.uniform!==null&&terrain?.uniform!==undefined)caption+=" 整個切面的電位同為 "+fmt(terrain.uniform)+" V。";
      if(camera.electroRange==="far"&&pair&&!pair.all)caption+=pair.net?" 遠處的電場主要由總電量 "+fmt(pair.net)+" nC 決定。":" 遠處呈電偶極分布，電場隨距離衰減得更快。";
      const legend=view==="surface"?[[C.red,"正電位"],[C.blue,"負電位"],[C.ink,"V = 0"]]:
        view==="lines"?[...(pair&&camera.plane!=="yz"?[]:[[C.teal,"電力線"]]),
          ...(p.vectors===1?[[C.blue,"電場 E"]]:p.vectors===2?[[C.violet,"靜電力 F"]]:[])]:
          [[C.amber,"正電位線"],[C.blue,"負電位線"],[C.violet,"0 V 線"]];
      const vals=mode==="plates"?sample(160,u=>{const x=-28+56*u;return [x,P.electro(mode,p,[x,p.y,p.z]).v];}):null;
      const graph=vals?chart(28,[{name:"沿 x 的電位",unit:"V",values:vals,color:C.teal}],p.x,"x（cm）",-28):axisProfile(mode,p,camera,extent,pair);
      return {...sceneOut(s,rows,legend,(at?"":"P 太靠近理想點電荷。")+model+"沿軸剖面取 y = z = 0。空心點標出各曲線的零點。靠近點電荷的極大讀值截到圖框。",graph),
        facts,caption};
    }
  };
  const phase=ctl("phase","時間進度",0,100,1,30,"%");
  const B=ctl("b","磁場 B（沿 +z）",.1,1,.05,.35,"T");
  const force={
    id:"magnetic-force",title:"磁力、粒子軌跡與電動機",sections:["2-3","2-4"],
    description:"用三維叉積比對粒子與導線所受磁力，再觀察直流電動機的線圈力矩如何改變。",
    camera:{yaw:36,pitch:26,zoom:1},
    modes:[
      {id:"particle",title:"帶電質點：直線／圓／螺旋",controls:[B,ctl("v","入射速率",1,12,.5,6,"m/s"),ctl("theta","v 與 B 夾角",0,180,5,65,"°"),ctl("phi","入射方位角",0,360,5,0,"°"),pick("q","粒子電量",[[2,"+2 μC"],[-2,"−2 μC"]],2),phase],animate:true,
        task:"先試 0°、90°、斜入射。把電荷反號，檢查曲率與旋向；拖時間進度比較 F、v 與動能。"},
      {id:"wire",title:"載流導線：Iℓ × B",controls:[B,I,ctl("size","磁場中導線長度",4,30,1,18,"cm"),ctl("theta","導線與 B 夾角",0,180,5,65,"°"),ctl("phi","導線方位角",0,360,5,20,"°")],
        task:"先設平行與反平行，接著設垂直。反轉電流，檢查 I 與 F 的方向，並比對 F = |I|ℓB sin θ。"},
      {id:"parallel",title:"雙平行導線：互吸／互斥",controls:[ctl("i1","甲導線電流",-10,10,.5,6,"A"),ctl("i2","乙導線電流",-10,10,.5,4,"A"),ctl("spacing","兩線間距",3,25,1,10,"cm")],
        task:"只反轉乙的電流，再把間距加倍。先用甲線決定乙處的磁場，接著用乙線的電流判斷它的受力。"},
      {id:"motor",title:"線圈力矩／直流換向器",controls:[B,ctl("i","電流量值",1,8,.5,4,"A"),ctl("size","線圈長邊",8,28,1,18,"cm"),ctl("turns","線圈匝數",1,15,1,5,"匝"),ctl("theta","線圈轉角",0,360,1,55,"°"),pick("commutate","換向器",[[1,"開啟：每半圈反向"],[0,"關閉：固定電流"]],1)],animate:true,
        task:"切換換向器，沿一整圈看 τₓ 正負；分辨單邊磁力不為零與整個線圈力矩為零是不同的事。"}
    ],
    draw(mode,p,camera){
      const m=P.magnetic(mode,p);
      if(mode==="parallel"){
        const s=scene(camera,27,"兩平行載流導線的電流、磁場與作用力");
        const half=p.spacing/2;
        for(const [y,i,name] of [[-half,p.i1,"甲"],[half,p.i2,"乙"]]){
          s.tube([[-24,y,0],[24,y,0]],.85,name==="甲"?"copper":"brass");
          if(camera.labels)s.dot([-22,y,0],C.ink,name);
          if(i)pointArrow(s,[-12,y,0],[i,0,0],10,C.amber,"I");
        }
        if(p.i1)pointArrow(s,[5,half,0],[0,0,p.i1],10,C.blue,"B甲");
        if(m.f){
          pointArrow(s,[0,half,0],[0,-m.f,0],8,C.violet,"F乙");
          pointArrow(s,[0,-half,0],[0,m.f,0],8,C.violet,"F甲");
        }
        return sceneOut(s,[item("b","甲在乙處的磁場量值",fmt(m.B,3)+" μT"),item("force","每單位長度磁力",fmt(Math.abs(m.f)*1e6,2)+" μN/m"),
          item("relation","兩線作用",m.f>0?"同向・相吸":m.f<0?"反向・相斥":"無作用力")],
          [[C.amber,"電流 I"],[C.blue,"甲在乙處的磁場"],[C.violet,"各導線的磁力"]],
          "採長直導線近似；畫面僅顯示一段導線。兩條線的力等量反向，作用在不同導線上。");
      }
      if(mode==="particle"){
        const span=m.T*1.65, trace=sample(220,u=>mul(m.at(u*span).x,100));
        const center=mul(trace.at(-1),.5), translated=trace.map(a=>sub(a,center)), t=span*p.phase/100;
        const current=m.at(t), point=sub(mul(current.x,100),center);
        const scale=Math.max(20,...translated.map(a=>length(a)))*1.15, s=scene(camera,scale,"帶電質點的三維軌跡、速度和磁力");
        const past=sample(Math.max(2,Math.round(220*p.phase/100)),u=>sub(mul(m.at(u*t).x,100),center));
        s.trail(translated,"#7dabbf",.38,1.45);
        s.trail(past,"#83e8ef",.96,2.35);
        s.orb(point,scale*.028,p.q>0?"spark":"particle",true);
        pointArrow(s,point,current.v,scale*.36,C.amber,"v");pointArrow(s,point,current.f,scale*.31,C.violet,"F");
        pointArrow(s,zero,m.b,scale*.52,C.blue,"B");
        return sceneOut(s,[item("t","時間 t",fmt(t,4)+" s"),item("force","磁力量值 |F|",fmt(length(current.f)*1e6,3)+" μN"),
          item("speed","速率 |v|",mag(current.v,"m/s")),item("radius","軌道半徑",m.r<1e-9?"—（直線）":fmt(100*m.r,2)+" cm"),
          item("period","週期／螺距",m.r<1e-9?"—（直線）":fmt(m.T,4)+" s ／ "+fmt(100*m.pitch,1)+" cm"),
          item("energy","動能（固定）",fmt(m.energy*1e9,2)+" nJ")],[[C.teal,"軌跡"],[C.amber,"速度 v"],[C.violet,"磁力 F"],[C.blue,"磁場 B"]],
          "粒子質量固定 1.0 × 10⁻⁸ kg；畫面依軌跡自動調整比例，播放為慢速示意。理想均勻磁場，不計其他力。");
      }
      const s=scene(camera,25,"三維導線、磁場、電流與磁力方向");
      pointArrow(s,[-13,-12,0],m.b,18,C.blue,"B");
      if(mode==="wire"){
        const h=mul(m.dl,50), a=mul(h,-1);
        s.tube([a,h],1.05);
        if(p.i)s.arrow(mul(h,-Math.sign(p.i)*.68),mul(h,Math.sign(p.i)*.85),C.amber,3,"I");
        pointArrow(s,zero,m.f,13,C.violet,"F",3);
        return sceneOut(s,[item("force","磁力量值 |F|",mag(m.f,"N",3)),item("vector","磁力 F（x, y, z）",vec(m.f,3)+" N"),item("theta","實際電流與 B 夾角",p.i?fmt(p.i>0?p.theta:180-p.theta)+"°":"—")],
          [[C.amber,"電流 I"],[C.blue,"磁場 B"],[C.violet,"磁力 F"]],"均勻磁場；磁力垂直於電流與磁場。箭長只表示方向，實際量值見讀數。");
      }
      const vertices=m.vertices.map(a=>mul(a,100));
      s.tube([[-24,0,0],[24,0,0]],.85,"steel");
      const theta=rad(p.theta);
      for(const offset of [.12,Math.PI+.12]){
        const sleeve=sample(32,u=>{
          const a=theta+offset+u*(Math.PI-.24);
          return [15,1.9*Math.cos(a),1.9*Math.sin(a)];
        });
        s.slab([[15,0,0],...sleeve],[4.2,0,0],"brass");
      }
      s.slab([[13,-1.2,-4],[17,-1.2,-4],[17,-1.2,-1.6],[13,-1.2,-1.6]],[0,2.4,0],"steel");
      s.tube([...vertices,vertices[0]],.76);
      if(camera.analysis)s.polygon(vertices,C.teal,.14);
      vertices.forEach((a,i)=>{
        const b=vertices[(i+1)%4], middle=mul(sum(a,b),.5);
        pointArrow(s,middle,mul(sub(b,a),Math.sign(m.i)),4,C.amber);
        pointArrow(s,middle,m.forces[i],7,C.violet,i%2===0?"F":"");
      });
      pointArrow(s,zero,m.n,10,C.teal,"n");pointArrow(s,[0,0,-10],m.torque,13,C.red,"τ");
      const wave=sample(200,u=>[360*u,P.magnetic("motor",{...p,theta:360*u}).torque[0]]);
      const graph=chart(360,[{name:"沿轉軸力矩 τₓ",unit:"N·m",values:wave,color:C.red}],p.theta,"線圈轉角 θ（°）");
      return sceneOut(s,[item("torque","沿轉軸力矩 τₓ",fmt(m.torque[0],4)+" N·m"),item("i","線圈電流（含方向）",fmt(m.i)+" A"),
        item("area","單匝面積",fmt(m.area,4)+" m²"),item("side","長邊所受磁力量值",mag(m.forces[0],"N",3))],
        [[C.blue,"磁場 B"],[C.amber,"電流"],[C.violet,"各邊磁力"],[C.red,"轉軸力矩 τ"]],"轉角是手動指定或以固定速率播放的示意，並未求解馬達轉速；換向器採理想瞬時切換。",graph);
    }
  };
  const loopSize=ctl("size","線圈邊長／滑棒長度",6,18,1,12,"cm");
  const duration=ctl("duration","觀察總時間",.5,3,.1,1.4,"s");
  const turns=ctl("turns","線圈匝數 N",1,50,1,12,"匝");
  const field=ctl("b","磁場量值 B",.05,1,.05,.4,"T");
  const circuit=[pick("closed","迴路狀態",[[1,"閉合"],[0,"開路"]],1),ctl("resistance","電阻 R",1,20,.5,4,"Ω"),phase];
  function drawTransformer(p,camera){
    const m=P.transformer(p), u=p.phase/100, at=m.at(u), s=scene(camera,26,"鐵芯、原副線圈與磁通量方向");
    for(const z of [-13,13]){
      s.slab([[-16.5,-3.1,z-2.5],[16.5,-3.1,z-2.5],[16.5,-3.1,z+2.5],[-16.5,-3.1,z+2.5]],[0,6.2,0],"steel");
    }
    for(const [x,turns,color] of [[-14,p.primary,C.amber],[14,p.secondary,C.blue]]){
      const coils=Math.max(2,Math.round(turns/45));
      const wire=t=>[x+5.2*Math.cos(TAU*t*coils),5.2*Math.sin(TAU*t*coils),-10+20*t];
      const strands=sample(coils*24,wire);
      s.splitTube(strands,.49,x<0?"copper":"brass",v=>s.depth([v[0]-x,v[1],0])>=0,()=>{
        s.slab([[x-2.5,-3,-13],[x+2.5,-3,-13],[x+2.5,-3,13],[x-2.5,-3,13]],[0,6,0],"steel");
      });
      if(camera.labels)s.dot([x,0,17],color,x<0?"原線圈":"副線圈");
    }
    pointArrow(s,[-8,0,13],[at.flux,0,0],15,C.teal,"Φ",2.8);
    const series=sample(180,u=>[u,m.at(u)]);
    const graph=chart(1,[{name:"鐵芯單匝磁通量",unit:"mWb",values:series.map(([u,m])=>[u,m.flux*1000]),color:C.teal},
      {name:"副線圈瞬時電壓",unit:"V",values:series.map(([u,m])=>[u,m.secondary]),color:C.blue}],u,"週期進度（0 到 1）");
    return sceneOut(s,[item("voltage","副線圈電壓有效值",fmt(m.secondary,2)+" V"),item("current","負載電流有效值",fmt(m.current,3)+" A"),
      item("flux","鐵芯單匝磁通量 Φ",fmt(at.flux*1000,3)+" mWb"),item("power","負載功率",fmt(m.power,2)+" W")],
      [[C.amber,"原線圈"],[C.blue,"副線圈"],[C.teal,"鐵芯磁通方向"]],
      "理想變壓器模型。兩組線圈共享每匝磁通量，電壓有效值比等於匝數比。副線圈開路仍有電壓，負載電流為零。圖中繞線數縮減示意。",graph);
  }
  const induction={
    id:"induction",title:"電磁感應與變壓器",sections:["3-1","3-2","3-3","3-4"],
    description:"切換滑棒、進出磁場、磁棒、旋轉線圈、變動磁場與變壓器，比對 Φ、ε 與 I。",
    camera:{yaw:21,pitch:53,zoom:1},
    modes:[
      {id:"slide",title:"滑動導體棒",controls:[field,loopSize,ctl("speed","棒速 v",.02,.18,.01,.12,"m/s"),duration,...circuit],
        task:"比對閉合與開路時的 ε、I 與阻力。迴路閉合時，檢查外力維持等速所供的功率是否等於熱功率。"},
      {id:"enter",title:"線圈進出磁場",controls:[field,loopSize,duration,...circuit],
        task:"從 0% 拖到 100%，找出進入、全在場內、離開三段。哪個階段磁通量不為零，感應電動勢卻為零？"},
      {id:"magnet",title:"磁棒穿過線圈",controls:[ctl("b","磁棒磁化強度 μ₀M",.2,1.4,.05,.8,"T"),{...loopSize,label:"圓線圈直徑"},duration,turns,pick("pole","前端磁極",[[1,"N 極"],[-1,"S 極"]],1),...circuit],
        task:"在磁棒接近、通過線圈面、離開時暫停。比較磁通量峰值和 ε 的零點；把磁極反轉再做一次。"},
      {id:"rotate",title:"旋轉線圈／發電機",controls:[field,loopSize,duration,turns,ctl("cycles","觀察時間內旋轉圈數",1,4,1,1,"圈"),...circuit],
        task:"把線圈法線轉到與 B 平行、垂直，找出 Φ 與 ε 的峰值為何不同步。"},
      {id:"vary",title:"固定線圈／改變 B",controls:[{...field,label:"起始磁場"},ctl("end","末端磁場（負值表示反向）",-1,1,.05,.85,"T"),loopSize,duration,turns,...circuit],
        task:"線圈不動、面積不變，讓 B 增加、減少或反向。比較前後兩段 B 固定時的讀值。"},
      {id:"transformer",title:"變壓器",controls:[ctl("voltage","原線圈電壓有效值",10,120,5,60,"V"),ctl("primary","原線圈匝數",50,300,10,150,"匝"),
        ctl("secondary","副線圈匝數",50,300,10,300,"匝"),ctl("frequency","交流頻率",20,100,5,60,"Hz"),
        ctl("load","負載電阻",20,500,10,100,"Ω"),pick("closed","副線圈",[[1,"接上負載"],[0,"開路"]],1),phase],
        task:"比較匝數比與電壓比。把副線圈打開，觀察磁通量、輸出電壓和負載電流各自如何變。"}
    ].map(m=>({...m,animate:true})),
    draw(mode,p,camera){
      if(mode==="transformer")return drawTransformer(p,camera);
      const magnet=mode==="magnet"?P.magnetFlux(p):null;
      const t=p.duration*p.phase/100,m=P.induction(mode,p,t,magnet);
      const half=p.size/2, extent=mode==="slide"?Math.max(17,(p.speed*p.duration+.035)*100*.65+5):
        mode==="magnet"?Math.max(15,Math.abs(m.x)*100+6):mode==="enter"?27:Math.max(14,half*1.75);
      const s=scene(camera,extent,"感應裝置、外加磁場與迴路的三維圖");
      let corners;
      const rect=(x,y,a,b)=>[[x,y,0],[a,y,0],[a,b,0],[x,b,0]];
      if(mode==="enter"){
        const left=m.x*100-half,right=m.x*100+half;
        s.slab(rect(-13,-22,13,22).map(v=>sum(v,[0,0,-.8])),[0,0,.6],"glass",.5);
        if(m.overlap>0)s.polygon(rect(Math.max(left,-13),-half,Math.min(right,13),half),C.teal,.35);
        corners=rect(left,-half,right,half);
        pointArrow(s,[m.x*100,-half-4,0],[1,0,0],8,C.amber,"v");
        for(const x of [-10,0,10])pointArrow(s,[x,14,0],[0,0,1],8,C.blue,x===0?"B":"");
      }else if(mode==="slide"){
        const span=(.035+p.speed*p.duration)*100, left=-span/2, right=left+100*m.x, railEnd=span/2+3;
        s.tube([[left,-half,0],[railEnd,-half,0]],.55,"steel");s.tube([[left,half,0],[railEnd,half,0]],.55,"steel");
        corners=rect(left,-half,right,half);
        if(camera.analysis)s.polygon(corners,C.teal,.26);
        pointArrow(s,[right,0,0],[1,0,0],7,C.amber,"v");
        if(m.force)pointArrow(s,[right,-half,0],[-1,0,0],7,C.violet,"F");
        pointArrow(s,[left,half+4,0],[0,0,1],9,C.blue,"B");
      }else if(mode==="magnet"){
        const z=m.x*100, radius=100*magnet.radius, halfLength=100*magnet.halfLength, b=[0,0,z+halfLength];
        const windings=Math.min(5,Math.max(2,Math.round(p.turns/8)));
        const coil=sample(windings*56,u=>{
          const theta=(p.closed?0:.28)+(TAU*windings-(p.closed?0:.56))*u;
          return [half*Math.cos(theta),half*Math.sin(theta),1.8*(u-.5)];
        });
        s.splitTube(coil,.38,"copper",point=>s.depth([point[0],point[1],0])>=0,()=>{
          const poleFaces=[[-halfLength/2,p.pole>0?"blue":"red"],[halfLength/2,p.pole>0?"red":"blue"]];
          for(const [offset,material] of poleFaces.sort(([a],[b])=>s.depth([0,0,a])-s.depth([0,0,b]))){
            s.slab(ring(radius,z+offset,32).slice(0,-1),[0,0,halfLength],material);
          }
        });
        if(camera.labels)s.dot(b,p.pole>0?C.red:C.blue,p.pole>0?"N":"S",3.6);
        pointArrow(s,[4,0,z],[0,0,1],9,C.amber,"v");
        if(m.i) {
          const theta=Math.PI*.25, mid=[half*Math.cos(theta),half*Math.sin(theta),0];
          pointArrow(s,mid,mul([-Math.sin(theta),Math.cos(theta),0],Math.sign(m.i)),5,C.violet,"I");
        }
      }else{
        corners=rect(-half,-half,half,half).map(([x,y])=>[x,y*Math.cos(m.angle),y*Math.sin(m.angle)]);
        if(mode==="rotate")s.tube([[-17,0,0],[17,0,0]],.71,"steel");
        if(mode==="vary"&&Math.abs(m.b)>1e-6){
          s.polygon(rect(-half-2,-half-2,half+2,half+2),m.b>0?C.blue:C.violet,.32*Math.abs(m.b));
        }
        if(camera.analysis)s.polygon(corners,C.teal,.15);
        pointArrow(s,zero,[0,-Math.sin(m.angle),Math.cos(m.angle)],10,C.teal,"n");
        if(m.b)pointArrow(s,[-12,12,0],[0,0,m.b],10,C.blue,"B");
      }
      if(corners){
        s.tube([...corners,...(p.closed?[corners[0]]:[])],.65);
        if(!p.closed){
          const mid=mul(sum(corners[0],corners[3]),.5), d=mul(sub(corners[0],corners[3]),.11);
          s.tube([corners[3],sub(mid,d)],.65);s.tube([sum(mid,d),corners[0]],.65);
          if(camera.labels)s.dot(mid,C.red,"開路",4);
        }
        if(m.i) {
          const mid=mul(sum(corners[0],corners[1]),.5);
          pointArrow(s,mid,mul(sub(corners[1],corners[0]),Math.sign(m.i)),5,C.violet,"I",2.5);
        }
      }
      const values=sample(240,u=>[u*p.duration,P.induction(mode,p,u*p.duration,magnet)]);
      const graph=chart(p.duration,[{name:"單匝磁通量 Φ",unit:"Wb",values:values.map(([x,v])=>[x,v.flux]),color:C.teal},
        {name:"感應電動勢 ε",unit:"V",values:values.map(([x,v])=>[x,v.emf]),color:C.amber},
        {name:"感應電流 I",unit:"A",values:values.map(([x,v])=>[x,v.i]),color:C.violet}],t);
      const rows=[item("time","時間 t",fmt(t,3)+" s"),item("flux","單匝磁通量 Φ",fmt(m.flux,5)+" Wb"),
        item("emf","感應電動勢 ε",fmt(m.emf,4)+" V"),item("current","感應電流 I",fmt(m.i,4)+" A"),
        item("power","電阻熱功率 I²R",fmt(m.heat*1e6,2)+" μW")];
      if(mode==="slide")rows.push(item("force","磁力（沿運動軸）",fmt(m.force*1e3,3)+" mN"),item("work","維持等速的外力功率",fmt(-m.force*m.v*1e6,2)+" μW"));
      if(mode==="enter")rows.push(item("area","在線圈場區重疊面積",fmt(m.overlap*p.size*100,1)+" cm²"));
      if(mode==="magnet")rows.push(item("center","磁棒居中時的穿面平均磁場",fmt(magnet.centerField*1000,2)+" mT"));
      return sceneOut(s,rows,[[C.blue,"磁場 B／場區"],[C.teal,"迴路／重疊面積"],[C.amber,"運動方向"],[C.violet,"感應電流／磁力"]],
        "正磁通量以所選面法線為準；正電流由右手定則配對。開路時保留感應電動勢，I = 0。"+
        (mode==="magnet"?"磁棒由外力等速推動。以圖中的均勻磁化圓柱計算單匝磁通量，改變線圈直徑時，磁棒尺寸及磁化強度固定。各匝以同一平面近似，忽略線圈自感。":mode==="enter"?"場區邊界採理想突變，臨界點讀值取右側極限。":""),graph);
    }
  };
  const protonEnergy=ctl("initial","質子初始動能",20,400,20,80,"eV");
  const gapVoltage=ctl("voltage","每次跨間隙的加速電壓",50,1200,50,400,"V");
  const particleApps={
    id:"particle-apps",title:"粒子加速器與極光",sections:["2-4"],camera:{yaw:18,pitch:38,zoom:1},
    description:"比較電場如何改變質子動能、磁場如何彎折軌跡，以及粒子沿地磁場進入高層大氣的條件。",
    modes:[
      {id:"linear",title:"多級直線加速器",controls:[protonEnergy,gapVoltage,phase],animate:true,
        task:"拖動進度穿過四個加速間隙，對照動能圖。找出質子在間隙與金屬漂移管內的差異。"},
      {id:"cyclotron",title:"迴旋加速器",controls:[protonEnergy,gapVoltage,ctl("b","磁場 B（沿 +z）",.3,1.2,.05,.65,"T"),ctl("crossings","穿越間隙次數",3,12,1,8,"次"),phase],animate:true,
        task:"在 XY 平面看 D 形電極內的半圓，再轉到 3D 確認 B 垂直軌道。提高電壓時比較半徑與迴旋週期。"},
      {id:"aurora",title:"極光與磁鏡",camera:{yaw:18,pitch:25,zoom:1},controls:[ctl("shell","磁力線赤道半徑 L",1.5,7,.1,5.8,"Rₑ"),ctl("pitch","赤道速度與磁場夾角（銳角）",0,85,1,2,"°"),
        ctl("longitude","磁經度",0,360,5,0,"°"),pick("hemisphere","粒子先朝向",[[1,"北半球"],[-1,"南半球"]],1),
        pick("emission","觀察對象",[[0,"單顆電子導引中心"],[1,"沿多條磁力線沉降的電子群"]],0),
        ctl("phase","沿路徑播放進度",0,100,1,85,"%")],animate:true,
        task:"比較小、大入射夾角。先追蹤單顆電子，再切到電子群，比較導引中心能否到達 110 km 參考面。"}
    ],
    draw(mode,p,camera){
      if(mode==="linear"){
        const m=P.linearAcceleration(p), current=m.at(p.phase/100);
        const X=x=>100*(x-m.length/2), position=X(current.position);
        const s=scene(camera,Math.max(7,m.length*42),"質子沿直線穿越四個加速間隙");
        const crossSection=ring(.95,0,34);
        for(const tube of m.tubes){
          const a=X(tube.start), b=X(tube.end);
          const wall=crossSection.slice(0,-1).map(([u,v])=>[(a+b)/2,u,v]);
          s.slab(wall,[b-a,0,0],"glass",.32);
          for(const x of [a,b])s.tube(crossSection.map(([u,v])=>[x,u,v]),.07,"steel");
        }
        s.trail([[X(0),0,0],[position,0,0]],"#93e8ff",.69,1.55);
        s.orb([position,0,0],m.length*.7,"particle",true);
        if(current.active)pointArrow(s,[position,-1.4,0],[1,0,0],2.8,C.amber,"E");
        const times=[...sample(220,u=>u),...m.gaps.flatMap(g=>[g.startTime/m.duration,g.endTime/m.duration])].sort((a,b)=>a-b);
        const values=times.map(u=>{const at=m.at(u);return [at.time*1e6,at.energy];});
        const graph=chart(m.duration*1e6,[{name:"質子動能 K",unit:"eV",values,color:C.teal,absolute:true}],current.time*1e6,"時間 t（μs）");
        return sceneOut(s,[item("position","距入口位置",fmt(current.position*100,2)+" cm"),item("energy","質子動能 K",fmt(current.energy,1)+" eV"),
          item("speed","質子速率",fmt(current.speed/1000,2)+" km/s"),item("frequency","射頻頻率",fmt(m.frequency/1e6)+" MHz"),
          item("region","所在區域",current.active?"加速間隙，電場作正功":"漂移管內，動能固定")],
          [[C.blue,"漂移管剖視"],[C.amber,"間隙電場"],[C.teal,"質子路徑"]],
          "以半透明剖視顯示金屬漂移管。採窄間隙近似，質子通過時以有效加速電壓計算。相鄰間隙中心相隔半個射頻週期。調整初始動能或電壓時，會重新計算同步漂移管長度。",graph);
      }
      if(mode==="cyclotron"){
        const m=P.cyclotron(p), turn=p.phase/100*p.crossings;
        const k=Math.min(p.crossings-1,Math.floor(turn)), arc=m.arcs[k], point=arc.point(turn-k);
        const tracks=m.arcs.map(a=>sample(48,a.point));
        const outer=Math.max(...tracks.flat().map(length))*1.13;
        const s=scene(camera,Math.max(outer*1.15,1),"D 形電極、磁場與質子的分段半圓");
        for(const sign of [-1,1].sort((a,b)=>s.depth([a,0,0])-s.depth([b,0,0]))){
          const border=sample(64,u=>[sign*outer*(.025+Math.sin(Math.PI*u)),outer*Math.cos(Math.PI*u),-outer*.15]);
          const material=sign>0?"copper":"brass";
          s.slab(border,[0,0,outer*.15],material);
          s.tube([...border,border[0]].map(v=>sum(v,[0,0,outer*.075])),outer*.012,material);
          if(camera.labels)s.dot([sign*.8*outer,0,0],C.blue,sign>0?"D₁":"D₂",3.8);
        }
        tracks.forEach((points,i)=>s.trail(points,i<k?"#b5f4f7":"#eee2d0",i<k?.73:.33,i<k?1.8:1.05));
        s.trail(sample(54,u=>arc.point(u*(turn-k))),"#c0faff",1,2.5);
        s.orb(point,outer*.036,"spark",true);
        const gapVoltage=p.voltage*Math.cos(Math.PI*turn);
        if(Math.abs(gapVoltage)>1){
          pointArrow(s,[0,outer*.85,0],[gapVoltage,0,0],outer*.14,C.amber,"E");
        }
        pointArrow(s,[-outer*.76,-outer*.65,0],[0,0,1],outer*.48,C.blue,"B");
        const steps=m.arcs.flatMap((a,i)=>[[i,a.energy],[i+1,a.energy]]);
        const graph=chart(p.crossings,[{name:"質子動能 K",unit:"eV",values:steps,color:C.teal,absolute:true}],turn,"經過的半圈數");
        return sceneOut(s,[item("crossing","已進入第幾段半圓",String(k+1)),item("energy","質子動能 K",fmt(arc.energy,1)+" eV"),
          item("radius","此段軌道半徑",fmt(arc.radius,2)+" cm"),item("period","完整一圈週期",fmt(m.period*1e9,2)+" ns"),
          item("voltage","左 D 極相對右 D 極電壓",fmt(gapVoltage,1)+" V")],
          [[C.blue,"D 形電極／磁場"],[C.amber,"加速間隙"],[C.violet,"目前半圓／質子"]],
          "剖視圖移去兩個 D 形電極的上蓋。相鄰半圓之間，間隙電場反向，質子每次跨過都增加 eΔV。電極內以均勻磁場算半圓，忽略間隙通過時間及相對論效應。",graph);
      }
      const m=P.aurora(p), u=p.phase/100, returning=!m.reachesAtmosphere&&u>.5;
      const latitude=m.latitudeAt(u);
      const extent=camera.analysis?p.shell*1.05:clamp(p.shell*.76,1.46,2.02);
      const s=scene(camera,extent,"地球與電子的導引中心",false);
      const longitude=rad(p.longitude);
      const earthPoint=(lambda,L,phi)=>m.magneticToEarth(m.point(lambda,L,phi));
      if(camera.analysis)for(const phi of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
        for(const L of [1.5,2.2,3,4.5,6].filter(x=>x<=p.shell+.65)){
          const limit=Math.acos(Math.sqrt(m.atmosphere/L));
          s.draw(sample(80,u=>earthPoint((2*u-1)*limit,L,phi)),C.grid,1.2);
        }
      }
      s.earth();
      const visibleRuns=(nodes,draw)=>{
        let run=[];
        for(const v of nodes){
          if(s.frontOfEarth(v))run.push(v);
          else if(run.length){draw(run);run=[];}
        }
        if(run.length)draw(run);
      };
      visibleRuns(sample(125,u=>earthPoint((2*u-1)*m.limit)),nodes=>s.draw(nodes,C.blue,1.25,"5 4"));
      if(camera.analysis){
        for(const sign of [-1,1]){
          const pole=m.magneticToEarth([0,0,sign]);
          if(s.frontOfEarth(pole))s.dot(pole,C.blue,sign>0?"北磁極區":"南磁極區",3);
        }
      }
      const electron=earthPoint(latitude);
      const endpoint=earthPoint(p.hemisphere*m.end);
      if(p.emission){
        const landed=m.reachesAtmosphere&&u===1;
        if(!landed)for(const offset of [-1.35,-.9,-.45,0,.45,.9,1.35]){
          const point=earthPoint(latitude,p.shell,longitude+offset);
          if(s.frontOfEarth(point))s.dot(point,C.teal,"",2.6);
        }
        if(landed)s.curtain(latitude,longitude,m.atmosphere,m.magneticToEarth);
      }else if(s.frontOfEarth(electron))s.orb(electron,.023,"particle");
      if(camera.analysis&&s.frontOfEarth(endpoint))s.dot(endpoint,m.reachesAtmosphere?C.teal:C.red,m.reachesAtmosphere?"110 km 參考面":"磁鏡點",3.3);
      const localPitch=Math.asin(Math.min(1,Math.sin(rad(p.pitch))*Math.sqrt(m.ratio(latitude))));
      const altitude=(length(m.point(latitude))-1)*m.earthKm;
      const minimum=(length(endpoint)-1)*m.earthKm;
      return sceneOut(s,[item("fate","導引中心的結果",m.reachesAtmosphere?"可達 110 km 參考面":returning?"已在磁鏡點折返":"會在磁鏡點折返"),
        item("altitude","目前高度",fmt(altitude,0)+" km"),item("minimum","沿途最低高度",fmt(minimum,0)+" km"),
        item("cone","赤道損失錐半角",fmt(m.lossCone*180/Math.PI,1)+"°"),
        item("pitch","當地速度與磁場夾角（銳角）",fmt(localPitch*180/Math.PI,1)+"°")],
        [[C.blue,"選取的磁力線"],[C.teal,"電子群的導引中心"]],
        "在傾斜偶極場中，依磁矩守恆估計折返高度。圖中的點表示導引中心，省略快速迴旋及電場作用。110 km 是比較折返高度的參考面。電子群的光幕是大氣受激發的示意，實際極光位置與亮度隨磁層和大氣狀態而變。");
    }
  };
  const wave={
    id:"em-wave",title:"真空中的電磁波",sections:["3-5"],camera:{yaw:23,pitch:25,zoom:1},
    description:"分別在兩個側視圖看電場和磁場，再轉到 3D 比較傳播方向。",
    modes:[{id:"plane-wave",title:"平面電磁波",controls:[ctl("frequency","頻率",100,1000,25,300,"MHz"),ctl("amplitude","電場峰值",20,200,5,100,"V/m"),
      ctl("angle","電場偏振角（從 +y 轉向 +z）",0,180,5,0,"°"),ctl("x","觀察點 P", -100,100,5,0,"cm"),phase],animate:true,
      task:"將偏振角設為 0°，切換 XY 和 XZ，觀察哪一個場在平面內振動。提高頻率比較波長，並讀取波速。"}],
    draw(mode,p,camera){
      const m=P.emWave(p), s=scene(camera,123,"沿 +x 傳播的電場與磁場"), point=[p.x,0,0], height=.33*p.amplitude;
      if(camera.plane!=="yz"){
        for(const [v,color] of [[m.electric,C.teal],[m.magnetic,C.blue]]){
          s.trail(sample(240,u=>{const x=220*u-110;return sum([x,0,0],mul(v,height*m.at(x)));}),color===C.teal?"#75e3ca":"#99baff",.93,2.15);
        }
      }
      s.orb(point,3.4,"steel");
      const phaseAtP=m.at(p.x);
      if(Math.abs(phaseAtP)>1e-7){
        s.arrow(point,sum(point,mul(m.electric,height*phaseAtP)),C.teal,2.6,"E",camera.plane==="yz");
        s.arrow(point,sum(point,mul(m.magnetic,height*phaseAtP)),C.blue,2.6,"B",camera.plane==="yz");
      }
      pointArrow(s,[-98,-25,-20],[1,0,0],31,C.amber,"傳播",2.3);
      return sceneOut(s,[item("lambda","真空波長 λ",fmt(m.wavelength,2)+" cm"),item("speed","傳播速率","2.998 × 10⁸ m/s"),
        item("e","P 處電場量值",fmt(Math.abs(phaseAtP)*p.amplitude,2)+" V/m"),
        item("b","P 處磁場量值",fmt(Math.abs(phaseAtP)*p.amplitude/m.c*1e9,2)+" nT")],
        [[C.teal,"電場 E"],[C.blue,"磁場 B"],[C.amber,"傳播方向"]],
        (camera.plane==="yz"?"YZ 沿傳播軸觀察，顯示 P 處的瞬時場。":"曲線表示同一時刻沿傳播軸各處的場。")+
        "兩種場的單位不同，圖中以各自的刻度畫成相同峰高，並隨電場峰值設定一起改變。實際量值見讀值。");
    }
  };
  EM.workbenches=[biot,electro,force,induction,particleApps,wave];
})();
