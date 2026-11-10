(() => {
  const {clamp}=EMPhysics;
  const memory=new Map();
  const defaultPlanes={"particle-apps/aurora":"xz","particle-apps/linear":"xz","magnetic-force/particle":"xz","magnetic-force/motor":"yz",
    "induction/magnet":"xz","induction/rotate":"yz","induction/transformer":"xz"};
  const beamModes=new Set(["particle","linear","cyclotron","plane-wave"]);
  const sceneCaptions={
    element:"銅線上的金色短節是選取的電流元。拖曳銀色測點，改變量測位置。",
    straight:"金色短節標出目前選取的電流元。拖曳銀色測點，看看磁場讀值怎麼變。",
    compass:"紅色針尖指北。反轉電流，觀察磁針往哪一側偏。",
    pair:"金色短節標出選取的電流元。把銀色測點拖到兩線之間，比較磁場。",
    loop:"拖曳銀色測點，從線圈中心移到軸上和線圈外。",
    solenoid:"旋轉銅線圈，或把銀色測點拖出管口，比較磁場讀值。",
    "field-lines":"紅、藍球分別代表正、負電荷。曲線表示電場走向，銀色球是可拖曳的測點。",
    charges:"曲線連接電位相同的位置。拖曳銀色測點會移動取樣切片。",
    plates:"銅色板接較高電位。把銀色測點沿板面拖動，再試著從一塊板移向另一塊。",
    sphere:"拖曳銀色測點從導體球內移到球外，比較電位與電場。",
    particle:"亮線是粒子已走過的路徑。播放後，試著改變入射角和電荷正負。",
    wire:"改變銅導線的方向，再開啟分析標註查看磁力。",
    parallel:"反轉其中一條導線的電流，在讀值區比較互吸與互斥。",
    motor:"銅線圈繞鋼軸轉動。開啟換向器，比較轉過半圈前後的力矩。",
    slide:"銅棒沿兩條導軌滑動。播放並比較閉合和開路時的電流。",
    enter:"淡藍色區域標出有磁場的範圍。播放觀察線圈進入、停留在場內和離開。",
    magnet:"紅色端是 N 極，藍色端是 S 極。播放觀察磁棒穿過銅線圈。",
    rotate:"銅線圈繞鋼軸轉動。暫停在不同角度，對照磁通量與感應電動勢。",
    vary:"銅線圈固定在原位。底色深淺表示外加磁場強弱，藍色與紫色分別代表正向和反向。",
    transformer:"深銅色為原線圈，淺金色為副線圈。兩組繞線共用鋼製鐵芯。",
    linear:"兩段漂移管之間是加速間隙。質子通過間隙時變成暖色，對照動能讀值。",
    cyclotron:"質子每次穿過中央間隙，就進入半徑更大的半圓。亮線表示已走過的路徑。",
    aurora:"播放追蹤電子。到達高層大氣時會顯示極光幕，磁鏡折返時則可看到電子沿原路返回。",
    "plane-wave":"綠色曲線表示電場，藍色曲線表示磁場。播放觀察波往前傳播。"
  };
  const url=(bench,mode)=>"#labs/"+bench.id+(mode?"/"+mode:"");
  const shortcuts={
    "biot/element":[["平行", {x:16,y:0,z:0,theta:90,phi:0}],["垂直",{x:0,y:16,z:0,theta:90,phi:0}],["離開 xy 平面",{x:5,y:12,z:8,theta:90,phi:0}]],
    "biot/pair":[["回兩線中點",{x:0,y:0,z:0}],["移出平面",{x:0,y:0,z:8}]],
    "biot/loop":[["圓心",{x:0,y:0,z:0}],["軸上 10 cm",{x:0,y:0,z:10}],["離軸",{x:8,y:6,z:10}]],
    "biot/solenoid":[["管中心",{x:0,y:0,z:0}],["管外",{x:18,y:0,z:0}]],
    "potential-map/charges":[["等量異號中點",{q:6,q2:-6,x:0,y:0,z:0}],["等量同號中點",{q:6,q2:6,x:0,y:0,z:0}]],
    "magnetic-force/particle":[["平行：直線",{theta:0}],["垂直：圓周",{theta:90}],["斜入射：螺旋",{theta:65}]],
    "magnetic-force/motor":[["0°",{theta:0}],["90°",{theta:90}],["180°",{theta:180}],["270°",{theta:270}]],
    "particle-apps/aurora":[["小夾角：進入大氣",{pitch:0,phase:100}],["大夾角：磁鏡折返",{pitch:55,phase:55}]],
    "induction/enter":[["進入",{phase:18}],["全在場內",{phase:50}],["離開",{phase:82}]],
    "induction/magnet":[["接近",{phase:38}],["線圈中央",{phase:50}],["離開",{phase:62}]],
    "induction/rotate":[["初始",{phase:0,cycles:1}],["四分之一圈",{phase:25,cycles:1}]],
    "induction/vary":[["變化前",{phase:10}],["變化中",{phase:50}],["變化後",{phase:90}]]
  };
  EM.mountWorkbench=(root,bench,id)=>{
    const mode=bench.modes.find(m=>m.id===id)||bench.modes[0], key=bench.id+"/"+mode.id;
    const defaults=Object.fromEntries(mode.controls.map(c=>[c.key,c.value]));
    const defaultCamera=mode.camera||bench.camera;
    const theme=mode.id==="aurora"?"space":beamModes.has(mode.id)?"beam":"lab";
    const saved=memory.get(key)||{p:{...defaults},camera:{...defaultCamera},state:{},
      view:{dimension:"3d",plane:defaultPlanes[key]||"xy",grid:false,labels:false}};
    memory.set(key,saved);
    const {p,camera,state,view}=saved, canRecord=bench.id==="potential-map"&&mode.id!=="field-lines";
    const pointAxes=["x","y","z"];
    const pointControls=pointAxes.map(axis=>mode.controls.find(control=>control.key===axis));
    const hasProbe=pointControls.every(Boolean);
    const playKey=mode.animate?(mode.id==="motor"?"theta":"phase"):null;
    const scenes=shortcuts[key]||[];
    root.innerHTML=`<div class="shell page bench-page">
      <div class="page-head"><a class="eyebrow bench-index-link" href="#labs">電磁實驗室・${bench.sections.join("、")}</a><h1>${bench.title}</h1><p>${bench.description}</p></div>
      <nav class="bench-modes" aria-label="實驗情境">${bench.modes.map(m=>`<a href="${url(bench,m.id)}" class="button ${m===mode?"primary":""}" ${m===mode?'aria-current="page"':""}>${m.title}</a>`).join("")}</nav>
      ${bench.modes.length>1?`<label class="control bench-mode-select"><span>實驗情境</span><select>${bench.modes.map(m=>`<option value="${m.id}" ${m===mode?"selected":""}>${m.title}</option>`).join("")}</select></label>`:""}
      <div class="lab-shell bench-shell">
       <div class="bench-layout">
        <div class="bench-visual">
          <div class="bench-view-controls">
            <div class="action-row" role="group" aria-label="顯示模式">
              <button class="button" data-dimension="2d" type="button" aria-pressed="false">2D 平面</button>
              <button class="button" data-dimension="3d" type="button" aria-pressed="true">3D 空間</button>
            </div>
            <div class="action-row" id="bench-planes" role="group" aria-label="選擇 2D 平面" hidden>
              <button class="button" data-plane="xy" type="button" aria-pressed="false">XY</button>
              <button class="button" data-plane="xz" type="button" aria-pressed="false">XZ</button>
              <button class="button" data-plane="yz" type="button" aria-pressed="false">YZ</button>
            </div>
            ${playKey?'<button type="button" id="bench-play" class="button primary" aria-pressed="false">播放</button>':""}
          </div>
          <div id="bench-plot" class="bench-plot" tabindex="0" role="group" aria-label="三維視窗。拖曳或用方向鍵旋轉；也可用下方滑桿。"></div>
          <p class="bench-scene-caption">${sceneCaptions[mode.id]}</p>
          <p class="small muted bench-view-hint" id="bench-plane-hint" hidden></p>
          <div class="bench-display-options">
            <label><input type="checkbox" data-overlay="grid" ${view.grid?"checked":""}> 座標網格</label>
            <label><input type="checkbox" data-overlay="labels" ${view.labels?"checked":""}> 分析標註</label>
          </div>
          <div class="bench-camera" aria-label="三維視角">
            <span>拖曳旋轉</span>
            <div class="action-row"><button class="button" data-camera="xy" type="button">俯視 XY</button><button class="button" data-camera="xz" type="button">側視 XZ</button><button class="button" data-camera="default" type="button">預設視角</button></div>
          </div>
          <details class="bench-camera-settings"><summary>精調視角與縮放</summary><div class="bench-inputs">
            ${[["yaw","水平旋轉",-180,180,1],["pitch","俯仰角",-85,90,1],["zoom","縮放",.6,1.6,.05]].map(([k,label,min,max,step])=>`<label class="control"><span>${label}</span><input type="range" data-view="${k}" min="${min}" max="${max}" step="${step}" value="${camera[k]}"></label>`).join("")}
          </div></details>
          <ul class="bench-legend" aria-label="圖例"></ul>
        </div>
        <div class="bench-side">
          <section class="bench-panel bench-measurements">
            <h2>即時讀值</h2>
            <dl class="readouts bench-readouts" id="bench-readouts"></dl>
          </section>
          <section class="bench-panel">
        <h2 class="bench-controls-title">調整實驗參數</h2>
        <div class="bench-inputs">${mode.controls.map(c=>`<label class="control" for="bench-${c.key}">
          <span class="control-line"><span>${c.label}</span>${c.choices?"":`<output id="bench-out-${c.key}" for="bench-${c.key}"></output>`}</span>
          ${c.choices?`<select data-param="${c.key}" id="bench-${c.key}">${c.choices.map(([v,label])=>`<option value="${v}">${label}</option>`).join("")}</select>`:
          `<input type="range" id="bench-${c.key}" data-param="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}">`}
        </label>`).join("")}</div>
        <div class="action-row bench-actions">
          ${canRecord?'<button type="button" id="bench-record" class="button primary">記錄 P 為起點 A</button><button type="button" id="bench-clear" class="button">清除 A</button>':""}
          <button type="button" class="button" id="bench-reset">恢復實驗初始值</button>
          ${scenes.map(([name],i)=>`<button type="button" class="button" data-preset="${i}">${name}</button>`).join("")}
        </div>
          </section>
          <details class="bench-panel bench-guide"><summary>觀察提示與模型</summary>
            <p>${mode.task}</p>
            ${bench.formula&&mode.id==="element"?`<p class="formula bench-equation">${bench.formula}</p>`:""}
        <p class="bench-note" id="bench-note"></p>
          </details>
        </div>
       </div>
        <p class="small muted" id="bench-notice" role="status"></p>
        <section class="bench-graphs" hidden><h2>同步讀圖</h2>${playKey?'<p class="small muted">可點圖移動游標，也可用上方滑桿。</p>':""}<div id="bench-graph" ${playKey?'data-scrub="true"':""}></div></section>
      </div>
      <div class="tool-shortcuts"><a href="#labs">← 其他實驗</a>${bench.sections.map(s=>`<a href="#course/${s}">回到 ${s} 導讀</a>`).join("")}</div>
    </div>`;
    const find=sel=>root.querySelector(sel), plot=find("#bench-plot"), graph=find("#bench-graph"), readouts=find("#bench-readouts"), play=find("#bench-play");
    const pControls=[...root.querySelectorAll("[data-param]")], viewControls=[...root.querySelectorAll("[data-view]")];
    find(".bench-mode-select select")?.addEventListener("change",e=>{location.hash=url(bench,e.target.value);});
    let frame=0, loop=0, mouse=null, last=0;
    function updateView(){
      const flat=view.dimension==="2d";
      plot.dataset.dimension=view.dimension;
      plot.tabIndex=flat?-1:0;
      plot.setAttribute("aria-label",flat?view.plane.toUpperCase()+" 平面視窗":"三維視窗。拖曳或用方向鍵旋轉。");
      find("#bench-planes").hidden=!flat;
      find(".bench-camera").hidden=flat;
      find(".bench-camera-settings").hidden=flat;
      for(const button of root.querySelectorAll("[data-dimension],[data-plane]")){
        const active=button.dataset.dimension===view.dimension||button.dataset.plane===view.plane;
        button.setAttribute("aria-pressed",String(active));
        button.classList.toggle("primary",active);
      }
    }
    function controls(){
      for(const el of pControls){
        const k=el.dataset.param, c=mode.controls.find(c=>c.key===k);
        el.value=p[k];
        if(el.type==="range"){
          const display=p[k]+(c.unit&&c.unit!=="°"&&c.unit!=="%"?" ":"")+c.unit;
          find("#bench-out-"+k).textContent=display;
          el.setAttribute("aria-valuetext",display);
        }
      }
      for(const el of viewControls)el.value=camera[el.dataset.view];
    }
    function draw(){
      controls();
      const flat=view.dimension==="2d";
      const overlay={theme,grid:view.grid,labels:view.labels,analysis:view.labels,axes:view.grid||view.labels};
      const projection=view.dimension==="2d"?{...overlay,plane:view.plane,zoom:1}:{...camera,...overlay};
      const r=bench.draw(mode.id,p,projection,state);
      plot.innerHTML=r.diagram;
      readouts.innerHTML=r.rows.map(([k,label,value])=>`<div><dt>${label}</dt><dd data-reading="${k}">${value}</dd></div>`).join("");
      const legend=find(".bench-legend");
      legend.hidden=!view.labels&&mode.id!=="field-lines";
      legend.innerHTML=r.legend.map(([c,name])=>`<li><span aria-hidden="true" style="--swatch:${c}"></span><span>${name}</span></li>`).join("");
      const hint=find("#bench-plane-hint");
      hint.hidden=!flat||!plot.querySelector("[data-normal]");
      hint.textContent="⊙ 朝向觀察者・⊗ 背離觀察者";
      find("#bench-note").textContent=r.note;
      if(r.graph!==graph.innerHTML)graph.innerHTML=r.graph;
      graph.parentElement.hidden=!r.graph;
    }
    function queue(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
    function stop(){
      if(loop)cancelAnimationFrame(loop);loop=0;last=0;
      if(play){play.setAttribute("aria-pressed","false");play.textContent="播放";}
    }
    if(play)play.addEventListener("click",()=>{
      if(loop){stop();return;}
      play.setAttribute("aria-pressed","true");play.textContent="暫停";
      const max=playKey==="theta"?360:100;
      if(mode.id==="aurora"&&p[playKey]===max){p[playKey]=0;queue();}
      const tick=t=>{
        const interval=mode.id==="aurora"&&p[playKey]===max?850:46;
        if(!last||t-last>=interval){p[playKey]=(p[playKey]+(max===360?3:1))%(max+1);last=t;queue();}
        loop=requestAnimationFrame(tick);
      };
      loop=requestAnimationFrame(tick);
    });
    find(".bench-inputs:has([data-param])").addEventListener("input",e=>{
      const k=e.target.dataset.param;if(!k)return;
      if(k===playKey)stop();p[k]=+e.target.value;queue();
    });
    find(".bench-camera-settings").addEventListener("input",e=>{
      const k=e.target.dataset.view;if(k){camera[k]=+e.target.value;queue();}
    });
    find(".bench-display-options").addEventListener("change",e=>{
      const overlay=e.target.dataset.overlay;
      if(!overlay)return;
      view[overlay]=e.target.checked;
      queue();
    });
    find(".bench-camera").addEventListener("click",e=>{
      const mode=e.target.closest("[data-camera]")?.dataset.camera;
      if(!mode)return;
      Object.assign(camera,mode==="xy"?{yaw:0,pitch:90,zoom:1}:mode==="xz"?{yaw:0,pitch:0,zoom:1}:defaultCamera);
      queue();
    });
    find(".bench-view-controls").addEventListener("click",e=>{
      const button=e.target.closest("button");
      if(!button)return;
      if(button.dataset.dimension)view.dimension=button.dataset.dimension;
      if(button.dataset.plane)view.plane=button.dataset.plane;
      updateView();
      queue();
    });
    function turn(dx,dy){
      camera.yaw=((camera.yaw+dx+540)%360)-180;
      camera.pitch=clamp(camera.pitch+dy,-85,90);
      queue();
    }
    plot.addEventListener("pointerdown",e=>{
      if(e.button!==0||mouse)return;
      const handle=hasProbe&&e.target.closest("[data-probe]");
      if(!handle&&view.dimension!=="3d")return;
      mouse={id:e.pointerId,x:e.clientX,y:e.clientY};
      if(handle){
        const svg=handle.ownerSVGElement, {right,up,scale}=svg.dataset;
        mouse.probe={
          start:pointAxes.map(axis=>p[axis]),right:right.split(",").map(Number),up:up.split(",").map(Number),
          pixelsPerCm:Number(scale)*svg.getScreenCTM().a
        };
      }
      plot.setPointerCapture(e.pointerId);
    });
    plot.addEventListener("pointermove",e=>{
      if(mouse?.id!==e.pointerId)return;
      if(mouse.probe){
        const {start,right,up,pixelsPerCm}=mouse.probe;
        const dx=(e.clientX-mouse.x)/pixelsPerCm, dy=(mouse.y-e.clientY)/pixelsPerCm;
        for(const [i,control] of pointControls.entries()){
          const value=start[i]+right[i]*dx+up[i]*dy;
          p[control.key]=clamp(Math.round(value/control.step)*control.step,control.min,control.max);
        }
        queue();
        return;
      }
      turn(Math.round((e.clientX-mouse.x)*.7),Math.round((e.clientY-mouse.y)*.7));
      mouse={id:e.pointerId,x:e.clientX,y:e.clientY};
    });
    for(const event of ["pointerup","pointercancel","lostpointercapture"])plot.addEventListener(event,e=>{if(mouse?.id===e.pointerId)mouse=null;});
    plot.addEventListener("keydown",e=>{
      const step={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,5],ArrowDown:[0,-5]}[e.key];
      if(step&&view.dimension==="3d"){e.preventDefault();turn(...step);}
    });
    if(playKey)graph.addEventListener("click",e=>{
      const svg=graph.querySelector("svg"), box=svg.getBoundingClientRect(), x=(e.clientX-box.left)/box.width;
      const start=+svg.dataset.start,end=+svg.dataset.end;
      p[playKey]=Math.round(clamp((x-start)/(end-start),0,1)*(playKey==="theta"?360:100));stop();queue();
    });
    find(".bench-actions").addEventListener("click",e=>{
      const b=e.target.closest("button");if(!b)return;
      const notice=find("#bench-notice");
      if(b.id==="bench-reset"){
        stop();Object.assign(p,defaults);Object.assign(camera,defaultCamera);delete state.a;notice.textContent="已恢復初始值。";queue();
      }else if(b.dataset.preset!==undefined){
        stop();Object.assign(p,scenes[+b.dataset.preset][1]);notice.textContent="已套用："+scenes[+b.dataset.preset][0];queue();
      }else if(b.id==="bench-record"){
        const point=[p.x,p.y,p.z];
        if(!EMPhysics.electro(mode.id,p,point)){notice.textContent="P 太靠近點電荷，無法記錄。";return;}
        state.a=point;notice.textContent="已記錄 A = ("+point.join(", ")+") cm。移動 P 可比較兩點。";queue();
      }else if(b.id==="bench-clear"){
        delete state.a;notice.textContent="已清除起點 A。";queue();
      }
    });
    updateView();
    draw();
    return ()=>{stop();if(frame)cancelAnimationFrame(frame);};
  };
})();
