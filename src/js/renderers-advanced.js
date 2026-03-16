/**
 * OMEGA Warehouse Planner — Advanced Renderer Layer
 * ──────────────────────────────────────────────────
 * Replaces raw HTML5 Canvas with three modern renderers:
 *   • Konva.js   → 2D Layout  (OOP scene graph, real drag/hover events)
 *   • Three.js   → 3D View    (WebGL, real perspective, orbit camera)
 *   • PixiJS     → Footprint  (GPU-accelerated treemap)
 *
 * All data/layout logic in main.js is untouched — this file
 * only overrides the draw* functions and tab switching.
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════

  function dd(it)  { return window.getDD  ? window.getDD(it)  : { dW: it.is_long ? it.L : it.W, dH: it.is_long ? it.W : it.L }; }
  function sh(it)  { return window.stackH ? window.stackH(it) : it.H * Math.min(it.stack, Math.ceil(it.bundles / (it.floor_pos || 1))); }
  function zColor(it, idx) {
    const PALETTE = ['#3b82f6','#06b6d4','#8b5cf6','#ec4899','#22c55e','#f59e0b','#ef4444','#6366f1','#0ea5e9','#10b981'];
    return (window.zoneColorMap && window.zoneColorMap[it.id]) || PALETTE[idx % PALETTE.length];
  }
  function cssToHex(css) {
    return parseInt(css.replace('#', ''), 16);
  }
  function allItems() {
    const ly = window.layout;
    if (!ly) return [];
    return (ly.lItems || []).concat(ly.rItems || []);
  }

  let currentTab = '2d';

  // ═══════════════════════════════════════════════════════════
  // KONVA.JS — 2D Layout (OOP canvas, drag/hover, smart events)
  // ═══════════════════════════════════════════════════════════

  const K = { stage: null, bg: null, items: null, annot: null, mount: null };

  function initKonva() {
    const wrap = document.querySelector('.cv-wrap');
    K.mount = document.createElement('div');
    K.mount.id = 'konva-mount';
    K.mount.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:none;';
    wrap.appendChild(K.mount);

    K.stage = new Konva.Stage({ container: 'konva-mount', width: wrap.clientWidth, height: wrap.clientHeight, draggable: true });
    K.bg    = new Konva.Layer();
    K.items = new Konva.Layer();
    K.annot = new Konva.Layer();
    K.stage.add(K.bg, K.items, K.annot);

    // Scroll-to-zoom centered on cursor
    K.stage.on('wheel', e => {
      e.evt.preventDefault();
      const f = e.evt.deltaY < 0 ? 1.13 : 1 / 1.13;
      const old = K.stage.scaleX();
      const ptr = K.stage.getPointerPosition();
      const anchor = { x: (ptr.x - K.stage.x()) / old, y: (ptr.y - K.stage.y()) / old };
      const ns = Math.max(4, Math.min(300, old * f));
      K.stage.scale({ x: ns, y: ns });
      K.stage.position({ x: ptr.x - anchor.x * ns, y: ptr.y - anchor.y * ns });
    });

    K.mount.style.cursor = 'grab';
    K.stage.on('dragstart', () => (K.mount.style.cursor = 'grabbing'));
    K.stage.on('dragend',   () => (K.mount.style.cursor = 'grab'));

    // Deselect on empty click
    K.stage.on('click', e => { if (e.target === K.stage) { window.selId = null; renderKonva(); } });
  }

  function renderKonva() {
    if (!K.stage || !window.layout || !window.pos) return;
    K.bg.destroyChildren(); K.items.destroyChildren(); K.annot.destroyChildren();

    const ly = window.layout;
    const pos = window.pos;
    const PX = 30; // pixels per metre
    const W = ly.W * PX, H = ly.H * PX;

    // ── Background ──────────────────────────────────────────
    K.bg.add(new Konva.Rect({ width: W, height: H, fill: '#f8fafc' }));

    // Grid
    for (let x = 0; x <= Math.ceil(ly.W); x++) {
      K.bg.add(new Konva.Line({ points: [x*PX,0,x*PX,H], stroke: x%5===0?'#99aabb':'#d8e4f0', strokeWidth: x%5===0?0.7:0.3 }));
    }
    for (let y = 0; y <= Math.ceil(ly.H); y++) {
      K.bg.add(new Konva.Line({ points: [0,y*PX,W,y*PX], stroke: y%5===0?'#99aabb':'#d8e4f0', strokeWidth: y%5===0?0.7:0.3 }));
    }

    // Corridor shading + centre dashes
    const cL = ly.corrL * PX, cR = ly.corrR * PX, cW = cR - cL;
    K.bg.add(new Konva.Rect({ x: cL, y: 0, width: cW, height: H, fill: 'rgba(234,179,8,0.09)' }));
    K.bg.add(new Konva.Line({ points: [cL+cW/2,0,cL+cW/2,H], stroke: 'rgba(234,179,8,0.45)', strokeWidth: 1.2, dash: [8,5] }));
    K.bg.add(new Konva.Text({ x: cL+2, y: H-14, text: '← Corridor →', fontSize: 9, fill: 'rgba(180,130,0,0.7)', fontStyle: 'italic' }));

    // Warehouse border
    K.bg.add(new Konva.Rect({ width: W, height: H, stroke: '#1e3a5f', strokeWidth: 2.5, fill: 'transparent', cornerRadius: 1 }));

    // Grid labels
    for (let x = 0; x <= Math.ceil(ly.W); x += 5) {
      K.annot.add(new Konva.Text({ x: x*PX-9, y: H+4, text: x+'m', fontSize: 8, fill: '#94a3b8' }));
    }
    for (let y = 0; y <= Math.ceil(ly.H); y += 5) {
      K.annot.add(new Konva.Text({ x: -22, y: y*PX-5, text: y+'m', fontSize: 8, fill: '#94a3b8' }));
    }

    // North arrow
    K.annot.add(new Konva.Text({ x: W + 6, y: H - 20, text: '▲ N', fontSize: 10, fill: '#1e3a5f', fontStyle: 'bold' }));

    // ── Items ─────────────────────────────────────────────────
    const its = allItems();
    its.forEach((it, idx) => {
      const p = pos[it.id];
      if (!p) return;
      const { dW, dH } = dd(it);
      const x = p.x * PX, y = p.y * PX, w = dW * PX, h = dH * PX;
      const stackHt = sh(it);
      const isSel = window.selId === it.id;
      const color = zColor(it, idx);

      const grp = new Konva.Group({ x, y });

      // Box with selection glow
      const box = new Konva.Rect({
        width: w, height: h, fill: color, cornerRadius: 3,
        opacity: isSel ? 1 : 0.82,
        stroke: isSel ? '#fbbf24' : 'rgba(0,0,0,0.22)',
        strokeWidth: isSel ? 2.5 : 1,
        shadowColor: isSel ? '#fbbf24' : '#000',
        shadowBlur: isSel ? 16 : 6,
        shadowOpacity: isSel ? 0.55 : 0.18,
        shadowOffset: { x: 1, y: 2 },
      });
      grp.add(box);

      // Bundle grid lines
      const { fp, cols, rows } = dd(it);
      if (w > 22 && cols > 1) {
        for (let c = 1; c < cols; c++) {
          grp.add(new Konva.Line({ points: [c*w/cols,0,c*w/cols,h], stroke:'rgba(255,255,255,0.3)', strokeWidth:0.8, dash:[2,2] }));
        }
      }
      if (h > 22 && rows > 1) {
        for (let r = 1; r < rows; r++) {
          grp.add(new Konva.Line({ points: [0,r*h/rows,w,r*h/rows], stroke:'rgba(255,255,255,0.3)', strokeWidth:0.8, dash:[2,2] }));
        }
      }

      // Label
      const lbl = it.item.length > 16 ? it.item.slice(0,14)+'…' : it.item;
      const fs = Math.max(6, Math.min(11, Math.min(w,h) * 0.18));
      grp.add(new Konva.Text({ x:0, y:0, width:w, height: Math.min(h, h*0.6), text: lbl, fontSize: fs, fill:'#fff', fontStyle:'bold', align:'center', verticalAlign:'middle', wrap:'none', listening:false }));

      // Stack badge (top-right)
      if (it.stack > 1 && w > 28 && h > 18) {
        const bw = 22, bh = 13;
        grp.add(new Konva.Rect({ x: w-bw-2, y: 2, width: bw, height: bh, fill:'rgba(0,0,0,0.45)', cornerRadius:2 }));
        grp.add(new Konva.Text({ x: w-bw-2, y:2, width:bw, height:bh, text:`×${it.stack}`, fontSize:8, fill:'#fff', align:'center', verticalAlign:'middle', listening:false }));
      }

      // Dims label (bottom)
      if (h > 28 && w > 30) {
        grp.add(new Konva.Text({ x:0, y:h-12, width:w, text:`${it.L}×${it.W}m`, fontSize:7, fill:'rgba(255,255,255,0.75)', align:'center', listening:false }));
      }

      // ── Events ──────────────────────────────────────────────
      grp.on('click tap', () => {
        if (window.selItem) window.selItem(it.id);
        renderKonva();
      });

      grp.on('mouseover', e => {
        K.mount.style.cursor = 'pointer';
        box.shadowBlur(18); box.opacity(1);
        K.items.batchDraw();
        const tip = document.getElementById('tip');
        if (tip) {
          tip.style.display = 'block';
          tip.innerHTML = `<strong>${it.item}</strong><br>${it.L}×${it.W}×${it.H} m &nbsp;|&nbsp; stack ×${it.stack} (h: ${stackHt.toFixed(2)}m)<br>${it.bundles} bundles &nbsp;·&nbsp; ${it.sqm} m²`;
          tip.style.left = (e.evt.clientX + 14) + 'px';
          tip.style.top  = (e.evt.clientY - 8) + 'px';
        }
      });

      grp.on('mouseout', () => {
        K.mount.style.cursor = 'grab';
        box.shadowBlur(isSel ? 16 : 6); box.opacity(isSel ? 1 : 0.82);
        K.items.batchDraw();
        const tip = document.getElementById('tip');
        if (tip) tip.style.display = 'none';
      });

      K.items.add(grp);
    });

    // ── Area summary overlay ─────────────────────────────────
    if (window.updateMetrics) window.updateMetrics();

    K.bg.batchDraw(); K.items.batchDraw(); K.annot.batchDraw();

    // Auto-fit first time
    if (!K._fitted) { fitKonva(W, H); K._fitted = true; }
  }

  function fitKonva(W, H) {
    if (!K.stage) return;
    const pad = 44;
    const sw = K.stage.width() - pad*2, sh = K.stage.height() - pad*2;
    const sc = Math.min(sw/W, sh/H, 2);
    K.stage.scale({ x: sc, y: sc });
    K.stage.position({ x: pad + (sw - W*sc)/2, y: pad + (sh - H*sc)/2 });
  }

  // ═══════════════════════════════════════════════════════════
  // THREE.JS — Real 3D Warehouse (WebGL, perspective, shadows)
  // ═══════════════════════════════════════════════════════════

  const T = { scene:null, camera:null, renderer:null, mount:null, objs:[],
              theta:-0.7, phi:1.0, r:40, panX:0, panZ:0,
              drag:false, panDrag:false, ds:{x:0,y:0}, ps:{x:0,y:0,px:0,pz:0} };

  function initThree() {
    const wrap = document.querySelector('.cv-wrap');
    T.mount = document.createElement('div');
    T.mount.id = 'three-mount';
    T.mount.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:none;';
    wrap.appendChild(T.mount);

    const W = wrap.clientWidth, H = wrap.clientHeight;

    T.scene = new THREE.Scene();
    T.scene.background = new THREE.Color(0x0f1c33);
    T.scene.fog = new THREE.FogExp2(0x0f1c33, 0.012);

    T.camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 800);
    T.renderer = new THREE.WebGLRenderer({ antialias: true });
    T.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    T.renderer.setSize(W, H);
    T.renderer.shadowMap.enabled = true;
    T.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    T.mount.appendChild(T.renderer.domElement);

    // Ambient fill
    T.scene.add(new THREE.AmbientLight(0x6688aa, 0.55));

    // Sun with shadows
    const sun = new THREE.DirectionalLight(0xfff3d0, 1.1);
    sun.position.set(35, 65, 25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { near:1, far:200, left:-80, right:80, top:80, bottom:-80 });
    T.scene.add(sun);

    // Cool fill from opposite side
    const fill = new THREE.DirectionalLight(0x4488ff, 0.35);
    fill.position.set(-20, 25, -15);
    T.scene.add(fill);

    // Floor plane
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300, 60, 60),
      new THREE.MeshLambertMaterial({ color: 0x141e33 })
    );
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; floor.position.y = -0.02;
    T.scene.add(floor);

    // Grid lines on floor
    T.scene.add(new THREE.GridHelper(200, 40, 0x1e3050, 0x192840));

    // ── Mouse orbit controls ──────────────────────────────────
    const el = T.renderer.domElement;
    el.addEventListener('mousedown', e => {
      if (e.button === 0) { T.drag = true; T.ds = { x: e.clientX, y: e.clientY }; }
      if (e.button === 2) { T.panDrag = true; T.ps = { x: e.clientX, y: e.clientY, px: T.panX, pz: T.panZ }; }
    });
    el.addEventListener('mousemove', e => {
      if (T.drag) {
        T.theta += (e.clientX - T.ds.x) * 0.009;
        T.phi = Math.max(0.06, Math.min(1.52, T.phi - (e.clientY - T.ds.y) * 0.009));
        T.ds = { x: e.clientX, y: e.clientY }; refreshCamera();
      }
      if (T.panDrag) {
        T.panX = T.ps.px + (e.clientX - T.ps.x) * 0.06;
        T.panZ = T.ps.pz + (e.clientY - T.ps.y) * 0.06;
        refreshCamera();
      }
    });
    el.addEventListener('mouseup',    () => { T.drag = T.panDrag = false; });
    el.addEventListener('mouseleave', () => { T.drag = T.panDrag = false; });
    el.addEventListener('wheel',      e  => { T.r = Math.max(4, Math.min(160, T.r + e.deltaY * 0.07)); refreshCamera(); }, { passive: true });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.style.cursor = 'grab';
    el.addEventListener('mousedown', e => { if (e.button===0||e.button===2) el.style.cursor = 'grabbing'; });
    el.addEventListener('mouseup',   () => el.style.cursor = 'grab');

    // ── Hint overlay ─────────────────────────────────────────
    const hint = document.createElement('div');
    hint.style.cssText = 'position:absolute;bottom:10px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.5);color:#aac;padding:4px 12px;border-radius:12px;font-size:10px;pointer-events:none;white-space:nowrap;';
    hint.textContent = 'Left-drag: orbit  ·  Right-drag: pan  ·  Scroll: zoom';
    T.mount.appendChild(hint);

    // Render loop
    (function loop() { requestAnimationFrame(loop); if (T.renderer) T.renderer.render(T.scene, T.camera); })();
  }

  function refreshCamera() {
    if (!T.camera) return;
    const ly = window.layout;
    const cx = (ly ? ly.W/2 : 8) + T.panX;
    const cz = (ly ? ly.H/2 : 8) + T.panZ;
    T.camera.position.set(
      cx + T.r * Math.sin(T.phi) * Math.cos(T.theta),
      T.r * Math.cos(T.phi),
      cz + T.r * Math.sin(T.phi) * Math.sin(T.theta)
    );
    T.camera.lookAt(cx, 0, cz);
  }

  function buildThreeScene() {
    if (!T.scene || !window.layout) return;
    T.objs.forEach(o => T.scene.remove(o)); T.objs = [];

    const ly = window.layout, pos = window.pos;

    // ── Warehouse slab ───────────────────────────────────────
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(ly.W, 0.18, ly.H),
      new THREE.MeshLambertMaterial({ color: 0x1a2b48 })
    );
    slab.position.set(ly.W/2, -0.09, ly.H/2); slab.receiveShadow = true;
    add3(slab);

    // ── Warehouse walls (translucent) ────────────────────────
    const wallMat = new THREE.MeshLambertMaterial({ color: 0x2a4070, transparent:true, opacity:0.28, side: THREE.DoubleSide });
    [
      [ly.W/2,4,  0,       ly.W, 8, 0.25],
      [ly.W/2,4,  ly.H,    ly.W, 8, 0.25],
      [0,     4,  ly.H/2,  0.25, 8, ly.H],
      [ly.W,  4,  ly.H/2,  0.25, 8, ly.H],
    ].forEach(([x,y,z,w,h,d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), wallMat);
      m.position.set(x,y,z); add3(m);
    });

    // ── Corridor floor stripe ────────────────────────────────
    const cW = ly.corrR - ly.corrL;
    const corrFloor = new THREE.Mesh(
      new THREE.BoxGeometry(cW, 0.03, ly.H),
      new THREE.MeshLambertMaterial({ color: 0xfbbf24, transparent:true, opacity:0.12 })
    );
    corrFloor.position.set(ly.corrL + cW/2, 0.02, ly.H/2);
    add3(corrFloor);

    // Chevron arrow stripes in corridor
    for (let z = 1; z < ly.H; z += 2.5) {
      const arrow = new THREE.Mesh(
        new THREE.BoxGeometry(cW*0.55, 0.03, 0.35),
        new THREE.MeshLambertMaterial({ color: 0xfbbf24, transparent:true, opacity:0.5 })
      );
      arrow.position.set(ly.corrL + cW/2, 0.03, z);
      add3(arrow);
    }

    // ── Items ─────────────────────────────────────────────────
    const LEFT_PALETTE  = [0x3b82f6,0x1d4ed8,0x60a5fa,0x2563eb,0x0ea5e9,0x38bdf8,0x0284c7];
    const RIGHT_PALETTE = [0x22c55e,0x16a34a,0x4ade80,0x15803d,0x10b981,0x34d399,0x059669];
    const lSet = new Set((ly.lItems||[]).map(i=>i.id));

    allItems().forEach((it, idx) => {
      const p = pos[it.id]; if (!p) return;
      const { dW, dH } = dd(it);
      const stackHt = sh(it);
      const isSel = window.selId === it.id;
      const palette = lSet.has(it.id) ? LEFT_PALETTE : RIGHT_PALETTE;
      const color   = isSel ? 0xfbbf24 : palette[idx % palette.length];

      // Main box
      const geo = new THREE.BoxGeometry(dW, stackHt, dH);
      const mat = new THREE.MeshLambertMaterial({ color, transparent:true, opacity: isSel ? 1 : 0.88 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(p.x + dW/2, stackHt/2, p.y + dH/2);
      mesh.castShadow = true; mesh.receiveShadow = true;
      add3(mesh);

      // Wireframe edges
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, transparent:true, opacity:0.14 }));
      line.position.copy(mesh.position);
      add3(line);

      // Top highlight plane
      const top = new THREE.Mesh(
        new THREE.PlaneGeometry(dW*0.95, dH*0.95),
        new THREE.MeshLambertMaterial({ color: 0xffffff, transparent:true, opacity: isSel ? 0.25 : 0.1 })
      );
      top.rotation.x = -Math.PI/2; top.position.set(p.x + dW/2, stackHt + 0.002, p.y + dH/2);
      add3(top);

      // Side stripes (horizontal bands on front face for long items)
      if (it.is_long && dH > 1) {
        for (let band = 0; band < Math.min(it.stack, 3); band++) {
          const bandH = stackHt / Math.max(it.stack, 1);
          const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(dW, 0.04, dH * 0.98),
            new THREE.MeshLambertMaterial({ color: 0xffffff, transparent:true, opacity:0.12 })
          );
          stripe.position.set(p.x + dW/2, band * bandH + 0.01, p.y + dH/2);
          add3(stripe);
        }
      }
    });

    // ── Reset camera to fit layout ────────────────────────────
    T.panX = 0; T.panZ = 0;
    T.r = Math.max(ly.W, ly.H) * 1.9;
    refreshCamera();
  }

  function add3(obj) { T.scene.add(obj); T.objs.push(obj); }

  // ═══════════════════════════════════════════════════════════
  // PIXI.JS — Footprint Treemap (GPU WebGL renderer)
  // ═══════════════════════════════════════════════════════════

  const PIX = { app: null, mount: null };

  function initPixi() {
    const wrap = document.querySelector('.cv-wrap');
    PIX.mount = document.createElement('div');
    PIX.mount.id = 'pixi-mount';
    PIX.mount.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;display:none;';
    wrap.appendChild(PIX.mount);

    PIX.app = new PIXI.Application({
      width:  wrap.clientWidth,
      height: wrap.clientHeight,
      backgroundColor: 0xeceff4,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    PIX.app.view.style.cssText = 'width:100%;height:100%;display:block;';
    PIX.mount.appendChild(PIX.app.view);
  }

  function renderPixiFootprint() {
    if (!PIX.app || !window.layout) return;
    PIX.app.stage.removeChildren();

    const its = allItems();
    if (!its.length) {
      const empty = new PIXI.Text('Select a scenario first', { fontSize:14, fill:0x64748b });
      empty.anchor.set(0.5,0.5); empty.x = PIX.app.screen.width/2; empty.y = PIX.app.screen.height/2;
      PIX.app.stage.addChild(empty); return;
    }

    const W = PIX.app.screen.width, H = PIX.app.screen.height;
    const PAD = 14, HEADER = 52;

    // ── Background ──────────────────────────────────────────
    const bg = new PIXI.Graphics();
    bg.beginFill(0xeceff4); bg.drawRect(0,0,W,H); bg.endFill();
    PIX.app.stage.addChild(bg);

    // ── Header ───────────────────────────────────────────────
    const total = its.reduce((s, it) => s + it.sqm, 0);
    const title = new PIXI.Text('Material Footprint Analysis  (PixiJS WebGL)', {
      fontSize: 13, fontWeight:'bold', fill: 0x1e3a5f, fontFamily:'Segoe UI,Arial',
    });
    title.x = PAD; title.y = PAD;
    PIX.app.stage.addChild(title);

    const sub = new PIXI.Text(`${its.length} items · ${total.toFixed(1)} m² total · click to select`, {
      fontSize: 10, fill: 0x64748b, fontFamily:'Segoe UI,Arial',
    });
    sub.x = PAD; sub.y = PAD + 20;
    PIX.app.stage.addChild(sub);

    // ── Treemap layout ───────────────────────────────────────
    const sorted = [...its].sort((a,b) => b.sqm - a.sqm);
    const nodes  = squarify(sorted, PAD, HEADER, W - PAD*2, H - HEADER - PAD);

    nodes.forEach((node, i) => {
      if (!node || node.w < 3 || node.h < 3) return;
      const it    = node.item;
      const isSel = window.selId === it.id;
      const color = cssToHex(zColor(it, i));
      const ip    = 3; // inner padding

      const g = new PIXI.Graphics();

      // Selection glow ring
      if (isSel) {
        g.lineStyle(3, 0xfbbf24, 0.9);
        g.beginFill(0xfbbf24, 0.18);
        g.drawRoundedRect(node.x - 3, node.y - 3, node.w + 6, node.h + 6, 5);
        g.endFill();
      }

      // Main rectangle
      g.beginFill(color, isSel ? 1 : 0.82);
      g.drawRoundedRect(node.x + ip, node.y + ip, node.w - ip*2, node.h - ip*2, 4);
      g.endFill();

      // Subtle inner border
      g.lineStyle(1, 0xffffff, 0.22);
      g.drawRoundedRect(node.x + ip, node.y + ip, node.w - ip*2, node.h - ip*2, 4);

      g.eventMode = 'static';
      g.cursor    = 'pointer';
      g.hitArea   = new PIXI.Rectangle(node.x, node.y, node.w, node.h);

      g.on('pointerover', () => {
        g.clear();
        g.beginFill(color, 1);
        g.drawRoundedRect(node.x+ip, node.y+ip, node.w-ip*2, node.h-ip*2, 4);
        g.endFill();
        g.lineStyle(2, 0xffffff, 0.5);
        g.drawRoundedRect(node.x+ip, node.y+ip, node.w-ip*2, node.h-ip*2, 4);
      });
      g.on('pointerout', () => {
        g.clear();
        if (isSel) { g.lineStyle(3,0xfbbf24,0.9); g.beginFill(0xfbbf24,0.18); g.drawRoundedRect(node.x-3,node.y-3,node.w+6,node.h+6,5); g.endFill(); }
        g.beginFill(color, isSel ? 1 : 0.82);
        g.drawRoundedRect(node.x+ip, node.y+ip, node.w-ip*2, node.h-ip*2, 4);
        g.endFill();
        g.lineStyle(1,0xffffff,0.22); g.drawRoundedRect(node.x+ip, node.y+ip, node.w-ip*2, node.h-ip*2, 4);
      });
      g.on('pointertap', () => {
        if (window.selItem) window.selItem(it.id);
        renderPixiFootprint();
      });

      PIX.app.stage.addChild(g);

      // Label — item name
      if (node.w > 44 && node.h > 26) {
        const fs   = Math.min(11, Math.max(7, node.w * 0.09));
        const lbl  = new PIXI.Text(it.item.length > 16 ? it.item.slice(0,14)+'…' : it.item, {
          fontSize: fs, fontWeight:'bold', fill: 0xffffff, fontFamily:'Segoe UI,Arial',
        });
        lbl.anchor.set(0.5, node.h > 48 ? 0.7 : 0.5);
        lbl.x = node.x + node.w/2; lbl.y = node.y + node.h/2;
        lbl.interactive = false;
        PIX.app.stage.addChild(lbl);
      }

      // Area sub-label
      if (node.w > 60 && node.h > 44) {
        const area = new PIXI.Text(`${it.sqm.toFixed(1)} m²`, {
          fontSize: Math.min(9, node.w*0.07), fill: 0xffffff, fontFamily:'Segoe UI,Arial',
        });
        area.alpha = 0.8;
        area.anchor.set(0.5, 0);
        area.x = node.x + node.w/2; area.y = node.y + node.h/2 + 4;
        PIX.app.stage.addChild(area);
      }
    });
  }

  // ── Squarify treemap (greedy row-based) ───────────────────
  function squarify(items, x, y, w, h) {
    const result = [];
    let rem = [...items], cx = x, cy = y, cw = w, ch = h;

    while (rem.length > 0) {
      const isH     = cw >= ch;
      const stripL  = isH ? ch : cw;
      const stripW  = isH ? cw : ch;
      const remTot  = rem.reduce((s, it) => s + it.sqm, 0);
      const rowItms = [];
      let rowArea   = 0;

      for (let i = 0; i < rem.length; i++) {
        const test    = [...rowItms, rem[i]];
        const testA   = rowArea + rem[i].sqm;
        const rowW    = (testA / remTot) * stripW;
        let worst     = 0;
        test.forEach(ti => {
          const il = (ti.sqm / testA) * stripL;
          worst = Math.max(worst, Math.max(rowW/il, il/rowW));
        });
        if (rowItms.length >= 1 && worst > 3.5) break;
        rowItms.push(rem[i]); rowArea += rem[i].sqm;
        if (rowItms.length >= 7) break;
      }
      rem = rem.slice(rowItms.length);

      const rowW = (rowArea / remTot) * stripW;
      let offset = 0;
      rowItms.forEach(it => {
        const frac = it.sqm / rowArea;
        const itemL = frac * stripL;
        result.push(isH
          ? { item:it, x:cx,         y:cy+offset, w:rowW,  h:itemL }
          : { item:it, x:cx+offset,  y:cy,        w:itemL, h:rowW  }
        );
        offset += itemL;
      });

      if (isH) { cx += rowW; cw -= rowW; } else { cy += rowW; ch -= rowW; }
      if (cw < 2 || ch < 2) break;
    }
    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // RENDERER SWITCHER
  // ═══════════════════════════════════════════════════════════

  function showTab(tab) {
    currentTab = tab;
    const cvs   = document.getElementById('cvs');
    const konva = document.getElementById('konva-mount');
    const three = document.getElementById('three-mount');
    const pixi  = document.getElementById('pixi-mount');

    [cvs, konva, three, pixi].forEach(el => el && (el.style.display = 'none'));

    if (tab === '2d' && konva) {
      konva.style.display = 'block';
      renderKonva();
    } else if (tab === 'three' && three) {
      three.style.display = 'block';
      buildThreeScene();
    } else if (tab === 'fp' && pixi) {
      pixi.style.display = 'block';
      renderPixiFootprint();
    } else if (cvs) {
      // Fallback: original canvas (tl / bd / rpt tabs)
      cvs.style.display = 'block';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // BOOT — hook in after main.js finishes
  // ═══════════════════════════════════════════════════════════

  window.addEventListener('load', function () {
    setTimeout(function () {

      // Init each renderer (fail-safe)
      if (window.Konva)   { try { initKonva(); } catch(e) { console.warn('[Konva] init error:', e); } }
      if (window.THREE)   { try { initThree(); } catch(e) { console.warn('[Three] init error:', e); } }
      if (window.PIXI)    { try { initPixi();  } catch(e) { console.warn('[PixiJS] init error:', e); } }

      // ── Intercept switchTab ────────────────────────────────
      const _origSwitchTab = window.switchTab;
      window.switchTab = function (tab) {
        if (typeof _origSwitchTab === 'function') _origSwitchTab(tab);
        showTab(tab);
      };

      // ── Intercept draw ────────────────────────────────────
      const _origDraw = window.draw;
      window.draw = function () {
        if (currentTab === '2d') {
          K._fitted = false; // allow re-fit when layout changes
          renderKonva();
        } else if (currentTab === 'three') {
          buildThreeScene();
        } else if (currentTab === 'fp') {
          renderPixiFootprint();
        } else {
          // Original canvas for tl / bd / rpt
          const cvs = document.getElementById('cvs');
          if (cvs) cvs.style.display = 'block';
          if (typeof _origDraw === 'function') _origDraw();
        }
      };

      // Start on 2D
      showTab('2d');

    }, 250);
  });

})();
