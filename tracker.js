/* Live Mission Tracker — canvas solar system with zoom + mission pins (with hard-coded moon values) */
(() => {
  const canvas = document.getElementById('space');
  const ctx = canvas.getContext('2d', { alpha: false });

  const hudMode = document.getElementById('hudMode');
  const hudSub = document.getElementById('hudSub');
  const btnBack = document.getElementById('btnBack');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const timeSpeed = document.getElementById('timeSpeed');
  const timeSpeedTag = document.getElementById('timeSpeedTag');
  const timeSpeedHint = document.getElementById('timeSpeedHint');

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

  function formatSpeed(x) {
  // nice display: integers show as "10×", fractional could be "0.5×" if you ever allow it
    return `${x}×`;
  }

  function applyTimeScale(x) {
    state.timeScale = x;
    if (timeSpeedTag) timeSpeedTag.textContent = formatSpeed(x);

    if (timeSpeedHint) {
      timeSpeedHint.textContent =
        x === 0
          ? "Time is frozen (0×). Space pauses/resumes."
          : "0× freezes time. Space pauses/resumes.";
    }
  }

  // --- Data (hardcoded)
  // Orbit radii are arbitrary units; used for layout, not scale-accurate.
  // Kuiper Belt + Dwarf Planets are clickable "planets" as requested.
  //
  // Moon objects are fully hard-coded for easy editing:
  // { name, orbit, period, size, color }
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
      moons: [
        { name: "Moon", orbit: 38.4, period: 27.3, size: 3.4, color: "rgba(255,255,255,.86)" }
      ]
    },
    {
      id: "Mars",
      kind: "planet",
      orbit: 160,
      size: 5.0,
      period: 687,
      color: "#ff6b4a",
      moons: [
        { name: "Phobos", orbit: 0.94, period: 0.32, size: 2.6, color: "rgba(255,255,255,.86)" },
        { name: "Deimos", orbit: 2.35, period: 1.26, size: 2.5, color: "rgba(255,255,255,.86)" }
      ]
    },
    {
      id: "Dwarf Planets",
      kind: "planet",
      orbit: 205,
      size: 6.0,
      period: 1400,
      color: "#a8a1ff",
      moons: [
        { name: "Ceres",  orbit: 12, period: 18,  size: 2.7, color: "rgba(255,255,255,.86)" },
        { name: "Vesta",  orbit: 24, period: 28,  size: 2.7, color: "rgba(255,255,255,.86)" },
        { name: "Pallas", orbit: 36, period: 40,  size: 2.7, color: "rgba(255,255,255,.86)" },
        { name: "Psyche", orbit: 48, period: 55,  size: 2.7, color: "rgba(255,255,255,.86)" },
        { name: "Other",  orbit: 70, period: 80,  size: 2.2, color: "rgba(255,255,255,.78)" }
      ]
    },
    {
      id: "Jupiter",
      kind: "planet",
      orbit: 270,
      size: 12.0,
      period: 4333,
      color: "#d9b38c",
      moons: [
        { name: "Amalthea",  orbit: 18.1, period: 0.50, size: 2.5, color: "rgba(255,255,255,.82)" },
        { name: "Thebe",     orbit: 22.2, period: 0.67, size: 2.4, color: "rgba(255,255,255,.82)" },
        { name: "Io",        orbit: 42.2, period: 1.77, size: 3.0, color: "rgba(255,255,255,.86)" },
        { name: "Europa",    orbit: 67.1, period: 3.55, size: 2.9, color: "rgba(255,255,255,.86)" },
        { name: "Ganymede",  orbit: 107, period: 7.15, size: 3.2, color: "rgba(255,255,255,.86)" },
        { name: "Callisto",  orbit: 188, period: 16.7, size: 3.1, color: "rgba(255,255,255,.86)" },
        { name: "Other",     orbit: 230, period: 25.0, size: 2.2, color: "rgba(255,255,255,.78)" }
      ]
    },
    {
      id: "Saturn",
      kind: "planet",
      orbit: 335,
      size: 10.5,
      period: 10759,
      color: "#e5d3a2",
      moons: [
        { name: "Mimas",     orbit: 18.5, period: 0.94, size: 2.7, color: "rgba(255,255,255,.86)" },
        { name: "Enceladus", orbit: 23.8, period: 1.37, size: 2.8, color: "rgba(255,255,255,.86)" },
        { name: "Tethys",    orbit: 29.5, period: 1.89, size: 2.9, color: "rgba(255,255,255,.86)" },
        { name: "Dione",     orbit: 37.7, period: 2.74, size: 2.9, color: "rgba(255,255,255,.86)" },
        { name: "Rhea",      orbit: 52.7, period: 4.52, size: 3.0, color: "rgba(255,255,255,.86)" },
        { name: "Titan",     orbit: 120, period: 15.95, size: 3.6, color: "rgba(255,255,255,.90)" },
        { name: "Iapetus",   orbit: 356, period: 79.3, size: 3.1, color: "rgba(255,255,255,.86)" },
        { name: "Other",     orbit: 460, period: 110, size: 2.2, color: "rgba(255,255,255,.78)" }
      ]
    },
    {
      id: "Uranus",
      kind: "planet",
      orbit: 395,
      size: 8.0,
      period: 30687,
      color: "#78e0ff",
      moons: [
        { name: "Ariel",    orbit: 19.1, period: 2.52, size: 2.9, color: "rgba(255,255,255,.86)" },
        { name: "Umbriel",  orbit: 26.6, period: 4.14, size: 2.8, color: "rgba(255,255,255,.86)" },
        { name: "Titania",  orbit: 43.6, period: 8.71, size: 3.0, color: "rgba(255,255,255,.86)" },
        { name: "Other",    orbit: 70, period: 20.0, size: 2.2, color: "rgba(255,255,255,.78)" }
      ]
    },
    {
      id: "Neptune",
      kind: "planet",
      orbit: 450,
      size: 8.0,
      period: 60190,
      color: "#4f7dff",
      moons: [
        { name: "Triton",  orbit: 35.5, period: 5.88, size: 3.3, color: "rgba(255,255,255,.90)" },
        { name: "Nereid",  orbit: 550, period: 360,  size: 2.7, color: "rgba(255,255,255,.84)" },
        { name: "Proteus", orbit: 11.8, period: 1.12, size: 2.8, color: "rgba(255,255,255,.84)" },
        { name: "Other",   orbit: 720, period: 400,   size: 2.2, color: "rgba(255,255,255,.78)" }
      ]
    },
    {
      id: "Pluto",
      kind: "dwarf",
      orbit: 505,
      size: 4.2,
      period: 90560,
      color: "#c6b3a6",
      moons: [
        { name: "Charon",   orbit: 1.8, period: 6.39, size: 2.8, color: "rgba(255,255,255,.86)" },
      ] // Pluto is also represented inside Kuiper Belt focus view per your list.
    },
    {
      id: "Kuiper Belt",
      kind: "planet",
      orbit: 570,
      size: 6.2,
      period: 110000,
      color: "#ffffff",
      moons: [
        { name: "Arrokoth", orbit: 26, period: 298,  size: 2.7, color: "rgba(255,255,255,.86)" },
        { name: "Other",    orbit: 32, period: 520,  size: 2.2, color: "rgba(255,255,255,.78)" }
      ]
    },
    {
      id: "Interstellar Space",
      kind: "planet",
      orbit: 850,
      size: 8.0,
      period: 130000,
      color: "#9c9c9c",
      moons: []
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
      description:
        "A demonstration of lunar surface relay nodes enabling continuous comms for polar operations."
    },
        {
      id: "CR-MLN-02",
      name: "Selene Explorer",
      system: "Earth",
      target: "Moon",
      status: "Active • Nominal",
      type: "Lunar Surface Exploration",
      launched: "2036-07-18",
      operator: "Constellation Reimagined",
      description:
        "A demonstration of lunar surface relay nodes enabling continuous comms for polar operations."
    },
        {
      id: "bingus",
      name: "bingus",
      system: "Interstellar Space",
      target: "Moon",
      status: "Active • Nominal",
      type: "Surface Relay Demonstrator",
      launched: "2036-07-18",
      operator: "Constellation Reimagined",
      description:
        "A demonstration of lunar surface relay nodes enabling continuous comms for polar operations."
    },        
    {
      id: "bingus 2",
      name: "bingus 2",
      system: "Interstellar Space",
      target: "Moon",
      status: "Active • Nominal",
      type: "Surface Relay Demonstrator",
      launched: "2036-07-18",
      operator: "Constellation Reimagined",
      description:
        "A demonstration of lunar surface relay nodes enabling continuous comms for polar operations."
    }
  ];

  // --- View state
  const state = {
    paused: false,
    tDays: 0,
    timeScale: 10,
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

  function screenToWorld(sx, sy) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const wx = (sx - w / 2) / camera.zoom + camera.x;
    const wy = (sy - h / 2) / camera.zoom + camera.y;
    return { x: wx, y: wy };
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

  // keys and shit
  window.addEventListener("keydown", (e) => {
    // ignore typing in inputs jiust in case
    const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : "";
    if (tag === "input" || tag === "textarea") return;

    if (e.code === "Space") {
      e.preventDefault();
      btnPause.click();
    } else if (e.key === "r" || e.key === "R") {
      btnReset.click();
    } else if (e.key === "b" || e.key === "B" || e.key === "Escape") {
      if (state.view === "focus" && !btnBack.disabled) btnBack.click();
    } else if (e.key === "0") {
      // quick recenter/zoom
      setCamera(0, 0, 1.0, 250);
    } else if (e.key === "+" || e.key === "=") {
      cancelCameraAnim();
      camera.zoom = clamp(camera.zoom * 1.1, 0.35, 9.0);
    } else if (e.key === "-" || e.key === "_") {
      cancelCameraAnim();
      camera.zoom = clamp(camera.zoom / 1.1, 0.35, 9.0);
    }
  });

  // ui stuff
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

  // Moon position around a host (ONLY system view, in world units)
  function currentMoonPos(hostId, moon) {
    const base = ((hashString(hostId + "|" + moon.name) % 360) * Math.PI) / 180;
    const ang = base + (state.tDays / moon.period) * Math.PI * 2;

    // SYSTEM VIEW ONLY: compress to keep moons visually close
    // cap can be tuned; 18–30 feels good. Bigger planet can have slightly larger cap.
    const cap = 22;
    const orbit = compressOrbit(moon.orbit / 3, cap); // keep your /3 baseline, then compress outliers

    const x = Math.cos(ang) * orbit;
    const y = Math.sin(ang) * orbit;
    return { x, y, ang, orbit }; // return orbit so we can use it for orbit drawing too
  }

  function compressOrbit(r, cap = 40) {
    // r in your "moon orbit px" units; cap is the max-ish radius you want in system view
    return r / (1 + r / cap);
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
      const shown = moonNames.slice(0, 5);
      const more = moonNames.length > shown.length ? ` +${moonNames.length - shown.length} more` : "";
      hudSub.textContent = `Moons: ${shown.join(", ")}${more}. Click a mission pin to view details.`;
    }

    const p = currentBodyPos(b);
    // setCamera(p.x, p.y, 2.7, 700);
    setTimeout(() => {
      if (state.view !== "focus" || state.focus !== bodyId) return;
      setCamera(0, 0, 3.6, 650);
    }, 720);

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

  // --- Pointer events (pan + zoom + clicks)
  let mouse = { x: 0, y: 0 };

  let isDown = false;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };
  let camStart = { x: 0, y: 0 };
  const DRAG_THRESHOLD = 4;

  function cancelCameraAnim() {
    camera.animT = 1;
    camera.targetX = camera.x;
    camera.targetY = camera.y;
    camera.targetZoom = camera.zoom;
  }

  canvas.addEventListener("pointerdown", (e) => {
    // Capture pointer so we can drag even if leaving canvas
    canvas.setPointerCapture(e.pointerId);

    isDown = true;
    isDragging = false;

    dragStart.x = e.clientX;
    dragStart.y = e.clientY;
    camStart.x = camera.x;
    camStart.y = camera.y;
  });

  canvas.addEventListener("pointermove", (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;

    if (!isDown) return;

    const dxPx = e.clientX - dragStart.x;
    const dyPx = e.clientY - dragStart.y;

    if (!isDragging && (dxPx * dxPx + dyPx * dyPx) >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
      isDragging = true;
      cancelCameraAnim();
    }

    if (isDragging) {
      // Pan: screen delta -> world delta
      const dxWorld = dxPx / camera.zoom;
      const dyWorld = dyPx / camera.zoom;
      camera.x = camStart.x - dxWorld;
      camera.y = camStart.y - dyWorld;
    }
  });

  canvas.addEventListener("pointerup", (e) => {
    isDown = false;
    // keep isDragging around for click handler below
  });

  canvas.addEventListener("pointercancel", () => {
    isDown = false;
    isDragging = false;
  });

  canvas.addEventListener("mouseleave", () => (state.hover = null));

  // Wheel zoom: zoom toward cursor
  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    cancelCameraAnim();

    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    const before = screenToWorld(sx, sy);

    // Smooth zoom multiplier
    const zoomFactor = Math.exp(-e.deltaY * 0.0015);
    const minZoom = 0.35;
    const maxZoom = 9.0;

    camera.zoom = clamp(camera.zoom * zoomFactor, minZoom, maxZoom);

    const after = screenToWorld(sx, sy);

    // Keep point under cursor fixed
    camera.x += before.x - after.x;
    camera.y += before.y - after.y;
  }, { passive: false });

  // Click selection (ignore if it was a drag)
  canvas.addEventListener("click", (e) => {
    if (state.cardOpen) return;
    if (isDragging) { isDragging = false; return; }

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

  function drawOrbitFadeLine(
  radius,
  centerWorldX = 0,
  centerWorldY = 0,
  ang = 0,
  alpha = 0.35,
  {
    trailAngle = 1.2 * Math.PI, // how long the trail is behind the planet (radians)
    segments = 18,
    headWidth = 3.0,
    tailWidth = 0.8,
    direction = 1,
    minAlpha = 0.0,
    scaleLineWidthWithZoom = false,
    roundHead = true,
    gap = 0.05             // radians: tiny gap prevents overdraw seams
  } = {}
) {
  const c = worldToScreen(centerWorldX, centerWorldY);
  const r = radius * camera.zoom;

  const start = ang - direction * trailAngle;
  const end   = ang;

  const ease = (t) => t * t; // concentrate brightness & width near head

  ctx.save();
  ctx.lineCap = "round";      // prevents the “dot” overlap
  ctx.lineJoin = "round";

  // Precompute zoom scaling once
  const wMul = scaleLineWidthWithZoom ? camera.zoom : 1;

  const total = end - start;
  const step = total / segments;

  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;

    const a0 = start + step * i + gap;
    const a1 = start + step * (i + 1) - gap;

    const e = ease(t1);
    const segAlpha = Math.max(minAlpha, alpha * e);

    ctx.lineWidth = (tailWidth + (headWidth - tailWidth) * e) * wMul;
    ctx.strokeStyle = `rgba(255,255,255,${segAlpha})`;

    ctx.beginPath();
    ctx.arc(c.x, c.y, r, a0, a1, false);
    ctx.stroke();
  }

  // Single rounded head highlight (cheap)
  if (roundHead) {
    ctx.lineCap = "round";
    ctx.lineWidth = headWidth * wMul;
    ctx.strokeStyle = `rgba(255,255,255,${alpha})`;

    const headSpan = Math.min(0.04, Math.abs(step) * 0.9);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, end - headSpan, end, false);
    ctx.stroke();
  }

  ctx.restore();
}


  function drawPlanet(b) {
    const p = currentBodyPos(b);
    const s = worldToScreen(p.x, p.y);
    // const pr = Math.max(4, b.size * 1.2) * camera.zoom;
    const basePr = Math.max(4, b.size * 1.2); // what you have now at zoom=1
    const z = camera.zoom;

    // When zoomed in enough to show moon labels, gradually stop scaling size with zoom
    const t = clamp((z - 1.25) / 1.2, 0, 1);     // 0..1 ramp starting at 1.25x zoom
    const sizeZoomMul = lerp(z, 1, t);           // transitions from "scale with zoom" -> "constant screen size"

    const pr = basePr * sizeZoomMul;


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

    // Fade moons in as zoom increases to reduce clutter.
    const z = camera.zoom;
    const fade = clamp((z - 0.9) / 0.9, 0, 1);
    if (fade <= 0.02) return;

    // Draw moon orbits around host position
    // no we dont lol
    for (const moon of moons) {
        const mp = currentMoonPos(host.id, moon);
        drawOrbit(mp.orbit, hostPos.x, hostPos.y, 0.08 * fade);
      }
      // drawOrbit(moon.orbit / 3, hostPos.x, hostPos.y, 0.08 * fade);
    

    // Draw moon bodies
    for (const moon of moons) {
      const mp = currentMoonPos(host.id, moon);
      const wx = hostPos.x + mp.x;
      const wy = hostPos.y + mp.y;
      const s = worldToScreen(wx, wy);

      // old ass no zoom based scaling
      // const r = Math.max(1.6, moon.size * 0.55) * camera.zoom;

      const baseMr = Math.max(1.6, moon.size * 0.55);
      const z = camera.zoom;

      const t = clamp((z - 1.25) / 1.2, 0, 1);
      const sizeZoomMul = lerp(z, 1, t);

      const r = baseMr * sizeZoomMul;

      ctx.save();
      ctx.globalAlpha = 0.75 * fade;
      ctx.fillStyle = moon.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Label only when zoomed in enough
      if (camera.zoom >= 1.25) {
        ctx.globalAlpha = 0.65 * fade;
        ctx.fillStyle = "rgba(255,255,255,.78)";
        ctx.font = "11px 'Space Grotesk', system-ui";
        ctx.fillText(moon.name, s.x + r + 6, s.y + 3);
      }

      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }


  function drawBelts() {
    // Kuiper belt (your existing object)
    const kb = bodies.find((b) => b.id === "Kuiper Belt");
    if (kb) {
      drawBelt("Kuiper", kb.orbit, {
        seed: 1337,
        count: 110,
        jitter: 12,
        alpha: 0.08,
        label: "Kuiper Belt (region)"
      });
    }

    // Asteroid belt / main belt region — use your Dwarf Planets orbit as the belt radius
    const ab = bodies.find((b) => b.id === "Dwarf Planets");
    if (ab) {
      drawBelt("Asteroid", ab.orbit, {
        seed: 7331,
        count: 140,
        jitter: 10,
        alpha: 0.06,
        label: "Asteroid Belt (region)"
      });
    }
  }

  function drawBelt(name, orbit, {
    seed = 1337,
    count = 110,
    jitter = 12,
    alpha = 0.08,
    label = null
  } = {}) {
    // drawOrbit(orbit, 0, 0, alpha);

    const rnd = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const a = rnd() * Math.PI * 2;
      const j = (rnd() - 0.5) * jitter;
      const x = Math.cos(a) * (orbit + j);
      const y = Math.sin(a) * (orbit + j);
      const s = worldToScreen(x, y);

      ctx.globalAlpha = 0.20 + rnd() * 0.35;
      ctx.fillStyle = "rgba(255,255,255,.9)";
      ctx.beginPath();
      ctx.arc(s.x, s.y, rnd() * 1.4 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // dust band
    width = 22,          // thickness of the dust band (world units)
    innerAlpha = 0.03,   // strength near the middle of the band
    outerAlpha = 0.0
    const c = worldToScreen(0, 0);
    const r = orbit * camera.zoom;
    const w = width * camera.zoom;

    ctx.save();

    // radial gradient from inner edge -> center of band -> outer edge
    const g = ctx.createRadialGradient(c.x, c.y, Math.max(1, r - w), c.x, c.y, r + w);
    g.addColorStop(0.00, `rgba(255,255,255,${outerAlpha})`);
    g.addColorStop(0.45, `rgba(255,255,255,${innerAlpha})`);
    g.addColorStop(0.55, `rgba(255,255,255,${innerAlpha})`);
    g.addColorStop(1.00, `rgba(255,255,255,${outerAlpha})`);

    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r + w, 0, Math.PI * 2);
    ctx.arc(c.x, c.y, Math.max(0, r - w), 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    /* no labels, the guys got orbiting objects
    if (label) {
      const labelPos = worldToScreen(-orbit, 0);
      ctx.fillStyle = "rgba(255,255,255,.55)";
      ctx.font = "12px 'Space Grotesk', system-ui";
      ctx.fillText(label, labelPos.x - 110, labelPos.y - 10);
    }
    */
  }

  // Focus view: planet at origin + all moons with their own orbits
  function drawFocusedSystem() {
    const b = bodies.find((x) => x.id === state.focus);
    if (!b) return;

    const center = worldToScreen(0, 0);

    const planetR = 10;

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

    const moons = b.moons || [];
    const moonOrbitsWorld = [];

    if (moons.length) {
      const baseOrbit = 5;
      for (let i = 0; i < moons.length; i++) {
        moonOrbitsWorld.push(baseOrbit + (moons[i].orbit * 2));
      }

      // Orbits in focus view (use world radius so camera works)
      for (const rWorld of moonOrbitsWorld) {
        drawOrbit(rWorld, 0, 0, 0.10);
      }

      // Moons
      for (let i = 0; i < moons.length; i++) {
        const moon = moons[i];
        const orbitWorld = moonOrbitsWorld[i];

        const base = ((hashString(b.id + "|" + moon.name) % 360) * Math.PI) / 180;
        const ang = base + ((state.tDays / moon.period) / 70) * Math.PI * 2;

        const mxW = Math.cos(ang) * orbitWorld;
        const myW = Math.sin(ang) * orbitWorld;

        const s = worldToScreen(mxW, myW);

        const mr = clamp(moon.size * 2.0, 6, 11); // keep as screen-ish size if you like
        ctx.save();
        ctx.fillStyle = moon.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, mr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,.22)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "rgba(255,255,255,.70)";
        ctx.font = "12px 'Space Grotesk', system-ui";
        ctx.fillText(moon.name, s.x + mr + 8, s.y + 4);
        ctx.restore();
      }
    } else {
      ctx.fillStyle = "rgba(255,255,255,.62)";
      ctx.font = "13px 'Space Grotesk', system-ui";
      ctx.fillText("This planet has no moons.", center.x - 85, center.y + planetR + 38);
    }

    // Missions (pins)
    for (const m of state.focusMissions) {
      const pin = m._pin || { anchor: "planet", a: 0, d: 22 };

      let px, py;

      if (pin.anchor === "moon" && pin.moon && moons.length) {
        const idx = moons.findIndex((mm) => mm.name === pin.moon);

        // Fallbacks if not found
        const moon = idx >= 0 ? moons[idx] : moons[0];
        const orbitWorld = idx >= 0 ? moonOrbitsWorld[idx] : 86;

        const base = ((hashString(b.id + "|" + moon.name) % 360) * Math.PI) / 180;
        const ang = base + ((state.tDays / moon.period) / 70) * Math.PI * 2;

        // Moon world pos around focused planet at world (0,0)
        const mxW = Math.cos(ang) * orbitWorld;
        const myW = Math.sin(ang) * orbitWorld;

        // Convert moon to screen, then apply pin offset in screen pixels
        const ms = worldToScreen(mxW, myW);
        px = ms.x + Math.cos(pin.a) * pin.d;
        py = ms.y + Math.sin(pin.a) * pin.d;
      } else {
        // Planet-anchored pin (planet is at world 0,0)
        px = center.x + Math.cos(pin.a) * pin.d;
        py = center.y + Math.sin(pin.a) * pin.d;
      }

      drawMissionPin(px, py, m);
    }

    if (!state.focusMissions.length) {
      // do shit if no mission, maybe display text??
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

    /*
    ctx.strokeStyle = "rgba(255,10,107,.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 7);
    ctx.lineTo(x, y + 16);
    ctx.stroke();
    */

    ctx.fillStyle = "rgba(255,255,255,.78)";
    ctx.font = "12px 'Space Grotesk', system-ui";
    ctx.fillText(mission.id, x + 10, y - 8);

    addHit("mission", mission.id, x, y, 14, mission);
  }

  function drawSystem() {
    for (const b of bodies) {
      if (b.orbit) drawOrbit(b.orbit, 0, 0, 0.08);
      // if (b.orbit) drawOrbitFadeLine(b.orbit, 0, 0, currentBodyPos(b).ang, 0.35);
    }
    drawBelts();
    drawSun();
    for (const b of bodies) {
      drawPlanet(b);
    }
  }

  // Main loop
  let last = performance.now();
  function frame(now) {
    const dt = (now - last) / 1000;
    last = now;

    if (camera.animT < 1) {
      const t = clamp((now - camera.startAt) / camera.animDur, 0, 1);
      const e = easeInOut(t);
      camera.x = lerp(camera.startX, camera.targetX, e);
      camera.y = lerp(camera.startY, camera.targetY, e);
      camera.zoom = lerp(camera.startZoom, camera.targetZoom, e);
      camera.animT = t;
    }

    if (!state.paused) {
      state.tDays += dt * state.timeScale;
    }

    hitTargets = [];

    drawStars();

    if (state.view === "system") {
      drawSystem();
    } else {
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

    const t = pick(mouse.x, mouse.y);
    state.hover = t;
    canvas.style.cursor = t && (t.type === "planet" || t.type === "mission") ? "pointer" : "default";

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Initial camera: fit whole system
  setCamera(0, 0, 1.0, 1);

  // Control time state
  if (timeSpeed) {
    // init from slider value
    applyTimeScale(Number(timeSpeed.value) || 10);

    timeSpeed.addEventListener("input", () => {
      applyTimeScale(Number(timeSpeed.value) || 0);
    });
  }

  // Initial UI state
  btnBack.disabled = true;
  hudMode.textContent = "Solar System";
  hudSub.textContent = "Click a planet to zoom. Click a mission pin to view details.";
  populateMissionList([]);

  showToast("Tip: Click Earth to see the Moon mission demo.");
})();
