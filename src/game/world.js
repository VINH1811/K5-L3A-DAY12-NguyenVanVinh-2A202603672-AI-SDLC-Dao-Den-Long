// Thế giới: bầu trời ngày/đêm, biển mây, đảo lơ lửng trên mây, và hòn đảo của từng Đêm.
// Chỉ để hiển thị: đọc bản đồ chuẩn trong sim/config.js, không đổi luật.
import * as THREE from 'three';
import { makeRng } from '../sim/rng.js';
import { C } from '../sim/config.js';

export const PAL = {
  sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a,
  lanternLit: 0xffb347, lanternCore: 0xffe9b0, lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2, moteHalo: 0xffe58a, shade: 0x120a1a, shadeRim: 0x7a3cff, shadeStun: 0x3a3450,
  shirt: 0xe8e2d0, scarf: 0xc8102e, gold: 0xf2c14e, drifter: 0x8fa3b8, danger: 0xff5a5f,
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

const MOON_DIR = new THREE.Vector3(-0.45, 0.42, -0.78).normalize();

export function buildWorld(scene, renderer) {
  const rng = makeRng(2026);
  const uniforms = {
    uTime: { value: 0 }, uProgress: { value: 0 }, uDay: { value: 0 },
    uSun: { value: new THREE.Vector3(0.6, -0.05, 0.8).normalize() }, uCenter: { value: new THREE.Vector2(0, 0) },
  };
  const updaters = [];

  scene.fog = new THREE.FogExp2(PAL.fog, 0.0105);
  scene.background = new THREE.Color(PAL.sky);

  // ---- bầu trời: đêm (trăng, mây mỏng) ↔ ngày (mặt trời, bình minh)
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(900, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms,
      vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform float uProgress; uniform float uDay; uniform vec3 uSun; varying vec3 vP;
        void main(){
          float h = vP.y;
          vec3 night = mix(vec3(0.106,0.137,0.314), vec3(0.055,0.078,0.19), smoothstep(-0.05,0.25,h));
          night = mix(night, vec3(0.035,0.05,0.13), smoothstep(0.25,0.9,h));
          night += vec3(1.0,0.55,0.2) * exp(-abs(h+0.02)*14.0) * (0.05 + 0.22*uProgress);
          vec2 q = vP.xz/(h+0.35)*1.6;
          float cl = fbm(q + vec2(uTime*0.004, uTime*0.002));
          night = mix(night, vec3(0.16,0.19,0.36), smoothstep(0.55,0.85,cl)*smoothstep(0.0,0.3,h)*0.55);
          vec3 md = normalize(vec3(-0.45,0.42,-0.78));
          float m = max(dot(vP, md),0.0);
          night += vec3(0.85,0.82,1.0)*smoothstep(0.9993,0.9996,m)*0.9;
          night += vec3(0.4,0.42,0.75)*pow(m,180.0)*0.55 + vec3(0.2,0.22,0.5)*pow(m,18.0)*0.12;

          float sd = max(dot(vP, uSun), 0.0);
          vec3 day = mix(vec3(0.72,0.82,0.93), vec3(0.20,0.42,0.80), smoothstep(-0.02,0.6,h));
          float dcl = fbm(q*0.8 + vec2(uTime*0.006, uTime*0.003));
          day = mix(day, vec3(1.0,0.98,0.96), smoothstep(0.5,0.8,dcl)*smoothstep(0.0,0.35,h)*0.75);
          float dawn = sin(clamp(uDay,0.0,1.0)*3.14159);
          vec3 col = mix(night, day, smoothstep(0.2,0.9,uDay));
          col += vec3(1.0,0.48,0.22) * exp(-abs(h+0.01)*7.0) * dawn * 0.6 * (0.35 + 0.65*pow(sd,3.0));
          col += vec3(1.0,0.35,0.45) * exp(-abs(h-0.12)*9.0) * dawn * 0.12;
          float sunOn = smoothstep(0.0,0.25,uDay);
          col += vec3(1.0,0.93,0.78)*smoothstep(0.9988,0.9994,sd)*2.2*sunOn;
          col += vec3(1.0,0.72,0.45)*pow(sd,80.0)*0.7*sunOn + vec3(1.0,0.8,0.6)*pow(sd,6.0)*0.18*sunOn;
          gl_FragColor = vec4(col,1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  scene.add(sky);

  // ---- sao (tắt dần khi trời sáng)
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
    scene.add(new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSeed; uniform float uTime; uniform float uDay; varying float vA;
        void main(){ vA = (1.0-uDay) * (0.35+0.65*aSeed) * (0.6+0.4*sin(uTime*(0.8+aSeed*2.5)+aSeed*60.0));
          vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = 1.2 + aSeed*aSeed*2.6; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA;
        gl_FragColor = vec4(vec3(0.85,0.88,1.0)*a, a); }`,
    })));
  }

  // ---- biển mây
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2400, 2400, 1, 1),
    new THREE.ShaderMaterial({
      uniforms, fog: false,
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `${NOISE_GLSL}
        uniform float uTime; uniform float uProgress; uniform float uDay; uniform vec3 uSun; uniform vec2 uCenter; varying vec3 vW;
        void main(){
          vec2 p = vW.xz*0.018;
          float n = fbm(p + vec2(uTime*0.012, uTime*0.007));
          float n2 = fbm(p*2.7 - vec2(uTime*0.02, -uTime*0.011));
          float c = n*0.65 + n2*0.35;
          vec3 nCol = mix(vec3(0.03,0.11,0.16), vec3(0.071,0.22,0.29), smoothstep(0.25,0.6,c));
          nCol = mix(nCol, vec3(0.32,0.45,0.62), smoothstep(0.62,0.85,c)*0.55);
          vec3 dCol = mix(vec3(0.52,0.62,0.78), vec3(0.86,0.9,0.96), smoothstep(0.3,0.62,c));
          dCol = mix(dCol, vec3(1.0,1.0,1.0), smoothstep(0.6,0.85,c)*0.8);
          float dawn = sin(clamp(uDay,0.0,1.0)*3.14159);
          dCol = mix(dCol, dCol*vec3(1.15,0.85,0.75), dawn*0.5);
          vec3 col = mix(nCol, dCol, smoothstep(0.15,0.85,uDay));
          float d = length(vW.xz - uCenter);
          col += vec3(1.0,0.6,0.25) * exp(-d*0.03) * (0.06 + 0.35*uProgress) * (0.6+0.4*c) * (1.0-uDay);
          float fogF = clamp(1.0 - exp(-pow(d*0.0036, 1.6)), 0.0, 1.0);
          vec3 hor = mix(vec3(0.106,0.137,0.314), vec3(0.74,0.83,0.93), smoothstep(0.2,0.9,uDay));
          hor += vec3(0.5,0.22,0.1)*dawn*0.5;
          col = mix(col, hor, fogF);
          gl_FragColor = vec4(col,1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -14;
  scene.add(sea);

  // ---- cụm mây bồng bềnh
  const puffs = new THREE.Group();
  const puffTex = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
  for (let i = 0; i < 90; i++) {
    const l = rng.range(0.32, 0.55);
    const m = new THREE.SpriteMaterial({ map: puffTex[i % 3], color: new THREE.Color().setHSL(0.6, 0.35, l), transparent: true, opacity: rng.range(0.35, 0.7), depthWrite: false, fog: true });
    const sp = new THREE.Sprite(m);
    const a = rng.range(0, Math.PI * 2), r = rng.range(60, 220);
    const s = rng.range(18, 50);
    sp.scale.set(s * 1.8, s * 0.8, 1);
    const high = i % 6 === 0;
    sp.position.set(Math.cos(a) * r, high ? rng.range(25, 70) : rng.range(-13, -3), Math.sin(a) * r);
    sp.userData = { a, r, speed: rng.range(0.004, 0.012) * (rng.next() < 0.5 ? 1 : -1), y: sp.position.y, ph: rng.range(0, 6), l };
    puffs.add(sp);
  }
  scene.add(puffs);
  const puffNight = new THREE.Color(), puffDay = new THREE.Color();
  updaters.push((t, p, day) => {
    const cx = uniforms.uCenter.value.x, cz = uniforms.uCenter.value.y;
    for (const sp of puffs.children) {
      const u = sp.userData;
      const a = u.a + t * u.speed;
      sp.position.x = cx + Math.cos(a) * u.r; sp.position.z = cz + Math.sin(a) * u.r;
      sp.position.y = u.y + Math.sin(t * 0.2 + u.ph) * 0.6;
      puffNight.setHSL(0.6, 0.35, u.l); puffDay.setHSL(0.08, 0.5, 0.8 + u.l * 0.3);
      sp.material.color.copy(puffNight).lerp(puffDay, day);
    }
  });

  // ---- đảo lơ lửng trên mây (trang trí, ngoài vùng chơi)
  const skyIslands = buildSkyIslands(rng, uniforms);
  scene.add(skyIslands.group);
  updaters.push(skyIslands.update);

  // ---- đèn trời bay lên (đêm)
  const skyLanterns = new THREE.Group();
  {
    const tex = softTexture('rgba(255,200,120,1)');
    for (let i = 0; i < 60; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffa94d, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.scale.setScalar(rng.range(1.2, 2.4));
      sp.userData = { a: rng.range(0, Math.PI * 2), r: rng.range(70, 200), ph: rng.next(), sp: rng.range(0.6, 1.4) };
      skyLanterns.add(sp);
    }
  }
  scene.add(skyLanterns);
  updaters.push((t, p, day) => {
    const cx = uniforms.uCenter.value.x, cz = uniforms.uCenter.value.y;
    for (const sp of skyLanterns.children) {
      const u = sp.userData;
      const k = (t * 0.012 * u.sp + u.ph) % 1;
      sp.position.set(cx + Math.cos(u.a + k * 0.4) * u.r, -8 + k * 120, cz + Math.sin(u.a + k * 0.4) * u.r);
      sp.material.opacity = (1 - day) * (0.25 + 0.6 * p) * Math.sin(k * Math.PI) * (0.8 + 0.2 * Math.sin(t * 6 + u.a * 9));
    }
  });

  // ---- hòn đảo của Đêm hiện tại
  const islandRoot = new THREE.Group();
  scene.add(islandRoot);
  let island = null;
  function setNight(map) {
    if (island) { disposeTree(island.group); islandRoot.remove(island.group); }
    island = buildIsland(map, uniforms);
    islandRoot.add(island.group);
    const xs = map.islands.map((i) => i.c[0]);
    uniforms.uCenter.value.set((Math.min(...xs) + Math.max(...xs)) / 2, 0);
    skyIslands.recenter(uniforms.uCenter.value);
  }

  // ---- ánh sáng: một nguồn chính đổi từ trăng sang mặt trời, có đổ bóng
  const hemi = new THREE.HemisphereLight(0x7d8ee0, 0x2a2440, 0.5);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0x9aa6ff, 0.75);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -32; sc.right = 32; sc.top = 32; sc.bottom = -32; sc.near = 1; sc.far = 220;
  key.shadow.bias = -0.0006; key.shadow.normalBias = 0.04;
  scene.add(key, key.target);
  const warmFill = new THREE.DirectionalLight(0xffb070, 0.0);
  warmFill.position.set(30, 40, 50);
  scene.add(warmFill);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const fogNight = new THREE.Color(PAL.fog), fogWarm = new THREE.Color(0x2c2a52), fogDay = new THREE.Color(0x9fbcdc), fogDawn = new THREE.Color(0xe0a88a);
  const moonCol = new THREE.Color(0x9aa6ff), sunCol = new THREE.Color(0xfff0d8), dawnCol = new THREE.Color(0xffa060);
  const hemiSkyN = new THREE.Color(0x7d8ee0), hemiSkyD = new THREE.Color(0xcfe3ff), hemiGndN = new THREE.Color(0x2a2440), hemiGndD = new THREE.Color(0x6f7a52);
  const tmp = new THREE.Vector3(), focus = new THREE.Vector3();
  let progress = 0, day = 0;

  // t: giây; p: tỉ lệ đèn sáng; dayTarget: 0 đêm → 1 ngày; at: điểm camera nhìn (để bóng đổ đi theo)
  function update(t, p, dayTarget, at) {
    uniforms.uTime.value = t;
    progress += (p - progress) * 0.03;
    day += (dayTarget - day) * 0.02;
    if (Math.abs(dayTarget - day) < 1e-3) day = dayTarget;
    uniforms.uProgress.value = progress;
    uniforms.uDay.value = day;
    const dawn = Math.sin(Math.min(1, Math.max(0, day)) * Math.PI);
    // mặt trời mọc từ chân trời phía đông
    uniforms.uSun.value.set(0.62, -0.06 + 0.62 * day, 0.75).normalize();
    // ánh sáng môi trường = 0.15 + 0.55 × (đèn sáng / tổng đèn) ban đêm; ban ngày sáng hẳn
    hemi.intensity = THREE.MathUtils.lerp((0.15 + 0.55 * progress) * 3.4, 1.5, day);
    hemi.color.copy(hemiSkyN).lerp(hemiSkyD, day);
    hemi.groundColor.copy(hemiGndN).lerp(hemiGndD, day);
    const dirv = day > 0.3 ? uniforms.uSun.value : MOON_DIR;
    focus.copy(at);
    key.target.position.copy(focus);
    key.position.copy(focus).add(tmp.copy(dirv).multiplyScalar(120));
    if (day > 0.3) key.position.y = Math.max(key.position.y, focus.y + 25);
    key.color.copy(moonCol).lerp(dawnCol, Math.min(1, day * 2)).lerp(sunCol, Math.max(0, day * 2 - 1));
    key.intensity = THREE.MathUtils.lerp(0.75 + 0.35 * progress, 2.1, day);
    warmFill.intensity = 0.55 * progress * (1 - day) + 0.4 * dawn;
    scene.fog.color.copy(fogNight).lerp(fogWarm, progress * (1 - day)).lerp(fogDay, Math.max(0, day * 1.4 - 0.4)).lerp(fogDawn, dawn * 0.35);
    scene.fog.density = THREE.MathUtils.lerp(0.0105 - 0.004 * progress, 0.0021, day);
    for (const u of updaters) u(t, progress, day);
    if (island) island.update(t, progress, day);
  }

  // Cảnh benchmark tắt phần trang trí sáng tạo thêm (đảo bay, đèn trời) để mọi bài đo trên cùng cảnh chuẩn.
  function setCreative(on) { skyIslands.group.visible = on; skyLanterns.visible = on; }
  return { update, setNight, setCreative, uniforms, get day() { return day; }, setDayNow(v) { day = v; } };
}

// ======================================================================
// Hòn đảo của từng Đêm
// ======================================================================
// Mỗi đảo một vùng khí hậu: màu đất, màu cỏ, mật độ cỏ, loại cây.
const BIOMES = {
  1: { name: 'đồng cỏ', grass: 0x2f5d50, lite: 0x3d7563, dark: 0x1d3d37, sand: PAL.sand, sandBand: 4, blade: 0x4f9478, blades: 16000, flora: 'meadow' },
  2: { name: 'nhiệt đới', grass: 0x3f6b33, lite: 0x5e8a3c, dark: 0x2c4f2a, sand: 0xe0c98f, sandBand: 9, blade: 0x7aa04a, blades: 12000, flora: 'tropic' },
  3: { name: 'núi thu', grass: 0x5b5432, lite: 0x7a6a3a, dark: 0x3f3a26, sand: 0x9b8f7f, sandBand: 3, blade: 0xb0743a, blades: 15000, flora: 'autumn' },
  4: { name: 'băng tuyết', grass: 0xd9e4ee, lite: 0xf2f7fc, dark: 0xb3c4d6, sand: 0xa9c4dc, sandBand: 3, blade: 0xe6eef6, blades: 5000, flora: 'snow' },
  5: { name: 'đất mực', grass: 0x2a1d36, lite: 0x3e2752, dark: 0x170f20, sand: 0x4a2f5c, sandBand: 2.5, blade: 0x5a3a7a, blades: 9000, flora: 'corrupt' },
};

function buildIsland(map, uniforms) {
  const biome = BIOMES[map.night] ?? BIOMES[1];
  const group = new THREE.Group();
  const updaters = [];
  const rng = makeRng(1000 + map.night * 17);
  const G = (x, z) => map.ground(x, z);
  const mats = commonMats();

  // ----- tránh đặt cây/đá lên lối đi và chỗ chơi
  const paths = []; // [x0,z0,x1,z1,width]
  for (const l of map.lanterns) {
    const isl = nearestIsland(map, l.pos[0], l.pos[2]);
    if (isl.hole) continue;
    let sx = isl.c[0], sz = isl.c[1];
    if (Math.hypot(l.pos[0] - sx, l.pos[2] - sz) < 3) continue;
    if (map.night === 3) {
      if (l.pos[1] > 0) continue;
      const d = Math.hypot(l.pos[0], l.pos[2]);
      sx = (l.pos[0] / d) * 9.5; sz = (l.pos[2] / d) * 9.5;
    }
    paths.push([sx, sz, l.pos[0], l.pos[2], 2.2]);
  }
  if (map.night === 3) paths.push([map.start[0], map.start[2], 0, -9.5, 2.2]);
  const segDist = (x, z, [x0, z0, x1, z1]) => {
    const dx = x1 - x0, dz = z1 - z0, L2 = dx * dx + dz * dz;
    const k = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / L2));
    return Math.hypot(x - (x0 + dx * k), z - (z0 + dz * k));
  };
  const edgeDist = (x, z) => Math.max(...map.islands.map((i) => { const d = Math.hypot(x - i.c[0], z - i.c[1]); return i.hole ? Math.min(i.r - d, d - i.hole) : i.r - d; }));
  const isFlat = (x, z) => { const g = G(x, z); return g !== null && Number.isInteger(g) && g < 10; };
  const nearTierEdge = (x, z) => {
    if (map.night !== 3) return false;
    const r = Math.hypot(x, z);
    return r < 10 || (z > -1.2 && (Math.abs(r - 12) < 1.4 || Math.abs(r - 24) < 1.4)) || map.ramps.some((rp) => {
      const along = x * rp.dir[0] + z * rp.dir[1], perp = Math.abs(-x * rp.dir[1] + z * rp.dir[0]);
      return perp < 3.2 && along > 22 && along < 32;
    });
  };
  const blocked = (x, z, pad) => {
    if (!isFlat(x, z) || nearTierEdge(x, z)) return true;
    if (edgeDist(x, z) < 1.6) return true;
    if (Math.hypot(x - map.start[0], z - map.start[2]) < 5) return true;
    if (map.lanterns.some((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) < 4.5 + pad)) return true;
    if (map.moteSpots.some((p) => Math.hypot(x - p[0], z - p[2]) < 2 + pad)) return true;
    if (map.pads.some((p) => Math.hypot(x - p.pos[0], z - p.pos[2]) < 3 + pad)) return true;
    if (map.charms.some((c) => Math.hypot(x - c.pos[0], z - c.pos[2]) < 2.5 + pad)) return true;
    if (map.bridge && x > map.bridge.x0 - 4 && x < map.bridge.x1 + 4 && Math.abs(z) < 4) return true;
    if (paths.some((p) => segDist(x, z, p) < p[4])) return true;
    return false;
  };
  const sample = () => {
    const isl = map.islands[rng.int(map.islands.length)];
    const a = rng.range(0, Math.PI * 2), r = Math.sqrt(rng.next()) * isl.r;
    return [isl.c[0] + Math.cos(a) * r, isl.c[1] + Math.sin(a) * r];
  };
  const place = (count, pad, make) => {
    let tries = 0;
    for (let i = 0; i < count && tries < count * 60; tries++) {
      const [x, z] = sample();
      if (blocked(x, z, pad)) continue;
      const o = make(x, z);
      o.position.set(x, G(x, z), z);
      o.rotation.y = rng.range(0, Math.PI * 2);
      group.add(o);
      i++;
    }
  };

  // ----- mặt đảo + vách đá cho từng đảo tròn
  for (const isl of map.islands) {
    const top = new THREE.Mesh(islandTop(isl.r, rng, biome, isl.hole ?? 0), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: map.night === 4 ? 0.6 : 0.95 }));
    top.position.set(isl.c[0], 0, isl.c[1]);
    top.receiveShadow = true;
    group.add(top);
    const cliff = new THREE.Mesh(cliffGeometry(isl.r, rng), mats.cliff);
    if (isl.hole) {
      // vách băng trong lòng hồ thủng, mờ dần xuống biển mây
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(isl.hole, isl.hole * 0.55, 26, 64, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x9fc4e0, emissive: 0x16324a, roughness: 0.3, metalness: 0.1, side: THREE.BackSide, transparent: true, opacity: 0.85 }));
      wall.position.set(isl.c[0], -13, isl.c[1]);
      group.add(wall);
      const glow = new THREE.Mesh(new THREE.CircleGeometry(isl.hole * 0.9, 48), new THREE.MeshBasicMaterial({ color: 0x5fb4ff, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.rotation.x = -Math.PI / 2; glow.position.set(isl.c[0], -6, isl.c[1]);
      group.add(glow);
    }
    cliff.position.set(isl.c[0], 0, isl.c[1]);
    cliff.receiveShadow = true;
    group.add(cliff);
    // rễ cây và dây leo rủ xuống từ vách
    for (let k = 0; k < Math.round(isl.r * 0.9); k++) {
      const a = rng.range(0, Math.PI * 2), len = rng.range(2, 7);
      const vine = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, len, 4), mats.vine);
      vine.position.set(isl.c[0] + Math.cos(a) * (isl.r + 0.4), -len / 2 - 0.3, isl.c[1] + Math.sin(a) * (isl.r + 0.4));
      vine.rotation.z = rng.range(-0.1, 0.1);
      group.add(vine);
    }
  }

  // ----- Đêm 3: tầng, dốc, tháp chuông
  if (map.night === 3) build3(group, map, mats, rng, updaters);

  // ----- cỏ lay theo gió
  {
    const N = biome.blades;
    const blade = new THREE.PlaneGeometry(0.08, 0.42, 1, 3);
    blade.translate(0, 0.21, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y / 0.6)); }
    const mat = new THREE.MeshLambertMaterial({ color: biome.blade, side: THREE.DoubleSide });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uniforms.uTime;
      sh.uniforms.uDay = uniforms.uDay;
      sh.vertexShader = 'uniform float uTime;\nvarying float vH;\n' + sh.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
        float h = position.y / 0.55; vH = h;
        float w = sin(uTime*1.6 + ip.x*0.35 + ip.z*0.22) * 0.5 + sin(uTime*2.7 + ip.x*0.9) * 0.18;
        transformed.x += w * h * h * 0.22; transformed.z += w * h * h * 0.12;`);
      sh.fragmentShader = 'uniform float uDay;\nvarying float vH;\n' + sh.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        diffuseColor.rgb *= mix(0.62, 1.2, vH);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.05,1.12,0.85), uDay*vH);`);
    };
    const grass = new THREE.InstancedMesh(blade, mat, N);
    grass.receiveShadow = true;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), scl = new THREE.Vector3(), ps = new THREE.Vector3();
    let k = 0, tries = 0;
    while (k < N && tries < N * 4) {
      tries++;
      const [x, z] = sample();
      if (!isFlat(x, z) || edgeDist(x, z) < 1.6) continue;
      if (map.lanterns.some((l) => Math.hypot(x - l.pos[0], z - l.pos[2]) < 2.2) || Math.hypot(x - map.start[0], z - map.start[2]) < 2.5) continue;
      if (map.night === 3 && Math.hypot(x, z) < 2.4) continue;
      e.set(0, rng.range(0, Math.PI), rng.range(-0.15, 0.15));
      q.setFromEuler(e);
      const s = rng.range(0.55, 1.2);
      scl.set(s, s * rng.range(0.7, 1.3), s);
      ps.set(x, G(x, z), z);
      m.compose(ps, q, scl);
      grass.setMatrixAt(k++, m);
    }
    grass.count = k;
    group.add(grass);
  }

  // ----- lối đá dẫn tới các đèn
  {
    const g = new THREE.CylinderGeometry(0.45, 0.5, 0.1, 7);
    for (const [x0, z0, x1, z1] of paths) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      for (let d = 2.4; d < len - 2.3; d += 1.25) {
        const t = d / len, jitter = rng.range(-0.3, 0.3);
        const x = x0 + (x1 - x0) * t + (-(z1 - z0) / len) * jitter, z = z0 + (z1 - z0) * t + ((x1 - x0) / len) * jitter;
        const gy = G(x, z);
        if (gy === null || !Number.isInteger(gy)) continue;
        const st = new THREE.Mesh(g, mats.stone);
        st.position.set(x, gy + 0.03, z);
        st.rotation.y = rng.range(0, 3);
        st.scale.setScalar(rng.range(0.75, 1.1));
        st.receiveShadow = true;
        group.add(st);
      }
    }
    // đài đá ở điểm xuất phát
    const plaza = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.12, 40), new THREE.MeshStandardMaterial({ color: 0x9b8f7f, roughness: 0.9 }));
    plaza.position.set(map.start[0], map.start[1], map.start[2]);
    plaza.receiveShadow = true;
    group.add(plaza);
    const inlay = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.6, 48), new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.15, roughness: 0.5, metalness: 0.4 }));
    inlay.rotation.x = -Math.PI / 2; inlay.position.set(map.start[0], map.start[1] + 0.065, map.start[2]);
    group.add(inlay);
  }

  // ----- cây cối theo từng đảo
  const shadowed = (o) => { o.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
  switch (biome.flora) {
    case 'tropic':
      place(34, 1.2, () => shadowed(arecaPalm(rng, mats)));
      place(26, 0.6, () => shadowed(bush(rng, mats)));
      place(30, 0.4, () => shadowed(rock(rng, mats)));
      place(18, 0.6, () => flowers(rng));
      break;
    case 'autumn':
      place(26, 1.5, () => shadowed(maple(rng)));
      place(10, 1.5, () => shadowed(pine(rng, mats)));
      place(46, 0.4, () => shadowed(rock(rng, mats)));
      place(14, 0.6, () => leafPile(rng));
      break;
    case 'snow':
      place(30, 1.5, () => shadowed(snowPine(rng, mats)));
      place(22, 0.8, () => shadowed(iceCrystal(rng, 0x9fd6ff)));
      place(30, 0.4, () => shadowed(snowRock(rng, mats)));
      break;
    case 'corrupt':
      place(22, 1.4, () => shadowed(deadTree(rng)));
      place(26, 0.8, () => iceCrystal(rng, 0xa35cff, true));
      place(14, 0.6, () => inkPool(rng));
      place(24, 0.4, () => shadowed(rock(rng, mats)));
      break;
    default:
      place(map.night === 3 ? 22 : 26, 1.5, () => shadowed(pine(rng, mats)));
      place(map.night === 3 ? 30 : 40, 0.6, () => shadowed(bush(rng, mats)));
      place(30, 0.4, () => shadowed(rock(rng, mats)));
      place(7, 1.2, () => shadowed(bamboo(rng, mats)));
      place(8, 0.6, () => flowers(rng));
  }
  if (map.night === 1) dock(group, rng, mats, updaters);
  if (map.night === 2) bambooBridge(group, map, rng, mats);
  if (map.bridges) for (const br of map.bridges) group.add(stoneArm(br, rng));
  if (biome.flora === 'snow') group.add(snowfall(map, uniforms, updaters, rng));
  if (biome.flora === 'corrupt') group.add(inkSpores(map, uniforms, updaters, rng));
  for (const p of map.pads) group.add(padView(p, uniforms, updaters));

  // ----- sương đen tím (tan dần khi đảo sáng lên, mất hẳn ban ngày)
  const mist = new THREE.Group();
  {
    const tex = softTexture('rgba(255,255,255,0.9)');
    for (let i = 0; i < 46 * map.islands.length; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(0x1a0f2e), transparent: true, opacity: 0.55, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const isl = map.islands[i % map.islands.length];
      const a = rng.range(0, Math.PI * 2), r = rng.range(6, isl.r + 4);
      const s = rng.range(9, 18);
      sp.scale.set(s, s * 0.4, 1);
      sp.userData = { a, r, c: isl.c, sp: rng.range(0.01, 0.03), ph: rng.range(0, 6), base: rng.range(0.35, 0.6) };
      sp.position.set(isl.c[0] + Math.cos(a) * r, rng.range(0.4, 1.6), isl.c[1] + Math.sin(a) * r);
      mist.add(sp);
    }
  }
  group.add(mist);
  updaters.push((t, progress, day) => {
    for (const sp of mist.children) {
      const u = sp.userData, a = u.a + t * u.sp;
      sp.position.x = u.c[0] + Math.cos(a) * u.r; sp.position.z = u.c[1] + Math.sin(a) * u.r;
      sp.material.opacity = u.base * (1 - progress * 0.85) * (1 - day) * (0.75 + 0.25 * Math.sin(t * 0.4 + u.ph));
    }
  });

  return { group, update: (t, p, day) => { for (const u of updaters) u(t, p, day); } };
}

