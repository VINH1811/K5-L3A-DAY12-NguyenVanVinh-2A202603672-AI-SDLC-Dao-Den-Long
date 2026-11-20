// Mô hình nhân vật & thực thể: Mây, Đèn Lồng Lớn, Bóng Mực, đom đóm, hiệu ứng.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PAL, softTexture } from './world.js';
import { TUNING, FUEL_UNIT } from '../sim/config.js';

// Bảng màu dễ phân biệt (mù màu): Bóng Mực viền/mắt #00B3FF. Bật/tắt từ main.js.
export const ACCESS = { colorblind: false };
const RIM_NORMAL = new THREE.Color(PAL.shadeRim), RIM_CB = new THREE.Color(0x00b3ff);
const FUEL_MAX_U = TUNING.fuel_max * FUEL_UNIT, FUEL_LOW_U = TUNING.low_fuel_threshold * FUEL_UNIT;

const glowTex = () => (glowTex.t ??= softTexture('rgba(255,236,190,1)'));

// ======================= MÂY =======================
export function makePlayer(scene) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = new THREE.MeshStandardMaterial({ color: 0xf1c9a5, roughness: 0.7 });
  const shirt = new THREE.MeshStandardMaterial({ color: PAL.shirt, roughness: 0.85 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x3b3550, roughness: 0.9 });
  const scarfM = new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.6 });
  const hatM = new THREE.MeshStandardMaterial({ color: 0xd8c38c, roughness: 0.8, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1422, roughness: 0.5 });

  // chân
  const legs = [];
  for (const sx of [-0.13, 0.13]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.52, 0);
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), pants);
    leg.position.y = -0.25;
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.22), dark);
    foot.position.set(0, -0.48, 0.04);
    pivot.add(leg, foot);
    body.add(pivot);
    legs.push(pivot);
  }
  // áo dài ngắn (thân hình nón)
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.36, 0.62, 14), shirt);
  torso.position.y = 0.8;
  body.add(torso);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.035, 6, 20), new THREE.MeshStandardMaterial({ color: PAL.gold, roughness: 0.4, metalness: 0.3 }));
  belt.rotation.x = Math.PI / 2; belt.position.y = 0.72;
  body.add(belt);
  // tay
  const arms = [];
  for (const sx of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * 0.25, 1.03, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), shirt);
    arm.position.y = -0.2;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), skin);
    hand.position.y = -0.4;
    pivot.add(arm, hand);
    pivot.rotation.z = sx * 0.18;
    body.add(pivot);
    arms.push(pivot);
  }
  // khăn đỏ
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 20), scarfM);
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.1;
  body.add(scarf);
  const tail = new THREE.Group();
  tail.position.set(0.08, 1.08, -0.15);
  const tailSegs = [];
  let parent = tail;
  for (let i = 0; i < 4; i++) {
    const seg = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.16), scarfM);
    m.position.z = -0.08;
    seg.add(m);
    seg.position.z = i === 0 ? 0 : -0.15;
    parent.add(seg);
    parent = seg;
    tailSegs.push(seg);
  }
  body.add(tail);
  // đầu
  const head = new THREE.Group();
  head.position.y = 1.32;
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 16), skin);
  head.add(face);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.225, 20, 16, 0, Math.PI * 2, 0, Math.PI * 0.55), dark);
  hair.rotation.x = -0.35;
  head.add(hair);
  for (const sx of [-0.075, 0.075]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), dark);
    eye.position.set(sx, 0.0, 0.2);
    head.add(eye);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.035, 10), new THREE.MeshBasicMaterial({ color: 0xff8a80, transparent: true, opacity: 0.45 }));
    blush.position.set(sx * 1.6, -0.06, 0.205);
    head.add(blush);
  }
  // nón lá
  const hat = new THREE.Group();
  hat.position.y = 0.12;
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.36, 28, 1, true), hatM);
  cone.material.side = THREE.DoubleSide;
  cone.position.y = 0.14;
  hat.add(cone);
  for (let i = 1; i <= 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62 * (i / 3.6) + 0.04, 0.008, 4, 32), new THREE.MeshStandardMaterial({ color: 0xa8915c }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.32 - 0.36 * (i / 3.6);
    hat.add(ring);
  }
  head.add(hat);
  body.add(head);
  // đèn lồng nhỏ treo trên vành nón
  const hang = new THREE.Group();
  hang.position.set(0.42, 1.36, 0.28);
  const string = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.22, 4), dark);
  string.position.y = -0.11;
  hang.add(string);
  const miniMat = new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xffa040, emissiveIntensity: 2.2, roughness: 0.6 });
  const mini = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), miniMat);
  mini.scale.y = 1.25;
  mini.position.y = -0.3;
  hang.add(mini);
  for (const y of [-0.2, -0.4]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.025, 10), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
    cap.position.y = y;
    hang.add(cap);
  }
  body.add(hang);
  const lampLight = new THREE.PointLight(0xffb060, 6, 9, 1.6);
  lampLight.position.set(0.42, 1.0, 0.28);
  body.add(lampLight);
  const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffb35a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
  lampGlow.scale.setScalar(0.9);
  mini.add(lampGlow);

  // bóng tròn dưới chân
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  // đom đóm đang mang xoay quanh Mây
  const orbit = new THREE.Group();
  orbit.position.y = 1.0;
  root.add(orbit);
  const orbs = [];
  for (let i = 0; i < 20; i++) {
    const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: PAL.moteHalo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    o.scale.setScalar(0.28);
    o.visible = false;
    orbit.add(o);
    orbs.push(o);
  }

  body.traverse((c) => { if (c.isMesh) c.castShadow = true; });
  scene.add(root);
  let walk = 0, yaw = 0, prevGrounded = true, squash = 0;
  let groundFn = () => 0;
  const vis = new THREE.Vector3();

  function update(dt, t, P, interp) {
    vis.set(interp[0], interp[1], interp[2]);
    root.position.copy(vis);
    const speed = Math.hypot(P.vel[0], P.vel[2]);
    if (speed > 0.2) {
      const target = Math.atan2(P.vel[0], P.vel[2]);
      let d = target - yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      yaw += d * Math.min(1, dt * 14);
    }
    root.rotation.y = yaw;
    walk += dt * speed * 2.1;
    const sw = Math.sin(walk) * Math.min(1, speed / 6);
    legs[0].rotation.x = sw * 0.8; legs[1].rotation.x = -sw * 0.8;
    arms[0].rotation.x = -sw * 0.7; arms[1].rotation.x = sw * 0.7;
    if (!P.grounded) { legs[0].rotation.x = -0.6; legs[1].rotation.x = 0.3; arms[0].rotation.x = arms[1].rotation.x = -0.9; }
    if (P.grounded && !prevGrounded) squash = 1;
    prevGrounded = P.grounded;
    squash = Math.max(0, squash - dt * 5);
    body.position.y = Math.abs(Math.sin(walk)) * 0.06 * Math.min(1, speed / 6);
    body.scale.set(1 + squash * 0.12, 1 - squash * 0.15, 1 + squash * 0.12);
    body.rotation.x = P.dashTicks > 0 ? 0.35 : Math.min(speed / 6, 1) * 0.08;
    // khăn bay theo tốc độ
    tailSegs.forEach((s, i) => { s.rotation.x = 0.5 - Math.min(speed / 6, 1.4) * 0.45 + Math.sin(t * 9 + i) * 0.12 * (0.4 + speed / 6); s.rotation.y = Math.sin(t * 5 + i * 0.8) * 0.15; });
    hang.rotation.z = Math.sin(t * 3.2) * 0.12 - Math.min(speed / 6, 1) * 0.1;
    hang.rotation.x = -Math.min(speed / 6, 1) * 0.35;
    head.rotation.z = Math.sin(t * 1.3) * 0.03;
    // nhấp nháy khi bất tử
    const blink = P.invuln > 0 && Math.floor(t * 14) % 2 === 0;
    body.visible = !(P.respawn > 0) && !blink;
    lampLight.intensity = 5.5 + Math.sin(t * 7) * 0.4 + Math.sin(t * 13) * 0.25;
    const gy = groundFn(vis.x, vis.z);
    shadow.position.set(vis.x, (gy ?? 0) + 0.03, vis.z);
    shadow.visible = gy !== null && gy <= vis.y + 0.2 && P.respawn === 0;
    shadow.scale.setScalar(Math.max(0.3, 1 - Math.max(0, vis.y - (gy ?? 0)) * 0.25));
    // đom đóm đang mang
    orbs.forEach((o, i) => {
      o.visible = i < P.carried && body.visible;
      const a = t * 1.6 + (i / Math.max(1, P.carried)) * Math.PI * 2;
      const rr = 0.75 + 0.08 * Math.sin(t * 3 + i);
      o.position.set(Math.cos(a) * rr, 0.25 * Math.sin(t * 2 + i * 1.7), Math.sin(a) * rr);
      o.material.opacity = 0.75 + 0.25 * Math.sin(t * 8 + i);
    });
  }
  return { root, update, setGround(fn) { groundFn = fn; } };
}

