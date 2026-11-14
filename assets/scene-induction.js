/*
 * scene-induction.js —— 電磁感應（three.js 3D，與必歐－沙伐同一套版面）
 * 四種裝置：滑動導體棒、線圈進出磁場、旋轉線圈（發電機）、固定線圈改變 B。B 沿 +z（朝上，從上往下看是 ⊙）。
 * ε = −N dΦ/dt（SI 單位）。ε > 0 表示電流繞迴路法線逆時針（右手），ε < 0 為順時針。
 */
(() => {
  const {loadThree, v: {mul, add, unit}, vec, layout, stage} = EM.s3d;
  const {clamp, num} = EM.sceneKit;
  const TAU = Math.PI * 2, EDGE = 1;           // 「進出磁場」的磁場區：|x| < 1 m
  const RAIL = {x0: .2, x1: 3};                   // 滑棒：起點與終點（m）
  const MODES = {slide: "滑動導體棒", enter: "線圈進出磁場", rotate: "旋轉線圈", vary: "改變磁場"};
  const sliders = [["u", "進度", 0, 1, .005, 0, ""], ["B", "磁場 B", .1, 1, .05, .5, "T"], ["B2", "末端磁場 B′（負值＝反向）", -1, 1, .05, .8, "T"],
    ["a", "線圈邊長／導軌寬 ℓ", .2, .6, .05, .4, "m"], ["v", "速度 v", .2, 2, .1, 1, "m/s"], ["N", "匝數 N", 1, 100, 1, 20, "匝"],
    ["f", "轉速 f", .5, 5, .5, 2, "圈/s"], ["T", "變化時間 T", 1, 10, .5, 4, "s"], ["R", "迴路電阻 R", .5, 5, .1, 1, "Ω"]];
  const rowModes = {u: "slide enter rotate vary", B: "slide enter rotate vary", B2: "vary", a: "slide enter rotate vary", v: "slide enter", N: "rotate vary", f: "rotate", T: "vary", R: "slide enter rotate vary"};
  const FORMULA = {
    slide: ["ε = −Bℓv", "Φ = Bℓx，x 為棒到電阻端的距離。棒等速向右，面積變大，Φ 變大，感應電流要抵抗它（Lenz），所以磁力 F 向左阻擋。"],
    enter: ["ε = −Bℓv（只在進入、離開時）", "進入與離開時 Φ 在變，才有 ε；全在場內時 Φ 最大但不變，ε = 0。"],
    rotate: ["ε = NBAω sin ωt", "Φ = NBA cos ωt。Φ 最大（線圈面朝 B）時 ε = 0；Φ = 0（線圈與 B 平行）時 ε 最大，兩者差 90°。"],
    vary: ["ε = −NA·ΔB/Δt", "線圈不動、面積不變。只有 B 在變的那一段才有 ε；B 固定後 Φ 雖然不為零，ε = 0。"]
  };
  const eq = `<math display="block"><mrow><mi>ε</mi><mo>=</mo><mo>−</mo><mi>N</mi><mfrac><mrow><mi mathvariant="normal">Δ</mi><mi mathvariant="normal">Φ</mi></mrow><mrow><mi mathvariant="normal">Δ</mi><mi>t</mi></mrow></mfrac></mrow></math>`;

  function mountInduction(root) {
    layout(root, {
      title: "電磁感應", sub: "Faraday & Lenz", aria: "電磁感應三維圖。拖曳棒或線圈改變進度，拖曳空白處旋轉視角。",
      formula: `<p>迴路的磁通量 Φ 改變，就有感應電動勢：</p><div class="bs-eq">${eq}</div><p data-f="eq" class="bs-tip"></p><p class="bs-tip" data-f="tip"></p>
        <p class="bs-tip">🖐 用「進度」或直接拖曳<b>棒／線圈</b>，▶ 播放看動畫；下圖藍線是 Φ、橘線是 ε，圓點是現在的位置。</p>`,
      rows: [["phi", "磁通量 Φ"], ["emf", "感應電動勢 ε", "bs-key"], ["i", "感應電流 I"], ["dir", "電流方向（由上往下看）"], ["f", "磁力／功率"], ["ph", "現在的階段"]],
      sliders,
      segs: [{label: "裝置", attr: "mode", items: Object.entries(MODES).map(([k, n], j) => [k, n, j === 0])}, {label: "視角", attr: "view", items: [["top", "上視圖"], ["front", "正視圖"], ["iso", "立體", true]]}],
      toggles: [["closed", "迴路閉合", true], ["play", "▶ 播放", false], ["field", "磁場 B", true], ["arrows", "電流／力／速度", true]]
    });
    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const host = $(".bs-canvas");
    const st = {mode: "slide", view: "iso", u: 0, B: .5, B2: .8, a: .4, v: 1, N: 20, f: 2, T: 4, R: 1, closed: true, play: false, field: true, arrows: true};
    let disposed = false, dirty = true, raf = 0, cleanup = () => {}, modeDirty = true, geoDirty = true;

    // ---- 物理（SI）。回傳 Φ、ε、I、位置與階段 ----
    function phys(mode, u, S0 = st) {
      const {B, a, N, R, closed} = S0, A = a * a;
      let Phi = 0, emf = 0, x = 0, theta = 0, Bt = B, force = 0, ph = "", n = 1;
      if (mode === "slide") {
        x = RAIL.x0 + (RAIL.x1 - RAIL.x0) * u; Phi = B * a * x; emf = -B * a * S0.v; ph = "棒向右等速：面積變大，Φ 均勻增加";
      } else if (mode === "enter") {
        const half = a / 2, span = EDGE * 2 + a + .6; x = -span / 2 + span * u;
        const left = x - half, right = x + half, inside = z => z >= -EDGE && z < EDGE;
        const ov = Math.max(0, Math.min(right, EDGE) - Math.max(left, -EDGE));
        Phi = B * a * ov; emf = -B * a * S0.v * (Number(inside(right)) - Number(inside(left)));
        ph = ov === 0 ? (x < 0 ? "還沒進入：Φ = 0，ε = 0" : "已離開：Φ = 0，ε = 0") : emf !== 0 ? (x < 0 ? "進入中：Φ 增加，ε ≠ 0" : "離開中：Φ 減少，ε ≠ 0") : "全在場內：Φ 最大但不變，ε = 0";
      } else if (mode === "rotate") {
        n = N; theta = TAU * u; const w = TAU * S0.f;
        Phi = N * B * A * Math.cos(theta); emf = N * B * A * w * Math.sin(theta);
        ph = Math.abs(Math.cos(theta)) > .995 ? "線圈面朝 B：Φ 最大、ε = 0" : Math.abs(Math.sin(theta)) > .995 ? "線圈與 B 平行：Φ = 0、ε 最大" : "Φ 與 ε 都在變";
      } else {
        n = N; const f = clamp((u - .25) / .5, 0, 1); Bt = B + (S0.B2 - B) * f;
        Phi = N * Bt * A; emf = u >= .25 && u < .75 ? -N * A * (S0.B2 - B) / (.5 * S0.T) : 0;
        ph = u < .25 ? "B 還沒開始變：ε = 0" : u < .75 ? "B 正在改變：ε ≠ 0" : "B 變完固定：Φ 不為零但不變，ε = 0";
      }
      if (mode !== "rotate" && mode !== "vary") Phi *= 1;
      const I = closed ? emf / R : 0;
      return {Phi, emf, I, x, theta, Bt, ph, n, heat: I * I * R};
    }
    const curves = () => {
      const pts = Array.from({length: 241}, (_, k) => phys(st.mode, k / 240));
      const mP = Math.max(...pts.map(p => Math.abs(p.Phi))) || 1, mE = Math.max(...pts.map(p => Math.abs(p.emf))) || 1;
      return {pts, mP, mE};
    };

    function readouts() {
      const p = phys(st.mode, st.u);
      $('[data-r="phi"]').textContent = num(p.Phi) + " Wb";
      $('[data-r="emf"]').textContent = num(p.emf) + " V";
      $('[data-r="i"]').textContent = st.closed ? num(p.I) + " A" : "0（開路）";
      $('[data-r="dir"]').textContent = !st.closed || Math.abs(p.emf) < 1e-12 ? "—" : p.emf < 0 ? "順時針" : "逆時針";
      const power = st.mode === "slide" || st.mode === "enter" ? (st.closed && p.emf !== 0 ? `F = ${num(Math.abs(p.I) * st.a * st.B)} N，P = ${num(p.heat)} W` : "F = 0") : st.closed ? `熱功率 ${num(p.heat)} W` : "—";
      $('[data-r="f"]').textContent = power;
      $('[data-r="ph"]').textContent = p.ph;
      $('[data-f="eq"]').textContent = FORMULA[st.mode][0]; $('[data-f="tip"]').textContent = FORMULA[st.mode][1];
      for (const [id, , , , , , unit_] of sliders) {
        const row = $(`[data-row="${id}"]`), inp = $(`[data-s="${id}"]`); row.hidden = !rowModes[id].split(" ").includes(st.mode);
        $(`[data-o="${id}"]`).textContent = (id === "u" ? Math.round(st.u * 100) + " %" : (+st[id]).toFixed(id === "N" ? 0 : id === "f" || id === "v" || id === "T" ? 1 : 2) + " " + unit_); inp.value = st[id];
      }
      for (const b of $$("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === st.mode));
      for (const b of $$("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === st.view));
      drawGraph();
    }
    // ---- Φ(藍)與 ε(橘)曲線 ----
    const cv = document.createElement("canvas"); cv.width = 560; cv.height = 190; cv.className = "bs-graph"; cv.setAttribute("aria-label", "磁通量與感應電動勢對進度的圖"); $(".bs-read dl").before(cv);
    function drawGraph() {
      const g = cv.getContext("2d"), W = cv.width, H = cv.height, c = curves(), top = 14, bot = H - 22, mid = (top + bot) / 2, amp = (bot - top) / 2 - 4;
      g.clearRect(0, 0, W, H); g.font = "600 20px system-ui"; g.lineWidth = 2;
      g.strokeStyle = "#cbd5e1"; g.beginPath(); g.moveTo(34, mid); g.lineTo(W - 8, mid); g.stroke();
      const X = u => 34 + u * (W - 44), draw = (key, m, color) => { g.strokeStyle = color; g.beginPath(); c.pts.forEach((p, k) => { const y = mid - p[key] / m * amp, x = X(k / 240); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); };
      draw("Phi", c.mP, "#2563eb"); draw("emf", c.mE, "#c2620a");
      const p = phys(st.mode, st.u); g.strokeStyle = "#94a3b8"; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(X(st.u), top); g.lineTo(X(st.u), bot); g.stroke(); g.setLineDash([]);
      for (const [key, m, color] of [["Phi", c.mP, "#2563eb"], ["emf", c.mE, "#c2620a"]]) { g.fillStyle = color; g.beginPath(); g.arc(X(st.u), mid - p[key] / m * amp, 6, 0, TAU); g.fill(); }
      g.fillStyle = "#2563eb"; g.fillText("Φ", 6, 30); g.fillStyle = "#c2620a"; g.fillText("ε", 6, 54); g.fillStyle = "#64748b"; g.font = "600 17px system-ui"; g.fillText("進度 →", W - 80, H - 4);
    }
    const changed = () => { readouts(); dirty = true; };
    for (const inp of $$("[data-s]")) inp.addEventListener("input", () => { const k = inp.dataset.s; st[k] = +inp.value; if (k === "a") geoDirty = true; changed(); });
    for (const b of $$("[data-t]")) b.addEventListener("click", () => { const k = b.dataset.t; st[k] = !st[k]; b.setAttribute("aria-pressed", String(st[k])); dirty = true; if (k === "closed") readouts(); });
    for (const b of $$("[data-mode]")) b.addEventListener("click", () => api.set({mode: b.dataset.mode, u: 0}));
    const api = {
      state: () => ({...st, ...phys(st.mode, st.u)}),
      set(o) { if ("mode" in o && o.mode !== st.mode) modeDirty = true; Object.assign(st, o); if ("a" in o) geoDirty = true; changed(); },
      phys: (mode, u, over) => phys(mode, u, {...st, ...over}), boxes: () => []
    };
    root.sceneApi = api; readouts();
    loadThree().then(() => { if (!disposed) cleanup = build(); }).catch(e => { $(".bs-loading").textContent = "3D 畫面載入失敗：" + e.message; });

    function build() {
      $(".bs-loading").remove();
      const S = stage(root, host), {T, V, VA, scene, mat, label, show, setArrow, lineGeo} = S;
      const copper = mat(0xb8733a, {metalness: .35, roughness: .38}), steel = mat(0x94a3b8, {metalness: .5, roughness: .3});
      const cyl = (r, m) => { const c = new T.Mesh(new T.CylinderGeometry(r, r, 1, 18), m); return c; };
      // 磁場：半透明區域＋整排朝 +z 的箭頭
      const fieldGroup = new T.Group(); scene.add(fieldGroup);
      let fieldArrows = [];
      const fieldSlab = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({color: 0x93c5fd, transparent: true, opacity: .13, depthWrite: false})); fieldGroup.add(fieldSlab);
      const slabEdges = new T.LineSegments(new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)), new T.LineBasicMaterial({color: 0x60a5fa})); fieldGroup.add(slabEdges);
      const bLabel = label(vec("B"), "bs-field bs-big");
      // 迴路（旋轉／進出／改變磁場共用）：四根銅管組成的方框，局部座標 xy 平面、法線 z
      const loopG = new T.Group(); scene.add(loopG);
      const sides = Array.from({length: 4}, () => { const c = cyl(.022, copper); loopG.add(c); return c; });
      const shade = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({color: 0x60a5fa, transparent: true, opacity: .22, side: T.DoubleSide, depthWrite: false})); scene.add(shade);
      const axisLine = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({color: 0x94a3b8, dashSize: .08, gapSize: .06})); scene.add(axisLine);
      // 導軌與棒
      const rails = [cyl(.025, steel), cyl(.025, steel)], rod = cyl(.04, copper), res = new T.Mesh(new T.BoxGeometry(.12, .16, .08), mat(0x475569));
      scene.add(...rails, rod, res);
      const grab = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({visible: false})); scene.add(grab);
      // 電流箭頭（四個錐）、速度、力
      const cur = Array.from({length: 4}, () => { const c = new T.Mesh(new T.ConeGeometry(.035, .1, 16), mat(0xf5a524, {emissive: 0x7a4a00, emissiveIntensity: .35})); scene.add(c); return c; });
      const vArrow = S.arrowMesh(0x16a34a, .022), fArrow = S.arrowMesh(0x7c3aed, .022);
      const iLabel = label("I", "bs-cur"), vLabel = label(vec("v"), "bs-vel"), fLabel = label(vec("F"), "bs-frc");
      const up = new T.Vector3(0, 1, 0), tmp = new T.Vector3();

      const setCyl = (m, a, b) => S.placeCyl(m, a, b);
      const bArrowsTo = (xs, ys, z0, bt) => {
        for (const o of fieldArrows) { fieldGroup.remove(o); } fieldArrows = [];
        for (const x of xs) for (const y of ys) { const g = S.arrowMesh(0x60a5fa, .014); scene.remove(g); fieldGroup.add(g); g.userData.xy = [x, y]; fieldArrows.push(g); }
      };
      function layoutMode() {
        const a = st.a, m = st.mode;
        const slabBox = m === "slide" ? [[RAIL.x0 - .4, RAIL.x1 + .5], [-.7, .7]] : m === "enter" ? [[-EDGE, EDGE], [-.9, .9]] : [[-.8, .8], [-.8, .8]];
        const [[x0, x1], [y0, y1]] = slabBox, c = [(x0 + x1) / 2, (y0 + y1) / 2], tall = m === "rotate" ? 1 : .5;
        fieldSlab.scale.set(x1 - x0, tall, y1 - y0); slabEdges.scale.copy(fieldSlab.scale); fieldSlab.position.copy(V(c[0], c[1], 0)); slabEdges.position.copy(fieldSlab.position);
        const nx = Math.max(2, Math.round((x1 - x0) / .45)), ny = Math.max(2, Math.round((y1 - y0) / .45));
        const xs = Array.from({length: nx}, (_, k) => x0 + (k + .5) * (x1 - x0) / nx), ys = Array.from({length: ny}, (_, k) => y0 + (k + .5) * (y1 - y0) / ny);
        bArrowsTo(xs, ys);
        bLabel.position.copy(V(x1 - .05, y1 - .05, tall / 2 + .35)); fieldGroup.userData.tall = tall;
        const isLoop = m !== "slide";
        loopG.visible = isLoop; shade.visible = m !== "rotate"; show(axisLine, m === "rotate");
        for (const o of [...rails, rod, res]) o.visible = !isLoop;
        // 迴路方框幾何（局部）
        if (isLoop) {
          const h = a / 2, P = [[-h, -h], [h, -h], [h, h], [-h, h]];
          sides.forEach((c, k) => setCyl(c, V(P[k][0], P[k][1], 0), V(P[(k + 1) % 4][0], P[(k + 1) % 4][1], 0)));
        }
        if (m === "rotate") axisLine.geometry = lineGeo([V(0, -.7, 0), V(0, .7, 0)]), axisLine.computeLineDistances();
        // 電流錐的父物件：旋轉時跟著線圈轉
        for (const c of cur) { c.parent && c.parent.remove(c); (m === "slide" ? scene : loopG).add(c); }
        grab.visible = m === "slide" || m === "enter"; geoDirty = false; modeDirty = false;
      }

      function update() {
        if (modeDirty || geoDirty) layoutMode();
        const a = st.a, m = st.mode, p = phys(m, st.u), tall = fieldGroup.userData.tall || .6;
        fieldGroup.visible = st.field; show(bLabel, st.field);
        // 場箭頭大小與方向：B 沿 +z，B < 0 時反向
        const Bshow = m === "vary" ? p.Bt : st.B, len = .08 + Math.abs(Bshow) * .4;
        for (const g of fieldArrows) { const [x, y] = g.userData.xy, z0 = -len / 2, z1 = len / 2, sgn = Bshow >= 0 ? 1 : -1; setArrow(g, V(x, y, -sgn * len / 2), V(x, y, sgn * len / 2), .12); }
        let rect;   // 迴路在世界座標（或旋轉時局部座標）的 [x0, x1, y0, y1]
        if (m === "slide") {
          const w = a, x = p.x;
          setCyl(rails[0], V(0, w / 2, 0), V(RAIL.x1 + .15, w / 2, 0)); setCyl(rails[1], V(0, -w / 2, 0), V(RAIL.x1 + .15, -w / 2, 0));
          setCyl(rod, V(x, -w / 2 - .12, 0), V(x, w / 2 + .12, 0)); res.position.copy(V(0, 0, 0));
          grab.position.copy(V(x, 0, 0)); grab.scale.set(.25, .25, w + .3);
          shade.scale.set(x, w, 1); shade.position.copy(V(x / 2, 0, .001)); shade.rotation.set(-Math.PI / 2, 0, 0);
          rect = [0, x, -w / 2, w / 2];
        } else if (m === "enter") {
          loopG.position.copy(V(p.x, 0, 0)); loopG.quaternion.identity();
          grab.position.copy(V(p.x, 0, 0)); grab.scale.set(a + .1, .2, a + .1);
          const left = p.x - a / 2, right = p.x + a / 2, l = Math.max(left, -EDGE), r = Math.min(right, EDGE), ov = Math.max(0, r - l);
          shade.visible = ov > 0; shade.scale.set(Math.max(ov, 1e-3), a, 1); shade.position.copy(V((l + r) / 2, 0, .002)); shade.rotation.set(-Math.PI / 2, 0, 0);
          rect = [-a / 2, a / 2, -a / 2, a / 2];
        } else if (m === "rotate") {
          loopG.position.set(0, 0, 0); loopG.quaternion.setFromAxisAngle(new T.Vector3(0, 0, -1), p.theta);
          rect = [-a / 2, a / 2, -a / 2, a / 2];
        } else {
          loopG.position.set(0, 0, 0); loopG.quaternion.identity();
          shade.visible = true; shade.scale.set(a, a, 1); shade.position.copy(V(0, 0, .002)); shade.rotation.set(-Math.PI / 2, 0, 0);
          rect = [-a / 2, a / 2, -a / 2, a / 2];
        }
        // 電流方向：ε > 0 逆時針（由法線方向看）
        const on = st.arrows && st.closed && Math.abs(p.emf) > 1e-12, s = Math.sign(p.emf) || 1, [x0, x1, y0, y1] = rect, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
        const spots = [[x1, cy, 0, 1], [cx, y1, -1, 0], [x0, cy, 0, -1], [cx, y0, 1, 0]];
        cur.forEach((c, k) => {
          c.visible = on; if (!on) return; const [px, py, dx, dy] = spots[k];
          c.position.copy(V(px, py, .02)); c.quaternion.setFromUnitVectors(up, tmp.copy(V(dx * s, dy * s, 0)).normalize());
        });
        const anchor = m === "slide" ? V(x1, y1, .12) : loopG.localToWorld(V(x1, y1, .12));
        iLabel.position.copy(anchor); show(iLabel, on);
        // 速度與磁力（滑棒、進出）
        const moving = (m === "slide" || m === "enter") && st.arrows;
        const origin = m === "slide" ? V(p.x, 0, .12) : V(p.x, a / 2 + .12, .12);
        setArrow(vArrow, origin, origin.clone().add(V(.1 + st.v * .35, 0, 0)), .1); vArrow.visible = moving; show(vLabel, moving);
        vLabel.position.copy(origin.clone().add(V(.2 + st.v * .35, 0, .08)));
        const Fm = Math.abs(p.I) * a * st.B, fOn = moving && st.closed && Fm > 1e-9;
        const fo = m === "slide" ? V(p.x, 0, .12) : V(p.x, -a / 2 - .12, .12), fl = clamp(.15 + Fm * 3, .15, .8);
        setArrow(fArrow, fo, fo.clone().add(V(-fl, 0, 0)), .1); fArrow.visible = fOn; show(fLabel, fOn); fLabel.position.copy(fo.clone().add(V(-fl - .1, 0, .08)));
      }
      const views = {iso: [-.5, -1, .75], top: [0, -.001, 1], front: [0, -1, .001]};
      const camTarget = () => st.mode === "slide" ? [1.6, 0, 0] : [0, 0, 0], camDist = () => st.mode === "slide" ? 6.6 : st.mode === "enter" ? 6.2 : 4.4;
      const go = (instant) => { const d = unit(views[st.view]), to = VA(add(camTarget(), mul(d, camDist()))), look = VA(camTarget()); instant ? S.jump(to, look) : S.flyTo(to, look); };
      for (const b of $$("[data-view]")) b.addEventListener("click", () => { st.view = b.dataset.view; go(false); readouts(); });
      let lastMode = st.mode; go(true);
      S.dragPoint(grab, grab, q => {
        if (st.mode === "slide") api.set({u: clamp((q[0] - RAIL.x0) / (RAIL.x1 - RAIL.x0), 0, 1)});
        else { const span = EDGE * 2 + st.a + .6; api.set({u: clamp((q[0] + span / 2) / span, 0, 1)}); }
      });
      let last = 0;
      const tick = time => {
        if (disposed) return; raf = requestAnimationFrame(tick);
        const dt = Math.min(.05, (time - last) / 1000 || 0); last = time;
        if (st.play) { st.u = (st.u + dt * .14) % 1; readouts(); dirty = true; }
        if (st.mode !== lastMode) { lastMode = st.mode; go(false); }
        S.stepCamera();
        if (dirty || modeDirty || geoDirty) { update(); dirty = false; }
        S.renderer.render(scene, S.camera); S.labels.render(scene, S.camera);
      };
      raf = requestAnimationFrame(tick);
      return () => S.dispose();
    }
    return () => { disposed = true; cancelAnimationFrame(raf); cleanup(); };
  }

  EM.scenes.push({id: "induction-3d", title: "電磁感應：滑棒、進出磁場、發電機、改變磁場", sections: ["3-1", "3-2", "3-3", "3-4"], chapter: 3,
    lead: "磁通量什麼時候在變？變的時候感應電流往哪個方向、有多大？",
    description: "同一個 3D 畫面切換四種裝置：滑動導體棒、線圈進出磁場、旋轉線圈（發電機）、改變磁場；即時讀 Φ、ε、I、磁力與功率，並看 Φ、ε 對進度的圖。",
    steps: ["選「滑動導體棒」，按 ▶：Φ 一直增加，ε 是定值嗎？電流繞哪個方向？磁力 F 朝哪？", "把迴路打開（關掉「迴路閉合」）：ε 還在嗎？I、F 呢？", "選「線圈進出磁場」，慢慢拉進度：哪個階段 Φ 不為零，ε 卻是零？", "選「旋轉線圈」：Φ 最大時 ε 是多少？Φ = 0 時呢？把匝數加倍、轉速加倍，ε 的峰值各變成幾倍？", "選「改變磁場」：只有哪一段有 ε？把末端 B′ 設成負值，ε 的方向有沒有反過來？"],
    takeaway: "ε = −N dΦ/dt：有 ε 的條件是「Φ 在變」，不是「Φ 不為零」。電流方向由 Lenz 定律決定：要抵抗 Φ 的變化，所以磁力總是阻擋運動。",
    full: true, mount: mountInduction});
})();
