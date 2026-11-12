/*
 * scene-biot.js —— 必歐－沙伐定律：電流元在空間中一點產生的磁場（three.js 3D）
 * 物理座標 z 朝上；three.js 的 y 朝上，所以 (x, y, z)物理 → (x, z, −y)畫面。
 * 導線可為彎曲導線、直導線或圓線圈；在導線上任選一點當電流元 IΔℓ（位置 E、切線方向 t̂）。
 * 以電流元為原點的局部座標 e₁ = t̂、e₃ = 上方（與 t̂ 正交化）、e₂ = e₃ × e₁：
 *   P = E + r (cos θ e₁ + sin θ cos φ e₂ + sin θ sin φ e₃)
 * ΔB = μ₀/4π · I Δℓ t̂ × r̂ / r²，方向 = −sin φ e₂ + cos φ e₃，大小 μ₀/4π · I Δℓ sin θ / r²。
 * 換電流元位置時 r cos θ、r sin θ、φ 都不變：P 跟著電流元一起移動（相對位置固定），只有電流元在導線上的位置改變。
 */
(() => {
  const MU4PI = 1e-7, DL = 0.8;
  const {clamp, num} = EM.sceneKit;
  const VENDOR = ["assets/vendor/three/three.min.js", "assets/vendor/three/OrbitControls.js", "assets/vendor/three/CSS2DRenderer.js"];
  let ready = null;
  function loadThree() {
    if (ready) return ready;
    ready = VENDOR.reduce((p, src) => p.then(() => new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`) && window.THREE) return res();
      const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("無法載入 " + src));
      document.head.append(s);
    })), Promise.resolve());
    return ready;
  }

  const vec = t => `<span class="bs-v">${t}</span>`;
  const math = {
    vec: `<math display="block"><mrow><mi mathvariant="normal">Δ</mi><mover><mi>B</mi><mo>→</mo></mover><mo>=</mo><mfrac><msub><mi>μ</mi><mn>0</mn></msub><mrow><mn>4</mn><mi>π</mi></mrow></mfrac><mfrac><mrow><mi>I</mi><mi mathvariant="normal">Δ</mi><mover><mi>ℓ</mi><mo>→</mo></mover><mo>×</mo><mover><mi>r</mi><mo>^</mo></mover></mrow><msup><mi>r</mi><mn>2</mn></msup></mfrac></mrow></math>`,
    mag: `<math display="block"><mrow><mo stretchy="false">|</mo><mi mathvariant="normal">Δ</mi><mi>B</mi><mo stretchy="false">|</mo><mo>=</mo><mfrac><msub><mi>μ</mi><mn>0</mn></msub><mrow><mn>4</mn><mi>π</mi></mrow></mfrac><mfrac><mrow><mi>I</mi><mi mathvariant="normal">Δ</mi><mi>ℓ</mi><mi>sin</mi><mi>θ</mi></mrow><msup><mi>r</mi><mn>2</mn></msup></mfrac></mrow></math>`
  };

  // 向量小工具（物理座標陣列）
  const add = (a, b) => a.map((v, k) => v + b[k]), sub = (a, b) => a.map((v, k) => v - b[k]), mul = (a, s) => a.map(v => v * s);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = a => Math.hypot(...a), unit = a => { const l = len(a); return l < 1e-12 ? [0, 0, 0] : mul(a, 1 / l); };
  // 導線形狀：pos(u) 畫整條導線，u∈[0,1]；pick(s) 把「電流元位置」滑桿 s∈[0,1] 換成 u
  const SHAPES = {
    curve: {name: "彎曲導線", pos: u => { const x = -14 + 28 * u; return [x, 1.2 * x * Math.exp(-x * x / 18), 0]; }, pick: s => (6 + 16 * s) / 28, closed: false, iAt: .2, s0: .5},
    straight: {name: "直導線", pos: u => [-16 + 32 * u, 0, 0], pick: s => (8 + 16 * s) / 32, closed: false, iAt: .2, s0: .5},
    loop: {name: "圓線圈", pos: u => [3.2 * Math.cos(2 * Math.PI * u), 3.2 * Math.sin(2 * Math.PI * u), 0], pick: s => s, closed: true, iAt: .125, s0: .75}
  };
  const frameAt = (shape, u) => {
    const S = SHAPES[shape], h = 1e-4, a = S.closed ? u - h : Math.max(0, u - h), b = S.closed ? u + h : Math.min(1, u + h);
    const E = S.pos(u), t = unit(sub(S.pos(b), S.pos(a)));
    let up = [0, 0, 1]; if (Math.abs(dot(up, t)) > .95) up = [0, 1, 0];
    const e3 = unit(sub(up, mul(t, dot(up, t)))), e2 = cross(e3, t);
    return {E, t, e2, e3};
  };

  function mountBiot(root) {
    const sliders = [["s", "電流元位置", 0, 100, .5, 50, "%"], ["d", "r cos θ（沿 Δℓ 到截面）", -6, 6, .05, 2.12, "m"], ["rho", "r sin θ（截面內半徑）", .3, 6, .05, 2.12, "m"], ["p", "方位角 φ", 0, 360, 1, 90, "°"], ["i", "電流 I", .5, 5, .1, 2, "A"]];
    root.innerHTML = `
      <div class="bs-wrap">
        <div class="bs-canvas" aria-label="必歐－沙伐定律三維圖。拖曳黑點 P 移動測點，拖曳空白處旋轉視角。"></div>
        <p class="bs-loading">正在載入 3D 畫面…</p>
        <section class="bs-panel bs-formula">
          <header><strong>必歐－沙伐定律</strong><span>Biot–Savart law</span><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <div class="bs-body">
            <p>載流導線上的一小段電流元 IΔℓ，在空間中 P 點產生的微小磁場：</p>
            <div class="bs-eq bs-eq-vec">${math.vec}</div>
            <div class="bs-eq bs-eq-mag">${math.mag}</div>
            <p class="bs-tip">🖐 用 <b>r cos θ</b>（截面離電流元多遠）與 <b>r sin θ</b>（截面內的半徑）放置 P，也可直接拖曳<b>黑點 P</b>；用「電流元位置」在導線上換一段電流元（P 跟著走，r cos θ、r sin θ 不變）。拖曳空白處旋轉視角、滾輪縮放。</p>
          </div>
        </section>
        <section class="bs-panel bs-read">
          <header><strong>即時讀值</strong><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <dl class="bs-body">
            <div><dt>電流 I</dt><dd data-r="i"></dd></div>
            <div><dt>電流元長度 Δℓ</dt><dd>${DL.toFixed(2)} m</dd></div>
            <div><dt>r cos θ</dt><dd data-r="dd"></dd></div>
            <div><dt>r sin θ</dt><dd data-r="rho"></dd></div>
            <div><dt>距離 r</dt><dd data-r="r"></dd></div>
            <div><dt>夾角 θ</dt><dd data-r="t"></dd></div>
            <div><dt>sin θ</dt><dd data-r="s"></dd></div>
            <div class="bs-key"><dt>磁場 |ΔB|</dt><dd data-r="b"></dd></div>
            <div><dt>ΔB 方向</dt><dd data-r="d"></dd></div>
          </dl>
        </section>
        <section class="bs-panel bs-ctrl">
          <header><strong>控制</strong><span data-sim-bar></span><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <div class="bs-body">
            <div class="bs-seg bs-shapes" role="group" aria-label="導線形狀">
              ${Object.entries(SHAPES).map(([k, v]) => `<button type="button" data-shape="${k}" aria-pressed="${k === "curve"}">${v.name}</button>`).join("")}
            </div>
            <div class="bs-seg bs-views" role="group" aria-label="視角">
              <button type="button" data-view="front">正視圖</button><button type="button" data-view="side">側視圖</button><button type="button" data-view="top">上視圖</button><button type="button" data-view="iso" aria-pressed="true">立體</button>
            </div>
            ${sliders.map(([id, label, min, max, step, v, u]) =>
              `<label class="bs-slider" data-row="${id}"><span><span>${label}</span><output data-o="${id}"></output></span><input type="range" data-s="${id}" min="${min}" max="${max}" step="${step}" value="${v}" data-u="${u}"></label>`).join("")}
            <div class="bs-toggles">
              <button type="button" data-t="only" aria-pressed="false">只顯示電流元</button>
              <button type="button" data-t="flow" aria-pressed="false">動態電流</button>
              <button type="button" data-t="section" aria-pressed="true">垂直截面</button>
              <button type="button" data-t="plane" aria-pressed="true">Δℓ–r 平面</button>
              <button type="button" data-t="circle" aria-pressed="true">同心圓磁力線</button>
            </div>
          </div>
        </section>
      </div>`;
    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const host = $(".bs-canvas");
    const st = {shape: "curve", s: 50, r: 3, t: 45, d: 0, rho: 0, p: 90, i: 2, only: false, section: true, plane: true, circle: true, flow: false, P: [0, 0, 0]};
    for (const b of $$(".bs-fold")) b.addEventListener("click", () => { const p = b.closest(".bs-panel"); p.classList.toggle("folded"); b.textContent = p.classList.contains("folded") ? "▸" : "▾"; });

    const frame = () => frameAt(st.shape, SHAPES[st.shape].pick(st.s / 100));
    // 由 r、θ、φ（相對目前的電流元）放置 P
    const placeP = () => {
      const f = frame(), t = st.t * Math.PI / 180, p = st.p * Math.PI / 180;
      st.P = add(f.E, mul(add(mul(f.t, Math.cos(t)), add(mul(f.e2, Math.sin(t) * Math.cos(p)), mul(f.e3, Math.sin(t) * Math.sin(p)))), st.r));
    };
    const physics = () => {
      const f = frame(), rv = sub(st.P, f.E), r = len(rv), c = cross(f.t, rv);
      const s = len(c) / r, B = MU4PI * st.i * DL * s / (r * r);
      const along = dot(rv, f.t), C = add(f.E, mul(f.t, along)), rhoV = sub(st.P, C);
      return {...f, rv, r, s, B, dir: unit(c), C, rho: len(rhoV), rhoHat: unit(rhoV)};
    };
    // 圓柱座標：d = r cos θ（P 所在截面離電流元的距離，沿 Δℓ 方向為正）、ρ = r sin θ（P 到電流元延長線的半徑）
    const derive = () => { const t = st.t * Math.PI / 180; st.d = st.r * Math.cos(t); st.rho = st.r * Math.sin(t); };
    const fromCyl = () => { st.r = Math.hypot(st.d, st.rho); st.t = Math.atan2(st.rho, st.d) * 180 / Math.PI; };
    function syncInputs() { derive(); for (const inp of $$("[data-s]")) inp.value = st[inp.dataset.s]; }
    function readouts() {
      const ph = physics();
      $('[data-r="i"]').textContent = st.i.toFixed(1) + " A";
      $('[data-r="r"]').textContent = ph.r.toFixed(2) + " m";
      $('[data-r="dd"]').textContent = st.d.toFixed(2) + " m";
      $('[data-r="rho"]').textContent = st.rho.toFixed(2) + " m";
      $('[data-r="t"]').textContent = st.t.toFixed(1) + "°";
      $('[data-r="s"]').textContent = ph.s.toFixed(3);
      $('[data-r="b"]').textContent = num(ph.B) + " T";
      $('[data-r="d"]').textContent = "⊥ Δℓ 與 r，沿同心圓切線";
      const fmt = {s: v => v.toFixed(1), d: v => v.toFixed(2), rho: v => v.toFixed(2), r: v => v.toFixed(2), t: v => v.toFixed(1), p: v => v.toFixed(0), i: v => v.toFixed(1)};
      for (const [id] of sliders) $(`[data-o="${id}"]`).textContent = fmt[id](st[id]) + " " + $(`[data-s="${id}"]`).dataset.u;
    }
    const changed = () => { syncInputs(); readouts(); dirty = true; };
    for (const inp of $$("[data-s]")) inp.addEventListener("input", () => {
      const k = inp.dataset.s; st[k] = +inp.value;
      if (k === "d" || k === "rho") fromCyl();
      if (k !== "i") placeP();
      changed();
    });
    for (const b of $$("[data-t]")) b.addEventListener("click", () => { st[b.dataset.t] = !st[b.dataset.t]; b.setAttribute("aria-pressed", String(st[b.dataset.t])); dirty = true; });
    const setShape = k => {
      st.shape = k; st.s = SHAPES[k].s0 * 100; Object.assign(st, {r: 3, t: 45, p: 90});
      for (const b of $$("[data-shape]")) b.setAttribute("aria-pressed", String(b.dataset.shape === k));
      placeP(); changed(); shapeDirty = true;
    };
    for (const b of $$("[data-shape]")) b.addEventListener("click", () => setShape(b.dataset.shape));
    placeP(); derive(); syncInputs(); readouts();

    let disposed = false, dirty = true, shapeDirty = true, raf = 0, cleanup = () => {};
    const api = {
      state: () => ({...st, ...physics()}),
      set(o) {
        if (o.shape && o.shape !== st.shape) setShape(o.shape);
        const {shape, ...rest} = o; Object.assign(st, rest);
        const moveP = ["r", "t", "p", "d", "rho"].some(k => k in rest);
        if ("d" in rest || "rho" in rest) fromCyl();
        if (moveP || "s" in rest) placeP();
        changed();
      },
      boxes: () => []
    };
    root.sceneApi = api;

    loadThree().then(() => { if (!disposed) cleanup = build(); }).catch(e => { $(".bs-loading").textContent = "3D 畫面載入失敗：" + e.message; });

    function build() {
      const T = window.THREE;
      $(".bs-loading").remove();
      const V = (x, y, z) => new T.Vector3(x, z, -y), VA = a => V(a[0], a[1], a[2]);   // 物理座標 → three.js
      const renderer = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
      host.append(renderer.domElement);
      const labels = new T.CSS2DRenderer(); labels.domElement.className = "bs-labels"; host.append(labels.domElement);
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 300);
      const controls = new T.OrbitControls(camera, labels.domElement);
      controls.enableDamping = true; controls.dampingFactor = .12; controls.minDistance = 4; controls.maxDistance = 45;
      scene.add(new T.HemisphereLight(0xffffff, 0xcfd8e3, .72));
      const sun = new T.DirectionalLight(0xffffff, .62); sun.position.set(6, 10, 8); scene.add(sun);

      const mat = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .45, metalness: .1, ...extra});
      const label = (text, cls = "") => { const d = document.createElement("div"); d.className = "bs-label " + cls; d.innerHTML = text; const o = new T.CSS2DObject(d); scene.add(o); return o; };
      const show = (o, on) => { o.visible = on; if (o.element) o.element.style.display = on ? "" : "none"; };
      const placeCyl = (m, a, b) => {
        const dir = new T.Vector3().subVectors(b, a), l = dir.length();
        m.position.copy(a).addScaledVector(dir, .5); m.scale.set(1, l, 1); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
      };
      const arrowMesh = (color, radius = .045) => {
        const g = new T.Group(), shaft = new T.Mesh(new T.CylinderGeometry(radius, radius, 1, 16), mat(color)), head = new T.Mesh(new T.ConeGeometry(radius * 3.2, 1, 20), mat(color));
        g.add(shaft, head); g.userData = {shaft, head}; scene.add(g); return g;
      };
      const setArrow = (g, from, to, headLen = .26) => {
        const dir = new T.Vector3().subVectors(to, from), l = dir.length();
        g.visible = l > 1e-3; if (!g.visible) return;
        const h = Math.min(headLen, l * .45), u = dir.clone().normalize();
        g.position.copy(from); g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), u);
        g.userData.shaft.scale.set(1, l - h, 1); g.userData.shaft.position.set(0, (l - h) / 2, 0);
        g.userData.head.scale.set(1, h, 1); g.userData.head.position.set(0, l - h / 2, 0);
      };
      const lineGeo = pts => new T.BufferGeometry().setFromPoints(pts);

      // 導線（依形狀重建）、電流方向箭頭
      let wire = null;
      const iArrow = arrowMesh(0x9a4a12, .05), iLabel = label("I", "bs-cur");
      // 電流元與它的延長線（同心圓的軸）
      const element = new T.Mesh(new T.CylinderGeometry(.17, .17, 1, 28), mat(0xf5a524, {emissive: 0x5a3200, roughness: .35})); scene.add(element);
      // 電流元本身就是向量 IΔℓ：黃色線段＋箭頭
      const elHead = new T.Mesh(new T.ConeGeometry(.3, .42, 28), mat(0xf5a524, {emissive: 0x5a3200, roughness: .35})); scene.add(elHead);
      const axis = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({color: 0x94a3b8, dashSize: .2, gapSize: .14})); scene.add(axis);
      const eLabel = label("I" + vec("Δℓ"), "bs-cur bs-big");
      // 測點與向量
      const P = new T.Mesh(new T.SphereGeometry(.15, 32, 20), mat(0x0f172a, {roughness: .3})); scene.add(P);
      const pHit = new T.Mesh(new T.SphereGeometry(.42, 12, 8), new T.MeshBasicMaterial({visible: false})); scene.add(pHit);
      const pLabel = label("P", "bs-geo bs-big");
      const rArrow = arrowMesh(0x475569, .035), rLabel = label(vec("r"), "bs-geo");
      const bArrow = arrowMesh(0x1d4ed8, .055), bLabel = label(vec("ΔB"), "bs-mag bs-big");
      const arc = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: 0xdb2777})); scene.add(arc);
      const thLabel = label("θ", "bs-ang");
      const fan = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({color: 0xf5a524, transparent: true, opacity: .2, side: T.DoubleSide, depthWrite: false})); scene.add(fan);
      const section = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({color: 0x3b82f6, transparent: true, opacity: .09, side: T.DoubleSide, depthWrite: false})); scene.add(section);
      const sectionEdge = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(1, 1)), new T.LineBasicMaterial({color: 0x3b82f6, transparent: true, opacity: .4})); scene.add(sectionEdge);
      const circle = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: 0x60a5fa})); scene.add(circle);
      // d：電流元到截面（沿延長線）；ρ：截面圓心到 P
      const dBar = new T.Mesh(new T.CylinderGeometry(.03, .03, 1, 10), mat(0xb45309)); scene.add(dBar);
      const dCaps = [0, 1].map(() => { const m = new T.Mesh(new T.CylinderGeometry(.13, .13, .03, 20), mat(0xb45309)); scene.add(m); return m; });
      const cDot = new T.Mesh(new T.SphereGeometry(.09, 16, 10), mat(0x3b82f6)); scene.add(cDot);
      const rhoLine = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({color: 0x3b82f6, dashSize: .16, gapSize: .1})); scene.add(rhoLine);
      const dLabel = label("r cos θ", "bs-cur bs-small"), rhoLabel = label("r sin θ", "bs-field bs-small");
      const circleHeads = Array.from({length: 4}, () => { const c = new T.Mesh(new T.ConeGeometry(.09, .28, 16), mat(0x3b82f6)); scene.add(c); return c; });
      const dots = Array.from({length: 26}, () => { const d = new T.Mesh(new T.SphereGeometry(.15, 14, 10), new T.MeshBasicMaterial({color: 0xffd166})); scene.add(d); return d; });

      function rebuildWire() {
        const S = SHAPES[st.shape];
        if (wire) { scene.remove(wire); wire.geometry.dispose(); }
        const pts = Array.from({length: 241}, (_, k) => VA(S.pos(k / 240)));
        const curve = new T.CatmullRomCurve3(pts, S.closed);
        wire = new T.Mesh(new T.TubeGeometry(curve, S.closed ? 200 : 320, .12, 18, S.closed), mat(0xb8733a, {metalness: .35, roughness: .38})); scene.add(wire);
        const f = frameAt(st.shape, S.iAt), base = add(f.E, mul(f.e3, .55));
        setArrow(iArrow, VA(sub(base, mul(f.t, .7))), VA(add(base, mul(f.t, .7))), .3);
        iLabel.position.copy(VA(add(base, mul(f.e3, .4))));
      }
      function update(time) {
        if (shapeDirty) { rebuildWire(); shapeDirty = false; }
        const S = SHAPES[st.shape], ph = physics(), Pv = VA(st.P), E = ph.E;
        show(wire, !st.only); show(iArrow, !st.only); show(iLabel, !st.only);
        // 電流元：沿切線、長 Δℓ
        placeCyl(element, VA(sub(E, mul(ph.t, DL / 2))), VA(add(E, mul(ph.t, DL / 2 - .05))));
        elHead.position.copy(VA(add(E, mul(ph.t, DL / 2 + .16)))); elHead.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), VA(ph.t).normalize());
        eLabel.position.copy(VA(add(add(E, mul(len(ph.rhoHat) > .5 ? ph.rhoHat : ph.e3, -.55)), mul(ph.t, -.9))));
        const ext = Math.max(ph.r, 2) + 1.4;
        axis.geometry.dispose(); axis.geometry = lineGeo([VA(sub(E, mul(ph.t, ext))), VA(add(E, mul(ph.t, ext)))]); axis.computeLineDistances();
        // P、r、ΔB
        P.position.copy(Pv); pHit.position.copy(Pv); pLabel.position.copy(VA(add(st.P, [0, 0, .42])));
        setArrow(rArrow, VA(E), VA(add(E, mul(ph.rv, 1 - .16 / ph.r))), .26);
        rLabel.position.copy(VA(add(add(E, mul(ph.rv, .55)), mul(ph.e3, .3))));
        // ΔB：長度與 |ΔB| 成正比（I = 2 A、r = 3 m、θ = 90° 為 1.6 單位），太長時截在 3.5
        const B0 = MU4PI * 2 * DL / 9, L = Math.min(3.5, 1.6 * ph.B / B0);
        setArrow(bArrow, Pv, VA(add(st.P, mul(ph.dir, L))), .3);
        bLabel.position.copy(VA(add(st.P, mul(ph.dir, L + .35))));
        // θ 弧與 Δℓ–r 扇形：在 t̂ 與 ρ̂ 張成的平面上
        const theta = Math.acos(clamp(dot(ph.rv, ph.t) / ph.r, -1, 1)), rh = ph.rhoHat;
        const along = (rad, a) => add(E, add(mul(ph.t, rad * Math.cos(a)), mul(rh, rad * Math.sin(a))));
        const arcR = Math.min(1, ph.r * .4);
        arc.geometry.dispose(); arc.geometry = lineGeo(Array.from({length: 41}, (_, k) => VA(along(arcR, theta * k / 40))));
        thLabel.position.copy(VA(along(arcR + .3, theta / 2)));
        // Δℓ–r 平面只畫到 P 所在的截面為止：電流元 E、截面圓心 C、P 圍成的直角三角形（兩股 r cos θ、r sin θ，斜邊 r）
        const o = VA(E), c = VA(ph.C), tri = [o.x, o.y, o.z, c.x, c.y, c.z, Pv.x, Pv.y, Pv.z];
        fan.geometry.dispose(); fan.geometry = new T.BufferGeometry(); fan.geometry.setAttribute("position", new T.Float32BufferAttribute(tri, 3));
        fan.visible = st.plane;
        // 垂直截面與同心圓磁力線：圓心在電流元延長線上，半徑 r sin θ
        const size = 2 * (ph.rho + 1.3), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), VA(ph.t).normalize());
        for (const m of [section, sectionEdge]) { m.position.copy(VA(ph.C)); m.quaternion.copy(q); m.scale.set(size, size, 1); m.visible = st.section; }
        const w = cross(ph.t, rh), ring = a => add(ph.C, add(mul(rh, ph.rho * Math.cos(a)), mul(w, ph.rho * Math.sin(a))));
        const dOn = st.section && Math.abs(st.d) > .05;
        const dA = add(E, mul(rh, -.7)), dB = add(ph.C, mul(rh, -.7));
        if (dOn) { placeCyl(dBar, VA(dA), VA(dB)); dCaps.forEach((m, k) => { m.position.copy(VA(k ? dB : dA)); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), VA(ph.t).normalize()); }); }
        show(dBar, dOn); show(dLabel, dOn); dCaps.forEach(m => show(m, dOn));
        dLabel.position.copy(VA(add(add(E, mul(sub(ph.C, E), .5)), mul(rh, -1.02))));
        cDot.position.copy(VA(ph.C)); show(cDot, st.section);
        rhoLine.geometry.dispose(); rhoLine.geometry = lineGeo([VA(ph.C), Pv]); rhoLine.computeLineDistances(); show(rhoLine, st.section);
        rhoLabel.position.copy(VA(add(add(ph.C, mul(sub(st.P, ph.C), .5)), mul(ph.t, .35)))); show(rhoLabel, st.section);
        circle.geometry.dispose(); circle.geometry = lineGeo(Array.from({length: 97}, (_, k) => VA(ring(k / 96 * Math.PI * 2)))); circle.visible = st.circle;
        circleHeads.forEach((c, k) => {
          const a = Math.PI / 4 + k * Math.PI / 2, tan = add(mul(w, Math.cos(a)), mul(rh, -Math.sin(a)));
          c.position.copy(VA(ring(a))); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), VA(tan).normalize()); c.visible = st.circle;
        });
        // 動態電流：沿導線移動的亮點（只顯示電流元時，只在電流元上跑）
        const speed = .045 * (st.i / 2) * (S.closed ? 2.2 : 1);
        dots.forEach((d, k) => {
          let u = (k / dots.length + time / 1000 * speed) % 1;
          if (st.only) { const pos = add(E, mul(ph.t, DL * ((k / 3 + time / 1000 * .5 * st.i / 2) % 1 - .5))); d.position.copy(VA(pos)); d.visible = st.flow && k < 3; return; }
          d.position.copy(VA(S.pos(u))); d.visible = st.flow;
        });
      }
      // 視角：以電流元的局部座標定義，讓不同位置看起來一致
      const views = {iso: [-6.1, -9.6, 6.5], front: [0, -14, .1], side: [14, 0, .1], top: [0, -.01, 14]};
      let tween = null, lastE = null;
      const go = (name, instant = false) => {
        const f = frame(), target = add(f.E, mul(sub(st.P, f.E), .4)), [a, b, c] = views[name];
        const to = VA(add(target, add(mul(f.t, a), add(mul(f.e2, b), mul(f.e3, c))))), look = VA(target);
        for (const btn of $$("[data-view]")) btn.setAttribute("aria-pressed", String(btn.dataset.view === name));
        if (instant) { camera.position.copy(to); controls.target.copy(look); controls.update(); return; }
        tween = {from: camera.position.clone(), fromT: controls.target.clone(), to, look, t: 0};
      };
      for (const b of $$("[data-view]")) b.addEventListener("click", () => go(b.dataset.view));
      for (const b of $$("[data-shape]")) b.addEventListener("click", () => { lastE = null; go("iso"); });
      go("iso", true);
      // 拖曳 P：沿著與螢幕平行、通過 P 的平面移動
      const ray = new T.Raycaster(), ndc = new T.Vector2(), dragPlane = new T.Plane(), hit = new T.Vector3();
      let dragging = false;
      const toNdc = e => { const r = labels.domElement.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); };
      const onDown = e => {
        toNdc(e);
        if (!ray.intersectObject(pHit).length) return;
        dragging = true; controls.enabled = false; labels.domElement.setPointerCapture(e.pointerId);
        dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()).negate(), P.position);
        e.stopPropagation();
      };
      const onMove = e => {
        toNdc(e);
        if (!dragging) { labels.domElement.style.cursor = ray.intersectObject(pHit).length ? "grab" : ""; return; }
        if (!ray.ray.intersectPlane(dragPlane, hit)) return;
        const f = frame(), q = [hit.x, -hit.z, hit.y], rv = sub(q, f.E), r = clamp(len(rv), .6, 8);
        let t = Math.acos(clamp(dot(rv, f.t) / len(rv), -1, 1)) * 180 / Math.PI;
        let p = Math.atan2(dot(rv, f.e3), dot(rv, f.e2)) * 180 / Math.PI; if (p < 0) p += 360;
        api.set({r: Math.round(r / .05) * .05, t: clamp(Math.round(t * 2) / 2, 2, 178), p: Math.round(p)});
      };
      const onUp = () => { dragging = false; controls.enabled = true; };
      labels.domElement.addEventListener("pointerdown", onDown, true);
      labels.domElement.addEventListener("pointermove", onMove);
      labels.domElement.addEventListener("pointerup", onUp); labels.domElement.addEventListener("pointercancel", onUp);
      // 尺寸
      const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      const ro = new ResizeObserver(resize); ro.observe(host); resize();
      const tick = time => {
        if (disposed) return;
        raf = requestAnimationFrame(tick);
        // 換電流元位置時，鏡頭跟著電流元平移（P 也跟著電流元一起動）
        const E = frame().E, mid = mul(add(E, st.P), .5);
        if (lastE && !tween && !dragging && (E[0] !== lastE[0] || E[1] !== lastE[1] || E[2] !== lastE[2])) {
          const d = VA(sub(E, lastE)); camera.position.add(d); controls.target.add(d);
          const need = 1.9 * len(sub(st.P, E)) + 6, off = camera.position.clone().sub(controls.target);
          if (off.length() < need) camera.position.copy(controls.target).add(off.setLength(need));
        }
        lastE = E;
        // P 移遠時（例如 ρ、r 變大）自動拉遠鏡頭並對準中點；使用者自己縮放後，只有 P 再變動才會調整
        if (dirty && !tween && !dragging) {
          const need = 1.9 * len(sub(st.P, E)) + 6, off = camera.position.clone().sub(controls.target);
          if (off.length() < need) { const m = VA(mid), shift = m.clone().sub(controls.target).multiplyScalar(.5); controls.target.add(shift); camera.position.copy(controls.target).add(off.setLength(need)); }
        }
        if (tween) {
          tween.t = Math.min(1, tween.t + .06); const e = 1 - (1 - tween.t) ** 3;
          camera.position.lerpVectors(tween.from, tween.to, e); controls.target.lerpVectors(tween.fromT, tween.look, e);
          if (tween.t >= 1) tween = null;
        }
        controls.update();
        if (dirty || st.flow) { update(time); dirty = false; }
        renderer.render(scene, camera); labels.render(scene, camera);
      };
      raf = requestAnimationFrame(tick);
      api.project = () => { const v = P.position.clone().project(camera), r = host.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
      return () => { ro.disconnect(); controls.dispose(); renderer.dispose(); };
    }
    return () => { disposed = true; cancelAnimationFrame(raf); cleanup(); };
  }

  EM.scenes.push({id: "biot-savart", title: "必歐－沙伐定律：電流元的磁場", sections: ["2-2"], chapter: 2,
    lead: "彎曲導線上任一小段電流元，在 P 點產生的磁場朝哪裡？大小和 r、θ 有什麼關係？",
    description: "彎曲導線、直導線或圓線圈上任選電流元，三維拖曳測點 P，看 r、θ、ΔB、Δℓ–r 平面與同心圓磁力線；可只顯示電流元。",
    steps: ["按「只顯示電流元」，固定 r cos θ，把 r sin θ 加倍：r、θ、|ΔB| 各怎麼變？", "固定 r sin θ，把 r cos θ 從 0 調大（P 的截面往前移）：θ 怎麼變？|ΔB| 為什麼變小？r cos θ = 0 時 θ 是幾度？", "改變方位角 φ：|ΔB| 會變嗎？ΔB 的方向和同心圓磁力線有什麼關係？", "拖「電流元位置」換到導線上不同的一段（r cos θ、r sin θ 不變）：|ΔB| 會變嗎？ΔB 的方向跟著什麼轉？", "切到「側視圖」沿著電流元看：用右手定則判斷磁力線繞的方向。"],
    takeaway: "ΔB 的方向垂直於 Δℓ 與 r 所決定的平面，大小與 sin θ 成正比、與 r² 成反比；繞電流元的延長線一圈，ΔB 都沿同心圓切線。整條導線在 P 的磁場，就是每一段電流元的 ΔB 向量相加。",
    full: true, mount: mountBiot});
})();
