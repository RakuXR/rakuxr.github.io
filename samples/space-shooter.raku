{
  "schema_version": "1.0",
  "game": {
    "title": "Cosmic Defender",
    "genre": "shooter",
    "template": "space-shooter",
    "description": "Classic arcade space shooter with AI-driven difficulty scaling. Enemies adapt to your playstyle in real time.",
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
      "properties": {
        "weapon": "dual_laser",
        "shield_capacity": 50,
        "lives": 3
      }
    },
    {
      "type": "enemy_wave",
      "count": 8,
      "health": 20,
      "speed": 0.6,
      "ai_behavior": "swarm",
      "properties": {
        "formation": "v_shape",
        "fire_rate": 0.5
      }
    },
    {
      "type": "enemy_wave",
      "count": 4,
      "health": 60,
      "speed": 0.3,
      "ai_behavior": "tank",
      "properties": {
        "formation": "line",
        "fire_rate": 1.0,
        "shield": true
      }
    },
    {
      "type": "collectible",
      "count": 5,
      "properties": {
        "type": "health_pack",
        "heal_amount": 25,
        "spawn_chance": 0.15
      }
    },
    {
      "type": "collectible",
      "count": 3,
      "properties": {
        "type": "weapon_upgrade",
        "upgrade_level": 1,
        "spawn_chance": 0.08
      }
    }
  ],
  "scenes": [
    {
      "name": "Main Menu",
      "type": "menu"
    },
    {
      "name": "Asteroid Field",
      "type": "gameplay",
      "entities": ["player_ship", "enemy_wave", "collectible"],
      "properties": {
        "background": "starfield",
        "asteroid_density": 0.3,
        "wave_count": 10
      }
    },
    {
      "name": "Boss Battle",
      "type": "gameplay",
      "properties": {
        "background": "nebula",
        "boss_type": "mothership",
        "boss_health": 500
      }
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
    "pre_generated": true,
    "description": "Dynamic difficulty adjustment scales enemy count, speed, and aggression based on player performance. Adaptive music responds to combat intensity. Emotional state tracking adjusts pacing.",
    "systems": ["dda", "adaptive-audio", "emotional-tracking"],
    "guardrails": "AI difficulty adjustment is bounded to prevent frustration (min 0.3) and boredom (max 0.95). No player data leaves the device."
  }
}