// ======================= ĐÈN LỒNG LỚN =======================
export function makeLantern(scene, L, center = [0, 0]) {
  const g = new THREE.Group();
  g.position.set(L.pos[0], L.pos[1], L.pos[2]);
  // quay mặt về tâm đảo
  g.rotation.y = Math.atan2(center[0] - L.pos[0], center[1] - L.pos[2]);
  const wood = new THREE.MeshStandardMaterial({ color: PAL.wood, roughness: 0.9 });
  const stone = new THREE.MeshStandardMaterial({ color: 0x8d8579, roughness: 1, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.35, 8), stone);
  base.position.y = 0.17;
  g.add(base);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 4.2, 8), wood);
  post.position.y = 2.25;
  g.add(post);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 1.7), wood);
  arm.position.set(0, 4.2, 0.65);
  g.add(arm);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.4, 4), new THREE.MeshStandardMaterial({ color: 0x3c2a1c, roughness: 0.8 }));
  cap.position.y = 4.5; cap.rotation.y = Math.PI / 4;
  g.add(cap);

  // thân đèn giấy treo
  const hang = new THREE.Group();
  hang.position.set(0, 4.1, 1.3);
  g.add(hang);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.35, 4), wood);
  rope.position.y = -0.15;
  hang.add(rope);
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16, y = -t * 1.25;
    prof.push(new THREE.Vector2(0.28 + Math.sin(t * Math.PI) * 0.42, y));
  }
  const paperMat = new THREE.MeshStandardMaterial({ color: PAL.lanternOff, emissive: PAL.lanternLit, emissiveIntensity: 0, roughness: 0.75, side: THREE.DoubleSide });
  const paper = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), paperMat);
  paper.position.y = -0.33;
  hang.add(paper);
  // đèn tắt: giấy rách (nhận ra được không cần màu)
  const tear = new THREE.Group();
  const tearMat = new THREE.MeshBasicMaterial({ color: 0x0b0710, side: THREE.DoubleSide });
  for (const [a, y, sx, sy] of [[0.3, -0.75, 0.22, 0.34], [2.4, -1.05, 0.16, 0.26], [4.2, -0.6, 0.12, 0.2]]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, sy); shape.lineTo(sx * 0.4, sy * 0.3); shape.lineTo(sx, sy * 0.1); shape.lineTo(sx * 0.35, -sy * 0.2);
    shape.lineTo(sx * 0.5, -sy); shape.lineTo(-sx * 0.1, -sy * 0.35); shape.lineTo(-sx, -sy * 0.5); shape.lineTo(-sx * 0.3, sy * 0.2);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), tearMat);
    const r = 0.28 + Math.sin(((-y - 0.33) / 1.25) * Math.PI) * 0.42 + 0.012;
    m.position.set(Math.sin(a) * r, y, Math.cos(a) * r);
    m.rotation.y = a;
    tear.add(m);
  }
  hang.add(tear);
  // gân tre
  for (let k = 0; k < 8; k++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.012, 4, 24, Math.PI), new THREE.MeshStandardMaterial({ color: 0x3c2a1c }));
    rib.scale.set(1, 0.9, 1);
    rib.rotation.set(0, (k / 8) * Math.PI, Math.PI / 2);
    rib.position.y = -0.95;
    rib.scale.set(0.89, 0.89, 1);
    hang.add(rib);
  }
  for (const y of [-0.33, -1.58]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.09, 20), new THREE.MeshStandardMaterial({ color: 0x2e1f14, roughness: 0.6 }));
    band.position.y = y;
    hang.add(band);
  }
  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 8), new THREE.MeshStandardMaterial({ color: PAL.scarf, roughness: 0.7 }));
  tassel.position.y = -1.85; tassel.rotation.x = Math.PI;
  hang.add(tassel);
  const coreMat = new THREE.MeshBasicMaterial({ color: PAL.lanternCore, transparent: true, opacity: 0 });
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), coreMat);
  core.position.y = -0.95;
  hang.add(core);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: PAL.lanternLit, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(6);
  halo.position.y = -0.95;
  hang.add(halo);
  const light = new THREE.PointLight(PAL.lanternLit, 0, 22, 1.4);
  light.position.y = -0.95;
  hang.add(light);

  // vòng tiến độ nạp trên mặt đất + vùng an toàn
  const ringU = { uP: { value: 0 }, uLit: { value: 0 }, uTime: { value: 0 } };
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.25, 1.55, 64), new THREE.ShaderMaterial({
    uniforms: ringU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; varying vec3 vP; void main(){ vUv=uv; vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uP; uniform float uLit; uniform float uTime; varying vec3 vP;
      void main(){ float a = atan(vP.y, vP.x)/6.2831853 + 0.5;
        float on = step(a, uP);
        vec3 c = mix(vec3(0.35,0.37,0.45)*0.35, vec3(1.0,0.75,0.35), on);
        float al = mix(0.35, 0.95, on) * (1.0 - uLit);
        gl_FragColor = vec4(c*al, al); }`,
  }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04;
  g.add(ring);
  const safeU = { uA: { value: 0 }, uTime: ringU.uTime };
  const safe = new THREE.Mesh(new THREE.CircleGeometry(TUNING.safe_radius, 64), new THREE.ShaderMaterial({
    uniforms: safeU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uA; uniform float uTime; varying vec2 vP;
      void main(){ float r = length(vP)/${TUNING.safe_radius.toFixed(1)};
        float edge = smoothstep(0.9,0.985,r)*smoothstep(1.0,0.985,r);
        float fill = (1.0-r)*0.08;
        float wave = smoothstep(0.03,0.0,abs(r - fract(uTime*0.25)))*0.25*(1.0-r);
        float a = (edge*0.55 + fill + wave) * uA;
        gl_FragColor = vec4(vec3(1.0,0.66,0.28)*a, a); }`,
  }));
  safe.rotation.x = -Math.PI / 2; safe.position.y = 0.05;
  g.add(safe);

  // đom đóm trang trí quanh đèn khi đã sáng (chỉ hiển thị)
  const deco = [];
  for (let i = 0; i < 14; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: PAL.moteHalo, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.setScalar(0.22);
    s.userData = { a: Math.random() * 6.28, r: 1.5 + Math.random() * 3.5, h: 0.5 + Math.random() * 3.5, sp: 0.2 + Math.random() * 0.5 };
    g.add(s);
    deco.push(s);
  }
  for (const m of [base, post, arm, cap]) { m.castShadow = true; m.receiveShadow = true; }
  // thanh dầu (billboard) phía trên đèn đang sáng
  const bar = new THREE.Group();
  bar.position.set(0, 5.35, 0);
  const barBg = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.2), new THREE.MeshBasicMaterial({ color: 0x0e1430, transparent: true, opacity: 0.75, depthWrite: false }));
  const fillGeo = new THREE.PlaneGeometry(1.4, 0.12); fillGeo.translate(0.7, 0, 0);
  const barFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: PAL.lanternLit, transparent: true, depthWrite: false }));
  barFill.position.set(-0.7, 0, 0.002);
  const tick30 = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.22), new THREE.MeshBasicMaterial({ color: 0xf5f1e6, transparent: true, opacity: 0.8, depthWrite: false }));
  tick30.position.set(-0.7 + 1.4 * (TUNING.low_fuel_threshold / TUNING.fuel_max), 0, 0.004);
  bar.add(barBg, barFill, tick30);
  bar.renderOrder = 5;
  g.add(bar);
  scene.add(g);

  let lit = 0, flash = 0, wasLit = false, ever = false;
  const camPos = new THREE.Vector3();
  function update(dt, t, st, camera) {
    if (st.lit && !wasLit) flash = 1;
    wasLit = st.lit;
    lit += ((st.lit ? 1 : 0) - lit) * Math.min(1, dt * 2.2);
    flash = Math.max(0, flash - dt * 0.8);
    // dầu yếu (< 30): đèn và thanh dầu nhấp nháy chậm 1 Hz
    const low = st.lit && st.fuel < FUEL_LOW_U;
    const blink = low ? 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(t * Math.PI * 2)) : 1;
    const flick = (0.92 + 0.05 * Math.sin(t * 9 + L.pos[0]) + 0.03 * Math.sin(t * 23 + L.pos[2])) * blink;
    // đèn tắt bị xẹp 20%, có vết rách
    const sq = 0.8 + 0.2 * lit;
    paper.scale.set(1, sq, 1);
    tear.visible = lit < 0.5;
    tear.scale.set(1, sq, 1);
    bar.visible = st.lit;
    if (st.lit) {
      const f = Math.max(0, Math.min(1, st.fuel / FUEL_MAX_U));
      barFill.scale.x = Math.max(0.001, f);
      barFill.material.color.setHex(low ? (ACCESS.colorblind ? 0xffffff : PAL.danger) : PAL.lanternLit);
      barFill.material.opacity = low ? blink : 1;
      if (camera) { camera.getWorldPosition(camPos); bar.lookAt(camPos); }
    }
    paperMat.color.setHex(PAL.lanternOff).lerp(new THREE.Color(0xd9542b), lit);
    paperMat.emissiveIntensity = lit * 1.15 * flick + flash * 2;
    coreMat.opacity = lit * 0.45;
    halo.material.opacity = lit * 0.3 * flick + flash * 0.5;
    halo.scale.setScalar(6 + flash * 8);
    light.intensity = lit * 32 * flick + flash * 80;
    hang.rotation.z = Math.sin(t * 0.9 + L.pos[0]) * 0.04;
    hang.rotation.x = Math.sin(t * 0.7 + L.pos[2]) * 0.03;
    if (st.everLit) ever = true;
    const cost = ever ? TUNING.relight_cost : TUNING.lantern_cost;
    ringU.uP.value += (Math.min(1, st.deposited / cost) - ringU.uP.value) * Math.min(1, dt * 8);
    ringU.uLit.value = lit;
    ringU.uTime.value = t;
    safeU.uA.value = lit * (st.lit && st.fuel < FUEL_LOW_U ? 0 : 1); // dầu < 30: mất vùng an toàn
    for (const s of deco) {
      const u = s.userData, a = u.a + t * u.sp;
      s.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * 1.3 + u.a) * 0.4, Math.sin(a) * u.r);
      s.material.opacity = lit * (0.5 + 0.5 * Math.sin(t * 3 + u.a * 4));
    }
  }
  return { update, pos: g.position, dispose() { scene.remove(g); } };
}