function nearestIsland(map, x, z) {
  let best = map.islands[0], bd = Infinity;
  for (const i of map.islands) { const d = Math.hypot(x - i.c[0], z - i.c[1]); if (d < bd) { bd = d; best = i; } }
  return best;
}

let MATS = null;
function commonMats() {
  if (MATS) return MATS;
  MATS = {
    trunk: new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 1 }),
    leaf: [0x2f6656, 0x3a7562, 0x285a4b].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true })),
    rock: new THREE.MeshStandardMaterial({ color: 0x6f6873, roughness: 1, flatShading: true }),
    stone: new THREE.MeshStandardMaterial({ color: 0x8a8278, roughness: 1, flatShading: true }),
    wall: new THREE.MeshStandardMaterial({ color: 0x7a7068, roughness: 0.95, flatShading: true }),
    grassTop: new THREE.MeshStandardMaterial({ color: 0x356a5a, roughness: 0.95 }),
    bamboo: new THREE.MeshStandardMaterial({ color: 0x8a9a52, roughness: 0.7 }),
    bambooDry: new THREE.MeshStandardMaterial({ color: 0xb59a5e, roughness: 0.8 }),
    plank: new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.95 }),
    palm: new THREE.MeshStandardMaterial({ color: 0x8c7a5c, roughness: 0.9 }),
    frond: new THREE.MeshStandardMaterial({ color: 0x3e7a52, roughness: 0.85, side: THREE.DoubleSide, flatShading: true }),
    vine: new THREE.MeshStandardMaterial({ color: 0x2c4a36, roughness: 1 }),
    cliff: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    roof: new THREE.MeshStandardMaterial({ color: 0x7a2a1e, roughness: 0.7, flatShading: true }),
    bronze: new THREE.MeshStandardMaterial({ color: 0xb08a3e, roughness: 0.35, metalness: 0.85 }),
  };
  return MATS;
}

