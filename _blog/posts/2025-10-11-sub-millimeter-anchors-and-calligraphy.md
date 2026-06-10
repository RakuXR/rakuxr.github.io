---
title: "Sub-Millimeter Anchors and the Calligraphy Question"
date: 2025-10-11
author: RakuAI Team
tags: [ar, anchoring, computer-vision, partnerships, calligraphy, weekend-build]
description: "A brutal precision target from a partner conversation: sub-millimeter overlay drift on a sheet of calligraphy paper. By Saturday evening the runtime had a sub-millimeter anchor-pose API, real-time pen-tip tracking, and marker-based paper detection. This is the kind of precision that turns AR from a toy into a tutor."
series: learning-to-code-with-ai
slug: sub-millimeter-anchors-and-calligraphy
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Sub-millimeter anchor overlaying a calligraphy stroke guide on practice paper" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="smac-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="smac-stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#a388ff"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#smac-bg)"/>
  <text x="600" y="62" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Sub-Millimeter Anchoring</text>
  <text x="600" y="98" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">The overlay lands on the same spot, every frame, every blink</text>
  <g>
    <rect x="380" y="150" width="440" height="270" rx="10" fill="#1a1a33" stroke="#9090b0" stroke-width="1.5"/>
    <rect x="404" y="174" width="36" height="36" rx="4" fill="#0a0a1a" stroke="#00cec9" stroke-width="2"/>
    <rect x="412" y="182" width="8" height="8" fill="#00cec9"/><rect x="424" y="182" width="8" height="8" fill="#00cec9"/><rect x="412" y="194" width="8" height="8" fill="#00cec9"/>
    <text x="600" y="200" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="13">registration marker → 6DoF paper pose</text>
    <path d="M460 360 C520 250 560 250 600 300 C640 350 700 250 760 230" stroke="url(#smac-stroke)" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.85"/>
    <circle cx="760" cy="230" r="9" fill="#e84393"/>
    <text x="772" y="226" fill="#e84393" font-family="system-ui,sans-serif" font-size="13">pen tip</text>
  </g>
  <g font-family="system-ui,sans-serif">
    <rect x="120" y="240" width="200" height="64" rx="10" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="220" y="272" text-anchor="middle" fill="#00cec9" font-size="22" font-weight="800">&lt; 1 mm</text>
    <text x="220" y="294" text-anchor="middle" fill="#9090b0" font-size="13">overlay drift</text>
    <rect x="880" y="240" width="200" height="64" rx="10" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="980" y="272" text-anchor="middle" fill="#00cec9" font-size="22" font-weight="800">~2 ms</text>
    <text x="980" y="294" text-anchor="middle" fill="#9090b0" font-size="13">marker detect / frame</text>
  </g>
</svg>
<figcaption>Anchor to the paper, not the room — and the error chain collapses.</figcaption>
</figure>

<p class="post-hook">Most AR forgives a few centimeters of drift. A calligraphy tutor forgives nothing. RakuAI is built for the precision where AR stops being a demo and starts being a teacher.</p>

A partnership conversation was fresh in my head this Saturday morning, and a precision target with it that scared me a little. NTT QONOQ has been doing serious cultural-AR work in Japan, and the calligraphy use case they want this engine to support has an unforgiving spec: the virtual ink-stroke guide that overlays a sheet of practice paper has to land on the same exact spot on the same exact paper, every frame, every blink.

Most AR experiences are forgiving about precision. If a virtual robot is standing somewhere on your floor and it drifts by three centimeters when you look away and look back, you might not notice. The robot is a robot. Robots wander.

A calligraphy tutor is not forgiving. Three centimeters of drift is a useless product. Three millimeters of drift is a frustrating product. Sub-millimeter is the bar. This weekend the runtime started clearing it.

## What landed

Five APIs and one partnership reference:

- Sub-millimeter anchor-pose API for high-precision AR content alignment
- Paper-CV detection API for marker-based paper calibration
- Stroke-path CV analysis for real-time pen and brush tracking
- Voice-latency event timestamps and real-time metrics
- Animation-latency tracking for anime-pivoted demos
- A reference in the README to research with NTT QONOQ

Seventy commits across the weekend. Most of the engineering work was in the first three.

## Why "sub-millimeter" is the right number

