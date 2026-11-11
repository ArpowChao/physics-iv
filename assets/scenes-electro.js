/*
 * scenes-electro.js —— 第 1 章情境實驗：庫侖定律、電場與電位、平行板間的偏轉
 * 世界座標單位一律為 cm，物理量以 SI 計算後換成習慣單位顯示。
 */
(() => {
  const K = 8.988e9, E_CHARGE = 1.602e-19, M_E = 9.109e-31, M_P = 1.673e-27;
  const {TAU, C, clamp, fitCanvas, makeLabeler, arrow, vector, grid, charge, overlaps, num, niceStep, chart, build, draggable, loop} = EM.sceneKit;

  /* =====================================================================
   * 庫侖定律
   * ===================================================================== */
  function mountCoulomb(root) {
    const ui = build(root, {
      tabs: [{id: "two", name: "兩個電荷"}, {id: "three", name: "三個電荷：力的合成"}],
      controls: [
        {type: "range", id: "q1", label: "q₁", min: -5, max: 5, step: 0.5, value: 2, unit: "μC"},
        {type: "range", id: "q2", label: "q₂", min: -5, max: 5, step: 0.5, value: -2, unit: "μC"},
        {type: "range", id: "q3", label: "q₃", min: -5, max: 5, step: 0.5, value: 1, unit: "μC"},
        {type: "select", id: "scale", label: "力的比例尺（每 1 cm 格）", value: "1", options: [["0.5", "0.5 N"], ["1", "1 N"], ["2", "2 N"], ["5", "5 N"], ["20", "20 N"]]},
        {type: "check", id: "parts", label: "顯示分力（三電荷時）", value: true},
        {type: "select", id: "axis", label: "圖表橫軸", value: "r", options: [["r", "距離 r"], ["inv", "1 ⁄ r²"]]},
        {type: "buttons", items: [{id: "reset", label: "恢復初始位置"}]}
      ],
      readouts: [["a", "兩電荷距離 r"], ["b", "靜電力大小 F"], ["c", "作用力性質"], ["d", "q₁ 受力方向"]],
      chart: true,
      note: "電荷可直接拖曳，位置會對齊 0.5 cm。紫色箭頭是每個電荷受到的合力；超出比例尺的箭頭中間會畫兩道斷線。"
    });
    const cv = ui.canvas;
    let mode = "two", selected = 2, view = {s: 20, w: 800, h: 420}, boxes = [];
    const pts = [{x: 13, y: 0}, {x: 27, y: 0}, {x: 20, y: -7}];
    const qs = () => [ui.get("q1"), ui.get("q2"), ui.get("q3")];
    const active = () => mode === "two" ? [0, 1] : [0, 1, 2];
    const sub = ["₁", "₂", "₃"];
    function reset() {
      const midY = (view.h / view.s) / 2;
      pts[0] = {x: 10, y: midY + (mode === "three" ? 3 : 0)}; pts[1] = {x: 20, y: midY + (mode === "three" ? 3 : 0)}; pts[2] = {x: 15, y: midY - 5};
      selected = mode === "three" ? 2 : 0;
    }
    /* 電荷 j 對電荷 i 的力（N），世界座標 y 向下 */
    function force(i, j, q) {
      const dx = (pts[i].x - pts[j].x) / 100, dy = (pts[i].y - pts[j].y) / 100, r = Math.hypot(dx, dy);
      const f = K * q[i] * q[j] * 1e-12 / (r * r);
      return [f * dx / r, f * dy / r, f];
    }
    function net(i, q) {
      let fx = 0, fy = 0;
      for (const j of active()) if (j !== i) { const [a, b] = force(i, j, q); fx += a; fy += b; }
      return [fx, fy];
    }
    const angle = (fx, fy) => { let a = Math.atan2(-fy, fx) * 180 / Math.PI; if (a < 0) a += 360; return a; };

    function draw() {
      const w0 = cv.clientWidth || 800, h = clamp(Math.round(w0 * 0.5), 300, 470);
      const {ctx, w} = fitCanvas(cv, h);
      const first = view.s === 20 && view.w === 800;
      view = {s: w / 30, w, h};
      if (first) reset();
      const s = view.s, L = makeLabeler(ctx, w, h), q = qs(), Nper = +ui.get("scale"), pxPerN = s / Nper;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      grid(ctx, w, h, s, 0, 0, 5);
      const P = i => [pts[i].x * s, pts[i].y * s];
      if (mode === "two") {
        const [x1, y1] = P(0), [x2, y2] = P(1);
        ctx.strokeStyle = "#8fa6ac"; ctx.setLineDash([5, 5]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]);
      }
      const rq = Math.max(11, s * 0.55);
      // 分力（只畫選取的電荷）
      if (mode === "three" && ui.get("parts")) {
        const i = selected, [x, y] = P(i), cols = [C.teal, C.amber, C.blue];
        const comps = active().filter(j => j !== i).map(j => [j, force(i, j, q)]);
        for (const [j, [fx, fy, f]] of comps) {
          if (!f) continue;
          vector(ctx, x, y, fx * pxPerN, fy * pxPerN, cols[j], 12 * s, 2);
          const n = Math.hypot(fx, fy) * pxPerN, k = Math.min(1, 12 * s / n);
          L.label(`F${sub[j]}${sub[i]}`, x + fx * pxPerN * k + 6, y + fy * pxPerN * k - 6, {size: 12, color: cols[j], align: "left", plate: true});
        }
        if (comps.length === 2) {          // 平行四邊形的輔助虛線
          const [[, a], [, b]] = comps;
          const ax = a[0] * pxPerN, ay = a[1] * pxPerN, bx = b[0] * pxPerN, by = b[1] * pxPerN;
          if (Math.hypot(ax + bx, ay + by) < 12 * s && Math.hypot(ax, ay) < 12 * s && Math.hypot(bx, by) < 12 * s) {
            ctx.strokeStyle = "rgba(91,116,125,.6)"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(x + ax, y + ay); ctx.lineTo(x + ax + bx, y + ay + by); ctx.lineTo(x + bx, y + by); ctx.stroke(); ctx.setLineDash([]);
          }
        }
      }
      // 合力
      for (const i of active()) {
        const [x, y] = P(i), [fx, fy] = net(i, q), f = Math.hypot(fx, fy);
        if (f < 1e-9) continue;
        vector(ctx, x, y, fx * pxPerN, fy * pxPerN, C.violet, 12 * s, mode === "three" && i !== selected ? 2.4 : 3.4);
        if (mode === "two") L.label(`F = ${num(f)} N`, x, y - rq - 12, {size: 13, color: C.violet, bold: true, plate: true});
        else {
          const n = f * pxPerN, k = Math.min(1, 12 * s / n), tx = x + fx * pxPerN * k, ty = y + fy * pxPerN * k;
          L.label(`F = ${num(f)} N`, tx + (fx >= 0 ? 8 : -8), ty + (fy > 0 ? 18 : -10), {size: 13, color: C.violet, align: fx >= 0 ? "left" : "right", bold: true, plate: true});
        }
      }
      for (const i of active()) {
        const [x, y] = P(i);
        charge(ctx, x, y, q[i], rq, mode === "three" && i === selected);
        L.label(`q${sub[i]} = ${num(q[i])} μC`, x, y + rq + 18, {size: 12, color: C.ink, plate: true});
      }
      if (mode === "two") {
        const [x1, y1] = P(0), [x2, y2] = P(1), r = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (Math.hypot(x2 - x1, y2 - y1) > 170) L.label(`r = ${r.toFixed(1)} cm`, (x1 + x2) / 2, (y1 + y2) / 2 + 38, {size: 12, color: C.muted, plate: true});
      }
      L.label(`比例尺：1 格 = 1 cm；力 1 格 = ${Nper} N`, 8, h - 8, {size: 11, color: C.muted, align: "left", plate: true});
      boxes = L.boxes;
    }
    function drawChart() {
      ui.chartWrap.hidden = mode !== "two";
      if (mode !== "two") return;
      const q = qs(), k = K * Math.abs(q[0] * q[1]) * 1e-12, r = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const inv = ui.get("axis") === "inv", Fnow = k / (r / 100) ** 2, yMax = Math.max(k / 0.05 ** 2 * 1.05, 1e-6);
      const ptsC = [];
      if (inv) for (let u = 0; u <= 0.04; u += 0.0005) ptsC.push([u, k * u * 1e4]);
      else for (let rr = 1.5; rr <= 30; rr += 0.25) { const F = k / (rr / 100) ** 2; ptsC.push([rr, F <= yMax ? F : NaN]); }
      chart(ui.chart, {h: 210, xMin: inv ? 0 : 0, xMax: inv ? 0.04 : 30, yMin: 0, yMax, xLabel: inv ? "1 ⁄ r²（cm⁻²）" : "r（cm）", yLabel: "F（N）",
        series: [{points: ptsC, color: C.violet}], markers: [{x: inv ? 1 / (r * r) : r, y: Fnow, color: C.violet}],
        note: inv ? "F 與 1/r² 成正比：一條通過原點的直線" : "距離加倍，力變成 1/4"});
    }
    function readouts() {
      const q = qs();
      if (mode === "two") {
        const r = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), [fx, fy, f] = force(0, 1, q);
        ui.roLabel("a", "兩電荷距離 r"); ui.ro("a", r.toFixed(1) + " cm");
        ui.roLabel("b", "靜電力大小 F"); ui.ro("b", num(Math.abs(f)) + " N");
        ui.roLabel("c", "作用力性質"); ui.ro("c", q[0] * q[1] === 0 ? "沒有作用力" : q[0] * q[1] > 0 ? "同號互斥" : "異號互吸");
        ui.roLabel("d", "q₁ 受力方向（由 +x 逆時針）"); ui.ro("d", f ? angle(fx, fy).toFixed(0) + "°" : "—");
      } else {
        const i = selected, others = active().filter(j => j !== i), [fx, fy] = net(i, q), f = Math.hypot(fx, fy);
        others.forEach((j, n) => { const id = n ? "b" : "a"; ui.roLabel(id, `q${sub[j]} 對 q${sub[i]} 的力`); ui.ro(id, num(Math.abs(force(i, j, q)[2])) + " N"); });
        ui.roLabel("c", `q${sub[i]} 受到的合力`); ui.ro("c", num(f) + " N");
        ui.roLabel("d", "合力方向（由 +x 逆時針）"); ui.ro("d", f > 1e-12 ? angle(fx, fy).toFixed(0) + "°" : "—");
      }
    }
    function render() { draw(); drawChart(); readouts(); }
    function setMode(m) {
      mode = m; reset(); ui.tab(m);
      ui.show("q3", m === "three"); ui.show("parts", m === "three"); ui.show("axis", m === "two");
      ui.hint(m === "two" ? "拖曳電荷改變距離，或改變電量。兩個電荷受力一樣大、方向相反。" :
        "點一下電荷選取它，畫出它受到的兩個分力與合力（紫色）。");
      render();
    }
    draggable(cv, {
      pick(px, py) {
        const s = view.s, rq = Math.max(11, s * 0.55) + 6;
        for (const i of active()) if (Math.hypot(px - pts[i].x * s, py - pts[i].y * s) < rq) return {i, dx: pts[i].x * s - px, dy: pts[i].y * s - py};
        return null;
      },
      move(h, px, py) {
        const s = view.s, snap = v => Math.round(v * 2) / 2;
        const x = clamp(snap((px + h.dx) / s), 1, 29), y = clamp(snap((py + h.dy) / s), 1, view.h / s - 1);
        if (active().every(j => j === h.i || Math.hypot(pts[j].x - x, pts[j].y - y) >= 1.5)) pts[h.i] = {x, y};
        if (mode === "three") selected = h.i;
        render();
      },
      end(h) { if (mode === "three") { selected = h.i; render(); } }
    });
    for (const id of ["q1", "q2", "q3", "scale", "parts", "axis"]) ui.on(id, render);
    ui.on("reset", () => { reset(); render(); });
    ui.onTab(setMode);
    const ro = new ResizeObserver(render); ro.observe(cv);
    setMode("two");
    root.sceneApi = {boxes: () => boxes, state: () => ({pts: pts.map(p => ({...p})), q: qs(), mode}), force: (i, j) => force(i, j, qs()), place(i, x, y) { pts[i] = {x, y}; render(); }, setMode};
    return () => ro.disconnect();
  }

  /* =====================================================================
   * 電場與電位
   * ===================================================================== */
  const presets = {
    single: [{x: 0, y: 0, q: 2}],
    dipole: [{x: -5, y: 0, q: 2}, {x: 5, y: 0, q: -2}],
    same: [{x: -5, y: 0, q: 2}, {x: 5, y: 0, q: 2}],
    unequal: [{x: -5, y: 0, q: 4}, {x: 5, y: 0, q: -1}],
    plates: [-12, -9, -6, -3, 0, 3, 6, 9, 12].flatMap(x => [{x, y: -5, q: 1}, {x, y: 5, q: -1}])
  };
  function fieldAt(list, x, y) {                 // x, y 為 cm；回傳 [Ex, Ey(向下為正), V]，單位 N/C、V
    let ex = 0, ey = 0, v = 0;
    for (const c of list) {
      const dx = x - c.x, dy = y - c.y, r2 = dx * dx + dy * dy, r = Math.sqrt(r2);
      if (r < 1e-6) continue;
      const f = K * c.q * 1e-9 * 1e4 / (r2 * r);
      ex += f * dx; ey += f * dy; v += K * c.q * 1e-7 / r;
    }
    return [ex, ey, v];
  }
  function mountField(root) {
    const ui = build(root, {
      tabs: [{id: "single", name: "單一電荷"}, {id: "dipole", name: "等量異號"}, {id: "same", name: "等量同號"}, {id: "unequal", name: "+4 與 −1"}, {id: "plates", name: "兩排電荷（平行板）"}],
      controls: [
        {type: "heading", label: "要畫什麼"},
        {type: "check", id: "vec", label: "電場方向（箭頭格）", value: true},
        {type: "check", id: "lines", label: "電力線", value: false},
        {type: "check", id: "equi", label: "等電位線", value: true},
        {type: "check", id: "map", label: "電位色圖（紅高藍低）", value: false},
        {type: "heading", label: "電荷"},
        {type: "range", id: "q", label: "選取的電荷", min: -5, max: 5, step: 0.5, value: 2, unit: "nC"},
        {type: "buttons", items: [{id: "addp", label: "＋ 正電荷"}, {id: "addn", label: "＋ 負電荷"}, {id: "del", label: "刪除選取"}]},
        {type: "select", id: "profile", label: "剖面圖（通過 P 的水平線）", value: "off", options: [["off", "不顯示"], ["V", "電位 V"], ["Ex", "電場水平分量 Eₓ"]]}
      ],
      readouts: [["pos", "測點 P 位置"], ["v", "P 點電位 V"], ["e", "P 點電場 |E|"], ["dir", "電場方向（由 +x 逆時針）"], ["dv", "相鄰等電位線差"]],
      chart: true,
      note: "拖曳電荷或黃色測點 P。箭頭格只表示方向，顏色越深電場越強；P 點的電場箭頭長度依對數比例。座標原點在畫面中央，y 向上。"
    });
    const cv = ui.canvas, off = document.createElement("canvas");
    let charges = presets.single.map(c => ({...c})), sel = 0, probe = {x: 6, y: -4}, view = {s: 20, w: 800, h: 480, cx: 400, cy: 240}, boxes = [];
    let cache = null;
    const toPx = (x, y) => [view.cx + x * view.s, view.cy + y * view.s];   // 世界 y 向下
    const world = (px, py) => [(px - view.cx) / view.s, (py - view.cy) / view.s];
    const dirty = () => { cache = null; };
    function qmax() { return Math.max(0.5, ...charges.map(c => Math.abs(c.q))); }
    function deltaV() { return niceStep(K * qmax() * 1e-7 / 4, 4); }

    function computeGrid() {
      const step = 4, nx = Math.ceil(view.w / step) + 1, ny = Math.ceil(view.h / step) + 1, V = new Float32Array(nx * ny);
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const [x, y] = world(i * step, j * step); V[j * nx + i] = fieldAt(charges, x, y)[2];
      }
      return {step, nx, ny, V};
    }
    function fieldLines() {
      const out = [], pos = charges.filter(c => c.q > 0), neg = charges.filter(c => c.q < 0);
      const xmax = view.w / 2 / view.s + 3, ymax = view.h / 2 / view.s + 3;
      const trace = (c, a, dir) => {
        let x = c.x + 0.55 * Math.cos(a), y = c.y + 0.55 * Math.sin(a);
        const path = [[c.x, c.y], [x, y]];
        for (let k = 0; k < 2500; k++) {
          const f = (px, py) => { const [ex, ey] = fieldAt(charges, px, py), n = Math.hypot(ex, ey) || 1; return [dir * ex / n, dir * ey / n]; };
          const [ax, ay] = f(x, y), [bx, by] = f(x + ax * .09, y + ay * .09);
          x += bx * .18; y += by * .18; path.push([x, y]);
          const end = charges.find(o => o !== c && Math.hypot(o.x - x, o.y - y) < 0.45);
          if (end) { path.push([end.x, end.y]); return {path, end}; }
          if (Math.abs(x) > xmax || Math.abs(y) > ymax) return {path, end: null};
        }
        return {path, end: null};
      };
      for (const c of pos) { const n = Math.round(4 * c.q); for (let i = 0; i < n; i++) out.push({...trace(c, (i + .5) / n * TAU, 1), dir: 1}); }
      const total = charges.reduce((a, c) => a + c.q, 0);
      for (const c of neg) {
        if (pos.length && total >= 0) break;
        const n = Math.round(4 * -c.q);
        for (let i = 0; i < n; i++) { const t = trace(c, (i + .5) / n * TAU, -1); if (!t.end) out.push({...t, dir: -1}); }
      }
      return out;
    }
    function contours(g, level) {
      const {step, nx, ny, V} = g, segs = [];
      const lerp = (a, b, va, vb) => a + (level - va) / (vb - va) * (b - a);
      for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
        const a = V[j * nx + i], b = V[j * nx + i + 1], c = V[(j + 1) * nx + i + 1], d = V[(j + 1) * nx + i];
        const x0 = i * step, y0 = j * step, x1 = x0 + step, y1 = y0 + step, pts = [];
        if ((a - level) * (b - level) < 0) pts.push([lerp(x0, x1, a, b), y0]);
        if ((b - level) * (c - level) < 0) pts.push([x1, lerp(y0, y1, b, c)]);
        if ((d - level) * (c - level) < 0) pts.push([lerp(x0, x1, d, c), y1]);
        if ((a - level) * (d - level) < 0) pts.push([x0, lerp(y0, y1, a, d)]);
        if (pts.length >= 2) segs.push([pts[0], pts[1]]);
        if (pts.length === 4) segs.push([pts[2], pts[3]]);
      }
      return segs;
    }
    function draw() {
      const w0 = cv.clientWidth || 800, h = clamp(Math.round(w0 * 0.6), 320, 560);
      const {ctx, w} = fitCanvas(cv, h);
      if (view.w !== w || view.h !== h) { view = {s: w / 40, w, h, cx: w / 2, cy: h / 2}; dirty(); }
      if (!cache) cache = {grid: computeGrid(), lines: null};
      const s = view.s, L = makeLabeler(ctx, w, h), g = cache.grid;
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      if (ui.get("map")) {
        off.width = g.nx; off.height = g.ny;
        const octx = off.getContext("2d"), img = octx.createImageData(g.nx, g.ny), V0 = 20, Vm = Math.asinh(3000 / V0);
        for (let k = 0; k < g.V.length; k++) {
          const t = clamp(Math.asinh(g.V[k] / V0) / Vm, -1, 1), a = Math.abs(t);
          const [r, gg, b] = t >= 0 ? [217, 83, 74] : [42, 98, 184];
          img.data[k * 4] = r; img.data[k * 4 + 1] = gg; img.data[k * 4 + 2] = b; img.data[k * 4 + 3] = Math.round(a * 150);
        }
        octx.putImageData(img, 0, 0);
        ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, g.nx * g.step, g.ny * g.step);
      }
      grid(ctx, w, h, s, view.cx % s, view.cy % s, 5);
      ctx.strokeStyle = "#b9c9cc"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, view.cy + .5); ctx.lineTo(w, view.cy + .5); ctx.moveTo(view.cx + .5, 0); ctx.lineTo(view.cx + .5, h); ctx.stroke();
      const dV = deltaV();
      if (ui.get("equi") && charges.length) {
        const nMax = Math.min(30, Math.floor(K * qmax() * 1e-7 / 0.6 / dV)), both = charges.some(c => c.q > 0) && charges.some(c => c.q < 0);
        for (let n = -nMax; n <= nMax; n++) {
          if (n === 0 && !both) continue;
          ctx.strokeStyle = n > 0 ? "rgba(201,62,52,.75)" : n < 0 ? "rgba(42,98,184,.75)" : "rgba(80,90,95,.75)";
          ctx.lineWidth = n === 0 ? 1.6 : 1.3; ctx.setLineDash(n === 0 ? [6, 4] : []);
          ctx.beginPath();
          for (const [[x0, y0], [x1, y1]] of contours(g, n * dV)) { ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); }
          ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      if (ui.get("vec") && charges.length) {
        const gs = 2, lo = Math.log10(50), hi = Math.log10(5e4);
        for (let gx = Math.ceil(-w / 2 / s / gs) * gs; gx * s <= w / 2; gx += gs) for (let gy = Math.ceil(-h / 2 / s / gs) * gs; gy * s <= h / 2; gy += gs) {
          if (charges.some(c => Math.hypot(c.x - gx, c.y - gy) < 1.3)) continue;
          const [ex, ey] = fieldAt(charges, gx, gy), e = Math.hypot(ex, ey);
          if (e < 1e-9) continue;
          const t = clamp((Math.log10(e) - lo) / (hi - lo), 0, 1), len = gs * s * 0.38, [px, py] = toPx(gx, gy);
          const shade = Math.round(205 - 180 * t);
          arrow(ctx, px - ex / e * len, py - ey / e * len, px + ex / e * len, py + ey / e * len, `rgb(${shade - 10},${shade + 12},${shade + 18})`, 1.4 + 0.8 * t, 6);
        }
      }
      if (ui.get("lines") && charges.length) {
        if (!cache.lines) cache.lines = fieldLines();
        for (const {path, dir} of cache.lines) {
          ctx.strokeStyle = "rgba(179,96,15,.9)"; ctx.lineWidth = 1.6; ctx.beginPath();
          path.forEach(([x, y], k) => { const [px, py] = toPx(x, y); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }); ctx.stroke();
          const m = Math.min(path.length - 2, 30);
          if (m > 3) {
            const [ax, ay] = toPx(...path[m - 3]), [bx, by] = toPx(...path[m]);
            dir > 0 ? arrow(ctx, ax, ay, bx, by, "rgba(179,96,15,.95)", 1.6, 8) : arrow(ctx, bx, by, ax, ay, "rgba(179,96,15,.95)", 1.6, 8);
          }
        }
      }
      const rq = Math.max(10, s * .5);
      charges.forEach((c, i) => { const [px, py] = toPx(c.x, c.y); charge(ctx, px, py, c.q, rq, i === sel); });
      charges.forEach((c, i) => { const [px, py] = toPx(c.x, c.y); if (i === sel || charges.length <= 4) L.label(`${num(c.q)} nC`, px, py + rq + 16, {size: 12, plate: true}); });
      // 測點 P
      const [ex, ey, V] = fieldAt(charges, probe.x, probe.y), e = Math.hypot(ex, ey), [px, py] = toPx(probe.x, probe.y);
      if (e > 1e-9) {
        const len = clamp(16 + 22 * Math.log10(e / 50), 14, 130);
        arrow(ctx, px, py, px + ex / e * len, py + ey / e * len, C.violet, 3, 11);
        L.label("E", px + ex / e * (len + 12), py + ey / e * (len + 12) + 4, {size: 13, color: C.violet, bold: true, plate: true});
      }
      ctx.fillStyle = "#f2b705"; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 7, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px - 12, py); ctx.lineTo(px + 12, py); ctx.moveTo(px, py - 12); ctx.lineTo(px, py + 12); ctx.stroke();
      L.label("P", px - 12, py - 12, {size: 13, bold: true, plate: true});
      L.label("1 格 = 1 cm", 8, h - 8, {size: 11, color: C.muted, align: "left", plate: true});
      boxes = L.boxes;
      return {V, e, ex, ey};
    }
    function drawChart() {
      const mode = ui.get("profile");
      ui.chartWrap.hidden = mode === "off";
      if (mode === "off") return;
      const xr = view.w / 2 / view.s, y = probe.y, near = x => charges.some(c => Math.abs(c.y - y) < 1 && Math.abs(c.x - x) < 1.2);
      const val = x => { const [ex, , v] = fieldAt(charges, x, y); return mode === "V" ? v : ex; };
      let m = 0; const ptsC = [];
      for (let x = -xr; x <= xr; x += 0.05) if (!near(x)) m = Math.max(m, Math.abs(val(x)));
      const top = niceStep(m || 1, 1) * Math.ceil((m || 1) / niceStep(m || 1, 1) * 1.05);
      for (let x = -xr; x <= xr; x += 0.05) { const v = val(x); ptsC.push([x, Math.abs(v) <= top ? v : NaN]); }
      chart(ui.chart, {h: 200, xMin: -xr, xMax: xr, yMin: -top, yMax: top, xLabel: "x（cm）", yLabel: mode === "V" ? "V（V）" : "Eₓ（N/C）",
        series: [{points: ptsC, color: mode === "V" ? C.teal : C.violet}], vlines: charges.filter(c => Math.abs(c.y - y) < 1).map(c => ({x: c.x, color: c.q > 0 ? C.red : C.blue})),
        markers: [{x: probe.x, y: val(probe.x), color: "#c99400"}], note: `沿 y = ${num(-y)} cm；靠近電荷處數值趨於無限大，故斷開`});
    }
    function render() {
      let {V, e, ex, ey} = draw();
      drawChart();
      // 對稱點上的數值誤差（例如 10⁻¹³ V）視為 0
      const scale = charges.reduce((m, c) => m + Math.abs(c.q), 0);
      if (Math.abs(V) < 1e-9 * K * scale * 1e-7) V = 0;
      if (e < 1e-9 * K * scale * 1e-5) e = 0;
      ui.ro("pos", `(${num(probe.x)}, ${num(-probe.y)}) cm`);
      ui.ro("v", num(V) + " V"); ui.ro("e", num(e) + " N/C");
      const a = (Math.round(Math.atan2(-ey, ex) * 180 / Math.PI) + 360) % 360;
      ui.ro("dir", e > 0 ? a + "°" : "—");
      ui.ro("dv", ui.get("equi") ? num(deltaV()) + " V" : "—");
      const c = charges[sel];
      ui.show("q", !!c); if (c && ui.get("q") !== c.q) ui.set("q", c.q);
    }
    function load(name) {
      charges = presets[name].map(c => ({...c})); sel = name === "plates" ? -1 : 0; probe = name === "plates" ? {x: 2, y: -2} : {x: 6, y: -4};
      if (name === "plates") { ui.set("vec", true); ui.set("equi", true); }
      ui.hint({single: "電場方向由正電荷向外；等電位線是一圈圈同心圓，越靠近電荷排得越密。",
        dipole: "看中垂線：等電位線是 0 V（虛線），但電場並不是 0。",
        same: "兩電荷中點的電場為 0，電位卻不是 0。拖曳 P 到中點試試。",
        unequal: "電場為 0 的點在哪裡？在小電荷外側找找看。",
        plates: "兩排等量異號的電荷：中間的電場接近均勻、等電位線接近等間隔的直線。"}[name]);
      dirty(); render();
    }
    draggable(cv, {
      pick(px, py) {
        const [x, y] = world(px, py);
        if (Math.hypot(x - probe.x, y - probe.y) * view.s < 14) return {probe: true};
        let best = -1, bd = 1e9;
        charges.forEach((c, i) => { const d = Math.hypot(c.x - x, c.y - y) * view.s; if (d < bd) { bd = d; best = i; } });
        return bd < Math.max(10, view.s * .5) + 6 ? {i: best} : null;
      },
      move(h, px, py) {
        const [x, y] = world(px, py), xr = view.w / 2 / view.s - .5, yr = view.h / 2 / view.s - .5;
        if (h.probe) probe = {x: clamp(x, -xr, xr), y: clamp(y, -yr, yr)};
        else {
          const sx = clamp(Math.round(x * 2) / 2, -xr, xr), sy = clamp(Math.round(y * 2) / 2, -yr, yr);
          if (charges.every((c, j) => j === h.i || Math.hypot(c.x - sx, c.y - sy) >= 1)) { charges[h.i].x = sx; charges[h.i].y = sy; }
          sel = h.i; dirty();
        }
        render();
      },
      end(h) { if (!h.probe) { sel = h.i; render(); } }
    });
    ui.on("q", v => { const c = charges[sel]; if (!c) return; c.q = v === 0 ? (c.q > 0 ? 0.5 : -0.5) : v; if (v === 0) ui.set("q", c.q); dirty(); render(); });
    const add = sign => { let x = 0, y = -6; while (charges.some(c => Math.hypot(c.x - x, c.y - y) < 1.5)) x += 2; charges.push({x, y, q: sign * 2}); sel = charges.length - 1; dirty(); render(); };
    ui.on("addp", () => add(1)); ui.on("addn", () => add(-1));
    ui.on("del", () => { if (sel < 0 || !charges.length) return; charges.splice(sel, 1); sel = charges.length ? 0 : -1; dirty(); render(); });
    for (const id of ["vec", "lines", "equi", "map", "profile"]) ui.on(id, render);
    ui.onTab(load);
    const ro = new ResizeObserver(render); ro.observe(cv);
    load("single");
    root.sceneApi = {boxes: () => boxes, load, field: (x, y) => fieldAt(charges, x, y), setProbe(x, y) { probe = {x, y}; render(); }, charges: () => charges.map(c => ({...c})), lines: () => (cache?.lines || fieldLines())};
    return () => ro.disconnect();
  }

  /* =====================================================================
   * 帶電粒子在平行板間的偏轉
   * ===================================================================== */
  const particles = {electron: {name: "電子", q: -E_CHARGE, m: M_E}, proton: {name: "質子", q: E_CHARGE, m: M_P}, alpha: {name: "α 粒子", q: 2 * E_CHARGE, m: 6.645e-27}};
  function mountDeflect(root) {
    const ui = build(root, {
      controls: [
        {type: "select", id: "kind", label: "粒子", value: "electron", options: Object.entries(particles).map(([k, p]) => [k, p.name])},
        {type: "range", id: "U", label: "加速電壓 U", min: 100, max: 2000, step: 50, value: 1000, unit: "V"},
        {type: "range", id: "V", label: "偏轉電壓 V（上板 − 下板）", min: -400, max: 400, step: 10, value: 150, unit: "V"},
        {type: "range", id: "d", label: "板距 d", min: 1, max: 4, step: 0.5, value: 2, unit: "cm"},
        {type: "buttons", items: [{id: "fire", label: "發射", primary: true}, {id: "clear", label: "清除軌跡"}]},
        {type: "check", id: "keep", label: "保留先前的軌跡", value: true}
      ],
      readouts: [["v0", "入射速率 v₀"], ["E", "板間電場 E = V/d"], ["a", "加速度 a"], ["t", "通過平行板的時間"], ["y", "離開平行板時的偏移 y"], ["Y", "螢光幕上的偏移 Y"]],
      note: "粒子先經加速電壓 U 加速，再水平射入長 5 cm 的平行板，螢光幕在平行板右端外 10 cm。動畫速度已大幅放慢。"
    });
    const cv = ui.canvas, PL = 5, X0 = 4, D = 10, XS = X0 + PL + D;
    let shots = [], flying = null, boxes = [], view = {s: 20, w: 800, h: 400};
    function solve() {
      const p = particles[ui.get("kind")], U = ui.get("U"), V = ui.get("V"), d = ui.get("d") / 100, L = PL / 100;
      const v0 = Math.sqrt(2 * Math.abs(p.q) * U / p.m), E = V / d, a = -p.q * E / p.m;   // y 向上；V>0 時電場向下
      const tIn = L / v0;
      let yExit = 0.5 * a * tIn * tIn, hit = null, tHit = null;
      if (Math.abs(yExit) >= d / 2) { tHit = Math.sqrt(d / Math.abs(a)); hit = a > 0 ? "上板" : "下板"; }
      const vyExit = a * tIn, Y = hit ? null : yExit + vyExit / v0 * (D / 100);
      return {p, U, V, d, v0, E, a, tIn, yExit, hit, tHit, Y};
    }
    function path(sol) {             // 回傳世界座標 (cm, y 向上) 的軌跡點
      const pts = [[1, 0], [X0, 0]], tEnd = sol.hit ? sol.tHit : sol.tIn;
      for (let k = 1; k <= 60; k++) { const t = tEnd * k / 60; pts.push([X0 + sol.v0 * t * 100, 0.5 * sol.a * t * t * 100]); }
      if (!sol.hit) pts.push([XS, sol.Y * 100]);
      return pts;
    }
    function draw() {
      const w0 = cv.clientWidth || 800, h = clamp(Math.round(w0 * 0.55), 300, 480);
      const {ctx, w} = fitCanvas(cv, h);
      view = {s: w / 21, w, h};
      const s = view.s, L = makeLabeler(ctx, w, h), cy = h / 2, P = (x, y) => [x * s, cy - y * s], sol = solve(), d = ui.get("d");
      ctx.fillStyle = C.paper; ctx.fillRect(0, 0, w, h);
      grid(ctx, w, h, s, 0, cy % s, 5);
      // 電子槍
      ctx.fillStyle = "#c9d5d8"; ctx.strokeStyle = C.ink; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.roundRect(0.2 * s, cy - 0.6 * s, 0.8 * s, 1.2 * s, 4); ctx.fill(); ctx.stroke();
      L.label("加速 U", 0.6 * s, cy - 0.9 * s, {size: 11, color: C.muted});
      // 平行板
      const [px0, ptop] = P(X0, d / 2), [px1, pbot] = P(X0 + PL, -d / 2), V = ui.get("V");
      for (const [y, sign] of [[ptop - 6, V > 0 ? "+" : V < 0 ? "−" : ""], [pbot, V > 0 ? "−" : V < 0 ? "+" : ""]]) {
        ctx.fillStyle = sign === "+" ? "#e8908a" : sign === "−" ? "#8fb0e8" : "#c3cdd0";
        ctx.fillRect(px0, y, px1 - px0, 6);
        if (sign) for (let x = px0 + 10; x < px1 - 4; x += Math.max(16, (px1 - px0) / 6)) L.label(sign, x, y < cy ? y - 4 : y + 20, {size: 14, color: sign === "+" ? C.red : C.blue, bold: true});
      }
      if (V !== 0) for (let x = px0 + (px1 - px0) / 8; x < px1; x += (px1 - px0) / 4) arrow(ctx, x, V > 0 ? ptop + 4 : pbot - 4, x, V > 0 ? pbot - 4 : ptop + 4, "rgba(77,127,214,.55)", 1.4, 7);
      if (V !== 0) L.label("E", px0 + (px1 - px0) * .5, cy + 4, {size: 13, color: C.field, bold: true, plate: true});
      // 螢光幕
      const [sx] = P(XS, 0);
      ctx.fillStyle = "#e3ecd9"; ctx.strokeStyle = "#7b9a6a"; ctx.fillRect(sx - 3, 6, 6, h - 12); ctx.strokeRect(sx - 3, 6, 6, h - 12);
      L.label("螢光幕", sx - 6, 18, {size: 11, color: C.muted, align: "right"});
      // 軌跡
      const kept = ui.get("keep") ? shots : shots.slice(-1);
      kept.forEach((sh, n) => {
        const last = n === kept.length - 1;
        ctx.strokeStyle = sh.color; ctx.globalAlpha = last ? 1 : 0.45; ctx.lineWidth = last ? 2.4 : 1.6;
        ctx.beginPath(); sh.pts.slice(0, last && flying ? flying.k + 1 : sh.pts.length).forEach(([x, y], k) => { const [a, b] = P(x, y); k ? ctx.lineTo(a, b) : ctx.moveTo(a, b); }); ctx.stroke();
        ctx.globalAlpha = 1;
        if (!sh.sol.hit && (!last || !flying)) { const [a, b] = P(XS, sh.sol.Y * 100); ctx.fillStyle = sh.color; ctx.beginPath(); ctx.arc(a, b, 4.5, 0, TAU); ctx.fill(); }
      });
      if (flying) {
        const sh = shots[shots.length - 1], [x, y] = flying.pos, [a, b] = P(x, y), inside = x > X0 && x < X0 + PL;
        if (inside && sol.V !== 0) { const dir = Math.sign(sh.sol.a); arrow(ctx, a, b, a, b - dir * 26, C.red, 2.4, 8); L.label("F", a + 10, b - dir * 22, {size: 12, color: C.red, bold: true}); }
        ctx.fillStyle = sh.color; ctx.beginPath(); ctx.arc(a, b, 5, 0, TAU); ctx.fill();
      }
      L.label(`L = ${PL} cm，d = ${ui.get("d")} cm`, (px0 + px1) / 2, Math.min(h - 6, pbot + 44), {size: 11, color: C.muted, plate: true});
      boxes = L.boxes;
    }
    function readouts() {
      const r = solve();
      ui.ro("v0", num(r.v0) + " m/s"); ui.ro("E", num(Math.abs(r.E)) + " N/C"); ui.ro("a", num(Math.abs(r.a)) + " m/s²");
      ui.ro("t", num(r.hit ? r.tHit : r.tIn) + " s" + (r.hit ? "（撞板）" : ""));
      const side = v => Math.abs(v) < 1e-12 ? "" : v > 0 ? "（向上）" : "（向下）";
      ui.ro("y", r.hit ? `撞到${r.hit}` : num(Math.abs(r.yExit) * 100) + " cm" + side(r.yExit));
      ui.ro("Y", r.hit ? "—" : num(Math.abs(r.Y) * 100) + " cm" + side(r.Y));
    }
    const palette = [C.violet, C.teal, C.amber, C.blue, C.red, C.green];
    function fire() {
      const sol = solve(), pts = path(sol);
      shots.push({sol, pts, color: palette[shots.length % palette.length]});
      if (shots.length > 6) shots.shift();
      flying = {k: 0, t: 0, pos: pts[0]};
    }
    const stop = loop(dt => {
      if (flying) {
        const sh = shots[shots.length - 1], total = sh.pts.length - 1;
        flying.t += dt / 1.6; const f = Math.min(1, flying.t), idx = f * total, k = Math.floor(idx), u = idx - k;
        const a = sh.pts[k], b = sh.pts[Math.min(total, k + 1)];
        flying.k = k + 1; flying.pos = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u];
        if (f >= 1) flying = null;
      }
      draw();
    });
    for (const id of ["kind", "U", "V", "d"]) ui.on(id, () => { readouts(); fire(); });
    ui.on("fire", fire); ui.on("clear", () => { shots = []; flying = null; });
    ui.on("keep", draw);
    readouts(); fire();
    root.sceneApi = {boxes: () => boxes, solve};
    return stop;
  }

  EM.scenes.push(
    {id: "coulomb-law", title: "庫侖定律：兩個與三個點電荷", sections: ["1-1"], chapter: 1,
      lead: "距離加倍，靜電力變成幾倍？三個電荷時，力要怎麼加？",
      description: "拖曳電荷看作用力與反作用力，畫 F–r 與 F–1/r² 圖；三電荷時看分力與合力。",
      steps: ["把兩電荷的距離從 6 cm 拉到 12 cm，F 變成原來的幾倍？", "把圖表橫軸換成 1/r²，圖形變成什麼樣子？", "改變 q₁ 的正負號，兩個力的方向怎麼變？大小呢？", "切到三個電荷，選取 q₃，用平行四邊形說明合力的方向。"],
      takeaway: "F = k|q₁q₂|/r²，兩電荷受力大小相等、方向相反；多個電荷時，各分力用向量相加。",
      mount: mountCoulomb},
    {id: "efield", title: "電場與電位：點電荷周圍", sections: ["1-2", "1-3"], chapter: 1,
      lead: "電場為 0 的地方，電位也是 0 嗎？",
      description: "拖曳點電荷與測點，畫出電場方向、電力線、等電位線與電位色圖。",
      steps: ["單一電荷：電場箭頭與等電位線有什麼關係？", "等量異號：把 P 拖到中垂線上，V 與 |E| 各是多少？", "等量同號：把 P 拖到兩電荷正中間，V 與 |E| 各是多少？", "+4 與 −1：找出電場為 0 的點，它在兩電荷之間嗎？", "打開剖面圖，比較 V 的斜率與 Eₓ 的關係。"],
      takeaway: "電力線與等電位線處處垂直；電場指向電位降低的方向，等電位線越密，電場越強。E = 0 與 V = 0 是兩回事。",
      mount: mountField},
    {id: "deflect", title: "帶電粒子在平行板間的偏轉", sections: ["1-3"], chapter: 1,
      lead: "電子與質子用同樣的電壓加速、再射入同樣的平行板，偏轉一樣嗎？",
      description: "調整加速電壓、偏轉電壓與板距，看拋物線軌跡與螢光幕上的光點。",
      steps: ["偏轉電壓加倍，螢光幕上的偏移 Y 變成幾倍？", "加速電壓加倍，Y 變成幾倍？", "把電子換成質子、α 粒子（U、V 不變），軌跡有什麼不同？", "板距 d 縮小一半會怎樣？什麼時候粒子會撞到板？"],
      takeaway: "板間電場均勻，粒子做類拋體運動：y = VL²/(4dU)。只要電荷同號，偏移量與粒子的質量、電量無關。",
      mount: mountDeflect}
  );
  EM.sceneOverlaps = overlaps;
})();
