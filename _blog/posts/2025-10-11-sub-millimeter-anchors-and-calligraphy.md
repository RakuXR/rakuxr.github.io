---
title: "Sub-Millimeter Anchors and the Calligraphy Question"
date: 2025-10-11
author: Kevin Griffin
tags: [ar, anchoring, computer-vision, partnerships, calligraphy, weekend-build]
description: "Saturday morning the partnership conversation with NTT QONOQ pointed at a brutal precision target: sub-millimeter overlay drift on a sheet of calligraphy paper. By Sunday night the runtime had a sub-millimeter anchor-pose API, real-time pen-tip tracking, and marker-based paper detection. The bar is now clearable. The product behind the bar is suddenly real."
series: learning-to-code-with-ai
slug: sub-millimeter-anchors-and-calligraphy
---

Woke up Saturday morning with a partnership conversation fresh in my head and a precision target that scared me a little. NTT QONOQ has been doing serious cultural-AR work in Japan, and the calligraphy use case they want this engine to support has an unforgiving spec: the virtual ink-stroke guide that overlays a sheet of practice paper has to land on the same exact spot on the same exact paper, every frame, every blink.

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

The cost is that the paper has to be a known physical object. We solved that this weekendend with the marker-based paper-CV detection API. The marker is small, unobtrusive, and printed on every practice sheet the demo ships with. The runtime detects the marker in roughly two milliseconds per frame and tracks it stably under typical lighting.

The win is that we are doing this on AR glasses with the compute envelope they have, in real time, every frame, with overlay drift bounded under a millimeter under normal usage.

## The NTT QONOQ reference

I added a reference to NTT QONOQ in the README this weekendend because we are in active research conversation. NTT QONOQ in Japan has been doing serious work on real-world AR and on the question of how AR experiences anchor to physical artifacts. The calligraphy use case lines up with the kind of cultural-AR work the Japanese spatial-computing community has been pushing forward.

This is not an announcement of a partnership. It is a note that the partnership conversation is happening and the engineering this weekendend reflects what would be needed to support it well. The product question "can you do this in a calligraphy classroom in Tokyo" is more concrete than the product question "can you do this somewhere." Concrete questions produce better engineering.

## Stroke-path CV: the harder one

The sub-millimeter anchor is the headliner this weekendend. The actual hardest piece of engineering was the stroke-path CV.

Tracking a pen or brush in real time on AR glasses is not a solved problem. The tip is small, often partially occluded by the user's hand, and moving at variable speed. The CV pipeline this weekendend tracks the tip's position relative to the paper, infers when the tip is in contact (vs. hovering), and emits a stroke path as a stream of timestamped points. Hand-occlusion recovery is the part that ate the most time. The agent and I went through three versions of the recovery logic before the test traces stopped dropping points.

This is the kind of engineering where AI as a runtime primitive starts to matter. The CV pipeline gets every frame. A small model on the device decides whether the current frame is a contact frame or a hover frame. The model's decision feeds the stroke-path emitter. The model is not a chatbot. It is a runtime element that runs in the simulation step.

That architectural pattern is becoming a refrain in this engine. AI is not the feature you add. AI is the thing that happens between sensors and renderer, every frame, while the user is doing whatever they are doing.

## What I want partners and builders to take from this

If you are NTT QONOQ or any other partner thinking about precision AR overlays in real environments, the calligraphy-tutor work is a concrete demo of the kind of precision the engine targets. The framework is general. It is not specifically a calligraphy tool. It is a sub-millimeter anchor and a stroke-path CV pipeline, both of which apply to many things that look nothing like calligraphy.

If you are an AI lab with a small model that does well at hand or pen segmentation, this is the kind of model that lives inside the simulation step on this engine. Latency budget is tight. Quality bar is high. If your model fits, this engine has a slot for it.

Seventy commits. One demo target. One partnership conversation accelerating. The kind of Saturday I would not trade for anything.
