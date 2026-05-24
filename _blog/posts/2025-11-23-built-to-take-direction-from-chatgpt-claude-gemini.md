---
title: "Built to Take Direction from ChatGPT, Claude, and Gemini"
date: 2025-11-23
author: Kevin Griffin
tags: [llm, partnerships, voice-pipeline, openxr, xr-assistant, ai-native, weekend-build]
description: "The weekend the engine learned to take direction from any cloud LLM — as a runtime concern, not a chat panel. By Sunday the XRAssistantService streamed model intent through the voice pipeline, eye-tracked foveation shipped, and Wi-Fi 7 offloaded rendering had a real host. ChatGPT can drive it. Claude can drive it. Gemini can drive it. That is the whole point."
series: learning-to-code-with-ai
slug: built-to-take-direction-from-chatgpt-claude-gemini
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="Any cloud LLM streaming intent tokens into the Raku simulation loop every frame" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bttd-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
    <linearGradient id="bttd-flow" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#6c5ce7"/><stop offset="1" stop-color="#00cec9"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#bttd-bg)"/>
  <text x="600" y="60" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="32" font-weight="700">Built to Take Direction from Any Model</text>
  <text x="600" y="96" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Intent tokens as a control input — on the simulation step, every frame</text>
  <g font-family="system-ui,sans-serif" font-size="15">
    <rect x="100" y="180" width="150" height="48" rx="10" fill="#1a1a33" stroke="#a388ff" stroke-width="2"/>
    <text x="175" y="210" text-anchor="middle" fill="#a388ff" font-weight="700">ChatGPT</text>
    <rect x="100" y="240" width="150" height="48" rx="10" fill="#1a1a33" stroke="#a388ff" stroke-width="2"/>
    <text x="175" y="270" text-anchor="middle" fill="#a388ff" font-weight="700">Claude</text>
    <rect x="100" y="300" width="150" height="48" rx="10" fill="#1a1a33" stroke="#a388ff" stroke-width="2"/>
    <text x="175" y="330" text-anchor="middle" fill="#a388ff" font-weight="700">Gemini</text>
    <path d="M250 264 C360 264 360 264 430 264" stroke="url(#bttd-flow)" stroke-width="4" fill="none"/>
    <polygon points="430,264 412,255 412,273" fill="#00cec9"/>
    <rect x="440" y="220" width="280" height="90" rx="12" fill="#16213a" stroke="#00cec9" stroke-width="2"/>
    <text x="580" y="255" text-anchor="middle" fill="#00cec9" font-weight="700">XRAssistantService</text>
    <text x="580" y="282" text-anchor="middle" fill="#9090b0" font-size="13">model-agnostic intent protocol</text>
    <path d="M720 264 L800 264" stroke="url(#bttd-flow)" stroke-width="4"/>
    <polygon points="800,264 782,255 782,273" fill="#00cec9"/>
    <rect x="810" y="210" width="290" height="110" rx="12" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="955" y="248" text-anchor="middle" fill="#ff7aa8" font-weight="700">Runtime simulation step</text>
    <text x="955" y="276" text-anchor="middle" fill="#9090b0" font-size="13">voice pipeline · gaze · actions</text>
    <text x="955" y="298" text-anchor="middle" fill="#9090b0" font-size="13">acted on continuously, in flight</text>
  </g>
</svg>
<figcaption>Not a chatbot pasted into AR — the model's stream of intent as a first-class control input.</figcaption>
</figure>

<p class="post-hook">The era of "this product runs on that one vendor's model" is short. RakuAI is built so any model — ChatGPT, Claude, Gemini, or yours — can drive an AR experience in real time. Bring the best model. The runtime is ready.</p>

Most game engines that integrate with a cloud LLM today do it the way you would expect. A model gets bolted into the editor as a chat panel. You type at the chat panel. The panel writes some content or some code. The runtime, which has no idea any of this happened, runs the resulting artifact later.

That is not what Raku is doing. Raku is being built to take direction from a cloud LLM as a runtime concern, not an authoring convenience. This weekend's work made that explicit.

## What landed

A hundred and eighteen commits across the runtime this weekend. The headline pieces:

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

Hundred and eighteen commits, big weekend. The engine looks different on Sunday night than it did when the laptop opened on Saturday.

<div class="post-cta">
<h3>Your model belongs on the simulation step</h3>
<p>RakuAI's XRAssistantService is a model-agnostic interface for streaming intent into a live AR experience. If you build frontier models, this is the integration we want to talk to you about.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/llm-makers.html">For AI Labs</a>
<a class="cta-btn cta-secondary" href="/why-rakuai.html">Why RakuAI</a>
</div>
</div>