// ======================= BÓNG MỰC =======================
const shadeRimMat = (stunColor) => new THREE.ShaderMaterial({
  uniforms: { uRim: { value: new THREE.Color(PAL.shadeRim) }, uBody: { value: new THREE.Color(PAL.shade) }, uStun: { value: 0 }, uStunCol: { value: new THREE.Color(stunColor) }, uFade: { value: 1 }, uTime: { value: 0 } },
  transparent: true,
  vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ vec3 p = position; float w = sin(p.y*6.0 + uTime*5.0)*0.04 + sin(p.x*7.0 - uTime*4.0)*0.03; p += normal*w;
      float tl = max(0.0, -p.y - 0.35); float ang = atan(p.z, p.x); p.x += sin(uTime*4.0 + ang*3.0)*tl*0.3; p.z += cos(uTime*3.4 + ang*3.0)*tl*0.3;
      vec4 mv = modelViewMatrix*vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); vY = position.y; gl_Position = projectionMatrix*mv; }`,
  fragmentShader: `uniform vec3 uRim; uniform vec3 uBody; uniform float uStun; uniform vec3 uStunCol; uniform float uFade; varying vec3 vN; varying vec3 vV; varying float vY;
    void main(){ float f = pow(1.0 - max(dot(vN, vV),0.0), 2.2);
      vec3 body = mix(uBody, uStunCol, uStun);
      vec3 rim = mix(uRim, vec3(0.55,0.5,0.7), uStun);
      vec3 c = body + rim * f * 1.8;
      gl_FragColor = vec4(c, uFade * (0.92 + 0.08*f));
      #include <colorspace_fragment>
    }`,
});

// Hình dạng dùng chung cho mọi Bóng Mực (thân + 6 xúc tu gộp một mesh, 2 mắt gộp một mesh)
// để 200 con trong cảnh benchmark chỉ tốn khoảng 3 draw call mỗi con.
let SHADE_GEO = null;
function shadeGeometry() {
  if (SHADE_GEO) return SHADE_GEO;
  const parts = [];
  const blob = new THREE.SphereGeometry(0.7, 24, 16);
  blob.scale(1, 1.15, 1);
  parts.push(blob);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const c = new THREE.ConeGeometry(0.22, 1.1, 8);
    c.rotateX(Math.PI);
    c.translate(Math.cos(a) * 0.42, -0.75, Math.sin(a) * 0.42);
    parts.push(c);
  }
  const body = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  const eyes = mergeGeometries([-0.22, 0.22].map((sx) => { const e = new THREE.SphereGeometry(0.11, 10, 6); e.scale(1, 1, 0.5); e.translate(sx, 0, 0.6); return e.toNonIndexed(); }));
  SHADE_GEO = { body, eyes };
  return SHADE_GEO;
}

// Khói mực của mọi Bóng Mực: một hệ hạt duy nhất (1 draw call).
const SMOKE_PER = 4, SMOKE_MAX = 512;
let SMOKE = null;
function smokeSystem(scene) {
  if (SMOKE && SMOKE.scene === scene) return SMOKE;
  const n = SMOKE_PER * SMOKE_MAX;
  const pos = new Float32Array(n * 3), size = new Float32Array(n), alpha = new Float32Array(n);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA;
      void main(){ vA = aAlpha; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = aSize * 300.0 / -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0,0.0,d); a *= a * vA;
      gl_FragColor = vec4(vec3(0.165,0.059,0.27), a); }`,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  const free = Array.from({ length: SMOKE_MAX }, (_, i) => SMOKE_MAX - 1 - i);
  SMOKE = { scene, pos, size, alpha, g, free, dirty: false };
  return SMOKE;
}
export function flushShadeSmoke() {
  if (!SMOKE || !SMOKE.dirty) return;
  for (const k of ['position', 'aSize', 'aAlpha']) SMOKE.g.attributes[k].needsUpdate = true;
  SMOKE.dirty = false;
}

