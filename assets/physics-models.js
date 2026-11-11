/* Model coordinates in cm for static scenes; electrodynamics quantities use SI. */
(() => {
  const sum = (a, b) => a.map((v, i) => v + b[i]);
  const mul = (a, s) => a.map(v => v * s);
  const sub = (a, b) => sum(a, mul(b, -1));
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
  const cross = ([x, y, z], [a, b, c]) => [y * c - z * b, z * a - x * c, x * b - y * a];
  const length = a => Math.hypot(...a);
  const unit = a => length(a) > 0 ? mul(a, 1 / length(a)) : [0, 0, 0];
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const rad = a => a * Math.PI / 180, TAU = 2 * Math.PI, zero = [0, 0, 0];
  const sample = (n, fn) => Array.from({ length: n + 1 }, (_, i) => fn(i / n));
  const direction = (theta, phi) => [Math.sin(rad(theta)) * Math.cos(rad(phi)), Math.sin(rad(theta)) * Math.sin(rad(phi)), Math.cos(rad(theta))];
  const line = (a, b, n = 1) => sample(n, u => sum(a, mul(sub(b, a), u)));
  const ring = (r, z = 0, n = 100) => sample(n, u => [r * Math.cos(TAU * u), r * Math.sin(TAU * u), z]);
  const distance = (p, a, b) => {
    const d = sub(b, a), t = clamp(dot(sub(p, a), d) / dot(d, d), 0, 1);
    return length(sub(p, sum(a, mul(d, t))));
  };
  function biot(mode, p) {
    const point = [p.x, p.y, p.z], r = p.radius || 9, s = p.spacing || 8;
    const axis = direction(p.theta ?? 90, p.phi ?? 0);
    const paths = mode === "element" ? [{ nodes: line(mul(axis, -p.dl / 2), mul(axis, p.dl / 2)), sign: 1 }] :
      mode === "straight" ? [{ nodes: line([-p.half, 0, 0], [p.half, 0, 0], 180), sign: 1 }] :
        mode === "pair" ? [{ nodes: line([-24, -s / 2, 0], [24, -s / 2, 0], 150), sign: 1 },
        { nodes: line([-24, s / 2, 0], [24, s / 2, 0], 150), sign: p.relative }] :
          mode === "loop" ? [{ nodes: ring(r), sign: 1 }] :
            sample(p.turns - 1, u => ({ nodes: ring(r, (u - .5) * p.coil, 70), sign: 1 }));
    const seg = paths.flatMap(({ nodes, sign }) => nodes.slice(1).map((b, i) => {
      const a = nodes[i], m = mul(sum(a, b), .5), rv = sub(point, m), d = length(rv);
      const dl = mul(sub(b, a), Math.sign(p.i || 1) * sign);
      return { a, b, m, rv, d, dl, bvec: d > 1e-8 ? mul(cross(dl, rv), 10 * Math.abs(p.i) / d ** 3) : zero, near: distance(point, a, b) < .45 };
    }));
    const selected = seg[Math.round((seg.length - 1) * (p.probe ?? 0) / 100)];
    const angle = selected.d ? Math.acos(clamp(dot(unit(selected.dl), unit(selected.rv)), -1, 1)) / Math.PI * 180 : null;
    const unsafe = seg.some(s => s.near);
    const smallElement = mode !== "element" || selected.d >= 3 * p.dl;
    return { paths, point, selected, total: seg.reduce((acc, s) => sum(acc, s.bvec), zero), unsafe, angle, smallElement };
  }
  // Electrostatics use charge in nC and distance in cm.
  // V = kq/r = 8.99e9 · (q·1e-9) / (r·1e-2) ≈ 900·q/r volts.
  // E = kq/r² = 8.99e9 · (q·1e-9) / (r·1e-2)² ≈ 90000·q/r² N/C.
  const COULOMB_V = 900, COULOMB_E = 90000;
  function electro(mode, p, point) {
    const [x] = point;
    if (mode === "plates") {
      const half = p.gap / 2, fx = clamp((half - x) / p.gap, 0, 1);
      return { v: p.voltage * fx, e: Math.abs(x) === half ? null : Math.abs(x) < half ? [100 * p.voltage / p.gap, 0, 0] : zero };
    }
    if (mode === "sphere") {
      const r = length(point);
      return { v: COULOMB_V * p.q / Math.max(r, p.radius), e: !p.q || r < p.radius ? zero : r === p.radius ? null : mul(point, COULOMB_E * p.q / r ** 3) };
    }
    if (mode === "cavity") {
      const { inner, outer, inside, outside } = cavityGeometry(p), r = length(point);
      if (Math.abs(r - inner) < 1e-8) return { v: 0, e: p.q ? null : zero };
      if (Math.abs(r - outer) < 1e-8) return { v: 0, e: p.q2 ? null : zero };
      if (r > inner && r < outer) return { v: 0, e: zero };
      if (r > outer) return axialElectro(outside, point);
      const result = axialElectro(inside, point);
      if (result && p.offset === 0) result.v -= COULOMB_V * p.q / inner;
      return result;
    }
    return axialElectro(pairSources(p), point);
  }
  const pairSources = p => [{ x: -p.spacing / 2, q: p.q }, { x: p.spacing / 2, q: p.q2 }].filter(s => s.q);
  function cavityGeometry(p) {
    const inner = 8, outer = 13, external = 26, inside = [], outside = [];
    // Each Kelvin image is outside the vacuum region where its solution applies.
    if (p.q) {
      inside.push({ x: p.offset, q: p.q });
      if (p.offset) inside.push({ x: inner ** 2 / p.offset, q: -p.q * inner / p.offset });
    }
    if (p.q2) outside.push({ x: external, q: p.q2 }, { x: outer ** 2 / external, q: -p.q2 * outer / external });
    return { inner, outer, external, inside, outside };
  }
  function axialElectro(sources, point) {
    let v = 0, e = zero;
    for (const { x, q } of sources) {
      const r = sub(point, [x, 0, 0]), d = length(r);
      if (d < .45) return null;
      v += COULOMB_V * q / d;
      e = sum(e, mul(r, COULOMB_E * q / d ** 3));
    }
    return { v, e };
  }
  function cavityZeros(p) {
    const { inner, outer, external, inside, outside } = cavityGeometry(p);
    const eZeros = [], vZeros = [];
    if (inside.length === 2) {
      const [{ x: x1, q: q1 }, { x: x2, q: q2 }] = inside;
      const a = Math.sqrt(Math.abs(q1)), b = Math.sqrt(Math.abs(q2));
      for (const sign of [-1, 1]) {
        if (a + sign * b === 0) continue;
        const x = (a * x2 + sign * b * x1) / (a + sign * b);
        if (Math.abs(x) < inner && Math.abs(x - x1) > .45) {
          const at = axialElectro(inside, [x, 0, 0]);
          if (at && Math.abs(at.e[0]) < 1e-3) eZeros.push(x);
        }
      }
    }
    if (outside.length === 2) {
      const [{ x: x1, q: q1 }, { x: x2, q: q2 }] = outside;
      const a = Math.sqrt(Math.abs(q1)), b = Math.sqrt(Math.abs(q2));
      for (const sign of [-1, 1]) {
        if (a + sign * b === 0) continue;
        const x = (a * x2 + sign * b * x1) / (a + sign * b);
        if (Math.abs(x) > outer && Math.abs(x - x1) > .45) {
          const at = axialElectro(outside, [x, 0, 0]);
          if (at && Math.abs(at.e[0]) < 1e-3) eZeros.push(x);
        }
      }
      // Potential in r > outer is V(x) = k*q2*(1/|x - external| - (outer/external)/|x - outer²/external|),
      // which vanishes only on the ground sphere |x| = outer.
    }
    return { eZeros, vZeros };
  }
  const defaultLineDensity = 2;
  function electricPair(p, density = defaultLineDensity) {
    const a = Math.sqrt(Math.abs(p.q)), b = Math.sqrt(Math.abs(p.q2)), half = p.spacing / 2;
    const opposed = p.q * p.q2 < 0, net = p.q + p.q2;
    const x = !a || !b || (opposed && a === b) ? null : half * (opposed ? (a + b) / (a - b) : (a - b) / (a + b));
    const absQ = Math.abs(p.q), absQ2 = Math.abs(p.q2);
    const joined = opposed ? density * Math.min(absQ, absQ2) : 0;
    const potentialZeroes = opposed ? [half * (absQ - absQ2) / (absQ + absQ2), ...(net ? [half * (absQ + absQ2) / (absQ - absQ2)] : [])] : [];
    return { x, all: !a && !b, net, joined, distant: density * Math.abs(net), counts: [density * absQ, density * absQ2], potentialZeroes };
  }
  // flux = true：真正的 3D 計數。每個電荷出入 density·|Q| 條線，在球面上等立體角分布
  // （每條線代表相同的電通量），各自帶有繞軸方位角 phi。flux = false 則是含軸切面上的示意畫法。
  function electricStreamlines(p, bound = 110, density = defaultLineDensity, flux = false) {
    return axialStreamlines(pairSources(p), bound, density, undefined, flux);
  }
  function cavityStreamlines(p, bound, density = defaultLineDensity) {
    const { inner, outer, inside, outside } = cavityGeometry(p);
    return [...axialStreamlines(inside, bound, density, { radius: inner, enter: false }), ...axialStreamlines(outside, bound, density, { radius: outer, enter: true })];
  }
  function axialStreamlines(sources, bound, density, boundary, flux = false) {
    const opposed = sources.length === 2 && sources[0].q * sources[1].q < 0;
    // For opposite charges all connecting lines can be traced from the larger charge.
    const origins = boundary ? sources.slice(0, 1) : opposed ? [sources.reduce((a, b) => Math.abs(a.q) >= Math.abs(b.q) ? a : b)] : sources;
    const seedRadius = .5, stopRadius = .25;
    function field([x, y]) {
      let fx = 0, fy = 0;
      for (const source of sources) {
        const dx = x - source.x, factor = source.q / Math.hypot(dx, y) ** 3;
        fx += factor * dx;
        fy += factor * y;
      }
      return [fx, fy];
    }
    const stream = (x, y) => sources.reduce((flux, s) => flux + s.q * (x - s.x) / Math.hypot(x - s.x, y), 0);
    const paths = [];
    const mirrored = density % 2 === 0;
    for (const source of origins) {
      const other = sources.find(s => s !== source), sign = Math.sign(source.q);
      const count = flux ? Math.round(Math.abs(source.q) * density) : Math.abs(source.q) * density / (mirrored ? 2 : 1);
      const connCount = !boundary && opposed ? Math.abs(other.q) * density / (mirrored ? 2 : 1) : 0;
      const distCount = count - connCount;
      const dir = other ? Math.sign(other.x - source.x) : 1;
      const levelInner = other ? (source.q - other.q) * dir : source.q;
      const levelSep = other ? (source.q + other.q) * dir : 0;
      const levelOuter = -levelSep;
      for (let i = 0; i < count; i++) {
        let connecting = i < connCount;
        let level;
        if (flux) {
          // 等電通量：cosθ 均勻取樣；ψ = q·cosθ + 另一電荷在軸上的常數項。
          level = source.q * (1 - 2 * (i + .5) / count) + (other ? other.q * Math.sign(source.x - other.x) : 0);
          connecting = opposed && (level - levelSep) * (level - levelInner) < 0;
        } else if (!boundary && opposed) {
          if (connecting) {
            const margin = clamp(.42 / Math.sqrt(connCount), .15, .34);
            const u = connCount === 1 ? (distCount ? .28 : .5) : 1 - (i + margin) / (connCount - 1 + 2 * margin);
            const exp = distCount ? 1.2 : 1;
            level = levelSep + (levelInner - levelSep) * (1 - Math.cos(Math.PI * u ** exp)) / 2;
          } else {
            const k = i - connCount;
            const margin = clamp(.36 / Math.sqrt(distCount), .14, .32);
            const u = distCount === 1 ? .18 : (k + margin) / (distCount - 1 + 2 * margin);
            level = levelSep + (levelOuter - levelSep) * (1 - Math.cos(Math.PI * u ** 1.2)) / 2;
          }
        } else {
          const margin = clamp(.38 / Math.sqrt(count), .16, .34);
          const t = count === 1 ? .5 : (i + margin) / (count - 1 + 2 * margin);
          const cosine = Math.cos(Math.PI * t);
          level = source.q * cosine + (other ? other.q * Math.sign(source.x - other.x) : 0);
        }
        let low = -1, high = 1;
        for (let j = 0; j < 36; j++) {
          const u = (low + high) / 2;
          const difference = stream(source.x + seedRadius * u, seedRadius * Math.sqrt(1 - u * u)) - level;
          if (sign * difference > 0) high = u;
          else low = u;
        }
        const u = (low + high) / 2;
        let point = [source.x + seedRadius * u, seedRadius * Math.sqrt(1 - u * u)], end = null;
        const points = [[source.x, 0], point];
        for (let j = 0; j < 2200; j++) {
          const nearest = Math.min(...sources.map(s => Math.hypot(point[0] - s.x, point[1])));
          const outside = length(point) > bound;
          const f = field(point), fLen = length(f);
          const fSum = sources.reduce((acc, s) => acc + Math.abs(s.q) / Math.hypot(point[0] - s.x, point[1]) ** 2, 0);
          const effectiveNearest = nearest * clamp(fLen / (fSum || 1), .08, 1);
          const boundaryStep = boundary ? Math.max(.02, Math.abs(length(point) - boundary.radius) * .35) : Infinity;
          const step = clamp(Math.min(effectiveNearest * .12, boundaryStep), .015, Math.max(.75, length(point) * .025));
          const tangent = fLen > 0 ? mul(f, sign / fLen) : [0, 0];
          if (length(tangent) < .5 || (outside && !connecting)) break;
          const mid = sum(point, mul(tangent, step / 2));
          let next = sum(point, mul(unit(field(mid)), step * sign));
          if (next[1] > 1e-4) {
            const fn = field(next), fnLen = length(fn);
            if (fnLen > 1e-9) {
              const dn = clamp((level - stream(next[0], next[1])) / (next[1] * fnLen), -step * .25, step * .25);
              next = [next[0] + dn * fn[1] / fnLen, next[1] - dn * fn[0] / fnLen];
            }
          }
          if (boundary && (length(next) < boundary.radius) === boundary.enter) {
            let a = point, b = next;
            for (let k = 0; k < 24; k++) {
              const m = mul(sum(a, b), .5);
              if ((length(m) < boundary.radius) === boundary.enter) b = m;
              else a = m;
            }
            const hit = unit(sum(a, b));
            points.push(mul(hit, boundary.radius));
            end = boundary.radius;
            break;
          }
          point = next;
          if (point[1] <= 0) break;
          points.push(point);
          if (!boundary && opposed && Math.hypot(point[0] - other.x, point[1]) < stopRadius) {
            end = other.x;
            points.push([end, 0]);
            break;
          }
        }
        // Odd densities can leave an unpaired line. Alternate its side across successive flux bands.
        if (flux) paths.push({ points, sign, source: source.x, end, sides: [1], phi: (i * 2.399963229728653 + (source.x > 0 ? 1.3 : 0)) % TAU });
        else paths.push({ points, sign, source: source.x, end, sides: mirrored ? [-1, 1] : [i % 2 === 0 ? 1 : -1] });
      }
    }
    return paths;
  }
    function magnetic(mode, p) {
      const b = [0, 0, p.b], dir = direction(p.theta, p.phi ?? 0);
      if (mode === "parallel") {
        const B = 20 * Math.abs(p.i1) / p.spacing; // μT; p.spacing is in cm.
        const f = 20e-6 * p.i1 * p.i2 / p.spacing;  // N/m on upper wire, toward lower if f > 0.
        return { B, f };
      }
      if (mode === "wire") {
        const dl = mul(dir, p.size / 100), f = mul(cross(dl, b), p.i);
        return { b, dl, f };
      }
      if (mode === "motor") {
        const a = rad(p.theta), size = p.size / 100, w = size * .68;
        const u = [size / 2, 0, 0], v = [0, w / 2 * Math.cos(a), w / 2 * Math.sin(a)];
        // Edges 0 and 2 are the long sides parallel to the axle (x). The vertices circulate
        // opposite to u × v, so the area normal is n = v̂ × û. With this sense a positive current
        // gives τₓ = NIAB sin θ ≥ 0 while the commutator is on, i.e. the torque drives θ forward
        // in the same direction as the animation.
        const vertices = [sub(v, u), sum(u, v), sub(u, v), sub(mul(u, -1), v)];
        const i = p.i * (p.commutate && Math.sin(a) < 0 ? -1 : 1), n = [0, Math.sin(a), -Math.cos(a)];
        const forces = vertices.map((a, k) => mul(cross(sub(vertices[(k + 1) % 4], a), b), p.turns * i));
        return { b, vertices, forces, i, n, torque: mul(cross(n, b), p.turns * i * size * w), area: size * w };
      }
      const m = 1e-8, q = p.q * 1e-6, omega = q * p.b / m, T = TAU / Math.abs(omega);
      const alpha = rad(p.phi), vp = p.v * Math.sin(rad(p.theta)), vz = p.v * dir[2];
      const at = t => {
        const a = alpha - omega * t;
        const v = [vp * Math.cos(a), vp * Math.sin(a), vz];
        const x = [vp / omega * (Math.sin(alpha) - Math.sin(a)), vp / omega * (Math.cos(a) - Math.cos(alpha)), vz * t];
        return { x, v, f: mul(cross(v, b), q) };
      };
      return { b, m, q, T, r: vp / Math.abs(omega), pitch: Math.abs(vz) * T, at, energy: .5 * m * p.v ** 2 };
    }
    function magnetFlux(p) {
      const coilRadius = p.size / 200, radius = .018, halfLength = .056;
      const angles = Array.from({ length: 48 }, (_, i) => Math.cos(Math.PI * (i + .5) / 48));
      const z = Array.from({ length: 20 }, (_, i) => halfLength * ((i + .5) / 10 - 1));
      const radialDistance2 = angles.map(c => coilRadius ** 2 + radius ** 2 - 2 * coilRadius * radius * c);
      // Integrate A_phi at the coil rim from the cylindrical magnet's surface currents.
      // The flux is the circulation of A; the derivative is taken under the integral.
      function integral(x) {
        let flux = 0, slope = 0;
        for (const offset of z) {
          const axial = x + offset;
          for (let k = 0; k < angles.length; k++) {
            const distance2 = radialDistance2[k] + axial ** 2, a = angles[k] / Math.sqrt(distance2);
            flux += a;
            slope -= a * axial / distance2;
          }
        }
        return { flux, slope };
      }
      const scale = p.pole * p.b * coilRadius * radius / 2 * (2 * halfLength / z.length) * (TAU / angles.length);
      return {
        radius, halfLength, centerField: scale * integral(0).flux / (Math.PI * coilRadius ** 2), at(x) {
          const result = integral(x);
          return { flux: result.flux * scale, slope: result.slope * scale };
        }
      };
    }
    function induction(mode, p, t, magnet) {
      const T = p.duration, u = clamp(t / T, 0, 1), loopL = p.size / 100, area = loopL ** 2;
      let flux = 0, emf = 0, x = 0, v = 0, overlap = 0, angle = 0, b = p.b, n = mode === "slide" || mode === "enter" ? 1 : p.turns;
      if (mode === "slide") {
        v = p.speed;
        x = .035 + v * t;
        flux = b * loopL * x;
        emf = -b * loopL * v;
      } else if (mode === "enter") {
        v = .44 / T; x = -.22 + .44 * u;
        const left = x - loopL / 2, right = x + loopL / 2, edge = .13;
        overlap = Math.max(0, Math.min(right, edge) - Math.max(left, -edge));
        const inside = z => z >= -edge && z < edge;
        flux = b * loopL * overlap;
        emf = -b * loopL * v * (Number(inside(right)) - Number(inside(left)));
      } else if (mode === "rotate") {
        const w = TAU * p.cycles / T;
        angle = w * t; flux = b * area * Math.cos(angle);
        emf = n * b * area * w * Math.sin(angle);
      } else if (mode === "vary") {
        const fraction = clamp((u - .25) / .5, 0, 1);
        b = p.b + (p.end - p.b) * fraction; flux = b * area;
        emf = u >= .25 && u < .75 ? -n * area * (p.end - p.b) / (.5 * T) : 0;
      } else {
        x = .24 * (2 * u - 1); v = .48 / T;
        const at = (magnet ?? magnetFlux(p)).at(x);
        flux = at.flux;
        emf = -n * at.slope * v;
      }
      const i = p.closed ? emf / p.resistance : 0, heat = i * i * p.resistance;
      return { flux, emf, i, heat, x, v, overlap, angle, b, n, force: mode === "slide" && v ? -heat / v : 0 };
    }
    const elementaryCharge = 1.602176634e-19, protonMass = 1.67262e-27;
    const ionSpeed = energy => Math.sqrt(2 * elementaryCharge * energy / protonMass);
    function linearAcceleration(p) {
      const halfPeriod = .25e-6, gapWidth = .003;
      const speeds = sample(4, u => ionSpeed(p.initial + 4 * u * p.voltage));
      const crossings = speeds.slice(1).map((end, i) => {
        const start = speeds[i], mid = ionSpeed(p.initial + (i + .5) * p.voltage);
        const first = gapWidth / (start + mid), second = gapWidth / (mid + end);
        return { first, second };
      });
      const tubes = [], gaps = [];
      let x = 0, t = 0;
      for (let i = 0; i < speeds.length; i++) {
        const speed = speeds[i], crossing = crossings[i];
        const drift = halfPeriod - (crossings[i - 1]?.second ?? 0) - (crossing?.first ?? 0);
        const length = speed * drift;
        tubes.push({ start: x, end: x + length, startTime: t, endTime: t + drift, speed, energy: p.initial + i * p.voltage });
        x += length; t += drift;
        if (!crossing) break;
        const time = crossing.first + crossing.second, acceleration = (speeds[i + 1] - speed) / time;
        gaps.push({ start: x, end: x + gapWidth, startTime: t, endTime: t + time, centerTime: t + crossing.first, speed, acceleration, energy: p.initial + i * p.voltage });
        x += gapWidth; t += time;
      }
      const length = x, duration = t, segments = tubes.flatMap((tube, i) => gaps[i] ? [tube, gaps[i]] : [tube]);
      return {
        tubes, gaps, length, duration, frequency: 1 / (2 * halfPeriod), at(progress) {
          const time = clamp(progress, 0, 1) * duration, segment = segments.find(s => time < s.endTime) ?? segments.at(-1);
          const dt = clamp(time - segment.startTime, 0, segment.endTime - segment.startTime), acceleration = segment.acceleration ?? 0;
          const travel = (segment.speed + acceleration * dt / 2) * dt;
          const speed = segment.speed + acceleration * dt;
          const energy = segment.energy + (acceleration ? p.voltage * travel / gapWidth : 0);
          return { time, position: segment.start + travel, energy, speed, active: acceleration > 0 };
        }
      };
    }
    function cyclotron(p) {
      const arcs = [];
      const period = TAU * protonMass / (elementaryCharge * p.b);
      let startY = 0;
      for (let i = 0; i < p.crossings; i++) {
        const energy = p.initial + p.voltage * (i + 1), speed = ionSpeed(energy);
        const radius = protonMass * speed / (elementaryCharge * p.b) * 100;
        const side = i % 2 === 0 ? 1 : -1, start = startY;
        const point = progress => [side * radius * Math.sin(Math.PI * progress), start - side * radius * (1 - Math.cos(Math.PI * progress)), 0];
        arcs.push({ energy, speed, radius, point, side });
        startY = point(1)[1];
      }
      return { arcs, period };
    }
    function aurora(p) {
      const earthKm = 6371, atmosphere = 1 + 110 / earthKm, L = p.shell, pitch = rad(p.pitch), longitude = rad(p.longitude);
      const limit = Math.acos(Math.sqrt(atmosphere / L));
      const ratio = latitude => Math.sqrt(1 + 3 * Math.sin(latitude) ** 2) / Math.cos(latitude) ** 6;
      const lossCone = Math.asin(1 / Math.sqrt(ratio(limit)));
      const reachesAtmosphere = pitch <= lossCone;
      let low = 0, high = limit;
      if (!reachesAtmosphere) {
        for (let i = 0; i < 40; i++) {
          const mid = (low + high) / 2;
          if (Math.sin(pitch) ** 2 * ratio(mid) >= 1) high = mid;
          else low = mid;
        }
      }
      const end = reachesAtmosphere ? limit : (low + high) / 2;
      // An illustrative tilted dipole. Longitude is measured in the magnetic coordinate system.
      const tilt = rad(10), bearing = rad(-72);
      const magneticToEarth = ([x, y, z]) => {
        const a = x * Math.cos(tilt) + z * Math.sin(tilt);
        return [a * Math.cos(bearing) - y * Math.sin(bearing), a * Math.sin(bearing) + y * Math.cos(bearing), -x * Math.sin(tilt) + z * Math.cos(tilt)];
      };
      const point = (latitude, shell = L, phi = longitude) => {
        const r = shell * Math.cos(latitude) ** 2;
        return [r * Math.cos(latitude) * Math.cos(phi), r * Math.cos(latitude) * Math.sin(phi), r * Math.sin(latitude)];
      };
      const latitudeAt = progress => p.hemisphere * end * (reachesAtmosphere ? progress : Math.sin(Math.PI * progress));
      return { point, ratio, magneticToEarth, latitudeAt, atmosphere, limit, end, lossCone, reachesAtmosphere, earthKm };
    }
    function transformer(p) {
      const secondary = p.voltage * p.secondary / p.primary;
      const current = p.closed ? secondary / p.load : 0;
      const fluxPeak = Math.SQRT2 * p.voltage / (p.primary * TAU * p.frequency);
      const at = u => ({
        flux: fluxPeak * Math.cos(TAU * u), primary: Math.SQRT2 * p.voltage * Math.sin(TAU * u),
        secondary: Math.SQRT2 * secondary * Math.sin(TAU * u)
      });
      return { secondary, current, power: secondary * current, at };
    }
    function emWave(p) {
      const c = 299792458, wavelength = c / (p.frequency * 1e6) * 100;
      const electric = [0, Math.cos(rad(p.angle)), Math.sin(rad(p.angle))], magnetic = cross([1, 0, 0], electric);
      const at = x => Math.sin(TAU * (x / wavelength - p.phase / 100));
      return { c, wavelength, electric, magnetic, at };
    }
  const api = { sum, mul, sub, dot, cross, length, unit, clamp, rad, TAU, zero, sample, direction, line, ring, biot, COULOMB_V, COULOMB_E, electro, defaultLineDensity, electricPair, electricStreamlines, cavityGeometry, cavityZeros, cavityStreamlines, magnetic, induction, magnetFlux, linearAcceleration, cyclotron, aurora, transformer, emWave };
  globalThis.EMPhysics = api;
  if (typeof module !== "undefined") module.exports = api;
})();
