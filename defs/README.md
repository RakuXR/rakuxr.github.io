# Raku Engine Export Definitions

This directory contains `.def` files for all 16 Raku runtime DLLs. These files define the ordinal-only exports used for linking at build time.

## Files

| File | DLL | Exports |
|------|-----|---------|
| RakuCore.def | RakuCore.dll | Core lifecycle, memory, threading, IO |
| RakuScene.def | RakuScene.dll | Scene graph, transforms, spatial queries |
| RakuRenderer.def | RakuRenderer.dll | PBR materials, lighting, post-processing |
| RakuXR.def | RakuXR.dll | OpenXR, hand/eye tracking, spatial anchors |
| RakuPhysics.def | RakuPhysics.dll | Rigid body, collision, raycasting |
| RakuAudio.def | RakuAudio.dll | Spatial audio, HRTF, adaptive music |
| RakuAnimation.def | RakuAnimation.dll | Skeletal animation, blend trees, IK |
| RakuAI.def | RakuAI.dll | DDA, player profiling, NPC behavior |
| RakuSLM.def | RakuSLM.dll | On-device language model inference |
| RakuNetwork.def | RakuNetwork.dll | Multiplayer, WebRTC, matchmaking |
| RakuVoice.def | RakuVoice.dll | Voice commands, speech recognition |
| RakuInput.def | RakuInput.dll | Keyboard, mouse, gamepad, touch |
| RakuUI.def | RakuUI.dll | UI widgets, layout, text rendering |
| RakuAssets.def | RakuAssets.dll | Asset loading, caching, streaming |
| RakuEditor.def | RakuEditor.dll | Runtime editor tools, debug visualization |
| RakuScripting.def | RakuScripting.dll | Game scripting, .raku file parsing |

## IP Protection

All exports use **NONAME** ordinals. Function names are not embedded in the compiled DLLs, preventing casual symbol recovery from distributed binaries.

## License

The API definitions in this directory are provided for game development purposes only. Reverse engineering, decompilation, or reconstruction of engine internals from these definitions is prohibited. See the repository LICENSE for full terms.

Copyright (c) 2026 RakuAI, LLC. All rights reserved.
