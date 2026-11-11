/*
 * scenes-magnet.js —— 第 2 章情境實驗：帶電粒子在均勻磁場中、直流電動機
 */
(() => {
  const E_CHARGE = 1.602e-19, U = 1.6605e-27, M_E = 9.109e-31;
  const {TAU, C, clamp, stageHeight, fitCanvas, makeLabeler, arrow, vector, grid, fieldGlyph, num, chart, build, draggable, loop} = EM.sceneKit;

  /* =====================================================================
   * 帶電粒子在均勻磁場中
   * ===================================================================== */
  const kinds = {
    proton: {name: "質子（+e，1 u）", q: E_CHARGE, m: 1.0073 * U, B: 2},
    deuteron: {name: "氘核（+e，2 u）", q: E_CHARGE, m: 2.0136 * U, B: 2},
    alpha: {name: "α 粒子（+2e，4 u）", q: 2 * E_CHARGE, m: 4.0015 * U, B: 2},
    electron: {name: "電子（−e）", q: -E_CHARGE, m: M_E, B: -1}
  };
  function mountBParticle(root) {
    const bFmt = v => { const b = 10 ** v; return b >= 1000 ? num(b / 1000) + " T" : num(b) + " mT"; };
    const ui = build(root, {
      tabs: [{id: "enter", name: "從磁場外射入"}, {id: "inside", name: "在磁場中繞圈"}],
      controls: [
        {type: "select", id: "kind", label: "粒子", value: "proton", options: Object.entries(kinds).map(([k, p]) => [k, p.name])},
        {type: "range", id: "v", label: "速率 v", min: 1, max: 30, step: 1, value: 10, fmt: v => `${v} × 10⁵ m/s`},
        {type: "range", id: "B", label: "磁場 B", min: -1, max: 3, step: 0.05, value: 2, fmt: bFmt},
        {type: "select", id: "dir", label: "磁場方向", value: "in", options: [["in", "⊗ 射入紙面"], ["out", "⊙ 射出紙面"]]},
        {type: "check", id: "circle", label: "畫出圓心與半徑", value: true},
        {type: "buttons", items: [{id: "fire", label: "重新發射", primary: true}, {id: "pause", label: "暫停"}]}
      ],
      readouts: [["r", "軌道半徑 r = mv/|q|B"], ["T", "週期 T = 2πm/|q|B"], ["F", "磁力大小 F = |q|vB"], ["turn", "偏轉方向"]],
      note: "磁場區域內畫滿 ⊗ 或 ⊙。綠色是速度、紅色是磁力；兩者永遠垂直，所以磁力只改變方向、不改變速率。動畫中一個週期約 4 秒。"
    });
    const cv = ui.canvas;
    let mode = "enter", st = null, trail = [], paused = false, boxes = [], view = {s: 20, w: 800, h: 460};
    const BX0 = 10;                                      // 磁場左邊界（cm），enter 模式
    const params = () => {
      const p = kinds[ui.get("kind")], B = 10 ** ui.get("B") / 1000, v = ui.get("v") * 1e5, Bz = ui.get("dir") === "out" ? B : -B;
      return {p, B, Bz, v, r: p.m * v / (Math.abs(p.q) * B), T: TAU * p.m / (Math.abs(p.q) * B), F: Math.abs(p.q) * v * B};
    };
    const inField = x => mode === "inside" || x >= BX0;
    function launch() {
      const H = view.h / view.s;
      // 在磁場中：讓圓心落在畫面中央（順時針時圓心在下方，逆時針在上方）
      const P = params(), cw = P.p.q * P.Bz > 0;
      const edge = H / 2 - 1.5, enterY = (cw ? 1 : -1) * (P.r * 100 * 2 < 2 * edge ? edge - Math.max(0, edge - P.r * 100 * 2) / 2 : edge);
      st = mode === "enter" ? {x: 1, y: enterY, vx: 1, vy: 0} : {x: 20, y: (cw ? 1 : -1) * Math.min(P.r * 100, H / 2 - 1), vx: 1, vy: 0};
      trail = [[st.x, st.y]];
      paused = false; root.querySelector("#kc-pause").textContent = "暫停";
    }
    function step(dt) {
      if (!st || paused) return;
      const P = params(), rcm = P.r * 100, speed = TAU * rcm / 4;   // cm/s：動畫中一個週期 4 秒
      const w = view.w / view.s, H = view.h / view.s;
      let rem = dt;
      while (rem > 0) {
        const h = Math.min(rem, 0.004); rem -= h;
        if (inField(st.x)) {
          const om = -Math.sign(P.p.q * P.Bz) * speed / rcm * h;  // 由 F = qv × B，q·Bz > 0 時順時針（y 向上座標）
          const c = Math.cos(om), s = Math.sin(om), vx = st.vx * c - st.vy * s, vy = st.vx * s + st.vy * c;
          st.vx = vx; st.vy = vy;
        }
        st.x += st.vx * speed * h; st.y += st.vy * speed * h;
      }
      trail.push([st.x, st.y]); if (trail.length > 4000) trail.shift();
      if (st.x < -1 || st.x > w + 1 || Math.abs(st.y) > H / 2 + 1) { paused = true; }
    }
    function draw() {
      const h = stageHeight(cv, 0.55, 300, 520);
      const {ctx, w} = fitCanvas(cv, h);
      view = {s: w / 40, w, h};
      const s = view.s, cy = h / 2, P = (x, y) => [x * s, cy - y * s], L = makeLabeler(ctx, w, h), pr = params(), out = pr.Bz > 0;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      grid(ctx, w, h, s, 0, cy % s, 5);
      const bx = mode === "enter" ? BX0 * s : 0;
      ctx.fillStyle = "rgba(77,127,214,.07)"; ctx.fillRect(bx, 0, w - bx, h);
      if (mode === "enter") { ctx.strokeStyle = "rgba(77,127,214,.6)"; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(bx + .5, 0); ctx.lineTo(bx + .5, h); ctx.stroke(); ctx.setLineDash([]); }
      const gs = 2.5 * s;
      for (let x = bx + gs / 2; x < w; x += gs) for (let y = gs / 2; y < h; y += gs) fieldGlyph(ctx, x, y, out, 5, "rgba(77,127,214,.55)");
      L.label(`B ${out ? "⊙ 出紙面" : "⊗ 入紙面"}`, w - 8, 18, {size: 12, color: C.field, align: "right", bold: true, plate: true});
      if (ui.get("circle") && st) {
        const rcm = pr.r * 100;
        if (rcm < 400) {
          // 圓心在速度的左側（逆時針轉）或右側（順時針轉）
          const sense = -Math.sign(pr.p.q * pr.Bz), cx = st.x - sense * st.vy * rcm, cyw = st.y + sense * st.vx * rcm;
          if (inField(st.x)) {
            const [a, b] = P(cx, cyw);
            ctx.save(); ctx.beginPath(); ctx.rect(bx, 0, w - bx, h); ctx.clip();      // 只在磁場區域內畫圓
            ctx.strokeStyle = "rgba(122,63,163,.35)"; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(a, b, rcm * s, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
            ctx.restore();
            const [px, py] = P(st.x, st.y);
            ctx.strokeStyle = "rgba(122,63,163,.8)"; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(px, py); ctx.stroke();
            ctx.fillStyle = C.violet; ctx.beginPath(); ctx.arc(a, b, 3, 0, TAU); ctx.fill();
            L.label(`r = ${num(rcm)} cm`, a, b + (b < h / 2 ? 18 : -10), {size: 12, color: C.violet, plate: true});
          }
        }
      }
      ctx.strokeStyle = pr.p.q > 0 ? C.red : C.blue; ctx.lineWidth = 2.2; ctx.beginPath();
      trail.forEach(([x, y], k) => { const [a, b] = P(x, y); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke();
      if (st) {
        const [px, py] = P(st.x, st.y);
        arrow(ctx, px, py, px + st.vx * 46, py - st.vy * 46, C.green, 2.8, 10);
        L.label("v", px + st.vx * 56, py - st.vy * 56 + 4, {size: 13, color: C.green, bold: true, plate: true});
        if (inField(st.x)) {
          const sense = -Math.sign(pr.p.q * pr.Bz), fx = -sense * st.vy, fy = sense * st.vx;
          arrow(ctx, px, py, px + fx * 36, py - fy * 36, C.red, 2.8, 10);
          L.label("F", px + fx * 46, py - fy * 46 + 4, {size: 13, color: C.red, bold: true, plate: true});
        }
        ctx.fillStyle = pr.p.q > 0 ? C.red : C.blue; ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, 6, 0, TAU); ctx.fill(); ctx.stroke();
      }
      L.label("1 格 = 1 cm", 8, h - 8, {size: 11, color: C.muted, align: "left", plate: true});
      boxes = L.boxes;
    }
    function readouts() {
      const P = params();
      ui.ro("r", num(P.r * 100) + " cm"); ui.ro("T", num(P.T) + " s"); ui.ro("F", num(P.F) + " N");
      ui.ro("turn", P.p.q * P.Bz > 0 ? "順時針" : "逆時針");
    }
    function setMode(m) { mode = m; ui.tab(m); ui.hint(m === "enter" ? "粒子從左邊射入磁場，轉半圈後離開。改變 B 或 v，比較入射點與出射點的距離（= 2r）。" : "在磁場中央繞圈。改變速率 v，週期 T 會變嗎？"); launch(); readouts(); }
    ui.on("kind", () => { ui.set("B", kinds[ui.get("kind")].B); readouts(); launch(); });
    for (const id of ["v", "B", "dir"]) ui.on(id, () => { readouts(); launch(); });
    ui.on("fire", launch);
    ui.on("pause", () => { paused = !paused; root.querySelector("#kc-pause").textContent = paused ? "繼續" : "暫停"; });
    ui.onTab(setMode);
    const stop = loop(dt => { step(dt); draw(); });
    draw(); setMode("enter");
    root.sceneApi = {boxes: () => boxes, params, step(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); draw(); }, state: () => ({...st}), trail: () => trail.slice(), launch};
    return stop;
  }

  /* =====================================================================
   * 直流電動機
   * ===================================================================== */
  function mountMotor(root) {
    const ui = build(root, {
      controls: [
        {type: "range", id: "I", label: "電流 I", min: 0, max: 3, step: 0.1, value: 1.5, unit: "A"},
        {type: "range", id: "B", label: "磁場 B", min: 0, max: 0.5, step: 0.05, value: 0.3, unit: "T"},
        {type: "range", id: "N", label: "線圈匝數 N", min: 1, max: 50, step: 1, value: 20, unit: "匝"},
        {type: "check", id: "comm", label: "使用換向器（電刷＋半圓環）", value: true},
        {type: "buttons", items: [{id: "power", label: "斷電", primary: true}, {id: "reset", label: "重新開始"}]}
      ],
      readouts: [["ang", "線圈平面與磁場的夾角"], ["F", "每一邊受力 F = NILB"], ["tau", "力矩 τ"], ["rpm", "轉速"]],
      chart: true,
      note: "視角沿著轉軸看：線圈的兩邊垂直紙面，⊙ 表示電流流出紙面、⊗ 表示流入。線圈長 5 cm、寬 4 cm；轉動時有摩擦。"
    });
    const cv = ui.canvas, Lw = 0.05, Wd = 0.04, A = Lw * Wd, J = 2.7e-3, b = 1.8e-3;
    let th = 20 * Math.PI / 180, om = 0, on = true, boxes = [];
    const sA = () => ui.get("comm") ? (Math.cos(th) >= 0 ? 1 : -1) : 1;      // 邊 A 的電流方向：+1 出紙面
    const torque = () => on ? ui.get("N") * ui.get("I") * A * ui.get("B") * Math.cos(th) * sA() : 0;
    function step(dt) {
      for (let k = 0; k < 10; k++) { const h = dt / 10; om += (torque() - b * om) / J * h; th += om * h; }
      th = ((th % TAU) + TAU) % TAU;
    }
    function draw() {
      const h = stageHeight(cv, 0.5, 300, 460);
      const {ctx, w} = fitCanvas(cv, h), L = makeLabeler(ctx, w, h);
      const cx = w * 0.42, cy = h * 0.53, R = Math.min(w * 0.2, h * 0.3), gap = R + 34;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      // 磁鐵
      for (const [x0, fill, txt] of [[cx - gap - 70, "#e8908a", "N"], [cx + gap, "#8fb0e8", "S"]]) {
        ctx.fillStyle = fill; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(x0, cy - R - 30, 70, 2 * R + 60, 6); ctx.fill(); ctx.stroke();
        L.label(txt, x0 + 35, cy + 9, {size: 26, bold: true});
      }
      if (ui.get("B") > 0) for (let k = -2; k <= 2; k++) {
        const y = cy + k * R * 0.5;
        arrow(ctx, cx - gap + 4, y, cx + gap - 6, y, "rgba(77,127,214,.4)", 1.3, 8);
      }
      L.label("B", cx + gap - 18, cy - R * 1.0 - 8, {size: 14, color: C.field, bold: true});
      // 轉軸與線圈
      const ax = cx + R * Math.cos(th), ay = cy - R * Math.sin(th), bx = cx - R * Math.cos(th), by = cy + R * Math.sin(th);
      ctx.strokeStyle = "rgba(91,116,125,.35)"; ctx.setLineDash([4, 5]); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      ctx.strokeStyle = C.copper; ctx.lineWidth = 6; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      ctx.fillStyle = C.ink; ctx.beginPath(); ctx.arc(cx, cy, 4, 0, TAU); ctx.fill();
      const I = on ? ui.get("I") : 0, s = sA(), F = ui.get("N") * I * Lw * ui.get("B");
      for (const [x, y, sign, name] of [[ax, ay, s, "a"], [bx, by, -s, "b"]]) {
        ctx.fillStyle = "#fff"; ctx.strokeStyle = C.copperDark; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, 13, 0, TAU); ctx.fill(); ctx.stroke();
        if (I > 0) {
          ctx.fillStyle = C.ink; ctx.strokeStyle = C.ink; ctx.lineWidth = 2;
          if (sign > 0) { ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); }
          else { ctx.beginPath(); ctx.moveTo(x - 6, y - 6); ctx.lineTo(x + 6, y + 6); ctx.moveTo(x + 6, y - 6); ctx.lineTo(x - 6, y + 6); ctx.stroke(); }
          // F = IL × B：B 向右；電流出紙面時受力向上
          const len = clamp(F / 0.05 * 70, 0, 110);
          if (len > 2) { arrow(ctx, x, y - sign * 15, x, y - sign * (15 + len), C.red, 3, 11); L.label("F", x + 14, y - sign * (15 + len * .7), {size: 13, color: C.red, bold: true, align: "left", plate: true}); }
        }
        L.label(name, x + (x >= cx ? 20 : -20), y + 18, {size: 12, color: C.copperDark, bold: true});
      }
      // 換向器小圖
      const kx = w - Math.min(90, w * .12), ky = Math.min(78, h * .2), kr = Math.min(34, w * .045);
      if (ui.get("comm")) {
        for (const [start, fill] of [[th - Math.PI / 2, "#e2a35f"], [th + Math.PI / 2, "#c9d1d4"]]) {
          ctx.fillStyle = fill; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(kx, ky, kr, -start - Math.PI + 0.12, -start - 0.12, false); ctx.arc(kx, ky, kr * .55, -start - 0.12, -start - Math.PI + 0.12, true); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        for (const [dx, sign] of [[1, "+"], [-1, "−"]]) {
          ctx.fillStyle = "#555"; ctx.fillRect(kx + dx * (kr + 2) - (dx > 0 ? 0 : 12), ky - 6, 12, 12);
          L.label(sign, kx + dx * (kr + 22), ky + 5, {size: 14, color: sign === "+" ? C.red : C.blue, bold: true});
        }
        L.label("換向器（從同一方向看）", kx, ky + kr + 22, {size: 11, color: C.muted});
      } else L.label("沒有換向器：電流方向固定", w - 10, 22, {size: 12, color: C.muted, align: "right", plate: true});
      if (!on) L.label("已斷電", cx, 20, {size: 13, color: C.muted, bold: true, plate: true});
      boxes = L.boxes;
    }
    function drawChart() {
      const K = ui.get("N") * ui.get("I") * A * ui.get("B"), comm = ui.get("comm"), pts = [], top = Math.max(K, 1e-4) * 1.15;
      for (let d = 0; d <= 360; d += 2) { const c = Math.cos(d * Math.PI / 180); pts.push([d, on ? K * (comm ? Math.abs(c) : c) : 0]); }
      const deg = th * 180 / Math.PI;
      chart(ui.chart, {h: 190, xMin: 0, xMax: 360, yMin: comm ? -top * .25 : -top, yMax: top, xLabel: "線圈轉過的角度 θ（度）", yLabel: "τ（N·m）",
        series: [{points: pts, color: C.amber}], markers: [{x: deg, y: torque(), color: C.amber}], vlines: [{x: 90}, {x: 270}],
        note: comm ? "在 90°、270° 換向，力矩不變號" : "力矩正負交替，線圈只會來回擺"});
    }
    function readouts() {
      let rel = (th * 180 / Math.PI) % 180; if (rel > 90) rel = 180 - rel;
      ui.ro("ang", rel.toFixed(0) + "°");
      ui.ro("F", num(on ? ui.get("N") * ui.get("I") * Lw * ui.get("B") : 0) + " N");
      ui.ro("tau", num(Math.abs(torque())) + " N·m");
      ui.ro("rpm", num(Math.abs(om) * 60 / TAU, 2) + " rpm");
    }
    ui.on("power", () => { on = !on; root.querySelector("#kc-power").textContent = on ? "斷電" : "通電"; });
    ui.on("reset", () => { th = 20 * Math.PI / 180; om = 0; on = true; root.querySelector("#kc-power").textContent = "斷電"; });
    ui.hint("通電後線圈開始轉。關掉換向器再重新開始，線圈還會一直轉嗎？");
    const stop = loop(dt => { step(dt); draw(); drawChart(); readouts(); });
    root.sceneApi = {boxes: () => boxes, torque, step(dt, n = 1) { for (let i = 0; i < n; i++) step(dt); draw(); }, state: () => ({th, om}), set(t, o = 0) { th = t; om = o; }};
    return stop;
  }

  EM.scenes.push(
    {id: "b-particle", title: "帶電粒子在均勻磁場中", sections: ["2-4"], chapter: 2,
      lead: "磁力會讓帶電粒子加速嗎？速率加倍，繞一圈的時間會變嗎？",
      description: "選粒子、調速率與磁場，看圓周軌跡、半徑與週期；速度與磁力永遠垂直。",
      steps: ["速率 v 加倍，半徑 r 與週期 T 各變成幾倍？", "磁場 B 加倍呢？", "質子換成電子，偏轉方向怎麼變？半徑為什麼差那麼多？（記得電子的磁場要調小）", "把磁場方向從 ⊗ 改成 ⊙，用右手定則預測軌跡再驗證。"],
      takeaway: "F = qv × B 永遠垂直速度，所以粒子做等速率圓周運動：r = mv/|q|B，T = 2πm/|q|B 與速率無關。",
      mount: mountBParticle},
    {id: "dc-motor", title: "直流電動機：力矩與換向器", sections: ["2-3"], chapter: 2,
      lead: "線圈為什麼能一直朝同一方向轉？換向器做了什麼？",
      description: "從轉軸方向看線圈兩邊的受力與力矩，比較有、沒有換向器的差別。",
      steps: ["線圈平面與磁場平行時，力矩最大還是最小？垂直時呢？", "看換向器小圖：線圈轉到哪個位置時電流換向？", "關掉換向器，按「重新開始」，線圈最後停在哪裡？為什麼？", "電流、磁場或匝數加倍，力矩變成幾倍？"],
      takeaway: "每一邊受力 F = NILB，力矩 τ = NIAB cos θ（θ 為線圈平面與 B 的夾角）。換向器在力矩為 0 的位置把電流反向，力矩就不會變號。",
      mount: mountMotor}
  );
})();
