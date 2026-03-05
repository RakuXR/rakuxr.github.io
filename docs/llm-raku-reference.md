# .raku File Generation — LLM Reference Card

> **Purpose:** Compact reference for any LLM (GPT-4, Claude, Gemini, etc.) generating `.raku` game definition files. Include this document as context in your system prompt or user message to produce valid output.

---

## Two Formats: Choose Your Level

The Raku engine supports two `.raku` file formats. Choose based on how much control you need:

### Standard Format (recommended for most users)
- **Version key:** `"schema_version": "1.0"`
- **Top-level:** `game`, `ai`, `entities`, `scenes`, `rendering`, `audio`, `xr`, `ai_disclosure`
- **Style:** Declarative configuration — describe *what* you want, the engine figures out *how*
- **Schema:** [https://rakuai.com/schema.json](https://rakuai.com/schema.json)
- **Examples:** All sample files in [`samples/`](../samples/) (space-shooter, tower-defense, puzzle, etc.)
- **Best for:** Quick game creation, beginners, most LLM generation tasks

### Runtime Format (advanced — full engine control)
- **Version key:** `"raku_format": "1.0.0"`
- **Top-level:** `metadata`, `assets`, `initialization`, `setup`, `game_loop`, `ai_pipeline`, `shutdown`
- **Style:** Explicit API call sequences — every engine function call is specified in order
- **Examples:** [`samples/void-wyrm.raku`](../samples/void-wyrm.raku)
- **Best for:** Complex games, custom behavior trees, granular AI pipeline control, power users

**If you're unsure, use the Standard Format.** The engine automatically expands standard-format files into the runtime representation internally.

The rest of this document covers the **Runtime Format** in detail. For the standard format, read the schema at `https://rakuai.com/schema.json`.

---

## Runtime Format Overview

A runtime `.raku` file is **JSON** (not code). It declares a game as ordered API call sequences that the Raku Runtime executes. Think of it as a screenplay for the engine — you describe what happens, the runtime performs it.

```
raku_format -> metadata -> assets -> initialization -> setup -> game_loop -> ai_pipeline -> shutdown
```

Every section except `ai_pipeline` is **required**. Every entry in `initialization`, `setup`, `ai_pipeline`, `shutdown`, and `game_loop.*` arrays is an **API call object** with the same shape.

### CRITICAL RULES (read these first)

1. **Field names are `"function"` and `"params"`** — NOT `"api"`, `"args"`, `"method"`, `"call"`, or any other name. The exact JSON keys are `"function"` and `"params"`.
2. **Function names are `raku_snake_case`** — NOT `Raku.PascalCase`, not `raku::namespace`, not camelCase. Examples: `raku_entity_create`, `raku_physics_step`, `raku_audio_play`.
3. **ALL sections are arrays of API call objects** — `initialization`, `setup`, `ai_pipeline`, `shutdown` are ALL JSON arrays `[...]` of API call objects. They are NEVER nested configuration objects, NEVER `{"runtime": {...}}`, NEVER `{"settings": {...}}`. The `game_loop` is an object with 4 arrays inside it.
4. **`$VARIABLE` references require `store_as`** — When a function creates something (scene, camera, entity, pool, timer), use `"store_as": "$NAME"` to capture it, then reference `"$NAME"` in later params.
5. **Assets are grouped by type** — `assets` is `{"textures": [...], "models": [...], "audio": [...], "fonts": [...]}`, NOT a flat array. Each entry has only `"id"` and `"source"` (and optionally `"params"`).
6. **`game_loop` has exactly 4 phases** — `{"pre_frame": [...], "update": [...], "render": [...], "post_frame": [...]}`. It does NOT contain state machines, prefabs, levels, systems, events, or entity definitions.

---

## API Call Object (the universal building block)

Every action in a runtime `.raku` file is expressed as this object:

```json
{
  "function": "raku_entity_create",
  "params": { "name": "player", "type": "RAKU_ENTITY_SPRITE", "scene": "$SCENE", "texture": "ship_tex" },
  "store_as": "$PLAYER",
  "comment": "Create the player sprite entity"
}
```

| Field      | Required | Description |
|------------|----------|-------------|
| `function` | Yes      | Raku API function name (always starts with `raku_`) |
| `params`   | Yes      | Key-value arguments (can reference `$VARIABLES`) |
| `comment`  | No       | Human-readable explanation |
| `store_as` | No       | Capture return value as `$VARIABLE_NAME` for later use |
| `condition`| No       | Expression that must be true for this call to execute |

**This is the ONLY format for expressing actions.** Do not use freeform JSON objects, nested configuration blobs, or custom structures. Every section is either an array of these objects or (for `game_loop`) an object containing arrays of these objects.

---

## Required Top-Level Structure

```json
{
  "raku_format": "1.0.0",
  "metadata": { },
  "assets": { },
  "initialization": [ ],
  "setup": [ ],
  "game_loop": { "pre_frame": [], "update": [], "render": [], "post_frame": [] },
  "ai_pipeline": [ ],
  "shutdown": [ ]
}
```

---

## Metadata (required fields)

```json
"metadata": {
  "name": "Game Title",
  "description": "One-line description of the game",
  "genre": "arena_combat",
  "creator": "creator_name",
  "created": "2026-03-01T10:00:00Z",
  "modified": "2026-03-01T10:00:00Z",
  "version": "1.0",
  "engine_version": "2026.2",
  "sharing": "public",
  "ai_disclosure": {
    "live_generated": true,
    "pre_generated": false,
    "description": "Human-readable summary of AI usage",
    "systems": ["dda", "adaptive_audio", "emotional_state", "player_profiling", "behavior_tree_ai"],
    "guardrails": {
      "profanity_filter": true,
      "content_rating": "E",
      "report_endpoint": "https://api.raku.games/v1/reports"
    }
  }
}
```

**Valid genres:** `space_shooter`, `tower_defense`, `puzzle`, `arena_combat`, `platformer`, `racing`, `rpg`, `sandbox`, `simulation`, `custom`

**Valid AI system identifiers:** `dda`, `procedural_dialogue`, `adaptive_audio`, `emotional_state`, `npc_memory`, `intent_prediction`, `voice_emotion`, `player_profiling`, `behavior_tree_ai`, `procedural_generation`, `slm_inference`

**Optional metadata fields:** `tags` (string[]), `thumbnail` (URI string), `estimated_play_time` (string), `player_count` ({min, max}), `complexity` ("simple"|"medium"|"complex")

---

## Assets

Assets use `"source"` (NOT `"uri"`) and `engine://` prefix for built-in assets:

```json
"assets": {
  "textures": [
    {"id": "player_tex", "source": "engine://textures/player.png"},
    {"id": "enemy_tex", "source": "engine://textures/enemy.png"}
  ],
  "models": [],
  "audio": [
    {"id": "bgm_main", "source": "engine://audio/ambient.ogg"},
    {"id": "sfx_laser", "source": "engine://audio/laser.wav"}
  ],
  "fonts": [
    {"id": "ui_font", "source": "engine://fonts/default.ttf"}
  ]
}
```

**URI schemes:** `engine://` (built-in), `assets://` (bundled), `user://` (player library), `https://` (remote)

---

## Initialization (engine startup)

Always this order. Always use arrays for vector params:

```json
"initialization": [
  {"function": "raku_init", "params": {}, "comment": "Initialize engine core"},
  {"function": "raku_renderer_create_window", "params": {"width": 1280, "height": 720, "title": "Game Title", "vsync": true}, "comment": "Create window"},
  {"function": "raku_renderer_set_clear_color", "params": {"color": [0.05, 0.0, 0.08, 1.0]}, "comment": "Background color"},
  {"function": "raku_physics_create_world", "params": {"gravity": [0, 0, 0]}, "comment": "Zero-G for top-down"},
  {"function": "raku_audio_init", "params": {"channels": 32}, "comment": "Audio system"},
  {"function": "raku_input_init", "params": {}, "comment": "Input system"}
]
```

**CRITICAL:** `color` is `[r, g, b, a]` array. `gravity` is `[x, y, z]` array. Never use separate `r`/`g`/`b` or `gravity_x`/`gravity_y` fields.

---

## Setup (scene, entities, input, UI, pools)

### Create scene and camera
```json
{"function": "raku_scene_create", "params": {"name": "main_scene"}, "store_as": "$SCENE"},
{"function": "raku_camera_create", "params": {"type": "RAKU_CAMERA_ORTHO", "scene": "$SCENE", "near": -1.0, "far": 100.0}, "store_as": "$CAMERA"}
```

### Create entities with components
```json
{"function": "raku_entity_create", "params": {"name": "player", "type": "RAKU_ENTITY_SPRITE", "scene": "$SCENE", "texture": "player_tex", "position": [640, 360, 0], "layer": 10}, "store_as": "$PLAYER"},
{"function": "raku_entity_set_component", "params": {"entity": "$PLAYER", "component": "RAKU_COMPONENT_PHYSICS_BODY", "body_type": "kinematic", "collision_layer": 1, "collision_mask": 6}},
{"function": "raku_entity_set_component", "params": {"entity": "$PLAYER", "component": "RAKU_COMPONENT_COLLIDER", "shape": "box", "size": [32, 32]}},
{"function": "raku_entity_set_component", "params": {"entity": "$PLAYER", "component": "RAKU_COMPONENT_HEALTH", "max_hp": 50, "current_hp": 50}}
```

**Entity types:** `RAKU_ENTITY_SPRITE`, `RAKU_ENTITY_ANIMATED_SPRITE`, `RAKU_ENTITY_BACKGROUND`, `RAKU_ENTITY_POOL`, `RAKU_ENTITY_TILEMAP`, `RAKU_ENTITY_MARKER`, `RAKU_ENTITY_MESH`

**Components:** `RAKU_COMPONENT_PHYSICS_BODY`, `RAKU_COMPONENT_COLLIDER`, `RAKU_COMPONENT_HEALTH`

### Bind input actions
```json
{"function": "raku_input_bind_action", "params": {"action": "move_left", "keys": ["A", "LEFT"]}},
{"function": "raku_input_bind_action", "params": {"action": "fire", "keys": ["SPACE", "MOUSE_LEFT"]}}
```

### Create object pools
```json
{"function": "raku_entity_create", "params": {"name": "bullet_pool", "type": "RAKU_ENTITY_POOL", "scene": "$SCENE", "pool_size": 60, "template_texture": "projectile_tex", "template_collision_layer": 8, "template_collider_shape": "box", "template_collider_size": [8, 16]}, "store_as": "$BULLET_POOL"}
```

### Register collision handlers (use numeric layers, not strings)
```json
{"function": "raku_collision_register_handler", "params": {"scene": "$SCENE", "layer_a": 8, "layer_b": 2, "handler": "on_bullet_hit_enemy"}}
```

**Collision layers are integers:** Player=1, Enemies=2, Enemy bullets=4, Player bullets=8, Pickups=16, Environment=32

### Create timers
```json
{"function": "raku_timer_create", "params": {"name": "fire_cooldown", "interval": 0.15, "repeat": false}, "store_as": "$FIRE_CD"},
{"function": "raku_timer_create", "params": {"name": "wave_timer", "interval": 15.0, "repeat": true, "callback": "spawn_wave"}, "store_as": "$WAVE_TIMER"}
```

### Create UI / HUD elements
```json
{"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_TEXT", "name": "score", "text": "SCORE: 0", "position": [20, 20], "font": "ui_font", "font_size": 24, "color": [1.0, 1.0, 1.0, 1.0]}, "store_as": "$SCORE_UI"},
{"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_PROGRESS_BAR", "name": "hp_bar", "position": [20, 690], "size": [200, 16], "value": 1.0, "color_fg": [0.2, 1.0, 0.2, 1.0], "color_bg": [0.3, 0.0, 0.0, 0.8]}, "store_as": "$HP_BAR"}
```

**UI types:** `RAKU_UI_TEXT`, `RAKU_UI_PROGRESS_BAR`, `RAKU_UI_PANEL`, `RAKU_UI_IMAGE`

### Start background music
```json
{"function": "raku_audio_play", "params": {"asset": "bgm_main", "loop": true, "volume": 0.4}, "store_as": "$BGM_HANDLE"}
```

---

## Game Loop

Four phases per frame, each an array of API call objects:

```json
"game_loop": {
  "pre_frame": [
    {"function": "raku_input_poll", "params": {}},
    {"function": "raku_timer_update", "params": {}}
  ],
  "update": [
    {"function": "raku_input_handle", "params": {"entity": "$PLAYER", "mapping": "player_controls", "speed": 280.0, "bounds": [0, 0, 1280, 720]}},
    {"function": "raku_entity_pool_fire", "params": {"pool": "$BULLET_POOL", "trigger_action": "fire", "cooldown_timer": "$FIRE_CD", "spawn_offset": [0, -20], "velocity": [0, -800, 0], "source_entity": "$PLAYER", "sfx": "sfx_laser"}},
    {"function": "raku_physics_step", "params": {"delta": "$DELTA_TIME"}},
    {"function": "raku_entity_update_all", "params": {"scene": "$SCENE", "delta": "$DELTA_TIME"}},
    {"function": "raku_collision_check", "params": {"scene": "$SCENE"}},
    {"function": "raku_entity_pool_cull_oob", "params": {"pool": "$BULLET_POOL", "bounds": [-50, -50, 1330, 770]}},
    {"function": "raku_dda_update", "params": {}},
    {"function": "raku_adaptive_audio_update", "params": {}},
    {"function": "raku_audio_spatial_compute_ex", "params": {"scene": "$SCENE"}}
  ],
  "render": [
    {"function": "raku_renderer_begin_frame", "params": {}},
    {"function": "raku_scene_render", "params": {"scene": "$SCENE", "camera": "$CAMERA"}},
    {"function": "raku_ui_render", "params": {}},
    {"function": "raku_renderer_end_frame", "params": {}}
  ],
  "post_frame": [
    {"function": "raku_profiler_end_frame", "params": {}},
    {"function": "raku_telemetry_flush", "params": {}}
  ]
}
```

**CRITICAL:** Each game loop function must be a separate API call object. Never combine multiple operations into one catch-all function like `"raku_ai_update"` or `"raku_scene_update"`. Use the specific functions: `raku_collision_check`, `raku_dda_update`, `raku_adaptive_audio_update`, `raku_entity_update_all`, etc.

---

## AI Pipeline (array of API call objects!)

**The `ai_pipeline` is an ARRAY of API call objects** — the exact same format as `setup` and `initialization`. It is NOT a freeform configuration object.

### Player profiler
```json
{"function": "raku_profiler_create", "params": {"player_id": "$PLAYER_ID", "type": "RAKU_PROFILE_ADAPTIVE"}, "store_as": "$PROFILER"},
{"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "accuracy", "source": "hit_events", "window": 30.0}},
{"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "kill_rate", "source": "kill_events", "window": 15.0}},
{"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "damage_taken_rate", "source": "health_events", "window": 20.0}}
```

### Dynamic Difficulty Adjustment (DDA)
```json
{"function": "raku_dda_enable", "params": {"profiler": "$PROFILER"}},
{"function": "raku_dda_set_target_flow", "params": {"value": 0.72}},
{"function": "raku_dda_set_param", "params": {"name": "enemy_spawn_rate", "min": 0.5, "max": 2.0, "default": 1.0}},
{"function": "raku_dda_set_param", "params": {"name": "enemy_speed", "min": 0.6, "max": 1.5, "default": 1.0}},
{"function": "raku_dda_set_param", "params": {"name": "enemy_hp_multiplier", "min": 0.5, "max": 2.0, "default": 1.0}}
```

### Adaptive audio layers
```json
{"function": "raku_adaptive_audio_enable", "params": {"profiler": "$PROFILER"}},
{"function": "raku_adaptive_audio_set_intensity_source", "params": {"metric": "kill_rate", "min_threshold": 0.0, "max_threshold": 3.0}},
{"function": "raku_adaptive_audio_set_layer", "params": {"layer": "calm", "asset": "bgm_calm", "intensity_range": [0.0, 0.4]}},
{"function": "raku_adaptive_audio_set_layer", "params": {"layer": "intense", "asset": "bgm_intense", "intensity_range": [0.4, 0.8]}},
{"function": "raku_adaptive_audio_set_layer", "params": {"layer": "boss", "asset": "bgm_boss", "intensity_range": [0.8, 1.0]}}
```

### NPC / enemy templates
```json
{"function": "raku_npc_create", "params": {"name": "enemy_basic", "behavior": "RAKU_BEHAVIOR_MOVE_AND_SHOOT", "texture": "enemy_tex", "hp": 30, "speed": 120, "fire_rate": 0.8, "fire_pattern": "single", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 100}, "store_as": "$ENEMY_BASIC_TPL"},
{"function": "raku_npc_set_behavior", "params": {"npc": "$ENEMY_BASIC_TPL", "on_spawn": "enter_from_top", "on_death": "drop_powerup_chance_10"}}
```

### Behavior trees
```json
{"function": "raku_bt_create", "params": {"name": "boss_ai"}, "store_as": "$BOSS_BT"},
{"function": "raku_bt_selector", "params": {"tree": "$BOSS_BT", "name": "root"}},
{"function": "raku_bt_sequence", "params": {"tree": "$BOSS_BT", "name": "phase1", "parent": "root"}},
{"function": "raku_bt_condition", "params": {"tree": "$BOSS_BT", "name": "check_hp_high", "parent": "phase1", "condition": "hp_above_75_percent"}},
{"function": "raku_bt_action", "params": {"tree": "$BOSS_BT", "name": "attack_pattern_1", "parent": "phase1", "action": "fire_pattern_circular"}}
```

### Emotional state and intent prediction
```json
{"function": "raku_emotional_state_create", "params": {"player_id": "$PLAYER_ID"}, "store_as": "$EMOTIONAL_STATE"},
{"function": "raku_intent_predictor_create", "params": {"player_id": "$PLAYER_ID", "model": "RAKU_LSTM_LIGHTWEIGHT"}, "store_as": "$INTENT_PRED"},
{"function": "raku_npc_memory_store", "params": {"npc": "$ENEMY_BASIC_TPL", "key": "player_dodge_pattern", "value": "profiler"}}
```

---

## Shutdown (always this order)

```json
"shutdown": [
  {"function": "raku_audio_stop_all", "params": {}},
  {"function": "raku_scene_destroy", "params": {"scene": "$SCENE"}},
  {"function": "raku_physics_destroy_world", "params": {}},
  {"function": "raku_renderer_destroy_window", "params": {}},
  {"function": "raku_shutdown", "params": {}}
]
```

---

## Common Mistakes LLMs Make (AVOID THESE)

### Structural mistakes (these break everything)

| Mistake | Wrong | Correct |
|---------|-------|---------|
| **API call field name** | `"api": "Raku.Foo"` | `"function": "raku_foo"` |
| **Params field name** | `"args": {...}` | `"params": {...}` |
| **Function naming** | `Raku.Scene.Create` or `raku::scene_create` | `raku_scene_create` (snake_case, raku_ prefix) |
| **initialization as config** | `{"runtime": {"window": {...}, "physics": {...}}}` | `[{"function": "raku_init", "params": {}}, ...]` |
| **game_loop as config** | `{"state_machine": {...}, "prefabs": {...}, "levels": [...]}` | `{"pre_frame": [...], "update": [...], "render": [...], "post_frame": [...]}` |
| **Assets as flat array** | `[{"id": "x", "type": "audio", "source": "..."}]` | `{"textures": [...], "audio": [...], "fonts": [...]}` |
| **No store_as pattern** | Functions create things with no way to reference them | `"store_as": "$SCENE"` then `"scene": "$SCENE"` in later calls |
| **ai_pipeline as object** | `{"dda": {...}, "audio": {...}}` | `[{"function": "raku_dda_enable", ...}, ...]` |

### Field-level mistakes

| Mistake | Wrong | Correct |
|---------|-------|---------|
| Game name field | `"title": "My Game"` | `"name": "My Game"` |
| Asset path key | `"uri": "engine://..."` | `"source": "engine://..."` |
| Color format | `{"r": 1.0, "g": 0.0, "b": 0.0}` | `{"color": [1.0, 0.0, 0.0, 1.0]}` |
| Gravity format | `{"gravity_x": 0, "gravity_y": -9.8}` | `{"gravity": [0, -9.8, 0]}` |
| Camera creation | `raku_camera_create_orthographic` | `raku_camera_create` with `"type": "RAKU_CAMERA_ORTHO"` |
| Adding components | `raku_component_add_sprite` | `raku_entity_set_component` with component enum |
| Object pools | `raku_object_pool_create` | `raku_entity_create` with `"type": "RAKU_ENTITY_POOL"` |
| Input binding | `raku_input_bind` | `raku_input_bind_action` |
| Collision layers | `{"0": {"name": "World"}}` or `"a": "enemy"` | `"collision_layer": 1` (integer in params) |
| Entity update | `raku_scene_update` | `raku_entity_update_all` |
| Timer update | `raku_timer_update_all` | `raku_timer_update` |
| Catch-all AI | `raku_ai_update` | Individual calls: `raku_dda_update`, `raku_collision_check`, etc. |
| Missing metadata | Only title + genre | Must include all 10 required fields (name, description, genre, creator, created, modified, version, engine_version, sharing, ai_disclosure) |
| ai_disclosure systems | `"adaptive-audio"` (hyphens) | `"adaptive_audio"` (underscores) |
| ai_disclosure guardrails | `"guardrails": "string"` | `"guardrails": {"profanity_filter": true, "content_rating": "E", "report_endpoint": "..."}` |
| Fabricated metadata | `game_id`, `author`, `copyright`, `license`, `engine{}`, `localization` | None of these exist. Use only the fields listed above |

---

## Built-in Variables

| Variable | Description |
|----------|-------------|
| `$PLAYER_ID` | Current player's unique ID |
| `$DELTA_TIME` | Seconds since last frame |
| `$FRAME_COUNT` | Current frame number |
| `$SCREEN_WIDTH` | Screen width in pixels |
| `$SCREEN_HEIGHT` | Screen height in pixels |
| `$MOUSE_X` | Mouse X position |
| `$MOUSE_Y` | Mouse Y position |

---

## Validation Checklist

Before outputting a `.raku` file, verify:

1. Valid JSON (all strings double-quoted, no trailing commas)
2. `raku_format` is `"1.0.0"`
3. All 10 required metadata fields present
4. `ai_disclosure` has `live_generated`, `pre_generated`, `description`, `systems` (string array)
5. Assets use `"source"` key with `engine://` prefix
6. `raku_init` is first in `initialization`
7. `raku_shutdown` is last in `shutdown`
8. All `$VARIABLE` references have a preceding `store_as`
9. All asset IDs referenced in params are declared in `assets`
10. `ai_pipeline` is an **array** of API call objects (not a config object)
11. `game_loop` has all four phases: `pre_frame`, `update`, `render`, `post_frame`
12. Collision layers are integers, not strings

---

## Quick Reference: Common Function Names

### Core Lifecycle
`raku_init`, `raku_shutdown`

### Renderer
`raku_renderer_create_window`, `raku_renderer_destroy_window`, `raku_renderer_set_clear_color`, `raku_renderer_begin_frame`, `raku_renderer_end_frame`

### Scene & Entity
`raku_scene_create`, `raku_scene_destroy`, `raku_scene_render`, `raku_entity_create`, `raku_entity_set_component`, `raku_entity_update_all`, `raku_entity_pool_fire`, `raku_entity_pool_cull_oob`

### Camera
`raku_camera_create` (with `"type": "RAKU_CAMERA_ORTHO"` or `"RAKU_CAMERA_PERSPECTIVE"`)

### Physics & Collision
`raku_physics_create_world`, `raku_physics_destroy_world`, `raku_physics_step`, `raku_collision_check`, `raku_collision_register_handler`

### Audio
`raku_audio_init`, `raku_audio_play`, `raku_audio_stop_all`, `raku_audio_spatial_compute_ex`, `raku_audio_occlusion_query`, `raku_audio_source_set_doppler_level`

### Input
`raku_input_init`, `raku_input_poll`, `raku_input_handle`, `raku_input_bind_action`

### UI
`raku_ui_create_element`, `raku_ui_render`

### Timer
`raku_timer_create`, `raku_timer_update`

### AI Profiling
`raku_profiler_create`, `raku_profiler_track_metric`, `raku_profiler_end_frame`

### DDA
`raku_dda_enable`, `raku_dda_set_target_flow`, `raku_dda_set_param`, `raku_dda_update`

### Adaptive Audio
`raku_adaptive_audio_enable`, `raku_adaptive_audio_set_intensity_source`, `raku_adaptive_audio_set_layer`, `raku_adaptive_audio_update`

### NPC & Behavior
`raku_npc_create`, `raku_npc_set_behavior`, `raku_npc_set_knowledge`, `raku_npc_memory_store`

### Behavior Trees
`raku_bt_create`, `raku_bt_selector`, `raku_bt_sequence`, `raku_bt_condition`, `raku_bt_action`, `raku_bt_execute`

### Emotional State & Intent
`raku_emotional_state_create`, `raku_intent_predictor_create`

### Navigation
`raku_nav_create_grid`, `raku_nav_set_walkable`, `raku_nav_find_path`

### Telemetry
`raku_telemetry_flush`
