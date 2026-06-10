---
title: "How the Engine Talks to Any Model You Bring"
date: 2026-01-24
author: RakuAI Team
tags: [architecture, ai-native, interfaces, runtime, weekend-build]
description: "If AI is a runtime primitive inside your engine, are you locked to whichever model you wired in? No — the AI layer is exposed through interfaces, not imports. Six subsystems, a model-management API, a file format that names capabilities instead of models. Here is the boundary that lets RakuAI swap any model, any vendor, any inference path without touching a line of caller code — and why it keeps mattering more as the model market churns."
series: learning-to-code-with-ai
slug: ai-as-interface-not-ai-as-dependency
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Callers talk to AI subsystems through interfaces; models live behind a model-management boundary" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="iface-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#iface-bg)"/>
  <text x="600" y="58" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">AI as Interface, Not Dependency</text>
  <text x="600" y="94" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Callers in front. Models behind. A small, stable, stupid contract.</text>
  <g font-family="system-ui,sans-serif" font-size="13" fill="#c8c8e0">
    <rect x="80"  y="130" width="150" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="155" y="155" text-anchor="middle">Behavior trees</text>
    <rect x="245" y="130" width="150" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="320" y="155" text-anchor="middle">Navigation</text>
    <rect x="410" y="130" width="150" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="485" y="155" text-anchor="middle">Crowd sim</text>
    <rect x="575" y="130" width="150" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="650" y="155" text-anchor="middle">Sensory</text>
    <rect x="740" y="130" width="150" height="40" rx="8" fill="#1a1a33" stroke="#6c5ce7"/><text x="815" y="155" text-anchor="middle">Decision trees</text>
  </g>
  <g font-family="system-ui,sans-serif">
    <rect x="160" y="220" width="880" height="56" rx="12" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="600" y="255" text-anchor="middle" fill="#00cec9" font-size="18" font-weight="700">model-management interface &#8212; handles &amp; tensors</text>
  </g>
  <g font-family="system-ui,sans-serif" font-size="13" fill="#c8c8e0">
    <rect x="220" y="330" width="170" height="44" rx="8" fill="#1a1a33" stroke="#e84393"/><text x="305" y="357" text-anchor="middle">on-device SLM</text>
    <rect x="420" y="330" width="170" height="44" rx="8" fill="#1a1a33" stroke="#e84393"/><text x="505" y="357" text-anchor="middle">cloud LLM</text>
    <rect x="620" y="330" width="170" height="44" rx="8" fill="#1a1a33" stroke="#e84393"/><text x="705" y="357" text-anchor="middle">learned policy</text>
    <rect x="820" y="330" width="170" height="44" rx="8" fill="#1a1a33" stroke="#e84393"/><text x="905" y="357" text-anchor="middle">heuristic</text>
  </g>
  <text x="600" y="420" text-anchor="middle" fill="#a388ff" font-family="system-ui,sans-serif" font-size="15" font-weight="600">Swap a model. Swap a vendor. Nothing above the line changes.</text>
</svg>
<figcaption>Every interface boundary is a place future change can happen without breaking callers.</figcaption>
</figure>

<p class="post-hook">Bring any model you want. RakuAI's AI layer is interfaces, not imports — so the model market can have its quarterly tantrum about who's best and your engine never has to care.</p>

Someone asked me a sharp question this weekend. "If AI is a runtime primitive inside your engine, then the engine is locked to whichever model you wired in. The next time the model vendor moves, you have to rewrite the engine."

Fair concern. And wrong, but fair.

The AI primitive in the runtime is not a specific model. It is an interface. Five separate subsystems, each with its own C API, each addressable from the rest of the engine without anyone having to know which model, which weights, or which inference path is producing the answer. Models live behind the interface. Callers live in front of it. The contract between them is small, stable, and stupid on purpose.

This is the post about how that boundary is drawn, and why I keep getting more value out of having drawn it.

## What "AI primitive" actually points at

The AI layer in our runtime is not one thing. It is five.

- **Behavior trees.** The deterministic-execution layer. Tells an agent what to do once intent is known.
- **Navigation mesh and pathfinding.** The "how do I move through this space" layer.
- **Crowd simulation.** The "how do many agents avoid each other and behave coherently together" layer.
- **Sensory systems and perception.** The "what does the agent observe" layer.
- **Decision trees and complex AI logic.** The "given everything I know, what do I want to do" layer.

Each one is its own subsystem. Each one ships as its own DLL. Each one has a public C API. None of them imports a specific model. They all talk to the rest of the engine through their respective interfaces, and they talk to each other the same way.

