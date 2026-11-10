(() => {
  const W = 560, H = 326, tau = 2*Math.PI, mu = 4*Math.PI*1e-7;
  const colors = {ink:"#e9f4fa", muted:"#aac3d0", grid:"#31505f", teal:"#7de0cc", amber:"#f4be73", blue:"#9cbdf6"};
  const f = (n,d=2) => (Math.abs(n) < 0.5*10**(-d) ? 0 : n).toLocaleString("en-US",{maximumFractionDigits:d});
  const signed = (n,d=2) => (n>0 ? "+" : "") + f(n,d);
  const rad = d => d*Math.PI/180;
  const l = (x,y,a,b,c=colors.grid,w=1,dash="") => `<line x1="${x}" y1="${y}" x2="${a}" y2="${b}" stroke="${c}" stroke-width="${w}" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;
  const t = (x,y,s,c=colors.muted,anchor="start",size=16) => `<text x="${x}" y="${y}" fill="${c}" text-anchor="${anchor}" font-size="${size}">${s}</text>`;
  const circ = (x,y,r,fill,stroke="none",sw=1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const ellipse = (x,y,rx,ry,fill,stroke,sw=2) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const box = (x,y,w,h,fill,stroke="none",r=0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}"/>`;
  const path = (points,c=colors.teal,w=2, dash="") => points.length ? `<polyline points="${points.map(([x,y])=>`${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round" ${dash ? `stroke-dasharray="${dash}"` : ""}/>` : "";
  const arrow = (x,y,a,b,c=colors.teal,w=2,head=8) => {
    const dx=a-x, dy=b-y, mag=Math.hypot(dx,dy);
    if(mag<0.01) return "";
    const u=dx/mag, v=dy/mag, h=Math.min(head,mag*.64);
    return l(x,y,a,b,c,w) + `<path d="M ${a} ${b} L ${a-h*u-h*.52*v} ${b-h*v+h*.52*u} L ${a-h*u+h*.52*v} ${b-h*v-h*.52*u} Z" fill="${c}"/>`;
  };
  const sample = (n, fn) => Array.from({length:n+1},(_,i)=>fn(i/n));
  const svg = (label,inner) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${label}">${inner}</svg>`;
  const mesh = () => sample(12,u=>l(24+u*512,34,24+u*512,292)).join("") + sample(6,u=>l(24,34+u*258,536,34+u*258)).join("");
  const circleMark = (x,y,sign,c=colors.blue,r=12) => `<g class="field-mark">${circ(x,y,r,"#142d38",c,1.5) + (sign>0 ? circ(x,y,r*.22,c) : l(x-r*.35,y-r*.35,x+r*.35,y+r*.35,c,1.7)+l(x+r*.35,y-r*.35,x-r*.35,y+r*.35,c,1.7))}</g>`;
  const charge = (x,y,q) => circ(x,y,15,q>0?colors.amber:colors.blue) + t(x,y+6,q>0?"+":"−","#142d38","middle",21);
  const caption = (s) => t(28,315,s,colors.muted,"start",14);
  const range = (id,name,min,max,step,value,unit="") => ({id,name,min,max,step,value,unit});
  const select = (id,name,choices,value) => ({id,name,choices,value});
  const output = (label,value) => [label,value];
  function chart({xMax,yMin=0,yMax,xLabel,yLabel,xTicks,yTicks,series,cursor,origin=[68,43],size=[442,218]}) {
    const [x0,y0]=origin, [width,height]=size, [xEnd,yEnd]=[x0+width,y0+height];
    const x=n=>x0+n/xMax*width, y=n=>yEnd-(n-yMin)/(yMax-yMin)*height;
    let s=box(x0,y0,width,height,"none",colors.grid);
    for(const [v,label] of xTicks) s+=l(x(v),y0,x(v),yEnd)+t(x(v),yEnd+24,label,colors.muted,"middle",15);
    for(const [v,label] of yTicks) s+=l(x0,y(v),xEnd,y(v),v===0?colors.muted:colors.grid)+t(x0-10,y(v)+5,label,colors.muted,"end",15);
    s+=t(x0,y0-13,yLabel)+t(xEnd,yEnd+47,xLabel,colors.muted,"end");
    for (const {points,color,marks=false,dashed=false} of series) {
      s+=path(points.map(([a,b])=>[x(a),y(b)]),color,2.6,dashed?"7 5":"");
      if(marks) s+=points.map(([a,b])=>circ(x(a),y(b),4,color)).join("");
    }
    if(cursor!==undefined) s+=l(x(cursor),y0,x(cursor),yEnd,colors.ink,1.3,"5 5");
    return {s,x,y};
  }
  const lab = (id,name,controls,guide,draw,animate=null) => ({id,name,controls,guide,draw,animate});
  const labs = [
    lab("coulomb","點電荷作用力",[
      range("q1","電量 q₁",1,6,1,2,"μC"),range("q2","電量 q₂ 量值",1,6,1,3,"μC"),range("r","間距 r",0.2,1,0.05,0.4,"m"),
      select("s","q₂ 符號",[[1,"正電"],[-1,"負電"]],-1)
    ],["固定兩個電量，把間距從 0.40 m 調至 0.80 m。","比較兩次的 F。再切換 q₂ 正負，判斷改變的是方向、量值，還是兩者。"],p=>{
      const n=0.009*p.q1*p.q2/p.r**2, a=280-p.r*185, b=280+p.r*185;
      const len=28+Math.min(60,n*55);
      return [mesh()+l(25,151,535,151)+charge(a,151,p.q1)+charge(b,151,p.s)+
        arrow(a-21*p.s,151,a-(21+len)*p.s,151,colors.teal,3)+arrow(b+21*p.s,151,b+(21+len)*p.s,151,colors.teal,3)+
        t(a,118,`q₁ = +${p.q1} μC`,colors.ink,"middle")+t(b,202,`q₂ = ${signed(p.s*p.q2)} μC`,colors.ink,"middle")+
        l(a,236,b,236,colors.muted,1,"4 4")+l(a,229,a,243,colors.muted)+l(b,229,b,243,colors.muted)+t(280,264,`r = ${f(p.r)} m`,colors.ink,"middle")+caption("綠色箭頭為各電荷所受力；箭長僅示意。"),
        [output("靜電力量值 F",`${f(n,4)} N`),output("作用方向",p.s>0?"互斥":"互吸")]];
    }),
    lab("field","電力線與檢驗電荷",[
      select("s","右側場源",[[0,"移除"],[-1,"−2 μC"],[1,"+2 μC"]],-1),
      range("y","P 在中線上方的距離",0,0.65,0.05,0.35,"m"),
      select("test","檢驗電荷",[[1,"+1 nC"],[-1,"−1 nC"]],1)
    ],["比較右側場源為正、負時，兩場源中點的電場。","只改檢驗電荷的正負，看看 P 點的電場與受力哪一個改變。"],p=>{
      const src=[[179,164,1],...(p.s?[[381,164,p.s]]:[])], scale=202/1.2;
      const field=(x,y)=>src.reduce(([ex,ey],[a,b,q])=>{
        const dx=x-a,dy=y-b,r=Math.max(1,Math.hypot(dx,dy));
        return [ex+q*dx/r**3,ey+q*dy/r**3];
      },[0,0]);
      let s=mesh()+'<defs><clipPath id="basic-field-frame"><rect x="24" y="34" width="512" height="258"/></clipPath></defs><g clip-path="url(#basic-field-frame)">';
      const lines=EMPhysics.electricStreamlines({q:6,q2:6*p.s,spacing:12});
      for(const {points,sign} of lines)for(const side of [-1,1]){
        const pts=points.map(([x,y])=>[280+x*202/12,164+side*y*202/12]);
        s+=path(pts,colors.teal,1.05);
        const j=Math.min(12,Math.floor(pts.length*.54));
        if(j>1)s+=arrow(...pts[sign>0?j-2:j],...pts[sign>0?j:j-2],colors.teal,1,5);
      }
      s+="</g>"+src.map(([a,b,q])=>charge(a,b,q)).join("");
      const x=280,y=164-p.y*scale, [ex,ey]=field(x,y), m=Math.hypot(ex,ey);
      const len=Math.min(55,Math.max(26,m*195000));
      s+=circ(x,y,5,colors.ink,"#142d38",1.5)+t(x+9,y-9,"P",colors.ink);
      if(m>1e-8) {
        s+=arrow(x,y,x+len*ex/m,y+len*ey/m,colors.ink,3);
        s+=arrow(x,y+7,x+len*ex/m*p.test,y+7+len*ey/m*p.test,colors.amber,2.1);
      }
      const e=m*18000*scale**2;
      return [s+caption("兩場源間距 1.20 m｜白：電場 E　琥珀：受力 F"),[output("P 點電場量值",`${f(e,0)} N/C`),output("檢驗電荷受力量值",`${f(e/1000,2)} μN`)]];
    }),
    lab("potential","平行板電位圖",[
      range("v","正、負板的電位差",2,20,1,12,"V"),
      range("d","板間距 d",0.02,0.12,0.01,0.06,"m"),
      range("p","P 點位置（自正板起）",0,100,5,50,"%")
    ],["把電壓固定，將板間距加倍，觀察電位斜率與電場量值。","將 P 保持在兩板中間，板距改變時 V(P) 會變嗎？"],p=>{
      const max=.12, yMax=20, xTicks=[[0,"0"],[.04,"0.04"],[.08,"0.08"],[.12,"0.12"]];
      const {s,x,y}=chart({xMax:max,yMax,xLabel:"x（m）",yLabel:"V（V）",xTicks,yTicks:[[0,"0"],[5,"5"],[10,"10"],[15,"15"],[20,"20"]],series:[{points:[[0,p.v],[p.d,0]],color:colors.teal}]});
      const a=p.d*p.p/100,v=p.v*(1-p.p/100);
      return [s+l(x(a),y(v),x(a),y(0),colors.amber,1,"5 4")+circ(x(a),y(v),6,colors.amber)+t(x(a)+10,y(v)-10,"P",colors.amber),[output("板間電場 E（向負板）",`${f(p.v/p.d,1)} N/C`),output("P 點電位（以負板為零）",`${f(v)} V`)]];
    }),
    lab("compass","電流與指南針",[
      range("i","電流 I（正值射出紙面）",-12,12,1,6,"A"),
      range("r","P 到導線的距離",1,8,0.5,4,"cm"),
      select("earth","地磁水平分量",[[0,"忽略"],[30,"向右・30 μT"]],30)
    ],["先忽略地磁場，將電流由正變負，記錄 P 的磁場方向。","加回地磁場，增大與導線的距離，觀察指南針越接近哪個方向。"],p=>{
      const b=20*p.i/p.r, x=277+p.r*29, y=162, mag=Math.hypot(p.earth,b);
      const rings=p.i ? [27,55,86,116].map(r=>circ(277,162,r,"none",colors.grid,1.6)+[0,Math.PI].map(a=>{
        const d=Math.sign(p.i)*.13;
        return arrow(277+r*Math.cos(a+d),162+r*Math.sin(a+d),277+r*Math.cos(a-d),162+r*Math.sin(a-d),colors.teal,1.5,6);
      }).join("")).join("") : "";
      let s=mesh()+rings+(p.i?circleMark(277,162,p.i):circ(277,162,12,"#142d38",colors.blue,1.5))+t(277,312,"長直導線截面",colors.muted,"middle");
      s+=circ(x,y,22,"#142d38",colors.muted)+circ(x,y,3,colors.ink)+t(x,y+44,"P",colors.ink,"middle");
      if(mag) s+=arrow(x,y,x+36*p.earth/mag,y-36*b/mag,colors.amber,3);
      else s+=t(x,y-33,"合場為零",colors.ink,"middle");
      if(p.earth) s+=arrow(45,60,113,60,colors.blue)+t(46,86,"地磁",colors.blue);
      return [s,[output("導線在 P 的磁場",b?`${f(Math.abs(b))} μT・向${b>0?"上":"下"}`:"0 μT"),output("P 點合磁場量值",`${f(mag)} μT`)]];
    }),
    lab("conductors","三種載流導線",[
      select("kind","導線形狀",[[0,"長直導線"],[1,"圓線圈"],[2,"長螺線管"]],0),
      range("i","電流量值 I",1,8,1,3,"A"),
      select("sign","電流方向",[[1,"圖示正向"],[-1,"反向"]],1),
      range("r","長直距離 r／圓線圈半徑 R",1,12,0.5,5,"cm"),
      range("n","螺線管匝數密度 n",100,1000,50,400,"匝/m")
    ],["在長直導線模式把 r 加倍。接著切換圓線圈，改變 R，對照兩條公式。","切換螺線管，找出此近似模型中真正影響 B 的變數。"],p=>{
      let b,s=mesh();
      if(p.kind===0) {
        const x=155+p.r*27;
        b=20*p.i/p.r;
        s+=circleMark(155,164,p.sign,colors.blue,19)+l(155,164,x,164,colors.muted,1,"5 4")+circ(x,164,4,colors.ink)+
          arrow(x,164,x,164-65*p.sign,colors.teal,3)+t(x+10,181,"P",colors.ink)+t((155+x)/2,191,"r",colors.ink,"middle");
      } else if(p.kind===1) {
        b=mu*p.i/(2*p.r/100)*1e6;
        const r=45+6*p.r;
        s+=circ(280,159,r,"none",colors.blue,3)+circleMark(280,159,p.sign,colors.teal,14);
        s+=l(294,159,280+r,159,colors.muted,1,"5 4")+t(305,152,"R");
        s+=arrow(280+p.sign*25,159-r,280-p.sign*25,159-r,colors.amber,3)+t(280,309,"正視圓線圈・中心讀值",colors.muted,"middle");
      } else {
        b=mu*p.n*p.i*1e6;
        s+=sample(9,k=>ellipse(132+k*30,166,14,62,"none",colors.blue,1.6)).join("");
        s+=circleMark(162,104,p.sign,colors.amber,10)+circleMark(162,228,-p.sign,colors.amber,10);
        s+=arrow(258-p.sign*49,166,258+p.sign*49,166,colors.teal,3)+t(263,252,"理想長螺線管內部",colors.ink,"middle");
      }
      const dir=[p.sign>0?"向上":"向下",p.sign>0?"射出紙面":"射入紙面",p.sign>0?"向右":"向左"][p.kind];
      return [s,[output("指定位置磁場量值",`${f(b)} μT`),output("磁場方向",dir)]];
    }),
    lab("wireforce","磁場中的載流直線段",[
      range("i","電流量值 I",1,8,.5,3,"A"),range("b","均勻磁場 B",.1,1,.1,.5,"T"),
      range("theta","電流與磁場夾角 θ",0,180,5,60,"°"),
      range("length","場內導線長 ℓ",.1,.6,.05,.2,"m")
    ],["將夾角先調成 0°，再調成 90°，比較磁力。","比較 30° 與 150°。兩個角度的磁力方向與量值有何關係？"],p=>{
      const sin=Math.sin(rad(p.theta)), cos=Math.cos(rad(p.theta));
      const n=p.i*p.b*p.length*sin;
      const a=280-85*cos,b=164+85*sin,c=280+85*cos,d=164-85*sin;
      return [mesh()+[84,122,198,236].map(y=>arrow(69,y,492,y,colors.grid,1.5)).join("")+
        arrow(a,b,c,d,colors.amber,4,12)+t(c+12,d-8,"I",colors.amber)+t(492,69,"B",colors.blue)+
        (n>1e-9?circleMark(280,164,-1,colors.teal,18):circ(280,164,5,colors.teal))+
        caption("電流與磁場都在紙面內；⊗ 表示磁力射入紙面。"),[output("磁力量值 F",`${f(n,3)} N`),output("磁力方向",n>1e-9?"射入紙面":"無磁力")]];
    }),
    lab("particle","帶電質點軌跡",[
      range("b","磁場 B（朝 +z）",.1,.5,.05,.15,"T"),range("v","入射速率 v",2,8,.5,5.5,"m/s"),
      range("theta","速度與磁場夾角 θ",0,90,5,55,"°"),
      select("q","電量符號",[[1,"正電"],[-1,"負電"]],1),
      range("phase","運動進度",0,100,1,33,"%")
    ],["固定 v，從 90° 減小入射角，觀察半徑與螺距。","把電荷變號；找出數值不變的量，以及偏轉方向的變化。"],p=>{
      const w=250*p.b, speed=p.v, sin=Math.sin(rad(p.theta)), cos=Math.cos(rad(p.theta));
      const vp=speed*sin, vz=speed*cos, r=vp/w, T=tau/w, pitch=vz*T;
      const proj = a=>[149+vz*a/w*48-p.q*r*345*Math.sin(a)*.48,166-r*345*Math.cos(a)];
      const trace=sample(160,u=>proj(3*tau*u)), dot=proj(3*tau*p.phase/100);
      const top=x=>l(x,39,x,294,colors.grid);
      const end=proj(3*tau);
      return [mesh()+top(149)+arrow(58,166,511,166,colors.blue,1.6)+t(511,153,"+z（B）",colors.blue,"end")+
        (Math.abs(vz)<1e-9&&r>0 ? ellipse(149,166,r*345*.48,r*345,"none",colors.teal,2.7) : path(trace,colors.teal,2.7))+
        circ(...dot,7,colors.amber)+circ(...proj(0),3.5,colors.ink)+
        (Math.abs(vz)>1e-9 ? t(Math.min(end[0],494),278,"側向投影",colors.muted) : t(280,278,"圓軌道投影為橢圓",colors.muted,"middle"))+
        caption("固定 |q|/m = 250 C/kg；圖示為斜視投影，軸向與半徑比例不同。"),
        [output("軌道半徑 r",`${f(r,3)} m`),output("週期 T",vp?`${f(T,3)} s`:"—（直線運動）"),output("螺距",vp?`${f(pitch,3)} m`:"—（直線運動）")]];
    },"phase"),
    lab("flux","磁通量變化率",[
      range("start","起始磁場 B₁",0,1,.1,.2,"T"),range("end","末端磁場 B₂",0,1,.1,.8,"T"),
      range("dt","磁場變化時間 Δt",.2,2,.1,1,"s"),
      range("n","線圈匝數 N",5,50,5,20,"匝")
    ],["固定磁場的起點與終點，縮短變化時間。比較斜率及感應電動勢。","把 B₂ 調至小於 B₁，再讓兩者相等。對照 ε 的正負和零值。"],p=>{
      const area=.05, a=area*p.start,b=area*p.end, emf=-p.n*(b-a)/p.dt;
      const {s}=chart({xMax:2.5,yMax:.05,yLabel:"單匝 Φ（Wb）",xLabel:"t（s）",
        xTicks:[[0,"0"],[.5,"0.5"],[1,"1.0"],[1.5,"1.5"],[2,"2.0"],[2.5,"2.5"]],
        yTicks:[[0,"0"],[.01,"0.01"],[.02,"0.02"],[.03,"0.03"],[.04,"0.04"],[.05,"0.05"]],
        series:[{points:[[0,a],[p.dt,b],[2.5,b]],color:colors.teal,marks:true}]});
      return [s,[output("ΔΦ（單匝；A = 0.05 m²）",`${signed(b-a,3)} Wb`),output("變化期間 ε",`${f(emf,3)} V`),output("磁場固定期間 ε","0 V")]];
    }),
    lab("lenz","磁棒靠近與遠離線圈",[
      select("pole","面向線圈的磁極",[[1,"N 極"],[-1,"S 極"]],1),
      select("move","磁棒運動",[[1,"靠近"],[0,"靜止"],[-1,"遠離"]],1),
      select("closed","線圈",[[1,"閉合"],[0,"開路"]],1)
    ],["從磁棒側看線圈。固定磁極，把靠近切換成遠離，記下電流方向。","再把線圈切成開路；分辨感應電動勢與感應電流。"],p=>{
      const dir=p.pole*p.move, has=dir&&p.closed;
      const px=p.move===1?209:p.move===-1?161:185;
      let s=mesh()+l(32,162,526,162,colors.muted,1,"5 5")+
        box(px-120,128,60,68,p.pole>0?colors.blue:colors.amber,"none",3)+box(px-60,128,60,68,p.pole>0?colors.amber:colors.blue,"none",3)+
        t(px-90,169,p.pole>0?"S":"N","#142d38","middle",22)+t(px-30,169,p.pole>0?"N":"S","#142d38","middle",22)+
        ellipse(302,162,29,82,"none",colors.teal,2.4)+t(302,266,"線圈側視",colors.ink,"middle")+
        circ(442,162,47,"none",colors.teal,2.4)+t(442,237,"從磁棒側看",colors.ink,"middle");
      if(p.move) s+=arrow(px-75,98,px-75+p.move*63,98,colors.amber,3);
      if(!p.closed) s+=box(430,108,24,13,"#142d38");
      if(has) {
        const ang=u=>[442+47*Math.cos(u),162+47*Math.sin(u)];
        s+=arrow(...ang(dir*.35),...ang(0),colors.amber,3)+arrow(...ang(Math.PI+dir*.35),...ang(Math.PI),colors.amber,3);
      }
      return [s+caption("箭頭表示磁棒運動與電流方向；此圖僅作方向示意。"),
        [output("感應電動勢",p.move?"非零":"零"),output("感應電流",has?(dir>0?"逆時針":"順時針"):"無")]];
    }),
    lab("generator","旋轉線圈與交流波形",[
      range("speed","轉動頻率 f",1,5,.5,2,"Hz"),range("n","線圈匝數 N",5,40,5,20,"匝"),
      range("phase","目前角度 θ",0,360,1,60,"°")
    ],["把角度調到 0°、90°、180°、270°，比較兩條曲線。","調高轉動頻率。圖的橫軸仍是一整圈，比較實際週期與峰值。"],p=>{
      const B=.25,A=.04, peak=p.n*B*A*tau*p.speed, a=rad(p.phase);
      const {s}=chart({xMax:360,yMin:-1,yMax:1,origin:[56,58],size:[456,198],
        xLabel:"θ（角度）",yLabel:"相對各自峰值",
        xTicks:[[0,"0°"],[90,"90°"],[180,"180°"],[270,"270°"],[360,"360°"]],
        yTicks:[[-1,"−1"],[0,"0"],[1,"+1"]],
        series:[{points:sample(100,u=>[u*360,Math.cos(tau*u)]),color:colors.teal},{points:sample(100,u=>[u*360,Math.sin(tau*u)]),color:colors.amber,dashed:true}],cursor:p.phase});
      return [s+t(310,43,"實線 Φ",colors.teal)+t(408,43,"虛線 ε",colors.amber),
        [output("目前單匝磁通量 Φ",`${f(B*A*Math.cos(a),4)} Wb`),output("目前感應電動勢 ε",`${f(peak*Math.sin(a))} V`),output("ε 峰值 ／ 週期",`${f(peak)} V ／ ${f(1/p.speed,3)} s`)]];
    },"phase"),
    lab("transformer","變壓器的匝數比",[
      range("np","原線圈 Nₚ",100,800,50,400,"匝"),range("ns","副線圈 Nₛ",100,1200,50,800,"匝"),
      range("vp","輸入電壓 Vₚ",10,120,5,60,"V"),range("power","輸出功率 P",30,300,15,120,"W"),
      select("ac","輸入型態",[[1,"交流（有效值）"],[0,"直流（接通後穩態）"]],1)
    ],["保持原線圈匝數與輸入電壓，增加副線圈匝數。","固定輸出功率，觀察升壓時副線圈電流如何改變，再切成穩定直流比較。"],p=>{
      const v=p.ac*p.vp*p.ns/p.np;
      const turns=(x,n,c)=>sample(Math.max(2,Math.round(n/85)),k=>ellipse(x,97+k*130,35,6,"none",c,2)).join("");
      let s=mesh()+box(151,61,258,201,"#365564",colors.muted,12)+box(186,89,188,145,"#142d38",colors.grid,5)+
        turns(168,p.np,colors.amber)+turns(392,p.ns,colors.teal)+
        t(105,288,`Nₚ = ${p.np}`,colors.amber)+t(406,288,`Nₛ = ${p.ns}`,colors.teal)+t(280,158,"共用鐵芯",colors.ink,"middle")+
        t(280,184,p.ac?"磁通量隨時間變化":"穩態磁通量不變",colors.muted,"middle",15);
      return [s,[output("副線圈輸出電壓 Vₛ",`${f(v)} V`),output("副線圈輸出電流 Iₛ",v?`${f(p.power/v)} A`:"0 A"),output("實際輸出功率",`${p.ac?p.power:0} W`)]];
    }),
    lab("wave","真空中的平面電磁波",[
      range("freq","頻率 f",1,6,.25,2,"GHz"),range("phase","週期進度",0,100,1,18,"%")
    ],["保持觀測範圍固定，增大頻率；觀察波峰距離與真空波速。","播放示意動畫。比較同一位置上 E 與 B 的相位，並確認三個方向。"],p=>{
      const y0=173, xmin=77,xmax=504, length=.32, lambda=.3/p.freq;
      const h=u=>Math.sin(tau*(length*u/lambda-p.phase/100));
      const waveE=sample(200,u=>[xmin+(xmax-xmin)*u,y0-63*h(u)]);
      const waveB=sample(200,u=>[xmin+(xmax-xmin)*u-36*h(u),y0+32*h(u)]);
      const λ=(xmax-xmin)*lambda/length;
      return [mesh()+arrow(xmin-16,y0,529,y0,colors.ink,1.5)+t(526,y0-12,"+x",colors.ink,"end")+
        arrow(xmin,y0,xmin,69,colors.teal)+t(xmin+9,72,"+y",colors.teal)+
        arrow(xmin,y0,xmin-40,y0+36,colors.blue)+t(xmin-42,y0+57,"+z",colors.blue)+
        path(waveE,colors.teal,2.8)+path(waveB,colors.blue,2.4,"6 4")+
        l(xmin,274,xmin+λ,274,colors.muted,1,"4 4")+l(xmin,267,xmin,281,colors.muted)+l(xmin+λ,267,xmin+λ,281,colors.muted)+
        t(xmin+λ/2,298,"λ",colors.ink,"middle")+t(345,68,"實線 E",colors.teal)+t(444,68,"虛線 B",colors.blue)+
        caption("固定視窗長 0.32 m；兩場各自正規化，播放為慢速示意。"),
        [output("真空波速 c","3.00 × 10⁸ m/s"),output("波長 λ",`${f(lambda*100,2)} cm`),output("週期 T",`${f(1/p.freq,3)} ns`)]];
    },"phase")
  ];
  const fig = (label,draw) => ({label,draw});
  const figures = {
    conceptField:fig("五條由左往右的電力線向右靠攏，P 在左側中線上，Q 在右側中線上。",()=>{
      let s=mesh();
      for(let i=-2;i<=2;i++){
        const line=sample(36,u=>[64+u*432,155+i*(53-38*u)]);
        s+=path(line,colors.teal,2)+arrow(...line[16],...line[19],colors.teal,2);
      }
      return s+circ(126,155,5,colors.ink)+t(126,140,"P",colors.ink,"middle",20)+circ(435,155,5,colors.ink)+
        l(435,149,435,104,colors.muted,1,"3 3")+box(422,77,26,26,"#142d38",colors.muted,5)+t(435,96,"Q",colors.ink,"middle",20);
    }),
    conceptFlux:fig("磁通量對時間圖：由（0 秒，0 Wb）至（2 秒，0.030 Wb），到 3 秒維持 0.030 Wb，最後降至（4 秒，0 Wb）。各點間為直線。",()=>chart({
      xMax:4,yMax:.04,xLabel:"t（s）",yLabel:"Φ（Wb）",
      xTicks:[[0,"0"],[1,"1"],[2,"2"],[3,"3"],[4,"4"]],
      yTicks:[[0,"0"],[.01,"0.010"],[.02,"0.020"],[.03,"0.030"],[.04,"0.040"]],
      series:[{points:[[0,0],[2,.03],[3,.03],[4,0]],color:colors.teal,marks:true}]
    }).s),
    conceptAC:fig("電流對時間圖：甲在正電流區呈固定水平線；乙呈正弦曲線，在正電流與負電流間來回振盪。",()=>{
      const {s}=chart({xMax:2,yMin:-1.2,yMax:1.2,xLabel:"時間 t",yLabel:"電流 I",
        xTicks:[[0,"0"],[1,"T"],[2,"2T"]],yTicks:[[0,"0"]],
        series:[{points:[[0,.69],[2,.69]],color:colors.teal},{points:sample(120,u=>[2*u,Math.sin(2*tau*u)]),color:colors.amber,dashed:true}]});
      return s+t(381,33,"實線：甲",colors.teal)+t(475,33,"虛線：乙",colors.amber);
    }),
    examPotential:fig("電位對位置圖：A（0 cm，10 V），B（2 cm，6 V），C（4 cm，2 V），三點在同一直線。",()=>{
      const {s,x,y}=chart({xMax:5,yMax:12,xLabel:"x（cm）",yLabel:"V（V）",xTicks:[[0,"0"],[1,"1"],[2,"2"],[3,"3"],[4,"4"],[5,"5"]],yTicks:[[0,"0"],[2,"2"],[4,"4"],[6,"6"],[8,"8"],[10,"10"],[12,"12"]],series:[{points:[[0,10],[2,6],[4,2]],color:colors.teal,marks:true}]});
      return s+[[0,10,"A"],[2,6,"B"],[4,2,"C"]].map(([a,b,label])=>t(x(a)+11,y(b)-9,label,colors.ink)).join("");
    }),
    examPlates:fig("兩平行板：左側板帶正電，右側板帶負電；中間留空供畫電力線。",()=>box(106,52,18,210,colors.amber)+box(436,52,18,210,colors.blue)+
      t(115,291,"正板",colors.ink,"middle")+t(445,291,"負板",colors.ink,"middle")+[88,135,182,229].map(y=>t(93,y,"+",colors.ink,"end",22)+t(466,y,"−",colors.ink,"start",22)).join("")),
    examWires:fig("由左到右，甲、M、乙、P 在一直線。相鄰點距離皆為 a。甲電流出紙面，乙電流入紙面。",()=>{
      const xs=[112,222,332,442];
      return l(70,153,490,153,colors.grid)+circleMark(xs[0],153,1,colors.ink,18)+circleMark(xs[2],153,-1,colors.ink,18)+circ(xs[1],153,5,colors.ink)+circ(xs[3],153,5,colors.ink)+
        xs.map((x,i)=>t(x,105,["甲","M","乙","P"][i],colors.ink,"middle",21)+l(x,220,x,241,colors.muted)).join("")+
        l(xs[0],231,xs[3],231,colors.muted)+[167,277,387].map(x=>t(x,258,"a",colors.ink,"middle",20)).join("")+caption("⊙ 射出紙面　⊗ 射入紙面");
    }),
    examParticle:fig("均勻磁場垂直射出紙面。正電荷位於左上方 P 點，初速向右；留空供手畫軌跡。",()=>{
      let s="";
      for(let x=52;x<540;x+=65) for(let y=56;y<279;y+=54) s+=circleMark(x,y,1,colors.grid,6);
      return s+circ(122,85,7,colors.amber)+t(104,89,"P",colors.ink,"end")+arrow(127,85,196,85,colors.amber,2.8)+t(200,80,"v",colors.ink)+caption("⊙ 均勻磁場 B 射出紙面");
    }),
    examFlux:fig("磁通量對時間圖：0 秒為 0；1 秒到 2 秒為 0.020 Wb；2.5 秒降至 0。各點間為直線。",()=>chart({
      xMax:2.5,yMax:.025,xLabel:"t（s）",yLabel:"單匝 Φ（Wb）",xTicks:[[0,"0"],[.5,"0.5"],[1,"1.0"],[1.5,"1.5"],[2,"2.0"],[2.5,"2.5"]],
      yTicks:[[0,"0"],[.01,"0.010"],[.02,"0.020"]],series:[{points:[[0,0],[1,.02],[2,.02],[2.5,0]],color:colors.teal,marks:true}]
    }).s)
  };
  const defaults = config => Object.fromEntries(config.controls.map(c=>[c.id,c.value]));
  EM.labs = labs;
  EM.defaults = defaults;
  EM.labOutput = (config,p) => {
    const [drawing, values]=config.draw(p);
    return {diagram:svg(config.name+"示意圖",drawing),values};
  };
  EM.figure = id => figures[id] ? svg(figures[id].label,figures[id].draw()) : "";
})();
