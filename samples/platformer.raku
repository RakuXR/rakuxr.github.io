{
  "schema_version": "1.0",
  "game": {
    "title": "Bolt Runner",
    "genre": "platformer",
    "template": "platformer",
    "description": "Side-scrolling platformer with wall jumps and a robot character. AI adjusts obstacle density based on player skill.",
    "max_players": 1
  },
  "ai": {
    "dda_enabled": true,
    "target_flow_state": 0.75,
    "profiler_mode": "adaptive",
    "emotional_tracking": false,
    "npc_personality": false
  },
  "entities": [
    {
      "type": "player_character",
      "health": 3,
      "speed": 1.0,
      "properties": {
        "jump_height": 4.0,
        "wall_jump": true,
        "double_jump": false,
        "dash": true
      }
    },
    {
      "type": "enemy_wave",
      "count": 6,
      "health": 1,
      "speed": 0.5,
      "ai_behavior": "patrol",
      "properties": {
        "enemy_type": "walker",
        "patrol_range": 3.0
      }
    },
    {
      "type": "collectible",
      "count": 20,
      "properties": {
        "type": "coin",
        "value": 10
      }
    },
    {
      "type": "collectible",
      "count": 3,
      "properties": {
        "type": "checkpoint",
        "respawn_point": true
      }
    }
  ],
  "scenes": [
    {
      "name": "Main Menu",
      "type": "menu"
    },
    {
      "name": "Factory Floor",
      "type": "gameplay",
      "entities": ["player_character", "enemy_wave", "collectible"],
      "properties": {
        "theme": "industrial",
        "length": 200,
        "hazards": ["spikes", "crushers", "conveyor_belts"]
      }
    },
    {
      "name": "Rooftops",
      "type": "gameplay",
      "properties": {
        "theme": "urban_night",
        "length": 250,
        "hazards": ["gaps", "wind", "lasers"]
      }
    }
  ],
  "rendering": {
    "resolution": "auto",
    "fps_target": 60,
    "vrs_enabled": false,
    "post_processing": ["bloom", "color-grading", "motion-blur"]
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
    "description": "AI tracks death locations and adjusts platform spacing and enemy density. Repeated failures on a section trigger subtle difficulty reduction.",
    "systems": ["dda", "adaptive-audio"],
    "guardrails": "All levels remain completable at maximum difficulty. AI assistance is invisible to the player."
  }
}
