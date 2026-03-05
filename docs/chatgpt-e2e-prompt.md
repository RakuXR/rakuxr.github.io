# ChatGPT End-to-End Prompt: Download, Install, Create Game, Play

> Paste everything below the line into ChatGPT. It will generate a PowerShell
> script that downloads the Raku Runtime, installs it silently, creates a
> .raku game file, and launches the game — all unattended.

---

I need you to do four things, all in one response. Output a single PowerShell script block that does steps 1-3, then output a .raku game file for step 4.

## STEP 1: Download the Raku Runtime installer

Download from this URL:
```
https://github.com/RakuXR/raku-runtime/releases/latest/download/RakuRuntime-Setup.exe
```

Save it to the user's Downloads folder as `RakuRuntime-Setup.exe`.

## STEP 2: Install silently

Run the installer with `/S` (silent) flag. The default install path is `C:\Program Files\RakuAI`. Wait for the installer to finish.

## STEP 3: Generate a .raku game file and launch it

Create a file called `neon-dash.raku` on the user's Desktop, write the game JSON into it (from step 4 below), then launch it by running:
```
& "C:\Program Files\RakuAI\RakuLauncher.exe" "$env:USERPROFILE\Desktop\neon-dash.raku"
```

## STEP 4: The .raku game file

Create a `.raku` game file (which is JSON) using the **exact format** below. A `.raku` file must have these exact top-level keys with `schema_version` set to `"1.0"`:

```json
{
  "schema_version": "1.0",
  "game": {
    "title": "string",
    "genre": "space_shooter|tower_defense|puzzle|arena_combat|platformer|racing|rpg|sandbox|simulation|custom",
    "template": "string",
    "description": "string",
    "max_players": 1
  },
  "ai": {
    "dda_enabled": true,
    "target_flow_state": 0.7,
    "profiler_mode": "adaptive",
    "emotional_tracking": true,
    "npc_personality": false
  },
  "entities": [
    {
      "type": "string (e.g. player, enemy_wave, collectible, obstacle, boss)",
      "count": 1,
      "health": 100,
      "speed": 1.0,
      "ai_behavior": "swarm|tank|patrol|chase|flee|guard|wander|none",
      "properties": { }
    }
  ],
  "scenes": [
    {
      "name": "Scene Name",
      "type": "menu|gameplay|cutscene|boss",
      "entities": ["entity_type_refs"],
      "properties": { }
    }
  ],
  "rendering": {
    "resolution": "auto",
    "fps_target": 60,
    "vrs_enabled": true,
    "post_processing": ["bloom", "color-grading"]
  },
  "audio": {
    "spatial_audio": true,
    "adaptive_music": true,
    "voice_commands": false
  },
  "xr": {
    "openxr_enabled": false
  },
  "ai_disclosure": {
    "live_generated": true,
    "pre_generated": false,
    "description": "string describing AI usage",
    "systems": ["dda", "adaptive_audio", "emotional_state"],
    "guardrails": {
      "profanity_filter": true,
      "content_rating": "E",
      "report_endpoint": "https://api.raku.games/v1/reports"
    }
  }
}
```

### CRITICAL FORMAT RULES:
- `ai_disclosure.guardrails` MUST be an **object** (not a string)
- `ai_disclosure.systems` uses **underscores**: `adaptive_audio` NOT `adaptive-audio`
- `entities` is an **array** of entity objects
- `properties` inside entities/scenes is freeform (game-specific data)
- Player entity should have `"count": 1`

### WORKING EXAMPLE:

```json
{
  "schema_version": "1.0",
  "game": {
    "title": "Cosmic Defender",
    "genre": "space_shooter",
    "template": "space-shooter",
    "description": "Classic arcade space shooter with AI-driven difficulty scaling.",
    "max_players": 1
  },
  "ai": {
    "dda_enabled": true,
    "target_flow_state": 0.7,
    "profiler_mode": "adaptive",
    "emotional_tracking": true,
    "npc_personality": false
  },
  "entities": [
    {
      "type": "player_ship",
      "health": 100,
      "speed": 1.0,
      "properties": { "weapon": "dual_laser", "shield_capacity": 50, "lives": 3 }
    },
    {
      "type": "enemy_wave",
      "count": 8,
      "health": 20,
      "speed": 0.6,
      "ai_behavior": "swarm",
      "properties": { "formation": "v_shape", "fire_rate": 0.5 }
    },
    {
      "type": "collectible",
      "count": 5,
      "properties": { "type": "health_pack", "heal_amount": 25, "spawn_chance": 0.15 }
    }
  ],
  "scenes": [
    { "name": "Main Menu", "type": "menu" },
    {
      "name": "Asteroid Field",
      "type": "gameplay",
      "entities": ["player_ship", "enemy_wave", "collectible"],
      "properties": { "background": "starfield", "wave_count": 10 }
    },
    {
      "name": "Boss Battle",
      "type": "boss",
      "properties": { "boss_type": "mothership", "boss_health": 500 }
    }
  ],
  "rendering": { "resolution": "auto", "fps_target": 60, "vrs_enabled": true, "post_processing": ["bloom", "color-grading"] },
  "audio": { "spatial_audio": true, "adaptive_music": true, "voice_commands": false },
  "xr": { "openxr_enabled": false },
  "ai_disclosure": {
    "live_generated": true,
    "pre_generated": true,
    "description": "DDA scales enemy count and speed based on player performance. Adaptive music responds to combat intensity.",
    "systems": ["dda", "adaptive_audio", "emotional_state"],
    "guardrails": { "profanity_filter": true, "content_rating": "E", "report_endpoint": "https://api.raku.games/v1/reports" }
  }
}
```

### THE GAME TO CREATE:

**Neon Dash** — A fast-paced endless runner in a cyberpunk city. The player rides a hoverboard through neon-lit streets, dodging hovercars, jumping between rooftops, and collecting glowing data shards. The game speeds up over time and the AI adapts obstacle density to keep the player in flow state. Power-ups: time-slow (3 sec), shard magnet (pulls nearby shards), and shield (smash through one obstacle). Near-miss dodges and chained jumps multiply your score. Music shifts from chill synthwave to intense drum & bass as speed increases.

**Entity requirements:**
- Player (hoverboard rider, 3 lives, speed 1.0)
- Hovercars (obstacles, multiple speeds, 3 formations)
- Data shards (collectibles, spawn_chance 0.3)
- Power-up: time_slow (spawn_chance 0.05)
- Power-up: magnet (spawn_chance 0.04)
- Power-up: shield (spawn_chance 0.03)
- Rooftop gaps (environmental hazard)
- Boss: Firewall (a wall of obstacles that scrolls in complex patterns, health 300)

**Scene requirements:**
- Main Menu
- Neon Streets (main gameplay, endless runner)
- Rooftop Run (harder variant, narrower paths)
- Firewall Boss (boss encounter every 1000m)

## OUTPUT FORMAT

Output two things in your response:

**First:** A complete PowerShell script in a code block that:
1. Downloads `RakuRuntime-Setup.exe` from the GitHub Releases URL above
2. Runs it silently (`/S` flag)
3. Waits for install to finish
4. Writes the game JSON to `$env:USERPROFILE\Desktop\neon-dash.raku`
5. Launches it with `RakuLauncher.exe`

**Second:** The complete `.raku` game JSON (so the user can also save it manually)

Do NOT include any explanations — just the PowerShell script and the JSON.
