/*
 * scene-solenoid.js —— 螺線管的磁場（three.js 3D，與必歐－沙伐同一套版面）
 * 螺線管是一條連續的螺旋導線：半徑 R、長 L、N 匝，沿 x 軸。電流沿 +x 前進、右旋 → 管內 B 沿 +x。
 * P 在以 x 軸為軸的圓柱座標 (x, ρ, φ)。B(P) 是把導線切成許多小段電流元，逐段必歐－沙伐後向量相加。
 */
(() => {
  const {loadThree, v: {len, unit, mul, add}, vec, layout, stage} = EM.s3d;
  const MU = 4e-7 * Math.PI, MU4PI = 1e-7;
  const {clamp, num} = EM.sceneKit;
  const sliders = [["N", "線圈匝數 N", 4, 30, 1, 12, "匝"], ["L", "螺線管長度 L", 4, 20, .5, 12, "m"], ["R", "半徑 R", 1, 4, .1, 2.2, "m"], ["i", "電流 I", .5, 5, .1, 2, "A"],
    ["x", "P 沿軸位置 x", -14, 14, .1, 0, "m"], ["rho", "P 離軸距離 ρ", 0, 7, .05, 0, "m"], ["phi", "方位角 φ", 0, 360, 1, 90, "°"]];
  const math = `<math display="block"><mrow><mover><mi>B</mi><mo>→</mo></mover><mo>=</mo><mo>∑</mo><mfrac><msub><mi>μ</mi><mn>0</mn></msub><mrow><mn>4</mn><mi>π</mi></mrow></mfrac><mfrac><mrow><mi>I</mi><mi mathvariant="normal">Δ</mi><mover><mi>ℓ</mi><mo>→</mo></mover><mo>×</mo><mover><mi>r</mi><mo>^</mo></mover></mrow><msup><mi>r</mi><mn>2</mn></msup></mfrac></mrow></math>`;
  const ideal = `<math display="block"><mrow><msub><mi>B</mi><mtext>管內</mtext></msub><mo>≈</mo><msub><mi>μ</mi><mn>0</mn></msub><mi>n</mi><mi>I</mi><mo>,</mo><mspace width="1em"/><mi>n</mi><mo>=</mo><mfrac><mi>N</mi><mi>L</mi></mfrac></mrow></math>`;

  function mountSolenoid(root) {
    layout(root, {
      title: "螺線管的磁場", sub: "Solenoid", aria: "螺線管三維圖。拖曳黑點 P 移動測點，拖曳空白處旋轉視角。",
      formula: `<p>整條螺旋導線在 P 的磁場，是每一小段電流元 ΔB 的向量和：</p><div class="bs-eq">${math}</div><p>管子夠長時，管內磁場近似均勻：</p><div class="bs-eq">${ideal}</div>
        <p class="bs-tip">🖐 拖曳<b>黑點 P</b>（或用滑桿）到管內、管口、管外，比較總磁場 B 與 μ₀nI；拖曳空白處旋轉、滾輪縮放。</p>`,
      rows: [["i", "電流 I"], ["n", "單位長度匝數 n"], ["pos", "P 的位置"], ["bx", "B 沿軸分量 Bₓ"], ["bt", "總磁場 |B|", "bs-key bs-total"], ["bi", "理想 μ₀nI"], ["where", "P 在哪裡"]],
      sliders,
      segs: [{label: "視角", attr: "view", items: [["front", "正視圖"], ["side", "側視圖"], ["top", "上視圖"], ["iso", "立體", true]]}],
      toggles: [["lines", "磁力線", true], ["flow", "動態電流", false], ["axis", "中心軸", true], ["tot", "總磁場 B 箭頭", true]]
    });
    const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
    const host = $(".bs-canvas");
    const st = {N: 12, L: 12, R: 2.2, i: 2, x: 0, rho: 0, phi: 90, lines: true, flow: false, axis: true, tot: true};
    let seg = null, disposed = false, dirty = true, geoDirty = true, raf = 0, cleanup = () => {};
    const helix = (u) => [-st.L / 2 + st.L * u, st.R * Math.cos(2 * Math.PI * st.N * u), st.R * Math.sin(2 * Math.PI * st.N * u)];
    const nSeg = () => Math.max(240, st.N * 60);
    const buildSeg = () => {
      const n = nSeg(), p = Array.from({length: n + 1}, (_, k) => helix(k / n));
      seg = {n, mx: new Float64Array(n), my: new Float64Array(n), mz: new Float64Array(n), dx: new Float64Array(n), dy: new Float64Array(n), dz: new Float64Array(n)};
      for (let k = 0; k < n; k++) { seg.mx[k] = (p[k][0] + p[k + 1][0]) / 2; seg.my[k] = (p[k][1] + p[k + 1][1]) / 2; seg.mz[k] = (p[k][2] + p[k + 1][2]) / 2; seg.dx[k] = p[k + 1][0] - p[k][0]; seg.dy[k] = p[k + 1][1] - p[k][1]; seg.dz[k] = p[k + 1][2] - p[k][2]; }
    };
    // 必歐－沙伐逐段求和（I = 1 A；乘上 I 即可）
    const field = (px, py, pz) => {
      let bx = 0, by = 0, bz = 0;
      for (let k = 0; k < seg.n; k++) {
        const rx = px - seg.mx[k], ry = py - seg.my[k], rz = pz - seg.mz[k], r2 = rx * rx + ry * ry + rz * rz + .0025, f = MU4PI / (r2 * Math.sqrt(r2));
        bx += (seg.dy[k] * rz - seg.dz[k] * ry) * f; by += (seg.dz[k] * rx - seg.dx[k] * rz) * f; bz += (seg.dx[k] * ry - seg.dy[k] * rx) * f;
      }
      return [bx, by, bz];
    };
    const P = () => [st.x, st.rho * Math.cos(st.phi * Math.PI / 180), st.rho * Math.sin(st.phi * Math.PI / 180)];
    const physics = () => {
      if (!seg || seg.n !== nSeg()) buildSeg();
      const p = P(), B = mul(field(...p), st.i), n = st.N / st.L, inside = Math.abs(st.x) < st.L / 2 && st.rho < st.R;
      return {P: p, B, Bmag: len(B), n, ideal: MU * n * st.i, inside};
    };
    const fmt = {N: x => x.toFixed(0), L: x => x.toFixed(1), R: x => x.toFixed(1), i: x => x.toFixed(1), x: x => x.toFixed(1), rho: x => x.toFixed(2), phi: x => x.toFixed(0)};
    function readouts() {
      const ph = physics();
      $('[data-r="i"]').textContent = st.i.toFixed(1) + " A";
      $('[data-r="n"]').textContent = ph.n.toFixed(2) + " 匝／m";
      $('[data-r="pos"]').textContent = `x = ${st.x.toFixed(1)}，ρ = ${st.rho.toFixed(2)} m`;
      $('[data-r="bx"]').textContent = num(ph.B[0]) + " T";
      $('[data-r="bt"]').textContent = num(ph.Bmag) + " T";
      $('[data-r="bi"]').textContent = num(ph.ideal) + " T";
      $('[data-r="where"]').textContent = ph.inside ? "管內（B 近似均勻）" : Math.abs(st.x) < st.L / 2 ? "管外（側邊，很弱）" : "管口外側";
      for (const [id] of sliders) $(`[data-o="${id}"]`).textContent = fmt[id](st[id]) + " " + $(`[data-s="${id}"]`).dataset.u;
    }
    const changed = () => { for (const inp of $$("[data-s]")) inp.value = st[inp.dataset.s]; readouts(); dirty = true; };
    for (const inp of $$("[data-s]")) inp.addEventListener("input", () => { const k = inp.dataset.s; st[k] = +inp.value; if (["N", "L", "R"].includes(k)) geoDirty = true; changed(); });
    for (const b of $$("[data-t]")) b.addEventListener("click", () => { st[b.dataset.t] = !st[b.dataset.t]; b.setAttribute("aria-pressed", String(st[b.dataset.t])); dirty = true; });
    readouts();
    const api = {
      state: () => ({...st, ...physics()}),
      set(o) { Object.assign(st, o); if (["N", "L", "R"].some(k => k in o)) geoDirty = true; changed(); },
      boxes: () => []
    };
    root.sceneApi = api;
    loadThree().then(() => { if (!disposed) cleanup = build(); }).catch(e => { $(".bs-loading").textContent = "3D 畫面載入失敗：" + e.message; });

    function build() {
      $(".bs-loading").remove();
      const S = stage(root, host), {T, VA, scene, mat, label, show, setArrow, lineGeo} = S;
      let wire = null, lineObjs = [], headCount = 0;
      const iArrow = S.arrowMesh(0x9a4a12, .06), iLabel = label("I", "bs-cur");
      const axis = new T.Line(new T.BufferGeometry(), new T.LineDashedMaterial({color: 0x94a3b8, dashSize: .25, gapSize: .15})); scene.add(axis);
      const Pm = new T.Mesh(new T.SphereGeometry(.17, 32, 20), mat(0x0f172a, {roughness: .3})); scene.add(Pm);
      const pHit = new T.Mesh(new T.SphereGeometry(.5, 12, 8), new T.MeshBasicMaterial({visible: false})); scene.add(pHit);
      const pLabel = label("P", "bs-geo bs-big");
      const bArrow = S.arrowMesh(0x0f766e, .08), bLabel = label(vec("B"), "bs-tot bs-big");
      const dots = Array.from({length: 40}, () => { const d = new T.Mesh(new T.SphereGeometry(.16, 14, 10), new T.MeshBasicMaterial({color: 0xffd166})); scene.add(d); return d; });
      const heads = Array.from({length: 40}, () => { const c = new T.Mesh(new T.ConeGeometry(.12, .36, 16), mat(0x3b82f6)); scene.add(c); return c; });
      const up = new T.Vector3(0, 1, 0);

      function rebuildGeo() {
        if (wire) { scene.remove(wire); wire.geometry.dispose(); }
        const n = nSeg(), pts = Array.from({length: n + 1}, (_, k) => VA(helix(k / n)));
        wire = new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), n * 2, .085, 12, false), mat(0xb8733a, {metalness: .35, roughness: .38})); scene.add(wire);
        const b = [st.L / 2 + 1.2, 0, st.R + .9];
        setArrow(iArrow, VA([st.L / 2 - .6, 0, st.R + .7]), VA([st.L / 2 + .9, 0, st.R + .7]), .32);
        iLabel.position.copy(VA(b));
        const h = st.L / 2 + 5;
        axis.geometry.dispose(); axis.geometry = lineGeo([VA([-h, 0, 0]), VA([h, 0, 0])]); axis.computeLineDistances();
      }
      // 磁力線：從管中央截面上的幾個點出發，沿 B 前後積分（RK2）
      function rebuildLines() {
        for (const o of lineObjs) { scene.remove(o); o.geometry.dispose(); }
        lineObjs = []; let hi = 0;
        const reach = st.L / 2 + 14, seeds = [0, .5, .85].map(f => st.R * f);
        for (const y of seeds) {
          const trace = sign => {
            const pts = [[0, y, 0]]; let p = [0, y, 0];
            for (let k = 0; k < 700; k++) {
              const b1 = field(...p), l1 = len(b1); if (l1 < 1e-14) break;
              const h = .3 * sign, mid = add(p, mul(b1, h / (2 * l1))), b2 = field(...mid), l2 = len(b2); if (l2 < 1e-14) break;
              p = add(p, mul(b2, h / l2)); pts.push(p);
              if (Math.abs(p[0]) > reach || Math.hypot(p[1], p[2]) > reach) break;
              if (k > 40 && len(add(p, mul([0, y, 0], -1))) < .25) break;   // 繞一圈回來
            }
            return pts;
          };
          const fwd = trace(1), back = trace(-1).reverse(), all = [...back, ...fwd.slice(1)];
          const line = new T.Line(lineGeo(all.map(VA)), new T.LineBasicMaterial({color: 0x60a5fa})); scene.add(line); lineObjs.push(line);
          // 方向箭頭：沿 B（順著 fwd）
          for (const frac of [.2, .65]) {
            const k = Math.floor(all.length * frac); if (k < 1 || k >= all.length - 1 || hi >= heads.length) continue;
            const a = VA(all[k]), b = VA(all[k + 1]); heads[hi].position.copy(a); heads[hi].quaternion.setFromUnitVectors(up, new T.Vector3().subVectors(b, a).normalize()); heads[hi].visible = true; hi++;
          }
        }
        headCount = hi;
      }
      function update(time) {
        if (geoDirty) { rebuildGeo(); buildSeg(); rebuildLines(); geoDirty = false; }
        const ph = physics(), Pv = VA(ph.P);
        Pm.position.copy(Pv); pHit.position.copy(Pv); pLabel.position.copy(VA(add(ph.P, [0, 0, .5])));
        show(axis, st.axis);
        const tOn = st.tot && ph.Bmag > 0, bu = unit(ph.B);
        show(bArrow, tOn); show(bLabel, tOn);
        if (tOn) { setArrow(bArrow, Pv, VA(add(ph.P, mul(bu, 2.8))), .4); bLabel.position.copy(VA(add(ph.P, mul(bu, 3.25)))); }
        lineObjs.forEach(o => { o.visible = st.lines; }); heads.forEach((h, k) => { h.visible = st.lines && k < headCount; });
        const speed = .05 * (st.i / 2);
        dots.forEach((d, k) => { const u = (k / dots.length + time / 1000 * speed) % 1; d.position.copy(VA(helix(u))); d.visible = st.flow; });
      }
      const dist = () => Math.max(st.L * 2 + 10, st.R * 7);
      const views = {iso: [-.45, -1, .6], front: [0, -1, 0.001], side: [1, 0, 0.001], top: [0, -.001, 1]};
      const go = (name, instant) => {
        const d = unit(views[name]), to = VA(mul(d, dist())), look = VA([0, 0, 0]);
        for (const btn of $$("[data-view]")) btn.setAttribute("aria-pressed", String(btn.dataset.view === name));
        instant ? S.jump(to, look) : S.flyTo(to, look);
      };
      for (const b of $$("[data-view]")) b.addEventListener("click", () => go(b.dataset.view));
      go("iso", true);
      const isDragging = S.dragPoint(pHit, Pm, q => {
        const x = clamp(Math.round(q[0] * 10) / 10, -14, 14), rho = clamp(Math.round(Math.hypot(q[1], q[2]) * 20) / 20, 0, 7);
        let phi = Math.atan2(q[2], q[1]) * 180 / Math.PI; if (phi < 0) phi += 360;
        api.set({x, rho, phi: rho < .05 ? st.phi : Math.round(phi)});
      });
      const tick = time => {
        if (disposed) return; raf = requestAnimationFrame(tick);
        S.stepCamera();
        if (dirty || st.flow || geoDirty) { update(time); dirty = false; }
        S.renderer.render(scene, S.camera); S.labels.render(scene, S.camera);
      };
      raf = requestAnimationFrame(tick);
      api.project = () => S.project(Pm);
      return () => S.dispose();
    }
    return () => { disposed = true; cancelAnimationFrame(raf); cleanup(); };
  }

  EM.scenes.push({id: "solenoid-field", title: "螺線管的磁場", sections: ["2-2"], chapter: 2,
    lead: "螺線管內、管口、管外的磁場長什麼樣？為什麼管內幾乎均勻、管外很弱？",
    description: "連續的螺旋導線：改匝數、長度、半徑與電流，拖曳測點 P 到管內外，看整條導線的總磁場 B、磁力線，並與 μ₀nI 比較。",
    steps: ["把 P 放在管中心（x = 0、ρ = 0）：B 朝哪？大小和 μ₀nI 差多少？", "沿軸把 x 慢慢拉向管口再到管外：B 怎麼變？", "固定 x = 0，把 ρ 從 0 拉到管壁再到管外：B 在管內有變嗎？穿過管壁後呢？", "匝數加倍、長度不變（n 加倍）：管內 B 怎麼變？把長度加倍、匝數不變呢？", "把半徑變大，管內 B 還和 μ₀nI 一致嗎？用右手定則確認 B 的方向。"],
    takeaway: "長螺線管內部磁場近似均勻，B ≈ μ₀nI，只和單位長度匝數 n 與電流 I 有關，和半徑無關；管外磁場很弱；管口附近磁力線發散、強度約降為管內的一半。",
    full: true, mount: mountSolenoid});
})();