export function makeShade(scene) {
  const geo = shadeGeometry();
  const smoke = smokeSystem(scene);
  const slot = smoke.free.pop() ?? -1;
  const g = new THREE.Group();
  const mat = shadeRimMat(PAL.shadeStun);
  const body = new THREE.Mesh(geo.body, mat);
  g.add(body);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe6d6ff });
  const eyes = new THREE.Mesh(geo.eyes, eyeMat);
  eyes.position.y = 0.18;
  g.add(eyes);
  const eyeGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: PAL.shadeRim, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
  eyeGlow.scale.set(1.6, 0.8, 1);
  eyeGlow.position.set(0, 0.18, 0.65);
  g.add(eyeGlow);
  const stars = [];
  for (let i = 0; i < 4; i++) {
    const s = new THREE.Sprite(starMat());
    s.scale.setScalar(0.25);
    s.visible = false;
    g.add(s);
    stars.push(s);
  }
  scene.add(g);
  let stun = 0, born = 0, yaw = 0;
  const last = new THREE.Vector3();
  const vis = new THREE.Vector3();
  const target = new THREE.Vector3();
  let first = true;
  const ph = Math.random() * 10;

  function update(dt, t, sh, playerPos) {
    target.set(sh.pos[0], sh.pos[1], sh.pos[2]);
    if (first) { vis.copy(target); last.copy(target); first = false; }
    vis.lerp(target, Math.min(1, dt * 20));
    const isStun = sh.state === 'stunned';
    stun += ((isStun ? 1 : 0) - stun) * Math.min(1, dt * 8);
    born = Math.min(1, born + dt * (sh.state === 'spawning' ? 2 : 4));
    mat.uniforms.uStun.value = stun;
    mat.uniforms.uRim.value.copy(ACCESS.colorblind ? RIM_CB : RIM_NORMAL);
    eyeGlow.material.color.copy(ACCESS.colorblind ? RIM_CB : RIM_NORMAL);
    mat.uniforms.uTime.value = t + ph;
    mat.uniforms.uFade.value = born;
    const hover = Math.sin(t * 2.4 + ph + vis.x) * 0.15;
    g.position.set(vis.x, vis.y - 0.15 + hover - (1 - born) * 1.2, vis.z);
    // nhìn về Mây khi đuổi
    const mvx = vis.x - last.x, mvz = vis.z - last.z;
    let ty = yaw;
    if (sh.state === 'chase' || sh.state === 'wander') ty = sh.state === 'chase' ? Math.atan2(playerPos.x - vis.x, playerPos.z - vis.z) : (Math.hypot(mvx, mvz) > 1e-4 ? Math.atan2(mvx, mvz) : yaw);
    const d = Math.atan2(Math.sin(ty - yaw), Math.cos(ty - yaw));
    yaw += d * Math.min(1, dt * 6);
    g.rotation.y = yaw + (isStun ? t * 6 : 0);
    last.copy(vis);
    const chase = sh.state === 'chase' ? 1 : 0;
    const drain = sh.state === 'drain' ? 1 : 0; // đang hút dầu: phồng xẹp nhanh như đang hút
    g.scale.setScalar(Math.max(0.001, born * (1 + chase * 0.08 + Math.sin(t * 6) * 0.03 * chase + drain * (0.1 + Math.sin(t * 9) * 0.08))));
    eyeMat.color.setHex(isStun ? 0x7a7590 : ACCESS.colorblind ? 0x00b3ff : 0xe6d6ff);
    eyes.scale.y = isStun ? 0.25 : 1;
    eyeGlow.material.opacity = (isStun ? 0.1 : 0.55 + chase * 0.4) * born;
    stars.forEach((s, i) => {
      s.visible = stun > 0.3;
      const a = t * 4 + (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.6, 1.15, Math.sin(a) * 0.6);
    });
    if (slot >= 0) {
      for (let i = 0; i < SMOKE_PER; i++) {
        const p = i / SMOKE_PER, k = (t * 0.6 + p + ph) % 1, j = slot * SMOKE_PER + i;
        smoke.pos[j * 3] = vis.x + Math.sin(p * 40 + ph) * 0.5;
        smoke.pos[j * 3 + 1] = vis.y - 0.9 + k * 1.8;
        smoke.pos[j * 3 + 2] = vis.z + Math.cos(p * 40 + ph) * 0.5;
        smoke.size[j] = 0.8 + k * 2.2;
        smoke.alpha[j] = (1 - k) * 0.45 * born * (1 - stun * 0.6);
      }
      smoke.dirty = true;
    }
  }
  function dispose() {
    scene.remove(g);
    mat.dispose(); eyeMat.dispose(); eyeGlow.material.dispose();
    if (slot >= 0) {
      for (let i = 0; i < SMOKE_PER; i++) smoke.alpha[slot * SMOKE_PER + i] = 0;
      smoke.dirty = true;
      smoke.free.push(slot);
    }
  }
  return { update, dispose };
}
let STAR_MAT = null;
const starMat = () => (STAR_MAT ??= new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff1b0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));