function disposeTree(o) {
  o.traverse((c) => {
    if (c.geometry) c.geometry.dispose();
    const ms = Array.isArray(c.material) ? c.material : c.material ? [c.material] : [];
    for (const m of ms) if (!Object.values(MATS || {}).flat().includes(m) && !Object.values(WALLS).includes(m) && !Object.values(M_).includes(m)) m.dispose();
  });
}

// Mặt đảo: đĩa nhiều vòng, tô màu cỏ loang và viền cát.
function islandTop(R, rng, biome = null, hole = 0) {
  const rings = Math.round(R), seg = 160;
  const pos = [], col = [], idx = [];
  const B = biome ?? { grass: PAL.grass, sand: PAL.sand, dark: 0x1d3d37, lite: 0x3d7563, sandBand: 4 };
  const grass = new THREE.Color(B.grass), sand = new THREE.Color(B.sand), dark = new THREE.Color(B.dark), lite = new THREE.Color(B.lite), c = new THREE.Color();
  const ox = rng.range(0, 50), oz = rng.range(0, 50);
  pos.push(0, 0, 0); c.copy(grass); col.push(c.r, c.g, c.b);
  for (let i = 1; i <= rings; i++) {
    const r = hole ? hole - 0.4 + (i / rings) * (R + 1 - hole) : (i / rings) * (R + 0.6);
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, 0, z);
      const n = Math.sin((x + ox) * 0.19 + 1.3) * Math.cos((z + oz) * 0.16) * 0.5 + Math.sin(x * 0.06 + z * 0.09) * 0.5;
      c.copy(grass).lerp(n > 0 ? lite : dark, Math.abs(n) * 0.6);
      c.lerp(sand, THREE.MathUtils.smoothstep(r, R - B.sandBand, R - 1.4));
      if (hole) c.lerp(sand, 1 - THREE.MathUtils.smoothstep(r, hole + 0.4, hole + 3));
      col.push(c.r, c.g, c.b);
    }
  }
  if (!hole) for (let j = 0; j < seg; j++) idx.push(0, 1 + ((j + 1) % seg), 1 + j);
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

