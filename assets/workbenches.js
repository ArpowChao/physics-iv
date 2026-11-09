(() => {
  const P=EMPhysics, {sum,sub,mul,dot,cross,length,unit,clamp,rad,TAU,sample,ring,zero}=P;
  const C={ink:"#17343e",muted:"#526d76",grid:"#d3e3e5",teal:"#136d60",blue:"#245aa4",amber:"#975215",violet:"#783ea0",red:"#aa3545",white:"#f4fafb"};
  const fmt=(x,d=2)=>Number.isFinite(x)?(Math.abs(x)<.5*10**-d?0:x).toLocaleString("en-US",{maximumFractionDigits:d}):"—";
  const vec=(x,d=2)=>"("+x.map(v=>fmt(v,d)).join(", ")+")";
  const mag=(x,u,d=2)=>fmt(length(x),d)+" "+u;
  const ctl=(key,label,min,max,step,value,unit="")=>({key,label,min,max,step,value,unit});
  const pick=(key,label,choices,value)=>({key,label,choices,value});
  const item=(key,label,value)=>[key,label,value];
  const txt=(s)=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const path=(points,color,w=1.8,dash="")=>points.length?`<polyline fill="none" points="${points.map(v=>v.map(n=>n.toFixed(2)).join(",")).join(" ")}" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${dash?`stroke-dasharray="${dash}"`:""}/>`:"";
  const arrow2=(a,b,c,w=2)=>{
    const d=sub(b,a), n=length(d);
    if(n<2)return "";
    const [x,y]=unit(d), tip=clamp(n*.42,3,9), h=sub(b,mul([x,y],tip));
    return path([a,b],c,w)+`<polygon fill="${c}" points="${[b,sum(h,mul([-y,x],tip*.5)),sub(h,mul([-y,x],tip*.5))].map(v=>v.join(",")).join(" ")}"/>`;
  };
  function scene(camera,extent=30,label="可旋轉的三維模型"){
    const W=560,H=390,yaw=rad(camera.yaw),pitch=rad(camera.pitch), scale=H*.39/extent*camera.zoom;
    const proj=([x,y,z])=>[W/2+scale*(Math.cos(yaw)*x-Math.sin(yaw)*y),
      H/2-scale*(Math.cos(pitch)*z+Math.sin(pitch)*(Math.sin(yaw)*x+Math.cos(yaw)*y))];
    const toward=[-Math.sin(yaw)*Math.cos(pitch),-Math.cos(yaw)*Math.cos(pitch),Math.sin(pitch)];
    let out="", tags=[];
    const draw=(nodes,c,w,d)=>{out+=path(nodes.map(proj),c,w,d);};
    const polygon=(nodes,fill,opacity=.17)=>{out+=`<polygon points="${nodes.map(x=>proj(x).join(",")).join(" ")}" fill="${fill}" opacity="${opacity}"/>`;};
    const arrow=(a,b,c,w=2.3,tag)=>{
      const start=proj(a),end=proj(b);
      if(length(sub(end,start))<2){
        if(w<1.8||length(sub(b,a))<1e-8)return;
        const [x,y]=start;
        out+=`<circle cx="${x}" cy="${y}" r="6" fill="${C.white}" stroke="${c}" stroke-width="1.8"/>`;
        out+=dotProductGlyph(x,y,c,dot(sub(b,a),toward)>0);
      }else out+=arrow2(start,end,c,w);
      if(tag)tags.push([end,tag,c]);
    };
    function dotProductGlyph(x,y,c,front){
      return front?`<circle cx="${x}" cy="${y}" r="2" fill="${c}"/>`:
        path([[x-2.7,y-2.7],[x+2.7,y+2.7]],c,1.4)+path([[x+2.7,y-2.7],[x-2.7,y+2.7]],c,1.4);
    }
    const dot=(v,c,tag,r=4)=>{const [x,y]=proj(v);out+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${C.white}" stroke-width="1.3"/>`;if(tag)tags.push([[x,y],tag,c]);};
    const g=extent*.85;
    for(let i=-4;i<=4;i++){const a=g*i/4;draw([[-g,a,0],[g,a,0]],C.grid,1);draw([[a,-g,0],[a,g,0]],C.grid,1);}
    arrow(zero,[g,0,0],C.muted,1.1,"x"); arrow(zero,[0,g,0],C.muted,1.1,"y"); arrow(zero,[0,0,g],C.muted,1.1,"z");
    return {draw,polygon,arrow,dot,finish(){
      // Keep vector tags readable and inside the viewport; place overlapping labels on nearby rows.
      const used=[];
      const labels=tags.map(([[x,y],text,color])=>{
        if(x<0||y<0||x>W||y>H)return "";
        const w=Math.max(17,10+Array.from(text).length*10), px=clamp(x+6,2,W-w-2);
        let py=clamp(y-12,12,H-10);
        for(let i=0;i<6&&used.some(([a,b,c])=>px<c+2&&px+w>a-2&&Math.abs(py-b)<16);i++)py=clamp(py+(py>H-26?-19:18),12,H-10);
        used.push([px,py,px+w]);
        return `<rect x="${px}" y="${py-12}" width="${w}" height="18" rx="4" fill="${C.white}" opacity=".94"/><text x="${px+5}" y="${py+1}" font-size="16" fill="${color}">${txt(text)}</text>`;
      }).join("");
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${txt(label)}">${out}${labels}</svg>`;
    }};
  }
  function chart(xmax,series,at,xlabel="時間 t（s）",xmin=0){
    const W=560,H=series.length*112+33,L=89,R=535, span=xmax-xmin, X=x=>L+(R-L)*(x-xmin)/span;
    let out="";
    series.forEach(({values,name,unit,color,absolute=false},i)=>{
      const amplitude=Math.max(0,...values.filter(([,v])=>Number.isFinite(v)).map(([,v])=>Math.abs(v))), high=amplitude||1, y=26+112*i;
      const min=absolute?0:-high, max=high;
      const Y=n=>y+74-(n-min)/(max-min)*74;
      for(const f of [0,.25,.5,.75,1])out+=path([[X(xmin+span*f),y],[X(xmin+span*f),y+74]],C.grid,1);
      out+=path([[L,Y(0)],[R,Y(0)]],C.muted,1)+path([[L,y],[R,y]],C.grid,1);
      out+=`<text x="12" y="${y-9}" fill="${color}" font-size="16" font-weight="700">${txt(name)}（${txt(unit)}）</text>`;
      if(amplitude)out+=`<text x="82" y="${y+10}" text-anchor="end" fill="${C.muted}" font-size="15">${fmt(high,5)}</text>${min<0?`<text x="82" y="${y+78}" text-anchor="end" fill="${C.muted}" font-size="15">${fmt(-high,5)}</text>`:""}`;
      out+=`<text x="82" y="${Y(0)+5}" text-anchor="end" fill="${C.muted}" font-size="15">0</text>`;
      let run=[];
      for(const [t,n] of values) {
        if(Number.isFinite(n))run.push([X(t),Y(n)]);
        else{out+=path(run,color,2.6);run=[];}
      }
      out+=path(run,color,2.6);
      if(Number.isFinite(at))out+=path([[X(at),y],[X(at),y+74]],C.ink,1.1,"4 4");
    });
    for(const f of [0,.25,.5,.75,1])out+=`<text x="${X(xmin+span*f)}" y="${H-22}" text-anchor="middle" fill="${C.muted}" font-size="13">${fmt(xmin+span*f,2)}</text>`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" data-start="${L/W}" data-end="${R/W}" role="img" aria-label="${txt(series.map(s=>s.name).join("、")+"對"+xlabel+"的圖；虛線是目前位置")}">${out}<text x="${R}" y="${H-3}" text-anchor="end" fill="${C.muted}" font-size="15">${txt(xlabel)}</text></svg>`;
  }
  const xyz=(x,y,z)=>[ctl("x","P：x", -28,28,.5,x,"cm"),ctl("y","P：y",-28,28,.5,y,"cm"),ctl("z","P：z",-28,28,.5,z,"cm")];
  const I=ctl("i","電流 I",-8,8,.5,4,"A");
  const probe=ctl("probe","選取電流元位置",0,100,1,52,"%");
  const radius=ctl("radius","線圈半徑 R",4,15,.5,9,"cm");
  const pointArrow=(s,a,v,size,c,tag,w=2.4)=>{if(length(v)>1e-9)s.arrow(a,sum(a,mul(unit(v),size)),c,w,tag);};
  const sceneOut=(s,rows,legend,note,graph="")=>({diagram:s.finish(),rows,legend,note,graph});
  const biotModes=[
    {id:"element",title:"單一電流元",controls:[I,ctl("dl","電流元長 Δℓ",.5,5,.5,2,"cm"),ctl("theta","Δℓ 與 +z 夾角",0,180,5,90,"°"),ctl("phi","Δℓ 方位角",0,360,5,0,"°"),...xyz(5,12,8)],
      task:"將 Δℓ 設為 +x，先令 P 在 x 軸上，再移到 y 軸和 z 軸，觀察三維叉積。固定角度，把 r 加倍，比較 ΔB。"},
    {id:"straight",title:"有限／近似長直導線",controls:[I,ctl("half","導線半長",5,35,1,24,"cm"),probe,...xyz(0,8,6)],
      task:"在導線中垂面固定 P，增加線段長度，看看合磁場如何接近長直導線的 μ₀I/(2πr)。"},
    {id:"pair",title:"雙平行導線",controls:[I,ctl("spacing","導線間距",4,22,1,14,"cm"),pick("relative","兩線電流方向",[[1,"同向"],[-1,"反向"]],-1),probe,...xyz(0,0,0)],
      task:"在兩線的正中間切換同向與反向。哪些分量相消？再讓 P 離開兩線所在平面。"},
    {id:"loop",title:"圓線圈",controls:[I,radius,probe,...xyz(0,0,10)],
      task:"讓 P 先在圓線圈中心，再沿 z 軸移動；觀察單段磁場的分量如何疊加成軸向磁場。"},
    {id:"solenoid",title:"有限長螺線管",controls:[I,radius,ctl("coil","繞組長度",8,42,1,26,"cm"),ctl("turns","線圈匝數",3,30,1,16,"匝"),probe,...xyz(0,0,0)],
      task:"在管中心、端口和管外量測。用長螺線管近似比較，找出它在哪些位置會偏離有限線圈的結果。"}
  ];
  const biot={
    id:"biot",title:"必歐－沙伐定律：三維磁場工作臺",sections:["2-1","2-2"],modes:biotModes,
    description:"轉動空間視角，移動觀測點 P，逐段追蹤電流元、位置向量、分磁場與合磁場。",
    camera:{yaw:34,pitch:29,zoom:1},
    draw(mode,p,camera){
      const m=P.biot(mode,p), e=m.selected, s=scene(camera,mode==="straight"?Math.max(31,p.half):32,"三維電流分布與觀測點 P 的磁場向量");
      s.polygon([e.m,sum(e.m,e.dl),sum(m.point,e.dl),m.point],C.blue,.08);
      m.paths.forEach(({nodes,sign})=>{
        s.draw(nodes,C.muted,2.2);
        const k=Math.floor(nodes.length*.3), a=nodes[k], b=nodes[Math.min(k+3,nodes.length-1)];
        const dir=mul(unit(sub(b,a)),Math.sign(p.i)*sign);
        if(p.i)pointArrow(s,a,dir,3.9,C.amber,"I",2.5);
      });
      s.dot(m.point,C.ink,"P",5); s.arrow(e.m,m.point,C.blue,1.9,"r");
      if(e.angle>1&&e.angle<179){
        const a=unit(e.dl), b=unit(sub(unit(e.rv),mul(a,dot(a,unit(e.rv))))), arc=Math.min(4.8,e.d*.25), angle=rad(e.angle);
        const offset=u=>sum(e.m,sum(mul(a,arc*Math.cos(u*angle)),mul(b,arc*Math.sin(u*angle))));
        s.draw(sample(28,offset),C.muted,1.35,"3 2");s.dot(offset(.55),C.muted,"θ",2);
      }
      pointArrow(s,e.m,e.dl,7,C.amber,"Δℓ");
      const valid=!m.unsafe&&m.smallElement;
      if(valid&&p.i){
        pointArrow(s,m.point,e.bvec,9,C.violet,"ΔB");
        if(mode!=="element")pointArrow(s,m.point,m.total,14,C.teal,"B",3.2);
      }
      const rows=[item("r","電流元到 P 的距離",fmt(e.d)+" cm"),item("theta","Δℓ 與 r 夾角",e.angle===null?"—":fmt(e.angle,1)+"°"),
        item("part","選取電流元 ΔB（x, y, z）",valid?vec(e.bvec,3)+" μT":"—"),
        item("total","磁場量值 |B|",valid?mag(m.total,"μT",3):"—"),
        item("vector","合磁場 B（x, y, z）",valid?vec(m.total,3)+" μT":"—")];
      if(mode==="straight"){
        const r=Math.hypot(p.y,p.z);
        rows.push(item("ideal","長直導線近似（同一垂距）",r>=.45?fmt(20*Math.abs(p.i)/r,3)+" μT":"—"));
      }
      if(mode==="solenoid")rows.push(item("ideal","長螺線管內部近似",fmt(40*Math.PI*Math.abs(p.i)*p.turns/p.coil,3)+" μT"));
      return sceneOut(s,rows,[[C.amber,"電流／Δℓ"],[C.blue,"電流元指向 P 的 r"],[C.violet,"分磁場 ΔB"],[C.teal,"向量和 B"]],
        !m.smallElement?"r 小於電流元長的 3 倍，不能把這段視為小電流元；請把 P 移遠或縮短 Δℓ。":m.unsafe?"P 太接近理想細導線；線徑未納入模型，此處不顯示量值。":
        "箭長示意，分量用全域 x、y、z 座標。有限線段與螺線管以電流元疊加；省略外部回路，螺線管以同軸圓圈近似。");
    }
  };
  const electro={
    id:"potential-map",title:"電位與等電位：三維測量工作臺",sections:["1-2","1-3"],
    description:"同時量電位 V 與電場 E；沿切片讀等電位線，記錄起點 A，再用檢驗電荷比較電力作功。",
    camera:{yaw:22,pitch:52,zoom:1},
    modes:[
      {id:"charges",title:"單／雙點電荷",controls:[ctl("q","左側電荷 Q₁",-12,12,1,6,"nC"),ctl("q2","右側電荷 Q₂",-12,12,1,-6,"nC"),ctl("spacing","電荷間距",6,28,1,18,"cm"),...xyz(0,8,2)],
        task:"等量異號時，將 P 放到 x = 0 的平面。比較 V = 0 與 E 是否也為零，再把右側電荷改為同號。"},
      {id:"plates",title:"平行導體板",controls:[ctl("voltage","板間電位差",2,30,1,14,"V"),ctl("gap","板間距",6,28,1,18,"cm"),...xyz(0,5,4)],
        task:"先只改 y、z，再改 x。哪些移動讓電位改變？固定電位差再改板間距，觀察 V(x) 的斜率。"},
      {id:"sphere",title:"帶電導體球",controls:[ctl("q","導體球總電量 Q",-12,12,1,6,"nC"),ctl("radius","球半徑",4,15,.5,10,"cm"),...xyz(6,1,0)],
        task:"從球內移到球外，找出 V 不變、E = 0 的範圍。注意 V 在球面連續，E 則有內外之分。"}
    ].map(m=>({...m,controls:[...m.controls,pick("test","檢驗電荷 q",[[1,"+1 nC"],[-1,"−1 nC"],[2,"+2 nC"],[-2,"−2 nC"]],1)]})),
    draw(mode,p,camera,state){
      const point=[p.x,p.y,p.z], at=P.electro(mode,p,point), atA=state.a?P.electro(mode,p,state.a):null;
      const s=scene(camera,32,"等電位切片、場源與觀測點 P 的電場向量");
      const bounds=27, z=point[2], count=25, inc=2*bounds/count;
      const vGrid=sample(count,v=>sample(count,u=>P.electro(mode,p,[-bounds+2*bounds*u,-bounds+2*bounds*v,z])?.v));
      const spacing=mode==="plates"?p.voltage/5:mode==="sphere"?Math.max(100,Math.abs(9000*p.q/p.radius)/5):
        Math.max(100,Math.round(Math.max(Math.abs(p.q),Math.abs(p.q2))*1.7)*100);
      const levels=mode==="plates"?[1,2,3,4].map(i=>i*spacing):[-4,-3,-2,-1,0,1,2,3,4].map(i=>i*spacing);
      for(const level of levels)for(let j=0;j<count;j++)for(let i=0;i<count;i++){
        const a=-bounds+i*inc,b=-bounds+j*inc;
        const pts=[[a,b,z],[a+inc,b,z],[a+inc,b+inc,z],[a,b+inc,z]];
        const vals=[vGrid[j][i],vGrid[j][i+1],vGrid[j+1][i+1],vGrid[j+1][i]];
        if(vals.some(v=>v===undefined))continue;
        const cuts=[];
        for(let k=0;k<4;k++){const l=(k+1)%4, v=vals[k], u=vals[l];if((v>=level)!==(u>=level))cuts.push(sum(pts[k],mul(sub(pts[l],pts[k]),(level-v)/(u-v))));}
        const color=mode!=="plates"&&level===0?C.violet:level>0?C.amber:C.blue;
        if(cuts.length>=2)s.draw(cuts.slice(0,2),color,level===0?2.1:1.1);
        if(cuts.length===4)s.draw(cuts.slice(2),color,1.1);
      }
      if(mode==="charges"){
        if(p.q)s.dot([-p.spacing/2,0,0],p.q>0?C.red:C.blue,"Q₁",7);
        if(p.q2)s.dot([p.spacing/2,0,0],p.q2>0?C.red:C.blue,"Q₂",7);
      }else if(mode==="plates"){
        for(const x of [-p.gap/2,p.gap/2]){
          const nodes=[[x,-26,-26],[x,26,-26],[x,26,26],[x,-26,26]];
          s.polygon(nodes,x<0?C.amber:C.blue,.15);s.draw([...nodes,nodes[0]],x<0?C.amber:C.blue,1.5);
          s.dot([x,-25,24],x<0?C.amber:C.blue,x<0?"＋":"−",4);
        }
      }else{
        const outline=ring(p.radius);
        s.draw(outline,C.muted,1.4);s.draw(outline.map(([x,y])=>[x,0,y]),C.muted,1.2,"5 3");s.draw(outline.map(([x,y])=>[0,x,y]),C.muted,1.2,"5 3");
      }
      if(state.a)s.dot(state.a,C.violet,"A",4.5);
      s.dot(point,C.ink,"P",5);
      if(at)pointArrow(s,point,at.e,12,C.teal,"E");
      const rows=[item("potential","P 點電位 V",at?fmt(at.v,2)+" V":"—"),item("field","P 點電場 |E|",at?mag(at.e,"N/C",2):"—"),
        item("vector","P 點電場 E（x, y, z）",at?vec(at.e,1)+" N/C":"—"),item("energy","P 點電位能 qV",at?fmt(p.test*at.v,2)+" nJ":"—"),
        item("work","由 A 至 P，靜電力作功",at&&atA?fmt(p.test*(atA.v-at.v),2)+" nJ":state.a?"—":"請先記錄 A"),
        item("levels","等電位線級距",fmt(spacing)+" V")];
      const vals=sample(160,u=>{const pos=[-28+56*u,p.y,p.z], v=P.electro(mode,p,pos)?.v;return [pos[0],v===undefined?null:clamp(v,-35000,35000)];});
      const graph=chart(28,[{name:"沿 x 的電位",unit:"V",values:vals,color:C.teal}],p.x,"x（cm）",-28);
      return sceneOut(s,rows,[[C.amber,"正電位線"],[C.blue,"負電位線"],[C.violet,"0 V 線／記錄點 A"],[C.teal,"電場 E"]],
        (at?"":"P 太靠近理想點電荷，讀值不顯示。")+(mode==="plates"?"忽略邊緣效應，以負板為 0 V；板外取理想常電位。":"以無窮遠為 0 V；曲線是通過 P 的 z 切片，箭頭顯示完整三維 E。")+" V(x) 圖取固定 y、z；點電荷附近超過 ±35,000 V 的值截到圖框。",graph);
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
          s.draw([[-24,y,0],[24,y,0]],C.muted,3);s.dot([-22,y,0],C.ink,name);
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
        s.draw(translated,C.teal,2.6);
        s.dot(translated[0],C.muted,"起點");s.dot(point,C.ink,"P",6);
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
        s.draw([a,h],C.muted,4);
        if(p.i)s.arrow(mul(h,-Math.sign(p.i)*.68),mul(h,Math.sign(p.i)*.85),C.amber,3,"I");
        pointArrow(s,zero,m.f,13,C.violet,"F",3);
        return sceneOut(s,[item("force","磁力量值 |F|",mag(m.f,"N",3)),item("vector","磁力 F（x, y, z）",vec(m.f,3)+" N"),item("theta","實際電流與 B 夾角",p.i?fmt(p.i>0?p.theta:180-p.theta)+"°":"—")],
          [[C.amber,"電流 I"],[C.blue,"磁場 B"],[C.violet,"磁力 F"]],"均勻磁場；磁力垂直於電流與磁場。箭長只表示方向，實際量值見讀數。");
      }
      const vertices=m.vertices.map(a=>mul(a,100));
      s.polygon(vertices,C.teal,.14);s.draw([...vertices,vertices[0]],C.teal,2.5);
      s.draw([[-24,0,0],[24,0,0]],C.muted,1.2,"4 4");
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
  const induction={
    id:"induction",title:"電磁感應：磁通量、電動勢與能量",sections:["3-1","3-2","3-3"],
    description:"切換滑棒、進出磁場、磁棒、旋轉線圈與改變磁場，在同一時間軸上比對 Φ、ε 與 I。",
    camera:{yaw:21,pitch:53,zoom:1},
    modes:[
      {id:"slide",title:"滑動導體棒",controls:[field,loopSize,ctl("speed","棒速 v",.02,.18,.01,.12,"m/s"),duration,...circuit],
        task:"比對閉合與開路時的 ε、I 與阻力。迴路閉合時，檢查外力維持等速所供的功率是否等於熱功率。"},
      {id:"enter",title:"線圈進出磁場",controls:[field,loopSize,duration,...circuit],
        task:"從 0% 拖到 100%，找出進入、全在場內、離開三段。哪個階段磁通量不為零，感應電動勢卻為零？"},
      {id:"magnet",title:"磁棒穿過線圈",controls:[{...field,label:"中央平均磁場量值"},{...loopSize,label:"圓線圈直徑"},duration,turns,pick("pole","前端磁極",[[1,"N 極"],[-1,"S 極"]],1),...circuit],
        task:"在磁棒接近、通過線圈面、離開時暫停。比較磁通量峰值和 ε 的零點；把磁極反轉再做一次。"},
      {id:"rotate",title:"旋轉線圈／發電機",controls:[field,loopSize,duration,turns,ctl("cycles","觀察時間內旋轉圈數",1,4,1,1,"圈"),...circuit],
        task:"把線圈法線轉到與 B 平行、垂直，找出 Φ 與 ε 的峰值為何不同步。"},
      {id:"vary",title:"固定線圈／改變 B",controls:[{...field,label:"起始磁場"},ctl("end","末端磁場（負值表示反向）",-1,1,.05,.85,"T"),loopSize,duration,turns,...circuit],
        task:"線圈不動、面積不變，讓 B 增加、減少或反向。比較前後兩段 B 固定時的讀值。"}
    ].map(m=>({...m,animate:true})),
    draw(mode,p,camera){
      const t=p.duration*p.phase/100,m=P.induction(mode,p,t);
      const half=p.size/2, extent=mode==="slide"?Math.max(28,(p.speed*p.duration+.035)*100*.65+7):29;
      const s=scene(camera,extent,"感應裝置、外加磁場與迴路的三維圖");
      let corners, center=[0,0,0];
      const rect=(x,y,a,b)=>[[x,y,0],[a,y,0],[a,b,0],[x,b,0]];
      if(mode==="enter"){
        const left=m.x*100-half,right=m.x*100+half;
        s.polygon(rect(-13,-22,13,22),C.blue,.13);s.draw([...rect(-13,-22,13,22),[-13,-22,0]],C.blue,1.5,"5 4");
        if(m.overlap>0)s.polygon(rect(Math.max(left,-13),-half,Math.min(right,13),half),C.teal,.35);
        corners=rect(left,-half,right,half);
        pointArrow(s,[m.x*100,-half-4,0],[1,0,0],8,C.amber,"v");
        for(const x of [-10,0,10])pointArrow(s,[x,14,0],[0,0,1],8,C.blue,x===0?"B":"");
      }else if(mode==="slide"){
        const span=(.035+p.speed*p.duration)*100, left=-span/2, right=left+100*m.x, railEnd=span/2+3;
        s.draw([[left,-half,0],[railEnd,-half,0]],C.muted,2);s.draw([[left,half,0],[railEnd,half,0]],C.muted,2);
        corners=rect(left,-half,right,half);s.polygon(corners,C.teal,.26);
        pointArrow(s,[right,0,0],[1,0,0],7,C.amber,"v");
        if(m.force)pointArrow(s,[right,-half,0],[-1,0,0],7,C.violet,"F");
        pointArrow(s,[left,half+4,0],[0,0,1],9,C.blue,"B");
      }else if(mode==="magnet"){
        const coil=ring(half);
        s.draw(p.closed?coil:coil.slice(5,-4),C.teal,2.7);
        if(!p.closed)s.dot([half,0,0],C.red,"開路",4);
        const z=m.x*100, a=[0,0,z-4], b=[0,0,z+4];
        s.draw([a,[0,0,z]],p.pole>0?C.blue:C.red,10);
        s.draw([[0,0,z],b],p.pole>0?C.red:C.blue,10);
        s.dot(b,p.pole>0?C.red:C.blue,p.pole>0?"N":"S",3.6);
        pointArrow(s,[4,0,z],[0,0,1],9,C.amber,"v");
        if(m.i) {
          const theta=Math.PI*.25, mid=[half*Math.cos(theta),half*Math.sin(theta),0];
          pointArrow(s,mid,mul([-Math.sin(theta),Math.cos(theta),0],Math.sign(m.i)),5,C.violet,"I");
        }
      }else{
        corners=rect(-half,-half,half,half).map(([x,y])=>[x,y*Math.cos(m.angle),y*Math.sin(m.angle)]);
        s.polygon(corners,C.teal,.15);
        pointArrow(s,center,[0,-Math.sin(m.angle),Math.cos(m.angle)],10,C.teal,"n");
        if(m.b)pointArrow(s,[-12,12,0],[0,0,m.b],10,C.blue,"B");
      }
      if(corners){
        s.draw([...corners,...(p.closed?[corners[0]]:[])],C.teal,2.7);
        if(!p.closed){
          const mid=mul(sum(corners[0],corners[3]),.5), d=mul(sub(corners[0],corners[3]),.11);
          s.draw([corners[3],sub(mid,d)],C.teal,2.7);s.draw([sum(mid,d),corners[0]],C.teal,2.7);s.dot(mid,C.red,"開路",4);
        }
        if(m.i) {
          const mid=mul(sum(corners[0],corners[1]),.5);
          pointArrow(s,mid,mul(sub(corners[1],corners[0]),Math.sign(m.i)),5,C.violet,"I",2.5);
        }
      }
      const values=sample(240,u=>[u*p.duration,P.induction(mode,p,u*p.duration)]);
      const graph=chart(p.duration,[{name:"單匝磁通量 Φ",unit:"Wb",values:values.map(([x,v])=>[x,v.flux]),color:C.teal},
        {name:"感應電動勢 ε",unit:"V",values:values.map(([x,v])=>[x,v.emf]),color:C.amber},
        {name:"感應電流 I",unit:"A",values:values.map(([x,v])=>[x,v.i]),color:C.violet}],t);
      const rows=[item("time","時間 t",fmt(t,3)+" s"),item("flux","單匝磁通量 Φ",fmt(m.flux,5)+" Wb"),
        item("emf","感應電動勢 ε",fmt(m.emf,4)+" V"),item("current","感應電流 I",fmt(m.i,4)+" A"),
        item("power","電阻熱功率 I²R",fmt(m.heat*1e6,2)+" μW")];
      if(mode==="slide")rows.push(item("force","磁力（沿運動軸）",fmt(m.force*1e3,3)+" mN"),item("work","維持等速的外力功率",fmt(-m.force*m.v*1e6,2)+" μW"));
      if(mode==="enter")rows.push(item("area","在線圈場區重疊面積",fmt(m.overlap*p.size*100,1)+" cm²"));
      return sceneOut(s,rows,[[C.blue,"磁場 B／場區"],[C.teal,"迴路／重疊面積"],[C.amber,"運動方向"],[C.violet,"感應電流／磁力"]],
        "正磁通量以所選面法線為準；正電流由右手定則配對。開路時保留感應電動勢，I = 0。"+
        (mode==="magnet"?"磁棒用軸向理想磁偶極近似，中央場值設定為穿過線圈的平均值。":mode==="enter"?"場區邊界採理想突變，臨界點讀值取右側極限。":""),graph);
    }
  };
  EM.workbenches=[biot,electro,force,induction];
})();
