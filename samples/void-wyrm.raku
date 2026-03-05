{
  "raku_format": "1.0.0",
  "metadata": {
    "name": "Void Wyrm",
    "description": "Top-down roguelike arena game. Fight through procedural dungeon rooms, collect spell fragments, build custom combos, and defeat the Void Wyrm.",
    "genre": "arena_combat",
    "creator": "raku_sample",
    "created": "2026-03-02T10:00:00Z",
    "modified": "2026-03-02T10:00:00Z",
    "version": "1.0",
    "engine_version": "2026.2",
    "sharing": "public",
    "tags": ["roguelike", "arena", "sorcerer", "spells", "boss_fight", "adaptive_ai", "combo"],
    "thumbnail": "assets://thumbnails/void_wyrm.png",
    "estimated_play_time": "10-20 min",
    "player_count": {"min": 1, "max": 1},
    "complexity": "complex",
    "ai_disclosure": {
      "live_generated": true,
      "pre_generated": false,
      "description": "Dynamic difficulty adjustment scales enemy count/speed/HP to player skill. Adaptive audio crossfades between exploration, combat, and boss layers based on kill rate. Emotional state engine detects frustration and softens spawns. Enemies learn player dodge patterns via NPC memory. Intent predictor anticipates player movement.",
      "systems": ["dda", "adaptive_audio", "emotional_state", "player_profiling", "behavior_tree_ai", "npc_memory", "intent_prediction"],
      "guardrails": {
        "profanity_filter": true,
        "content_rating": "T",
        "report_endpoint": "https://api.raku.games/v1/reports"
      }
    }
  },
  "assets": {
    "textures": [
      {"id": "player_sorcerer", "source": "engine://textures/player_sorcerer.png"},
      {"id": "enemy_shambler", "source": "engine://textures/enemy_shambler.png"},
      {"id": "enemy_spitter", "source": "engine://textures/enemy_spitter.png"},
      {"id": "enemy_stalker", "source": "engine://textures/enemy_stalker.png"},
      {"id": "enemy_shieldbearer", "source": "engine://textures/enemy_shieldbearer.png"},
      {"id": "enemy_weaver", "source": "engine://textures/enemy_weaver.png"},
      {"id": "enemy_broodmother", "source": "engine://textures/enemy_broodmother.png"},
      {"id": "boss_void_wyrm", "source": "engine://textures/boss_void_wyrm.png"},
      {"id": "tileset_crypt", "source": "engine://textures/tileset_crypt.png"},
      {"id": "tileset_caverns", "source": "engine://textures/tileset_caverns.png"},
      {"id": "tileset_voidrift", "source": "engine://textures/tileset_voidrift.png"},
      {"id": "bg_fog_dark", "source": "engine://textures/fog_dark_layer.png"},
      {"id": "bg_particles_float", "source": "engine://textures/particles_floating.png"},
      {"id": "projectile_arcane", "source": "engine://textures/projectile_arcane.png"},
      {"id": "projectile_fire", "source": "engine://textures/projectile_fire.png"},
      {"id": "projectile_ice", "source": "engine://textures/projectile_ice.png"},
      {"id": "projectile_void", "source": "engine://textures/projectile_void.png"},
      {"id": "projectile_enemy_acid", "source": "engine://textures/projectile_acid.png"},
      {"id": "projectile_enemy_orb", "source": "engine://textures/projectile_homing_orb.png"},
      {"id": "powerup_chain_lightning", "source": "engine://textures/powerup_chain_lightning.png"},
      {"id": "powerup_flame_burst", "source": "engine://textures/powerup_flame_burst.png"},
      {"id": "powerup_ice_nova", "source": "engine://textures/powerup_ice_nova.png"},
      {"id": "powerup_arcane_missiles", "source": "engine://textures/powerup_arcane_missiles.png"},
      {"id": "powerup_life_drain", "source": "engine://textures/powerup_life_drain.png"},
      {"id": "powerup_ricochet", "source": "engine://textures/powerup_ricochet.png"},
      {"id": "powerup_piercing", "source": "engine://textures/powerup_piercing.png"},
      {"id": "powerup_gravity_well", "source": "engine://textures/powerup_gravity_well.png"},
      {"id": "vfx_explosion_sheet", "source": "engine://textures/explosion_sheet.png"},
      {"id": "vfx_death_poof", "source": "engine://textures/death_poof_sheet.png"},
      {"id": "particle_spark", "source": "engine://textures/particle_spark.png"},
      {"id": "icon_heart_full", "source": "engine://textures/icon_heart_full.png"},
      {"id": "icon_heart_empty", "source": "engine://textures/icon_heart_empty.png"},
      {"id": "icon_spell_slot", "source": "engine://textures/icon_spell_slot.png"}
    ],
    "models": [],
    "audio": [
      {"id": "bgm_crypt", "source": "engine://audio/bgm_crypt_eerie.ogg"},
      {"id": "bgm_caverns", "source": "engine://audio/bgm_caverns_drip.ogg"},
      {"id": "bgm_voidrift", "source": "engine://audio/bgm_voidrift_rumble.ogg"},
      {"id": "bgm_combat", "source": "engine://audio/bgm_combat_intense.ogg"},
      {"id": "bgm_boss", "source": "engine://audio/bgm_boss_theme.ogg"},
      {"id": "sfx_arcane_bolt", "source": "engine://audio/sfx_arcane_bolt.wav"},
      {"id": "sfx_flame_burst", "source": "engine://audio/sfx_flame_burst.wav"},
      {"id": "sfx_ice_nova", "source": "engine://audio/sfx_ice_nova.wav"},
      {"id": "sfx_chain_lightning", "source": "engine://audio/sfx_chain_lightning.wav"},
      {"id": "sfx_gravity_well", "source": "engine://audio/sfx_gravity_well.wav"},
      {"id": "sfx_enemy_death", "source": "engine://audio/sfx_enemy_death.wav"},
      {"id": "sfx_enemy_hit", "source": "engine://audio/sfx_hit_impact.wav"},
      {"id": "sfx_player_hit", "source": "engine://audio/sfx_player_hurt.wav"},
      {"id": "sfx_dodge_whoosh", "source": "engine://audio/sfx_dodge_whoosh.wav"},
      {"id": "sfx_heartbeat_low_hp", "source": "engine://audio/sfx_heartbeat_loop.wav"},
      {"id": "sfx_combo_chime", "source": "engine://audio/sfx_combo_chime.wav"},
      {"id": "sfx_combo_break", "source": "engine://audio/sfx_combo_break.wav"},
      {"id": "sfx_powerup_collect", "source": "engine://audio/sfx_powerup_collect.wav"},
      {"id": "sfx_boss_intro_sting", "source": "engine://audio/sfx_boss_intro_sting.wav"},
      {"id": "sfx_boss_roar", "source": "engine://audio/sfx_boss_roar.wav"},
      {"id": "sfx_room_clear", "source": "engine://audio/sfx_room_clear_fanfare.wav"},
      {"id": "sfx_spell_upgrade", "source": "engine://audio/sfx_spell_upgrade.wav"},
      {"id": "sfx_stalker_decloak", "source": "engine://audio/sfx_stalker_decloak.wav"},
      {"id": "sfx_shield_block", "source": "engine://audio/sfx_shield_block.wav"},
      {"id": "sfx_weaver_teleport", "source": "engine://audio/sfx_weaver_teleport.wav"}
    ],
    "fonts": [
      {"id": "ui_font", "source": "engine://fonts/default.ttf"},
      {"id": "title_font", "source": "engine://fonts/title_bold.ttf"},
      {"id": "combo_font", "source": "engine://fonts/combo_impact.ttf"}
    ]
  },
  "initialization": [
    {"function": "raku_init", "params": {}, "comment": "Initialize the Raku Engine core"},
    {"function": "raku_renderer_create_window", "params": {"width": 1280, "height": 720, "title": "Void Wyrm", "vsync": true, "fullscreen": false}, "comment": "Create game window"},
    {"function": "raku_renderer_set_clear_color", "params": {"color": [0.05, 0.0, 0.08, 1.0]}, "comment": "Dark purple-black void background"},
    {"function": "raku_physics_create_world", "params": {"gravity": [0, 0, 0]}, "comment": "Zero gravity for top-down arena"},
    {"function": "raku_audio_init", "params": {"channels": 32}, "comment": "32 mixing channels for layered audio"},
    {"function": "raku_input_init", "params": {}, "comment": "Initialize input subsystem"}
  ],
  "setup": [
    {"function": "raku_scene_create", "params": {"name": "dungeon_arena"}, "store_as": "$SCENE", "comment": "Create the main dungeon scene"},
    {"function": "raku_camera_create", "params": {"type": "RAKU_CAMERA_ORTHO", "scene": "$SCENE", "near": -1.0, "far": 100.0}, "store_as": "$CAMERA", "comment": "Orthographic camera for top-down view"},

    {"function": "raku_entity_create", "params": {"name": "fog_layer", "type": "RAKU_ENTITY_BACKGROUND", "scene": "$SCENE", "texture": "bg_fog_dark", "scroll_speed": [3, 5, 0], "layer": 0, "opacity": 0.3}, "store_as": "$BG_FOG", "comment": "Parallax dark fog background layer"},
    {"function": "raku_entity_create", "params": {"name": "particle_layer", "type": "RAKU_ENTITY_BACKGROUND", "scene": "$SCENE", "texture": "bg_particles_float", "scroll_speed": [1, 2, 0], "layer": 1, "opacity": 0.15}, "store_as": "$BG_PARTICLES", "comment": "Floating particle ambient layer"},

    {"function": "raku_entity_create", "params": {"name": "player_sorcerer", "type": "RAKU_ENTITY_SPRITE", "scene": "$SCENE", "texture": "player_sorcerer", "position": [640, 360, 0], "scale": [1.0, 1.0, 1.0], "layer": 10}, "store_as": "$PLAYER", "comment": "Player sorcerer entity at screen center"},
    {"function": "raku_entity_set_component", "params": {"entity": "$PLAYER", "component": "RAKU_COMPONENT_PHYSICS_BODY", "body_type": "kinematic", "collision_layer": 1, "collision_mask": 22}, "comment": "Player physics — collides with enemies (2), enemy bullets (4), pickups (16)"},
    {"function": "raku_entity_set_component", "params": {"entity": "$PLAYER", "component": "RAKU_COMPONENT_COLLIDER", "shape": "box", "size": [28, 32]}, "comment": "Tight player hitbox"},
    {"function": "raku_entity_set_component", "params": {"entity": "$PLAYER", "component": "RAKU_COMPONENT_HEALTH", "max_hp": 50, "current_hp": 50}, "comment": "5 hearts x 10 HP each = 50 total"},

    {"function": "raku_input_bind_action", "params": {"action": "move_left", "keys": ["A", "LEFT"]}, "comment": "Move left"},
    {"function": "raku_input_bind_action", "params": {"action": "move_right", "keys": ["D", "RIGHT"]}, "comment": "Move right"},
    {"function": "raku_input_bind_action", "params": {"action": "move_up", "keys": ["W", "UP"]}, "comment": "Move up"},
    {"function": "raku_input_bind_action", "params": {"action": "move_down", "keys": ["S", "DOWN"]}, "comment": "Move down"},
    {"function": "raku_input_bind_action", "params": {"action": "fire", "keys": ["MOUSE_LEFT"]}, "comment": "Primary fire — aim with mouse"},
    {"function": "raku_input_bind_action", "params": {"action": "dodge", "keys": ["SHIFT"]}, "comment": "Dodge roll"},
    {"function": "raku_input_bind_action", "params": {"action": "secondary", "keys": ["E"]}, "comment": "Secondary spell ability"},
    {"function": "raku_input_bind_action", "params": {"action": "ultimate", "keys": ["Q"]}, "comment": "Ultimate spell ability"},

    {"function": "raku_entity_create", "params": {"name": "player_bullet_pool", "type": "RAKU_ENTITY_POOL", "scene": "$SCENE", "pool_size": 60, "template_texture": "projectile_arcane", "template_collision_layer": 8, "template_collision_mask": 2, "template_collider_shape": "box", "template_collider_size": [10, 10]}, "store_as": "$PLAYER_BULLET_POOL", "comment": "Object pool for player projectiles"},
    {"function": "raku_entity_create", "params": {"name": "enemy_bullet_pool", "type": "RAKU_ENTITY_POOL", "scene": "$SCENE", "pool_size": 100, "template_texture": "projectile_enemy_acid", "template_collision_layer": 4, "template_collision_mask": 1, "template_collider_shape": "box", "template_collider_size": [8, 8]}, "store_as": "$ENEMY_BULLET_POOL", "comment": "Object pool for enemy projectiles"},
    {"function": "raku_entity_create", "params": {"name": "explosion_pool", "type": "RAKU_ENTITY_POOL", "scene": "$SCENE", "pool_size": 30, "template_texture": "vfx_explosion_sheet", "template_type": "RAKU_ENTITY_ANIMATED_SPRITE", "template_frame_count": 8, "template_fps": 16}, "store_as": "$EXPLOSION_POOL", "comment": "Object pool for explosion VFX"},
    {"function": "raku_entity_create", "params": {"name": "death_poof_pool", "type": "RAKU_ENTITY_POOL", "scene": "$SCENE", "pool_size": 20, "template_texture": "vfx_death_poof", "template_type": "RAKU_ENTITY_ANIMATED_SPRITE", "template_frame_count": 6, "template_fps": 12}, "store_as": "$DEATH_POOL", "comment": "Object pool for enemy death VFX"},
    {"function": "raku_entity_create", "params": {"name": "pickup_pool", "type": "RAKU_ENTITY_POOL", "scene": "$SCENE", "pool_size": 15, "template_collision_layer": 16, "template_collision_mask": 1, "template_collider_shape": "circle", "template_collider_size": [16, 16]}, "store_as": "$PICKUP_POOL", "comment": "Object pool for spell fragment pickups"},

    {"function": "raku_collision_register_handler", "params": {"scene": "$SCENE", "layer_a": 8, "layer_b": 2, "handler": "on_player_bullet_hit_enemy"}, "comment": "Player bullets (8) hit enemies (2)"},
    {"function": "raku_collision_register_handler", "params": {"scene": "$SCENE", "layer_a": 4, "layer_b": 1, "handler": "on_enemy_bullet_hit_player"}, "comment": "Enemy bullets (4) hit player (1)"},
    {"function": "raku_collision_register_handler", "params": {"scene": "$SCENE", "layer_a": 1, "layer_b": 2, "handler": "on_player_contact_enemy"}, "comment": "Player (1) touches enemy (2) — contact damage"},
    {"function": "raku_collision_register_handler", "params": {"scene": "$SCENE", "layer_a": 1, "layer_b": 16, "handler": "on_player_collect_pickup"}, "comment": "Player (1) collects pickup (16)"},

    {"function": "raku_timer_create", "params": {"name": "fire_cooldown", "interval": 0.12, "repeat": false}, "store_as": "$FIRE_CD", "comment": "Primary fire cooldown (0.12s between shots)"},
    {"function": "raku_timer_create", "params": {"name": "dodge_cooldown", "interval": 0.5, "repeat": false}, "store_as": "$DODGE_CD", "comment": "Dodge roll cooldown (0.5s)"},
    {"function": "raku_timer_create", "params": {"name": "combo_decay", "interval": 3.0, "repeat": false, "callback": "reset_combo"}, "store_as": "$COMBO_DECAY", "comment": "Combo resets if no kill within 3 seconds"},
    {"function": "raku_timer_create", "params": {"name": "room_clear_check", "interval": 0.5, "repeat": true, "callback": "check_room_cleared"}, "store_as": "$ROOM_CHECK", "comment": "Check every 0.5s if all enemies in room are dead"},
    {"function": "raku_timer_create", "params": {"name": "heartbeat_trigger", "interval": 1.0, "repeat": true, "callback": "check_low_hp_heartbeat"}, "store_as": "$HEARTBEAT_TIMER", "comment": "Triggers heartbeat SFX when HP below 20%"},

    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "heart_1", "texture": "icon_heart_full", "position": [20, 20], "size": [28, 28]}, "store_as": "$HEART_1", "comment": "Heart 1 of 5"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "heart_2", "texture": "icon_heart_full", "position": [54, 20], "size": [28, 28]}, "store_as": "$HEART_2", "comment": "Heart 2 of 5"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "heart_3", "texture": "icon_heart_full", "position": [88, 20], "size": [28, 28]}, "store_as": "$HEART_3", "comment": "Heart 3 of 5"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "heart_4", "texture": "icon_heart_full", "position": [122, 20], "size": [28, 28]}, "store_as": "$HEART_4", "comment": "Heart 4 of 5"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "heart_5", "texture": "icon_heart_full", "position": [156, 20], "size": [28, 28]}, "store_as": "$HEART_5", "comment": "Heart 5 of 5"},

    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "spell_slot_1", "texture": "icon_spell_slot", "position": [20, 680], "size": [40, 40]}, "store_as": "$SPELL_SLOT_1", "comment": "Primary spell slot icon"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "spell_slot_2", "texture": "icon_spell_slot", "position": [68, 680], "size": [40, 40]}, "store_as": "$SPELL_SLOT_2", "comment": "Secondary spell slot icon"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_IMAGE", "name": "spell_slot_3", "texture": "icon_spell_slot", "position": [116, 680], "size": [40, 40]}, "store_as": "$SPELL_SLOT_3", "comment": "Ultimate spell slot icon"},

    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_TEXT", "name": "combo_counter", "text": "", "position": [640, 60], "font": "combo_font", "font_size": 48, "color": [1.0, 0.85, 0.0, 0.0], "anchor": "center"}, "store_as": "$COMBO_UI", "comment": "Combo multiplier display — large gold text, center-top, hidden until first combo"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_TEXT", "name": "score_display", "text": "0", "position": [1200, 20], "font": "ui_font", "font_size": 24, "color": [1.0, 1.0, 1.0, 1.0], "anchor": "right"}, "store_as": "$SCORE_UI", "comment": "Score display top-right"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_TEXT", "name": "room_counter", "text": "ROOM 1", "position": [640, 20], "font": "ui_font", "font_size": 20, "color": [0.7, 0.7, 0.9, 1.0], "anchor": "center"}, "store_as": "$ROOM_UI", "comment": "Current room number display"},
    {"function": "raku_ui_create_element", "params": {"type": "RAKU_UI_PROGRESS_BAR", "name": "boss_hp_bar", "position": [340, 690], "size": [600, 20], "value": 1.0, "color_fg": [0.8, 0.0, 0.2, 1.0], "color_bg": [0.2, 0.0, 0.05, 0.8], "visible": false}, "store_as": "$BOSS_HP_BAR", "comment": "Boss HP bar — hidden until boss room, wide red bar at bottom-center"},

    {"function": "raku_audio_play", "params": {"asset": "bgm_crypt", "loop": true, "volume": 0.35}, "store_as": "$BGM_HANDLE", "comment": "Start with crypt ambient music (first biome)"}
  ],
  "game_loop": {
    "pre_frame": [
      {"function": "raku_input_poll", "params": {}, "comment": "Poll all input devices"},
      {"function": "raku_timer_update", "params": {}, "comment": "Update all timers (cooldowns, combo decay, room check)"}
    ],
    "update": [
      {"function": "raku_input_handle", "params": {"entity": "$PLAYER", "mapping": "twin_stick_controls", "speed": 280.0, "bounds": [32, 32, 1248, 688]}, "comment": "Player movement at 280 speed, clamped to room bounds"},
      {"function": "raku_entity_pool_fire", "params": {"pool": "$PLAYER_BULLET_POOL", "trigger_action": "fire", "cooldown_timer": "$FIRE_CD", "spawn_offset": [0, -16], "velocity": [0, -700, 0], "source_entity": "$PLAYER", "aim_mode": "mouse_direction", "sfx": "sfx_arcane_bolt"}, "comment": "Fire arcane bolts toward mouse cursor with cooldown"},
      {"function": "raku_physics_step", "params": {"delta": "$DELTA_TIME"}, "comment": "Step physics simulation"},
      {"function": "raku_entity_update_all", "params": {"scene": "$SCENE", "delta": "$DELTA_TIME"}, "comment": "Update all entity positions, animations, and logic"},
      {"function": "raku_collision_check", "params": {"scene": "$SCENE"}, "comment": "Detect and dispatch all collision events"},
      {"function": "raku_entity_pool_cull_oob", "params": {"pool": "$PLAYER_BULLET_POOL", "bounds": [-50, -50, 1330, 770]}, "comment": "Reclaim player bullets that left the screen"},
      {"function": "raku_entity_pool_cull_oob", "params": {"pool": "$ENEMY_BULLET_POOL", "bounds": [-50, -50, 1330, 770]}, "comment": "Reclaim enemy bullets that left the screen"},
      {"function": "raku_dda_update", "params": {}, "comment": "Dynamic difficulty tick — adjusts spawn count, speed, HP, powerup quality"},
      {"function": "raku_adaptive_audio_update", "params": {}, "comment": "Crossfade between exploration/combat/boss music layers based on intensity"},
      {"function": "raku_audio_spatial_compute_ex", "params": {"scene": "$SCENE"}, "comment": "Spatial audio positioning for enemy sounds and projectile whizzes"}
    ],
    "render": [
      {"function": "raku_renderer_begin_frame", "params": {}, "comment": "Begin render frame"},
      {"function": "raku_scene_render", "params": {"scene": "$SCENE", "camera": "$CAMERA"}, "comment": "Render dungeon tiles, entities, projectiles, VFX"},
      {"function": "raku_ui_render", "params": {}, "comment": "Render HUD — hearts, spell slots, combo counter, score, room number, boss HP"},
      {"function": "raku_renderer_end_frame", "params": {}, "comment": "End frame and swap buffers"}
    ],
    "post_frame": [
      {"function": "raku_ai_profiler_record_shot", "params": {"player_id": "$PLAYER_ID"}, "comment": "Record shot event for accuracy tracking"},
      {"function": "raku_profiler_end_frame", "params": {}, "comment": "Submit frame data to player profiler"},
      {"function": "raku_telemetry_flush", "params": {}, "comment": "Flush telemetry events"}
    ]
  },
  "ai_pipeline": [
    {"function": "raku_profiler_create", "params": {"player_id": "$PLAYER_ID", "type": "RAKU_PROFILE_ADAPTIVE"}, "store_as": "$PROFILER", "comment": "Create adaptive player profiler"},
    {"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "accuracy", "source": "hit_events", "window": 30.0}, "comment": "Track shot accuracy over 30s window"},
    {"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "dodge_frequency", "source": "dodge_events", "window": 20.0}, "comment": "Track how often player dodges"},
    {"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "damage_taken_rate", "source": "health_events", "window": 20.0}, "comment": "Track damage intake rate"},
    {"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "kill_rate", "source": "kill_events", "window": 15.0}, "comment": "Track kills per second"},
    {"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "combo_streak", "source": "combo_events"}, "comment": "Track current combo multiplier"},
    {"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "spell_slot_usage", "source": "spell_events"}, "comment": "Track which spell slots player favors"},
    {"function": "raku_profiler_track_metric", "params": {"profiler": "$PROFILER", "metric": "room_clear_time", "source": "timer"}, "comment": "Track time to clear each room"},

    {"function": "raku_dda_enable", "params": {"profiler": "$PROFILER"}, "comment": "Enable DDA linked to player profiler"},
    {"function": "raku_dda_set_target_flow", "params": {"value": 0.72}, "comment": "Target 72% flow state — challenging but not frustrating"},
    {"function": "raku_dda_set_param", "params": {"name": "enemy_spawn_count", "min": 0.6, "max": 2.0, "default": 1.0}, "comment": "DDA scales how many enemies spawn per room"},
    {"function": "raku_dda_set_param", "params": {"name": "enemy_speed", "min": 0.7, "max": 1.5, "default": 1.0}, "comment": "DDA scales enemy movement speed"},
    {"function": "raku_dda_set_param", "params": {"name": "enemy_fire_rate", "min": 0.4, "max": 1.8, "default": 1.0}, "comment": "DDA scales enemy shooting frequency"},
    {"function": "raku_dda_set_param", "params": {"name": "powerup_quality", "min": 0.5, "max": 2.0, "default": 1.0}, "comment": "DDA scales spell upgrade quality offered"},
    {"function": "raku_dda_set_param", "params": {"name": "enemy_hp_multiplier", "min": 0.6, "max": 1.6, "default": 1.0}, "comment": "DDA scales enemy health"},

    {"function": "raku_adaptive_audio_enable", "params": {"profiler": "$PROFILER"}, "comment": "Enable adaptive audio driven by profiler"},
    {"function": "raku_adaptive_audio_set_intensity_source", "params": {"metric": "kill_rate", "min_threshold": 0.0, "max_threshold": 3.0}, "comment": "Audio intensity scales with kill rate"},
    {"function": "raku_adaptive_audio_set_layer", "params": {"layer": "exploration", "asset": "bgm_crypt", "intensity_range": [0.0, 0.3]}, "comment": "Quiet exploration music when few kills"},
    {"function": "raku_adaptive_audio_set_layer", "params": {"layer": "combat", "asset": "bgm_combat", "intensity_range": [0.3, 0.7]}, "comment": "Intense combat music during active fighting"},
    {"function": "raku_adaptive_audio_set_layer", "params": {"layer": "boss", "asset": "bgm_boss", "intensity_range": [0.7, 1.0]}, "comment": "Boss theme at peak intensity"},

    {"function": "raku_npc_create", "params": {"name": "shambler_template", "behavior": "RAKU_BEHAVIOR_SWARM", "texture": "enemy_shambler", "hp": 30, "speed": 60, "fire_rate": 0.0, "fire_pattern": "none", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 10, "contact_damage": 5}, "store_as": "$SHAMBLER_TPL", "comment": "Shambler — slow melee swarm, 30 HP, chases player in groups"},
    {"function": "raku_npc_set_behavior", "params": {"npc": "$SHAMBLER_TPL", "on_spawn": "enter_from_edge", "on_death": "drop_powerup_chance_5"}, "comment": "Shamblers enter from room edges, 5% powerup drop"},

    {"function": "raku_npc_create", "params": {"name": "spitter_template", "behavior": "RAKU_BEHAVIOR_STRAFE_AND_SHOOT", "texture": "enemy_spitter", "hp": 20, "speed": 80, "fire_rate": 0.6, "fire_pattern": "spread_3", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 15, "contact_damage": 5}, "store_as": "$SPITTER_TPL", "comment": "Spitter — ranged, fires acid spread, 20 HP"},
    {"function": "raku_npc_set_behavior", "params": {"npc": "$SPITTER_TPL", "on_spawn": "enter_from_edge", "on_death": "drop_powerup_chance_10"}, "comment": "Spitters strafe and fire, 10% powerup drop"},

    {"function": "raku_npc_create", "params": {"name": "stalker_template", "behavior": "RAKU_BEHAVIOR_STEALTH_LUNGE", "texture": "enemy_stalker", "hp": 15, "speed": 140, "fire_rate": 0.0, "fire_pattern": "none", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 20, "contact_damage": 15}, "store_as": "$STALKER_TPL", "comment": "Stalker — invisible approach, fast lunge attack, 15 HP, high contact damage"},
    {"function": "raku_npc_set_behavior", "params": {"npc": "$STALKER_TPL", "on_spawn": "cloak_and_enter", "on_death": "drop_powerup_chance_15"}, "comment": "Stalkers cloak on spawn, 15% powerup drop"},

    {"function": "raku_npc_create", "params": {"name": "shieldbearer_template", "behavior": "RAKU_BEHAVIOR_SLOW_ADVANCE", "texture": "enemy_shieldbearer", "hp": 60, "speed": 50, "fire_rate": 0.0, "fire_pattern": "none", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 25, "contact_damage": 10, "frontal_shield": true}, "store_as": "$SHIELDBEARER_TPL", "comment": "Shieldbearer — frontal shield blocks projectiles, must flank, 60 HP"},
    {"function": "raku_npc_set_behavior", "params": {"npc": "$SHIELDBEARER_TPL", "on_spawn": "enter_facing_player", "on_death": "drop_powerup_chance_20"}, "comment": "Shieldbearers always face player, 20% powerup drop"},

    {"function": "raku_npc_create", "params": {"name": "weaver_template", "behavior": "RAKU_BEHAVIOR_TELEPORT_AND_SHOOT", "texture": "enemy_weaver", "hp": 25, "speed": 90, "fire_rate": 0.8, "fire_pattern": "homing_single", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 30, "contact_damage": 8, "teleport_cooldown": 3.0}, "store_as": "$WEAVER_TPL", "comment": "Weaver — teleports around room, fires homing orbs, 25 HP"},
    {"function": "raku_npc_set_behavior", "params": {"npc": "$WEAVER_TPL", "on_spawn": "teleport_in", "on_death": "drop_powerup_chance_20"}, "comment": "Weavers teleport in and out, 20% powerup drop"},

    {"function": "raku_npc_create", "params": {"name": "broodmother_template", "behavior": "RAKU_BEHAVIOR_BOSS_PATTERN", "texture": "enemy_broodmother", "hp": 200, "speed": 40, "fire_rate": 0.3, "fire_pattern": "burst_5", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 100, "contact_damage": 20, "spawn_on_interval": "shambler_template", "spawn_interval": 5.0, "spawn_count": 3}, "store_as": "$BROODMOTHER_TPL", "comment": "Broodmother — mini-boss, spawns 3 shamblers every 5s, slam attack, 200 HP"},
    {"function": "raku_npc_set_behavior", "params": {"npc": "$BROODMOTHER_TPL", "on_spawn": "enter_slow_center", "on_death": "drop_powerup_guaranteed"}, "comment": "Broodmother lumbers to center, guaranteed powerup drop"},

    {"function": "raku_npc_create", "params": {"name": "void_wyrm_template", "behavior": "RAKU_BEHAVIOR_BOSS_PATTERN", "texture": "boss_void_wyrm", "hp": 800, "speed": 120, "fire_rate": 0.5, "fire_pattern": "circular", "bullet_pool": "$ENEMY_BULLET_POOL", "collision_layer": 2, "collision_mask": 9, "score_value": 1000, "contact_damage": 25, "phases": 4}, "store_as": "$VOID_WYRM_TPL", "comment": "Void Wyrm — final boss, 800 HP, 4 combat phases"},
    {"function": "raku_npc_set_behavior", "params": {"npc": "$VOID_WYRM_TPL", "on_spawn": "boss_intro_animation", "on_death": "victory_sequence"}, "comment": "Void Wyrm has cinematic intro and victory on defeat"},

    {"function": "raku_bt_create", "params": {"name": "shieldbearer_bt"}, "store_as": "$SHIELDBEARER_BT", "comment": "Behavior tree for Shieldbearer AI"},
    {"function": "raku_bt_selector", "params": {"tree": "$SHIELDBEARER_BT", "name": "root"}, "comment": "Root selector — pick behavior based on player position"},
    {"function": "raku_bt_sequence", "params": {"tree": "$SHIELDBEARER_BT", "name": "shield_advance", "parent": "root"}, "comment": "If player is in front, raise shield and advance"},
    {"function": "raku_bt_condition", "params": {"tree": "$SHIELDBEARER_BT", "name": "player_in_front", "parent": "shield_advance", "condition": "player_in_frontal_arc_90"}, "comment": "Check if player is within 90-degree frontal arc"},
    {"function": "raku_bt_action", "params": {"tree": "$SHIELDBEARER_BT", "name": "raise_and_advance", "parent": "shield_advance", "action": "raise_shield_advance_toward_player"}, "comment": "Raise shield and slowly walk toward player"},
    {"function": "raku_bt_sequence", "params": {"tree": "$SHIELDBEARER_BT", "name": "charge_flanked", "parent": "root"}, "comment": "If player is behind/side, drop shield and charge"},
    {"function": "raku_bt_action", "params": {"tree": "$SHIELDBEARER_BT", "name": "charge", "parent": "charge_flanked", "action": "charge_toward_player"}, "comment": "Fast charge toward player without shield"},

    {"function": "raku_bt_create", "params": {"name": "stalker_bt"}, "store_as": "$STALKER_BT", "comment": "Behavior tree for Stalker AI"},
    {"function": "raku_bt_sequence", "params": {"tree": "$STALKER_BT", "name": "root"}, "comment": "Root sequence — cloak, approach, decloak, lunge"},
    {"function": "raku_bt_action", "params": {"tree": "$STALKER_BT", "name": "cloak", "parent": "root", "action": "activate_cloak"}, "comment": "Go invisible"},
    {"function": "raku_bt_action", "params": {"tree": "$STALKER_BT", "name": "approach", "parent": "root", "action": "move_toward_player_cloaked", "speed": 100}, "comment": "Silently approach player while invisible"},
    {"function": "raku_bt_condition", "params": {"tree": "$STALKER_BT", "name": "in_range", "parent": "root", "condition": "distance_to_player_less_than_80"}, "comment": "Wait until within 80 units of player"},
    {"function": "raku_bt_action", "params": {"tree": "$STALKER_BT", "name": "decloak_and_lunge", "parent": "root", "action": "decloak_lunge_attack", "sfx": "sfx_stalker_decloak"}, "comment": "Decloak with audio cue and lunge at player"},

    {"function": "raku_bt_create", "params": {"name": "void_wyrm_bt"}, "store_as": "$VOID_WYRM_BT", "comment": "Behavior tree for Void Wyrm — 4-phase boss fight"},
    {"function": "raku_bt_selector", "params": {"tree": "$VOID_WYRM_BT", "name": "root"}, "comment": "Root selector — choose phase based on HP threshold"},

    {"function": "raku_bt_sequence", "params": {"tree": "$VOID_WYRM_BT", "name": "phase1_coil_strike", "parent": "root"}, "comment": "Phase 1 (HP > 75%): Coil and strike pattern"},
    {"function": "raku_bt_condition", "params": {"tree": "$VOID_WYRM_BT", "name": "check_hp_above_75", "parent": "phase1_coil_strike", "condition": "hp_above_75_percent"}, "comment": "Active while HP above 75%"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "coil_up", "parent": "phase1_coil_strike", "action": "boss_coil_animation"}, "comment": "Wyrm coils body (telegraph)"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "strike", "parent": "phase1_coil_strike", "action": "fire_pattern_circular"}, "comment": "Release circular bullet pattern"},

    {"function": "raku_bt_sequence", "params": {"tree": "$VOID_WYRM_BT", "name": "phase2_burrow", "parent": "root"}, "comment": "Phase 2 (50-75% HP): Burrow and emerge attack"},
    {"function": "raku_bt_condition", "params": {"tree": "$VOID_WYRM_BT", "name": "check_hp_50_75", "parent": "phase2_burrow", "condition": "hp_between_50_75_percent"}, "comment": "Active between 50-75% HP"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "burrow", "parent": "phase2_burrow", "action": "boss_burrow_underground"}, "comment": "Wyrm burrows — invulnerable, ground trembles"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "emerge_strike", "parent": "phase2_burrow", "action": "boss_emerge_at_player_position"}, "comment": "Emerge at player's last position with AOE damage"},

    {"function": "raku_bt_sequence", "params": {"tree": "$VOID_WYRM_BT", "name": "phase3_summon_beam", "parent": "root"}, "comment": "Phase 3 (25-50% HP): Summon adds + beam sweep"},
    {"function": "raku_bt_condition", "params": {"tree": "$VOID_WYRM_BT", "name": "check_hp_25_50", "parent": "phase3_summon_beam", "condition": "hp_between_25_50_percent"}, "comment": "Active between 25-50% HP"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "summon_adds", "parent": "phase3_summon_beam", "action": "spawn_shambler_wave", "count": 4}, "comment": "Summon 4 shamblers to overwhelm player"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "beam_sweep", "parent": "phase3_summon_beam", "action": "fire_beam_sweep_360"}, "comment": "Slow rotating beam sweep across the arena"},

    {"function": "raku_bt_sequence", "params": {"tree": "$VOID_WYRM_BT", "name": "phase4_enrage", "parent": "root"}, "comment": "Phase 4 (HP < 25%): Enrage — double speed, constant fire"},
    {"function": "raku_bt_condition", "params": {"tree": "$VOID_WYRM_BT", "name": "check_hp_below_25", "parent": "phase4_enrage", "condition": "hp_below_25_percent"}, "comment": "Active below 25% HP — desperation mode"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "enrage_buff", "parent": "phase4_enrage", "action": "set_speed_multiplier", "value": 2.0}, "comment": "Double movement speed"},
    {"function": "raku_bt_action", "params": {"tree": "$VOID_WYRM_BT", "name": "barrage", "parent": "phase4_enrage", "action": "fire_pattern_barrage"}, "comment": "Constant barrage of projectiles in all directions"},

    {"function": "raku_emotional_state_create", "params": {"player_id": "$PLAYER_ID"}, "store_as": "$EMOTIONAL_STATE", "comment": "Emotional state engine — fuses damage rate, combo streak, and room clear time to estimate frustration/engagement"},
    {"function": "raku_intent_predictor_create", "params": {"player_id": "$PLAYER_ID", "model": "RAKU_LSTM_LIGHTWEIGHT"}, "store_as": "$INTENT_PRED", "comment": "LSTM intent predictor — anticipates player dodge direction from recent input history"},

    {"function": "raku_npc_memory_store", "params": {"npc": "$SHAMBLER_TPL", "key": "player_dodge_pattern", "value": "profiler"}, "comment": "Shamblers learn player dodge tendencies across rooms"},
    {"function": "raku_npc_memory_store", "params": {"npc": "$SPITTER_TPL", "key": "player_dodge_pattern", "value": "profiler"}, "comment": "Spitters adjust spread timing based on dodge patterns"},
    {"function": "raku_npc_memory_store", "params": {"npc": "$WEAVER_TPL", "key": "player_position_preference", "value": "profiler"}, "comment": "Weavers learn where player tends to stand and teleport to cut off retreats"},
    {"function": "raku_npc_set_knowledge", "params": {"npc": "$VOID_WYRM_TPL", "key": "player_skill", "value": "profiler"}, "comment": "Void Wyrm adapts bullet density to player's demonstrated skill level"}
  ],
  "shutdown": [
    {"function": "raku_audio_stop_all", "params": {}, "comment": "Stop all audio playback"},
    {"function": "raku_scene_destroy", "params": {"scene": "$SCENE"}, "comment": "Destroy the dungeon scene and all entities"},
    {"function": "raku_physics_destroy_world", "params": {}, "comment": "Tear down the physics world"},
    {"function": "raku_renderer_destroy_window", "params": {}, "comment": "Close the rendering window"},
    {"function": "raku_shutdown", "params": {}, "comment": "Shut down the Raku Engine"}
  ]
}