// Vách đá hình phễu dưới đảo, lởm chởm, rêu ở mép trên.
function cliffGeometry(R, rng, depth = 1) {
  const k = R / 40;
  const prof = [[R + 0.6, 0], [R + 0.9, -0.6], [R + 0.2, -2.5], [R - 2 * k, -5], [R - 6 * k, -9], [R - 12 * k, -14], [R - 20 * k, -20 * depth], [R - 28 * k, -27 * depth], [R - 34 * k, -34 * depth], [0, -42 * depth * k]];
  const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), 96);
  const p = g.attributes.position, col = [];
  const rockA = new THREE.Color(0x3b2f35), rockB = new THREE.Color(0x5d4a44), moss = new THREE.Color(0x24463d), c = new THREE.Color();
  const ph = rng.range(0, 10);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const n = Math.sin(a * 13 + y * 0.7 + ph) * 0.5 + Math.sin(a * 29 - y * 1.3) * 0.3 + Math.sin(a * 5 + ph) * 0.4;
    if (y < -0.7) {
      const kk = 1 + n * 0.06;
      p.setX(i, x * kk); p.setZ(i, z * kk); p.setY(i, y + n * 0.8);
    }
    c.copy(rockA).lerp(rockB, 0.5 + 0.5 * Math.sin(y * 1.7 + n * 3));
    if (y > -3.5) c.lerp(moss, 0.55);
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

