/*
 * scene-3d.js —— 3D 模擬共用工具：同一套版面（浮動公式／讀值／控制面板）、同一套 three.js 舞台與繪圖零件。
 * 物理座標 z 朝上；three.js 的 y 朝上，所以 (x, y, z)物理 → (x, z, −y)畫面。
 */
(() => {
  const VENDOR = ["assets/vendor/three/three.min.js", "assets/vendor/three/OrbitControls.js", "assets/vendor/three/CSS2DRenderer.js"];
  let ready = null;
  const loadThree = () => ready || (ready = VENDOR.reduce((p, src) => p.then(() => new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`) && window.THREE) return res();
    const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("無法載入 " + src));
    document.head.append(s);
  })), Promise.resolve()));
  const v = {
    add: (a, b) => a.map((x, k) => x + b[k]), sub: (a, b) => a.map((x, k) => x - b[k]), mul: (a, s) => a.map(x => x * s),
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(...a), unit: a => { const l = Math.hypot(...a); return l < 1e-12 ? [0, 0, 0] : a.map(x => x / l); }
  };
  const vec = t => `<span class="bs-v">${t}</span>`;
  // 版面：公式（左上）、讀值（左下）、控制（右上）。rows = [[key, 名稱, 類別?]]；sliders = [[id, 名稱, min, max, step, value, 單位]]
  function layout(root, o) {
    const rows = o.rows.map(([k, n, c]) => `<div${c ? ` class="${c}"` : ""}><dt>${n}</dt><dd data-r="${k}"></dd></div>`).join("");
    const sliders = (o.sliders || []).map(([id, label, min, max, step, val, u]) =>
      `<label class="bs-slider" data-row="${id}"><span><span>${label}</span><output data-o="${id}"></output></span><input type="range" data-s="${id}" min="${min}" max="${max}" step="${step}" value="${val}" data-u="${u}"></label>`).join("");
    const segs = (o.segs || []).map(g => `<div class="bs-seg" role="group" aria-label="${g.label}">${g.items.map(([k, n, on]) => `<button type="button" data-${g.attr}="${k}" aria-pressed="${!!on}">${n}</button>`).join("")}</div>`).join("");
    const toggles = (o.toggles || []).map(([k, n, on]) => `<button type="button" data-t="${k}" aria-pressed="${!!on}">${n}</button>`).join("");
    root.innerHTML = `
      <div class="bs-wrap">
        <div class="bs-canvas" aria-label="${o.aria || ""}"></div>
        <p class="bs-loading">正在載入 3D 畫面…</p>
        <section class="bs-panel bs-formula">
          <header><strong>${o.title}</strong><span>${o.sub || ""}</span><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <div class="bs-body">${o.formula}</div>
        </section>
        <section class="bs-panel bs-read">
          <header><strong>即時讀值</strong><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <dl class="bs-body">${rows}</dl>
        </section>
        <section class="bs-panel bs-ctrl">
          <header><strong>控制</strong><span data-sim-bar></span><button type="button" class="bs-fold" aria-label="收合">▾</button></header>
          <div class="bs-body">${segs}${sliders}<div class="bs-toggles">${toggles}</div></div>
        </section>
      </div>`;
    for (const b of root.querySelectorAll(".bs-fold")) b.addEventListener("click", () => { const p = b.closest(".bs-panel"); p.classList.toggle("folded"); b.textContent = p.classList.contains("folded") ? "▸" : "▾"; });
  }
  // 舞台：renderer、標籤層、相機、軌道控制、燈光，與常用繪圖零件
  function stage(root, host) {
    const T = window.THREE;
    const V = (x, y, z) => new T.Vector3(x, z, -y), VA = a => V(a[0], a[1], a[2]);
    const renderer = new T.WebGLRenderer({antialias: true, alpha: true, preserveDrawingBuffer: true});
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
    host.append(renderer.domElement);
    const labels = new T.CSS2DRenderer(); labels.domElement.className = "bs-labels"; host.append(labels.domElement);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(38, 1, .1, 400);
    const controls = new T.OrbitControls(camera, labels.domElement);
    controls.enableDamping = true; controls.dampingFactor = .12; controls.minDistance = 4; controls.maxDistance = 90;
    scene.add(new T.HemisphereLight(0xffffff, 0xcfd8e3, .72));
    const sun = new T.DirectionalLight(0xffffff, .62); sun.position.set(6, 10, 8); scene.add(sun);
    const mat = (color, extra = {}) => new T.MeshStandardMaterial({color, roughness: .45, metalness: .1, ...extra});
    const label = (text, cls = "") => { const d = document.createElement("div"); d.className = "bs-label " + cls; d.innerHTML = text; const o = new T.CSS2DObject(d); scene.add(o); return o; };
    const show = (o, on) => { o.visible = on; if (o.element) o.element.style.display = on ? "" : "none"; };
    const up = new T.Vector3(0, 1, 0);
    const placeCyl = (m, a, b) => { const dir = new T.Vector3().subVectors(b, a), l = dir.length(); m.position.copy(a).addScaledVector(dir, .5); m.scale.set(1, l, 1); m.quaternion.setFromUnitVectors(up, dir.normalize()); };
    const arrowMesh = (color, radius = .045) => {
      const g = new T.Group(), shaft = new T.Mesh(new T.CylinderGeometry(radius, radius, 1, 16), mat(color)), head = new T.Mesh(new T.ConeGeometry(radius * 3.2, 1, 20), mat(color));
      g.add(shaft, head); g.userData = {shaft, head}; scene.add(g); return g;
    };
    const setArrow = (g, from, to, headLen = .26) => {
      const dir = new T.Vector3().subVectors(to, from), l = dir.length();
      g.visible = l > 1e-3; if (!g.visible) return;
      const h = Math.min(headLen, l * .45), u = dir.clone().normalize();
      g.position.copy(from); g.quaternion.setFromUnitVectors(up, u);
      g.userData.shaft.scale.set(1, l - h, 1); g.userData.shaft.position.set(0, (l - h) / 2, 0);
      g.userData.head.scale.set(1, h, 1); g.userData.head.position.set(0, l - h / 2, 0);
    };
    const lineGeo = pts => new T.BufferGeometry().setFromPoints(pts);
    const resize = () => { const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); renderer.domElement.style.width = w + "px"; renderer.domElement.style.height = h + "px"; labels.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const ro = new ResizeObserver(resize); ro.observe(host); resize();
    // 鏡頭動畫與拖曳測點
    let tween = null;
    const flyTo = (pos, look) => { tween = {from: camera.position.clone(), fromT: controls.target.clone(), to: pos, look, t: 0}; };
    const jump = (pos, look) => { camera.position.copy(pos); controls.target.copy(look); controls.update(); };
    const stepCamera = () => {
      if (tween) { tween.t = Math.min(1, tween.t + .06); const e = 1 - (1 - tween.t) ** 3; camera.position.lerpVectors(tween.from, tween.to, e); controls.target.lerpVectors(tween.fromT, tween.look, e); if (tween.t >= 1) tween = null; }
      controls.update();
    };
    // 拖曳 target 物件：沿與螢幕平行、通過該物件的平面移動，回呼給物理座標 [x, y, z]
    const dragPoint = (hitMesh, centerMesh, onMove) => {
      const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(), hit = new T.Vector3(); let dragging = false;
      const el = labels.domElement, toNdc = e => { const r = el.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, camera); };
      el.addEventListener("pointerdown", e => {
        toNdc(e); if (!ray.intersectObject(hitMesh).length) return;
        dragging = true; controls.enabled = false; el.setPointerCapture(e.pointerId);
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new T.Vector3()).negate(), centerMesh.position); e.stopPropagation();
      }, true);
      el.addEventListener("pointermove", e => {
        toNdc(e);
        if (!dragging) { el.style.cursor = ray.intersectObject(hitMesh).length ? "grab" : ""; return; }
        if (ray.ray.intersectPlane(plane, hit)) onMove([hit.x, -hit.z, hit.y]);
      });
      const end = () => { dragging = false; controls.enabled = true; };
      el.addEventListener("pointerup", end); el.addEventListener("pointercancel", end);
      return () => dragging;
    };
    const dispose = () => { ro.disconnect(); controls.dispose(); renderer.dispose(); };
    return {T, V, VA, renderer, labels, scene, camera, controls, mat, label, show, placeCyl, arrowMesh, setArrow, lineGeo, flyTo, jump, stepCamera, dragPoint, dispose, project: m => { const p = m.position.clone().project(camera), r = host.getBoundingClientRect(); return [r.left + (p.x + 1) / 2 * r.width, r.top + (1 - p.y) / 2 * r.height]; }};
  }
  EM.s3d = {loadThree, v, vec, layout, stage};
})();
