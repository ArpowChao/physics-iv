/*
 * scene-biot.js —— 必歐－沙伐定律：電流元在空間中一點產生的磁場（three.js 3D）
 * 物理座標：導線沿 +x（電流方向），電流元 IΔℓ 在原點 O；
 * P = r (cos θ, sin θ cos φ, sin θ sin φ)。three.js 的 y 朝上，所以 (x, y, z)物理 → (x, z, −y)畫面。
 * ΔB = μ₀/4π · I Δℓ × r̂ / r²，方向 = x̂ × r̂ ∝ (0, −sin φ, cos φ)，大小 μ₀/4π · I Δℓ sin θ / r²。
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

  function mountBiot(root) {
    root.innerHTML = `
      <div class="bs-wrap">
        <div class="bs-canvas" aria-label="必歐－沙伐定律三維圖。拖曳黑點 P 移動測點，拖曳空白處旋轉視角。"></div>
        <p class="bs-loading">正在載入 3D 畫面…</p>
        <section class="bs-panel bs-formula">
          <header><strong>必歐－沙伐定律</strong><span>Biot–Savart law</span><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <div class="bs-body">
            <p>載流導線的電流元 IΔℓ 在空間中 P 點產生的微小磁場：</p>
            <div class="bs-eq bs-eq-vec">${math.vec}</div>
            <div class="bs-eq bs-eq-mag">${math.mag}</div>
            <p class="bs-tip">🖐 直接拖曳畫面中的<b>黑點 P</b>，可在三維空間中移動測點；拖曳空白處旋轉視角、滾輪縮放。</p>
          </div>
        </section>
        <section class="bs-panel bs-read">
          <header><strong>即時讀值</strong><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <dl class="bs-body">
            <div><dt>電流 I</dt><dd data-r="i"></dd></div>
            <div><dt>電流元長度 Δℓ</dt><dd>${DL.toFixed(2)} m</dd></div>
            <div><dt>距離 r</dt><dd data-r="r"></dd></div>
            <div><dt>夾角 θ</dt><dd data-r="t"></dd></div>
            <div><dt>sin θ</dt><dd data-r="s"></dd></div>
            <div class="bs-key"><dt>磁場 |ΔB|</dt><dd data-r="b"></dd></div>
            <div><dt>ΔB 方向</dt><dd data-r="d"></dd></div>
          </dl>
        </section>
        <section class="bs-panel bs-ctrl">
          <header><strong>控制</strong><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <div class="bs-body">
            <div class="bs-views" role="group" aria-label="視角">
              <button type="button" data-view="front">正視圖</button><button type="button" data-view="side">側視圖</button><button type="button" data-view="top">上視圖</button><button type="button" data-view="iso" aria-pressed="true">立體</button>
            </div>
            ${[["r", "距離 r", 1.5, 5, .05, 3, "m"], ["t", "夾角 θ", 5, 175, .5, 45, "°"], ["p", "方位角 φ", 0, 360, 1, 90, "°"], ["i", "電流 I", .5, 5, .1, 2, "A"]].map(([id, label, min, max, step, v, u]) =>
              `<label class="bs-slider"><span><span>${label}</span><output data-o="${id}"></output></span><input type="range" data-s="${id}" min="${min}" max="${max}" step="${step}" value="${v}" data-u="${u}"></label>`).join("")}
            <div class="bs-toggles">
              <button type="button" data-t="section" aria-pressed="true">垂直截面</button>
              <button type="button" data-t="plane" aria-pressed="true">Δℓ–r 平面</button>
              <button type="button" data-t="circle" aria-pressed="true">同心圓磁力線</button>
              <button type="button" data-t="flow" aria-pressed="false">動態電流</button>
            </div>
          </div>
        </section>
      </div>`;
    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const host = $(".bs-canvas");
    const st = {r: 3, t: 45, p: 90, i: 2, section: true, plane: true, circle: true, flow: false};
    for (const b of $$(".bs-fold")) b.addEventListener("click", () => { const p = b.closest(".bs-panel"); p.classList.toggle("folded"); b.textContent = p.classList.contains("folded") ? "▸" : "▾"; });

    const physics = () => {
      const t = st.t * Math.PI / 180, p = st.p * Math.PI / 180, s = Math.sin(t);
      const P = [st.r * Math.cos(t), st.r * s * Math.cos(p), st.r * s * Math.sin(p)];
      const B = MU4PI * st.i * DL * s / (st.r * st.r);
      return {t, p, s, P, B, dir: [0, -Math.sin(p), Math.cos(p)], rho: st.r * s};
    };
    function readouts() {
      const ph = physics();
      $('[data-r="i"]').textContent = st.i.toFixed(1) + " A";
      $('[data-r="r"]').textContent = st.r.toFixed(2) + " m";
      $('[data-r="t"]').textContent = st.t.toFixed(1) + "°";
      $('[data-r="s"]').textContent = ph.s.toFixed(3);
      $('[data-r="b"]').textContent = num(ph.B) + " T";
      $('[data-r="d"]').textContent = "⊥ Δℓ 與 r，沿同心圓切線";
      for (const inp of $$("[data-s]")) {
        const v = +inp.value; $(`[data-o="${inp.dataset.s}"]`).textContent = (inp.dataset.s === "r" ? v.toFixed(2) : inp.dataset.s === "i" ? v.toFixed(1) : v.toFixed(1)) + " " + inp.dataset.u;
      }
    }
    for (const inp of $$("[data-s]")) inp.addEventListener("input", () => { st[inp.dataset.s] = +inp.value; readouts(); dirty = true; });
    for (const b of $$("[data-t]")) b.addEventListener("click", () => { st[b.dataset.t] = !st[b.dataset.t]; b.setAttribute("aria-pressed", String(st[b.dataset.t])); dirty = true; });
    readouts();

    let disposed = false, dirty = true, raf = 0, cleanup = () => {};
    const api = {state: () => ({...physics(), ...st}), set(o) { Object.assign(st, o); for (const k in o) { const inp = $(`[data-s="${k}"]`); if (inp) inp.value = o[k]; } readouts(); dirty = true; }, boxes: () => []};
    root.sceneApi = api;

    loadThree().then(() => { if (!disposed) cleanup = build(); }).catch(e => { $(".bs-loading").textContent = "3D 畫面載入失敗：" + e.message; });

    function build() {
      const T = window.THREE;
      $(".bs-loading").remove();
      const V = (x, y, z) => new T.Vector3(x, z, -y);              // 物理座標 → three.js
      const renderer = new T.WebGLRenderer({antialias: true, alpha: false, preserveDrawingBuffer: true});
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0xf3f7f8);
      host.append(renderer.domElement);
      const labels = new T.CSS2DRenderer(); labels.domElement.className = "bs-labels"; host.append(labels.domElement);
      const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 200);
      const controls = new T.OrbitControls(camera, labels.domElement);
      controls.enableDamping = true; controls.dampingFactor = .12; controls.minDistance = 5; controls.maxDistance = 40;
      scene.add(new T.AmbientLight(0xffffff, .62));
      const sun = new T.DirectionalLight(0xffffff, .7); sun.position.set(6, 10, 8); scene.add(sun);

      const mat = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .45, metalness: .1, ...extra});
      const label = (text, cls = "") => { const d = document.createElement("div"); d.className = "bs-label " + cls; d.innerHTML = text; const o = new T.CSS2DObject(d); scene.add(o); return o; };
      const cylinderBetween = (a, b, radius, material) => {
        const dir = new T.Vector3().subVectors(b, a), len = dir.length();
        const m = new T.Mesh(new T.CylinderGeometry(radius, radius, len, 28), material);
        m.position.copy(a).addScaledVector(dir, .5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), dir.normalize());
        return m;
      };
      const arrowMesh = (color, radius = .045) => {
        const g = new T.Group(), shaft = new T.Mesh(new T.CylinderGeometry(radius, radius, 1, 16), mat(color)), head = new T.Mesh(new T.ConeGeometry(radius * 3.2, 1, 20), mat(color));
        g.add(shaft, head); g.userData = {shaft, head}; scene.add(g); return g;
      };
      const setArrow = (g, from, to, headLen = .26) => {
        const dir = new T.Vector3().subVectors(to, from), len = dir.length();
        g.visible = len > 1e-3; if (!g.visible) return;
        const h = Math.min(headLen, len * .45), u = dir.clone().normalize();
        g.position.copy(from); g.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), u);
        g.userData.shaft.scale.set(1, len - h, 1); g.userData.shaft.position.set(0, (len - h) / 2, 0);
        g.userData.head.scale.set(1, h, 1); g.userData.head.position.set(0, len - h / 2, 0);
      };
      const dashed = (pts, color) => { const l = new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineDashedMaterial({color, dashSize: .18, gapSize: .12})); l.computeLineDistances(); scene.add(l); return l; };

      // 座標軸（x 軸就是導線）
      dashed([V(0, -3.2, 0), V(0, 3.2, 0)], 0x8a9aa2); dashed([V(0, 0, -2.6), V(0, 0, 3.4)], 0x8a9aa2);
      label("x", "bs-axis").position.copy(V(6.4, 0, -.6)); label("y", "bs-axis").position.copy(V(0, 3.45, 0)); label("z", "bs-axis").position.copy(V(0, 0, 3.65));
      // 導線與電流元
      scene.add(cylinderBetween(V(-16, 0, 0), V(16, 0, 0), .12, mat(0x2a8c9c)));
      scene.add(cylinderBetween(V(-DL / 2, 0, 0), V(DL / 2, 0, 0), .165, mat(0xf2d33a, {emissive: 0x403300})));
      const dlArrow = arrowMesh(0x2e9b4f, .04); setArrow(dlArrow, V(-.45, 0, -.42), V(.75, 0, -.42), .28);
      label(vec("Δℓ"), "bs-green").position.copy(V(.3, 0, -.82));
      const iArrow = arrowMesh(0x2a8c9c, .05); setArrow(iArrow, V(-3.6, 0, .5), V(-2.2, 0, .5), .3);
      label("I", "bs-teal").position.copy(V(-2.9, 0, .9));
      label("O", "bs-ink").position.copy(V(-.25, 0, .35));
      // 測點與向量
      const P = new T.Mesh(new T.SphereGeometry(.15, 32, 20), mat(0x15191c, {roughness: .3})); scene.add(P);
      const pHit = new T.Mesh(new T.SphereGeometry(.42, 12, 8), new T.MeshBasicMaterial({visible: false})); scene.add(pHit);
      const pLabel = label("P", "bs-ink bs-big");
      const rArrow = arrowMesh(0x5b6770, .035), rLabel = label(vec("r"), "bs-ink");
      const bArrow = arrowMesh(0xd9534a, .05), bLabel = label(vec("ΔB"), "bs-red");
      const arc = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: 0xd9534a})); scene.add(arc);
      const thLabel = label("θ", "bs-red");
      const fan = new T.Mesh(new T.BufferGeometry(), new T.MeshBasicMaterial({color: 0xf4a261, transparent: true, opacity: .28, side: T.DoubleSide, depthWrite: false})); scene.add(fan);
      const section = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({color: 0x5ab4d6, transparent: true, opacity: .16, side: T.DoubleSide, depthWrite: false})); scene.add(section);
      const sectionEdge = new T.LineSegments(new T.EdgesGeometry(new T.PlaneGeometry(1, 1)), new T.LineBasicMaterial({color: 0x5ab4d6, transparent: true, opacity: .6})); scene.add(sectionEdge);
      const circle = new T.Line(new T.BufferGeometry(), new T.LineBasicMaterial({color: 0x2a62b8})); scene.add(circle);
      const circleHeads = Array.from({length: 4}, () => { const c = new T.Mesh(new T.ConeGeometry(.09, .28, 16), mat(0x2a62b8)); scene.add(c); return c; });
      const dots = Array.from({length: 20}, () => { const d = new T.Mesh(new T.SphereGeometry(.15, 14, 10), new T.MeshBasicMaterial({color: 0xffe66b})); scene.add(d); return d; });

      function update(time) {
        const ph = physics(), [px, py, pz] = ph.P, Pv = V(px, py, pz), rhoDir = [0, Math.cos(ph.p), Math.sin(ph.p)];
        P.position.copy(Pv); pHit.position.copy(Pv); pLabel.position.copy(V(px, py, pz + .42));
        setArrow(rArrow, V(0, 0, 0), Pv.clone().multiplyScalar(1 - .16 / st.r), .26);
        rLabel.position.copy(V(px * .55, py * .55, pz * .55 + .3));
        // ΔB：長度與 |ΔB| 成正比（以 I = 2 A、r = 3 m、θ = 90° 為 1.6 單位），太長時截在 3.5
        const B0 = MU4PI * 2 * DL / 9, len = Math.min(3.5, 1.6 * ph.B / B0), [dx, dy, dz] = ph.dir;
        setArrow(bArrow, Pv, V(px + dx * len, py + dy * len, pz + dz * len), .3);
        bLabel.position.copy(V(px + dx * (len + .35), py + dy * (len + .35), pz + dz * (len + .35)));
        // θ 弧與 Δℓ–r 扇形
        const arcR = Math.min(1, st.r * .4), arcPts = [], fanPos = [0, 0, 0];
        for (let k = 0; k <= 40; k++) {
          const a = ph.t * k / 40, c = Math.cos(a), s = Math.sin(a);
          arcPts.push(V(arcR * c, arcR * s * rhoDir[1], arcR * s * rhoDir[2]));
        }
        arc.geometry.dispose(); arc.geometry = new T.BufferGeometry().setFromPoints(arcPts);
        const mid = ph.t / 2; thLabel.position.copy(V((arcR + .3) * Math.cos(mid), (arcR + .3) * Math.sin(mid) * rhoDir[1], (arcR + .3) * Math.sin(mid) * rhoDir[2]));
        const verts = [];
        for (let k = 0; k < 40; k++) for (const a of [ph.t * k / 40, ph.t * (k + 1) / 40]) {
          const q = V(st.r * Math.cos(a), st.r * Math.sin(a) * rhoDir[1], st.r * Math.sin(a) * rhoDir[2]); verts.push(q.x, q.y, q.z);
        }
        const tri = []; for (let k = 0; k < 40; k++) tri.push(0, 0, 0, verts[k * 6], verts[k * 6 + 1], verts[k * 6 + 2], verts[k * 6 + 3], verts[k * 6 + 4], verts[k * 6 + 5]);
        fan.geometry.dispose(); fan.geometry = new T.BufferGeometry(); fan.geometry.setAttribute("position", new T.Float32BufferAttribute(tri, 3));
        fan.visible = st.plane;
        // 垂直截面與同心圓磁力線
        const size = 2 * (ph.rho + 1.3);
        for (const m of [section, sectionEdge]) { m.position.copy(V(px, 0, 0)); m.rotation.set(0, Math.PI / 2, 0); m.scale.set(size, size, 1); m.visible = st.section; }
        const cp = []; for (let k = 0; k <= 96; k++) { const a = k / 96 * Math.PI * 2; cp.push(V(px, ph.rho * Math.cos(a), ph.rho * Math.sin(a))); }
        circle.geometry.dispose(); circle.geometry = new T.BufferGeometry().setFromPoints(cp); circle.visible = st.circle;
        circleHeads.forEach((c, k) => {
          const a = ph.p + Math.PI / 4 + k * Math.PI / 2, pos = V(px, ph.rho * Math.cos(a), ph.rho * Math.sin(a)), tan = V(0, -Math.sin(a), Math.cos(a));
          c.position.copy(pos); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), tan.normalize()); c.visible = st.circle;
        });
        dots.forEach((d, k) => { const x = ((k / dots.length) * 24 + (time / 1000) * 1.1 * (st.i / 2)) % 24 - 12; d.position.copy(V(x, 0, 0)); d.visible = st.flow; d.scale.setScalar(1.05); });
      }
      // 視角
      const views = {iso: [V(-5.2, -9.6, 7.3), V(.9, 0, .8)], front: [V(.6, -14, .9), V(.6, 0, .9)], side: [V(14, 0, .9), V(0, 0, .6)], top: [V(.6, -.01, 14), V(.6, 0, 0)]};
      let tween = null;
      const go = (name, instant = false) => {
        const [to, look] = views[name];
        for (const b of $$("[data-view]")) b.setAttribute("aria-pressed", String(b.dataset.view === name));
        if (instant) { camera.position.copy(to); controls.target.copy(look); controls.update(); return; }
        tween = {from: camera.position.clone(), fromT: controls.target.clone(), to, look, t: 0};
      };
      for (const b of $$("[data-view]")) b.addEventListener("click", () => go(b.dataset.view));
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
        const x = hit.x, y = -hit.z, z = hit.y, r = clamp(Math.hypot(x, y, z), 1.5, 5);
        const t = clamp(Math.acos(clamp(x / Math.hypot(x, y, z), -1, 1)) * 180 / Math.PI, 5, 175);
        let p = Math.atan2(z, y) * 180 / Math.PI; if (p < 0) p += 360;
        api.set({r: Math.round(r / .05) * .05, t: Math.round(t * 2) / 2, p: Math.round(p)});
      };
      const onUp = () => { dragging = false; controls.enabled = true; };
      labels.domElement.addEventListener("pointerdown", onDown, true);
      labels.domElement.addEventListener("pointermove", onMove);
      labels.domElement.addEventListener("pointerup", onUp); labels.domElement.addEventListener("pointercancel", onUp);
      // 尺寸
      const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
      const ro = new ResizeObserver(resize); ro.observe(host); resize();
      const frame = time => {
        if (disposed) return;
        raf = requestAnimationFrame(frame);
        if (tween) {
          tween.t = Math.min(1, tween.t + .06); const e = 1 - (1 - tween.t) ** 3;
          camera.position.lerpVectors(tween.from, tween.to, e); controls.target.lerpVectors(tween.fromT, tween.look, e);
          if (tween.t >= 1) tween = null;
        }
        controls.update();
        if (dirty || st.flow) { update(time); dirty = false; }
        renderer.render(scene, camera); labels.render(scene, camera);
      };
      raf = requestAnimationFrame(frame);
      api.project = () => { const v = P.position.clone().project(camera), r = host.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
      return () => { ro.disconnect(); controls.dispose(); renderer.dispose(); };
    }
    return () => { disposed = true; cancelAnimationFrame(raf); cleanup(); };
  }

  EM.scenes.push({id: "biot-savart", title: "必歐－沙伐定律：電流元的磁場", sections: ["2-2"], chapter: 2,
    lead: "電流元在 P 點產生的磁場，方向朝哪裡？大小和 r、θ 有什麼關係？",
    description: "三維空間中拖曳測點 P，看位置向量 r、夾角 θ、ΔB、Δℓ–r 平面與通過 P 的同心圓磁力線。",
    steps: ["把 r 從 1.5 m 拉到 3 m，|ΔB| 變成幾分之幾？", "把 θ 拉到 90°、再拉到接近 0° 或 180°，|ΔB| 怎麼變？", "改變方位角 φ：|ΔB| 會變嗎？ΔB 的方向和同心圓磁力線有什麼關係？", "切到「側視圖」沿著導線看：用右手定則判斷磁力線繞的方向。"],
    takeaway: "ΔB 的方向垂直於 Δℓ 與 r 所決定的平面，大小與 sin θ 成正比、與 r² 成反比；繞導線一圈，ΔB 都沿著以導線為中心的同心圓切線。",
    full: true, mount: mountBiot});
})();