// ---------------- cây cối, đạo cụ
function pine(rng, mats) {
  const g = new THREE.Group();
  const h = rng.range(2.2, 4.2);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.24, h * 0.5, 6), mats.trunk);
  trunk.position.y = h * 0.25; g.add(trunk);
  for (let k = 0; k < 3; k++) {
    const rr = (1.5 - k * 0.35) * (h / 3.2);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(rr, h * 0.55, 7), mats.leaf[k % 3]);
    cone.position.y = h * 0.45 + k * h * 0.28;
    g.add(cone);
  }
  g.scale.setScalar(rng.range(0.85, 1.25));
  return g;
}
function bush(rng, mats) {
  const g = new THREE.Group();
  const n = 2 + rng.int(3);
  for (let k = 0; k < n; k++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(0.45, 0.85), 0), mats.leaf[rng.int(3)]);
    b.position.set(rng.range(-0.6, 0.6), rng.range(0.25, 0.5), rng.range(-0.6, 0.6));
    b.scale.y = 0.75;
    g.add(b);
  }
  return g;
}
function rock(rng, mats) {
  const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(0.3, 0.9), 0), mats.rock);
  r.scale.set(1, rng.range(0.4, 0.8), rng.range(0.8, 1.3));
  r.position.y = 0.1;
  const g = new THREE.Group(); g.add(r); return g;
}
function bamboo(rng, mats) {
  const g = new THREE.Group();
  for (let k = 0; k < 7; k++) {
    const h = rng.range(3.5, 6);
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, h, 5), mats.bamboo);
    st.position.set(rng.range(-0.6, 0.6), h / 2, rng.range(-0.6, 0.6));
    st.rotation.z = rng.range(-0.12, 0.12);
    g.add(st);
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 5), mats.leaf[1]);
    leaf.position.set(st.position.x, h, st.position.z);
    g.add(leaf);
  }
  return g;
}
// Cây cau: thân mảnh cong nhẹ, tán lá rủ.
function arecaPalm(rng, mats) {
  const g = new THREE.Group();
  const h = rng.range(6, 9.5), lean = rng.range(-0.25, 0.25);
  const segs = 6;
  let x = 0, y = 0;
  for (let i = 0; i < segs; i++) {
    const sh = h / segs;
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.13 - i * 0.008, 0.15 - i * 0.008, sh, 7), mats.palm);
    const dx = Math.sin(lean) * sh * (i / segs) * 0.9;
    seg.position.set(x + dx / 2, y + sh / 2, 0);
    seg.rotation.z = -lean * (i / segs);
    g.add(seg);
    x += dx; y += sh;
    // vòng đốt
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.15 - i * 0.008, 0.015, 4, 10), mats.trunk);
    ring.rotation.x = Math.PI / 2; ring.position.set(x, y, 0);
    g.add(ring);
  }
  const crown = new THREE.Group();
  crown.position.set(x, y, 0);
  const n = 9;
  for (let i = 0; i < n; i++) {
    const frond = new THREE.Mesh(frondGeometry(rng.range(2.2, 3)), mats.frond);
    frond.rotation.y = (i / n) * Math.PI * 2 + rng.range(-0.2, 0.2);
    frond.rotation.z = rng.range(0.15, 0.5);
    crown.add(frond);
  }
  // buồng cau
  const nuts = new THREE.Mesh(new THREE.IcosahedronGeometry(0.35, 0), new THREE.MeshStandardMaterial({ color: 0x7c8a2a, roughness: 0.8, flatShading: true }));
  nuts.position.y = -0.45; crown.add(nuts);
  g.add(crown);
  return g;
}
function frondGeometry(len) {
  // lá cong rủ: dải hẹp gập xuống theo chiều dài
  const segs = 8, pos = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, x = t * len, y = Math.sin(t * Math.PI * 0.7) * 0.6 - t * t * 1.4;
    const w = Math.sin(t * Math.PI) * 0.42 + 0.04;
    pos.push(x, y, -w, x, y - 0.06, 0, x, y, w);
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 3, b = (i + 1) * 3;
    idx.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
function flowers(rng) {
  const g = new THREE.Group();
  const cols = [0xf2c14e, 0xf28c8c, 0xe8e2d0, 0xc59cf0];
  const mat = new THREE.MeshStandardMaterial({ color: cols[rng.int(cols.length)], roughness: 0.6, emissive: 0x221a10 });
  const geo = new THREE.IcosahedronGeometry(0.07, 0);
  for (let k = 0; k < 14; k++) {
    const f = new THREE.Mesh(geo, mat);
    f.position.set(rng.range(-1.2, 1.2), rng.range(0.15, 0.35), rng.range(-1.2, 1.2));
    g.add(f);
  }
  return g;
}

// Đêm 1: bến gỗ và con thuyền nhỏ
function dock(group, rng, mats, updaters) {
  const dk = new THREE.Group();
  const angle = -Math.PI / 2 - 0.5;
  for (let d = 0; d < 12; d++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, 0.82), mats.plank);
    p.position.set(0, -0.05 - d * 0.02, d * 0.9);
    p.rotation.y = rng.range(-0.03, 0.03);
    p.castShadow = p.receiveShadow = true;
    dk.add(p);
    if (d % 3 === 0) for (const sx of [-1.6, 1.6]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 4, 6), mats.trunk);
      post.position.set(sx, -1.6, d * 0.9);
      dk.add(post);
    }
  }
  const hull = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.5, 4.2, 10, 1, true, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0x5a3e28, side: THREE.DoubleSide, roughness: 0.9 }));
  hull.rotation.set(Math.PI / 2, 0, Math.PI);
  hull.position.set(2.6, -0.9, 7.5);
  dk.add(hull);
  dk.position.set(Math.cos(angle) * 39.2, 0, Math.sin(angle) * 39.2);
  dk.rotation.y = -angle + Math.PI / 2;
  updaters.push((t) => { hull.position.y = -0.95 + Math.sin(t * 0.9) * 0.08; hull.rotation.z = Math.PI + Math.sin(t * 0.7) * 0.05; });
  group.add(dk);
}

