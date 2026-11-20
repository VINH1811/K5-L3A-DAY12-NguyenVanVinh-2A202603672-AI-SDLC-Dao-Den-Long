// Thế giới Đảo Bến: trời đêm, biển mây, đảo, cỏ, đạo cụ. Chỉ để hiển thị.
import * as THREE from 'three';
import { makeRng } from '../sim/rng.js';
import { NIGHT1, C } from '../sim/config.js';

export const PAL = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lanternLit: 0xffb347, lanternCore: 0xffe9b0, lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a, shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450,
  shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e,
};

export function softTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner);
  grd.addColorStop(0.35, inner.replace(/[\d.]+\)$/, '0.55)'));
  grd.addColorStop(1, outer);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture(seed) {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const rng = makeRng(seed);
  for (let i = 0; i < 26; i++) {
    const x = size / 2 + rng.range(-70, 70), y = size / 2 + rng.range(-30, 30);
    const r = rng.range(30, 70);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.22)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const NOISE_GLSL = /* glsl */ `
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p=p*2.03+vec2(17.0,9.0); a*=0.5; } return v; }
`;

export function buildWorld(scene) {
  const rng = makeRng(2026);
  const uniforms = { uTime: { value: 0 }, uProgress: { value: 0 } };
  const updaters = [];

  scene.fog = new THREE.FogExp2(PAL.fog, 0.0105);
  scene.background = new THREE.Color(PAL.sky);

  // ---- bầu trời
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform float uProgress; varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 top = vec3(0.035,0.05,0.13);
          vec3 mid = vec3(0.055,0.078,0.19);
          vec3 hor = vec3(0.106,0.137,0.314);
          vec3 col = mix(hor, mid, smoothstep(-0.05,0.25,h));
          col = mix(col, top, smoothstep(0.25,0.9,h));
          // dải sáng ấm ở chân trời tăng theo số đèn thắp
          float warm = exp(-abs(h+0.02)*14.0);
          col += vec3(1.0,0.55,0.2) * warm * (0.05 + 0.22*uProgress);
          // mây mỏng trên trời
          vec2 q = vP.xz/(h+0.35)*1.6;
          float cl = fbm(q + vec2(uTime*0.004, uTime*0.002));
          col = mix(col, vec3(0.16,0.19,0.36), smoothstep(0.55,0.85,cl)*smoothstep(0.0,0.3,h)*0.55);
          // trăng mờ
          vec3 md = normalize(vec3(-0.45,0.42,-0.78));
          float m = max(dot(vP, md),0.0);
          col += vec3(0.85,0.82,1.0)*smoothstep(0.9993,0.9996,m)*0.9;
          col += vec3(0.4,0.42,0.75)*pow(m,180.0)*0.55 + vec3(0.2,0.22,0.5)*pow(m,18.0)*0.12;
          gl_FragColor = vec4(col,1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  // ---- sao
  {
    const n = 2200, pos = new Float32Array(n * 3), seed = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const u = rng.next(), v = rng.range(0.08, 1);
      const th = u * Math.PI * 2, y = v, r = Math.sqrt(1 - y * y);
      pos.set([r * Math.cos(th) * 800, y * 800, r * Math.sin(th) * 800], i * 3);
      seed[i] = rng.next();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const stars = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSeed; uniform float uTime; varying float vA;
        void main(){ vA = (0.35+0.65*aSeed) * (0.6+0.4*sin(uTime*(0.8+aSeed*2.5)+aSeed*60.0));
          vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = 1.2 + aSeed*aSeed*2.6; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA;
        gl_FragColor = vec4(vec3(0.85,0.88,1.0)*a, a); }`,
    }));
    scene.add(stars);
  }

  // ---- biển mây
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1600, 1600, 1, 1),
    new THREE.ShaderMaterial({
      uniforms, transparent: false, fog: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform float uProgress; varying vec3 vW;
        void main(){
          vec2 p = vW.xz*0.018;
          float n = fbm(p + vec2(uTime*0.012, uTime*0.007));
          float n2 = fbm(p*2.7 - vec2(uTime*0.02, -uTime*0.011));
          float c = n*0.65 + n2*0.35;
          vec3 deep = vec3(0.03,0.11,0.16);
          vec3 base = vec3(0.071,0.22,0.29);
          vec3 hi = vec3(0.32,0.45,0.62);
          vec3 col = mix(deep, base, smoothstep(0.25,0.6,c));
          col = mix(col, hi, smoothstep(0.62,0.85,c)*0.55);
          // ánh đèn của đảo hắt xuống biển mây
          float d = length(vW.xz);
          col += vec3(1.0,0.6,0.25) * exp(-d*0.03) * (0.06 + 0.35*uProgress) * (0.6+0.4*c);
          float fogF = 1.0 - exp(-pow(d*0.0042, 1.6));
          col = mix(col, vec3(0.106,0.137,0.314), clamp(fogF,0.0,1.0));
          gl_FragColor = vec4(col,1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -14;
  scene.add(sea);

  // ---- cụm mây bồng bềnh quanh đảo
  const puffs = new THREE.Group();
  const puffTex = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
  for (let i = 0; i < 70; i++) {
    const m = new THREE.SpriteMaterial({ map: puffTex[i % 3], color: new THREE.Color().setHSL(0.6, 0.35, rng.range(0.32, 0.55)), transparent: true, opacity: rng.range(0.35, 0.7), depthWrite: false, fog: true });
    const sp = new THREE.Sprite(m);
    const a = rng.range(0, Math.PI * 2), r = rng.range(46, 160);
    const s = rng.range(18, 46);
    sp.scale.set(s * 1.8, s * 0.8, 1);
    sp.position.set(Math.cos(a) * r, rng.range(-13, -3), Math.sin(a) * r);
    sp.userData = { a, r, speed: rng.range(0.004, 0.012) * (rng.next() < 0.5 ? 1 : -1), y: sp.position.y, ph: rng.range(0, 6) };
    puffs.add(sp);
  }
  scene.add(puffs);
  updaters.push((t) => {
    for (const sp of puffs.children) {
      const u = sp.userData;
      const a = u.a + t * u.speed;
      sp.position.x = Math.cos(a) * u.r; sp.position.z = Math.sin(a) * u.r;
      sp.position.y = u.y + Math.sin(t * 0.2 + u.ph) * 0.6;
    }
  });

  // ---- đảo: mặt cỏ
  const R = C.island_radius;
  // thêm phân đoạn bán kính để tô màu mịn hơn
  const top = new THREE.Mesh(subdivideDisc(R + 0.6), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  scene.add(top);

  // ---- vách đá dưới đảo
  {
    const pts = [];
    const prof = [[R + 0.6, 0], [R + 0.9, -0.6], [R + 0.2, -2.5], [R - 2, -5], [R - 6, -9], [R - 12, -14], [R - 20, -20], [R - 28, -27], [R - 34, -34], [0, -42]];
    for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
    const g = new THREE.LatheGeometry(pts, 96);
    const p = g.attributes.position, col = [];
    const rockA = new THREE.Color(0x3b2f35), rockB = new THREE.Color(0x5d4a44), moss = new THREE.Color(0x24463d), c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const a = Math.atan2(z, x);
      const n = Math.sin(a * 13 + y * 0.7) * 0.5 + Math.sin(a * 29 - y * 1.3) * 0.3 + Math.sin(a * 5) * 0.4;
      if (y < -0.7) {
        const k = 1 + n * 0.06;
        p.setX(i, x * k); p.setZ(i, z * k); p.setY(i, y + n * 0.8);
      }
      c.copy(rockA).lerp(rockB, 0.5 + 0.5 * Math.sin(y * 1.7 + n * 3));
      if (y > -3.5) c.lerp(moss, 0.55);
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    const cliff = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }));
    scene.add(cliff);
  }

  // ---- cỏ (instanced, lay động theo gió)
  const avoid = [...NIGHT1.lanterns.map((l) => [l.pos[0], l.pos[2], 2.2]), [0, 0, 2.5]];
  {
    const blade = new THREE.PlaneGeometry(0.08, 0.42, 1, 3);
    blade.translate(0, 0.21, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y / 0.6)); }
    const mat = new THREE.MeshLambertMaterial({ color: 0x4f9478, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.vertexShader = 'uniform float uTime;\nvarying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        float h = position.y / 0.55; vH = h;
        float w = sin(uTime*1.6 + ip.x*0.35 + ip.z*0.22) * 0.5 + sin(uTime*2.7 + ip.x*0.9) * 0.18;
        transformed.x += w * h * h * 0.22; transformed.z += w * h * h * 0.12;`);
      sh.fragmentShader = 'varying float vH;\n' + sh.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= mix(0.62, 1.2, vH);`);
    };
    const N = 16000;
    const grass = new THREE.InstancedMesh(blade, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    let k = 0;
    while (k < N) {
      const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * (R - 3.2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (avoid.some(([ax, az, ar]) => Math.hypot(x - ax, z - az) < ar)) continue;
      e.set(0, rng.range(0, Math.PI), rng.range(-0.15, 0.15));
      q.setFromEuler(e);
      const s = rng.range(0.55, 1.2);
      sc.set(s, s * rng.range(0.7, 1.3), s);
      ps.set(x, 0, z);
      m.compose(ps, q, sc);
      grass.setMatrixAt(k++, m);
    }
    scene.add(grass);
  }

  // ---- lối đá dẫn tới các đèn
  {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 1, flatShading: true });
    const g = new THREE.CylinderGeometry(0.45, 0.5, 0.1, 7);
    for (const l of NIGHT1.lanterns) {
      const len = Math.hypot(l.pos[0], l.pos[2]);
      for (let d = 3.2; d < len - 2.3; d += 1.25) {
        const st = new THREE.Mesh(g, stoneMat);
        const t = d / len, jitter = rng.range(-0.3, 0.3);
        st.position.set(l.pos[0] * t + (-l.pos[2] / len) * jitter, 0.03, l.pos[2] * t + (l.pos[0] / len) * jitter);
        st.rotation.y = rng.range(0, 3);
        st.scale.setScalar(rng.range(0.75, 1.1));
        scene.add(st);
      }
    }
    // đài đá trung tâm (điểm xuất phát)
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.12, 40), new THREE.MeshStandardMaterial({ color: 0x9b8f7f, roughness: 0.9 }));
    plaza.position.y = 0.0;
    scene.add(plaza);
    const inlay = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 48), new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.15, roughness: 0.5, metalness: 0.4 }));
    inlay.rotation.x = -Math.PI / 2; inlay.position.y = 0.065;
    scene.add(inlay);
  }

  // ---- cây, bụi, đá, tre
  const trunkMat = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 1 });
  const leafMats = [0x2f6656, 0x3a7562, 0x285a4b].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x6f6873, roughness: 1, flatShading: true });
  const blocked = (x, z, pad) => {
    if (Math.hypot(x, z) < 6) return true;
    if (NIGHT1.lanterns.some((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) < 4.5 + pad)) return true;
    if (NIGHT1.moteSpots.some((p) => Math.hypot(x - p[0], z - p[2]) < 2 + pad)) return true;
    // không chắn lối đi
    for (const l of NIGHT1.lanterns) {
      const len = Math.hypot(l.pos[0], l.pos[2]);
      const t = (x * l.pos[0] + z * l.pos[2]) / (len * len);
      if (t > 0 && t < 1 && Math.abs(x * l.pos[2] - z * l.pos[0]) / len < 2.2) return true;
    }
    return false;
  };
  const place = (count, rMin, rMax, pad, make) => {
    let tries = 0;
    for (let i = 0; i < count && tries < 4000; tries++) {
      const a = rng.range(0, Math.PI * 2), r = rng.range(rMin, rMax);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (blocked(x, z, pad)) continue;
      const o = make();
      o.position.set(x, 0, z);
      o.rotation.y = rng.range(0, Math.PI * 2);
      scene.add(o);
      i++;
    }
  };
  // cây thông tròn kiểu cổ tích
  place(26, 14, 37, 1.5, () => {
    const g = new THREE.Group();
    const h = rng.range(2.2, 4.2);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h * 0.5, 6), trunkMat);
    trunk.position.y = h * 0.25; g.add(trunk);
    const tiers = 3;
    for (let k = 0; k < tiers; k++) {
      const rr = (1.5 - k * 0.35) * (h / 3.2);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rr, h * 0.55, 7), leafMats[k % 3]);
      cone.position.y = h * 0.45 + k * h * 0.28;
      g.add(cone);
    }
    g.scale.setScalar(rng.range(0.85, 1.25));
    return g;
  });
  // bụi tròn
  place(40, 7, 38, 0.6, () => {
    const g = new THREE.Group();
    const n = 2 + rng.int(3);
    for (let k = 0; k < n; k++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(0.45, 0.85), 0), leafMats[rng.int(3)]);
      b.position.set(rng.range(-0.6, 0.6), rng.range(0.25, 0.5), rng.range(-0.6, 0.6));
      b.scale.y = 0.75;
      g.add(b);
    }
    return g;
  });
  // đá
  place(30, 6, 39, 0.4, () => {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(0.3, 0.9), 0), rockMat);
    r.scale.set(1, rng.range(0.4, 0.8), rng.range(0.8, 1.3));
    r.position.y = 0.1;
    const g = new THREE.Group(); g.add(r); return g;
  });
  // khóm tre
  {
    const bambooMat = new THREE.MeshStandardMaterial({ color: 0x5f8a4a, roughness: 0.8 });
    place(7, 20, 36, 1.2, () => {
      const g = new THREE.Group();
      for (let k = 0; k < 7; k++) {
        const h = rng.range(3.5, 6);
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, h, 5), bambooMat);
        st.position.set(rng.range(-0.6, 0.6), h / 2, rng.range(-0.6, 0.6));
        st.rotation.z = rng.range(-0.12, 0.12);
        g.add(st);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 5), leafMats[1]);
        leaf.position.set(st.position.x, h, st.position.z);
        g.add(leaf);
      }
      return g;
    });
  }

  // ---- bến gỗ (Đảo Bến) và con thuyền nhỏ
  {
    const plankMat = new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.95 });
    const dock = new THREE.Group();
    const angle = -Math.PI / 2 - 0.5; // hướng ra biển mây, tránh các đèn
    for (let d = 0; d < 12; d++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.82), plankMat);
      p.position.set(0, -0.05 - d * 0.02, d * 0.9);
      p.rotation.y = rng.range(-0.03, 0.03);
      dock.add(p);
      if (d % 3 === 0) for (const sx of [-1.6, 1.6]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4, 6), trunkMat);
        post.position.set(sx, -1.6, d * 0.9);
        dock.add(post);
      }
    }
    // thuyền
    const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 4.2, 10, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a3e28, side: THREE.DoubleSide, roughness: 0.9 }));
    hull.rotation.set(Math.PI / 2, 0, Math.PI);
    hull.position.set(2.6, -0.9, 7.5);
    dock.add(hull);
    dock.position.set(Math.cos(angle) * 39.2, 0, Math.sin(angle) * 39.2);
    dock.rotation.y = -angle + Math.PI / 2;
    updaters.push((t) => { hull.position.y = -0.95 + Math.sin(t * 0.9) * 0.08; hull.rotation.z = Math.PI + Math.sin(t * 0.7) * 0.05; });
    scene.add(dock);
  }

  // ---- sương đen (tan dần khi đảo sáng lên)
  const mist = new THREE.Group();
  {
    const tex = softTexture('rgba(255,255,255,0.9)');
    for (let i = 0; i < 46; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0x1a0f2e), transparent: true, opacity: 0.55, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const a = rng.range(0, Math.PI * 2), r = rng.range(8, 44);
      const s = rng.range(9, 18);
      sp.scale.set(s, s * 0.4, 1);
      sp.position.set(Math.cos(a) * r, rng.range(0.4, 1.6), Math.sin(a) * r);
      sp.userData = { a, r, sp: rng.range(0.01, 0.03), ph: rng.range(0, 6), base: rng.range(0.35, 0.6) };
      mist.add(sp);
    }
  }
  scene.add(mist);
  updaters.push((t, progress) => {
    for (const sp of mist.children) {
      const u = sp.userData, a = u.a + t * u.sp;
      sp.position.x = Math.cos(a) * u.r; sp.position.z = Math.sin(a) * u.r;
      sp.material.opacity = u.base * (1 - progress * 0.85) * (0.75 + 0.25 * Math.sin(t * 0.4 + u.ph));
    }
  });

  // ---- ánh sáng
  const hemi = new THREE.HemisphereLight(0x7d8ee0, 0x2a2440, 0.5);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x9aa6ff, 0.75);
  moon.position.set(-40, 60, -70);
  scene.add(moon);
  const warmFill = new THREE.DirectionalLight(0xffb070, 0.0);
  warmFill.position.set(30, 40, 50);
  scene.add(warmFill);

  const fogDark = new THREE.Color(PAL.fog), fogWarm = new THREE.Color(0x2c2a52);
  function update(t, progress) {
    uniforms.uTime.value = t;
    uniforms.uProgress.value += (progress - uniforms.uProgress.value) * 0.03;
    const p = uniforms.uProgress.value;
    // Ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn)
    hemi.intensity = (0.15 + 0.55 * p) * 3.4;
    moon.intensity = 0.75 + 0.35 * p;
    warmFill.intensity = 0.55 * p;
    scene.fog.color.copy(fogDark).lerp(fogWarm, p);
    scene.fog.density = 0.0105 - 0.004 * p;
    for (const u of updaters) u(t, p);
  }

  return { update, uniforms };
}

// Đĩa với nhiều vòng đồng tâm để tô màu theo bán kính mượt.
function subdivideDisc(R) {
  const rings = 40, seg = 160;
  const pos = [], col = [], idx = [];
  const grass = new THREE.Color(PAL.grass), sand = new THREE.Color(PAL.sand), dark = new THREE.Color(0x1d3d37), lite = new THREE.Color(0x3d7563), c = new THREE.Color();
  pos.push(0, 0, 0); c.copy(grass); col.push(c.r, c.g, c.b);
  for (let i = 1; i <= rings; i++) {
    const r = (i / rings) * R;
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, 0, z);
      const n = Math.sin(x * 0.19 + 1.3) * Math.cos(z * 0.16) * 0.5 + Math.sin(x * 0.06 + z * 0.09) * 0.5;
      c.copy(grass).lerp(n > 0 ? lite : dark, Math.abs(n) * 0.6);
      c.lerp(sand, THREE.MathUtils.smoothstep(r, R - 4, R - 1.4));
      col.push(c.r, c.g, c.b);
    }
  }
  for (let j = 0; j < seg; j++) idx.push(0, 1 + ((j + 1) % seg), 1 + j);
  for (let i = 1; i < rings; i++) {
    const a0 = 1 + (i - 1) * seg, a1 = 1 + i * seg;
    for (let j = 0; j < seg; j++) {
      const j1 = (j + 1) % seg;
      idx.push(a0 + j, a0 + j1, a1 + j, a0 + j1, a1 + j1, a1 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
