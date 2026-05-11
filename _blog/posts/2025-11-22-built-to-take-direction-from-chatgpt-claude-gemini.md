---
title: "Built to Take Direction from ChatGPT, Claude, and Gemini"
date: 2025-11-22
author: Kevin Griffin
tags: [llm, partnerships, voice-pipeline, openxr, xr-assistant, ai-native, weekend-build]
description: "Woke up Saturday with a clear ambition: ship the layer that lets a cloud LLM stream intent into the simulation loop every frame. By Sunday night the XRAssistantService was wired through the voice pipeline, OpenXR foveation was working, Wi-Fi 7 offloaded rendering had a real host, and the engine was demonstrably model-agnostic. Big weekend."
series: learning-to-code-with-ai
slug: built-to-take-direction-from-chatgpt-claude-gemini
---

Most game engines that integrate with a cloud LLM today do it the way you would expect. A model gets bolted into the editor as a chat panel. You type at the chat panel. The panel writes some content or some code. The runtime, which has no idea any of this happened, runs the resulting artifact later.

That is not what Raku is doing. Raku is being built to take direction from a cloud LLM as a runtime concern, not an authoring convenience. This weekend's work made that explicit.

## What landed

A hundred and eighteen commits across the runtime this weekendend. The headline pieces:

- An XRAssistantService that wires cloud LLM responses into the voice pipeline as a first-class runtime feature
- Eye-tracked foveated rendering with multi-profile performance optimization
- An OpenXR XR_EXT_eye_gaze_interaction provider
- Hand tracking and gesture recognition for the XR runtime
- Full-body tracking with a 71-joint skeleton
- Fixation detection and dwell timers in the eye-tracking infrastructure
- High-resolution passthrough, depth sensing, and lighting estimation
- A Wi-Fi 7 offloaded rendering pipeline with a host server and latency monitoring
- A low-latency delta channel for real-time multiplayer AR pose and state sync
- Sub-millimeter anchor service for Android XR
- ARCore sensor bridge for Android devices without the Android XR stack
- A Multi-Layer HUD Compositor and overlay API
- AR Surface Demo and Room Visualizer samples for scene understanding

A few of these are headliners worth talking about. The Wi-Fi 7 offloaded rendering pipeline is one. The XRAssistantService is the other. Both of them are partnership-shaped.

## XRAssistantService and what it's actually for

The XRAssistantService is the cleanest piece of partnership-bait engineering we have shipped to date. The shape of it:

The runtime has a voice pipeline. The user talks. Speech-to-text runs locally on the device with low latency. The text streams into the assistant service. The assistant service hands the text to a cloud LLM. The cloud LLM streams back tokens that represent intent: what should the AR experience do next given what the user said. The runtime parses that stream and turns it into runtime actions in flight. Text-to-speech for the response also streams.

The piece I want builders and labs to notice is that the LLM is not invoked once per user turn. The voice pipeline can keep streaming tokens to the model during a turn (with the right backend support), and the model can keep producing intent that the runtime acts on continuously. That is what "take direction from a cloud LLM as a runtime concern" actually means. It is not a chatbot pasted into an AR experience. It is the runtime treating the model's stream of intent as a control input on the same priority as the user's gaze.

The interface is model-agnostic by design. ChatGPT can drive this. Claude can drive this. Gemini can drive this. A small on-device model can drive this. Anything that produces a stream of intent tokens that conforms to the assistant-service protocol can drive this. The piece we built this weekend is the integration layer between any such model and the rest of the runtime.

If you are at one of those labs and reading this: this is the integration we want to talk to you about. We do not want a special partnership where your model is the only model the engine can talk to. We want your model to be the best model the engine can talk to, because the integration is open and the experience your model produces will be better than the experience anyone else's model produces.

## The Wi-Fi 7 offloaded rendering pipeline

This is the other partnership-shaped piece. AR glasses have a thermal envelope. The thermal envelope is small. The compute envelope inside that thermal envelope is smaller than what some experiences want to render. The traditional answer is to compromise on the experience. The Wi-Fi 7 answer is to render some of the frame on a tethered compute box (a phone, a beltpack, a desktop in the same room) and stream the result.

This weekend the offloaded rendering pipeline landed end-to-end. The host server runs anywhere. The runtime on the glasses talks to the host over Wi-Fi 7. Frame latency is monitored and the runtime can gracefully degrade to local rendering when the link blips, which it will.

Why this matters for partners: it means a hardware partner does not have to put a desktop-class GPU in the glasses to ship a desktop-class experience. The compute can be where the compute is cheapest. The link is the thing that matters. We are building the runtime around the link.

## The OpenXR scaffolding

A bunch of this weekend's commits were in service of OpenXR conformance. XR_EXT_eye_gaze_interaction. Hand tracking. Provider patterns for ARKit and ARCore. The reason OpenXR matters in this codebase is that it is the layer at which we want this engine to be portable across hardware partners. If a hardware partner ships an OpenXR-conformant runtime, this engine can ship on it. The interfaces we are building this month are deliberately on the standards side rather than the vendor-specific side, because that is how the engine stays neutral.

## Honest about what is not done

A few things landed this weekend as WIP. The hand-tracking PR specifically is still wired up incompletely. There is a `PoseStabilizer` linking error we are fixing in a follow-up. Eye tracking has fixation detection but the dwell-timer integration with the application layer is not finished. Full-body tracking is in but the gesture-recognition pieces still need more samples.

I want to be clear about this because the pattern of agent-driven dev work is that a lot of WIP lands in the same week, and the WIP gets named explicitly in PR titles. If you read the commit log this weekend and see "[WIP]" in a few places, that is on purpose. The full deliverables come together over the next two weeks.

## What I want partners and builders to take from this

If you are an AI lab building the next major model and you care about an AR runtime that treats your model's output as a control input on the simulation step, talk to me. The XRAssistantService integration layer is shipping in this engine in November 2025 and will be a stable interface to plug into by end of year.

If you are a hardware partner building AR glasses with Wi-Fi 7 onboard and an external compute story, the offloaded rendering pipeline is exactly the workload your hardware was built for. The runtime is ready for it.

If you are a developer thinking about what kinds of experiences this engine will let you build, the answer is starting to be visible in the commit log. Voice-driven AR experiences that respond to the user mid-sentence are achievable. Real-time multiplayer AR with sub-millimeter anchoring is achievable. The compute you need for either lives on the glasses or on the tether, depending on what your experience needs.

Hundred and eighteen commits, big weekend. The engine looks different at the end of it than it did Saturday morning.