The sub-millimeter ask did not come from a marketing exercise. It came from a use case. A user holds a calligraphy brush over a sheet of practice paper. The runtime watches the brush, watches the paper, watches the room. It overlays the next stroke the user should make as a faint glow on the paper. The user follows the glow.

The whole experience falls apart if the glow is even slightly off the paper, because the user's eyes will fixate on the glow rather than on the physical brush tip, and the physical stroke will follow the misaligned glow. Drift in the overlay produces drift in the practiced stroke. The product disappears.

So the bar is not "sub-millimeter is impressive." The bar is "sub-millimeter is the only acceptable failure case for this use case." Above that and the product breaks.

## How the sub-millimeter anchor works

The mechanism (simplified): the paper itself becomes the anchor. A printed registration marker on the practice paper is detected every frame. The runtime computes the paper's pose relative to the user's view in 6DoF. The overlay is rendered in paper-local coordinates, not room-local. As the user's head moves, the math runs the other direction: paper pose updates, overlay re-projects, glow lands where the next stroke goes.

This is a different design from the standard "anchor a virtual object to the room and trust the room reconstruction." Room reconstruction is good for furniture-scale precision. It is not good for paper-scale precision, because the room reconstruction error stacks with the user's head-pose error. By anchoring directly to a known physical object (the paper) and registering the overlay against that object, we collapse the error chain.

The cost is that the paper has to be a known physical object. We solved that this weekend with the marker-based paper-CV detection API. The marker is small, unobtrusive, and printed on every practice sheet the demo ships with. The runtime detects the marker in roughly two milliseconds per frame and tracks it stably under typical lighting.

The win is that we are doing this on AR glasses with the compute envelope they have, in real time, every frame, with overlay drift bounded under a millimeter under normal usage.

## The NTT QONOQ reference

I added a reference to NTT QONOQ in the README this weekend because we are in active research conversation. NTT QONOQ in Japan has been doing serious work on real-world AR and on the question of how AR experiences anchor to physical artifacts. The calligraphy use case lines up with the kind of cultural-AR work the Japanese spatial-computing community has been pushing forward.

This is not an announcement of a partnership. It is a note that the partnership conversation is happening and the engineering this weekend reflects what would be needed to support it well. The product question "can you do this in a calligraphy classroom in Tokyo" is more concrete than the product question "can you do this somewhere." Concrete questions produce better engineering.

## Stroke-path CV: the harder one

The sub-millimeter anchor is the headliner this weekend. The actual hardest piece of engineering was the stroke-path CV.

Tracking a pen or brush in real time on AR glasses is not a solved problem. The tip is small, often partially occluded by the user's hand, and moving at variable speed. The CV pipeline this weekend tracks the tip's position relative to the paper, infers when the tip is in contact (vs. hovering), and emits a stroke path as a stream of timestamped points. Hand-occlusion recovery is the part that ate the most time. The agent and I went through three versions of the recovery logic before the test traces stopped dropping points.

This is the kind of engineering where AI as a runtime primitive starts to matter. The CV pipeline gets every frame. A small model on the device decides whether the current frame is a contact frame or a hover frame. The model's decision feeds the stroke-path emitter. The model is not a chatbot. It is a runtime element that runs in the simulation step.

That architectural pattern is becoming a refrain in this engine. AI is not the feature you add. AI is the thing that happens between sensors and renderer, every frame, while the user is doing whatever they are doing.

## What I want partners and builders to take from this

If you are NTT QONOQ or any other partner thinking about precision AR overlays in real environments, the calligraphy-tutor work is a concrete demo of the kind of precision the engine targets. The framework is general. It is not specifically a calligraphy tool. It is a sub-millimeter anchor and a stroke-path CV pipeline, both of which apply to many things that look nothing like calligraphy.

If you are an AI lab with a small model that does well at hand or pen segmentation, this is the kind of model that lives inside the simulation step on this engine. Latency budget is tight. Quality bar is high. If your model fits, this engine has a slot for it.

Seventy commits. One demo target. One partnership conversation accelerating. The kind of Saturday I would not trade for anything.

<div class="post-cta">
<h3>Precision is a partnership story</h3>
<p>If your product needs AR overlays that hold their position to the sub-millimeter — cultural AR, training, precision guidance — RakuAI is the runtime built for that bar. Let's talk about what your use case needs.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/smart-glasses.html">For Glasses Makers</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
