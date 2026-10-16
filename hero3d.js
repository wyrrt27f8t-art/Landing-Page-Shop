/*
 * 3D-Tasche auf der Startseite (Hero).
 * Die Tasche besteht aus 72 echten, freigestellten Produktfotos (media/rundum-frei).
 * Ein Shader legt Kantenlicht, Lichtstreifen und eine Bodenspiegelung darüber;
 * je nach Blickwinkel wird das passende Foto gezeigt. Three.js liegt auf dem eigenen Server (vendor/).
 * Einheiten: 1 = 10 cm.
 */
(function () {
  "use strict";
  if (!window.THREE) return;

  const CONFIG = {
    fotos: { anzahl: 72, pfad: (i) => "media/rundum-frei/" + String(i).padStart(2, "0") + ".webp", b: 1000, h: 1106 },
    foto: { boden: 18 / 1106, oeffnung: 0.61, mitteX: -0.15, hoehe: 6.39 },
    farben: { kupfer: 0xc8945f, lila: 0x9c86e0 },
  };

  const ruhig = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = window.matchMedia("(pointer: coarse)").matches;
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
     buehne({ canvas, container, platz })
     Die Tasche dreht sich mit der Maus und pendelt sonst langsam.
     platz(): Rechteck in Pixeln (im Container), in das die Tasche passen soll
     ===================================================================== */
  function buehne(opt) {
    const { canvas, container } = opt;
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
      // Tasche (Körper + Henkel) füllt die Höhe des Rechtecks
      const s = Math.min((r.h * 0.92) / (HT * pxProEinheit), (r.b * 0.96) / (BT * pxProEinheit));
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
    function zeiger(cx, cy) {
      const r = container.getBoundingClientRect();
      ziel.x = ((cx - r.left) / r.width) * 2 - 1;
      ziel.y = ((cy - r.top) / r.height) * 2 - 1;
      ndc.set(ziel.x, -ziel.y);
    }
    container.addEventListener("pointermove", (e) => zeiger(e.clientX, e.clientY));
    container.addEventListener("pointerleave", () => { ziel.x = 0; ziel.y = 0; });

    /* ---- Render-Schleife (läuft nur, solange die Bühne sichtbar ist) ---- */
    const uhr = new THREE.Clock();
    let sichtbar = true, zeit = 0;
    const N = CONFIG.fotos.anzahl;
    function bild() {
      requestAnimationFrame(bild);
      if (!sichtbar) return;
      const dt = Math.min(uhr.getDelta(), 0.05);
      zeit += ruhig ? 0 : dt;
      akt.x += (ziel.x - akt.x) * 0.06;
      akt.y += (ziel.y - akt.y) * 0.06;

      if (einblenden > 0 && einblenden < 1) einblenden = Math.min(1, einblenden + dt / 0.9);
      tMat.uniforms.sichtbar.value = sMat.uniforms.sichtbar.value = glatt(einblenden);

      const winkel = Math.sin(zeit * 0.22) * 0.7 + akt.x * 0.9;
      zeigeFoto(((Math.round((winkel / (Math.PI * 2)) * N) % N) + N) % N);
      welt.rotation.y = winkel;
      welt.rotation.x = 0.06 + akt.y * 0.08;
      tasche.position.y = mitteY + Math.sin(zeit * 1.1) * 0.04;
      tMat.uniforms.sweep.value = ((zeit * 0.12) % 1) * 3.0 - 0.8;
      staub.rotation.y = zeit * 0.02;
      staub.position.y = Math.sin(zeit * 0.3) * 0.15;

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
    return { tasche };
  }

  /* =================== Hero =================== */
  const heroEl = document.getElementById("hero");
  const heroCanvas = document.getElementById("hero-3d");
  if (heroEl && heroCanvas) {
    const textEl = heroEl.querySelector(".hero-inner");
    const h = buehne({
      canvas: heroCanvas, container: heroEl,
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
})();
