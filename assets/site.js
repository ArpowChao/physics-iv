(() => {
  "use strict";
  const main = document.getElementById("main");
  const sidebar = document.getElementById("sidebar");
  const menuButton = sidebar.querySelector(".mobile-nav-toggle");
  const levels = ["記憶","理解","應用","分析"];
  const labels = {single:"單選",multi:"多選",group:"題組單選",written:"手寫"};
  const letters = "ABCDE";
  const section = id => EM.sections.find(s => s.id === id);
  const chapter = id => EM.chapters.find(c => c.id === +id);
  const lab = id => EM.labs.find(c => c.id === id);
  const benchFor = sid => EM.workbenches.find(b=>b.sections.includes(sid));
  const benchURL = (b,sid) => "#labs/"+b.id+({"1-1":"/field-lines","1-2":"/field-lines","2-2":"/straight","2-3":"/wire","3-2":"/magnet","3-3":"/rotate","3-4":"/transformer"}[sid]||"");
  const particleLinks = () => link("#labs/particle-apps/linear","粒子加速器")+link("#labs/particle-apps/aurora","極光與磁鏡");
  const byChapter = id => EM.sections.filter(s=>s.id.startsWith(id+"-"));
  const stamp = id => String(id).padStart(2,"0");
  const reading = s => `課本 pp. ${s.pages}`;
  const curriculum = s => s.codes.map(c=>`PKc-Ⅴa-${c}`).join("、");
  const html = value => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeRead = (key,fallback) => {try{return JSON.parse(localStorage.getItem("physics-iv:"+key)) ?? fallback;}catch{return fallback;}};
  const save = (key,value) => {try{localStorage.setItem("physics-iv:"+key,JSON.stringify(value));}catch{/* Session still works. */}};
  const learned = new Set(safeRead("learned",[]));
  const solved = new Set(safeRead("concept-solved",[]));
  const answers = safeRead("answers",{});
  let cleanup=()=>{};
  const chips = tags => `<div class="chips">${tags.map(s=>`<span>${s}</span>`).join("")}</div>`;
  const eyebrow = text => `<p class="eyebrow">${text}</p>`;
  const sectionHead = (k,title,line) => `<div class="page-head">${eyebrow(k)}<h1>${title}</h1>${line?`<p>${line}</p>`:""}</div>`;
  const breadcrumbs = (url,label,last) => `<div class="breadcrumbs"><a href="${url}">${label}</a><span>/</span><span>${last}</span></div>`;
  const link = (url,label,kind="") => `<a class="button ${kind}" href="${url}">${label}</a>`;
  const figure = (id,caption) => `<figure class="exam-figure">${EM.figure(id)}<figcaption>${caption}</figcaption></figure>`;
  const topicId = (s,i) => s.id+"-"+(i+1);
  const topicQuestions = (s,i) => EM.conceptPractice[s.id][i];
  const conceptCount = EM.sections.reduce((n,s)=>n+s.topics.length,0);
  const questionCount = EM.sections.reduce((n,s)=>n+EM.conceptPractice[s.id].flat().length,0);
  const scoreTopic = (s,i) => topicQuestions(s,i).filter((_,j)=>solved.has(topicId(s,i)+"-"+j)).length;
  const scoreSection = s => s.topics.reduce((n,_,i)=>n+scoreTopic(s,i),0);
  const topicScore = (s,i) => `答對過 ${scoreTopic(s,i)} / ${topicQuestions(s,i).length} 題`;
  const chapterURL = id => "#course/chapter-"+id;
  function cards(onHome=false) {
    return `<div class="chapter-grid">${EM.chapters.map(chapter=>{
      const sections=byChapter(chapter.id);
      const done=sections.filter(s=>learned.has(s.id)).length;
      return `<article class="chapter-card">
        <span class="chapter-number">CHAPTER ${stamp(chapter.id)}</span>
        <h3>${chapter.name}</h3><p>${onHome?chapter.intro:chapter.line}</p>
        <a class="text-link" href="${chapterURL(chapter.id)}"><span>學習順序 →</span><span class="progress-note">${done} / ${sections.length} 節</span></a>
      </article>`;
    }).join("")}</div>`;
  }

  function home() {
    const finished=EM.sections.filter(s=>learned.has(s.id)).length;
    const last=section(safeRead("last-lesson",""));
    const start=(last&&!learned.has(last.id)?last:null)||EM.sections.find(s=>!learned.has(s.id))||EM.sections[0];
    main.innerHTML=`<section class="home-hero">
      <span class="view-eyebrow">高三・選修物理Ⅳ・電磁學</span>
      <h1>從一個電荷，<br>看懂電與磁。</h1>
      <p>先觀察現象，再用公式說明，最後做題檢核。每次讀一小節，把電荷、磁場和感應串起來。</p>
      <a class="lesson-primary" href="#course/${start.id}">${last?"接著學":"從靜電學開始"} →</a>
      <div class="lesson-actions"><span class="progress-note">${last?start.name+"　｜　":""}已自行確認理解 ${finished} / ${EM.sections.length} 節</span></div>
      <div class="learning-progress" role="progressbar" aria-label="已自行確認理解的節數" aria-valuemin="0" aria-valuenow="${finished}" aria-valuemax="${EM.sections.length}"><span style="width:${finished/EM.sections.length*100}%"></span></div>
    </section>
    <div class="study-flow" aria-label="每節學習順序">
      <div><b>01　看現象</b><p>帶著一個問題觀察實驗。</p></div>
      <div><b>02　懂關係</b><p>讀重點與例題，留意公式條件。</p></div>
      <div><b>03　試著解釋</b><p>答檢核，再決定是否往下學。</p></div>
    </div>
    <h2 class="section-title"><span>依照課堂進度，選一章</span></h2>${cards(true)}
    <h2 class="section-title"><span>需要時再用</span></h2>
    <div class="tool-shortcuts"><a href="#reference">找公式</a><a href="#labs">做實驗</a><a href="#concepts">練觀念</a><a href="#practice">做逐章練習卷</a></div>
    <details class="lesson-disclosure"><summary>先備工具：常用符號與單位</summary><div class="disclosure-content">
      <div class="edu-table-container" role="region" aria-label="常用符號與單位表" tabindex="0">
        <table class="edu-table">
          <thead><tr><th scope="col">物理量</th><th scope="col">符號・單位</th><th scope="col">怎麼讀</th></tr></thead>
          <tbody>
            <tr><th scope="row">電量</th><td>q・C</td><td>表示帶電的多寡與正負。</td></tr>
            <tr><th scope="row">電場</th><td>E・N/C</td><td>每單位正電量所受的靜電力。</td></tr>
            <tr><th scope="row">電位</th><td>V・V</td><td>每單位電量所具有的電位能。</td></tr>
            <tr><th scope="row">磁場</th><td>B・T</td><td>描述磁場的大小和方向。</td></tr>
            <tr><th scope="row">磁通量</th><td>Φ・Wb</td><td>穿過指定面的磁場通量。</td></tr>
            <tr><th scope="row">感應電動勢</th><td>ε・V</td><td>由磁通量變化所產生的電動勢。</td></tr>
          </tbody>
        </table>
      </div>
      <p class="progress-note">換單位：1 μC = 10⁻⁶ C，1 cm = 10⁻² m，1 μT = 10⁻⁶ T。代公式前先統一單位。</p>
    </div></details><p class="progress-note home-local-note">學習與練習紀錄只存在目前瀏覽器。</p>`;
  }

  function courseIndex() {
    main.innerHTML=`<div class="shell page">${sectionHead("高中選修物理Ⅳ","課程導讀","依課本順序選章節。每節先看現象，再讀核心概念，最後用題目檢核。")}${cards()}</div>`;
  }
  function chapterView(c) {
    const sections=byChapter(c.id);
    main.innerHTML=`<div class="shell page">${sectionHead("CHAPTER "+stamp(c.id)+"・選修物理Ⅳ",c.name,c.line)}
      <h2 class="section-title">本章學習順序</h2>
      <div class="node-list">${sections.map(s=>`<a href="#course/${s.id}"><span class="node-status">${learned.has(s.id)?"✓ 已確認":s.id}</span><div><strong>${s.name}</strong><p>${s.goal}</p></div></a>`).join("")}</div>
      <details class="lesson-disclosure"><summary>把本章串起來：課本探究</summary><div class="disclosure-content"><h3>${c.activity[0]}</h3><p>${c.activity[1]}</p><p><strong>討論：</strong>${c.activity[2]}</p><p class="muted">課本 pp. ${c.activityPage}</p></div></details>
      <div class="tool-shortcuts"><a href="#concepts/${c.id}">練本章各概念</a><a href="#practice/${c.id}">做本章練習卷</a></div>
    </div>`;
  }
  function conceptIndex(selected) {
    const filter=chapter(selected);
    main.innerHTML=`<div class="shell page">${sectionHead("觀念練習","依章節練習各概念",`共 ${EM.sections.length} 節、${conceptCount} 個概念、${questionCount} 題。選一個概念，直接跳到該節的兩道練習題。`)}
      <div class="concept-filters" aria-label="篩選章節">${[[null,"全部"],...EM.chapters.map(c=>[c.id,c.name])].map(([id,name])=>`<a class="button ${(filter?.id??null)===id?"primary":""}" ${(filter?.id??null)===id?'aria-current="page"':""} href="#concepts${id?"/"+id:""}">${name}</a>`).join("")}</div>
      ${(filter?[filter]:EM.chapters).map(c=>`<section class="concept-chapter"><h2 class="section-title">${c.name}</h2>
        ${byChapter(c.id).map(s=>`<details class="lesson-disclosure" ${filter?"open":""}><summary>${s.id}　${s.name}<span class="progress-note">答對過 ${scoreSection(s)} / ${EM.conceptPractice[s.id].flat().length} 題</span></summary>
          <div class="disclosure-content node-list">${s.topics.map(([name],i)=>`<a href="#course/${s.id}/${i+1}"><span class="node-status">${i+1}</span><div><strong>${name}</strong><p>${topicScore(s,i)}</p></div></a>`).join("")}</div>
        </details>`).join("")}
      </section>`).join("")}
      <p class="practice-note"><a class="text-link" href="#practice">做逐章練習卷 →</a></p>
    </div>`;
  }
  function lesson(s, targetTopic) {
    const c=chapter(s.id[0]), i=EM.sections.indexOf(s);
    const prev=EM.sections[i-1], next=EM.sections[i+1];
    save("last-lesson",s.id);
    main.innerHTML=`<article class="lesson">
      ${sectionHead(c.name+"・第 "+s.id.split("-")[1]+" 節",s.name)}
      <section class="lesson-goal"><span class="lesson-kicker">這節要學會</span><p>${s.goal}</p></section>
      <div class="lesson-jumps">${chips([reading(s),curriculum(s)])}<a class="text-link" href="#course/${s.id}/1">本節觀念練習・${EM.conceptPractice[s.id].flat().length} 題 ↓</a></div>
      <section class="observe-card"><span class="lesson-kicker">01　先觀察</span><p>${s.lead}</p>
        <div class="action-row">${EM.scenes.filter(x=>x.sections.includes(s.id)).map(x=>link("#labs/"+x.id,"動手拖曳："+x.title.split("：")[0]+" →","primary")).join("")}${benchFor(s.id)?link(benchURL(benchFor(s.id),s.id),"開啟 2D／3D 工作臺 →","primary"):""}${s.id==="2-4"?particleLinks():""}${link("#labs/"+s.lab,benchFor(s.id)?"先看基礎示意":"開啟實驗觀察 →")}</div></section>
      <h2 class="section-title">02　抓住核心關係</h2>
      <section class="formula-card"><div class="equation"><div class="formula">${s.formula}</div></div>
        <details class="formula-detail"><summary>公式怎麼用・條件與說明</summary><p>${s.condition}</p></details>
      </section>
      <section class="worked-example"><span class="lesson-kicker">跟著做一題</span><h2>${s.example[0]}</h2><p>${s.example[1]}</p></section>
      <h2 class="section-title" id="section-practice">03　檢查自己是否理解</h2>
      <p class="progress-note" id="section-progress" role="status">本節已答對過 ${scoreSection(s)} / ${EM.conceptPractice[s.id].flat().length} 題</p>
      ${s.topics.map(([name,note],k)=>`<section class="concept-card" id="concept-${topicId(s,k)}" aria-labelledby="topic-${topicId(s,k)}">
        <h3 id="topic-${topicId(s,k)}" tabindex="-1">${name}</h3><p>${note}</p>
        <details class="lesson-disclosure topic-practice" data-topic="${k}" ${+targetTopic===k+1?"open":""}>
          <summary><span>練習這個概念</span><span class="progress-note" data-topic-score>${topicScore(s,k)}</span></summary>
          <div class="disclosure-content">
            ${topicQuestions(s,k).map((q,j)=>`<div class="lesson-check" data-question="${j}" role="group" aria-labelledby="prompt-${topicId(s,k)}-${j}">
              <span class="lesson-kicker">第 ${j+1} 題・${q.level}</span><h4 id="prompt-${topicId(s,k)}-${j}">${q.stem}</h4>
              ${q.figure?figure(q.figure,"練習題圖"):""}
              <div class="check-options">${q.choices.map((choice,a)=>`<button type="button" data-choice="${a}" aria-pressed="false"><span aria-hidden="true">${letters[a]}.</span><span>${choice}</span></button>`).join("")}</div>
              <div class="check-feedback" role="status"></div>
            </div>`).join("")}
          </div>
        </details>
      </section>`).join("")}
      <details class="lesson-disclosure"><summary>綜合自我檢核</summary><div class="disclosure-content"><p><strong>${s.check[0]}</strong></p><p>${s.check[1]}</p></div></details>
      <section class="lesson-finish"><p>試著用自己的話說明本節的重點，能說清楚再確認理解。</p>
        <div class="action-row"><button type="button" id="mark" class="button primary" aria-pressed="${learned.has(s.id)}">${learned.has(s.id)?"✓ 已確認理解・點此取消":"我能說明本節重點"}</button>${link("#practice/"+c.id,"本章練習卷")}</div>
        <div class="lesson-neighbors"><a href="${prev?"#course/"+prev.id:chapterURL(c.id)}">← ${prev?.name||"本章學習順序"}</a><a href="${next?"#course/"+next.id:"#home"}">${next?.name||"回到學習首頁"} →</a></div>
      </section>
    </article>`;
    main.querySelector(".lesson").addEventListener("click",e=>{
      const b=e.target.closest("[data-choice]");
      if(!b)return;
      const question=b.closest("[data-question]"), details=question.closest("[data-topic]");
      const k=+details.dataset.topic, j=+question.dataset.question, picked=+b.dataset.choice, q=topicQuestions(s,k)[j], correct=picked===q.key;
      question.querySelectorAll("[data-choice]").forEach(el=>el.setAttribute("aria-pressed",String(el===b)));
      const feedback=question.querySelector(".check-feedback");
      feedback.dataset.result=correct?"right":"retry";
      feedback.innerHTML=`<strong>${correct?"答對了。":"再想一想。答案是 "+letters[q.key]+"。"}</strong> ${q.explanation}`;
      if(correct){
        solved.add(topicId(s,k)+"-"+j);
        save("concept-solved",[...solved]);
        details.querySelector("[data-topic-score]").textContent=topicScore(s,k);
        document.getElementById("section-progress").textContent=`本節已答對過 ${scoreSection(s)} / ${EM.conceptPractice[s.id].flat().length} 題`;
      }
    });
    document.getElementById("mark").addEventListener("click",e=>{
      if(learned.has(s.id))learned.delete(s.id);else learned.add(s.id);
      save("learned",[...learned]);
      e.target.setAttribute("aria-pressed",String(learned.has(s.id)));
      e.target.textContent=learned.has(s.id)?"✓ 已確認理解・點此取消":"我能說明本節重點";
      sidebar.querySelector(".nav-item-node[aria-current] .node-name").textContent=s.name+(learned.has(s.id)?" ✓":"");
    });
  }

  function labIndex() {
    main.innerHTML=`<div class="shell page">${sectionHead("LAB / 互動實驗","電磁實驗室","每次先改一個變因，記下讀值，再回到公式解釋。")}
      <section class="lab-group"><h2 class="section-title">情境實驗（可直接拖曳）</h2><div class="bench-index">${EM.scenes.map(x=>`<a class="lab-card" href="#labs/${x.id}"><span class="mono">情境實驗 ${x.sections.join("・")}</span><strong>${x.title}</strong><span>${x.description}</span><span aria-hidden="true" class="lab-arr">↗</span></a>`).join("")}</div></section>
      <section class="lab-group"><h2 class="section-title">2D／3D 工作臺</h2>
        <div class="bench-index">${EM.workbenches.map(b=>`<a class="lab-card" href="#labs/${b.id}"><span class="mono">進階實驗 ${b.sections.join("・")}</span><strong>${b.title}</strong><span>${b.description}</span><span aria-hidden="true" class="lab-arr">↗</span></a>`).join("")}</div>
      </section>
      ${EM.chapters.map(c=>`<section class="lab-group"><h2><span class="mono">${stamp(c.id)} /</span> ${c.name}</h2><div class="lab-grid">${byChapter(c.id).map(s=>`<a class="lab-card" href="${benchURL(benchFor(s.id),s.id)}"><span class="mono">LAB ${s.id}・2D／3D</span><strong>${s.name}</strong><span>${s.lead}</span><span aria-hidden="true" class="lab-arr">↗</span></a>`).join("")}</div></section>`).join("")}
    </div>`;
  }
  function experiment(config) {
    const s=EM.sections.find(s=>s.lab===config.id), p=EM.defaults(config);
    main.innerHTML=`<div class="shell page lab-page">
      ${breadcrumbs("#labs","電磁實驗室","LAB "+s.id)}
      ${sectionHead("互動實驗・"+s.id,config.name)}
      <div class="lab-observation"><strong>帶著一個問題看</strong><p>${s.lead}</p></div>
      ${benchFor(s.id)?`<div class="tool-shortcuts"><a href="${benchURL(benchFor(s.id),s.id)}">開啟相關 2D／3D 工作臺 ↗</a>${s.id==="2-4"?particleLinks():""}</div>`:""}
      <div class="lab-shell lab-layout">
        <div class="lab-stage" id="lab-plot"></div>
        <div class="lab-controls">
          <h2>調整參數</h2>
          <form id="params">${config.controls.map(c=>c.choices?
            `<label class="control" for="ctl-${c.id}"><span>${c.name}</span><select id="ctl-${c.id}" name="${c.id}">${c.choices.map(([v,n])=>`<option value="${v}" ${v===c.value?"selected":""}>${n}</option>`).join("")}</select></label>`:
            `<label class="control" for="ctl-${c.id}"><span class="control-line"><span>${c.name}</span><output id="out-${c.id}" for="ctl-${c.id}"></output></span><input id="ctl-${c.id}" name="${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"></label>`).join("")}
            <div class="action-row">${config.animate?'<button type="button" class="button primary" id="play" aria-pressed="false">播放</button>':""}<button type="button" class="button" id="reset-lab">恢復初始值</button></div>
            ${config.animate?'<p class="muted small">播放為示意；實際週期見讀值。</p>':""}
          </form>
        </div>
        <dl id="readouts" class="readouts"></dl>
      </div>
      <div class="lab-notes">
        <div class="panel"><h2>照著做</h2><ol>${config.guide.map(g=>`<li>${g}</li>`).join("")}</ol></div>
        <div class="panel"><h2>對照課本</h2><p class="formula">${s.formula}</p><p>${s.condition}</p><a class="text-link" href="#course/${s.id}">回到 ${s.id} 導讀 ↗</a></div>
      </div>
    </div>`;
    const form=document.getElementById("params"), target=document.getElementById("lab-plot"), metrics=document.getElementById("readouts"), play=document.getElementById("play");
    let timer=0;
    function draw() {
      for(const c of config.controls) if(!c.choices) {
        const value=p[c.id]+(c.unit==="°"||c.unit==="%"?c.unit:" "+c.unit);
        document.getElementById("out-"+c.id).textContent=value;
        form.elements.namedItem(c.id).setAttribute("aria-valuetext",value);
      }
      const {diagram,values}=EM.labOutput(config,p);
      target.innerHTML=diagram;
      metrics.innerHTML=values.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join("");
    }
    function stop() {clearInterval(timer);timer=0;if(play){play.textContent="播放";play.setAttribute("aria-pressed","false");}}
    form.addEventListener("submit",e=>e.preventDefault());
    form.addEventListener("input",e=>{if(e.target.name in p){if(e.target.name===config.animate)stop();p[e.target.name]=+e.target.value;draw();}});
    document.getElementById("reset-lab").addEventListener("click",()=>{stop();form.reset();Object.assign(p,EM.defaults(config));draw();});
    if(play) play.addEventListener("click",()=>{
      if(timer) {stop();return;}
      play.textContent="暫停";play.setAttribute("aria-pressed","true");
      const control=config.controls.find(c=>c.id===config.animate);
      timer=setInterval(()=>{
        const step=config.id==="generator"?p.speed*2:config.id==="wave"?p.freq:2;
        p[config.animate]=(Math.round(p[config.animate]+step))%(control.max+1);
        form.elements.namedItem(config.animate).value=p[config.animate];
        draw();
      },48);
    });
    cleanup=stop;
    draw();
  }

  function practiceIndex() {
    main.innerHTML=`<div class="shell page">${sectionHead("PRACTICE / 逐章練習卷","練習卷","先在線作答或列印成紙本。交卷後可看詳解與課綱標記；手寫題依配分規準自評。")}
      <p><a class="text-link" href="#concepts">想先複習單一概念？開啟觀念練習 →</a></p>
      <div class="chapter-grid">${EM.exams.map(e=>{const c=chapter(e.chapter);return `<article class="chapter-card ${c.color}">
        <div class="card-label"><span>${stamp(c.id)}</span><span>CHAPTER PRACTICE</span></div><h3><a href="#practice/${c.id}">${c.name}</a></h3>
        <p>12 題・100 分・建議 ${e.minutes} 分鐘</p>
        ${chips(["單選","多選","題組","手寫 16 分"])}
        <div class="action-row">${link("#practice/"+c.id,"開始作答 →","primary")}</div>
      </article>`;}).join("")}</div>
      <section class="panel practice-note"><h2>怎麼計分？</h2><p>單選 5 題共 40 分，多選 2 題共 20 分，題組 3 題共 24 分，手寫 2 題共 16 分。多選每題的正確選項數為 2 或 3 個；線上練習採選項全對才給分。繪圖、填充與計算合計不超過 20%。</p></section>
    </div>`;
  }
  function practice(exam) {
    const c=chapter(exam.chapter);
    const stages=[["single","一、單選題","5 題，每題 8 分。"],["multi","二、多選題","2 題，每題 10 分；正確選項為 2 或 3 個，全對給分。"],["group","三、題組","共用題幹，3 題，每題 8 分。"],["written","四、手寫題","2 題，每題 8 分。手寫繪圖請畫在題圖或紙上。"]];
    const meta = q => {
      const s=section(q.section);
      return `<p class="q-meta"><a href="#course/${s.id}">${s.id} ${s.topics[q.topic][0]}</a> · ${curriculum(s)} · ${q.bloom}${q.ability?` · ${EM.abilities[q.ability]}（${q.ability}）`:" · 科學認知"}</p>`;
    };
    const buildQuestion = q => {
      const i=exam.questions.indexOf(q)+1;
      const prompt=`<span class="q-no">${stamp(i)}</span><span>${q.stem} <span class="q-pts">（${q.points} 分）</span></span>`;
      if(q.type==="written") return `<section class="question" id="q-${q.id}">
          <h3 class="q-title">${prompt}</h3>${q.figure?figure(q.figure,"作答圖・可直接在列印紙上繪製"):""}
          <label class="writing"><span>草稿／文字作答</span><textarea rows="3" name="${q.id}" aria-label="第 ${i} 題手寫作答">${html(answers[q.id]||"")}</textarea></label><div class="paper-lines"></div>
          <div class="feedback" hidden></div></section>`;
      return `<fieldset class="question" id="q-${q.id}"><legend class="q-title">${prompt}</legend>
        <div class="options">${q.options.map((o,j)=>`<label><input type="${q.type==="multi"?"checkbox":"radio"}" name="${q.id}" value="${j}" ${(answers[q.id]||[]).includes(j)?"checked":""}><span class="choice-letter">${letters[j]}</span><span>${o}</span></label>`).join("")}</div>
        <div class="feedback" hidden></div></fieldset>`;
    };
    main.innerHTML=`<div class="shell page exam-page">
      ${breadcrumbs("#practice","練習卷","第 "+c.id+" 章")}
      ${sectionHead("CHAPTER PRACTICE / "+stamp(c.id),c.name+"｜練習卷","共 12 題、100 分。建議作答時間 "+exam.minutes+" 分鐘。")}
      <div class="print-info">班級：＿＿＿＿　座號：＿＿＿＿　姓名：＿＿＿＿</div>
      <div class="exam-top action-row"><button class="button" type="button" id="print-test">列印空白卷</button><button class="button" type="button" id="print-key">列印解答與命題表</button><button class="button" type="button" id="clear-test">清除本卷答案</button></div>
      <details class="fold blueprint"><summary><span>命題表</span><span>查看 Bloom、課綱與題目對照</span></summary>
        <p>${levels.map(l=>`${l} ${exam.questions.filter(q=>q.bloom===l).length} 題`).join(" ／ ")}。純科學認知題不硬套探究能力。</p>
        <ol>${exam.questions.map(q=>`<li>${q.id} · ${labels[q.type]} · ${q.points} 分${meta(q)}</li>`).join("")}</ol>
      </details>
      <form id="exam-form">
        ${stages.map(([id,title,note])=>`<section class="exam-stage stage-${id}"><h2>${title}</h2><p class="stage-note">${note}</p>
          ${id==="group"?`<div class="group-intro"><p>${exam.context}</p>${figure(exam.figure,"題組共用圖")}</div>`:""}
          ${exam.questions.filter(q=>q.type===id).map(buildQuestion).join("")}</section>`).join("")}
        <div class="submit-row"><button class="button primary" type="submit">交卷看詳解 →</button><span class="small muted">作答只保留在這個瀏覽器。</span></div>
        <div id="exam-score" class="score" tabindex="-1" aria-live="polite" hidden></div>
      </form>
      <section class="answer-key" aria-label="列印解答">
        <h2>答案與命題表</h2>
        ${exam.questions.map((q,i)=>`<article><h3>${i+1}. ${q.key?q.key.map(j=>letters[j]).join("、"):"手寫評分規準"}（${q.points} 分）</h3><p>${q.reason}</p>${meta(q)}</article>`).join("")}
      </section>
    </div>`;
    const form=document.getElementById("exam-form"), score=document.getElementById("exam-score");
    const onEdit=e=>{
      const q=exam.questions.find(q=>q.id===e.target.name);
      if(!q)return;
      answers[q.id]=q.type==="written"?e.target.value:[...form.querySelectorAll(`[name="${q.id}"]:checked`)].map(el=>+el.value);
      save("answers",answers);
      if(!score.hidden){score.hidden=true;form.querySelectorAll(".feedback").forEach(el=>el.hidden=true);}
    };
    form.addEventListener("input",onEdit);
    document.getElementById("clear-test").addEventListener("click",()=>{
      for(const q of exam.questions)delete answers[q.id];
      for(const el of form.querySelectorAll("input,textarea")){if(el.type==="checkbox"||el.type==="radio")el.checked=false;else el.value="";}
      save("answers",answers);score.hidden=true;
      form.querySelectorAll(".feedback").forEach(el=>el.hidden=true);
    });
    const print = mode => {
      document.body.dataset.print=mode;
      try{window.print();}finally{delete document.body.dataset.print;}
    };
    document.getElementById("print-test").addEventListener("click",()=>print("test"));
    document.getElementById("print-key").addEventListener("click",()=>print("key"));
    form.addEventListener("submit",e=>{
      e.preventDefault();
      let points=0, missing=0;
      for(const q of exam.questions){
        const picked=answers[q.id]||[];
        const correct=q.key&&q.key.length===picked.length&&q.key.every(k=>picked.includes(k));
        if(correct)points+=q.points;
        if(q.key&&!picked.length)missing++;
        const feedback=document.querySelector(`#q-${q.id} .feedback`);
        const title=q.key?`${correct?"答對":picked.length?"答錯":"未作答"}・答案：${q.key.map(j=>letters[j]).join("、")}`:"手寫評分規準";
        feedback.innerHTML=`<strong>${title}</strong><p>${q.reason}</p>${meta(q)}`;
        feedback.hidden=false;
      }
      score.innerHTML=`<strong>選擇題 ${points} / 84 分</strong><p>${missing?`${missing} 題未作答。 `:""}手寫題另有 16 分；依題後規準自評。每題詳解已展開。</p><a class="text-link" href="#q-${exam.questions[0].id}" data-review>回到第 1 題看詳解 ↑</a>`;
      score.querySelector("[data-review]").addEventListener("click",ev=>{ev.preventDefault();const first=document.getElementById("q-"+exam.questions[0].id);first.scrollIntoView();first.querySelector("input").focus({preventScroll:true});});
      score.hidden=false;score.focus();
    });
  }

  function reference() {
    main.innerHTML=`<div class="shell page reference-page">
      ${sectionHead("REFERENCE / 課綱與公式","公式與課綱對照","依章節查找公式、使用條件、課本頁碼與 108 課綱學習內容。")}
      ${EM.chapters.map(c=>`<section class="formula-group"><h2><span class="mono">${stamp(c.id)} /</span> ${c.name}</h2>
        ${byChapter(c.id).map(s=>`<details class="fold"><summary><span>${s.id}</span><span>${s.name}</span></summary><div class="fold-body">
          <p class="formula">${s.formula}</p><p>${s.condition}</p>
          <ul>${s.codes.map(i=>`<li><span class="mono">PKc-Ⅴa-${i}</span>　${EM.curriculum[i]}</li>`).join("")}</ul>
          <a class="text-link" href="#course/${s.id}">${reading(s)}・回到導讀 ↗</a>
        </div></details>`).join("")}
      </section>`).join("")}
      <section class="panel sources"><h2>教材與命題依據</h2>
        <ul>
          <li>全華《選修物理Ⅳ》第一至第三章；頁碼為印刷頁碼。</li>
          <li><a class="text-link" href="https://stv.naer.edu.tw/data/course_outline/pta_18538_240851_60502.pdf">《十二年國民基本教育課程綱要・自然科學領域》</a>，加深加廣選修第五學習階段：學習表現 pp. 42–43、學習內容 pp. 47–48、物理內容說明 pp. 195–196。</li>
          <li>David R. Krathwohl，〈A Revision of Bloom’s Taxonomy: An Overview〉及所附修訂版 Bloom 文獻。練習卷採記憶、理解、應用、分析四層。</li>
          <li><a class="text-link" href="https://github.com/ArpowChao/phy-wave-optics">波動與光學・學習筆記</a>：沿用其學習首頁、章節側欄、導讀與檢核版面。</li>
        </ul>
        <p>導讀、圖與試題均為本站整理與命製。練習卷依所列規格編排，未套用段考範本。</p>
      </section>
    </div>`;
  }

  const sidebarGroups = document.getElementById("node-nav-container");
  sidebarGroups.innerHTML=EM.chapters.map(c=>`<details class="chapter-nav" data-chapter="${c.id}">
    <summary><span>${stamp(c.id)}　${c.name}</span></summary>
    <ul class="nav-list"><li><a class="nav-item" href="${chapterURL(c.id)}" data-route="course/chapter-${c.id}"><span>本章學習順序</span></a></li>
      ${byChapter(c.id).map(s=>`<li><a class="nav-item nav-item-node" href="#course/${s.id}" data-route="course/${s.id}"><span class="node-code-badge">${s.id}</span><span class="node-name">${s.name}</span></a></li>`).join("")}
    </ul></details>`).join("");

  function toggleMenu(open) {
    sidebar.classList.toggle("mobile-open",open);
    menuButton.setAttribute("aria-expanded",String(open));
    menuButton.setAttribute("aria-label",open?"關閉導覽選單":"開啟導覽選單");
  }
  menuButton.addEventListener("click",()=>toggleMenu(menuButton.getAttribute("aria-expanded")==="false"));
  sidebar.addEventListener("keydown",e=>{if(e.key==="Escape"&&sidebar.classList.contains("mobile-open")){toggleMenu(false);menuButton.focus();}});
  sidebar.addEventListener("click",e=>{
    const a=e.target.closest('a[href^="#"]');
    if(a){toggleMenu(false);if(a.hash===location.hash){window.scrollTo(0,0);main.focus({preventScroll:true});}}
  });
  document.getElementById("footer-top").addEventListener("click",()=>{window.scrollTo(0,0);main.focus({preventScroll:true});});
  document.getElementById("toolbar-back").addEventListener("click",()=>{
    if(history.state?.emIVDepth>0)history.back();else location.hash="home";
  });

  function route(focus=false) {
    const hash=location.hash.slice(1)||"home";
    if(hash==="main")return;
    const [page,id,topic]=hash.split("/");
    cleanup();cleanup=()=>{};
    let title="", active=page, activeChapter=null, topicTarget=null, breadcrumb="";
    if(page==="course"){
      const s=section(id), c=id?.startsWith("chapter-")?chapter(id.slice(8)):null;
      if(s){title=s.name;activeChapter=chapter(s.id[0]);active="course/"+s.id;breadcrumb=activeChapter.name+" › "+title;topicTarget=Number.isInteger(+topic)&&+topic>=1&&+topic<=s.topics.length?topicId(s,+topic-1):null;}
      else if(c){chapterView(c);title=c.name;activeChapter=c;active=hash;}
      else{courseIndex();title="課程導讀";}
    }else if(page==="labs"){
      const config=lab(id), bench=EM.workbenches.find(b=>b.id===id), scene=EM.scenes.find(x=>x.id===id);
      if(scene){cleanup=EM.mountScene(main,scene,topic);title=scene.title;}
      else if(bench){cleanup=EM.mountWorkbench(main,bench,topic);title=bench.title;}
      else if(config){experiment(config);title=config.name;}
      else{labIndex();title="電磁實驗室";}
    }else if(page==="concepts"){
      conceptIndex(id);title="觀念練習";
    }else if(page==="practice"){
      const e=EM.exams.find(e=>e.chapter===+id);if(e){practice(e);title=chapter(id).name+"練習卷";}else{practiceIndex();title="練習卷";}
    }else if(page==="reference"){reference();title="公式速查表";}else{home();active="home";}
    for(const a of sidebar.querySelectorAll("[data-route]")){
      if(a.dataset.route===active){a.setAttribute("aria-current","page");const group=a.closest("details.sidebar-more");if(group)group.open=true;}
      else a.removeAttribute("aria-current");
      if(a.classList.contains("nav-item-node")){
        const s=section(a.dataset.route.split("/")[1]);
        a.querySelector(".node-name").textContent=s.name+(learned.has(s.id)?" ✓":"");
      }
    }
    sidebarGroups.querySelectorAll(".chapter-nav").forEach(group=>{group.open=+group.dataset.chapter===activeChapter?.id;});
    if(page==="course"&&section(id))lesson(section(id),topic);
    document.getElementById("view-breadcrumb").textContent=breadcrumb||title||"學習首頁";
    document.title=(title?title+"｜":"")+"電磁學・學習筆記";
    main.dataset.route=hash;
    if(topicTarget){
      const target=document.getElementById("topic-"+topicTarget);
      target.focus({preventScroll:true});
      target.scrollIntoView({block:"start"});
    }else if(focus){window.scrollTo(0,0);main.focus({preventScroll:true});}
  }
  let navDepth=history.state?.emIVDepth??0;
  history.replaceState({...history.state,emIVDepth:navDepth},"");
  window.addEventListener("hashchange",()=>{
    if(location.hash==="#main")return;
    navDepth=history.state?.emIVDepth??(navDepth+1);
    history.replaceState({...history.state,emIVDepth:navDepth},"");
    toggleMenu(false);route(true);
  });
  document.querySelector(".skip").addEventListener("click",e=>{e.preventDefault();main.focus();});
  route();
})();
