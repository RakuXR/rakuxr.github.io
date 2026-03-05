# ChatGPT Test Prompt — .raku File Generation

> **Purpose**: Paste this into ChatGPT (GPT-4o), Claude, Gemini, or any LLM to test
> whether it can produce a valid `.raku` game file. Uses the Standard Format with
> inline schema rules and anti-hallucination guardrails.

---

## The Prompt

Copy everything below the line and paste it into an AI chat:

---

You are a game designer that outputs `.raku` game files — a JSON format that the
Raku Runtime engine executes directly. Generate a complete, valid `.raku` file
based on my game description.

### .raku File Format Rules

The file is JSON with exactly these top-level keys:

```json
{
  "raku_format": "1.0.0",
  "metadata": { ... },
  "initialization": [ ... ],
  "calls": [ ... ],
  "shutdown": [ ... ]
}
```

**metadata** (object):
- `name` (string, required) — game title
- `description` (string, required) — one-line summary
- `genre` (string, required) — one of: `space_shooter`, `tower_defense`, `puzzle`, `platformer`, `arena_combat`, `racing`, `rpg`, `sandbox`, `tech_demo`, `custom`
- `creator` (string) — use `"ai_generated"`
- `created` (string) — ISO 8601 timestamp
- `version` (string) — use `"1.0"`
- `engine_version` (string) — use `"2026.1"`
- `sharing` (string) — one of: `public`, `private`, `unlisted`
- `tags` (array of strings) — descriptive tags
- `runtime_version_min` (string) — use `"2026.1.0"`

**initialization** (array of ApiCall):
- MUST start with `{"function": "raku_init", "params": {}}`
- Then window, physics, audio, AI init calls
- Each item: `{"function": "raku_<subsystem>_<action>", "params": {...}}`

**calls** (array of ApiCall):
- Scene creation, asset loading, input binding, gameplay setup
- MUST end with `{"function": "raku_scene_start_loop", "params": {}}`

**shutdown** (array of ApiCall):
- Cleanup in reverse order of initialization
- MUST end with `{"function": "raku_shutdown", "params": {}}`

### Available Subsystem Prefixes (16 subsystems)

| Prefix | Examples |
|--------|----------|
| `raku_` | `raku_init`, `raku_shutdown` |
| `raku_renderer_` | `create_window`, `set_clear_color`, `create_camera`, `create_light`, `load_texture` |
| `raku_scene_` | `create`, `destroy`, `create_sprite`, `add_model`, `start_loop` |
| `raku_physics_` | `create_world`, `add_rigidbody`, `add_collider`, `add_static_collider` |
| `raku_audio_` | `init`, `load`, `play`, `play_spatial` |
| `raku_ai_` | `init`, `set_difficulty`, `navmesh_create`, `create_agent` |
| `raku_input_` | `bind_key` |
| `raku_animation_` | `load`, `play` |
| `raku_assets_` | `load_model` |
| `raku_slm_` | `init`, `set_context`, `shutdown` |
| `raku_network_` | `init`, `disconnect` |
| `raku_xr_` | `init`, `shutdown` |
| `raku_ui_` | `create_label`, `create_button` |
| `raku_voice_` | `init`, `bind_command` |
| `raku_scripting_` | `load`, `execute` |
| `raku_editor_` | (editor-only, not used in game files) |

### Anti-Hallucination Rules

1. **Function names**: MUST use `raku_<subsystem>_<action>` format with underscores. Never invent subsystem names not in the table above.
2. **Params**: MUST be an OBJECT `{}`, never a string or array at the top level.
3. **No invented keys**: Only use the top-level keys listed above (`raku_format`, `metadata`, `initialization`, `calls`, `shutdown`). No `"systems"`, `"config"`, `"guardrails"`, or `"events"` keys.
4. **Genre values**: Must be from the enum list, not freeform strings.
5. **Asset paths**: Use `engine://` prefix for built-in assets (e.g., `engine://textures/ship_default.png`).
6. **Output**: Raw JSON only. No markdown code fences. No explanation before or after.

### Working Example (space-shooter.raku)

