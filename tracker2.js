/* Live Mission Tracker — canvas solar system with zoom + mission pins (with real moon selections) */
(() => {
  const canvas = document.getElementById('space');
  const ctx = canvas.getContext('2d', { alpha: false });

  const hudMode = document.getElementById('hudMode');
  const hudSub = document.getElementById('hudSub');
  const btnBack = document.getElementById('btnBack');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');

  const missionList = document.getElementById('missionList');
  const missionCard = document.getElementById('missionCard');
  const cardBackdrop = document.getElementById('cardBackdrop');
  const cardClose = document.getElementById('cardClose');

  const toast = document.getElementById('toast');

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function resize() {
    const r = canvas.getBoundingClientRect();
    canvas.width = Math.floor(r.width * DPR);
    canvas.height = Math.floor(r.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // --- Helpers
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  // Seeded RNG for stable placement
  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // --- Moon builder
  function makeMoon(name, i, opts = {}) {
    // i is 0-based index within host moons list
    const baseOrbit = opts.baseOrbit ?? 12; // world units in system view; screen units in focus view are derived separately
    const orbitStep = opts.orbitStep ?? 6;
    const orbit = opts.orbit ?? baseOrbit + i * orbitStep;

    // Give stable-but-varied periods if not supplied (in days)
    const period =
      opts.period ??
      clamp(3.5 + i * 6.5 + (hashString(name) % 17) * 0.35, 2.0, 120.0);

    const size = opts.size ?? clamp(2.3 + (hashString(name) % 7) * 0.25, 2.0, 4.0);
    const color = opts.color ?? "rgba(255,255,255,.86)";

    return { name, orbit, period, size, color };
  }

  // --- Data (hardcoded)
  // Orbit radii are arbitrary units; used for layout, not scale-accurate.
  // Kuiper Belt + Dwarf Planets are clickable "planets" as requested.
  const bodies = [
    {
      id: "Mercury",
      kind: "planet",
      orbit: 70,
      size: 4.2,
      period: 88,
      color: "#b5b9c2",
      moons: []
    },
    {
      id: "Venus",
      kind: "planet",
      orbit: 95,
      size: 6.2,
      period: 225,
      color: "#d7c3a2",
      moons: []
    },
    {
      id: "Earth",
      kind: "planet",
      orbit: 125,
      size: 6.4,
      period: 365,
      color: "#4aa3ff",
      moons: ["Moon"].map((n, i) => makeMoon(n, i, { baseOrbit: 14, orbitStep: 0, period: 27.3, size: 3.4 }))
    },
    {
      id: "Mars",
      kind: "planet",
      orbit: 160,
      size: 5.0,
      period: 687,
      color: "#ff6b4a",
      moons: ["Phobos", "Deimos"].map((n, i) => makeMoon(n, i, { baseOrbit: 10, orbitStep: 7, period: 0.35 + i * 1.0, size: 2.6 }))
    },
    {
      id: "Dwarf Planets",
      kind: "planet",
      orbit: 205,
      size: 6.0,
      period: 1400,
      color: "#a8a1ff",
      moons: ["Ceres", "Vesta", "Pallas", "Psyche", "Other"].map((n, i) =>
        makeMoon(n, i, { baseOrbit: 12, orbitStep: 6, period: 12 + i * 9.5, size: n === "Other" ? 2.2 : 2.7 })
      )
    },
    {
      id: "Jupiter",
      kind: "planet",
      orbit: 270,
      size: 12.0,
      period: 4333,
      color: "#d9b38c",
      moons: ["Io", "Europa", "Ganymede", "Callisto", "Amalthea", "Thebe", "Other"].map((n, i) =>
        makeMoon(n, i, { baseOrbit: 14, orbitStep: 6, period: 1.8 + i * 3.0, size: n === "Other" ? 2.2 : 3.0 })
      )
    },
    {
      id: "Saturn",
      kind: "planet",
      orbit: 335,
      size: 10.5,
      period: 10759,
      color: "#e5d3a2",
      moons: ["Mimas", "Enceladus", "Tethys", "Dione", "Rhea", "Titan", "Iapetus", "Other"].map((n, i) =>
        makeMoon(n, i, { baseOrbit: 14, orbitStep: 5.5, period: 0.9 + i * 4.2, size: n === "Titan" ? 3.6 : (n === "Other" ? 2.2 : 2.9) })
      )
    },
    {
      id: "Uranus",
      kind: "planet",
      orbit: 395,
      size: 8.0,
      period: 30687,
      color: "#78e0ff",
      moons: ["Ariel", "Umbriel", "Titania", "Other"].map((n, i) =>
        makeMoon(n, i, { baseOrbit: 13, orbitStep: 7, period: 2.5 + i * 5.2, size: n === "Other" ? 2.2 : 2.9 })
      )
    },
    {
      id: "Neptune",
      kind: "planet",
      orbit: 450,
      size: 8.0,
      period: 60190,
      color: "#4f7dff",
      moons: ["Triton", "Nereid", "Proteus", "Other"].map((n, i) =>
        makeMoon(n, i, { baseOrbit: 13, orbitStep: 7, period: 5.8 + i * 10.0, size: n === "Triton" ? 3.3 : (n === "Other" ? 2.2 : 2.8) })
      )
    },
    {
      id: "Pluto",
      kind: "dwarf",
      orbit: 505,
      size: 4.2,
      period: 90560,
      color: "#c6b3a6",
      moons: [] // Pluto appears as its own body in the heliocentric view; Kuiper Belt has the "Charon/Arrokoth/Other"
    },
    {
      id: "Kuiper Belt",
      kind: "planet",
      orbit: 570,
      size: 6.2,
      period: 1,
      color: "#ffffff",
      moons: ["Pluto", "Charon", "Arrokoth", "Other"].map((n, i) =>
        makeMoon(n, i, { baseOrbit: 14, orbitStep: 6, period: 22 + i * 18, size: n === "Other" ? 2.2 : 2.9 })
      )
    }
  ];

  // Missions (demo)
  const missions = [
    {
      id: "CR-MLN-01",
      name: "Selene Pathfinder",
      system: "Earth",
      target: "Moon",
      status: "Active • Nominal",
      type: "Surface Relay Demonstrator",
      launched: "2036-07-18",
      operator: "Constellation Reimagined",
      description: "A demonstration of lunar surface relay nodes enabling continuous comms for polar operations."
    }
  ];

  // --- View state
  const state = {
    paused: false,
    tDays: 0,
    view: "system", // system | focus
    focus: null,
    focusMissions: [],
    hover: null,
    cardOpen: false
  };

  // Camera maps world -> screen
  const camera = {
    x: 0,
    y: 0,
    zoom: 1,
    targetX: 0,
    targetY: 0,
    targetZoom: 1,
    animT: 1,
    animDur: 650,
    startX: 0,
    startY: 0,
    startZoom: 1,
    startAt: 0
  };

  function setCamera(targetX, targetY, targetZoom, duration = 650) {
    camera.startX = camera.x;
    camera.startY = camera.y;
    camera.startZoom = camera.zoom;
    camera.targetX = targetX;
    camera.targetY = targetY;
    camera.targetZoom = targetZoom;
    camera.animT = 0;
    camera.animDur = duration;
    camera.startAt = performance.now();
  }

  function worldToScreen(wx, wy) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const sx = (wx - camera.x) * camera.zoom + w / 2;
    const sy = (wy - camera.y) * camera.zoom + h / 2;
    return { x: sx, y: sy };
  }

  // Background starfield (simple procedural points)
  const stars = (() => {
    const rnd = mulberry32(42);
    const pts = [];
    for (let i = 0; i < 420; i++) {
      pts.push({
        x: rnd() * 1.2 - 0.1,
        y: rnd() * 1.2 - 0.1,
        r: rnd() * 1.8 + 0.2,
        a: rnd() * 0.55 + 0.18
      });
    }
    return pts;
  })();

  // Interaction registry each frame
  let hitTargets = []; // {type,id,x,y,r,data}
  function addHit(type, id, x, y, r, data) {
    hitTargets.push({ type, id, x, y, r, data });
  }
  function pick(mx, my) {
    for (let i = hitTargets.length - 1; i >= 0; i--) {
      const t = hitTargets[i];
      const dx = mx - t.x,
        dy = my - t.y;
      if (dx * dx + dy * dy <= t.r * t.r) return t;
    }
    return null;
  }

  // UI wiring
  btnPause.addEventListener("click", () => {
    state.paused = !state.paused;
    btnPause.setAttribute("aria-pressed", String(state.paused));
    btnPause.textContent = state.paused ? "Resume" : "Pause";
    showToast(state.paused ? "Paused" : "Resumed");
  });

  btnReset.addEventListener("click", () => {
    state.view = "system";
    state.focus = null;
    state.focusMissions = [];
    btnBack.disabled = true;
    hudMode.textContent = "Solar System";
    hudSub.textContent = "Click a planet to zoom. Click a mission pin to view details.";
    populateMissionList([]);
    setCamera(0, 0, 1.0, 650);
    closeCard();
    showToast("View reset");
  });

  btnBack.addEventListener("click", () => {
    if (state.view === "focus") {
      state.view = "system";
      state.focus = null;
      state.focusMissions = [];
      btnBack.disabled = true;
      hudMode.textContent = "Solar System";
      hudSub.textContent = "Click a planet to zoom. Click a mission pin to view details.";
      populateMissionList([]);
      setCamera(0, 0, 1.0, 650);
      closeCard();
      showToast("Back to Solar System");
    }
  });

  function openCard(m) {
    state.cardOpen = true;
    missionCard.setAttribute("aria-hidden", "false");
    document.getElementById("cardTitle").textContent = m.name;
    document.getElementById("cardSub").textContent = m.type;
    document.getElementById("cardStatus").textContent = m.status;
    document.getElementById("cardLocation").textContent = m.target ? `${m.target} • ${m.system}` : m.system;
    document.getElementById("cardLaunch").textContent = m.launched;
    document.getElementById("cardOperator").textContent = m.operator;
    document.getElementById("cardDesc").textContent = m.description;
  }
  function closeCard() {
    state.cardOpen = false;
    missionCard.setAttribute("aria-hidden", "true");
  }
  cardBackdrop.addEventListener("click", closeCard);
  cardClose.addEventListener("click", closeCard);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeCard();
  });

  function populateMissionList(list) {
    missionList.innerHTML = "";
    if (!list.length) {
      const d = document.createElement("div");
      d.className = "mini-empty";
      d.textContent = state.view === "focus" ? "No active missions in this system." : "Select a planet to see missions.";
      missionList.appendChild(d);
      return;
    }
    for (const m of list) {
      const item = document.createElement("div");
      item.className = "mini-item";
      item.innerHTML = `
        <div class="mini-top">
          <div class="mini-name">${m.name}</div>
          <div class="mini-tag">${m.id}</div>
        </div>
        <div class="mini-sub">${m.status} • Target: ${m.target || m.system}</div>
      `;
      item.addEventListener("click", () => openCard(m));
      missionList.appendChild(item);
    }
  }

  // Positions in system view: orbit about origin (Sun)
  function currentBodyPos(b) {
    const base = ((hashString(b.id) % 360) * Math.PI) / 180;
    const ang = base + (state.tDays / b.period) * Math.PI * 2;
    const x = Math.cos(ang) * b.orbit;
    const y = Math.sin(ang) * b.orbit;
    return { x, y, ang };
  }

  // Moon position around a host (system view, in world units)
  function currentMoonPos(hostId, moon) {
    const base = ((hashString(hostId + "|" + moon.name) % 360) * Math.PI) / 180;
    const ang = base + (state.tDays / moon.period) * Math.PI * 2;
    const x = Math.cos(ang) * moon.orbit;
    const y = Math.sin(ang) * moon.orbit;
    return { x, y, ang };
  }

  // Zoom into a planet
  function focusOn(bodyId) {
    state.view = "focus";
    state.focus = bodyId;
    btnBack.disabled = false;

    const b = bodies.find((x) => x.id === bodyId);
    const moonNames = (b?.moons || []).map((m) => m.name).filter(Boolean);

    hudMode.textContent = bodyId;

    if (!moonNames.length) {
      hudSub.textContent = "No moons in this system. Missions (if any) appear near the planet.";
    } else {
      // short HUD line listing key moons (avoid wall of text)
      const shown = moonNames.slice(0, 5);
      const more = moonNames.length > shown.length ? ` +${moonNames.length - shown.length} more` : "";
      hudSub.textContent = `Moons: ${shown.join(", ")}${more}. Click a mission pin to view details.`;
    }

    // Nice zoom transition: from current heliocentric position into focused origin
    const p = currentBodyPos(b);
    setCamera(p.x, p.y, 2.7, 700);
    setTimeout(() => {
      if (state.view !== "focus" || state.focus !== bodyId) return;
      setCamera(0, 0, 3.6, 650);
    }, 720);

    // Determine missions for this focus
    const focusM = missions.filter((m) => m.system === bodyId);
    state.focusMissions = focusM;

    // Place mission pins with stable randomness.
    // If mission target matches a moon name in this system, anchor pin to that moon.
    for (const m of focusM) {
      const rnd = mulberry32(hashString(m.id + "|" + bodyId));
      const targetMoon = (b?.moons || []).find((mm) => mm.name === m.target);

      if (targetMoon) {
        m._pin = { anchor: "moon", moon: targetMoon.name, a: rnd() * Math.PI * 2, d: 18 + rnd() * 16 };
      } else {
        m._pin = { anchor: "planet", a: rnd() * Math.PI * 2, d: 18 + rnd() * 20 };
      }
    }

    populateMissionList(focusM);
    showToast(`Zoomed to ${bodyId}`);
  }

  // --- Pointer events
  let mouse = { x: 0, y: 0 };
  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });
  canvas.addEventListener("mouseleave", () => (state.hover = null));

  canvas.addEventListener("click", (e) => {
    if (state.cardOpen) return;
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const t = pick(mx, my);
    if (!t) return;

    if (t.type === "planet" && state.view === "system") {
      focusOn(t.id);
      return;
    }

    if (t.type === "mission" && state.view === "focus") {
      openCard(t.data);
      return;
    }
  });

  // --- Draw routines
  function drawStars() {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    ctx.save();
    ctx.fillStyle = "#05050a";
    ctx.fillRect(0, 0, w, h);
    const px = camera.x * 0.002;
    const py = camera.y * 0.002;
    for (const s of stars) {
      const x = ((s.x + px) % 1.2) * w;
      const y = ((s.y + py) % 1.2) * h;
      ctx.globalAlpha = s.a;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawSun() {
    const c = worldToScreen(0, 0);
    const r = 14 * camera.zoom;

    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r * 7);
    g.addColorStop(0, "rgba(255,220,140,.95)");
    g.addColorStop(0.25, "rgba(255,110,80,.40)");
    g.addColorStop(1, "rgba(255,110,80,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 7, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffd79e";
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.fill();

    addHit("sun", "Sun", c.x, c.y, Math.max(10, r));
  }

  function drawOrbit(radius, centerWorldX = 0, centerWorldY = 0, alpha = 0.08) {
    const c = worldToScreen(centerWorldX, centerWorldY);
    const r = radius * camera.zoom;
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlanet(b) {
    const p = currentBodyPos(b);
    const s = worldToScreen(p.x, p.y);
    const pr = Math.max(4, b.size * 1.2) * camera.zoom;

    ctx.save();
    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, pr * 4);
    glow.addColorStop(0, b.id === "Earth" ? "rgba(24,160,255,.35)" : "rgba(255,255,255,.14)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pr * 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, pr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    ctx.stroke();

    if (state.hover && state.hover.type === "planet" && state.hover.id === b.id) {
      ctx.strokeStyle = "rgba(255,10,107,.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, pr + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = "rgba(255,255,255,.75)";
    ctx.font = "12px 'Space Grotesk', system-ui";
    ctx.fillText(b.id, s.x + pr + 8, s.y + 4);

    ctx.restore();

    addHit("planet", b.id, s.x, s.y, Math.max(12, pr + 6), { body: b });

    // Moons in system view
    drawMoonsSystemView(b, p);
  }

  function drawMoonsSystemView(host, hostPos) {
    const moons = host.moons || [];
    if (!moons.length) return;

    // Keep the moon depiction subtle at low zoom (otherwise it can clutter).
    // Fade moons in as zoom increases.
    const z = camera.zoom;
    const fade = clamp((z - 0.9) / 0.9, 0, 1); // 0..1
    if (fade <= 0.02) return;

    // Draw moon orbits around host position
    for (const moon of moons) {
      drawOrbit(moon.orbit, hostPos.x, hostPos.y, 0.08 * fade);
    }

    // Draw moon bodies
    for (const moon of moons) {
      const mp = currentMoonPos(host.id, moon);
      const wx = hostPos.x + mp.x;
      const wy = hostPos.y + mp.y;
      const s = worldToScreen(wx, wy);

      // Small moon dot
      const r = Math.max(1.6, moon.size * 0.55) * camera.zoom;
      ctx.save();
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillStyle = moon.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Label (only when zoomed in enough)
      if (camera.zoom >= 1.25) {
        ctx.globalAlpha = 0.65 * fade;
        ctx.fillStyle = "rgba(255,255,255,.78)";
        ctx.font = "11px 'Space Grotesk', system-ui";
        ctx.fillText(moon.name, s.x + r + 6, s.y + 3);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  }

  function drawBeltRing() {
    // Keep a ring for Kuiper Belt region as a visual cue (even though Kuiper Belt is now clickable).
    const kb = bodies.find((b) => b.id === "Kuiper Belt");
    if (!kb) return;
    drawOrbit(kb.orbit, 0, 0, 0.08);

    // Sprinkle objects (static)
    const rnd = mulberry32(1337);
    for (let i = 0; i < 110; i++) {
      const a = rnd() * Math.PI * 2;
      const jitter = (rnd() - 0.5) * 12;
      const x = Math.cos(a) * (kb.orbit + jitter);
      const y = Math.sin(a) * (kb.orbit + jitter);
      const s = worldToScreen(x, y);
      ctx.globalAlpha = 0.25 + rnd() * 0.35;
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, rnd() * 1.4 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const labelPos = worldToScreen(-kb.orbit, 0);
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ctx.font = "12px 'Space Grotesk', system-ui";
    ctx.fillText("Kuiper Belt (region)", labelPos.x - 110, labelPos.y - 10);
  }

  // Focus view: show planet at origin, plus all moons orbiting around host planet
  function drawFocusedSystem() {
    const b = bodies.find((x) => x.id === state.focus);
    if (!b) return;

    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    const center = { x: w / 2, y: h / 2 };

    // Host planet (screen-space for clarity)
    const planetR = 26;

    const g = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, planetR * 4.2);
    g.addColorStop(0, "rgba(24,160,255,.18)");
    g.addColorStop(0.2, "rgba(138,43,226,.12)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(center.x, center.y, planetR * 4.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = b.color;
    ctx.beginPath();
    ctx.arc(center.x, center.y, planetR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.82)";
    ctx.font = "16px 'Space Grotesk', system-ui";
    ctx.fillText(b.id, center.x + planetR + 12, center.y + 6);

    // Moons: each moon gets its own orbit around the host
    const moons = b.moons || [];
    const moonOrbitsPx = []; // name -> orbitRadiusPx
    if (moons.length) {
      const baseOrbit = 64;
      const step = 24;
      for (let i = 0; i < moons.length; i++) {
        moonOrbitsPx.push({ name: moons[i].name, r: baseOrbit + i * step });
      }

      // Draw orbits
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.lineWidth = 1;
      for (const o of moonOrbitsPx) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, o.r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // Draw moons
      for (let i = 0; i < moons.length; i++) {
        const moon = moons[i];
        const orbitPx = moonOrbitsPx[i].r;

        const base = ((hashString(b.id + "|" + moon.name) % 360) * Math.PI) / 180;
        const ang = base + (state.tDays / moon.period) * Math.PI * 2;

        const mx = center.x + Math.cos(ang) * orbitPx;
        const my = center.y + Math.sin(ang) * orbitPx;

        const mr = clamp(moon.size * 2.0, 6, 11);

        // Moon body
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,.82)";
        ctx.beginPath();
        ctx.arc(mx, my, mr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.22)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.fillStyle = "rgba(255,255,255,.70)";
        ctx.font = "12px 'Space Grotesk', system-ui";
        ctx.fillText(moon.name, mx + mr + 8, my + 4);

        ctx.restore();
      }
    } else {
      ctx.fillStyle = "rgba(255,255,255,.62)";
      ctx.font = "13px 'Space Grotesk', system-ui";
      ctx.fillText("No moons in this system.", center.x - 85, center.y + planetR + 38);
    }

    // Missions (pins)
    for (const m of state.focusMissions) {
      const pin = m._pin || { anchor: "planet", a: 0, d: 22 };

      let px, py;
      if (pin.anchor === "moon" && pin.moon && moons.length) {
        // Find the matching moon's current position using its orbit index
        const idx = moons.findIndex((mm) => mm.name === pin.moon);
        const orbitPx = idx >= 0 && moonOrbitsPx[idx] ? moonOrbitsPx[idx].r : 86;

        const moon = idx >= 0 ? moons[idx] : moons[0];
        const base = ((hashString(b.id + "|" + (moon?.name || pin.moon)) % 360) * Math.PI) / 180;
        const ang = base + (state.tDays / (moon?.period || 27.3)) * Math.PI * 2;

        const mx = center.x + Math.cos(ang) * orbitPx;
        const my = center.y + Math.sin(ang) * orbitPx;

        px = mx + Math.cos(pin.a) * pin.d;
        py = my + Math.sin(pin.a) * pin.d;
      } else {
        px = center.x + Math.cos(pin.a) * pin.d;
        py = center.y + Math.sin(pin.a) * pin.d;
      }

      drawMissionPin(px, py, m);
    }

    if (!state.focusMissions.length) {
      ctx.fillStyle = "rgba(255,255,255,.62)";
      ctx.font = "13px 'Space Grotesk', system-ui";
      ctx.fillText("No active missions here (demo).", center.x - 95, center.y + planetR + 62);
    }
  }

  function drawMissionPin(x, y, mission) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, 22);
    g.addColorStop(0, "rgba(255,10,107,.42)");
    g.addColorStop(0.25, "rgba(138,43,226,.22)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ff0a6b";
    ctx.beginPath();
    ctx.arc(x, y, 6.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,.70)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, 6.2, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,10,107,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x, y + 16);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.font = "12px 'Space Grotesk', system-ui";
    ctx.fillText(mission.id, x + 10, y - 8);

    addHit("mission", mission.id, x, y, 14, mission);
  }

  function drawSystem() {
    // Orbits for heliocentric bodies
    for (const b of bodies) {
      if (b.orbit) drawOrbit(b.orbit, 0, 0, 0.08);
    }
    drawBeltRing();
    drawSun();
    // Bodies + their moons
    for (const b of bodies) {
      drawPlanet(b);
    }
  }

  // Main loop
  let last = performance.now();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;

    // animate camera
    if (camera.animT < 1) {
      const t = clamp((now - camera.startAt) / camera.animDur, 0, 1);
      const e = easeInOut(t);
      camera.x = lerp(camera.startX, camera.targetX, e);
      camera.y = lerp(camera.startY, camera.targetY, e);
      camera.zoom = lerp(camera.startZoom, camera.targetZoom, e);
      camera.animT = t;
    }

    if (!state.paused) {
      // time scaling: ~10 days per second
      state.tDays += dt * 10;
    }

    // reset hits each frame
    hitTargets = [];

    drawStars();

    if (state.view === "system") {
      drawSystem();
    } else {
      // focused system vignette
      ctx.save();
      const w = canvas.clientWidth,
        h = canvas.clientHeight;
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.15, w / 2, h / 2, Math.max(w, h) * 0.62);
      vg.addColorStop(0, "rgba(0,0,0,0)");
      vg.addColorStop(1, "rgba(0,0,0,.45)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      drawFocusedSystem();
    }

    // hover detection
    const t = pick(mouse.x, mouse.y);
    state.hover = t;
    canvas.style.cursor = t && (t.type === "planet" || t.type === "mission") ? "pointer" : "default";

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Initial camera: fit whole system
  setCamera(0, 0, 1.0, 1);

  // Initial UI state
  btnBack.disabled = true;
  hudMode.textContent = "Solar System";
  hudSub.textContent = "Click a planet to zoom. Click a mission pin to view details.";
  populateMissionList([]);

  // Helpful first toast
  showToast("Tip: Click Earth to see the Moon mission demo.");
})();
