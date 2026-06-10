---
title: "Replacing Seven O(N²) Algorithms on a Saturday"
date: 2026-02-21
author: RakuAI Team
tags: [algorithms, physics, vision, model-loading, agent-failure-mode, weekend-build]
description: "Seven O(N²) placeholders, one Saturday, and the production algorithms that turned a wobbling demo into a runtime that screams. This is how RakuAI turns AI-written code into engine-grade performance — and why an algorithmic audit is the fastest upgrade your spatial stack will ever get."
series: learning-to-code-with-ai
slug: replacing-seven-brute-force-algorithms
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Seven brute-force O(N squared) algorithms replaced with production-grade versions" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bf7-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="bf7-accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#bf7-bg)"/>
  <text x="600" y="64" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">From Brute Force to Production-Grade</text>
  <text x="600" y="100" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Seven hot paths, audited and rewritten in a single Saturday</text>
  <g font-family="system-ui,sans-serif">
    <rect x="120" y="170" width="300" height="120" rx="16" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="270" y="220" text-anchor="middle" fill="#ff7aa8" font-size="44" font-weight="800">O(N²)</text>
    <text x="270" y="258" text-anchor="middle" fill="#9090b0" font-size="17">double-nested loops</text>
    <rect x="780" y="170" width="300" height="120" rx="16" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="930" y="216" text-anchor="middle" fill="#00cec9" font-size="34" font-weight="800">O(N log N)</text>
    <text x="930" y="258" text-anchor="middle" fill="#9090b0" font-size="17">sweep-and-prune, spatial hash, A*</text>
    <path d="M440 230 L770 230" stroke="url(#bf7-accent)" stroke-width="4" marker-end="url(#bf7-arrow)"/>
    <polygon points="770,230 752,221 752,239" fill="#a388ff"/>
    <text x="605" y="214" text-anchor="middle" fill="#a388ff" font-size="15" font-weight="600">AUDIT PASS</text>
  </g>
  <g font-family="system-ui,sans-serif" font-size="13" fill="#c8c8e0">
    <rect x="150" y="350" width="160" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="230" y="375" text-anchor="middle">Sweep &amp; Prune</text>
    <rect x="330" y="350" width="150" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="405" y="375" text-anchor="middle">Spatial Hash</text>
    <rect x="500" y="350" width="160" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="580" y="375" text-anchor="middle">Vertex Cache</text>
    <rect x="680" y="350" width="150" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="755" y="375" text-anchor="middle">Ratio Test</text>
    <rect x="850" y="350" width="120" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="910" y="375" text-anchor="middle">PBD Cloth</text>
    <rect x="280" y="404" width="120" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="340" y="429" text-anchor="middle">A* Paths</text>
    <rect x="420" y="404" width="160" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="500" y="429" text-anchor="middle">Blend Trees</text>
  </g>
</svg>
<figcaption>One audit pass, seven production algorithms, a runtime that scales.</figcaption>
</figure>

<p class="post-hook">Your AI can write code that works. Making it code that <em>scales</em> is where a spatial runtime is won or lost — and it is exactly the discipline RakuAI is built around.</p>

The agents are good at writing code that works. They are sometimes bad at writing code that scales. This is a pattern I have come to recognize and to budget for: when the issue framing asks for a function that does X, the agent writes a function that does X correctly on a small input and breaks down on a real-sized one.

This Saturday I went looking for those functions on purpose. Seven of them came back. By the end of Saturday, all seven were running their actual production algorithms instead of the brute-force placeholders the agents had originally landed.

This is the post about what each one was, why it mattered, and what the agents got wrong about each.

## The pattern

The pattern shows up like this. An issue gets filed. "Implement collision detection between objects A and B. Should detect when objects overlap. Acceptance criterion: bool function returns true when they overlap, false otherwise."

The agent writes the function. The function works. The function is O(N²) brute force. For two objects, that is fine. For two hundred objects, that is fine. For two thousand objects, the frame rate is gone.

The agent's prompt did not specify the asymptotic complexity. The agent satisfied the prompt. The prompt did not satisfy the engine.

This is a discipline problem on my side, not an agent problem. The fix is to be specific in the prompt about complexity targets, to specify the algorithm class explicitly when it matters, and to audit for this kind of brute-force fallback on a regular cadence. This Saturday was the audit cadence.

## Seven specific replacements

I want to be specific about each because the pattern is identical and the lessons stack.

**One. 2D physics broad-phase collision detection.** The original implementation was a double-nested loop over every pair of objects. O(N²) per frame. Replaced with sweep-and-prune (Baraff, 1992): sort the axis-aligned bounding boxes by their minimum X coordinate, then scan once. Pairs only overlap on the X axis if one box's max X is greater than the other's min X. The sort is O(N log N); the scan is O(N + K) where K is the number of actually-overlapping pairs. For typical scenes, K is much smaller than N², which is the whole point.

