---
title: "How RakuAI Works — End to End"
date: 2026-05-31
author: Kevin Griffin
tags: [architecture, mcp, capture, gaussian-splat, ai-native, explainer]
description: "Phone scan to 3D Gaussian splat to any LLM driving it as tools over multi-vendor MCP. The honest end-to-end account: what ships today, what is gated on GPU credits, and why the inference-only runtime is the moat."
series: learning-to-code-with-ai
slug: how-rakuai-works-end-to-end
---

Scan a room with your phone. Thirty seconds later, a 3D Gaussian splat exists. Now ask Claude — or ChatGPT, or Gemini — to query it, annotate it, move things in it. That is the whole pitch. This post is the honest account of how each step actually works, what is live today, and what is still gated on GPU credits.

This is a different kind of post for the blog. The usual Saturday posts are about a specific problem solved or a specific week survived. This one pulls back to the full picture — what RakuAI is, how its pieces connect, and what the moat actually is when you trace it end to end. It is the post I wish existed the first time I had to explain this to a developer partner who wanted the real story, not the pitch deck version.

## The premise in one sentence

You scan a real place with a phone. The scan becomes a 3D Gaussian splat — a photorealistic reconstruction made of millions of tiny transparent ellipsoids. The splat is served through a runtime that exposes it as tools any LLM can call. The LLM can query the scene, reason about what it contains, and — under the right permissions — mutate it. No game engine license. No per-vendor integration. No model lock-in.

That is the "Scan it. Then talk to it." idea. Here is how each piece of that chain works.

## Step 1: Capture — phone video to raw frames

The entry point is a Progressive Web App at [rakuai.com/capture-app/](/capture-app/). It runs in a mobile browser with no install. The user records 30 to 60 seconds of video, walking slowly around the subject — a room, an object, a space worth preserving.

The PWA bundles the video frames and uploads them to `POST /api/v1/capture` on the backend, which runs on Azure Container Apps at `api.rakuai.com`. The backend is a FastAPI service — roughly 9,700 endpoints — that authenticates the upload, records metadata (original filename, content-type, capture timestamp), and stores the raw input bundle to Azure Blob Storage.

That part is live. The upload path works today, for anyone who signs up.

## Step 2: Reconstruction — COLMAP feature extraction to point cloud

The backend dispatches a reconstruction job to a Container Apps job runner called `recon-worker`. The first thing it does is run COLMAP — the Structure from Motion library — across the uploaded frames. COLMAP identifies matching features across frames and computes camera positions, producing a sparse 3D point cloud.

This step is CPU-bound and does not require a GPU. It runs today.

## Step 3: Splat training — Brush turns a point cloud into a Gaussian splat

This is the compute-intensive step. The reconstruction worker feeds the COLMAP point cloud and the original frames into Brush v0.3.0, a 3D Gaussian Splatting trainer. Brush fits millions of small 3D Gaussians to the scene — each Gaussian is an ellipsoid in 3D space with a position, orientation, scale, opacity, and view-dependent colour. The output is a `.ply` or `.spz` file stored to Azure Blob Storage alongside the input.

**Honest: this step requires a GPU.** GPU quota on Azure A10 is in review. AWS Activate credits are pending approval (account `159689344731`, application submitted 2026-05-28). Until one of those lands, the production recon worker falls back to a simulated backend — the architecture is wired, the GPU path is not yet live. This is early access, not a finished consumer product.

## Step 4: The MCP runtime — 17 tools + ~9,500 passthrough endpoints

This is the part that makes the splat a live spatial object rather than a static file.

The runtime is a C++ engine: 18 native DLLs, 30,784 exported functions across subsystems for physics, rendering, audio, tracking, multiplayer state, and AI orchestration. Green on Linux since April 2026. Tests pass at 100%.

On top of the engine, the MCP server exposes two surfaces:

**17 native tools** (5 read-only + 12 mutation) — the typed contract any external agent uses to interact with a scene. Read-only tools work in every environment. Mutation tools require explicit permission grants and are denied by default in production.

**~9,500 passthrough endpoints** — the full FastAPI surface of raku-api, exposed through the MCP relay. Any of the backend's routes can be reached through the relay, giving an LLM access to capture history, job status, scene metadata, and the full query surface of the backend.

The MCP server is hosted at `api.rakuai.com` on Azure Container Apps. The relay for Claude Desktop, ChatGPT, and Gemini is live. The server speaks stdio transport, logs every call to an audit trail, and enforces per-session rate limits.

## Step 5: Multi-vendor LLM access — the actual moat

Any model that speaks Model Context Protocol can connect to the runtime and call tools against a captured scene without a custom integration. Claude, ChatGPT, Gemini, Copilot — the contract is the same for all of them.

The runtime writes the contract once. The models adapt to the contract. When a new model lab ships an MCP client, it works against the runtime without any code change on our side.

The runtime has no opinion about which model is on the other end. It keeps authority on physics, collision, scoring, rendering, and scene state. The model contributes queries and intent. Neither side needs to know the other exists except through the typed tool surface.

This is the moat: honest capture of the physical world, stored as a lossless 3D representation, queryable by any LLM that speaks an open protocol. Not locked to one model. Not locked to one use case. Not locked to one hardware vendor.

## What is live today versus what is roadmap

**Live today:**
- Phone capture PWA, upload to Azure Blob
- COLMAP feature extraction and point cloud
- Backend infrastructure (FastAPI ~9,700 endpoints, Redis job store, tier-aware rate limits)
- MCP runtime with 17 native tools + ~9,500 passthrough endpoints
- Hosted MCP relay for Claude, ChatGPT, Gemini
- Multi-vendor tool contract (stdio, deny-by-default, full audit log)
- Free tier and Pro Beta tier (Pro Beta is $0 during the beta period)

**Gated (early access — expected within days):**
- Real GPU splat training on Azure A10 (quota in review)
- Real GPU splat training on AWS G5 (Activate credits in review)

**Roadmap (not yet shipped):**
- Live splat viewer in the capture PWA (three.js Gaussian splat renderer is wired; end-to-end demo requires a trained splat)
- Self-service production mutation grants
- Third-party adapter ecosystem (first-party reference adapters exist; broad ecosystem is roadmap)

NVIDIA Inception member since May 2026.

## Why "inference-only" is not a limitation

The runtime does not train models. It does not fine-tune models. It does not require you to run a model inside it. The model you already have — whatever it is, wherever it lives, however it is licensed — connects through MCP and drives the runtime from outside.

This is a deliberate architecture choice. Training and inference are separate concerns. The runtime is good at spatial physics, deterministic state management, multi-user synchronisation, and low-latency rendering. The model lab is good at reasoning, generation, and language. The MCP contract is the boundary between them. Neither side has to do the other's job.

Inference-only also means no GPU residency requirement for serving. The compute-intensive step (splat training) is a one-time cost per capture. Everything after that is geometry and MCP queries — runs on the same Azure Container Apps instances that serve the API.

## The honest recap

The pipeline is: phone video → COLMAP → Brush Gaussian splatting → Azure Blob → MCP runtime → any LLM. Four of the five steps are live. The fifth (GPU splat training) is wired and waiting on credits. The viewer to close the loop in the browser is the next milestone.

If you want to try the capture end today, the PWA is at [rakuai.com/capture-app/](/capture-app/). If you want to drive a scene over MCP from Claude Desktop, the guide is at [/developers/claude-desktop.html](/developers/claude-desktop.html). If you want to understand the full tool surface, it is at [/mcp.html](/mcp.html).

Scan it. Then talk to it.
