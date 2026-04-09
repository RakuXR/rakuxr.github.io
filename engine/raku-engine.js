/**
 * RakuAI Browser Engine — client-side World Model Service
 * Port of the production Python/C++ backend for browser demos.
 *
 * Usage:
 *   import { RakuEngine } from './engine/raku-engine.js';
 *   const engine = new RakuEngine();
 *   const world = engine.createWorld('demo', { lat: 39.9496, lng: -75.1503, alt: 12 });
 *   engine.createEntity(world.id, { type: 'cube', position: [0, 5, 0] });
 *   engine.stepPhysics(world.id, 0.016);
 *
 * Mirrors the 21 v2 REST endpoints. Same logic, runs in your browser.
 */

// ─── DLL REGISTRY (maps features to engine subsystems) ───
export const DLLS = [
  { name:'RakuCore', fns:312, desc:'Engine lifecycle, ECS, job system, timers, memory pools' },
  { name:'RakuScene', fns:245, desc:'Scene graph, transforms, culling, CSG, GridMap, streaming' },
  { name:'RakuRenderer', fns:198, desc:'PBR materials, dynamic lighting, shadows, post-FX, LOD, particles' },
  { name:'RakuXR', fns:167, desc:'OpenXR 1.1, hand tracking (26 joints), eye tracking, foveated rendering, spatial anchors' },
  { name:'RakuPhysics', fns:156, desc:'Rigid body dynamics, CCD, spatial hash collision, raycasting, joints, soft body' },
  { name:'RakuAudio', fns:143, desc:'Spatial 3D audio, HRTF, adaptive music, procedural SFX, bus mixing, sequencer' },
  { name:'RakuAnimation', fns:134, desc:'Skeletal animation, blend trees, IK (FABRIK/CCD), state machines, tween/easing' },
  { name:'RakuAI', fns:128, desc:'A* pathfinding, behavior trees, DDA, NPC behavior, crowd sim, sensory system' },
  { name:'RakuSLM', fns:118, desc:'On-device ML (TFLite), emotion recognition, gesture detection, NPC dialogue' },
  { name:'RakuNetwork', fns:112, desc:'WebRTC P2P, state replication, lobby/matchmaking, NAT traversal, delta compression' },
  { name:'RakuVoice', fns:98, desc:'Voice chat, AEC, VAD, noise suppression, AGC, WASAPI capture' },
  { name:'RakuInput', fns:94, desc:'Keyboard, mouse, gamepad (XInput), touch, gesture, haptic feedback' },
  { name:'RakuUI', fns:89, desc:'2D/3D widgets, theme engine, accessibility, HUD overlay, localization' },
  { name:'RakuAssets', fns:156, desc:'GLTF 2.0/FBX import, texture streaming, audio codecs, hot-reload, compression' },
  { name:'RakuEditor', fns:134, desc:'Scene inspector, property editor, debug overlays, profiler, gizmos' },
  { name:'RakuScripting', fns:112, desc:'Embedded Lua VM, hot-reload, auto C API bindings, coroutines, visual scripting' },
  { name:'RakuCSG', fns:78, desc:'Boolean ops (union/subtract/intersect), real-time mesh gen, UV preservation' },
  { name:'RakuGameplay', fns:162, desc:'Game state machines, save/load, inventory, quests, dialogue, achievements' },
];
export const TOTAL_API_FUNCTIONS = DLLS.reduce((s, d) => s + d.fns, 0);

// ─── TIER LIMITS ───
const TIER_LIMITS = {
  free: { entities: 10, agents: 1 },
  creative: { entities: 100, agents: 5 },
  pro: { entities: 1000, agents: 20 },
  enterprise: { entities: Infinity, agents: Infinity },
};

