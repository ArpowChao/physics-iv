(() => {
  const {clamp}=EMPhysics;
  const memory=new Map();
  const defaultPlanes={"particle-apps/aurora":"xz","particle-apps/linear":"xz","magnetic-force/particle":"xz","magnetic-force/motor":"yz",
    "induction/magnet":"xz","induction/rotate":"yz","induction/transformer":"xz"};
  const beamModes=new Set(["particle","linear","cyclotron","plane-wave"]);
  const electroViewLabels={lines:"電力線",surface:"3D 電位地形",contours:"等電位線",profile:"沿軸剖面圖"};
  const sceneCaptions={
    element:"銅線上的金色短節是選取的電流元。拖曳十字測點 P，改變量測位置。",
    straight:"金色短節標出目前選取的電流元。拖曳十字測點 P，看看磁場讀值怎麼變。",
    compass:"紅色針尖指北。反轉電流，觀察磁針往哪一側偏。",
    pair:"金色短節標出選取的電流元。把十字測點 P 拖到兩線之間，比較磁場。",
    loop:"拖曳十字測點 P，從線圈中心移到軸上和線圈外。",
    solenoid:"旋轉銅線圈，或把十字測點 P 拖出管口，比較磁場讀值。",
    "field-lines":"紅、藍球分別代表正、負電荷。曲線表示電場走向，十字準星是可拖曳的測點 P。",
    charges:"曲線連接電位相同的位置。拖曳十字測點 P 會移動取樣切片。",
    plates:"銅色正板在 x 較小的一側，鋼色負板為 0 V。圖中只畫出理想無限大平行板的一部分。",
    sphere:"淡色區域是導體球的剖面。拖曳測點從球內移到球外，比較電位與電場。",
    cavity:"藍色環形區是接地金屬，中央是空腔。內外電場各自受導體表面電荷影響。",
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
    linear:"質子在間隙加速，在管內等速。後段漂移管隨速率加長，使質子保持與射頻電場同步。",
    cyclotron:"質子每次穿過中央間隙，就進入半徑更大的半圓。亮線表示已走過的路徑。",
    aurora:"虛線是選取的磁力線。可切換單顆電子與電子群，勾選分析標註可拉遠看完整磁力線。",
    "plane-wave":"綠色曲線表示電場，藍色曲線表示磁場。播放觀察波往前傳播。"
  };
  const url=(bench,mode)=>"#labs/"+bench.id+(mode?"/"+mode:"");
  const shortcuts={
    "biot/element":[["平行", {x:16,y:0,z:0,theta:90,phi:0}],["垂直",{x:0,y:16,z:0,theta:90,phi:0}],["離開 xy 平面",{x:5,y:12,z:8,theta:90,phi:0}]],
    "biot/pair":[["回兩線中點",{x:0,y:0,z:0}],["移出平面",{x:0,y:0,z:8}]],
    "biot/loop":[["圓心",{x:0,y:0,z:0}],["軸上 10 cm",{x:0,y:0,z:10}],["離軸",{x:8,y:6,z:10}]],
    "biot/solenoid":[["管中心",{x:0,y:0,z:0}],["管外",{x:18,y:0,z:0}]],
    "potential-map/charges":[["等量異號中點",{q:6,q2:-6,x:0,y:0,z:0}],["等量同號中點",{q:6,q2:6,x:0,y:0,z:0}]],
    "potential-map/field-lines":[["+5 nC／−1 nC",{q:5,q2:-1}],["等量同號",{q:6,q2:6}],["等量異號",{q:6,q2:-6}],["單一正電荷",{q:6,q2:0}]],
    "magnetic-force/particle":[["平行：直線",{theta:0}],["垂直：圓周",{theta:90}],["斜入射：螺旋",{theta:65}]],
    "magnetic-force/motor":[["0°",{theta:0}],["90°",{theta:90}],["180°",{theta:180}],["270°",{theta:270}]],
    "particle-apps/aurora":[["小夾角：到達參考面",{pitch:0,phase:100,emission:0}],["大夾角：磁鏡折返",{pitch:55,phase:60,emission:0}],["電子群沉降",{pitch:0,phase:100,emission:1}]],
    "induction/enter":[["進入",{phase:18}],["全在場內",{phase:50}],["離開",{phase:82}]],
    "induction/magnet":[["接近",{phase:38}],["線圈中央",{phase:50}],["離開",{phase:62}]],
    "induction/rotate":[["初始",{phase:0,cycles:1}],["四分之一圈",{phase:25,cycles:1}]],
    "induction/vary":[["變化前",{phase:10}],["變化中",{phase:50}],["變化後",{phase:90}]]
  };
  EM.mountWorkbench=(root,bench,id)=>{
    const mode=bench.modes.find(m=>m.id===id)||bench.modes[0], key=bench.id+"/"+mode.id;
    const defaults=Object.fromEntries(mode.controls.map(c=>[c.key,c.value]));
    const lesson=EM.workbenchLessons[mode.id], [variable,...conditions]=lesson.variable;
    const cases=conditions.map(value=>({...defaults,...lesson.setup,[variable]:value}));
    const defaultCamera=mode.camera||bench.camera, electroViews=mode.electroViews;
    const hasPair=mode.id==="field-lines"||mode.id==="charges";
    const theme=mode.id==="aurora"?"space":beamModes.has(mode.id)?"beam":"lab";
    const saved=memory.get(key)||{p:{...defaults},camera:{...defaultCamera},state:{},
      view:{dimension:lesson.plane?"2d":"3d",plane:lesson.plane||defaultPlanes[key]||"xy",grid:false,labels:false,
        electroDisplay:electroViews?.[0],electroRange:"near",electroDepth:"depth",electroDensity:EMPhysics.defaultLineDensity},
      activity:{free:false,caseIndex:0,prediction:null,explained:false,evidence:[null,null]}};
    memory.set(key,saved);
    const {camera,view,activity}=saved, canRecord=bench.id==="potential-map"&&mode.id!=="field-lines";
    let p=activity.free?saved.p:{...cases[activity.caseIndex]};
    const pointAxes=["x","y","z"];
    const pointControls=pointAxes.map(axis=>mode.controls.find(control=>control.key===axis));
    const hasProbe=pointControls.every(Boolean);
    const playKey=mode.animate?(mode.id==="motor"?"theta":"phase"):null;
    const scenes=shortcuts[key]||[];
    root.innerHTML=`<div class="shell page bench-page">
      <div class="page-head"><a class="eyebrow bench-index-link" href="#labs">電磁實驗室・${bench.sections.join("、")}</a><h1>${bench.title}</h1></div>
      <div class="bench-topbar">
        <nav class="bench-modes" aria-label="實驗情境">${bench.modes.map(m=>`<a href="${url(bench,m.id)}" class="button ${m===mode?"primary":""}" ${m===mode?'aria-current="page"':""}>${m.title}</a>`).join("")}</nav>
        ${bench.modes.length>1?`<label class="control bench-mode-select"><span>實驗情境</span><select>${bench.modes.map(m=>`<option value="${m.id}" ${m===mode?"selected":""}>${m.title}</option>`).join("")}</select></label>`:""}
        <div class="bench-activity-switch" role="group" aria-label="實驗方式">
          <button type="button" class="button" data-activity="guided" aria-pressed="true">引導觀察</button>
          <button type="button" class="button" data-activity="free" aria-pressed="false">自由探索</button>
        </div>
      </div>
      <div class="lab-shell bench-shell">
       <div class="bench-layout" data-activity-layout>
        <section class="bench-prediction bench-panel" aria-labelledby="bench-question">
          <p class="bench-step">01　先預測</p>
          <h2 id="bench-question">${lesson.question}</h2>
          <p class="bench-fixed">${lesson.fixed}</p>
          <fieldset class="bench-choices">
            <legend class="bench-visually-hidden">記下你的預測</legend>
            ${lesson.choices.map((choice,i)=>`<label><input type="radio" name="bench-prediction" value="${i}" ${activity.prediction===i?"checked":""}><span>${choice}</span></label>`).join("")}
          </fieldset>
        </section>
        <div class="bench-visual">
          <div class="bench-stage-head">
            <p class="bench-step bench-case-title">02　切換案例</p>
            ${playKey?'<button type="button" id="bench-play" class="button primary" aria-pressed="false">播放</button>':""}
          </div>
          <section class="bench-comparison" aria-label="比較 A 與 B">
            <div class="bench-cases" role="group" aria-label="比較案例">
              ${lesson.cases.map((label,i)=>`<button type="button" class="button" data-case="${i}" aria-pressed="false"><span class="bench-case-letter">${i===0?"A":"B"}</span><span>${label}</span></button>`).join("")}
            </div>
            <p class="bench-preview" hidden>動態預覽中。停止後會回到目前案例。</p>
          </section>
          ${electroViews?`<div class="bench-electro-tools">
            <div class="action-row bench-electro-tabs" role="group" aria-label="靜電圖面">${[...electroViews,"profile"].map(id=>
              `<button type="button" class="button" data-electro-display="${id}" aria-pressed="false">${electroViewLabels[id]}</button>`).join("")}</div>
            <div class="action-row" role="group" aria-label="觀察範圍">
              <button type="button" class="button" data-electro-range="near" aria-pressed="true">近場</button>
              <button type="button" class="button" data-electro-range="far" aria-pressed="false">遠場</button>
            </div>
            ${hasPair?'<button type="button" class="button bench-linked-only" aria-pressed="false">只看相連線</button>':""}
            <label class="bench-density" hidden><span>線條密度</span><select>
              ${[1,2,3,4,5,6].map(n=>`<option value="${n}">${n} 條／nC</option>`).join("")}
            </select></label>
            <label class="bench-depth" hidden><span>3D 景深</span><select>
              <option value="depth">前後分層</option><option value="front">只看前側</option><option value="section">單一參考切面</option>
            </select></label>
            <button type="button" class="button bench-face-view" hidden>正視切面數線</button>
          </div>`:""}
          <p class="bench-scene-caption">${sceneCaptions[mode.id]}</p>
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
          </div>
          <div id="bench-plot" class="bench-plot" tabindex="0" role="group" aria-label="三維視窗。拖曳或用方向鍵旋轉；也可用下方滑桿。"></div>
          ${electroViews?'<dl class="bench-electro-facts" aria-label="電力線與零點讀值" hidden></dl>':""}
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
        <section class="bench-evidence bench-panel" aria-labelledby="bench-evidence-title">
          <p class="bench-step">03　用證據解釋</p>
          <h2 id="bench-evidence-title">把 A 和 B 放在一起看</h2>
          <div class="bench-evidence-data"></div>
          <p class="bench-evidence-status" role="status"></p>
          <details class="bench-explanation" ${activity.explained?"open":""} hidden>
            <summary>查看參考解釋</summary>
            <p>${lesson.explain}</p>
          </details>
        </section>
        <div class="bench-side" hidden>
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
        <details class="bench-graphs" hidden><summary>查看同步圖表</summary>
          ${playKey?'<p class="small muted bench-graph-help">自由探索時可點圖移動游標，也可用上方滑桿。</p>':""}<div id="bench-graph"></div></details>
      </div>
      <div class="tool-shortcuts"><a href="#labs">← 其他實驗</a>${bench.sections.map(s=>`<a href="#course/${s}">回到 ${s} 導讀</a>`).join("")}</div>
    </div>`;
    const find=sel=>root.querySelector(sel), plot=find("#bench-plot"), graph=find("#bench-graph"), readouts=find("#bench-readouts"), play=find("#bench-play");
    const layout=find(".bench-layout"), evidenceData=find(".bench-evidence-data"), evidenceStatus=find(".bench-evidence-status");
    const explanation=find(".bench-explanation"), previewNotice=find(".bench-preview");
    const electroTools=find(".bench-electro-tools"), electroFacts=find(".bench-electro-facts");
    const electroRange=()=>view.electroDisplay==="profile"?view.electroProfileRange:view.electroRange;
    const pControls=[...root.querySelectorAll("[data-param]")], viewControls=[...root.querySelectorAll("[data-view]")];
    find(".bench-mode-select select")?.addEventListener("change",e=>{location.hash=url(bench,e.target.value);});
    let frame=0, loop=0, mouse=null, last=0, preview=false;
    function updateActivity(){
      const {free}=activity;
      layout.dataset.activityLayout=free?"free":"guided";
      for(const selector of [".bench-prediction",".bench-comparison",".bench-evidence"])find(selector).hidden=free;
      find(".bench-case-title").hidden=free;
      find(".bench-stage-head").hidden=free&&!play;
      find(".bench-side").hidden=!free;
      const viewControlsPanel=find(".bench-view-controls");
      if(free)plot.before(viewControlsPanel);
      else plot.after(viewControlsPanel);
      graph.parentElement.open=free;
      if(play){
        play.textContent=free?"播放":"播放預覽";
        if(free)graph.dataset.scrub="true";
        else delete graph.dataset.scrub;
        find(".bench-graph-help").hidden=!free;
      }
      plot.dataset.editable=String(free&&hasProbe&&view.electroDisplay!=="surface"&&view.electroDisplay!=="profile");
      for(const button of root.querySelectorAll("[data-activity]")){
        const active=(button.dataset.activity==="free")===free;
        button.setAttribute("aria-pressed",String(active));
        button.classList.toggle("primary",active);
      }
    }
    function updateCases(){
      for(const button of root.querySelectorAll("[data-case]")){
        button.setAttribute("aria-pressed",String(+button.dataset.case===activity.caseIndex));
      }
      previewNotice.hidden=!preview;
      evidenceData.classList.toggle("is-previewing",preview);
    }
    function showEvidence(rows){
      const {caseIndex,evidence}=activity;
      evidence[caseIndex]=lesson.focus.map(key=>rows.find(row=>row[0]===key));
      const [a,b]=evidence;
      const table=`<table><thead><tr><th scope="col">比較量</th><th scope="col" data-evidence="0">A</th><th scope="col" data-evidence="1">B</th></tr></thead><tbody>${
        evidence[caseIndex].map(([key,label],i)=>`<tr><th scope="row">${label}</th>
          <td data-evidence="0" data-measure="${key}">${a?.[i][2]??"—"}</td>
          <td data-evidence="1" data-measure="${key}">${b?.[i][2]??"—"}</td></tr>`).join("")
      }</tbody></table>`;
      if(evidenceData.innerHTML!==table)evidenceData.innerHTML=table;
      evidenceData.dataset.activeCase=String(caseIndex);
      explanation.hidden=!(a&&b);
      const message=a&&b?"先找出哪些量變了，再用 A、B 的讀值說明你的判斷。":"切換到案例 B，讓兩次讀值並排顯示。";
      if(evidenceStatus.textContent!==message)evidenceStatus.textContent=message;
    }
    find(".bench-activity-switch").addEventListener("click",e=>{
      const button=e.target.closest("[data-activity]");
      if(!button)return;
      const free=button.dataset.activity==="free";
      if(free===activity.free)return;
      stop();
      activity.free=free;
      p=free?saved.p:{...cases[activity.caseIndex]};
      updateActivity();
      updateView();
      queue();
    });
    find(".bench-cases").addEventListener("click",e=>{
      const button=e.target.closest("[data-case]");
      if(!button)return;
      stop();
      activity.caseIndex=+button.dataset.case;
      p={...cases[activity.caseIndex]};
      updateCases();
      queue();
    });
    find(".bench-choices").addEventListener("change",e=>{
      if(e.target.name==="bench-prediction")activity.prediction=+e.target.value;
    });
    explanation.addEventListener("toggle",()=>{activity.explained=explanation.open;});
    function updateView(){
      const flat=view.dimension==="2d";
      const profile=view.electroDisplay==="profile";
      plot.dataset.dimension=profile?"profile":view.dimension;
      plot.tabIndex=flat||profile?-1:0;
      plot.setAttribute("aria-label",profile?"沿 x 軸的電場與電位圖":flat?view.plane.toUpperCase()+" 平面視窗":"三維視窗。拖曳或用方向鍵旋轉。");
      find(".bench-view-controls").hidden=profile;
      find(".bench-display-options").hidden=profile;
      find("#bench-planes").hidden=!flat;
      find(".bench-camera").hidden=flat||profile||!activity.free;
      find(".bench-camera-settings").hidden=flat||profile;
      if(electroTools){
        if(profile)plot.before(electroFacts);
        else if(electroFacts.previousElementSibling!==plot)plot.after(electroFacts);
        const depth=find(".bench-depth");
        depth.hidden=flat||view.electroDisplay!=="lines";
        find(".bench-face-view").hidden=depth.hidden;
        depth.querySelector("select").value=view.electroDepth;
        const density=find(".bench-density");
        density.hidden=view.electroDisplay!=="lines"||(flat&&view.plane==="yz"&&mode.id!=="sphere");
        density.querySelector("select").value=view.electroDensity;
        plot.dataset.editable=String(activity.free&&hasProbe&&view.electroDisplay!=="surface"&&!profile);
        const linked=find(".bench-linked-only");
        if(linked){
          linked.hidden=view.electroDisplay!=="lines"||(flat&&view.plane==="yz");
          linked.textContent=view.electroLinkedOnly?"顯示全部線":"只看相連線";
          linked.setAttribute("aria-pressed",String(!!view.electroLinkedOnly));
        }
        for(const button of electroTools.querySelectorAll("[data-electro-display],[data-electro-range]")){
          const active=button.dataset.electroDisplay===view.electroDisplay||button.dataset.electroRange===electroRange();
          button.setAttribute("aria-pressed",String(active));
          button.classList.toggle("primary",active);
        }
      }
      for(const button of root.querySelectorAll("[data-dimension],[data-plane]")){
        const active=button.dataset.dimension===view.dimension||button.dataset.plane===view.plane;
        button.setAttribute("aria-pressed",String(active));
        button.classList.toggle("primary",active);
      }
    }
    function controls(){
      if(activity.free)for(const el of pControls){
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
      const profile=view.electroDisplay==="profile";
      const overlay={theme,grid:view.grid,labels:view.labels,analysis:view.labels,axes:view.grid||view.labels,
        comparisonExtent:activity.free?undefined:lesson.extent,
        electroDisplay:profile?electroViews[0]:view.electroDisplay,electroRange:electroRange(),electroDepth:view.electroDepth,
        electroLinkedOnly:view.electroLinkedOnly,electroDensity:view.electroDensity};
      const projection=view.dimension==="2d"?{...overlay,plane:view.plane,zoom:1}:{...camera,...overlay};
      const r=bench.draw(mode.id,p,projection,activity.free?saved.state:{});
      plot.innerHTML=profile?r.graph:r.diagram;
      find(".bench-scene-caption").textContent=profile?
        "上圖是電場的 x 分量，下圖是電位。兩圖共用 x 軸。空心點標出各自的零點，超出縱軸的值截在圖框邊緣。":
        r.caption||(activity.free?sceneCaptions[mode.id]:lesson.observe);
      if(electroFacts){
        const facts=profile?r.facts.filter(([label])=>label==="E = 0"||label==="軸上 V = 0"||label==="接地金屬"):r.facts;
        electroFacts.hidden=!facts.length;
        electroFacts.innerHTML=facts.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
      }
      if(activity.free){
        readouts.innerHTML=r.rows.map(([k,label,value])=>`<div><dt>${label}</dt><dd data-reading="${k}">${value}</dd></div>`).join("");
      }else if(!preview){
        showEvidence(r.rows);
      }
      const legend=find(".bench-legend");
      legend.hidden=profile||!r.legend.length||(!view.labels&&!electroTools);
      legend.innerHTML=r.legend.map(([c,name])=>`<li><span aria-hidden="true" style="--swatch:${c}"></span><span>${name}</span></li>`).join("");
      const hint=find("#bench-plane-hint");
      hint.hidden=!flat||!plot.querySelector("[data-normal]");
      hint.textContent="⊙ 朝向觀察者・⊗ 背離觀察者";
      find("#bench-note").textContent=r.note;
      if(!electroTools&&r.graph!==graph.innerHTML)graph.innerHTML=r.graph;
      graph.parentElement.hidden=!!electroTools||!r.graph;
    }
    function queue(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;draw();});}
    function stop(){
      if(loop)cancelAnimationFrame(loop);loop=0;last=0;
      if(preview){
        p={...cases[activity.caseIndex]};
        preview=false;
        updateCases();
      }
      if(play){play.setAttribute("aria-pressed","false");play.textContent=activity.free?"播放":"播放預覽";}
    }
    if(play)play.addEventListener("click",()=>{
      if(loop){stop();queue();return;}
      preview=!activity.free;
      updateCases();
      play.setAttribute("aria-pressed","true");play.textContent=preview?"停止預覽":"暫停";
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
    electroTools?.addEventListener("click",e=>{
      const button=e.target.closest("button");
      if(!button)return;
      if(button.classList.contains("bench-linked-only")){
        view.electroLinkedOnly=!view.electroLinkedOnly;
        if(view.electroLinkedOnly){
          view.electroRange="near";
          if(view.dimension==="3d"){
            Object.assign(camera,{yaw:0,pitch:90,zoom:1});
            view.electroDepth="section";
          }
        }
      }
      if(button.dataset.electroDisplay){
        if(button.dataset.electroDisplay==="profile"&&!view.electroProfileRange){
          const unequalOpposite=hasPair&&p.q*p.q2<0&&Math.abs(p.q)!==Math.abs(p.q2);
          view.electroProfileRange=unequalOpposite?"far":view.electroRange;
        }
        if(button.dataset.electroDisplay==="surface"&&view.electroDisplay!=="surface")view.dimension="3d";
        view.electroDisplay=button.dataset.electroDisplay;
      }
      if(button.dataset.electroRange){
        if(view.electroDisplay==="profile")view.electroProfileRange=button.dataset.electroRange;
        else view.electroRange=button.dataset.electroRange;
      }
      if(button.classList.contains("bench-face-view")){
        Object.assign(camera,{yaw:0,pitch:90,zoom:1});
        view.electroDepth="section";
      }
      updateView();
      queue();
    });
    find(".bench-depth select")?.addEventListener("change",e=>{
      view.electroDepth=e.target.value;
      queue();
    });
    find(".bench-density select")?.addEventListener("change",e=>{
      view.electroDensity=+e.target.value;
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
      if(e.button!==0||mouse||view.electroDisplay==="profile")return;
      const handle=plot.dataset.editable==="true"&&e.target.closest("[data-probe]");
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
      if(!activity.free)return;
      const svg=graph.querySelector("svg"), box=svg.getBoundingClientRect(), x=(e.clientX-box.left)/box.width;
      const start=+svg.dataset.start,end=+svg.dataset.end;
      p[playKey]=Math.round(clamp((x-start)/(end-start),0,1)*(playKey==="theta"?360:100));stop();queue();
    });
    find(".bench-actions").addEventListener("click",e=>{
      const b=e.target.closest("button");if(!b)return;
      const state=saved.state;
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
    updateActivity();
    updateCases();
    updateView();
    draw();
    return ()=>{stop();if(frame)cancelAnimationFrame(frame);};
  };
})();
