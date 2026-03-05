{
  "schema_version": "1.0",
  "game": {
    "title": "Zombie Survival",
    "genre": "survival",
    "template": "survival",
    "description": "Survive zombie hordes with day/night cycles, crafting, and base building. Zombies get more aggressive at night. AI tracks your emotional state and backs off when you're frustrated.",
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
      "type": "player",
      "health": 100,
      "speed": 1.0,
      "properties": {
        "stamina": 100,
        "inventory_slots": 20,
        "crafting_enabled": true,
        "base_building_enabled": true
      }
    },
    {
      "type": "zombie_shambler",
      "count": 12,
      "health": 40,
      "speed": 0.4,
      "ai_behavior": "swarm",
      "properties": {
        "day_aggression": 0.3,
        "night_aggression": 0.8,
        "detection_range_day": 15,
        "detection_range_night": 30
      }
    },
    {
      "type": "zombie_runner",
      "count": 4,
      "health": 25,
      "speed": 1.2,
      "ai_behavior": "swarm",
      "properties": {
        "night_only": true,
        "detection_range_night": 40
      }
    },
    {
      "type": "resource_node",
      "count": 30,
      "properties": {
        "resource_type": "wood",
        "gather_time": 2.0,
        "yield": 3
      }
    },
    {
      "type": "resource_node",
      "count": 20,
      "properties": {
        "resource_type": "stone",
        "gather_time": 3.0,
        "yield": 2
      }
    },
    {
      "type": "collectible",
      "count": 8,
      "properties": {
        "type": "medical_kit",
        "heal_amount": 30,
        "spawn_chance": 0.1
      }
    }
  ],
  "scenes": [
    {
      "name": "Main Menu",
      "type": "menu"
    },
    {
      "name": "Survival World",
      "type": "gameplay",
      "entities": ["player", "zombie_shambler", "zombie_runner", "resource_node", "collectible"],
      "properties": {
        "day_night_cycle": true,
        "day_duration_minutes": 20,
        "night_duration_minutes": 10,
        "crafting_recipes": ["wood_barricade", "stone_wall", "campfire", "wooden_spear", "medical_bandage"],
        "base_building": true,
        "max_base_size": 200
      }
    },
    {
      "name": "Game Over",
      "type": "menu"
    }
  ],
  "rendering": {
    "resolution": "auto",
    "fps_target": 60,
    "vrs_enabled": true,
    "post_processing": ["bloom", "color-grading", "fog"]
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
    "description": "Dynamic difficulty adjustment scales zombie aggression, spawn rates, and resource availability based on player performance. Emotional tracking detects frustration and reduces difficulty automatically.",
    "systems": ["dda", "emotional-tracking", "adaptive-audio", "player-profiling"],
    "guardrails": "AI difficulty bounded between 0.3 and 0.9 to prevent frustration. Emotional tracking reduces zombie aggression when frustration is detected. No player data leaves the device."
  }
}
