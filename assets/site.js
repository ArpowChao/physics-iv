(() => {
  "use strict";
  const main = document.getElementById("main");
  const links = [...document.querySelectorAll(".nav a")];
  const levels = ["記憶","理解","應用","分析"];
  const labels = {single:"單選",multi:"多選",group:"題組單選",written:"手寫"};
  const letters = "ABCDE";
  const section = id => EM.sections.find(s => s.id === id);
  const chapter = id => EM.chapters.find(c => c.id === +id);
  const lab = id => EM.labs.find(c => c.id === id);
  const byChapter = id => EM.sections.filter(s=>s.id.startsWith(id+"-"));
  const stamp = id => String(id).padStart(2,"0");
  const reading = s => `課本 pp. ${s.pages}`;
  const curriculum = s => s.codes.map(c=>`PKc-Ⅴa-${c}`).join("、");
  const html = value => String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const safeRead = (key,fallback) => {try{return JSON.parse(localStorage.getItem("physics-iv:"+key)) ?? fallback;}catch{return fallback;}};
  const save = (key,value) => {try{localStorage.setItem("physics-iv:"+key,JSON.stringify(value));}catch{/* Session still works. */}};
  const learned = new Set(safeRead("learned",[]));
  const answers = safeRead("answers",{});
  let cleanup=()=>{}, homeIndex=0;
  const chips = tags => `<div class="chips">${tags.map(s=>`<span>${s}</span>`).join("")}</div>`;
  const eyebrow = text => `<p class="eyebrow">${text}</p>`;
  const sectionHead = (k,title,line) => `<div class="page-head">${eyebrow(k)}<h1>${title}</h1>${line?`<p>${line}</p>`:""}</div>`;
  const breadcrumbs = (url,label,last) => `<div class="breadcrumbs"><a href="${url}">${label}</a><span>/</span><span>${last}</span></div>`;
  const link = (url,label,kind="") => `<a class="button ${kind}" href="${url}">${label}</a>`;
  const figure = (id,caption) => `<figure class="exam-figure">${EM.figure(id)}<figcaption>${caption}</figcaption></figure>`;
  const cards = () => `<div class="chapter-grid">${EM.chapters.map(c=>`<article class="chapter-card ${c.color}">
    <div class="card-label"><span>${stamp(c.id)}</span><span>${c.en}</span></div>
    <h3><a href="#course/${byChapter(c.id)[0].id}">${c.name}</a></h3><p>${c.line}</p>
    <ol class="chapter-list">${byChapter(c.id).map(s=>`<li><a href="#course/${s.id}"><span class="mono">${s.id}</span><span>${s.name}</span>${learned.has(s.id)?'<span class="done" aria-label="已完成">✓</span>':""}</a></li>`).join("")}</ol>
    <a class="text-link" href="#practice/${c.id}">開啟本章練習卷 <span aria-hidden="true">↗</span></a>
  </article>`).join("")}</div>`;

  function home() {
    const modes=[["field","電力線"],["particle","磁場軌跡"],["flux","磁通量"]];
    main.innerHTML=`<section class="hero shell">
      <div class="hero-copy">
        ${eyebrow('<span class="signal"></span> 高中選修物理Ⅳ <span class="hero-divider">/</span> 108 課綱')}
        <h1>電磁學<br>實驗筆記<span class="hero-dot">.</span></h1>
        <p class="hero-lead">看電荷如何互相作用，追蹤磁場裡的軌跡，再找出電是怎麼感應出來的。</p>
        <div class="action-row">${link("#course/1-1","開始第一節 →","primary")}${link("#labs","瀏覽互動實驗")}</div>
      </div>
      <div class="instrument" aria-label="互動實驗預覽">
        <div class="instrument-bar"><span><span class="signal"></span> 電磁觀測窗</span><span id="scope-id"></span></div>
        <div id="hero-plot" class="scope"></div>
        <div class="instrument-controls"><div class="scope-tabs" role="group" aria-label="切換預覽">${modes.map(([id,name],i)=>`<button type="button" data-scope="${i}">${name}</button>`).join("")}</div><a id="scope-link" href="#labs">操作 ↗</a></div>
      </div>
    </section>
    <section class="shell course-map">
      <div class="section-row"><div>${eyebrow("COURSE MAP / 課程地圖")}<h2>從課本小節開始</h2></div><p>3 章 · ${EM.sections.length} 節 · ${EM.labs.length} 個互動實驗</p></div>
      ${cards()}
    </section>`;
    function plot(i) {
      homeIndex=i;
      const [id]=modes[i], config=lab(id), s=EM.sections.find(s=>s.lab===id);
      document.getElementById("hero-plot").innerHTML=EM.labOutput(config,EM.defaults(config)).diagram;
      document.getElementById("scope-id").textContent="FIG. "+s.id;
      document.getElementById("scope-link").href="#labs/"+id;
      for (const b of main.querySelectorAll("[data-scope]")) b.setAttribute("aria-pressed",String(+b.dataset.scope===i));
    }
    plot(homeIndex);
    main.querySelector(".scope-tabs").addEventListener("click",e=>{if(e.target.matches("[data-scope]"))plot(+e.target.dataset.scope);});
  }

  function courseIndex() {
    main.innerHTML=`<div class="shell page">${sectionHead("COURSE / 課本導讀","課程導讀","依課本編排。每節先看一個現象，再讀核心概念、做例題與自我檢核。")}${cards()}</div>`;
  }
  function lesson(s) {
    const c=chapter(s.id[0]), i=EM.sections.indexOf(s), first=byChapter(c.id)[0], last=byChapter(c.id).at(-1);
    const prev=EM.sections[i-1], next=EM.sections[i+1];
    main.innerHTML=`<div class="shell page">
      ${breadcrumbs("#course","課程導讀",c.name)}
      <div class="lesson-layout">
        <aside class="lesson-nav" aria-label="本章小節"><p class="eyebrow">第 ${c.id} 章</p><strong>${c.name}</strong>
          ${byChapter(c.id).map(o=>`<a href="#course/${o.id}" ${o===s?'aria-current="page"':""}><span class="mono">${o.id}</span><span>${o.name}${learned.has(o.id)?" ✓":""}</span></a>`).join("")}
          <a class="text-link" href="#practice/${c.id}">本章練習卷 ↗</a>
        </aside>
        <article class="lesson">
          ${sectionHead("SECTION / "+s.id,s.name,s.goal)}
          ${chips([reading(s),curriculum(s)])}
          <div class="observe"><div>${eyebrow("01 / 先觀察")}<h2>${s.lead}</h2></div>${link("#labs/"+s.lab,"打開對應實驗 →","primary")}</div>
          <div class="lesson-block">${eyebrow("02 / 抓住關係")}<h2>核心概念</h2>
            ${s.topics.map(([a,b])=>`<section class="topic"><h3>${a}</h3><p>${b}</p></section>`).join("")}
            <div class="equation"><div class="formula">${s.formula}</div><p>${s.condition}</p></div>
          </div>
          <div class="lesson-block">${eyebrow("03 / 動手練習")}<h2>例題與檢核</h2>
            ${[s.example,s.check].map(([prompt,answer],j)=>`<details class="fold"><summary><span>${j===0?"例題":"自我檢核"}</span><span>${prompt}</span></summary><p>${answer}</p></details>`).join("")}
          </div>
          ${s===last?`<div class="lesson-block">${eyebrow("CHAPTER LAB / 課本探究")}<h2>${c.activity[0]}</h2><p>${c.activity[1]}</p><p><strong>討論：</strong>${c.activity[2]}</p><p class="muted">課本 pp. ${c.activityPage}</p></div>`:""}
          <div class="lesson-next"><button type="button" id="mark" class="button" aria-pressed="${learned.has(s.id)}">${learned.has(s.id)?"✓ 已標記學會":"標記為已學會"}</button>
            ${prev?link("#course/"+prev.id,"← 上一節"):""}${next?link("#course/"+next.id,"下一節 →","primary"):link("#practice/"+c.id,"本章練習卷 →","primary")}
          </div>
          ${s===first?'<p class="muted small">完成狀態只記在這個瀏覽器。</p>':""}
        </article>
      </div>
    </div>`;
    document.getElementById("mark").addEventListener("click",e=>{
      if(learned.has(s.id))learned.delete(s.id);else learned.add(s.id);
      save("learned",[...learned]);
      e.target.setAttribute("aria-pressed",String(learned.has(s.id)));
      e.target.textContent=learned.has(s.id)?"✓ 已標記學會":"標記為已學會";
      main.querySelector(".lesson-nav [aria-current] span:nth-child(2)").textContent=s.name+(learned.has(s.id)?" ✓":"");
    });
  }

  function labIndex() {
    main.innerHTML=`<div class="shell page">${sectionHead("LAB / 互動實驗","電磁實驗室","每次先改一個變因，記下讀值，再回到公式解釋。")}
      ${EM.chapters.map(c=>`<section class="lab-group"><h2><span class="mono">${stamp(c.id)} /</span> ${c.name}</h2><div class="lab-grid">${byChapter(c.id).map(s=>`<a class="lab-card" href="#labs/${s.lab}"><span class="mono">LAB ${s.id}</span><strong>${lab(s.lab).name}</strong><span>${s.lead}</span><span aria-hidden="true" class="lab-arr">↗</span></a>`).join("")}</div></section>`).join("")}
    </div>`;
  }
  function experiment(config) {
    const s=EM.sections.find(s=>s.lab===config.id), p=EM.defaults(config);
    main.innerHTML=`<div class="shell page lab-page">
      ${breadcrumbs("#labs","電磁實驗室","LAB "+s.id)}
      ${sectionHead("LAB / "+s.id,config.name,s.lead)}
      <div class="lab-layout">
        <div class="instrument">
          <div class="instrument-bar"><span><span class="signal"></span> 模擬視窗</span><span>LAB ${s.id}</span></div>
          <div id="lab-plot" class="scope"></div>
          <dl id="readouts" class="readouts"></dl>
        </div>
        <div class="lab-controls">
          <h2>調整參數</h2>
          <form id="params">${config.controls.map(c=>c.choices?
            `<label class="control" for="ctl-${c.id}"><span>${c.name}</span><select id="ctl-${c.id}" name="${c.id}">${c.choices.map(([v,n])=>`<option value="${v}" ${v===c.value?"selected":""}>${n}</option>`).join("")}</select></label>`:
            `<label class="control" for="ctl-${c.id}"><span class="control-line"><span>${c.name}</span><output id="out-${c.id}" for="ctl-${c.id}"></output></span><input id="ctl-${c.id}" name="${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"></label>`).join("")}
            <div class="action-row">${config.animate?'<button type="button" class="button primary" id="play" aria-pressed="false">播放</button>':""}<button type="button" class="button" id="reset-lab">恢復初始值</button></div>
            ${config.animate?'<p class="muted small">播放為示意；實際週期見讀值。</p>':""}
          </form>
        </div>
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
          <li><a class="text-link" href="https://github.com/ArpowChao/phy-wave-optics">波動與光學・學習筆記</a>：參考其課程導讀、互動實驗與檢核編排。</li>
        </ul>
        <p>導讀、圖與試題均為本站整理與命製。練習卷依所列規格編排，未套用段考範本。</p>
      </section>
    </div>`;
  }

  function route() {
    const hash=location.hash.slice(1);
    if(hash==="main")return;
    const [page,id]=hash.split("/");
    cleanup();cleanup=()=>{};
    for(const a of links){if(a.hash==="#"+page)a.setAttribute("aria-current","page");else a.removeAttribute("aria-current");}
    let title="";
    if(page==="course"){
      const s=section(id);if(s){lesson(s);title=s.name;}else{courseIndex();title="課程導讀";}
    }else if(page==="labs"){
      const config=lab(id);if(config){experiment(config);title=config.name;}else{labIndex();title="電磁實驗室";}
    }else if(page==="practice"){
      const e=EM.exams.find(e=>e.chapter===+id);if(e){practice(e);title=chapter(id).name+"練習卷";}else{practiceIndex();title="練習卷";}
    }else if(page==="reference"){reference();title="公式與課綱對照";}else home();
    document.title=(title?title+"｜":"")+"電磁學實驗筆記";
    main.dataset.route=hash||"home";
  }
  window.addEventListener("hashchange",()=>{
    if(location.hash==="#main")return;
    route();window.scrollTo(0,0);main.focus({preventScroll:true});
  });
  document.querySelector(".skip").addEventListener("click",e=>{e.preventDefault();main.focus();});
  route();
})();