// Đêm 2: cầu tre x ∈ [26, 44], z ∈ [−2, 2], không lan can
function bambooBridge(group, map, rng, mats) {
  const b = map.bridge;
  const x0 = b.x0 - 3, x1 = b.x1 + 3;
  const n = Math.round((x1 - x0) / 0.24);
  const geo = new THREE.CylinderGeometry(0.11, 0.11, b.z1 - b.z0 + 0.2, 7);
  geo.rotateX(Math.PI / 2);
  const inst = new THREE.InstancedMesh(geo, mats.bambooDry, n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < n; i++) {
    const x = x0 + (i + 0.5) * ((x1 - x0) / n);
    const mid = (b.x0 + b.x1) / 2, sag = 0.18 * (1 - ((x - mid) / ((b.x1 - b.x0) / 2)) ** 2);
    e.set(0, rng.range(-0.03, 0.03), 0);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, -0.1 - Math.max(0, sag), 0), q, new THREE.Vector3(1, 1, 1));
    inst.setMatrixAt(i, m);
  }
  inst.castShadow = inst.receiveShadow = true;
  group.add(inst);
  for (const z of [b.z0 + 0.3, b.z1 - 0.3]) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, x1 - x0, 8), mats.bamboo);
    beam.rotation.z = Math.PI / 2;
    beam.position.set((x0 + x1) / 2, -0.32, z);
    group.add(beam);
    // dây buộc
    for (let x = x0 + 1; x < x1; x += 2.2) {
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.025, 4, 10), mats.trunk);
      tie.rotation.y = Math.PI / 2; tie.position.set(x, -0.22, z);
      group.add(tie);
    }
  }
  // cọc tre cắm hai đầu cầu
  for (const x of [b.x0 - 1.5, b.x1 + 1.5]) for (const z of [-2.4, 2.4]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 2.2, 7), mats.bamboo);
    post.position.set(x, 0.6, z); post.castShadow = true;
    group.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xffa040, emissiveIntensity: 1.6 }));
    lamp.position.set(x, 1.85, z);
    group.add(lamp);
  }
}

