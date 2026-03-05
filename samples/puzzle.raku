{
  "schema_version": "1.0",
  "game": {
    "title": "Gem Cascade",
    "genre": "puzzle",
    "template": "puzzle",
    "description": "Color-matching tile puzzle with progressive difficulty. AI detects player frustration and adjusts complexity in real time.",
    "max_players": 1
  },
  "ai": {
    "dda_enabled": true,
    "target_flow_state": 0.6,
    "profiler_mode": "adaptive",
    "emotional_tracking": true,
    "npc_personality": false
  },
  "entities": [
    {
      "type": "game_board",
      "properties": {
        "width": 8,
        "height": 8,
        "gem_types": 6,
        "match_minimum": 3
      }
    },
    {
      "type": "collectible",
      "properties": {
        "type": "power_gem",
        "effect": "clear_row",
        "spawn_chance": 0.05
      }
    }
  ],
  "scenes": [
    {
      "name": "Main Menu",
      "type": "menu"
    },
    {
      "name": "Classic Mode",
      "type": "gameplay",
      "properties": {
        "mode": "timed",
        "time_limit": 120,
        "target_score": 5000
      }
    },
    {
      "name": "Endless Mode",
      "type": "gameplay",
      "properties": {
        "mode": "endless",
        "speed_increase_per_level": 0.05
      }
    }
  ],
  "rendering": {
    "resolution": "auto",
    "fps_target": 60,
    "vrs_enabled": false,
    "post_processing": ["bloom", "color-grading"]
  },
  "audio": {
    "spatial_audio": false,
    "adaptive_music": true,
    "voice_commands": false
  },
  "xr": {
    "openxr_enabled": false
  },
  "ai_disclosure": {
    "live_generated": true,
    "pre_generated": false,
    "description": "AI monitors match patterns and solve times to detect frustration. When detected, board layouts shift to include more obvious matches. Music tempo adjusts to player state.",
    "systems": ["dda", "emotional-tracking", "adaptive-audio"],
    "guardrails": "Emotional tracking uses only input timing patterns, never camera or microphone. Board always has at least one valid move."
  }
}