// ======================= ĐOM ĐÓM =======================
export function makeMotes(scene, max = 64) {
  const pos = new Float32Array(max * 3), seed = new Float32Array(max), alive = new Float32Array(max);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  g.setAttribute('aAlive', new THREE.BufferAttribute(alive, 1));
  const u = { uTime: { value: 0 }, uScale: { value: 1 } };
  const pts = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aSeed; attribute float aAlive; uniform float uTime; uniform float uScale; varying float vA; varying float vS;
      void main(){ vec3 p = position;
        p.y += 0.9 + sin(uTime*1.7 + aSeed*30.0)*0.25;
        p.x += sin(uTime*0.9 + aSeed*17.0)*0.18; p.z += cos(uTime*1.1 + aSeed*11.0)*0.18;
        vec4 mv = modelViewMatrix*vec4(p,1.0);
        vA = aAlive * (0.75 + 0.25*sin(uTime*6.0 + aSeed*50.0)); vS = aSeed;
        gl_PointSize = aAlive * uScale * 260.0 / -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; varying float vS;
      void main(){ float d = length(gl_PointCoord-0.5)*2.0;
        float core = smoothstep(0.22,0.0,d); float halo = smoothstep(1.0,0.0,d); halo*=halo;
        vec3 c = vec3(1.0,0.965,0.76)*core*1.6 + vec3(1.0,0.9,0.54)*halo*0.75;
        gl_FragColor = vec4(c*vA, (core+halo*0.6)*vA); }`,
  }));
  pts.frustumCulled = false;
  scene.add(pts);
  const smooth = new Map();
  function update(t, motes) {
    u.uTime.value = t;
    const seen = new Set();
    for (let i = 0; i < max; i++) {
      const m = motes[i];
      if (!m) { alive[i] = 0; continue; }
      seen.add(m.id);
      let a = smooth.get(m.id) ?? 0;
      a = Math.min(1, a + 0.05);
      smooth.set(m.id, a);
      pos[i * 3] = m.pos[0]; pos[i * 3 + 1] = m.pos[1]; pos[i * 3 + 2] = m.pos[2];
      const h = +m.id.slice(1);
      seed[i] = ((h * 0.6180339) % 1);
      // đom đóm rơi sắp biến mất thì chập chờn
      alive[i] = a * (m.ttl !== null && m.ttl < 120 ? 0.4 + 0.6 * Math.abs(Math.sin(t * 10)) : 1);
    }
    for (const k of smooth.keys()) if (!seen.has(k)) smooth.delete(k);
    g.attributes.position.needsUpdate = true;
    g.attributes.aSeed.needsUpdate = true;
    g.attributes.aAlive.needsUpdate = true;
  }
  return { update };
}

// ======================= HIỆU ỨNG =======================
export function makeFx(scene) {
  const items = [];
  const ringMat = () => new THREE.ShaderMaterial({
    uniforms: { uK: { value: 0 }, uCol: { value: new THREE.Color(0xffd27a) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `uniform float uK; uniform vec3 uCol; varying vec2 vUv; void main(){ float a = (1.0-uK) * smoothstep(0.0,0.5,vUv.y); gl_FragColor = vec4(uCol*a*1.6, a); }`,
  });
  const light = new THREE.PointLight(0xffd27a, 0, 16, 1.5);
  scene.add(light);
  let lightK = 0;

  function pulse(pos) {
    // vòng sóng sáng lan 5 m
    const wave = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.4, 64, 1, true), ringMat());
    wave.position.set(pos[0], pos[1] + 0.7, pos[2]);
    scene.add(wave);
    const disc = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), ringMat());
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(pos[0], pos[1] + 0.06, pos[2]);
    scene.add(disc);
    items.push({ k: 0, dur: 0.55, upd: (k) => {
      const r = 0.3 + k * TUNING.pulse_radius;
      wave.scale.set(r, 1 - k * 0.5, r); wave.material.uniforms.uK.value = k;
      disc.scale.setScalar(r); disc.material.uniforms.uK.value = k;
    }, done: () => { scene.remove(wave, disc); } });
    light.position.set(pos[0], pos[1] + 1.2, pos[2]);
    lightK = 1;
  }
  function burst(pos, color = 0xffe58a, n = 18, up = 3) {
    const tex = softTexture('rgba(255,240,200,1)');
    const sprites = [];
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.setScalar(0.3);
      s.position.set(pos[0], pos[1], pos[2]);
      const a = Math.random() * 6.28, sp = 1 + Math.random() * 2.5;
      s.userData.v = [Math.cos(a) * sp, up * (0.5 + Math.random()), Math.sin(a) * sp];
      scene.add(s);
      sprites.push(s);
    }
    items.push({ k: 0, dur: 1.2, upd: (k, dt) => {
      for (const s of sprites) {
        s.position.x += s.userData.v[0] * dt; s.position.y += s.userData.v[1] * dt; s.position.z += s.userData.v[2] * dt;
        s.userData.v[1] -= 2.5 * dt;
        s.material.opacity = 1 - k;
      }
    }, done: () => sprites.forEach((s) => scene.remove(s)) });
  }
  function update(dt) {
    for (let i = items.length - 1; i >= 0; i--) {
      const it = items[i];
      it.k += dt / it.dur;
      if (it.k >= 1) { it.done(); items.splice(i, 1); continue; }
      it.upd(it.k, dt);
    }
    lightK = Math.max(0, lightK - dt * 2.5);
    light.intensity = lightK * 90;
  }
  return { pulse, burst, update };
}

// ======================= GIÓ LẠC =======================
// Dải lụa xám xanh uốn lượn; đom đóm cướp được bay theo đuôi.
export function makeDrifter(scene) {
  const g = new THREE.Group();
  const segs = 24, len = 3.2;
  const geo = new THREE.PlaneGeometry(len, 0.42, segs, 1);
  const base = geo.attributes.position.array.slice();
  const mat = new THREE.MeshStandardMaterial({ color: PAL.drifter, emissive: 0x3a5068, emissiveIntensity: 0.6, roughness: 0.5, side: THREE.DoubleSide, transparent: true, opacity: 0.92 });
  const ribbon = new THREE.Mesh(geo, mat);
  g.add(ribbon);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xb8d0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(3, 1.4, 1); g.add(glow);
  const loot = [];
  for (let i = 0; i < 3; i++) {
    const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: PAL.moteHalo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    o.scale.setScalar(0.3); g.add(o); loot.push(o);
  }
  scene.add(g);
  const vis = new THREE.Vector3(), last = new THREE.Vector3(), target = new THREE.Vector3();
  let first = true, yaw = 0, fade = 0;
  function update(dt, t, d) {
    target.set(d.pos[0], d.pos[1], d.pos[2]);
    if (first) { vis.copy(target); last.copy(target); first = false; }
    vis.lerp(target, Math.min(1, dt * 20));
    const mvx = vis.x - last.x, mvz = vis.z - last.z;
    if (Math.hypot(mvx, mvz) > 1e-4) yaw = Math.atan2(mvx, mvz);
    last.copy(vis);
    fade = Math.min(1, fade + dt * 2);
    g.position.copy(vis);
    g.position.y += Math.sin(t * 2 + d.id.length) * 0.15;
    g.rotation.y = yaw + Math.PI / 2;
    const p = geo.attributes.position;
    const sp = d.state === 'idle' ? 4 : 9;
    for (let i = 0; i < p.count; i++) {
      const k = base[i * 3] / len + 0.5;
      p.setY(i, base[i * 3 + 1] + Math.sin(t * sp + k * 6) * 0.25 * k);
      p.setZ(i, Math.cos(t * sp * 0.7 + k * 5) * 0.35 * k);
    }
    p.needsUpdate = true;
    geo.computeVertexNormals();
    mat.opacity = 0.92 * fade * (d.state === 'flee' ? 0.75 : 1);
    mat.emissiveIntensity = d.state === 'chase' ? 1.1 : 0.5;
    loot.forEach((o, i) => {
      o.visible = i < d.stolen;
      o.position.set(1.2 + i * 0.4, Math.sin(t * 8 + i) * 0.2, Math.cos(t * 6 + i) * 0.2);
    });
  }
  return { update, dispose() { scene.remove(g); geo.dispose(); mat.dispose(); } };
}

// ======================= BÙA GIÓ =======================
let charmTex = null;
function makeCharmTexture() {
  if (charmTex) return charmTex;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = '#f2c14e'; g.lineWidth = 10; g.strokeRect(8, 8, 112, 240);
  g.lineWidth = 3; g.strokeRect(20, 20, 88, 216);
  // hoa văn xoáy gió
  g.lineWidth = 5;
  for (const [cy, r] of [[80, 26], [170, 30]]) {
    g.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.1) { const rr = (a / (Math.PI * 5)) * r; const x = 64 + Math.cos(a) * rr, y = cy + Math.sin(a) * rr; if (a === 0) g.moveTo(x, y); else g.lineTo(x, y); }
    g.stroke();
  }
  charmTex = new THREE.CanvasTexture(c);
  charmTex.colorSpace = THREE.SRGBColorSpace;
  return charmTex;
}
export function makeCharm(scene, c) {
  const g = new THREE.Group();
  g.position.set(c.pos[0], c.pos[1], c.pos[2]);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.1), new THREE.MeshStandardMaterial({ map: makeCharmTexture(), side: THREE.DoubleSide, emissive: 0x401010, emissiveIntensity: 0.6, roughness: 0.6 }));
  card.position.y = 1.2;
  g.add(card);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff6a5a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.setScalar(2.4); halo.position.y = 1.2; g.add(halo);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.85, 40), new THREE.MeshBasicMaterial({ color: PAL.gold, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.05; g.add(ring);
  scene.add(g);
  let k = 1;
  function update(dt, t, st) {
    k += ((st.available ? 1 : 0) - k) * Math.min(1, dt * 5);
    g.visible = k > 0.02;
    card.rotation.y = t * 1.6;
    card.position.y = 1.2 + Math.sin(t * 2) * 0.15;
    g.scale.setScalar(Math.max(0.001, k));
    halo.material.opacity = 0.4 + 0.2 * Math.sin(t * 4);
  }
  return { update, dispose() { scene.remove(g); } };
}

// ======================= GIÓ MẠNH (lá bay) =======================
export function makeWindFx(scene) {
  const n = 120;
  const geo = new THREE.PlaneGeometry(0.16, 0.08);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6f9a4a, side: THREE.DoubleSide, roughness: 0.8 });
  const inst = new THREE.InstancedMesh(geo, mat, n);
  inst.frustumCulled = false;
  const seeds = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random(), Math.random()]);
  scene.add(inst);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let amt = 0;
  function update(dt, t, center, dirDeg, strength) {
    amt += (strength - amt) * Math.min(1, dt * 2);
    const a = (dirDeg * Math.PI) / 180, dx = Math.cos(a), dz = Math.sin(a);
    for (let i = 0; i < n; i++) {
      const [u, v, w, z] = seeds[i];
      const k = (t * (0.25 + u * 0.25) + v) % 1;
      const along = (k - 0.5) * 40, side = (w - 0.5) * 30;
      p.set(center.x + dx * along - dz * side, center.y + 0.5 + z * 5 + Math.sin(t * 3 + i) * 0.4, center.z + dz * along + dx * side);
      e.set(t * (2 + u * 4) + i, t * 3 + v * 6, t * 2.5 + w * 5);
      q.setFromEuler(e);
      sc.setScalar(amt > 0.02 ? Math.max(0, amt * Math.sin(k * Math.PI) * 1.4) : 0);
      m.compose(p, q, sc);
      inst.setMatrixAt(i, m);
    }
    inst.instanceMatrix.needsUpdate = true;
  }
  return { update };
}