When a `.raku` experience file says `"ai_behavior": "strafe"`, it is not naming a model. It is naming a registered behavior. The runtime resolves the string. The string maps to an implementation. The implementation can be a behavior tree, a decision tree, a learned policy, or a hand-written heuristic. The caller does not know. The file does not know. The implementation can be swapped without touching either.

That is the whole trick.

## The model-management layer is its own subsystem

When we needed actual machine-learning inference inside the runtime, we did not bolt it into one of the five subsystems above. We added a sixth concern with its own API surface: model management.

```c
// Roughly what the surface looks like, simplified for the post.
RakuModelHandle raku_ai_load_model(const char* model_id, RakuModelOptions opts);
RakuInferenceResult raku_ai_infer(RakuModelHandle h, const RakuTensor* input);
void raku_ai_unload_model(RakuModelHandle h);
```

A behavior tree node that wants to call a model goes through this API. Not by importing a vendor SDK. Not by linking to a specific runtime. By asking the model-management subsystem for a handle and using it.

That means the model-management subsystem is the only place in the codebase that knows about specific model formats, vendors, or inference frameworks. Everywhere else in the engine sees handles and tensors. Swap a model. Swap a runtime. Swap a vendor. Nothing else has to change.

This is unglamorous infrastructure work. It is also what lets us not panic when the AI ecosystem has its quarterly tantrum about which model is the new best.

## The boundary protects the file format too

Take a look at the `ai` block at the top of any `.raku` experience file. It has keys like:

```json
"ai": {
  "dda_enabled": true,
  "target_flow_state": 0.7,
  "profiler_mode": "active"
}
```

None of those names a model. They name *capabilities*. "Dynamic difficulty adjustment is on. The runtime should aim for a flow state of 0.7. The profiler is active." The runtime decides which subsystems get involved to deliver those capabilities. If the right answer this quarter is a behavior tree, that is what runs. If next quarter it becomes a small on-device model, the file does not change.

Every interface boundary you draw in a system is a place future change can happen without breaking callers. We drew them aggressively up front. We are spending the savings now.

## Why this keeps mattering more, not less

Three reasons.

**One. The model market keeps moving.** Last year's best model is this year's expensive one. This year's best is next year's stale. Teams that hard-coded a model vendor into their engine have done that integration two or three times by now. Teams that put a model-management interface in the way have done it once.

**Two. On-device matters more than it did.** The interface lets us run the same `ai_behavior: "strafe"` against a server-side model in dev and an on-device model in production. The caller does not know. That flexibility is the only reason on-device inference is feasible without rewriting the experience layer.

**Three. AI assistants in the dev loop benefit from clean boundaries.** When I ask an assistant to add a new behavior, the contract it has to respect is the registered-behavior interface. Not a tangle of vendor SDKs. The cleaner the interface, the faster the assistant produces correct code, and the smaller the review cost on my side.

## What is hard about this

The honest costs.

**Interface design takes longer than implementation.** It is genuinely tempting to skip the interface step and just write the working version. Resist. Every shortcut you take here, you pay for later when you need to swap the implementation.

**You have to be disciplined about what goes in the interface.** Every parameter is a contract you cannot break easily. Add fewer than you think you need. Wait for the second use case to show you what is actually general. The first version of the AI interface had five parameters that turned out not to belong there. Removing them later was painful.

**Registered behaviors need versioning.** When `"strafe"` means one thing in one build of the runtime and a slightly different thing in the next, callers find out via gameplay regressions. We version behaviors and pin `.raku` files to runtime versions. It is annoying. It is necessary.

**Sometimes you actually want the dependency.** This is the heretical one. There are cases where a specific model has a specific capability that no generic interface can express. The honest move is to extend the interface so the capability becomes generic, not to leak the model into the caller. We have caught ourselves wanting to take the shortcut more than once.

The architectural argument is straightforward. AI is a runtime primitive. The file format that drives it names capabilities, not models. The runtime resolves capabilities to whatever subsystem currently delivers them. The wire between the three layers is the interface. The interface is small, stable, and stupid on purpose.

That is the whole post.

Back to building.

<div class="post-cta">
<h3>Bring your model. The interface is waiting.</h3>
<p>RakuAI talks to any model through handles and tensors — server-side in dev, on-device in production, no caller ever knows the difference. See how your weights plug into a spatial runtime built to outlast the model market.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/llm-makers.html">For AI Labs</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
