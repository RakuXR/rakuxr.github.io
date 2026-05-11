---
title: "Meta Quest Is Now a Target"
date: 2025-11-15
author: Kevin Griffin
tags: [meta-quest, horizon-os, openxr, passthrough, partnerships, ar-glasses, weekend-build]
description: "Spent this weekendendend lighting up Meta Quest as a target platform. OpenXR with Horizon OS, passthrough AR mode with composition layers, stereo rendering with 6DoF tracking. The engine now reaches one of the largest installed bases in spatial computing. The partner-meeting context this weekendend made it worth going hard."
series: learning-to-code-with-ai
slug: meta-quest-is-now-a-target
---

Woke up Saturday after a partner meeting late this past week that made the next move obvious. The eventual product target for Raku is AR glasses. The product target today is also AR glasses, but the AR glasses we want to ship on do not yet exist in a form anyone can buy. That gap is real. It is also frustrating, because the experiences we want people to have on this engine should not have to wait for hardware.

This weekend we closed the gap a different way. The runtime now runs on Meta Quest headsets with Horizon OS, in passthrough AR mode, through the OpenXR layer Meta exposes. The Quest is not the form factor we are ultimately optimizing for. It is the form factor people already own.

## What landed

Three runtime PRs and matching SDK pieces:

- OpenXR/Quest VR integration with stereo rendering and 6DoF tracking
- Passthrough AR mode for Meta Quest with composition layers and alpha blending
- Horizon OS permissions documentation for Quest passthrough AR

The SDK got the corresponding work: C samples extended for Quest VR with platform-adaptive runtime selection, comprehensive Meta Quest (Horizon OS) documentation for OpenXR integration, Quest VR sample support and CI validation, and a Meta Quest passthrough AR documentation pass with platform comparison.

The governance side got Epic #190: Horizon OS (Meta Quest) OpenXR Support, plus reference documentation for the integration. The strategic-documents PR (#193 in the governance repo) integrated context from a partner meeting earlier in the week.

## Why Quest, why now

Two reasons.

**The Quest is the largest installed base in spatial computing right now.** If you want a serious AR experience to reach a meaningful audience in 2026, the Quest is the device that audience already owns. Building for the device they have lets the engine prove itself with real users before glasses-class hardware ships at consumer scale. The right thing to do is to meet users where they are.

**Quest's OpenXR runtime is a real implementation, not a half-spec.** This matters more than people give it credit for. Meta has invested heavily in OpenXR conformance, in passthrough AR through XR_FB_passthrough, in foveated rendering through XR_FB_foveation, and in hand tracking through XR_EXT_hand_tracking. The extensions that the Quest exposes are the same extensions our runtime started consuming in earnest two weeks ago. The integration was not free, but it was a lot less expensive than it would have been against a less-conformant OpenXR target.

## What the passthrough AR mode actually does

The Quest is a VR-first device with a passthrough AR mode bolted on top. That sounds like a compromise, and in some ways it is. In some other ways it is a forcing function that makes AR on the Quest more disciplined than it would otherwise be.

The composition layer manager we landed two weeks ago for general OpenXR is the thing that makes passthrough work cleanly. The camera passthrough comes through as one composition layer. Our runtime's virtual content comes through as another, with alpha blending so the virtual content composites correctly against the real world the user can see through the cameras. System overlays (Meta's own UI when summoned) come through as a third layer at the right z-order.

The alpha blending is the subtle part. Premultiplied alpha matters. Lighting estimation matters. The virtual content has to be color-corrected against the ambient lighting the cameras are showing, or it floats unconvincingly. The lighting-estimation work that landed three weeks ago in the runtime is what makes the AR mode look like AR rather than like a flat sticker on top of a video feed.

## The Horizon OS permissions question

Meta's permission model for passthrough AR is more involved than most developers expect coming from desktop VR. The runtime has to declare the right manifest entries, request the right runtime permissions, and gracefully degrade when a user denies one of them. The documentation PR that landed midweek (#149 in the runtime, plus matching SDK docs) is meant to keep developers building on Raku from running into the permission cliff Meta has built around the camera feed for privacy reasons.

The privacy story matters. The cameras on a Quest are seeing the user's home. Anything the engine does with that camera feed has to be opt-in, transparent, and audit-able. That is true on Quest. It will be more true on AR glasses people wear in public. The work we are doing this weekendend to handle the Quest's permission model correctly will carry forward to every more sensitive deployment later.

## The partner-meeting context

A note about the governance docs PR. Meta's developer-relations team and I have been talking. I am not going to summarize the content of those conversations on the public blog, because the conversations are still in progress. What I will say is that the engineering this weekendend was informed by what they care about, and the OpenXR-first approach we have been taking lines up with where their platform is going.

The strategic-document integration in the governance repo this weekendend captures the meeting notes and where the engineering is responding to them. The repo is private; the engineering response is public. The PRs that landed this weekendend are the public artifact.

## What this does and does not mean

What it means: a developer who wants to build an AR experience on Raku can target the Quest today and reach users today. The experience will not be optimal for AR glasses form factors, because the Quest is not AR glasses. The experience will be a viable preview of what AR will feel like, and the user can actually wear the hardware.

What it does not mean: Raku is "a Quest engine" now. Raku is a cross-platform AR runtime that happens to also run on the Quest. The same engine will run on AR glasses when AR glasses ship in the form factor we are optimizing for. The Quest is one of several targets, not the target.

What it does not mean: we are forking the engine for the Quest. Every Quest-specific piece sits behind the OpenXR layer or the Horizon-OS feature flag. If a developer builds an experience that runs on the Quest today, the same `.raku` experience definition will load on AR glasses tomorrow without any code change above the SDK boundary.

## What I want partners and builders to take from this

If you are at Meta and you are reading this: the engineering this weekendend is responsive to the conversation. We want to be a serious developer of Quest-targeted AR experiences in 2026. The OpenXR work is the foundation. The next steps are on us.

If you are an experienced Quest developer thinking about what Raku adds on top of native Horizon OS development: the answer is the AI runtime layer and the cross-platform portability. The AI nervous system that lives inside the engine on the simulation step is the same one whether you ship to the Quest or to glasses-class hardware. Building on Raku now gets you to AR glasses for free when AR glasses arrive.

If you are an indie AR developer thinking about which engine to build with: the Quest is the device your users own today. Raku's Quest support is real as of this Saturday. The Unity binding and the Unreal binding both work against it. The SDK quickstart includes Quest setup.

A hundred and eighteen commits across the weekend. Saturday evening, the engine has a new target platform. Back to building tomorrow morning.
