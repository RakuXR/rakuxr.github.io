---
title: "Sketching the SDK Folder Structure on Paper"
date: 2025-07-19
author: Kevin Griffin
tags: [design, sdk, folder-structure, stubs, pre-build, weekend-build]
description: "Started this Saturday on the SDK's folder structure before writing any code. /apps, /modules, /assets, /docs, /config. Each demo has a home. Each shared module has a clear contract. A handful of code stubs in pseudocode that show the agents what a real implementation should eventually look like. The folder structure is the spec the agents will build to."
series: learning-to-code-with-ai
slug: sketching-the-sdk-folder-structure
---

There is a kind of design work that is invisible from the outside and load-bearing from the inside. The folder structure of a codebase is one of those things. It looks like file management. It is actually the org chart of the code. Get it right early and every PR for the next two years lands in the right place. Get it wrong early and every PR for the next two years has to argue about where it belongs.

This Saturday went into getting it right early.

## What the structure has to support

Before drawing boxes, I made a list of constraints the structure has to satisfy.

**Each demo gets its own home.** The eight demos I specified last month each need a folder where their code, their assets, and their docs live together. A developer reading any one demo should not have to jump across four different parts of the SDK to understand it.

**Shared modules are separable from the demos.** Anything that is reused across demos (HUD rendering, gesture input, gaze tracking, multiplayer sync, voice control, visual effects) lives in its own place and is consumed by the demos through a public surface.

**Assets are organized by type, not by demo.** A health-bar PNG is a HUD widget, not an Arena Demo asset. Reusable visual assets live in a shared assets folder and the demos that need them link to them.

**Docs are co-located with what they describe.** The SDK install doc lives next to the SDK. The demo guide lives next to the demos. The HUD API doc lives next to the HUD module. Doc discoverability is mostly about doc location.

**Config is its own concern.** The HUD configuration files, the default layouts, the multiplayer role configurations. These are not code, not assets, not docs. They get their own home.

## The structure

After a morning of whiteboarding, the layout looks like this.

The root folder is the SDK itself. Under the root:

`/apps/` is where the demos live. Each demo gets a subfolder. `arena_demo/` for solo arena. `coach_demo/` for AR coaching. `hud_designer/` for the HUD overlay designer. `streamer_demo/` for streamer mode. `pos_demo/` for the point-of-service overlay. `companion_demo/` for the AR companion HUD. `aimlab_demo/` for the AR aim trainer. `hudsync_demo/` for the multiplayer HUD sync. Each demo folder contains its own source, its own configuration, its own demo-specific assets, and its own README.

`/modules/` is where the shared code lives. Six modules at the start. The HUD renderer, which every demo consumes. Gesture input detection, which most demos consume. Gaze tracking, used by the demos that need it. Multiplayer sync, used by the LAN-multiplayer demos. The overlay animator for visual effects. The voice-control interface for the demos that take voice input. Each module exposes a small, stable public surface that the demos link to.

`/assets/` is the shared asset library. HUD widgets (health bars, ammo counters, compass overlays) as PNG and SVG. Audio effects for hits, alerts, voiceovers. Gesture icons that show the user when a gesture has been detected. Demos link to assets here rather than duplicating them.

`/docs/` is the documentation home. A README that introduces the SDK and walks through installation. A demo guide that explains how to run each of the eight demos. An API reference for the HUD module. An API reference for the voice-control module. The docs are deliberately co-located so that a developer who wants to know how the HUD works can read the source and the doc in the same folder.

`/config/` is configuration. The default HUD layout used as the starting point for new projects. Sample layouts exported from the HUD designer. Multiplayer role definitions. Keeping config separate from code keeps the demos clean and lets a developer change behavior without recompiling.

## The stubs

A folder structure on its own is just an empty filesystem. The other thing I drafted today is a set of code stubs that show the agents (when they eventually start writing code against this structure) what a real implementation should look like at each entry point.

The stubs are in Python pseudocode for now. They will be translated to the production language (C++ for the runtime, with bindings into Python and other ecosystems) once the engine repo opens. The Python form is what lets me reason about the interfaces without getting lost in implementation details.

A sample stub, for the gesture-input module. Roughly:

```python
def detect_gesture(frame):
    """Detect gestures like swipe, point, raise, duck in a single sensor frame."""
    if is_swipe(frame):
        return "swipe"
    elif is_raise(frame):
        return "raise_arm"
    else:
        return None
```

That is not the production code. It is the contract. The production code will replace `is_swipe` and `is_raise` with real computer-vision pipelines. The interface stays the same. The signature is the thing the demos will code against. Locking the signature early means I can ship the demos before the CV pipeline is bulletproof, because the demos do not depend on the implementation, they depend on the interface.

I drafted stubs of this shape for every module in the `/modules/` folder. Six small Python files. None of them implement anything. All of them define the contract that the eventual implementations will have to honor.

## Why the agents need this

This is the connection back to the agent roster from a few Saturdays ago.

When the time comes to write the real code, the agents will not be inventing the architecture. The architecture is on paper. The folder structure tells them where the new code goes. The module stubs tell them what interface to implement. The asset organization tells them where to look for the things they need. The docs structure tells them where to put the docs they write.

That is the difference between an agent-built codebase that turns into mush after three months and one that stays coherent for years. The structure is the discipline. The agents inherit the discipline through the structure.

Without this prep work, an agent asked to "implement gesture input" would invent a folder, invent an API, write the code, and produce something that worked in isolation. Multiplied across six modules, that approach produces six incompatible mini-engines. The structure prevents that failure mode by drawing the boxes the agents have to write into.

## What is hard about this

A few honest things.

**Folder structures want to grow.** Six months from now I will want to add a seventh module. The structure has to allow that without becoming a junk drawer. The rule I am imposing on myself: any new top-level folder needs to justify why it is not a subfolder of an existing one. Most new things turn out to be subfolders.

**The stubs need maintenance.** As the real implementations land, the stubs become stale. The agents reading the stubs as "the contract" will inherit any drift between the stub and the real implementation. The fix is to make the stubs the source of truth, and to require the real implementations to update them when the contract changes.

**Some of these folders are speculative.** The `/config/` folder is a bet that runtime configuration files will be a real category of artifact in this SDK. If it turns out they are not, the folder shrinks or merges into something else. I am OK with that. It is cheaper to remove a folder later than to invent one in a year when the convention has already drifted.

## What is next

Next Saturday is the API surface design. Each of the six modules above needs its public surface specified. That means deciding what data types cross the boundary, what error codes are returned, what events are emitted. With the folder structure done, the API design has somewhere to land.

After that comes the demo-by-demo specification of which modules each demo consumes and in what order. Then the runtime architecture. Then, finally, the engine repo opens.

The patent estate has been waiting a decade. A few more weeks of design work to land it right will not be the thing that costs us the window.

Folder structure done. The codebase has a shape now, even though there is no code in it yet.