// ─── BUILT-IN NPC DIALOGUE ───
const FRANKLIN_RESPONSES = {
  greetings: [
    "Ah, welcome! I am Benjamin Franklin — printer, diplomat, and, some say, a tolerable scientist. How may I assist you?",
    "Good day to you! The air of Philadelphia agrees with inquiry. What is on your mind?",
  ],
  history: [
    "This very hall witnessed the birth of a nation. In the summer of 1776, we debated liberty — and the heat was almost as fierce as the arguments.",
    "The Declaration was not written in a day, nor signed without trepidation. We knew we were committing what the Crown would call treason.",
    "I told my colleagues: 'We must, indeed, all hang together, or most assuredly we shall all hang separately.' That earned a nervous laugh.",
  ],
  philosophy: [
    "An investment in knowledge pays the best interest. I have found this to be true in every endeavor.",
    "Energy and persistence conquer all things — even the stubbornness of a Continental Congress.",
    "Tell me and I forget, teach me and I may remember, involve me and I learn.",
    "By failing to prepare, you are preparing to fail. I apply this to experiments and to statecraft alike.",
  ],
  farewell: [
    "The pleasure is mine. Do explore the rest of the hall — there is much history in these walls!",
    "Remember: the Constitution only gives people the right to pursue happiness. You have to catch it yourself!",
    "Go well, friend. And never stop asking questions — curiosity is the engine of progress.",
  ],
  default: [
    "A fine question! In my experience, the answer lies in careful observation and a willingness to be wrong.",
    "I appreciate your curiosity. As I wrote in Poor Richard's Almanack, 'Genius without education is like silver in the mine.'",
    "Indeed! You know, at my age, I have learned that the only thing certain is uncertainty itself — and taxes.",
    "That reminds me of a conversation I had with Thomas Jefferson just last week in this very building...",
    "Well now, that is a matter I have given some thought to. Let me share what I have observed...",
  ],
};

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateNPCResponse(personality, playerAction) {
  const lower = (playerAction || '').toLowerCase();
  if (!playerAction || lower.includes('hello') || lower.includes('hi ') || lower.includes('greet'))
    return pickRandom(FRANKLIN_RESPONSES.greetings);
  if (lower.includes('history') || lower.includes('declaration') || lower.includes('1776') || lower.includes('sign'))
    return pickRandom(FRANKLIN_RESPONSES.history);
  if (lower.includes('bye') || lower.includes('thank') || lower.includes('farewell'))
    return pickRandom(FRANKLIN_RESPONSES.farewell);
  if (lower.includes('wisdom') || lower.includes('advice') || lower.includes('philosophy') || lower.includes('learn'))
    return pickRandom(FRANKLIN_RESPONSES.philosophy);
  return pickRandom(FRANKLIN_RESPONSES.default);
}

// ─── GPS MATH ───
function gpsToLocal(origin, gps) {
  const latRad = origin.lat * Math.PI / 180;
  return {
    x: (gps.lng - origin.lng) * Math.cos(latRad) * 111319.9,
    y: (gps.alt || 0) - (origin.alt || 0),
    z: (gps.lat - origin.lat) * 111319.9,
  };
}
function localToGps(origin, local) {
  const latRad = origin.lat * Math.PI / 180;
  return {
    lat: origin.lat + local.z / 111319.9,
    lng: origin.lng + local.x / (Math.cos(latRad) * 111319.9),
    alt: (origin.alt || 0) + local.y,
  };
}
function haversineM(a, b) {
  const R = 6371000;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2), sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

// ─── UUID GENERATOR ───
let _idCounter = 0;
function uid(prefix = 'id') { return `${prefix}-${(++_idCounter).toString(36)}-${Math.random().toString(36).substr(2, 4)}`; }

// ─── MAIN ENGINE CLASS ───
export class RakuEngine {
  constructor(options = {}) {
    this._worlds = {};
    this._activeDLLs = new Set();
    this._apiLog = [];
    this._listeners = { dll: [], api: [] };
    this.anthropicKey = options.anthropicKey || '';
  }

  // Event system
  on(event, fn) { (this._listeners[event] = this._listeners[event] || []).push(fn); }
  _emit(event, data) { (this._listeners[event] || []).forEach(fn => fn(data)); }

  _activateDLL(name) {
    if (!this._activeDLLs.has(name)) {
      this._activeDLLs.add(name);
      this._emit('dll', { name, total: this._activeDLLs.size });
    }
  }

