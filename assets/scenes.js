/*
 * scenes.js —— 情境實驗（Canvas）
 * 做法比照「波動與光學・學習筆記」：畫出看得懂的器材、可以直接拖曳、
 * 高 DPI 畫布、文字用 label() 自動夾在畫布內，並提供 ?selftest=1 檢查文字重疊。
 *
 * 磁鐵模型：兩端各一個磁極（磁通量 ±Q），加上磁鐵內部由 S 指向 N 的磁通量 Q。
 * 線圈磁通量用圓盤對磁極所張的立體角計算，單位 SI。
 */
(() => {
  const TAU = 2 * Math.PI;
  const C = {ink:"#17343e", muted:"#5b747d", grid:"#dbe7e9", teal:"#0f7a6a", amber:"#b3600f", blue:"#2a62b8",
    red:"#d9534a", redFill:"#f3a39d", blueFill:"#9dbcf2", copper:"#b9772f", copperDark:"#8a5520", paper:"#f7fbfb", violet:"#7a3fa3"};
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  /* ---------- 畫布工具 ---------- */
  function fitCanvas(canvas, cssH) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(280, Math.floor(canvas.clientWidth || canvas.parentElement.clientWidth));
    canvas.style.height = cssH + "px";
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(cssH * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(cssH * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return {ctx, w, h: cssH};
  }
  /* 文字一律經過 label()：夾在畫布內、可加底板，並記錄外框供 selftest 比對重疊。 */
  function makeLabeler(ctx, w, h) {
    const boxes = [];
    function label(text, x, y, {color = C.ink, size = 13, align = "center", bold = false, plate = false} = {}) {
      ctx.font = `${bold ? "700 " : ""}${size}px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif`;
      const tw = ctx.measureText(text).width, pad = 3;
      let left = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
      left = clamp(left, pad, w - tw - pad);
      const top = clamp(y - size * 0.8, pad, h - size - pad);
      if (plate) { ctx.fillStyle = "rgba(247,251,251,.88)"; ctx.fillRect(left - pad, top - 2, tw + 2 * pad, size + 5); }
      ctx.fillStyle = color; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic";
      ctx.fillText(text, left, top + size * 0.8);
      boxes.push({text, x: left, y: top, w: tw, h: size});
    }
    return {label, boxes};
  }
  function arrow(ctx, x0, y0, x1, y1, color, width = 2.4, head = 9) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy);
    if (n < 1) return;
    const ux = dx / n, uy = dy / n, hd = Math.min(head, n * 0.6);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1 - ux * hd * 0.6, y1 - uy * hd * 0.6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - ux * hd - uy * hd * 0.55, y1 - uy * hd + ux * hd * 0.55);
    ctx.lineTo(x1 - ux * hd + uy * hd * 0.55, y1 - uy * hd - ux * hd * 0.55); ctx.closePath(); ctx.fill();
  }

  /* ---------- 物理：磁極對圓形線圈的磁通量 ---------- */
  const Q = 2.0e-4;          // 每個磁極發出的磁通量（Wb）
  const R_COIL = 0.03;       // 線圈半徑（m）
  const L_MAG = 0.08;        // 磁鐵長（m）
  const GAP = 0.036;         // 馬蹄形兩極中心距（m）
  /* 圓盤（圓心在 x=xc 的軸上、法線 +x、半徑 R）對位於 (px,py,0) 的點所張立體角，帶正負號（點在左側為正）。 */
  function solidAngle(px, py, xc, R) {
    const dx = xc - px, hgt = Math.abs(dx), a = Math.abs(py), n = 96;
    if (hgt < 1e-9) return 0;
    let s = 0;
    if (a < R * 0.999) {
      for (let i = 0; i < n; i++) {
        const f = (i + 0.5) / n * TAU, rho = -a * Math.cos(f) + Math.sqrt(R * R - a * a * Math.sin(f) ** 2);
        s += 1 - hgt / Math.hypot(hgt, rho);
      }
      s *= TAU / n;
    } else if (a > R * 1.001) {
      const lim = Math.asin(R / a);
      for (let i = 0; i < n; i++) {
        const f = -lim + (i + 0.5) / n * 2 * lim, root = Math.sqrt(Math.max(0, R * R - a * a * Math.sin(f) ** 2));
        const r1 = a * Math.cos(f) - root, r2 = a * Math.cos(f) + root;
        s += hgt / Math.hypot(hgt, r1) - hgt / Math.hypot(hgt, r2);
      }
      s *= 2 * lim / n;
    } else {
      return (solidAngle(px, R * 0.99, xc, R) + solidAngle(px, R * 1.01, xc, R)) / 2;
    }
    return Math.sign(dx) * s;
  }
  /* 回傳磁極清單 [{x,y,q}] 與磁鐵本體線段（供內部磁通量與碰撞用）。 */
  function poles(st) {
    if (st.kind === "horseshoe") {
      return {list: [{x: st.x, y: st.y + GAP / 2, q: +1}, {x: st.x, y: st.y - GAP / 2, q: -1}], body: null};
    }
    const ux = Math.cos(st.angle), uy = Math.sin(st.angle), hl = L_MAG / 2;
    const N = {x: st.x + ux * hl, y: st.y + uy * hl, q: +1}, S = {x: st.x - ux * hl, y: st.y - uy * hl, q: -1};
    return {list: [N, S], body: [S, N]};
  }
  function flux(st, xc) {
    const {list, body} = poles(st);
    let phi = 0;
    for (const p of list) phi += p.q * Q / (4 * Math.PI) * solidAngle(p.x, p.y, xc, R_COIL);
    if (body) {
      const [S, N] = body;
      if ((S.x - xc) * (N.x - xc) < 0) {
        const t = (xc - S.x) / (N.x - S.x), y = S.y + t * (N.y - S.y);
        if (Math.abs(y) < R_COIL) phi += Q * Math.sign(N.x - S.x);
      }
    }
    return phi;
  }
  function fieldAt(list, x, y) {
    let bx = 0, by = 0;
    for (const p of list) {
      const dx = x - p.x, dy = y - p.y, d2 = dx * dx + dy * dy + 1e-7, d = Math.sqrt(d2);
      bx += p.q * dx / (d2 * d); by += p.q * dy / (d2 * d);
    }
    return [bx, by];
  }

  /* ---------- 情境：磁鐵與線圈 ---------- */
  const demos = [
    {id: "free", name: "自己拖曳", hint: "用滑鼠或手指抓住磁鐵移動；快一點、慢一點、停住，各看一次指針。"},
    {id: "h", name: "水平：靠近／遠離", hint: "N 極對著線圈來回。靠近與遠離時，指針偏向相反。"},
    {id: "v", name: "鉛直：靠近／遠離", hint: "磁鐵直立、中點對準線圈軸線。磁鐵明明在動，指針幾乎不動。"},
    {id: "spinLong", name: "沿長軸旋轉", hint: "像轉鉛筆一樣自轉。磁力線分布沒有改變。"},
    {id: "spinShort", name: "沿短軸旋轉", hint: "N、S 極輪流朝向線圈，指針左右來回擺：這就是交流電。"},
    {id: "shoe", name: "馬蹄形：兩極同時靠近", hint: "N 極出來的磁力線大多直接繞回 S 極，穿過線圈的一進一出互相抵消。"}
  ];
  const turnsChoices = [100, 300, 600];

  function mountMagnetCoil(root, opts = {}) {
    root.innerHTML = `
      <div class="scene-tabs" role="tablist" aria-label="示範動作">${demos.map((d, i) =>
        `<button type="button" role="tab" class="scene-tab" data-demo="${d.id}" aria-selected="${i === 0}">${d.name}</button>`).join("")}</div>
      <p class="scene-hint" id="scene-hint"></p>
      <div class="scene-stage"><canvas id="scene-canvas" aria-label="磁鐵、線圈與檢流計。可拖曳磁鐵。"></canvas></div>
      <div class="scene-controls">
        <button type="button" class="button primary" id="scene-play">暫停</button>
        <label class="scene-ctl">示範速度 <input type="range" id="scene-speed" min="0.3" max="2" step="0.1" value="1"><output id="scene-speed-out">1.0×</output></label>
        <label class="scene-ctl">線圈匝數 <select id="scene-turns">${turnsChoices.map(n => `<option value="${n}" ${n === 300 ? "selected" : ""}>${n} 匝</option>`).join("")}</select></label>
        <label class="scene-ctl"><input type="checkbox" id="scene-lines" checked> 顯示磁力線</label>
        <label class="scene-ctl"><input type="checkbox" id="scene-flip"> 磁極對調</label>
      </div>
      <dl class="scene-readouts">
        <div><dt>穿過線圈的磁通量 Φ（單匝）</dt><dd id="ro-phi">—</dd></div>
        <div><dt>感應電動勢 ε</dt><dd id="ro-emf">—</dd></div>
        <div><dt>感應電流（從磁鐵側看線圈）</dt><dd id="ro-dir">—</dd></div>
      </dl>
      <div class="scene-stage"><canvas id="scene-chart" aria-label="磁通量與感應電動勢隨時間變化"></canvas></div>
      <p class="muted small">模型：磁鐵兩端各視為一個磁極，線圈半徑 3 cm、磁鐵長 8 cm。磁力線只畫紙面上的分布；讀值為這個模型的數值，僅供比較大小。</p>`;
    const $ = id => root.querySelector("#" + id);
    const canvas = $("scene-canvas"), chart = $("scene-chart");
    const st = {kind: "bar", x: -0.10, y: 0, angle: 0, roll: 0, flip: false};
    let demo = "free", playing = true, speed = 1, turns = 300, showLines = true, tDemo = 0;
    let phi = 0, emf = 0, needle = 0, lastPhi = null, drag = null, raf = 0, lastTs = null, boxesLast = [];
    const hist = [];                         // {t, phi, emf}
    let tNow = 0;
    const XC = 0.05;                          // 線圈位置（m）
    const view = {w: 0, h: 0, s: 1, ox: 0, oy: 0};
    const toPx = (x, y) => [view.ox + x * view.s, view.oy - y * view.s];
    const toWorld = (px, py) => [(px - view.ox) / view.s, (view.oy - py) / view.s];

    function setDemo(id) {
      demo = id; tDemo = 0; st.roll = 0;
      st.kind = id === "shoe" ? "horseshoe" : "bar";
      st.y = 0; st.angle = id === "v" ? Math.PI / 2 : 0; st.x = id === "shoe" ? -0.06 : -0.10;
      if (id === "spinLong" || id === "spinShort") st.x = -0.012;
      lastPhi = null; hist.length = 0; emf = 0; needle = 0;
      for (const b of root.querySelectorAll(".scene-tab")) b.setAttribute("aria-selected", String(b.dataset.demo === id));
      $("scene-hint").textContent = demos.find(d => d.id === id).hint;
      playing = true; $("scene-play").textContent = "暫停";
      $("scene-play").hidden = id === "free";
    }
    function blocked(s) {
      // 磁鐵不能穿過線圈導線：線圈在紙面上的截面是 (XC, ±R) 兩點
      if (s.kind === "horseshoe") return s.x > XC - 0.012;
      const {body: [S, N]} = poles(s);
      for (const cy of [R_COIL, -R_COIL]) {
        const vx = N.x - S.x, vy = N.y - S.y, t = clamp(((XC - S.x) * vx + (cy - S.y) * vy) / (vx * vx + vy * vy), 0, 1);
        if (Math.hypot(S.x + t * vx - XC, S.y + t * vy - cy) < 0.0125) return true;
      }
      return false;
    }
    function stepDemo(dt) {
      if (demo === "free" || !playing) return;
      tDemo += dt * speed;
      const swing = 0.5 - 0.5 * Math.cos(tDemo * 1.6);       // 0→1→0
      if (demo === "h") st.x = -0.105 + 0.115 * swing;
      else if (demo === "v") st.x = -0.08 + 0.10 * swing;
      else if (demo === "shoe") st.x = -0.07 + 0.10 * swing;
      else if (demo === "spinLong") st.roll = tDemo * 3;
      else if (demo === "spinShort") st.angle = tDemo * 2.2;
    }

    /* ----- 繪圖 ----- */
    function drawBar(ctx) {
      const [cx, cy] = toPx(st.x, st.y), len = L_MAG * view.s, th = 0.018 * view.s;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(-st.angle);
      const north = st.flip ? -1 : 1;
      for (const side of [-1, 1]) {
        ctx.fillStyle = side * north > 0 ? C.redFill : C.blueFill;
        ctx.fillRect(side > 0 ? 0 : -len / 2, -th / 2, len / 2, th);
      }
      if (demo === "spinLong") {             // 自轉時的標記條，讓人看得出在轉
        ctx.strokeStyle = "rgba(23,52,62,.55)"; ctx.lineWidth = 2;
        for (let k = 0; k < 3; k++) {
          const ph = st.roll + k * TAU / 3, yy = Math.sin(ph) * th / 2;
          if (Math.cos(ph) > 0) { ctx.beginPath(); ctx.moveTo(-len / 2 + 4, yy); ctx.lineTo(len / 2 - 4, yy); ctx.stroke(); }
        }
      }
      ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.strokeRect(-len / 2, -th / 2, len, th);
      ctx.beginPath(); ctx.moveTo(0, -th / 2); ctx.lineTo(0, th / 2); ctx.stroke();
      ctx.restore();
      const ux = Math.cos(st.angle), uy = Math.sin(st.angle);
      for (const side of [-1, 1]) {
        const [lx, ly] = toPx(st.x + side * ux * L_MAG * 0.27, st.y + side * uy * L_MAG * 0.27);
        ctx.font = `700 ${Math.max(12, th * 0.62)}px system-ui,sans-serif`; ctx.fillStyle = C.ink;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(side * north > 0 ? "N" : "S", lx, ly);
      }
    }
    function drawShoe(ctx) {
      const s = view.s, w = 0.016 * s, g = GAP * s, arm = 0.07 * s, [tx, ty] = toPx(st.x, st.y);
      const north = st.flip ? -1 : 1, ro = g / 2 + w / 2, ri = g / 2 - w / 2, bx = tx - arm;
      for (const side of [-1, 1]) {            // side=-1 畫上臂（螢幕 y 較小）
        ctx.fillStyle = -side * north > 0 ? C.redFill : C.blueFill;
        ctx.beginPath();
        if (side < 0) { ctx.moveTo(tx, ty - ro); ctx.lineTo(bx, ty - ro); ctx.arc(bx, ty, ro, -Math.PI / 2, Math.PI, true);
          ctx.lineTo(bx - ri, ty); ctx.arc(bx, ty, ri, Math.PI, -Math.PI / 2, false); ctx.lineTo(tx, ty - ri); }
        else { ctx.moveTo(tx, ty + ro); ctx.lineTo(bx, ty + ro); ctx.arc(bx, ty, ro, Math.PI / 2, Math.PI, false);
          ctx.lineTo(bx - ri, ty); ctx.arc(bx, ty, ri, Math.PI, Math.PI / 2, true); ctx.lineTo(tx, ty + ri); }
        ctx.closePath(); ctx.fill(); ctx.strokeStyle = C.ink; ctx.lineWidth = 2; ctx.stroke();
        ctx.font = `700 ${Math.max(12, w * 0.7)}px system-ui,sans-serif`; ctx.fillStyle = C.ink; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(-side * north > 0 ? "N" : "S", tx - w * 0.9, ty + side * g / 2);
      }
    }
    function drawFieldLines(ctx) {
      const {list} = poles(st), sign = st.flip ? -1 : 1;
      const src = list.filter(p => p.q * sign > 0)[0], sink = list.filter(p => p.q * sign < 0)[0];
      const signed = [{...src, q: 1}, {...sink, q: -1}];
      const base = st.kind === "horseshoe" ? 0 : Math.atan2(src.y - sink.y, src.x - sink.x);
      ctx.strokeStyle = "rgba(15,122,106,.42)"; ctx.lineWidth = 1.2; ctx.fillStyle = "rgba(15,122,106,.7)";
      const n = 11, spread = st.kind === "horseshoe" ? 2.6 : 2.5;
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) / ((n - 1) / 2) * spread;
        let x = src.x + 0.004 * Math.cos(a), y = src.y + 0.004 * Math.sin(a);
        const pts = [[x, y]];
        for (let k = 0; k < 420; k++) {
          const [bx, by] = fieldAt(signed, x, y), b = Math.hypot(bx, by);
          if (!b) break;
          x += bx / b * 0.0018; y += by / b * 0.0018;
          if (Math.abs(x) > 0.2 || Math.abs(y) > 0.12) { pts.push([x, y]); break; }
          if (Math.hypot(x - sink.x, y - sink.y) < 0.004) { pts.push([sink.x, sink.y]); break; }
          pts.push([x, y]);
        }
        ctx.beginPath(); pts.forEach(([wx, wy], k) => { const [px, py] = toPx(wx, wy); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
        const m = Math.min(pts.length - 2, 26);
        if (m > 2) { const [ax, ay] = toPx(...pts[m - 2]), [bx2, by2] = toPx(...pts[m]); arrow(ctx, ax, ay, bx2, by2, "rgba(15,122,106,.75)", 1.2, 7); }
      }
    }
    function drawCoil(ctx, part) {
      const s = view.s, ry = R_COIL * s, rx = ry * 0.26, k = 7, pitch = 0.0032 * s;
      for (let i = 0; i < k; i++) {
        const [cx, cy] = toPx(XC + (i - (k - 1) / 2) * 0.0032, 0);
        ctx.beginPath();
        if (part === "back") { ctx.ellipse(cx, cy, rx, ry, 0, Math.PI / 2, 1.5 * Math.PI); ctx.strokeStyle = C.copperDark; ctx.lineWidth = Math.max(2, pitch * 0.55); }
        else { ctx.ellipse(cx, cy, rx, ry, 0, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = C.copper; ctx.lineWidth = Math.max(2.4, pitch * 0.7); }
        ctx.stroke();
      }
    }
    function drawMeter(ctx, L) {
      const s = view.s, mw = clamp(view.w * 0.2, 96, 150), mh = mw * 0.74;
      const mx = view.w - mw - 12, my = 12, cxm = mx + mw / 2, cym = my + mh * 0.86, r = mh * 0.62;
      // 導線：線圈下緣 → 檢流計
      const [cx, cyBottom] = toPx(XC, -R_COIL), [, cyTop] = toPx(XC, R_COIL);
      ctx.strokeStyle = "#444"; ctx.lineWidth = 1.6; ctx.beginPath();
      ctx.moveTo(cx + 0.012 * s, cyTop + 4); ctx.lineTo(cx + 0.012 * s, cyTop - 10); ctx.lineTo(mx + mw * 0.3, cyTop - 10); ctx.lineTo(mx + mw * 0.3, my + mh);
      ctx.moveTo(cx - 0.012 * s, cyBottom - 4); ctx.lineTo(cx - 0.012 * s, cyBottom + 12); ctx.lineTo(mx + mw * 0.7, cyBottom + 12); ctx.lineTo(mx + mw * 0.7, my + mh); ctx.stroke();
      ctx.fillStyle = "#fff"; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 8); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.muted; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cxm, cym, r, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      for (let i = -4; i <= 4; i++) {
        const a = -Math.PI / 2 + i * 0.235, inner = i % 2 ? r * 0.92 : r * 0.86;
        ctx.beginPath(); ctx.moveTo(cxm + Math.cos(a) * inner, cym + Math.sin(a) * inner); ctx.lineTo(cxm + Math.cos(a) * r, cym + Math.sin(a) * r); ctx.stroke();
      }
      const a = -Math.PI / 2 + clamp(needle, -1, 1) * 0.94;
      ctx.strokeStyle = C.red; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(cxm, cym); ctx.lineTo(cxm + Math.cos(a) * r * 0.95, cym + Math.sin(a) * r * 0.95); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cxm, cym, 3, 0, TAU); ctx.fill();
      L.label("檢流計", cxm, my + mh + 16, {size: 12, color: C.muted});
      L.label("0", cxm, cym - r - 5, {size: 11, color: C.muted});
    }
    function draw() {
      const {ctx, w, h} = fitCanvas(canvas, EM.sceneKit.stageHeight(canvas, 0.5, 250, 420));
      view.w = w; view.h = h; view.s = w / 0.34; view.ox = w * 0.5 + 0.015 * view.s; view.oy = h * 0.54;
      const L = makeLabeler(ctx, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      // 線圈軸線
      ctx.strokeStyle = "#b9c9cc"; ctx.setLineDash([6, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, view.oy); ctx.lineTo(w - 8, view.oy); ctx.stroke(); ctx.setLineDash([]);
      if (showLines) drawFieldLines(ctx);
      drawCoil(ctx, "back");
      st.kind === "horseshoe" ? drawShoe(ctx) : drawBar(ctx);
      drawCoil(ctx, "front");
      // 感應電流箭頭：畫在線圈「面向讀者」的那一側
      const I = -emf, [cx, cy] = toPx(XC, 0), ry = R_COIL * view.s;
      if (Math.abs(needle) > 0.06) {
        const dir = Math.sign(I), x = cx + ry * 0.26 + 0.019 * view.s, len = clamp(Math.abs(needle), 0.25, 1) * ry * 0.9;
        arrow(ctx, x, cy + dir * len / 2, x, cy - dir * len / 2, C.violet, 3, 11);
        L.label("感應電流", x + 8, cy + ry + 2, {size: 12, color: C.violet, align: "left", plate: true});
      }
      drawMeter(ctx, L);
      L.label("線圈", cx, cy - ry - 22, {size: 12, color: C.copperDark, plate: true});
      if (demo === "free") L.label("↔ 拖曳磁鐵", 12, h - 10, {size: 12, color: C.muted, align: "left"});
      boxesLast = L.boxes;
    }
    function drawChart() {
      const {ctx, w, h} = fitCanvas(chart, 190);
      const L = makeLabeler(ctx, w, h);
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      const x0 = 58, x1 = w - 14, span = 6, rows = [
        {key: "phi", name: "磁通量 Φ", color: C.teal, max: 1.7e-4, top: 22, bot: 92},
        {key: "emf", name: "感應電動勢 ε", color: C.amber, max: 0.09, top: 112, bot: 182}];
      for (const r of rows) {
        const mid = (r.top + r.bot) / 2, half = (r.bot - r.top) / 2;
        ctx.strokeStyle = C.grid; ctx.lineWidth = 1; ctx.strokeRect(x0, r.top, x1 - x0, r.bot - r.top);
        ctx.strokeStyle = "#9fb4b9"; ctx.beginPath(); ctx.moveTo(x0, mid); ctx.lineTo(x1, mid); ctx.stroke();
        L.label(r.name, x0 + 6, r.top - 5, {size: 12, color: r.color, align: "left", bold: true});
        L.label("0", x0 - 8, mid + 4, {size: 11, color: C.muted, align: "right"});
        L.label("＋", x0 - 8, r.top + 12, {size: 11, color: C.muted, align: "right"});
        L.label("－", x0 - 8, r.bot - 2, {size: 11, color: C.muted, align: "right"});
        ctx.strokeStyle = r.color; ctx.lineWidth = 2; ctx.beginPath();
        let started = false;
        for (const p of hist) {
          const px = x1 - (tNow - p.t) / span * (x1 - x0);
          if (px < x0) continue;
          const py = mid - clamp(p[r.key] / r.max, -1, 1) * half;
          started ? ctx.lineTo(px, py) : ctx.moveTo(px, py); started = true;
        }
        ctx.stroke();
      }
      L.label("最近 6 秒 →", x1, h - 2, {size: 11, color: C.muted, align: "right"});
    }
    function readouts() {
      $("ro-phi").textContent = (phi * 1e6).toFixed(0) + " μWb";
      $("ro-emf").textContent = (Math.abs(emf) < 5e-4 ? 0 : emf * 1000).toFixed(0) + " mV";
      $("ro-dir").textContent = Math.abs(needle) < 0.06 ? "沒有電流" : emf < 0 ? "逆時針" : "順時針";
    }
    function frame(ts) {
      raf = requestAnimationFrame(frame);
      const dt = lastTs === null ? 0 : clamp((ts - lastTs) / 1000, 0, 0.05); lastTs = ts;
      if (dt > 0) advance(dt);
      draw(); drawChart(); readouts();
    }
    function advance(dt) {
      stepDemo(dt);
      tNow += dt;
      const sign = st.flip ? -1 : 1, now = sign * flux(st, XC);
      const raw = lastPhi === null ? 0 : -turns * (now - lastPhi) / dt;
      lastPhi = now; phi = now;
      emf += (raw - emf) * clamp(dt / 0.06, 0, 1);                 // 輕微平滑，避免手抖造成雜訊
      const target = clamp(-emf / 0.06, -1.15, 1.15);
      needle += (target - needle) * clamp(dt / 0.09, 0, 1);         // 指針阻尼
      hist.push({t: tNow, phi, emf});
      while (hist.length && tNow - hist[0].t > 6.2) hist.shift();
    }

    /* ----- 互動 ----- */
    const pointerPos = e => { const r = canvas.getBoundingClientRect(); return toWorld(e.clientX - r.left, e.clientY - r.top); };
    function hit(wx, wy) {
      if (st.kind === "horseshoe") return wx < st.x + 0.01 && wx > st.x - 0.09 && Math.abs(wy - st.y) < 0.035;
      const ux = Math.cos(st.angle), uy = Math.sin(st.angle), dx = wx - st.x, dy = wy - st.y;
      return Math.abs(dx * ux + dy * uy) < L_MAG / 2 + 0.008 && Math.abs(-dx * uy + dy * ux) < 0.017;
    }
    const onDown = e => {
      const [wx, wy] = pointerPos(e);
      if (!hit(wx, wy)) return;
      if (demo !== "free") { const keep = {kind: st.kind, x: st.x, y: st.y, angle: st.angle}; setDemo("free"); Object.assign(st, keep); }
      drag = {dx: st.x - wx, dy: st.y - wy}; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; e.preventDefault();
    };
    const onMove = e => {
      const [wx, wy] = pointerPos(e);
      if (!drag) { canvas.style.cursor = hit(wx, wy) ? "grab" : "default"; return; }
      const next = {...st, x: clamp(wx + drag.dx, -0.15, 0.16), y: clamp(wy + drag.dy, -0.075, 0.075)};
      if (!blocked(next)) { st.x = next.x; st.y = next.y; }
      else { const slide = {...st, x: next.x}; if (!blocked(slide)) st.x = slide.x; }
    };
    const onUp = () => { drag = null; canvas.style.cursor = "default"; };
    canvas.addEventListener("pointerdown", onDown); canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp); canvas.addEventListener("pointercancel", onUp);
    canvas.style.touchAction = "none";
    root.querySelector(".scene-tabs").addEventListener("click", e => { const b = e.target.closest("[data-demo]"); if (b) setDemo(b.dataset.demo); });
    $("scene-play").addEventListener("click", () => { playing = !playing; $("scene-play").textContent = playing ? "暫停" : "播放"; });
    $("scene-speed").addEventListener("input", e => { speed = +e.target.value; $("scene-speed-out").textContent = speed.toFixed(1) + "×"; });
    $("scene-turns").addEventListener("change", e => { turns = +e.target.value; });
    $("scene-lines").addEventListener("change", e => { showLines = e.target.checked; });
    $("scene-flip").addEventListener("change", e => { st.flip = e.target.checked; lastPhi = null; });
    setDemo(opts.demo && demos.some(d => d.id === opts.demo) ? opts.demo : "free");
    raf = requestAnimationFrame(frame);

    const api = {
      /* 供 ?selftest=1 與檢查腳本使用：不靠畫面時鐘，直接推進模型 */
      setDemo, step(dt, n = 1) { for (let i = 0; i < n; i++) advance(dt); draw(); drawChart(); readouts(); },
      state: () => ({phi, emf, needle, x: st.x, angle: st.angle}), boxes: () => boxesLast, place(x, y, angle) { st.x = x; st.y = y; if (angle !== undefined) st.angle = angle; }
    };
    root.sceneApi = api;
    return () => { cancelAnimationFrame(raf); };
  }

  /* 文字外框兩兩比對，回傳重疊的組合（selftest 用） */
  function overlaps(boxes) {
    const out = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push([a.text, b.text]);
    }
    return out;
  }

  const scenes = [{
    id: "magnet-coil", title: "磁鐵與線圈：什麼時候有感應電流？", sections: ["3-1", "3-2"],
    lead: "磁鐵在動，就一定會有感應電流嗎？",
    description: "拖曳磁鐵，或播放六種示範動作，同時看檢流計、磁通量與感應電動勢。",
    steps: [
      "先自己拖曳磁鐵：靠近、停住、遠離。指針什麼時候偏？偏向哪一邊？",
      "依序播放「水平」「鉛直」「沿長軸旋轉」「沿短軸旋轉」「馬蹄形」，記下哪幾種指針幾乎不動。",
      "對照下方圖表：指針不動的時候，磁通量 Φ 的曲線有什麼共同點？",
      "把匝數改成 600 匝、或把示範速度調快，感應電動勢怎麼變？"],
    takeaway: "穿過線圈的磁通量「改變」才有感應電動勢：ε = −N ΔΦ/Δt。磁鐵有沒有在動不是重點。",
    mount: mountMagnetCoil
  }];

  function mountScene(main, scene, demo) {
    main.innerHTML = `<div class="shell page lab-page scene-page">
      <div class="breadcrumbs"><a href="#labs">電磁實驗室</a><span>/</span><span>情境實驗</span></div>
      <div class="page-head"><p class="eyebrow">情境實驗・${scene.sections.join("、")}</p><h1>${scene.title}</h1></div>
      <div class="lab-observation"><strong>帶著一個問題看</strong><p>${scene.lead}</p></div>
      <div id="scene-root" class="scene-root"></div>
      <div class="lab-notes">
        <div class="panel"><h2>照著做</h2><ol>${scene.steps.map(s => `<li>${s}</li>`).join("")}</ol></div>
        <div class="panel"><h2>看完要能說</h2><p>${scene.takeaway}</p>${scene.sections.map(s => `<a class="text-link" href="#course/${s}">回到 ${s} 導讀 ↗</a>`).join("　")}</div>
      </div></div>`;
    const root = main.querySelector("#scene-root");
    const dispose = scene.mount(root, {demo});
    const bar = document.createElement("div"); bar.className = "scene-fullbar"; root.prepend(bar);
    const unfull = EM.sceneKit.fullscreenButton(root, bar, {title: scene.title});
    if (new URLSearchParams(location.search).has("selftest")) window.__sceneRoot = root;
    return () => { unfull(); dispose && dispose(); };
  }

  EM.scenes = (EM.scenes || []).concat(scenes.map(x => ({...x, chapter: 3})));
  // 依章節排序：第 1、2、3 章
  EM.scenes.sort((a, b) => a.sections[0].localeCompare(b.sections[0]));
  EM.mountScene = mountScene;
  EM.sceneOverlaps = EM.sceneOverlaps || overlaps;
})();