// Đêm 3: tầng 1 (vành khăn nửa bắc), tầng 2 (đĩa giữa), 2 dốc, tháp chuông
function build3(group, map, mats, rng, updaters) {
  const t1 = map.tiers.t1, t2 = map.tiers.t2;
  // tầng 1: hình vành khăn 12–24 m ở nửa z > 0, cao 3 m
  const shape = new THREE.Shape();
  const segs = 64;
  for (let i = 0; i <= segs; i++) { const a = (i / segs) * Math.PI; const p = [t1.r1 * Math.cos(a), -t1.r1 * Math.sin(a)]; if (i === 0) shape.moveTo(...p); else shape.lineTo(...p); }
  for (let i = segs; i >= 0; i--) { const a = (i / segs) * Math.PI; shape.lineTo(t1.r0 * Math.cos(a), -t1.r0 * Math.sin(a)); }
  const ext = new THREE.ExtrudeGeometry(shape, { depth: t1.y, bevelEnabled: false, curveSegments: 1 });
  ext.rotateX(-Math.PI / 2);
  const autumnTop = mat('autumnTop', { color: 0x6b5f35, roughness: 0.95 }); // mặt tầng theo màu đất thu
  const tier1 = new THREE.Mesh(ext, [autumnTop, wallMaterial(0.25, 0.34)]);
  tier1.castShadow = tier1.receiveShadow = true;
  group.add(tier1);
  // tầng 2: đĩa r = 8, cao 6
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(t2.r, t2.r, t2.y, 64, 1), [wallMaterial(8, 2), autumnTop, autumnTop]);
  cyl.position.y = t2.y / 2;
  cyl.castShadow = cyl.receiveShadow = true;
  group.add(cyl);
  // gờ đá viền mép tầng
  const lip = (r, y, arc) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.12, 5, 64, arc), mats.stone);
    m.rotation.x = Math.PI / 2; m.position.y = y + 0.02; // cung nằm ở nửa z > 0
    group.add(m);
  };
  lip(t1.r0, t1.y, Math.PI); lip(t1.r1, t1.y, Math.PI); lip(t2.r, t2.y, Math.PI * 2);
  // dốc thẳng rộng 3 m: chân r = 30 (Y 0) → đỉnh r = 24 (Y 3)
  for (const rp of map.ramps) {
    const L = Math.hypot(rp.r0 - rp.r1, rp.h);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(L, 0.6, rp.width), mats.stone);
    const mid = (rp.r0 + rp.r1) / 2;
    slab.position.set(rp.dir[0] * mid, rp.h / 2 - 0.3 * Math.cos(Math.atan2(rp.h, rp.r0 - rp.r1)), rp.dir[1] * mid);
    slab.rotation.order = 'YZX';
    slab.rotation.y = -Math.atan2(rp.dir[1], rp.dir[0]);
    slab.rotation.z = -Math.atan2(rp.h, rp.r0 - rp.r1); // cao ở phía trong, thấp ở chân dốc
    slab.castShadow = slab.receiveShadow = true;
    group.add(slab);
    // bậc trang trí
    for (let k = 1; k < 6; k++) {
      const along = rp.r0 - (k / 6) * (rp.r0 - rp.r1);
      const step = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, rp.width * 0.96), mats.wall);
      step.position.set(rp.dir[0] * along, (rp.h * (rp.r0 - along)) / (rp.r0 - rp.r1) + 0.02, rp.dir[1] * along);
      step.rotation.y = -Math.atan2(rp.dir[1], rp.dir[0]);
      group.add(step);
    }
    // cột đèn đá hai bên chân dốc
    for (const side of [-1, 1]) {
      const px = rp.dir[0] * rp.r0 + -rp.dir[1] * side * 2.1, pz = rp.dir[1] * rp.r0 + rp.dir[0] * side * 2.1;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), mats.wall);
      post.position.set(px, 0.6, pz); post.castShadow = true;
      group.add(post);
    }
  }
  // tháp chuông: trụ r = 2 cao 8 m trên tầng 2
  const tw = new THREE.Group();
  tw.position.y = t2.y;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2.15, 5.2, 24), wallMaterial(3, 2));
  base.position.y = 2.6; tw.add(base);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.8, 8), mats.trunk);
    pil.position.set(Math.cos(a) * 1.75, 6.6, Math.sin(a) * 1.75);
    tw.add(pil);
  }
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.2, 24), mats.plank);
  floor.position.y = 5.25; tw.add(floor);
  const bellProf = [];
  for (let i = 0; i <= 12; i++) { const t = i / 12; bellProf.push(new THREE.Vector2(0.35 + 0.75 * Math.pow(t, 1.6), 1.4 - t * 1.4)); }
  const bell = new THREE.Mesh(new THREE.LatheGeometry(bellProf, 28), mats.bronze);
  bell.material.side = THREE.DoubleSide;
  bell.position.y = 5.9; tw.add(bell);
  for (let k = 0; k < 3; k++) {
    const roof = new THREE.Mesh(new THREE.ConeGeometry(3.2 - k * 0.8, 1.1, 8, 1, true), mats.roof);
    roof.material.side = THREE.DoubleSide;
    roof.position.y = 8.3 + k * 0.75; tw.add(roof);
  }
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.gold, emissiveIntensity: 0.6, metalness: 0.6, roughness: 0.3 }));
  finial.position.y = 10.6; tw.add(finial);
  tw.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
  group.add(tw);
  updaters.push((t) => { bell.rotation.z = Math.sin(t * 0.8) * 0.05; });
}
const WALLS = {};
function wallMaterial(rx = 10, ry = 1) {
  const key = rx + "," + ry;
  if (WALLS[key]) return WALLS[key];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#6d645d'; g.fillRect(0, 0, 256, 128);
  const rng = makeRng(77);
  for (let row = 0; row < 6; row++) {
    const h = 128 / 6, off = row % 2 ? 20 : 0;
    for (let x = -off; x < 256; x += 40) {
      const v = 90 + rng.int(40);
      g.fillStyle = `rgb(${v + 18},${v + 8},${v})`;
      g.fillRect(x + 2, row * h + 2, 36, h - 4);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return (WALLS[key] = new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
}

// Bục nhảy: đế đá, vòng phù văn phát sáng, mũi tên chỉ hướng bay.
function padView(pad, uniforms, updaters) {
  const g = new THREE.Group();
  g.position.set(pad.pos[0], pad.pos[1], pad.pos[2]);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.3, 0.22, 32), new THREE.MeshStandardMaterial({ color: 0x8d8579, roughness: 0.9 }));
  base.position.y = 0.0; base.receiveShadow = true; g.add(base);
  const u = { uTime: uniforms.uTime };
  const rune = new THREE.Mesh(new THREE.CircleGeometry(1.0, 48), new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uTime; varying vec2 vP;
      void main(){ float r = length(vP); float a = atan(vP.y, vP.x);
        float ring = smoothstep(0.06,0.0,abs(r-0.82)) + smoothstep(0.04,0.0,abs(r-0.55))*0.7;
        float spokes = smoothstep(0.9,1.0,cos(a*8.0 + uTime*2.0))*step(0.55,r)*step(r,0.82)*0.6;
        float pulse = smoothstep(0.05,0.0,abs(r - fract(uTime*0.8)))*0.6;
        float al = (ring + spokes + pulse) * (0.75 + 0.25*sin(uTime*4.0));
        gl_FragColor = vec4(vec3(1.0,0.78,0.36)*al, al); }`,
  }));
  rune.rotation.x = -Math.PI / 2; rune.position.y = 0.12;
  g.add(rune);
  const dir = Math.atan2(pad.vel[0], pad.vel[2]);
  const arrows = new THREE.Group();
  arrows.rotation.y = dir;
  for (let k = 0; k < 3; k++) {
    const a = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.4, 3), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8 }));
    a.rotation.x = Math.PI / 2;
    a.position.set(0, 0.6, 0.3 + k * 0.45);
    arrows.add(a);
  }
  g.add(arrows);
  updaters.push((t) => arrows.children.forEach((a, k) => { a.material.opacity = 0.35 + 0.55 * Math.max(0, Math.sin(t * 5 - k * 0.9)); a.position.y = 0.6 + Math.sin(t * 3) * 0.08; }));
  return g;
}

// ======================================================================
// Đảo lơ lửng trên mây, trụ đá cao vút, thác đổ vào biển mây
// ======================================================================
function buildSkyIslands(rng, uniforms) {
  const group = new THREE.Group();
  const items = [];
  const mats = commonMats();
  const waterMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `${NOISE_GLSL} uniform float uTime; uniform float uDay; varying vec2 vUv;
      void main(){ float n = fbm(vec2(vUv.x*6.0, vUv.y*3.0 + uTime*1.6));
        float a = smoothstep(0.0,0.25,vUv.x)*smoothstep(1.0,0.75,vUv.x) * (0.45 + 0.55*n) * smoothstep(0.0,0.3,vUv.y);
        vec3 c = mix(vec3(0.45,0.6,0.9), vec3(0.9,0.96,1.0), uDay) * (0.7+0.5*n);
        gl_FragColor = vec4(c, a*0.75); }`,
  });
  const defs = [];
  // đảo bay vừa và nhỏ
  for (let i = 0; i < 9; i++) defs.push({ a: (i / 9) * Math.PI * 2 + rng.range(-0.2, 0.2), r: rng.range(110, 240), y: rng.range(14, 70), size: rng.range(7, 20), spire: false });
  // trụ đá cao vút có đảo trên đỉnh
  for (let i = 0; i < 4; i++) defs.push({ a: rng.range(0, Math.PI * 2), r: rng.range(150, 300), y: rng.range(55, 110), size: rng.range(9, 16), spire: true });
  for (const d of defs) {
    const g = new THREE.Group();
    const R = d.size;
    const top = new THREE.Mesh(islandTop(R, rng), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    g.add(top);
    const under = new THREE.Mesh(cliffGeometry(R, rng, d.spire ? 0.5 : 0.85), mats.cliff);
    g.add(under);
    if (d.spire) {
      // thân trụ đá thuôn từ biển mây lên tới đáy đảo
      const h = d.y + 30;
      const prof = [];
      for (let k = 0; k <= 14; k++) { const t = k / 14; prof.push(new THREE.Vector2(R * (0.32 + 0.28 * t + 0.06 * Math.sin(t * 9)), -h + t * h * 0.9)); }
      const spire = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), mats.cliff.clone());
      const geo = spire.geometry, p = geo.attributes.position, col = [];
      const c = new THREE.Color();
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), z = p.getZ(k), y = p.getY(k), a = Math.atan2(z, x);
        const n = 1 + 0.08 * Math.sin(a * 7 + y * 0.2) + 0.05 * Math.sin(a * 17 - y * 0.5);
        p.setX(k, x * n); p.setZ(k, z * n);
        c.setHex(0x3b2f35).lerp(new THREE.Color(0x6a5a52), 0.5 + 0.5 * Math.sin(y * 0.3 + a * 3));
        col.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();
      g.add(spire);
    }
    // cây trên đảo bay
    const nTrees = Math.round(R * 0.6);
    for (let k = 0; k < nTrees; k++) {
      const a = rng.range(0, Math.PI * 2), rr = Math.sqrt(rng.next()) * (R - 1.5);
      const tr = rng.next() < 0.6 ? pine(rng, mats) : bush(rng, mats);
      tr.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr);
      tr.scale.multiplyScalar(rng.range(1, 1.8));
      g.add(tr);
    }
    // miếu nhỏ có đèn ở vài đảo
    let glow = null;
    if (rng.next() < 0.55) {
      const shrine = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), mats.wall);
      body.position.y = 0.7; shrine.add(body);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1, 4), mats.roof);
      roof.position.y = 1.9; roof.rotation.y = Math.PI / 4; shrine.add(roof);
      glow = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
      glow.position.set(0, 0.8, 0.85); shrine.add(glow);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTexture('rgba(255,200,120,1)'), color: 0xffa94d, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      halo.scale.setScalar(4); glow.add(halo);
      shrine.position.set(rng.range(-R * 0.3, R * 0.3), 0, rng.range(-R * 0.3, R * 0.3));
      g.add(shrine);
    }
    // thác nước đổ xuống biển mây
    if (rng.next() < 0.5) {
      const h = d.y + 14;
      const fall = new THREE.Mesh(new THREE.PlaneGeometry(R * 0.25, h, 1, 1), waterMat);
      const a = rng.range(0, Math.PI * 2);
      fall.position.set(Math.cos(a) * (R + 0.3), -h / 2, Math.sin(a) * (R + 0.3));
      fall.rotation.y = -a + Math.PI / 2;
      g.add(fall);
    }
    g.position.set(Math.cos(d.a) * d.r, d.y, Math.sin(d.a) * d.r);
    g.rotation.y = rng.range(0, Math.PI * 2);
    group.add(g);
    items.push({ g, base: d, ph: rng.range(0, 6), glow });
  }
  const center = new THREE.Vector2();
  return {
    group,
    recenter(c) { center.copy(c); },
    update(t, p, day) {
      for (const it of items) {
        const d = it.base;
        it.g.position.set(center.x + Math.cos(d.a) * d.r, d.y + (d.spire ? 0 : Math.sin(t * 0.25 + it.ph) * 1.2), center.y + Math.sin(d.a) * d.r);
        if (it.glow) it.glow.children[0].material.opacity = (1 - day) * (0.7 + 0.3 * Math.sin(t * 2 + it.ph));
      }
    },
  };
}

// Mặt đất (để vẽ bóng dưới chân) — dùng đúng hàm của sim.
export function groundAt(map, x, z) {
  const g = map.ground(x, z);
  return g === null ? null : Math.min(g, 14);
}
export { C };

// ---------------- cây và đạo cụ theo vùng khí hậu (Cốt truyện)
const M_ = {};
const mat = (k, opts) => (M_[k] ??= new THREE.MeshStandardMaterial(opts));
function maple(rng) {
  const g = new THREE.Group();
  const h = rng.range(2.6, 4.2);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, h, 6), mat('mapleTrunk', { color: 0x4a3222, roughness: 1 }));
  trunk.position.y = h / 2; g.add(trunk);
  const cols = [0xc2401f, 0xd9662a, 0xe0952f, 0xa8331c];
  for (let k = 0; k < 5; k++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(rng.range(0.8, 1.3), 0), mat('maple' + (k % 4), { color: cols[k % 4], roughness: 0.85, flatShading: true }));
    b.position.set(rng.range(-0.9, 0.9), h + rng.range(-0.3, 0.8), rng.range(-0.9, 0.9));
    g.add(b);
  }
  g.scale.setScalar(rng.range(0.9, 1.3));
  return g;
}
function leafPile(rng) {
  const g = new THREE.Group();
  const cols = [0xc2401f, 0xe0952f, 0xd9662a];
  for (let k = 0; k < 18; k++) {
    const l = new THREE.Mesh(new THREE.CircleGeometry(0.12, 5), mat('leaf' + (k % 3), { color: cols[k % 3], roughness: 0.9, side: THREE.DoubleSide }));
    l.rotation.x = -Math.PI / 2; l.rotation.z = rng.range(0, 6);
    l.position.set(rng.range(-1.2, 1.2), 0.03, rng.range(-1.2, 1.2));
    g.add(l);
  }
  return g;
}
function snowPine(rng, mats) {
  const g = pine(rng, mats);
  const snow = mat('snowCap', { color: 0xf4f8fc, roughness: 0.7, flatShading: true });
  g.children.forEach((c, i) => { if (i > 0) { const cap = c.clone(); cap.material = snow; cap.scale.set(0.75, 0.45, 0.75); cap.position.y += c.geometry.parameters.height * 0.32; g.add(cap); } });
  return g;
}
function snowRock(rng, mats) {
  const g = rock(rng, mats);
  const cap = g.children[0].clone();
  cap.material = mat('snowCap', { color: 0xf4f8fc, roughness: 0.7, flatShading: true });
  cap.scale.multiply(new THREE.Vector3(0.9, 0.5, 0.9)); cap.position.y += 0.18;
  g.add(cap);
  return g;
}
function iceCrystal(rng, color, glow = false) {
  const g = new THREE.Group();
  const m = mat('crystal' + color, { color, emissive: color, emissiveIntensity: glow ? 0.9 : 0.25, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, flatShading: true });
  const n = 2 + rng.int(4);
  for (let k = 0; k < n; k++) {
    const h = rng.range(0.6, 1.8);
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.25, 0), m);
    c.scale.set(1, h * 2.2, 1);
    c.position.set(rng.range(-0.5, 0.5), h * 0.45, rng.range(-0.5, 0.5));
    c.rotation.set(rng.range(-0.3, 0.3), rng.range(0, 3), rng.range(-0.3, 0.3));
    g.add(c);
  }
  return g;
}
function deadTree(rng) {
  const g = new THREE.Group();
  const m = mat('deadWood', { color: 0x2b2030, roughness: 1, flatShading: true });
  const h = rng.range(2.5, 4.5);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.22, h, 5), m);
  trunk.position.y = h / 2; trunk.rotation.z = rng.range(-0.15, 0.15); g.add(trunk);
  for (let k = 0; k < 4; k++) {
    const L = rng.range(0.8, 1.6);
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.07, L, 4), m);
    const a = rng.range(0, Math.PI * 2);
    br.position.set(Math.cos(a) * 0.35, h * rng.range(0.55, 0.95), Math.sin(a) * 0.35);
    br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
    g.add(br);
  }
  return g;
}
function inkPool(rng) {
  const p = new THREE.Mesh(new THREE.CircleGeometry(rng.range(1, 2.2), 20), mat('inkPool', { color: 0x120a1a, emissive: 0x3a1460, emissiveIntensity: 0.6, roughness: 0.1, metalness: 0.4 }));
  p.rotation.x = -Math.PI / 2; p.position.y = 0.02; p.scale.set(1, rng.range(0.6, 1), 1);
  const g = new THREE.Group(); g.add(p); return g;
}
function stoneArm(b, rng) {
  const g = new THREE.Group();
  const w = b.x1 - b.x0, d = b.z1 - b.z0;
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 1.2, d), mat('armStone', { color: 0x3b2c48, roughness: 0.95, flatShading: true }));
  slab.position.set((b.x0 + b.x1) / 2, -0.6, (b.z0 + b.z1) / 2);
  slab.receiveShadow = true; g.add(slab);
  const vein = new THREE.Mesh(new THREE.BoxGeometry(w > d ? w : 0.25, 0.02, w > d ? 0.25 : d), new THREE.MeshBasicMaterial({ color: 0xa35cff, transparent: true, opacity: 0.6 }));
  vein.position.set((b.x0 + b.x1) / 2, 0.015, (b.z0 + b.z1) / 2); g.add(vein);
  for (let k = 0; k < 6; k++) {
    const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rng.range(0.4, 0.9), 0), mat('armStone', {}));
    r.position.set(rng.range(b.x0, b.x1), -1.4 - rng.range(0, 1.5), rng.range(b.z0, b.z1));
    g.add(r);
  }
  return g;
}
function snowfall(map, uniforms, updaters, rng) {
  const n = 1800, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([rng.range(-55, 55), rng.range(0, 40), rng.range(-55, 55)], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.85, depthWrite: false }));
  updaters.push((t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < n; i++) {
      p[i * 3 + 1] -= 0.05 + (i % 7) * 0.006;
      p[i * 3] += Math.sin(t * 0.7 + i) * 0.01;
      if (p[i * 3 + 1] < -2) p[i * 3 + 1] = 40;
    }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}
function inkSpores(map, uniforms, updaters, rng) {
  const n = 700, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) pos.set([rng.range(-48, 48), rng.range(0, 14), rng.range(-48, 48)], i * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xb07cff, size: 0.22, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
  updaters.push((t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < n; i++) { p[i * 3 + 1] += 0.012 + (i % 5) * 0.003; if (p[i * 3 + 1] > 14) p[i * 3 + 1] = 0; }
    geo.attributes.position.needsUpdate = true;
  });
  return pts;
}