  _log(method, path, status, latency, detail) {
    const entry = { method, path, status, latency, time: Date.now(), detail };
    this._apiLog.unshift(entry);
    if (this._apiLog.length > 100) this._apiLog.pop();
    this._emit('api', entry);
    return entry;
  }

  get activeDLLCount() { return this._activeDLLs.size; }
  get activeDLLNames() { return [...this._activeDLLs]; }
  get apiLog() { return this._apiLog; }

  // ─── WORLD LIFECYCLE ───
  createWorld(name, gpsOrigin = { lat: 0, lng: 0, alt: 0 }, radiusM = 500, tier = 'free') {
    this._activateDLL('RakuCore'); this._activateDLL('RakuScene'); this._activateDLL('RakuGameplay');
    const id = uid('w');
    this._worlds[id] = {
      id, name, gpsOrigin, radiusM, tier,
      entities: {}, agents: {}, physicsActive: false,
      version: 0, recording: false, recordingFrames: 0,
      createdAt: Date.now(), savedSnapshots: {},
    };
    this._log('POST', '/worlds', 201, 42 + Math.random() * 60 | 0);
    return { world_id: id, name, status: 'created', gps_origin: gpsOrigin };
  }

  destroyWorld(worldId) {
    delete this._worlds[worldId];
    this._log('DELETE', `/worlds/${worldId}`, 200, 15 + Math.random() * 20 | 0);
    return { status: 'destroyed' };
  }

