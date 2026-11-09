(() => {
  const {clamp}=EMPhysics;
  const memory=new Map();
  const url=(bench,mode)=>"#labs/"+bench.id+(mode?"/"+mode:"");
  const shortcuts={
    "biot/element":[["平行", {x:16,y:0,z:0,theta:90,phi:0}],["垂直",{x:0,y:16,z:0,theta:90,phi:0}],["離開 xy 平面",{x:5,y:12,z:8,theta:90,phi:0}]],
    "biot/pair":[["回兩線中點",{x:0,y:0,z:0}],["移出平面",{x:0,y:0,z:8}]],
    "biot/loop":[["圓心",{x:0,y:0,z:0}],["軸上 10 cm",{x:0,y:0,z:10}],["離軸",{x:8,y:6,z:10}]],
    "biot/solenoid":[["管中心",{x:0,y:0,z:0}],["管外",{x:18,y:0,z:0}]],
    "potential-map/charges":[["等量異號中點",{q:6,q2:-6,x:0,y:0,z:0}],["等量同號中點",{q:6,q2:6,x:0,y:0,z:0}]],
    "magnetic-force/particle":[["平行：直線",{theta:0}],["垂直：圓周",{theta:90}],["斜入射：螺旋",{theta:65}]],
    "magnetic-force/motor":[["0°",{theta:0}],["90°",{theta:90}],["180°",{theta:180}],["270°",{theta:270}]],
    "induction/enter":[["進入",{phase:18}],["全在場內",{phase:50}],["離開",{phase:82}]],
    "induction/magnet":[["接近",{phase:38}],["線圈中央",{phase:50}],["離開",{phase:62}]],
    "induction/rotate":[["初始",{phase:0,cycles:1}],["四分之一圈",{phase:25,cycles:1}]],
    "induction/vary":[["變化前",{phase:10}],["變化中",{phase:50}],["變化後",{phase:90}]]
  };
  EM.mountWorkbench=(root,bench,id)=>{
    const mode=bench.modes.find(m=>m.id===id)||bench.modes[0], key=bench.id+"/"+mode.id;
    const defaults=Object.fromEntries(mode.controls.map(c=>[c.key,c.value]));
    const saved=memory.get(key)||{p:{...defaults},camera:{...bench.camera},state:{}};
    memory.set(key,saved);
    const {p,camera,state}=saved, canRecord=bench.id==="potential-map";
    const playKey=mode.animate?(mode.id==="motor"?"theta":"phase"):null;
    const scenes=shortcuts[key]||[];
    root.innerHTML=`<div class="shell page bench-page">
      <div class="breadcrumbs"><a href="#labs">電磁實驗室</a><span>/</span><span>進階工作臺</span></div>
      <div class="page-head"><p class="eyebrow">進階工作臺・${bench.sections.join("、")}</p><h1>${bench.title}</h1><p>${bench.description}</p></div>
      <nav class="bench-modes" aria-label="實驗情境">${bench.modes.map(m=>`<a href="${url(bench,m.id)}" class="button ${m===mode?"primary":""}" ${m===mode?'aria-current="page"':""}>${m.title}</a>`).join("")}</nav>
      <div class="lab-observation"><strong>帶著一個問題看</strong><p>${mode.task}</p></div>
      <div class="lab-shell bench-shell">
        <div class="bench-visual">
          <div id="bench-plot" class="bench-plot" tabindex="0" role="group" aria-label="三維視窗。拖曳或用方向鍵旋轉；也可用下方滑桿。"></div>
          <div class="bench-camera" aria-label="三維視角">
            <span>拖曳旋轉・⊙ 出畫面／⊗ 入畫面</span>
            <div class="action-row"><button class="button" data-camera="xy" type="button">俯視 XY</button><button class="button" data-camera="xz" type="button">側視 XZ</button><button class="button" data-camera="default" type="button">預設視角</button></div>
          </div>
          <details class="bench-camera-settings"><summary>精調視角與縮放</summary><div class="bench-inputs">
            ${[["yaw","水平旋轉",-180,180,1],["pitch","俯仰角",-85,90,1],["zoom","縮放",.6,1.6,.05]].map(([k,label,min,max,step])=>`<label class="control"><span>${label}</span><input type="range" data-view="${k}" min="${min}" max="${max}" step="${step}" value="${camera[k]}"></label>`).join("")}
          </div></details>
          <ul class="bench-legend" aria-label="圖例"></ul>
        </div>
        <h2 class="bench-controls-title">調整實驗參數</h2>
        <div class="bench-inputs">${mode.controls.map(c=>`<label class="control" for="bench-${c.key}">
          <span class="control-line"><span>${c.label}</span>${c.choices?"":`<output id="bench-out-${c.key}" for="bench-${c.key}"></output>`}</span>
          ${c.choices?`<select data-param="${c.key}" id="bench-${c.key}">${c.choices.map(([v,label])=>`<option value="${v}">${label}</option>`).join("")}</select>`:
          `<input type="range" id="bench-${c.key}" data-param="${c.key}" min="${c.min}" max="${c.max}" step="${c.step}">`}
        </label>`).join("")}</div>
        <div class="action-row bench-actions">
          ${playKey?'<button type="button" id="bench-play" class="button primary" aria-pressed="false">播放</button>':""}
          ${canRecord?'<button type="button" id="bench-record" class="button primary">記錄 P 為起點 A</button><button type="button" id="bench-clear" class="button">清除 A</button>':""}
          <button type="button" class="button" id="bench-reset">恢復實驗初始值</button>
          ${scenes.map(([name],i)=>`<button type="button" class="button" data-preset="${i}">${name}</button>`).join("")}
        </div>
        <dl class="readouts bench-readouts" id="bench-readouts"></dl>
        <p class="bench-note" id="bench-note"></p>
        <p class="small muted" id="bench-notice" role="status"></p>
        <section class="bench-graphs" hidden><h2>同步讀圖</h2>${playKey?'<p class="small muted">可點圖移動游標，也可用上方滑桿。</p>':""}<div id="bench-graph" ${playKey?'data-scrub="true"':""}></div></section>
      </div>
      <div class="tool-shortcuts"><a href="#labs">← 其他實驗</a>${bench.sections.map(s=>`<a href="#course/${s}">回到 ${s} 導讀</a>`).join("")}</div>
    </div>`;
    const find=sel=>root.querySelector(sel), plot=find("#bench-plot"), graph=find("#bench-graph"), readouts=find("#bench-readouts"), play=find("#bench-play");
    const pControls=[...root.querySelectorAll("[data-param]")], viewControls=[...root.querySelectorAll("[data-view]")];
    let frame=0, loop=0, mouse=null, last=0;
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
      const r=bench.draw(mode.id,p,camera,state);
      plot.innerHTML=r.diagram;
      readouts.innerHTML=r.rows.map(([k,label,value])=>`<div><dt>${label}</dt><dd data-reading="${k}">${value}</dd></div>`).join("");
      find(".bench-legend").innerHTML=r.legend.map(([c,name])=>`<li><span aria-hidden="true" style="--swatch:${c}"></span><span>${name}</span></li>`).join("");
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
      const tick=t=>{
        if(!last||t-last>=46){p[playKey]=(p[playKey]+(max===360?3:1))%(max+1);last=t;queue();}
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
    find(".bench-camera").addEventListener("click",e=>{
      const mode=e.target.closest("[data-camera]")?.dataset.camera;
      if(!mode)return;
      Object.assign(camera,mode==="xy"?{yaw:0,pitch:90,zoom:1}:mode==="xz"?{yaw:0,pitch:0,zoom:1}:bench.camera);
      queue();
    });
    function turn(dx,dy){
      camera.yaw=((camera.yaw+dx+540)%360)-180;
      camera.pitch=clamp(camera.pitch+dy,-85,90);
      queue();
    }
    plot.addEventListener("pointerdown",e=>{
      if(e.button!==0||mouse)return;
      mouse={id:e.pointerId,x:e.clientX,y:e.clientY};plot.setPointerCapture(e.pointerId);
    });
    plot.addEventListener("pointermove",e=>{
      if(mouse?.id!==e.pointerId)return;
      turn(Math.round((e.clientX-mouse.x)*.7),Math.round((e.clientY-mouse.y)*.7));
      mouse={id:e.pointerId,x:e.clientX,y:e.clientY};
    });
    for(const event of ["pointerup","pointercancel","lostpointercapture"])plot.addEventListener(event,e=>{if(mouse?.id===e.pointerId)mouse=null;});
    plot.addEventListener("keydown",e=>{
      const step={ArrowLeft:[-5,0],ArrowRight:[5,0],ArrowUp:[0,5],ArrowDown:[0,-5]}[e.key];
      if(step){e.preventDefault();turn(...step);}
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
        stop();Object.assign(p,defaults);Object.assign(camera,bench.camera);delete state.a;notice.textContent="已恢復初始值。";queue();
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
    draw();
    return ()=>{stop();if(frame)cancelAnimationFrame(frame);};
  };
})();