```json
{
  "raku_format": "1.0.0",
  "metadata": {
    "name": "Space Battleship Defense",
    "description": "A space shooter with adaptive difficulty and reactive audio",
    "genre": "space_shooter",
    "creator": "ai_generated",
    "created": "2026-02-26T00:00:00Z",
    "version": "1.0",
    "engine_version": "2026.1",
    "sharing": "public",
    "tags": ["shooter", "space", "adaptive_ai"],
    "runtime_version_min": "2026.1.0"
  },
  "initialization": [
    {"function": "raku_init", "params": {}},
    {"function": "raku_renderer_create_window", "params": {"width": 1280, "height": 720, "title": "Space Battleship Defense", "vsync": true}},
    {"function": "raku_renderer_set_clear_color", "params": {"color": [0.0, 0.0, 0.02, 1.0]}},
    {"function": "raku_physics_create_world", "params": {"gravity": [0, 0, 0]}},
    {"function": "raku_audio_init", "params": {"channels": 32}},
    {"function": "raku_ai_init", "params": {}}
  ],
  "calls": [
    {"function": "raku_scene_create", "params": {"name": "main_scene"}},
    {"function": "raku_renderer_load_texture", "params": {"path": "engine://textures/ship_default.png", "id": "ship_tex"}},
    {"function": "raku_scene_create_sprite", "params": {"texture": "ship_tex", "x": 640, "y": 600, "tag": "player"}},
    {"function": "raku_input_bind_key", "params": {"key": "LEFT", "action": "move_left"}},
    {"function": "raku_input_bind_key", "params": {"key": "RIGHT", "action": "move_right"}},
    {"function": "raku_input_bind_key", "params": {"key": "SPACE", "action": "fire"}},
    {"function": "raku_audio_load", "params": {"path": "engine://audio/space_ambient_calm.ogg", "id": "bgm"}},
    {"function": "raku_audio_play", "params": {"id": "bgm", "loop": true}},
    {"function": "raku_ai_set_difficulty", "params": {"mode": "adaptive", "initial": 0.5}},
    {"function": "raku_scene_start_loop", "params": {}}
  ],
  "shutdown": [
    {"function": "raku_scene_destroy", "params": {"name": "main_scene"}},
    {"function": "raku_shutdown", "params": {}}
  ]
}
```

### Your Task

Create a .raku file for this game:

**"Neon Dash"** — A cyberpunk endless runner set in a neon-lit city. The player runs forward automatically, dodging obstacles and collecting data fragments.

Features:
- **Combo system**: Consecutive pickups increase score multiplier (1x, 2x, 4x, 8x)
- **Three power-ups**: Time-slow (bullet time), Magnet (attract pickups), Shield (one hit protection)
- **Adaptive music**: Starts synthwave, transitions to drum and bass as speed increases
- **Dynamic difficulty**: Speed and obstacle density scale based on player performance (DDA)
- **Progressive speed**: Base speed increases every 30 seconds
- **Controls**: LEFT/RIGHT to lane-switch, SPACE to jump, DOWN to slide
- **Neon aesthetic**: Dark background (#0a0a1a), bright cyan/magenta UI elements

Output the complete .raku file now.

---

## Validation Checklist

After the AI generates the file, verify:

- [ ] `raku_format` is `"1.0.0"`
- [ ] `metadata.genre` is from the enum (should be `"custom"` or `"platformer"`)
- [ ] `initialization` starts with `raku_init`
- [ ] `calls` ends with `raku_scene_start_loop`
- [ ] `shutdown` ends with `raku_shutdown`
- [ ] All function names use `raku_<subsystem>_<action>` format
- [ ] All `params` are objects `{}`
- [ ] No invented top-level keys
- [ ] No markdown fences in output (raw JSON only)
- [ ] Asset paths use `engine://` prefix
- [ ] Valid JSON (paste into jsonlint.com)

## Expected Subsystems Used

A good response should use at least these:
- `raku_renderer_` — window, clear color, camera, lights, textures
- `raku_scene_` — create, sprites/models, start_loop
- `raku_physics_` — world, colliders
- `raku_audio_` — init, load, play (with adaptive music)
- `raku_ai_` — init, set_difficulty (adaptive/DDA)
- `raku_input_` — key bindings (LEFT, RIGHT, SPACE, DOWN)
- `raku_ui_` — score display, combo counter

## Schema Reference

- **JSON Schema**: https://rakuai.com/schema.json
- **Human docs**: https://rakuai.com/schema.html
- **API manifest**: https://rakuai.com/api-manifest.json
- **Sample files**: https://github.com/RakuXR/raku-public/tree/main/demos
