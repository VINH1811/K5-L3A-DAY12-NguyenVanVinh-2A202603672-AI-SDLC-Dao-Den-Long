#!/usr/bin/env node
// Chế độ headless theo Test Contract v1.2.
// node tools/headless.mjs --seed <int> --night 1|2|3 [--scenario f.json] [--inputs f.json] --ticks <int> --out f.jsonl [--snapshot-every 10]
import fs from 'node:fs';
import { createSim, ScenarioError } from '../src/sim/sim.js';

class InputFormatError extends Error {}

function fail(msg, code) {
  process.stderr.write(`headless: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (!k.startsWith('--')) throw new Error(`tham số lạ: ${k}`);
    const v = argv[i + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`thiếu giá trị cho ${k}`);
    a[k.slice(2)] = v; i++;
  }
  const int = (name, req, def) => {
    if (a[name] === undefined) { if (req) throw new Error(`thiếu --${name}`); return def; }
    if (!/^-?\d+$/.test(a[name])) throw new Error(`--${name} phải là số nguyên`);
    return parseInt(a[name], 10);
  };
  const out = {
    seed: int('seed', true), night: int('night', true), ticks: int('ticks', true),
    every: int('snapshot-every', false, 10), out: a.out, scenario: a.scenario, inputs: a.inputs,
  };
  if (!out.out) throw new Error('thiếu --out');
  if (out.ticks < 0) throw new Error('--ticks phải ≥ 0');
  if (out.every <= 0) throw new Error('--snapshot-every phải > 0');
  return out;
}

function readJson(file, what) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) { throw new Error(`không đọc được ${what}: ${file}`); }
  try { return JSON.parse(text); } catch (e) { throw new InputFormatError(`${what} không phải JSON hợp lệ: ${e.message}`); }
}

const BTN = ['jump', 'interact', 'pulse', 'dash', 'pause'];
function parseInputs(doc) {
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.frames)) throw new InputFormatError('inputs phải có mảng frames');
  let last = -1;
  for (const f of doc.frames) {
    if (!f || typeof f !== 'object') throw new InputFormatError('frame phải là object');
    if (!Number.isInteger(f.tick) || f.tick < 0) throw new InputFormatError('frame.tick phải là số nguyên ≥ 0');
    if (f.tick <= last) throw new InputFormatError(`frame.tick phải tăng nghiêm ngặt (tick ${f.tick})`);
    last = f.tick;
    if (f.move !== undefined && !(Array.isArray(f.move) && f.move.length === 2 && f.move.every((v) => typeof v === 'number' && v >= -1 && v <= 1)))
      throw new InputFormatError(`move sai ở tick ${f.tick}`);
    if (f.cam_yaw_deg !== undefined && !(typeof f.cam_yaw_deg === 'number' && Number.isFinite(f.cam_yaw_deg)))
      throw new InputFormatError(`cam_yaw_deg sai ở tick ${f.tick}`);
    for (const b of BTN) if (f[b] !== undefined && typeof f[b] !== 'boolean') throw new InputFormatError(`${b} phải là boolean ở tick ${f.tick}`);
  }
  return doc.frames;
}

function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); } catch (e) { fail(e.message, 1); }

  let scenario = null, frames = [];
  try {
    if (args.scenario) scenario = readJson(args.scenario, 'scenario');
    if (args.inputs) frames = parseInputs(readJson(args.inputs, 'inputs'));
  } catch (e) { fail(e.message, e instanceof InputFormatError ? 2 : 1); }

  let sim;
  try { sim = createSim({ seed: args.seed, night: args.night, scenario }); }
  catch (e) { fail(e.message, e instanceof ScenarioError ? 2 : 1); }

  const lines = [];
  lines.push(JSON.stringify(sim.snapshot()));
  for (const e of sim.drainEvents()) lines.push(JSON.stringify(e)); // night_start (tick 0)
  const cur = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false, dash: false, pause: false };
  let fi = 0;
  for (let k = 0; k < args.ticks; k++) {
    while (fi < frames.length && frames[fi].tick === k) {
      const f = frames[fi++];
      for (const key of ['move', 'cam_yaw_deg', ...BTN]) if (f[key] !== undefined) cur[key] = f[key];
    }
    while (fi < frames.length && frames[fi].tick < k) fi++;
    sim.step(cur);
    for (const e of sim.drainEvents()) lines.push(JSON.stringify(e));
    if (sim.s.tick % args.every === 0) lines.push(JSON.stringify(sim.snapshot()));
    if (sim.s.state !== 'playing') break;
  }
  lines.push(JSON.stringify({ type: 'end', ticks: sim.s.tick, state: sim.s.state, score: sim.s.score }));
  try { fs.writeFileSync(args.out, lines.join('\n') + '\n'); } catch (e) { fail(`không ghi được ${args.out}: ${e.message}`, 1); }
  process.exit(0);
}

main();
