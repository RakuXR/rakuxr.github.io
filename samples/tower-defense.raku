{
  "schema_version": "1.0",
  "game": {
    "title": "Crystal Guardians",
    "genre": "tower-defense",
    "template": "tower-defense",
    "description": "Strategic tower defense with AI that adapts wave composition to counter your favorite tower placements.",
    "max_players": 1
  },
  "ai": {
    "dda_enabled": true,
    "target_flow_state": 0.65,
    "profiler_mode": "learning",
    "emotional_tracking": false,
    "npc_personality": false
  },
  "entities": [
    {
      "type": "tower",
      "properties": {
        "tower_type": "arrow",
        "damage": 15,
        "range": 5.0,
        "fire_rate": 1.2,
        "cost": 100
      }
    },
    {
      "type": "tower",
      "properties": {
        "tower_type": "frost",
        "damage": 5,
        "range": 4.0,
        "fire_rate": 0.8,
        "cost": 150,
        "slow_effect": 0.4
      }
    },
    {
      "type": "tower",
      "properties": {
        "tower_type": "cannon",
        "damage": 50,
        "range": 3.0,
        "fire_rate": 0.3,
        "cost": 250,
        "splash_radius": 2.0
      }
    },
    {
      "type": "enemy_wave",
      "count": 15,
      "health": 30,
      "speed": 0.8,
      "ai_behavior": "path_follow",
      "properties": {
        "enemy_type": "grunt",
        "gold_reward": 10
      }
    },
    {
      "type": "enemy_wave",
      "count": 5,
      "health": 120,
      "speed": 0.4,
      "ai_behavior": "path_follow",
      "properties": {
        "enemy_type": "armored",
        "gold_reward": 30,
        "armor": 10
      }
    }
  ],
  "scenes": [
    {
      "name": "Main Menu",
      "type": "menu"
    },
    {
      "name": "Forest Path",
      "type": "gameplay",
      "properties": {
        "map_type": "winding_path",
        "starting_gold": 500,
        "starting_lives": 20,
        "total_waves": 15
      }
    }
  ],
  "rendering": {
    "resolution": "auto",
    "fps_target": 60,
    "vrs_enabled": true,
    "post_processing": ["ssao", "color-grading"]
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
    "description": "AI learns the player's preferred tower types and adjusts enemy wave composition to provide balanced challenge. If player favors frost towers, more frost-resistant enemies appear.",
    "systems": ["dda", "player-profiling"],
    "guardrails": "Difficulty adjustment ensures at least 40% of enemies remain vulnerable to the player's strongest towers. No unwinnable waves."
  }
}
