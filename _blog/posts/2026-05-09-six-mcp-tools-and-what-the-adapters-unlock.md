---
title: "Six MCP Tools, and What the Adapters Unlock Next"
date: 2026-05-09
author: Kevin Griffin
tags: [mcp, model-context-protocol, partners, adapters, ai-native, weekend-build]
description: "The runtime has been speaking Model Context Protocol since late March. Six tools, stdio transport, deny-by-default permissions, full audit log. The server is the boundary any external agent uses to drive the engine. This Saturday is about what the next layer looks like: real adapters, real partner integrations, and an MCP-first developer story instead of an MCP-bolted-on one."
series: learning-to-code-with-ai
slug: six-mcp-tools-and-what-the-adapters-unlock
---

The runtime has been talking Model Context Protocol since late March. The shipping commit is `138b538b`, "feat(mcp): reframe MCP server from game-agent control to world model runtime orchestration." The change of framing in that commit message is the substance of this post, and the next move on it is what I want to write down.

## What MCP looks like in the runtime today

Six tools, in a Python server at `src/mcp/raku_mcp_server.py`, transport over stdio, namespace `raku.*`. Deny-by-default permissions enforced per tool per caller. Every call recorded in an audit log.

The six tools:

1. **`load_world_model(adapter_name, config)`** registers a world model backend. Today the adapter names are placeholders: `VideoPredictor-v2`, `NeuralRadianceField`, `PhysicsFoundation`. Tomorrow they will be real adapters.
2. **`ingest_frame(adapter_name, frame_data, frame_index, timestamp)`** hands a frame from a generative model into the runtime's scene graph.
3. **`get_scene_state(include_physics, include_transforms)`** is the read-only snapshot of the world. Safe in every mode.
4. **`set_render_target(target_type, config)`** configures where the world renders: WebGL, VR headset, native window, offscreen.
5. **`start_simulation(tick_rate, max_duration, realtime)`** begins the simulation loop. Sandbox and dev only. Production servers refuse this call.
6. **`get_metrics()`** returns a performance snapshot. FPS, frame time, node count, adapter load, uptime. Safe in every mode.

Read-only tools work in every environment. Mutating tools (load, ingest, set, start) work only in sandbox and dev. The production posture is "external agents can ask, not tell." That posture is enforced at the server, not the caller. A misbehaving partner cannot mutate a production world model by accident.

## Why these six and not something else

The early version of the MCP server, before March, exposed game-agent tools: `move_npc`, `set_dialog`, `place_object`, `query_inventory`. Those are the wrong tools for the boundary. They are application-level concerns, not engine-level concerns. They make the engine the thing the agent reaches into. The engine is supposed to be the thing the agent runs on top of.

The reframe in PR #1311 swapped the tool surface. The new tools operate on world-model abstractions: load a backend, push a frame, query state, configure rendering, start simulating, read metrics. An agent that wants to move an NPC does so by pushing a frame through the world model adapter, not by calling `move_npc` on the engine. The engine remains the authority on physics, collision, scoring, multiplayer state. The world model is a contributor, not a controller.

That distinction is what lets the engine be agnostic about which world model is on the other end. Genie, Runway, Sora before it shut down, a custom in-house model, a physics foundation model, an experimental neural-radiance-field renderer. All of them speak the same six-tool surface. None of them get to override the engine's authority on what is actually happening in the simulation.

This is what "deterministic authority runtime" means in practice. We say that phrase a lot in conversations with partners. The MCP surface is what makes it true.

## The gap between today and what comes next

The honest version of where MCP stands: the server is real, the security layer is hardened, the schemas are typed, the audit log works, and the adapters are stubs.

That last word is the weight of this Saturday. The six tools accept an `adapter_name` string. The stub adapters (`VideoPredictor-v2`, `NeuralRadianceField`, `PhysicsFoundation`) are placeholders that prove the dispatch path. There are scaffolding files in `src/environment/` for `VeoEnvironmentAdapter` and `RunwayEnvironmentAdapter` that are not yet wired to a real model.

The next move is one adapter, end-to-end, with a real partner model on the other end of it. The candidate that keeps coming up in the conversations from GDC is a video predictor (Runway, or a smaller open model) feeding scene-frame data through `ingest_frame` while the engine handles physics and collision underneath. A demo where the visuals are coming out of a generative model and the gameplay is coming out of the engine, and neither side has to know about the other except through the MCP boundary.

If that demo works, every other adapter is a known shape. The hard part is not the integration. The hard part is the contract. The contract is the six tools.

## What this means for partners

Two specific things, both worth saying out loud.

**Any agent that speaks MCP can drive the runtime.** A model lab that wants to test their generation against a real engine does not need a custom integration. They write an MCP client, they call `load_world_model` with their backend, they push frames with `ingest_frame`, they read scene state with `get_scene_state`. The engine does the rest. The partner gets a real evaluation surface for their model. We get a real demonstration that the engine is provider-agnostic.

**Any developer building tools on top of the runtime can use the same surface.** The MCP server is not a partner-only API. It is the API. A studio building an authoring tool, a researcher running batch evaluations, a hardware partner integrating a new sensor, all of them get the same six tools. There is no separate "internal" API hiding behind the public one. There is the MCP surface and there is the C API the SDK uses, and that is the entire public face of the runtime.

## The hardening still to do

Three pieces of work that I want to write down so they get done:

**Production deployment harness.** The MCP server today is instantiated in tests. It needs a service template: environment-variable config for mode and auth tokens and rate limits, a health-check endpoint, graceful shutdown, container packaging. Standard ops hygiene. Not glamorous. The thing that turns a working server into a deployable one.

**Multi-provider fallback.** When the primary adapter is slow or unavailable, the server should be able to route to a secondary. The strategy doc has talked about this for a while. The implementation has not landed. The shape is straightforward. The tests will be the work.

**Adapter bounty program.** Once one adapter works end-to-end and the contract is proven, the right move is to publish the adapter contract and invite the ecosystem to write more. A Genie adapter from someone who knows Genie. A Marble adapter from someone who knows Marble. A custom-model adapter from a research group. Our job stops being "integrate every model" and starts being "publish the contract and review the implementations."

That last move is the one I am most excited about. It is the inflection point where MCP stops being a tool we built for our own use and starts being infrastructure other people build on top of.

## The week ahead

The queue I am filing this Saturday morning has the first real adapter on it. Specifically scoped, narrow target, working demo by the end of the month if it goes well. If it does not go well, we learn what we got wrong about the contract while it is still cheap to change.

If you are at a model lab and you have an opinion about how MCP-style boundaries should look for runtimes that talk to generative models, this is the right week to share it. The contract is not yet locked. Comments cost less now than they will in a quarter.

Six tools, deployed, audited, schema-typed, deny-by-default. Adapters next. The boundary is real. The work that runs on top of it is what comes after.

Saturday in motion.
