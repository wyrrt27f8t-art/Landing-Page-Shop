/*
 * 3D-Tasche auf der Startseite (Hero) und Pack-Spiel unten.
 * Die Tasche besteht aus 72 echten, freigestellten Produktfotos (media/rundum-frei).
 * Ein Shader legt Kantenlicht, Lichtstreifen und eine Bodenspiegelung darüber;
 * je nach Blickwinkel wird das passende Foto gezeigt. Die Gegenstände im Spiel
 * sind einfache 3D-Modelle. Three.js liegt auf dem eigenen Server (vendor/).
 * Einheiten: 1 = 10 cm.
 */
(function () {
  "use strict";
  if (!window.THREE) return;

  const CONFIG = {
    fotos: { anzahl: 72, pfad: (i) => "media/rundum-frei/" + String(i).padStart(2, "0") + ".webp", b: 640, h: 708 },
    foto: { boden: 18 / 1106, oeffnung: 0.61, mitteX: -0.15, hoehe: 6.39 },
    farben: {
      kupfer: 0xc8945f, lila: 0x9c86e0,
      napfBlau: 0x2f5bd6, napfGelb: 0xf2c230, thermos: 0x5e6236, flasche: 0x8a5a2b,
      decke: 0xe0482a, ball: 0x9bc43a, buch: 0xe9e2cf, stoff: 0x1b1814, stoffKante: 0x2a241c,
    },
    teile: ["Futtertasche", "Thermosflasche", "Trinkflasche", "Napf", "2. Napf", "Buch", "Matte", "Ball", "Decke"],
    umlaufRadius: 3.7,
  };

  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = window.matchMedia("(pointer: coarse)").matches;
  const C = (hex) => new THREE.Color(hex).convertSRGBToLinear();
  const glatt = (t) => t * t * (3 - 2 * t);
  const text = (k, ersatz) => {
    const sprache = document.documentElement.lang || "de";
    const t = (window.MAFO_TEXTE || {})[sprache] || (window.MAFO_TEXTE || {}).de || {};
    return t[k] || ersatz;
  };

  /* ---------------- Fotos: einmal laden, für beide Bühnen ---------------- */
  const bilder = new Array(CONFIG.fotos.anzahl);
  const geladen = [];
  function lade(i) {
    if (!geladen[i]) {
      geladen[i] = new Promise((ok) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => { bilder[i] = img; ok(img); };
        img.onerror = () => ok(null);
        img.src = CONFIG.fotos.pfad(i);
      });
    }
    return geladen[i];
  }
  let alleGeladen = false;
  function ladeRest() {
    if (alleGeladen) return;
    alleGeladen = true;
    for (let i = 1; i < CONFIG.fotos.anzahl; i++) lade(i);
  }

  /* ---------------- Hilfen ---------------- */
  function rundRechteck(b, h, r) {
    const s = new THREE.Shape(), x = -b / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + b - r, y); s.quadraticCurveTo(x + b, y, x + b, y + r);
    s.lineTo(x + b, y + h - r); s.quadraticCurveTo(x + b, y + h, x + b - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function kiste(b, h, t, r, bevel, material, segs) {
    const g = new THREE.ExtrudeGeometry(rundRechteck(b - 2 * bevel, h - 2 * bevel, r), {
      depth: t - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs || 3, curveSegments: (segs || 3) * 2,
    });
    g.center();
    return new THREE.Mesh(g, material);
  }
  function weicheTextur(innen, aussen) {
    const c = document.createElement("canvas"); c.width = c.height = 128;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, innen); g.addColorStop(1, aussen);
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  const VERT = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }";
  const FRAG = [
    "uniform sampler2D map; uniform vec2 texel; uniform vec3 rimL; uniform vec3 rimR;",
    "uniform float sweep; uniform float spiegel; uniform float sichtbar; varying vec2 vUv;",
    "void main(){",
    "  vec4 c = texture2D(map, vUv);",
    "  if (c.a < 0.02) discard;",
    "  float d = 3.5;",
    "  float aL = texture2D(map, vUv - vec2(texel.x * d, 0.0)).a;",
    "  float aR = texture2D(map, vUv + vec2(texel.x * d, 0.0)).a;",
    "  float aU = texture2D(map, vUv + vec2(0.0, texel.y * d)).a;",
    "  vec3 col = pow(c.rgb, vec3(0.86)) * vec3(1.06, 1.03, 1.0);",
    "  col += rimL * clamp(c.a - aL, 0.0, 1.0) * 0.6;",
    "  col += rimR * clamp(c.a - aR, 0.0, 1.0) * 0.6;",
    "  col += vec3(1.0, 0.95, 0.88) * clamp(c.a - aU, 0.0, 1.0) * 0.22;",
    "  float s = exp(-pow((vUv.x * 0.8 + vUv.y * 0.45 - sweep) * 7.0, 2.0));",
    "  col += vec3(1.0, 0.92, 0.82) * s * 0.16;",
    "  float a = c.a * sichtbar;",
    "  if (spiegel > 0.5) { a *= (1.0 - smoothstep(0.0, 0.32, vUv.y)) * 0.16; col *= 0.8; }",
    "  gl_FragColor = vec4(col, a);",
    "}",
  ].join("\n");

  /* =====================================================================
     buehne({ canvas, container, modus, platz, onPack })
     modus "hero":  nur die Tasche, dreht mit der Maus, pendelt sonst langsam
     modus "spiel": Sachen kreisen, Antippen packt sie ein
     platz(): Rechteck in Pixeln (im Container), in das die Tasche passen soll
     ===================================================================== */
  function buehne(opt) {
    const { canvas, container, modus } = opt;
    const spiel = modus === "spiel";
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: !touch, alpha: true, powerPreference: "high-performance" });
    } catch (e) { return null; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.5 : 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    const szene = new THREE.Scene();
    const kamera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    const DIST = 20;
    kamera.position.set(0, 0, DIST);
    kamera.lookAt(0, 0, 0);

    if (spiel) {
      // Studio-Umgebung für Spiegelungen auf den Gegenständen
      const pmrem = new THREE.PMREMGenerator(renderer);
      const studio = new THREE.Scene();
      studio.background = new THREE.Color(0x0d0b09);
      const box = (farbe, x, y, z, b, h) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(b, h), new THREE.MeshBasicMaterial({ color: farbe, side: THREE.DoubleSide }));
        m.position.set(x, y, z); m.lookAt(0, 0, 0); studio.add(m);
      };
      box(0xfff4e6, 0, 6, 3, 8, 3);
      box(new THREE.Color(CONFIG.farben.kupfer).multiplyScalar(1.6), 7, 1, -2, 3, 8);
      box(new THREE.Color(CONFIG.farben.lila).multiplyScalar(1.6), -7, 1.5, -1, 3, 8);
      szene.environment = pmrem.fromScene(studio, 0.04).texture;
      pmrem.dispose();
    }

    szene.add(new THREE.AmbientLight(0xfff2e2, 0.25));
    const key = new THREE.DirectionalLight(0xfff1de, 1.2);
    key.position.set(-4, 6, 7); szene.add(key);
    const kl = new THREE.PointLight(CONFIG.farben.kupfer, 2.2, 22, 2);
    kl.position.set(4.5, 2.5, -2.5); szene.add(kl);
    const ll = new THREE.PointLight(CONFIG.farben.lila, 1.8, 22, 2);
    ll.position.set(-4.5, 3, -2); szene.add(ll);

    const anker = new THREE.Group();
    const welt = new THREE.Group();
    anker.add(welt); szene.add(anker);
    // kl/ll mit der Bühne mitführen
    anker.add(kl, ll);

    const schatten = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 2.4),
      new THREE.MeshBasicMaterial({ map: weicheTextur("rgba(0,0,0,0.7)", "rgba(0,0,0,0)"), transparent: true, depthWrite: false }));
    schatten.rotation.x = -Math.PI / 2; schatten.position.y = -2.0;
    anker.add(schatten);

    /* ---- Foto-Tasche ---- */
    const FB = CONFIG.fotos.b, FH = CONFIG.fotos.h;
    const fc = document.createElement("canvas"); fc.width = FB; fc.height = FH;
    const fctx = fc.getContext("2d");
    const ftex = new THREE.CanvasTexture(fc);
    ftex.minFilter = THREE.LinearFilter; ftex.generateMipmaps = false;
    const uniforms = () => ({
      map: { value: ftex }, texel: { value: new THREE.Vector2(1 / FB, 1 / FH) },
      rimL: { value: new THREE.Color(CONFIG.farben.lila) }, rimR: { value: new THREE.Color(CONFIG.farben.kupfer) },
      sweep: { value: -1 }, spiegel: { value: 0 }, sichtbar: { value: 0 },
    });
    const tMat = new THREE.ShaderMaterial({ uniforms: uniforms(), vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
    const sMat = new THREE.ShaderMaterial({ uniforms: uniforms(), vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false });
    sMat.uniforms.spiegel.value = 1;
    const HT = CONFIG.foto.hoehe, BT = HT * FB / FH;
    const untenY = -2.0 - CONFIG.foto.boden * HT;
    const mitteY = untenY + HT / 2;
    const tasche = new THREE.Mesh(new THREE.PlaneGeometry(BT, HT), tMat);
    tasche.position.set(CONFIG.foto.mitteX, mitteY, 0); tasche.renderOrder = 2;
    const spiegel = new THREE.Mesh(new THREE.PlaneGeometry(BT, HT), sMat);
    spiegel.scale.y = -1; spiegel.position.set(CONFIG.foto.mitteX, untenY - HT / 2 + 0.02, -0.01); spiegel.renderOrder = 1;
    anker.add(tasche, spiegel);

    let aktFoto = -1, einblenden = 0;
    function zeigeFoto(i) {
      const img = bilder[i];
      if (!img || i === aktFoto) return;
      aktFoto = i;
      fctx.clearRect(0, 0, FB, FH); fctx.drawImage(img, 0, 0, FB, FH);
      ftex.needsUpdate = true;
    }
    lade(0).then((img) => {
      if (!img) return;
      zeigeFoto(0);
      einblenden = ruhig ? 1 : 0.001;
      opt.onBereit && opt.onBereit();
    });

    /* ---- Lichtstaub ---- */
    const staub = (function () {
      const n = touch ? 60 : 120, pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 12; pos[i * 3 + 1] = (Math.random() - 0.3) * 8; pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
      }
      const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const p = new THREE.Points(g, new THREE.PointsMaterial({
        size: 0.09, map: weicheTextur("rgba(255,226,190,1)", "rgba(255,226,190,0)"),
        transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending,
      }));
      anker.add(p); return p;
    })();

    /* ---- Gegenstände (nur im Spiel) ---- */
    const teile = [], ziele = [];
    if (spiel) {
      const glanz = (farbe, rau = 0.35, extra = {}) => new THREE.MeshPhysicalMaterial(Object.assign({ color: C(farbe), roughness: rau, clearcoat: 0.6, clearcoatRoughness: 0.25, envMapIntensity: 1.1 }, extra));
      const stoff = new THREE.MeshStandardMaterial({ color: C(CONFIG.farben.stoff), roughness: 0.85, envMapIntensity: 0.6 });
      const stoffKante = new THREE.MeshStandardMaterial({ color: C(CONFIG.farben.stoffKante), roughness: 0.7, envMapIntensity: 0.7 });
      const metall = new THREE.MeshStandardMaterial({ color: C(0xc9c3b8), roughness: 0.22, metalness: 1, envMapIntensity: 1.2 });
      const napf = (farbe) => {
        const g = new THREE.Group();
        [[0.62, 0.55, 0.08, 0.14], [0.55, 0.48, 0.08, 0.06], [0.48, 0.42, 0.08, -0.02]].forEach(([r1, r2, h, y]) => {
          const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, h, 40, 1, true), glanz(farbe, 0.5, { side: THREE.DoubleSide, clearcoat: 0.2 }));
          m.position.y = y; g.add(m);
        });
        const boden = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.04, 40), glanz(farbe, 0.5));
        boden.position.y = -0.06; g.add(boden);
        const rand = new THREE.Mesh(new THREE.TorusGeometry(0.64, 0.045, 10, 48), glanz(0x15171c, 0.4));
        rand.rotation.x = Math.PI / 2; rand.position.y = 0.18; g.add(rand);
        const kar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20), metall);
        kar.position.set(0.72, 0.18, 0); g.add(kar);
        return g;
      };
      const BAUER = {
        "Futtertasche": () => { const g = new THREE.Group(); g.add(kiste(0.95, 0.8, 0.7, 0.16, 0.08, stoff, 3)); const z = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.04), metall); z.position.y = 0.41; g.add(z); return g; },
        "Thermosflasche": () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.8, 36), glanz(CONFIG.farben.thermos, 0.45, { metalness: 0.3 }))); const d = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.22, 36), glanz(0x2b2d22, 0.3)); d.position.y = 1.0; g.add(d); return g; },
        "Trinkflasche": () => {
          const pts = [[0, -0.85], [0.28, -0.85], [0.3, -0.7], [0.3, 0.35], [0.22, 0.6], [0.15, 0.72], [0.15, 0.85], [0, 0.85]].map(([x, y]) => new THREE.Vector2(x, y));
          const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 36), glanz(CONFIG.farben.flasche, 0.4)));
          const d = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 28), metall); d.position.y = 0.95; g.add(d); return g;
        },
        "Napf": () => napf(CONFIG.farben.napfBlau),
        "2. Napf": () => napf(CONFIG.farben.napfGelb),
        "Buch": () => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.24, 0.7), new THREE.MeshStandardMaterial({ color: C(CONFIG.farben.buch), roughness: 0.9 }))); const u = new THREE.Mesh(new THREE.BoxGeometry(1.03, 0.03, 0.72), glanz(0x6fbf73, 0.4)); u.position.y = 0.135; g.add(u); return g; },
        "Matte": () => { const m = kiste(1.5, 1.0, 0.08, 0.1, 0.03, stoffKante, 2); m.rotation.x = -Math.PI / 2.4; return m; },
        "Ball": () => new THREE.Mesh(new THREE.SphereGeometry(0.42, 36, 24), glanz(CONFIG.farben.ball, 0.3)),
        "Decke": () => { const g = new THREE.Group(); const r = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 1.3, 32), new THREE.MeshStandardMaterial({ color: C(CONFIG.farben.decke), roughness: 0.95 })); r.rotation.z = Math.PI / 2; g.add(r); const b = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 8, 32), stoffKante); b.rotation.y = Math.PI / 2; g.add(b); return g; },
      };
      const trefferMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      CONFIG.teile.forEach((name, i) => {
        const holder = new THREE.Group();
        const modell = new THREE.Group(); modell.add(BAUER[name]());
        holder.add(modell);
        const kugel = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8), trefferMat);
        kugel.userData.teil = holder;
        holder.add(kugel); ziele.push(kugel);
        holder.userData = {
          index: i, modell, q: 0, packt: false, hover: 0,
          winkel: (i / CONFIG.teile.length) * Math.PI * 2,
          hoehe: [0.7, 1.9, -0.7, 1.2, 0.0, 2.3, -1.2, 0.5, 1.6][i],
          drehung: new THREE.Vector3(0.25 + (i % 3) * 0.12, 0.35 + (i % 4) * 0.1, 0.08),
          start: new THREE.Vector3(),
        };
        welt.add(holder); teile.push(holder);
      });
    }

    /* ---- Grösse: Tasche in das von platz() gelieferte Rechteck setzen ---- */
    function groesse() {
      const b = container.clientWidth, h = container.clientHeight;
      if (!b || !h) return;
      renderer.setSize(b, h, false);
      kamera.aspect = b / h;
      kamera.updateProjectionMatrix();
      const hoeheSicht = 2 * DIST * Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2));
      const pxProEinheit = h / hoeheSicht;
      const r = opt.platz(b, h);                       // {x, y, b, h} in Pixeln
      // Tasche (Körper + Henkel) füllt die Höhe des Rechtecks; im Spiel muss auch der Umlauf in die Breite passen
      const breiteEinheiten = spiel ? (CONFIG.umlaufRadius + 1.3) * 2 : BT;
      const s = Math.min((r.h * 0.92) / (HT * pxProEinheit), (r.b * 0.96) / (breiteEinheiten * pxProEinheit));
      anker.scale.setScalar(s);
      const cx = (r.x + r.b / 2 - b / 2) / pxProEinheit;
      const cy = -(r.y + r.h / 2 - h / 2) / pxProEinheit;
      anker.position.set(cx - CONFIG.foto.mitteX * s, cy - mitteY * s, 0);
    }
    groesse();
    window.addEventListener("resize", groesse);
    if ("ResizeObserver" in window) new ResizeObserver(groesse).observe(container);

    /* ---- Zeiger ---- */
    const ziel = { x: 0, y: 0 }, akt = { x: 0, y: 0 };
    const ndc = new THREE.Vector2(), strahl = new THREE.Raycaster();
    let hoverTeil = null;
    function zeiger(cx, cy) {
      const r = container.getBoundingClientRect();
      ziel.x = ((cx - r.left) / r.width) * 2 - 1;
      ziel.y = ((cy - r.top) / r.height) * 2 - 1;
      ndc.set(ziel.x, -ziel.y);
    }
    function getroffen() {
      strahl.setFromCamera(ndc, kamera);
      const hits = strahl.intersectObjects(ziele.filter((k) => !k.userData.teil.userData.packt), false);
      return hits.length ? hits[0].object.userData.teil : null;
    }
    container.addEventListener("pointermove", (e) => {
      zeiger(e.clientX, e.clientY);
      if (spiel && e.pointerType === "mouse") {
        hoverTeil = getroffen();
        canvas.classList.toggle("zeigt", !!hoverTeil);
      }
    });
    container.addEventListener("pointerleave", () => { ziel.x = 0; ziel.y = 0; hoverTeil = null; canvas.classList.remove("zeigt"); });

    /* ---- Spiel ---- */
    const api = { tasche };
    let wippen = 0;
    if (spiel) {
      const einpacken = (t) => {
        if (t.userData.packt) return;
        t.userData.packt = true;
        const n = teile.filter((x) => x.userData.packt).length;
        setTimeout(() => { wippen = 1; }, ruhig ? 0 : 750);
        opt.onPack && opt.onPack(n, t.userData.index);
      };
      canvas.addEventListener("pointerdown", (e) => {
        zeiger(e.clientX, e.clientY);
        const t = getroffen();
        if (t) einpacken(t);
      });
      api.alle = () => teile.forEach((t, i) => setTimeout(() => einpacken(t), ruhig ? 0 : i * 260));
      api.neu = () => teile.forEach((t) => { t.userData.packt = false; });
    }
    const oeffnung = new THREE.Vector3(CONFIG.foto.mitteX, untenY + CONFIG.foto.oeffnung * HT + 0.1, 0.2);

    /* ---- Render-Schleife (läuft nur, solange die Bühne sichtbar ist) ---- */
    const uhr = new THREE.Clock();
    let sichtbar = true, zeit = 0;
    const N = CONFIG.fotos.anzahl;
    const zielLokal = new THREE.Vector3();
    function bild() {
      requestAnimationFrame(bild);
      if (!sichtbar) return;
      const dt = Math.min(uhr.getDelta(), 0.05);
      zeit += ruhig ? 0 : dt;
      akt.x += (ziel.x - akt.x) * 0.06;
      akt.y += (ziel.y - akt.y) * 0.06;

      if (einblenden > 0 && einblenden < 1) einblenden = Math.min(1, einblenden + dt / 0.9);
      tMat.uniforms.sichtbar.value = sMat.uniforms.sichtbar.value = glatt(einblenden);

      const winkel = Math.sin(zeit * 0.22) * (spiel ? 0.45 : 0.7) + akt.x * (spiel ? 0.5 : 0.9);
      zeigeFoto(((Math.round((winkel / (Math.PI * 2)) * N) % N) + N) % N);
      welt.rotation.y = winkel;
      welt.rotation.x = 0.06 + akt.y * 0.08;
      wippen = Math.max(0, wippen - dt * 2.2);
      const w = Math.sin((1 - wippen) * Math.PI * 3) * wippen * 0.04;
      tasche.scale.set(1 + w, 1 - w, 1);
      tasche.position.y = mitteY + Math.sin(zeit * 1.1) * 0.04;
      tMat.uniforms.sweep.value = ((zeit * 0.12) % 1) * 3.0 - 0.8;
      staub.rotation.y = zeit * 0.02;
      staub.position.y = Math.sin(zeit * 0.3) * 0.15;

      if (spiel) {
        anker.updateMatrixWorld();
        zielLokal.copy(oeffnung); anker.localToWorld(zielLokal); welt.worldToLocal(zielLokal);
        teile.forEach((t, k) => {
          const d = t.userData;
          d.q = ruhig ? (d.packt ? 1 : 0) : Math.min(1, Math.max(0, d.q + (d.packt ? dt / 0.9 : -dt / 0.6)));
          d.hover += ((t === hoverTeil ? 1 : 0) - d.hover) * 0.2;
          const wk = d.winkel + zeit * 0.16;
          const r = CONFIG.umlaufRadius + (k % 2) * 0.4;
          d.start.set(Math.cos(wk) * r, d.hoehe + Math.sin(zeit * 0.9 + k) * 0.12, Math.sin(wk) * r * 0.55);
          const q = glatt(d.q);
          t.position.lerpVectors(d.start, zielLokal, q);
          t.position.y += Math.sin(q * Math.PI) * 1.5;
          const s = (q < 0.8 ? 1 : 1 - (q - 0.8) / 0.2) * (1 + d.hover * 0.15);
          d.modell.scale.setScalar(Math.max(s, 0.001));
          t.visible = q < 0.999;
          d.modell.rotation.x = zeit * d.drehung.x * (1 - q) + q * 1.2;
          d.modell.rotation.y = zeit * d.drehung.y * (1 - q);
        });
      }
      renderer.render(szene, kamera);
    }
    bild();

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((e) => {
        sichtbar = e[0].isIntersecting;
        if (sichtbar) { uhr.getDelta(); ladeRest(); }
      }, { threshold: 0 }).observe(container);
    } else {
      ladeRest();
    }
    return api;
  }

  /* =================== Hero =================== */
  const heroEl = document.getElementById("hero");
  const heroCanvas = document.getElementById("hero-3d");
  if (heroEl && heroCanvas) {
    const textEl = heroEl.querySelector(".hero-inner");
    const h = buehne({
      canvas: heroCanvas, container: heroEl, modus: "hero",
      platz(b, hoehe) {
        if (b >= 900) {
          // Desktop: rechte Hälfte neben dem Text
          return { x: b * 0.54, y: hoehe * 0.1, b: b * 0.42, h: hoehe * 0.8 };
        }
        // Handy/Tablet: Fläche unter dem Text
        const r = textEl.getBoundingClientRect(), c = heroEl.getBoundingClientRect();
        const oben = r.bottom - c.top + 8;
        return { x: 16, y: oben, b: b - 32, h: Math.max(160, hoehe - oben - 16) };
      },
      onBereit() { heroEl.classList.add("hero-3d-bereit"); },
    });
    if (!h) heroEl.classList.add("hero-3d-aus");
  }

  /* =================== Spiel =================== */
  const spielEl = document.getElementById("spiel-buehne");
  const spielCanvas = document.getElementById("spiel-3d");
  if (spielEl && spielCanvas) {
    const zZahl = document.getElementById("spiel-zahl");
    const zName = document.getElementById("spiel-name");
    const fertig = document.getElementById("spiel-fertig");
    const btnAlle = document.getElementById("spiel-alle");
    const btnNeu = document.getElementById("spiel-neu");
    const s = buehne({
      canvas: spielCanvas, container: spielEl, modus: "spiel",
      platz(b, hoehe) { return { x: 0, y: hoehe * 0.16, b, h: hoehe * 0.66 }; },
      onPack(n, index) {
        zZahl.textContent = String(n);
        zName.removeAttribute("data-i18n");
        zName.textContent = n === CONFIG.teile.length ? text("spiel.fertig", "Alles drin.") : "+ " + text("spiel.teil." + index, CONFIG.teile[index]);
        btnNeu.disabled = false;
        if (!ruhig) { zZahl.classList.remove("ploppt"); void zZahl.offsetWidth; zZahl.classList.add("ploppt"); }
        if (n === CONFIG.teile.length) {
          btnAlle.disabled = true;
          setTimeout(() => { fertig.hidden = false; }, ruhig ? 0 : 900);
        }
      },
    });
    if (s) {
      btnAlle.addEventListener("click", () => s.alle());
      btnNeu.addEventListener("click", () => {
        s.neu();
        zZahl.textContent = "0";
        zName.setAttribute("data-i18n", "spiel.start");
        zName.textContent = text("spiel.start", "Tipp eine Sache an");
        fertig.hidden = true; btnAlle.disabled = false; btnNeu.disabled = true;
      });
    } else {
      document.getElementById("spiel").hidden = true;    // ohne WebGL kein Spiel
    }
  }
})();