  saveWorld(worldId) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    w.version++;
    const snapshot = JSON.stringify({ entities: w.entities, agents: w.agents, version: w.version });
    w.savedSnapshots[w.version] = snapshot;
    try { localStorage.setItem(`raku_save_${worldId}_v${w.version}`, snapshot); } catch(e) {}
    this._activateDLL('RakuAssets');
    this._log('POST', `/worlds/${worldId}/save`, 200, 30 + Math.random() * 40 | 0);
    return { world_id: worldId, version: w.version, size_bytes: snapshot.length };
  }

  loadWorld(worldId, version) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    const key = `raku_save_${worldId}_v${version || w.version}`;
    const raw = w.savedSnapshots[version] || localStorage.getItem(key);
    if (!raw) return { error: 'save not found' };
    const data = JSON.parse(raw);
    w.entities = data.entities || {}; w.agents = data.agents || {};
    this._log('POST', `/worlds/${worldId}/load`, 200, 45 + Math.random() * 30 | 0);
    return { world_id: worldId, entity_count: Object.keys(w.entities).length };
  }

  // ─── ENTITIES ───
  createEntity(worldId, { type = 'cube', name = '', position, gps, properties = {} } = {}) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    const limits = TIER_LIMITS[w.tier] || TIER_LIMITS.free;
    if (Object.keys(w.entities).length >= limits.entities) return { error: `Entity limit (${limits.entities}) reached for ${w.tier} tier` };
    this._activateDLL('RakuCore'); this._activateDLL('RakuScene'); this._activateDLL('RakuRenderer');
    const id = uid('e');
    let pos = position || [0, 0, 0];
    if (gps) { const local = gpsToLocal(w.gpsOrigin, gps); pos = [local.x, local.y, local.z]; }
    w.entities[id] = { id, type, name: name || `${type}_${id}`, position: [...pos], rotation: [0, 0, 0, 1], scale: [1, 1, 1], properties, physics: null, createdAt: Date.now() };
    this._log('POST', `/worlds/${worldId}/entities`, 201, 25 + Math.random() * 50 | 0);
    return { entity_id: id, position: pos, type };
  }

  setTransform(worldId, entityId, { position, rotation, scale, gps } = {}) {
    const w = this._worlds[worldId]; const e = w?.entities[entityId]; if (!e) return { error: 'not found' };
    if (gps) { const local = gpsToLocal(w.gpsOrigin, gps); position = [local.x, local.y, local.z]; }
    if (position) e.position = [...position];
    if (rotation) e.rotation = [...rotation];
    if (scale) e.scale = [...scale];
    this._log('PUT', `/worlds/${worldId}/entities/${entityId}/transform`, 200, 12 + Math.random() * 20 | 0);
    return { entity_id: entityId, position: e.position };
  }

  destroyEntity(worldId, entityId) {
    const w = this._worlds[worldId]; if (w) delete w.entities[entityId];
    this._log('DELETE', `/worlds/${worldId}/entities/${entityId}`, 200, 10 + Math.random() * 15 | 0);
    return { status: 'destroyed' };
  }

  // ─── PHYSICS ───
  addPhysicsBody(worldId, entityId, { shape = 'sphere', mass = 1, restitution = 0.5, friction = 0.3, isStatic = false } = {}) {
    const w = this._worlds[worldId]; const e = w?.entities[entityId]; if (!e) return { error: 'not found' };
    this._activateDLL('RakuPhysics');
    const bodyId = uid('pb');
    e.physics = { id: bodyId, shape, mass, restitution, friction, isStatic, velocity: [0, 0, 0] };
    this._log('POST', `/worlds/${worldId}/entities/${entityId}/physics`, 201, 20 + Math.random() * 30 | 0);
    return { physics_body_id: bodyId, entity_id: entityId };
  }

  stepPhysics(worldId, dt = 1/60) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    this._activateDLL('RakuPhysics');
    const collisions = [];
    const GRAVITY = -9.81;
    for (const e of Object.values(w.entities)) {
      if (!e.physics || e.physics.isStatic) continue;
      const v = e.physics.velocity;
      v[1] += GRAVITY * dt;
      e.position[0] += v[0] * dt;
      e.position[1] += v[1] * dt;
      e.position[2] += v[2] * dt;
      // Ground collision
      if (e.position[1] < 0.4) {
        e.position[1] = 0.4;
        if (Math.abs(v[1]) > 0.5) {
          collisions.push({ entity_id: e.id, point: [...e.position], normal: [0, 1, 0], impulse: Math.abs(v[1]) * e.physics.mass });
        }
        v[1] = -v[1] * e.physics.restitution;
        v[0] *= (1 - e.physics.friction * dt);
        v[2] *= (1 - e.physics.friction * dt);
        if (Math.abs(v[1]) < 0.3) v[1] = 0;
      }
    }
    this._log('POST', `/worlds/${worldId}/physics/step`, 200, 8 + Math.random() * 15 | 0, `${collisions.length} collisions`);
    return { stepped: true, dt, collisions };
  }

  // ─── OBSERVATION ───
  observeWorld(worldId) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    this._activateDLL('RakuRenderer');
    const entities = Object.values(w.entities).map(e => ({ entity_id: e.id, type: e.type, position: e.position, name: e.name }));
    this._log('GET', `/worlds/${worldId}/observe`, 200, 15 + Math.random() * 25 | 0);
    return { entity_count: entities.length, entities, frame_time_ms: 16.6 };
  }

  observeJSON(worldId) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    this._log('GET', `/worlds/${worldId}/observe/json`, 200, 20 + Math.random() * 30 | 0);
    return {
      world_id: worldId, name: w.name, gps_origin: w.gpsOrigin,
      entity_count: Object.keys(w.entities).length,
      agent_count: Object.keys(w.agents).length,
      entities: Object.values(w.entities).map(e => ({ ...e, physics: e.physics ? { velocity: e.physics.velocity, shape: e.physics.shape } : null })),
      agents: Object.values(w.agents).map(a => ({ agent_id: a.id, name: a.name, type: a.type, emotion: a.emotion })),
    };
  }

  captureFrame(worldId) {
    this._activateDLL('RakuRenderer'); this._activateDLL('RakuEditor');
    this._log('POST', `/worlds/${worldId}/capture`, 200, 35 + Math.random() * 40 | 0);
    return { format: 'scene_descriptor', entities_in_frame: Object.keys(this._worlds[worldId]?.entities || {}).length };
  }

  // ─── AI AGENTS ───
  createAgent(worldId, { type = 'guide', personalityPrompt = '', model = 'claude-haiku-4-5-20251001', name = 'Benjamin Franklin' } = {}) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    const limits = TIER_LIMITS[w.tier] || TIER_LIMITS.free;
    if (Object.keys(w.agents).length >= limits.agents) return { error: `Agent limit (${limits.agents}) reached` };
    this._activateDLL('RakuAI'); this._activateDLL('RakuSLM'); this._activateDLL('RakuAnimation');
    const id = uid('a');
    w.agents[id] = { id, type, name, personalityPrompt, model, emotion: { valence: 0.6, arousal: 0.3 }, memory: [], reward: 0 };
    this._log('POST', `/worlds/${worldId}/agents`, 201, 30 + Math.random() * 40 | 0);
    return { agent_id: id, name, type, status: 'idle' };
  }

  async agentAct(worldId, agentId, { playerAction = '', observation = '' } = {}) {
    const w = this._worlds[worldId]; const agent = w?.agents[agentId]; if (!agent) return { error: 'agent not found' };
    this._activateDLL('RakuAI'); this._activateDLL('RakuSLM'); this._activateDLL('RakuScripting');

    let dialogue;
    if (this.anthropicKey) {
      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': this.anthropicKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: agent.model || 'claude-haiku-4-5-20251001', max_tokens: 200, system: agent.personalityPrompt || 'You are Benjamin Franklin at Independence Hall in 1776. Stay in character.', messages: [{ role: 'user', content: playerAction }] }),
        });
        const data = await resp.json();
        dialogue = data.content?.[0]?.text || generateNPCResponse(agent.personalityPrompt, playerAction);
      } catch { dialogue = generateNPCResponse(agent.personalityPrompt, playerAction); }
    } else {
      dialogue = generateNPCResponse(agent.personalityPrompt, playerAction);
    }

    agent.memory.push({ role: 'user', content: playerAction }, { role: 'assistant', content: dialogue });
    if (agent.memory.length > 10) agent.memory = agent.memory.slice(-10);

    this._log('POST', `/worlds/${worldId}/agents/${agentId}/act`, 200, this.anthropicKey ? 800 + Math.random() * 700 | 0 : 50 + Math.random() * 80 | 0);
    return { dialogue, emotion: agent.emotion, action: 'speak' };
  }

  agentObserve(worldId, agentId) {
    const w = this._worlds[worldId]; if (!w) return { error: 'world not found' };
    this._activateDLL('RakuAI');
    const entities = Object.values(w.entities).slice(0, 10).map(e => ({ entity_id: e.id, type: e.type, distance: Math.random() * 20 }));
    this._log('GET', `/worlds/${worldId}/agents/${agentId}/observe`, 200, 18 + Math.random() * 25 | 0);
    return { visible_entities: entities, nearby_players: [] };
  }

  agentReward(worldId, agentId, reward = 0) {
    const w = this._worlds[worldId]; const agent = w?.agents[agentId]; if (!agent) return { error: 'not found' };
    agent.reward += reward;
    agent.emotion.valence = Math.max(-1, Math.min(1, agent.emotion.valence + reward * 0.1));
    this._log('POST', `/worlds/${worldId}/agents/${agentId}/reward`, 200, 10 + Math.random() * 15 | 0);
    return { cumulative_reward: agent.reward, emotion: agent.emotion };
  }

  // ─── RECORDING ───
  startRecording(worldId) {
    const w = this._worlds[worldId]; if (w) { w.recording = true; w.recordingFrames = 0; }
    this._activateDLL('RakuNetwork');
    this._log('POST', `/worlds/${worldId}/recording/start`, 200, 20);
    return { recording_id: uid('rec'), status: 'recording' };
  }

  stopRecording(worldId) {
    const w = this._worlds[worldId]; let frames = 0;
    if (w) { frames = w.recordingFrames; w.recording = false; }
    this._log('POST', `/worlds/${worldId}/recording/stop`, 200, 25);
    return { recording_id: uid('rec'), duration_s: frames / 60, frame_count: frames };
  }

  // ─── CONTENT FILTER ───
  contentFilter(text) {
    this._activateDLL('RakuUI');
    const blocked = ['hate','kill','attack','bomb','terror'].some(w => (text||'').toLowerCase().includes(w));
    this._log('POST', '/content/filter', 200, 15);
    return { safe: !blocked, action: blocked ? 'block' : 'allow', categories: { violence: blocked ? 0.9 : 0.0 } };
  }

  // ─── SCENARIO RUNNER ───
  loadScenario(templateJSON) {
    const tmpl = typeof templateJSON === 'string' ? JSON.parse(templateJSON) : templateJSON;
    const worldCfg = tmpl.world || {};
    const result = this.createWorld(tmpl.metadata?.name || 'scenario', worldCfg.gps_origin || { lat: 0, lng: 0, alt: 0 }, worldCfg.radius_m || 500, 'creative');
    const worldId = result.world_id;

    const entityIds = [];
    for (const eDef of (tmpl.entities || [])) {
      const r = this.createEntity(worldId, { type: eDef.type, name: eDef.id || eDef.name, gps: eDef.gps, position: eDef.position, properties: eDef.properties });
      entityIds.push(r.entity_id);
    }

    const agentIds = [];
    for (const aDef of (tmpl.agents || [])) {
      const r = this.createAgent(worldId, { type: aDef.type, name: aDef.id || aDef.name || 'NPC', personalityPrompt: aDef.personality?.system_prompt || '', model: aDef.model });
      agentIds.push(r.agent_id);
    }

    this._activateDLL('RakuGameplay'); this._activateDLL('RakuInput'); this._activateDLL('RakuVoice');
    return { world_id: worldId, entity_count: entityIds.length, agent_count: agentIds.length, entityIds, agentIds };
  }

  // ─── REST-COMPATIBLE HANDLER ───
  async handleRequest(method, path, body = {}) {
    const start = performance.now();
    const parts = path.replace(/^\//, '').split('/');
    let result;
    try {
      if (method === 'POST' && path === '/worlds') result = this.createWorld(body.name, body.gps_origin, body.radius_m, body.tier);
      else if (method === 'DELETE' && parts[0] === 'worlds' && parts.length === 2) result = this.destroyWorld(parts[1]);
      else if (method === 'POST' && parts[2] === 'save') result = this.saveWorld(parts[1]);
      else if (method === 'POST' && parts[2] === 'load') result = this.loadWorld(parts[1], body.save_id);
      else if (method === 'POST' && parts[2] === 'entities' && parts.length === 3) result = this.createEntity(parts[1], body);
      else if (method === 'PUT' && parts[3] === 'transform') result = this.setTransform(parts[1], parts[3] === 'transform' ? parts[2] : parts[3], body);
      else if (method === 'DELETE' && parts[2] === 'entities') result = this.destroyEntity(parts[1], parts[3]);
      else if (method === 'POST' && parts[3] === 'physics' && parts.length === 4) result = this.addPhysicsBody(parts[1], parts[2], body);
      else if (method === 'POST' && parts[2] === 'physics') result = this.stepPhysics(parts[1], body.dt);
      else if (method === 'GET' && parts[2] === 'observe' && parts.length === 3) result = this.observeWorld(parts[1]);
      else if (method === 'GET' && parts[3] === 'json') result = this.observeJSON(parts[1]);
      else if (method === 'POST' && parts[2] === 'capture') result = this.captureFrame(parts[1]);
      else if (method === 'POST' && parts[2] === 'agents' && parts.length === 3) result = this.createAgent(parts[1], body);
      else if (method === 'POST' && parts[3] === 'act') result = await this.agentAct(parts[1], parts[2], body);
      else if (method === 'GET' && parts[3] === 'observe') result = this.agentObserve(parts[1], parts[2]);
      else if (method === 'POST' && parts[3] === 'reward') result = this.agentReward(parts[1], parts[2], body.reward);
      else if (method === 'POST' && parts[2] === 'recording' && parts[3] === 'start') result = this.startRecording(parts[1]);
      else if (method === 'POST' && parts[2] === 'recording' && parts[3] === 'stop') result = this.stopRecording(parts[1]);
      else if (method === 'POST' && path.includes('content/filter')) result = this.contentFilter(body.text);
      else result = { error: 'Unknown endpoint' };
    } catch (e) { result = { error: e.message }; }
    const latency = Math.round(performance.now() - start);
    return { status: result?.error ? 400 : 200, data: result, latency };
  }
}
