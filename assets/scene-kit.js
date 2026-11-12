/*
 * scene-kit.js —— 情境實驗共用工具
 * 版面：一個外框裡放大畫布（可拖曳）＋可收合的控制、讀值、圖表面板（與必歐 3D 同一套樣式）；手機上改為上下排列。
 * 畫布文字一律走 label()：自動夾在畫布內，並記錄外框供 ?selftest=1 檢查重疊。
 */
(() => {
  const TAU = 2 * Math.PI;
  const C = {ink: "#17343e", muted: "#5b747d", grid: "#dbe7e9", gridStrong: "#c3d6da", teal: "#0f7a6a", amber: "#b3600f",
    blue: "#2a62b8", red: "#d9534a", redFill: "#f3a39d", blueFill: "#9dbcf2", copper: "#b9772f", copperDark: "#8a5520",
    paper: "#f7fbfb", violet: "#7a3fa3", green: "#1f8a3a", field: "#4d7fd6"};
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const FONT = '"Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif';

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
  function makeLabeler(ctx, w, h) {
    const boxes = [];
    function label(text, x, y, {color = C.ink, size = 13, align = "center", bold = false, plate = false} = {}) {
      ctx.font = `${bold ? "700 " : ""}${size}px ${FONT}`;
      const tw = ctx.measureText(text).width, pad = 3;
      let left = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
      left = clamp(left, pad, w - tw - pad);
      const top = clamp(y - size * 0.8, pad, h - size - pad);
      if (plate) { ctx.fillStyle = "rgba(247,251,251,.9)"; ctx.fillRect(left - pad, top - 2, tw + 2 * pad, size + 5); }
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
  /* 太長的向量畫到 maxLen 為止，尾端加兩道斜線表示「超出比例」。回傳是否被截斷。 */
  function vector(ctx, x0, y0, dx, dy, color, maxLen, width = 3) {
    const n = Math.hypot(dx, dy);
    if (n < 0.5) return false;
    const cut = n > maxLen, k = cut ? maxLen / n : 1, x1 = x0 + dx * k, y1 = y0 + dy * k;
    arrow(ctx, x0, y0, x1, y1, color, width, 11);
    if (cut) {
      const ux = dx / n, uy = dy / n, mx = x0 + dx * k * 0.55, my = y0 + dy * k * 0.55;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 3;
      for (const s of [-4, 4]) { ctx.beginPath(); ctx.moveTo(mx + ux * s - uy * 7, my + uy * s + ux * 7); ctx.lineTo(mx + ux * s + uy * 7, my + uy * s - ux * 7); ctx.stroke(); }
      ctx.strokeStyle = color; ctx.lineWidth = 1.4;
      for (const s of [-4, 4]) { ctx.beginPath(); ctx.moveTo(mx + ux * s - uy * 7, my + uy * s + ux * 7); ctx.lineTo(mx + ux * s + uy * 7, my + uy * s - ux * 7); ctx.stroke(); }
    }
    return cut;
  }
  function grid(ctx, w, h, step, ox = 0, oy = 0, strongEvery = 5) {
    ctx.lineWidth = 1;
    let i = Math.floor(-ox / step);
    for (let x = ox + i * step; x <= w; x += step, i++) {
      ctx.strokeStyle = i % strongEvery === 0 ? C.gridStrong : C.grid;
      ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); ctx.stroke();
    }
    let j = Math.floor(-oy / step);
    for (let y = oy + j * step; y <= h; y += step, j++) {
      ctx.strokeStyle = j % strongEvery === 0 ? C.gridStrong : C.grid;
      ctx.beginPath(); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); ctx.stroke();
    }
  }
  function charge(ctx, x, y, q, r, selected = false) {
    const pos = q >= 0, g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .15, x, y, r);
    g.addColorStop(0, pos ? "#ffb4ab" : "#b9d1ff"); g.addColorStop(1, pos ? "#c8372d" : "#2754a8");
    ctx.fillStyle = q === 0 ? "#b8c3c7" : g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = selected ? "#f2b705" : "rgba(0,0,0,.35)"; ctx.lineWidth = selected ? 3 : 1.2; ctx.stroke();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = Math.max(2, r * .16); ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(x - r * .45, y); ctx.lineTo(x + r * .45, y);
    if (pos && q !== 0) { ctx.moveTo(x, y - r * .45); ctx.lineTo(x, y + r * .45); }
    ctx.stroke();
  }
  /* ⊙ 出紙、⊗ 入紙 */
  function fieldGlyph(ctx, x, y, out, r = 6, color = C.field) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (out) { ctx.beginPath(); ctx.arc(x, y, r * .28, 0, TAU); ctx.fill(); }
    else { const d = r * .62; ctx.beginPath(); ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d); ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d); ctx.stroke(); }
  }
  function overlaps(boxes) {
    const out = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) out.push([a.text, b.text]);
    }
    return out;
  }

  /* ---------- 數字格式 ---------- */
  const SUP = {"-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹"};
  function num(x, digits = 3) {
    if (!isFinite(x)) return "—";
    if (x === 0) return "0";
    const a = Math.abs(x);
    if (a >= 1e-3 && a < 1e5) {
      const d = Math.max(0, digits - 1 - Math.floor(Math.log10(a)));
      return (+x.toFixed(Math.min(d, 6))).toLocaleString("en-US", {maximumFractionDigits: 6}).replace("-", "−");
    }
    const e = Math.floor(Math.log10(a)), m = x / 10 ** e;
    return `${(+m.toFixed(digits - 1)).toString().replace("-", "−")} × 10${String(e).split("").map(c => SUP[c]).join("")}`;
  }
  function niceStep(span, target = 5) {
    const raw = span / target, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }

  /* ---------- 折線圖 ---------- */
  /* series: [{points:[[x,y]...], color, name, dash}]，y 為 NaN 的點讓線斷開。marker: {x,y,color} */
  function chart(canvas, {h = 200, xMin, xMax, yMin, yMax, xLabel = "", yLabel = "", series = [], markers = [], vlines = [], note = ""}) {
    const {ctx, w} = fitCanvas(canvas, h), L = makeLabeler(ctx, w, h);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    const x0 = 62, x1 = w - 16, y0 = 24, y1 = h - 34;
    const X = x => x0 + (x - xMin) / (xMax - xMin) * (x1 - x0), Y = y => y1 - (y - yMin) / (yMax - yMin) * (y1 - y0);
    ctx.save(); ctx.beginPath(); ctx.rect(x0, y0, x1 - x0, y1 - y0); ctx.clip();
    const xs = niceStep(xMax - xMin, 6), ys = niceStep(yMax - yMin, 4);
    ctx.lineWidth = 1;
    for (let v = Math.ceil(xMin / xs) * xs; v <= xMax + 1e-9; v += xs) { ctx.strokeStyle = C.grid; ctx.beginPath(); ctx.moveTo(X(v), y0); ctx.lineTo(X(v), y1); ctx.stroke(); }
    for (let v = Math.ceil(yMin / ys) * ys; v <= yMax + 1e-9; v += ys) { ctx.strokeStyle = Math.abs(v) < ys * 1e-6 ? "#8fa6ac" : C.grid; ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x1, Y(v)); ctx.stroke(); }
    for (const v of vlines) { ctx.strokeStyle = v.color || "#9fb4b9"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(v.x), y0); ctx.lineTo(X(v.x), y1); ctx.stroke(); ctx.setLineDash([]); }
    for (const s of series) {
      ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2.2; ctx.setLineDash(s.dash || []);
      ctx.beginPath(); let pen = false;
      for (const [x, y] of s.points) {
        if (!isFinite(y)) { pen = false; continue; }
        pen ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)); pen = true;
      }
      ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    for (const m of markers) {
      const inside = m.y >= yMin && m.y <= yMax, py = Y(clamp(m.y, yMin, yMax));
      ctx.fillStyle = m.color || C.ink; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(m.x), py, 5.5, 0, TAU); ctx.fill(); ctx.stroke();
      if (!inside) arrow(ctx, X(m.x), py + (m.y > yMax ? 14 : -14), X(m.x), py + (m.y > yMax ? 4 : -4), m.color || C.ink, 2, 7);
    }
    ctx.strokeStyle = "#9fb4b9"; ctx.lineWidth = 1; ctx.strokeRect(x0 + .5, y0 + .5, x1 - x0, y1 - y0);
    for (let v = Math.ceil(xMin / xs) * xs; v <= xMax + 1e-9; v += xs) L.label(num(v), X(v), y1 + 16, {size: 11, color: C.muted});
    for (let v = Math.ceil(yMin / ys) * ys; v <= yMax + 1e-9; v += ys) L.label(num(v), x0 - 6, Y(v) + 4, {size: 11, color: C.muted, align: "right"});
    L.label(xLabel, x1, h - 3, {size: 12, color: C.ink, align: "right"});
    L.label(yLabel, x0 + 4, y0 - 7, {size: 12, color: C.ink, align: "left", bold: true});
    if (note) L.label(note, x1, y0 - 7, {size: 11, color: C.muted, align: "right"});
    return {X, Y, boxes: L.boxes};
  }

  /* ---------- 版面與控制項 ---------- */
  function build(root, {tabs = [], controls = [], readouts = [], chart: wantChart = false, note = ""} = {}) {
    const ctlHTML = c => {
      if (c.type === "range") return `<label class="kit-ctl" for="kc-${c.id}"><span class="kit-ctl-line"><span>${c.label}</span><output id="ko-${c.id}"></output></span>
        <input id="kc-${c.id}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.value}"></label>`;
      if (c.type === "select") return `<label class="kit-ctl" for="kc-${c.id}"><span>${c.label}</span><select id="kc-${c.id}">${c.options.map(([v, n]) =>
        `<option value="${v}" ${String(v) === String(c.value) ? "selected" : ""}>${n}</option>`).join("")}</select></label>`;
      if (c.type === "check") return `<label class="kit-check sim-toggle"><input type="checkbox" id="kc-${c.id}" ${c.value ? "checked" : ""}><span>${c.label}</span></label>`;
      if (c.type === "buttons") return `<div class="kit-buttons">${c.items.map(b => `<button type="button" class="sim-btn ${b.primary ? "primary" : ""}" id="kc-${b.id}">${b.label}</button>`).join("")}</div>`;
      if (c.type === "heading") return `<h3 class="kit-heading">${c.label}</h3>`;
      return "";
    };
    const fold = `<button type="button" class="sim-fold" aria-label="收合" aria-expanded="true">▾</button>`;
    root.innerHTML = `
      <div class="sim-frame kit-frame">
        <div class="kit-top">
          ${tabs.length ? `<div class="scene-tabs sim-seg" role="tablist" aria-label="情境">${tabs.map((t, i) =>
            `<button type="button" role="tab" class="scene-tab" data-tab="${t.id}" aria-selected="${i === 0}">${t.name}</button>`).join("")}</div>` : `<span></span>`}
          <div class="kit-top-tools"><button type="button" class="sim-btn kit-side-toggle" aria-pressed="false">⇥ 收起面板</button><span data-sim-bar></span></div>
        </div>
        <p class="scene-hint" data-kit-hint hidden></p>
        <div class="kit-layout">
          <div class="kit-main">
            <div class="scene-stage" data-fill><canvas data-kit-canvas></canvas></div>
            ${wantChart ? `<section class="sim-panel kit-chart-panel"><header><strong>圖表</strong>${fold}</header><div class="sim-body scene-stage" data-kit-chart-wrap><canvas data-kit-chart></canvas></div></section>` : ""}
          </div>
          <aside class="kit-side">
            <section class="sim-panel"><header><strong>控制</strong>${fold}</header><div class="sim-body kit-panel">${controls.map(ctlHTML).join("")}</div></section>
            ${readouts.length ? `<section class="sim-panel"><header><strong>即時讀值</strong>${fold}</header><dl class="sim-body kit-readouts">${readouts.map(([id, name]) => `<div data-ro-row="${id}"><dt data-rl="${id}">${name}</dt><dd data-ro="${id}">—</dd></div>`).join("")}</dl></section>` : ""}
          </aside>
        </div>
        ${note ? `<p class="muted small kit-note">${note}</p>` : ""}
      </div>`;
    for (const b of root.querySelectorAll(".sim-fold")) b.addEventListener("click", () => {
      const p = b.closest(".sim-panel"), on = p.classList.toggle("folded");
      b.textContent = on ? "▸" : "▾"; b.setAttribute("aria-expanded", String(!on)); window.dispatchEvent(new Event("resize"));
    });
    const sideBtn = root.querySelector(".kit-side-toggle");
    sideBtn.addEventListener("click", () => {
      const on = root.querySelector(".kit-frame").classList.toggle("side-hidden");
      sideBtn.setAttribute("aria-pressed", String(on)); sideBtn.textContent = on ? "⇤ 打開面板" : "⇥ 收起面板";
      window.dispatchEvent(new Event("resize"));
    });
    const flat = controls.flatMap(c => c.type === "buttons" ? c.items.map(b => ({...b, type: "button"})) : [c]);
    const spec = Object.fromEntries(flat.filter(c => c.id).map(c => [c.id, c]));
    const el = id => root.querySelector("#kc-" + id);
    const ui = {
      canvas: root.querySelector("[data-kit-canvas]"), chart: root.querySelector("[data-kit-chart]"),
      chartWrap: root.querySelector("[data-kit-chart-wrap]"),
      get(id) { const e = el(id); if (!e) return undefined; return spec[id].type === "check" ? e.checked : spec[id].type === "select" ? e.value : +e.value; },
      set(id, v) { const e = el(id); if (!e) return; if (spec[id].type === "check") e.checked = !!v; else e.value = v; ui.refresh(id); },
      on(id, fn) { const e = el(id); if (!e) return; e.addEventListener(spec[id].type === "button" ? "click" : spec[id].type === "range" ? "input" : "change", () => { ui.refresh(id); fn(ui.get(id)); }); },
      refresh(id) { const c = spec[id], o = root.querySelector("#ko-" + id); if (c && o) o.textContent = c.fmt ? c.fmt(+el(id).value) : num(+el(id).value) + (c.unit ? " " + c.unit : ""); },
      configure(id, {min, max, step, value, label}) {
        const e = el(id); if (!e) return;
        if (min !== undefined) e.min = min; if (max !== undefined) e.max = max; if (step !== undefined) e.step = step; if (value !== undefined) e.value = value;
        if (label !== undefined) e.closest("label").querySelector("span span, span").textContent = label;
        ui.refresh(id);
      },
      show(id, visible) { const e = el(id); if (e) (e.closest("label") || e).hidden = !visible; },
      ro(id, text) { const d = root.querySelector(`[data-ro="${id}"]`); if (d && d.textContent !== text) d.textContent = text; },
      roLabel(id, text) { const d = root.querySelector(`[data-rl="${id}"]`); if (d && d.textContent !== text) d.textContent = text; },
      roShow(id, visible) { const d = root.querySelector(`[data-ro-row="${id}"]`); if (d) d.hidden = !visible; },
      hint(text) { const p = root.querySelector("[data-kit-hint]"); p.hidden = !text; p.textContent = text || ""; },
      tab(id) { for (const b of root.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === id)); },
      onTab(fn) { root.querySelector(".scene-tabs")?.addEventListener("click", e => { const b = e.target.closest("[data-tab]"); if (b) { ui.tab(b.dataset.tab); fn(b.dataset.tab); } }); }
    };
    for (const id in spec) ui.refresh(id);
    return ui;
  }

  /* ---------- 拖曳 ---------- */
  /* pick(px,py) 回傳被抓到的物件或 null；move(item, px, py)；可選 end(item)、tap(px,py) */
  function draggable(canvas, {pick, move, end, tap}) {
    let held = null, moved = false;
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", e => {
      const [x, y] = pos(e); held = pick(x, y); moved = false;
      if (held) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = "grabbing"; e.preventDefault(); }
      else if (tap) tap(x, y);
    });
    canvas.addEventListener("pointermove", e => {
      const [x, y] = pos(e);
      if (held) { moved = true; move(held, x, y); } else canvas.style.cursor = pick(x, y) ? "grab" : "default";
    });
    const up = () => { if (held && end) end(held, moved); held = null; canvas.style.cursor = "default"; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
  }

  /* ---------- 全螢幕 ---------- */
  /* 畫布高度：一般時依寬度比例；全螢幕時撐滿可用高度 */
  function stageHeight(cv, ratio, min, max) {
    const w = cv.clientWidth || 800, full = cv.closest(".is-full");
    if (!full) return clamp(Math.round(w * ratio), min, max);
    const st = cv.closest(".scene-stage");
    if (st && st.hasAttribute("data-fill") && innerWidth > 980) return Math.max(240, Math.floor(st.clientHeight));
    return Math.max(min, Math.round(innerHeight * 0.62));
  }
  /* 在 host 裡放一顆「全螢幕」按鈕，切換 target 的全螢幕狀態。
     支援 Fullscreen API 的瀏覽器用真正的全螢幕；不支援時（例如 iPhone）改成蓋滿視窗。 */
  function fullscreenButton(target, host, {prepend = false, title = ""} = {}) {
    const btn = document.createElement("button");
    btn.type = "button"; btn.className = "button full-btn"; btn.setAttribute("aria-pressed", "false");
    const sync = on => {
      target.classList.toggle("is-full", on); document.documentElement.classList.toggle("has-full", on);
      btn.setAttribute("aria-pressed", String(on)); btn.textContent = on ? "✕ 結束全螢幕" : "⛶ 全螢幕";
      if (on && title) target.setAttribute("data-full-title", title); else target.removeAttribute("data-full-title");
      window.dispatchEvent(new Event("resize"));
    };
    btn.addEventListener("click", async () => {
      const on = !target.classList.contains("is-full");
      if (on) { sync(true); try { if (target.requestFullscreen) await target.requestFullscreen({navigationUI: "hide"}); } catch (e) { /* 改用蓋滿視窗 */ } }
      else { if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); sync(false); }
    });
    const onChange = () => { if (!document.fullscreenElement && target.classList.contains("is-full") && btn.dataset.native === "1") sync(false); btn.dataset.native = document.fullscreenElement === target ? "1" : "0"; };
    document.addEventListener("fullscreenchange", onChange);
    const onKey = e => { if (e.key === "Escape" && target.classList.contains("is-full") && !document.fullscreenElement) sync(false); };
    document.addEventListener("keydown", onKey);
    sync(false);
    prepend ? host.prepend(btn) : host.append(btn);
    return () => { document.removeEventListener("fullscreenchange", onChange); document.removeEventListener("keydown", onKey); document.documentElement.classList.remove("has-full"); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  }

  /* ---------- 動畫迴圈 ---------- */
  function loop(frame) {
    let raf = 0, last = null, alive = true;
    const tick = ts => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const dt = last === null ? 0 : clamp((ts - last) / 1000, 0, 0.05); last = ts;
      frame(dt);
    };
    raf = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(raf); };
  }

  window.EM = window.EM || {};
  EM.sceneKit = {TAU, C, clamp, stageHeight, fullscreenButton, fitCanvas, makeLabeler, arrow, vector, grid, charge, fieldGlyph, overlaps, num, niceStep, chart, build, draggable, loop};
  EM.scenes = EM.scenes || [];
})();