**Two. Spatial collision detection for the agent-population subsystem.** Same pattern, different surface. The original implementation was a double-nested loop checking every agent against every other agent. Replaced with a spatial hash grid. Each agent gets hashed by its bounding-cell coordinates; collisions are only checked between agents in the same or adjacent cells. Cell size is chosen as roughly two times the average agent radius. Expected complexity O(N), worst case O(N²) when everyone is in the same cell, which does not happen in normal play. Hash function is FNV-style 3D coordinate hashing. Pair deduplication is via an ordered uint64_t set of `(min(a,b), max(a,b))` pairs.

**Three. Model-loader vertex-cache optimization.** The original implementation loaded vertices and triangles into the renderer in the order the asset author specified. Most authoring tools do not optimize for the GPU's vertex cache, which means the renderer wastes a lot of cycles re-fetching vertices it already had. Replaced with Tom Forsyth's 2006 vertex-cache optimization: LRU cache model with a size of 32, scoring each candidate triangle by a position-in-cache decay function plus a valence bonus (triangles that share vertices with many other unprocessed triangles score higher). The result is an amortized cache miss rate that is near-optimal for typical mesh topologies. Implementation runs O(T) where T is the triangle count.

**Four. Vision feature-descriptor matching.** The runtime's computer-vision pipeline does feature detection on every frame and matches features between consecutive frames for tracking. The original implementation had a placeholder that returned a fixed fraction of the input descriptors as "matched." The placeholder was not even brute-force. It was a deliberate stub. The replacement is real brute-force descriptor matching with Lowe's ratio test (2004). For ORB descriptors (binary), the distance metric is Hamming via XOR plus a Kernighan bit count. For SIFT and float descriptors, the distance is L². The ratio test rejects ambiguous matches where the best and second-best candidates are too close in distance. Threshold for the ratio test is 0.75, which is the literature default. Complexity is O(N₁ × N₂ × D) where D is the descriptor dimension, which for ORB is 32 bytes. This is brute force in the literal sense, but on the descriptor lengths and feature counts we work with, it is fast enough and is what the literature compares against. Smarter approximations (FLANN, hierarchical k-means) are on the queue for a later weekend.

**Five. Cloth physics constraint solver.** The original implementation iterated constraints in a fixed order with a low iteration count, which produced wobbly cloth that did not converge. Replaced with a position-based dynamics solver with proper constraint shuffling between iterations. The shuffling matters because constraint solvers that always process constraints in the same order get biased: cloth ends up stretching predictably in one direction. Shuffling each iteration removes the bias. The iteration count was raised from 4 to 12 for production-quality, with a 4-iteration fast path for low-end devices.

**Six. AI agent path-planning for the crowd subsystem.** The original implementation was a placeholder that picked a random valid neighbor each step. Agents wandered in random directions and occasionally arrived at their destinations by luck. Replaced with proper A* path-planning over the navigation mesh, with the heuristic being Euclidean distance and the cost function weighted by terrain slope and surface type. The implementation uses a binary heap for the open set and a hash set for the closed set, which makes the per-step cost O(log N) on the heap and O(1) on the hash set.

**Seven. Animation blending across multiple clips.** The original implementation was a placeholder that just played the most-recently-requested clip and ignored the others. Replaced with a proper weighted blend tree: each output frame is a weighted sum of contributing clips' per-bone transforms, with weights driven by a blend-tree topology that the animation author specifies. The blend computation respects bone-hierarchy ordering so child bones inherit blended parent transforms correctly.

## What I learned

Three things, none of which are surprising in retrospect.

**Specify the algorithm in the issue.** For any function that operates on a non-trivial input size, the issue framing has to specify the expected complexity. "Detect collisions between N objects" is not enough. "Detect collisions between N objects in worst-case O(N log N) using sweep-and-prune (Baraff 1992) or equivalent" is enough. The citation is the discipline. Without it, the agent writes the easiest correct thing, which is brute force.

**The audit pass is essential.** I would not have caught these by reading PRs as they landed. Each individual PR was a function that worked, with tests that passed. The audit pass that says "find every function in the runtime that is O(N²) or worse and assess whether it should be" is what surfaces them. Add the audit to the cadence.

**The literature is the cheat code.** Every one of these replacements is a published algorithm with a decades-old paper behind it. Baraff 1992. Forsyth 2006. Lowe 2004. Position-based dynamics. A*. These are not novel. The agents will write the literature-equivalent version of any of them if you tell them which paper to read.

## What partners and builders should take from this

If you are evaluating an engine for partnership and the team has not done an algorithmic audit of their codebase, ask them to do one. The audit will surface things. The team's response to what it surfaces is more telling than any feature list.

If you are running an agent-driven workflow on a performance-sensitive codebase, the audit pass is not optional. The agents will land working code. The working code will sometimes be the brute-force version. The audit is how you find out which.

If you are an AI lab building a coding agent for performance-sensitive work, the metric I would optimize for is "does the agent ask about asymptotic complexity when it is implementing a function whose name implies a scaling concern." Most agents do not. The ones that do produce better code.

Saturday afternoon. Seven brute-force algorithms replaced with their real production versions. The engine got faster. The codebase got more honest.

Back to building.

<div class="post-cta">
<h3>Supercharge your AI in the real world</h3>
<p>RakuAI is the spatial runtime your AI assistant inhabits — engineered to scale from a weekend demo to production on smart glasses. See what your models can build.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/llm-makers.html">For AI Labs</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
