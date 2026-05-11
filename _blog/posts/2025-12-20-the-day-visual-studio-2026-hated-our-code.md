---
title: "The Weekend Visual Studio 2026 Hated Our Code"
date: 2025-12-20
author: Kevin Griffin
tags: [build, msvc, vs2026, openxr, debugging, dev-workflow, weekend-build]
description: "The runtime built clean on Linux. The runtime built clean on macOS. Then this Saturday morning I tried to build it in Visual Studio 2026 Insiders, and Visual Studio 2026 had opinions. Twelve PRs later, the build is green. Here is the inside of those twelve PRs and what I learned about how MSVC 2026 wants to be talked to."
series: learning-to-code-with-ai
slug: the-day-visual-studio-2026-hated-our-code
---

There is an old joke that the difference between a senior engineer and a junior engineer is that the senior engineer knows it is going to be a fight with the compiler before they start. This weekend was a fight with the compiler. The compiler was Microsoft Visual C++ as it ships in Visual Studio 2026 Insiders. The codebase was Raku. The fight lasted four days. The codebase won, but barely.

I want to write this one down because the public engineering log should include the days where things did not work, and because the way the agents and I worked through this is genuinely the part of the workflow I am most curious about other people's opinions on.

## The setup

Up to this Saturday the runtime built clean on Linux with GCC and on macOS with Clang. Both of those have been my main weekend development environments. I had not actually tried a Windows MSVC build since the early bring-up in October. The runtime is supposed to be cross-platform. Cross-platform means Windows. So Saturday morning I checked out the repo on a Windows machine with Visual Studio 2026 Insiders and ran the build.

It did not build. It did not nearly build. The first compile pass produced more than two hundred errors and a comparable number of warnings. The errors fell into roughly six categories, each of which became its own PR.

## What the categories were

Each one is worth describing because each one is the kind of thing that hits any C++ codebase the first time it meets a new MSVC version. Other teams will hit these. Some of them may already be hitting them.

**One: Windows macros polluting our namespaces.** Windows headers `#define` a bunch of generic names (`min`, `max`, `DOMAIN`, `HULL`, `ERROR`, `OK`, `NEAR`, `FAR`) that collide with reasonable enum names, function names, and template specializations. Our logging C API had an enum value called `ERROR`. Windows had also defined `ERROR` as a macro. The compiler did exactly what the spec says it does, which is to expand the macro and produce gibberish. The fix is `#undef ERROR` before our header, scoped tightly. Same for the others.

**Two: BOM-marked source files MSVC refused to compile.** Some of our source files had a UTF-8 byte-order mark at the top, which most compilers tolerate, and MSVC 2026 does not. The agent landed a sweep that removed BOMs from every C/C++ source file in the repo.

**Three: Deprecated CRT APIs.** A bunch of standard C functions that the C standard considers fine are flagged by MSVC as "deprecated, use the secure variant." `sscanf` becomes `sscanf_s`. `strncpy` becomes `strncpy_s`. The agent went through and either replaced the calls with the secure variants or wrapped them with the appropriate `_CRT_SECURE_NO_WARNINGS` pragma where the secure variant would have changed semantics in ways we did not want.

**Four: DLL export macros.** The biggest one. Every public symbol in every DLL has to be marked with `__declspec(dllexport)` when building the DLL and `__declspec(dllimport)` when consuming it from another DLL. Linux GCC and macOS Clang do not need this. MSVC does, and our codebase had a lot of cases where the macro was missing, applied inconsistently, or accidentally applied to template specializations the compiler did not actually want to export. The fix was a sweep that normalized the export macro across every public-API header and added it where it was missing.

**Five: `RAKU_API` and the consolidated DLLs.** A weirder one. Some of our internal CMake setup was injecting `-DRAKU_API=__declspec(dllexport)` at compile time even for static libraries that should not have been exporting. MSVC C2491 errors everywhere. The fix was a CMake sanitizer that explicitly undefines RAKU_API for static targets and only sets it for dynamic ones.

**Six: OpenXR headers and `<array>`.** A handful of MSVC compilations failed because `<array>` was being used without being explicitly included. GCC and Clang tend to transitively include it through other STL headers. MSVC does not, and "include what you use" is the right answer regardless. The agent added the missing includes.

## How the weekend went, hour by hour

Saturday morning was mostly me reproducing each class of error and writing the diagnostic notes. The agents do not have a Windows VM in front of them. I had to capture the build output, sanitize it, and feed it back to the agent with a clear ask: "here is the class of error, here is one canonical example, here is the file it lives in, propose a sweep that fixes all instances of this class."

The agents handled the sweeps cleanly. PR #408 fixed Windows macro conflicts in `logging.cpp`. PR #406 fixed the MSVC enum redefinition. PR #404 added the CMake sanitizer for RAKU_API macros. PR #408 (a different one in arvr_demo_telemetry) fixed Windows DLL export errors. PR #411 fixed MSVC 2026 DLL linkage errors and deprecation warnings. PR #413 removed BOMs and replaced deprecated APIs. PR #415 fixed C2491 errors by adding RAKU_RUNTIME_EXPORTS to static libraries. PR #416 fixed CMake build with a header-only OpenXR fetch and added missing runtime sources. PR #401 fixed Windows DLL export macros and removed an MSVC workaround that was now obsolete.

Twelve PRs in two days, give or take. Every one of them is documented under #404–#416 in the runtime repo.

Saturday afternoon was the longest stretch. The DLL-export normalization required reading every public-API header in the engine and deciding which symbols were genuinely part of the public surface. Some of them turned out not to be. A few got demoted to internal as part of this work, which was a net good even though it added scope.

Saturday evening I added a Windows MSVC CI workflow with vcpkg and OpenXR SDK integration so that this never happens again silently. Now every push triggers an MSVC build. The build cannot regress without somebody seeing it in CI.

The next morning was the celebration. By the end of it, the build went green on Windows. First successful x64 build in the runtime's history. The commit message says exactly that: `build: first successful x64 build with OpenXR handle fixes`. The commit hash is `f35f78bd` and it is one of my favorite commits in the project to date.

## What worked, what I would do differently

A few honest notes.

**Bringing a new platform online late is expensive.** I should have run an MSVC build a couple of weekends ago when the codebase was smaller. The errors at that scale would have been twenty, not two hundred. The cost of fixing twenty errors is meaningfully smaller than the cost of fixing two hundred. The lesson is to never let a target platform go un-built for more than a couple of weekends.

**Agent-driven sweeps are the right answer when the fix is mechanical.** The DLL-export sweep, the BOM removal, the deprecated-CRT-replacement: all of these were exactly the kind of work the agent does faster and more consistently than a human. I framed each one as "find all instances of pattern X, apply transformation Y, leave everything else alone," and the agent did exactly that.

**Agent-driven sweeps are the wrong answer when the fix requires judgment.** The RAKU_API macro problem required deciding which CMake targets actually wanted the export and which did not. That was not a sweep. That was a careful, target-by-target review. I did that one by hand with the agent acting as a second pair of eyes on each decision, not as the executor.

**A different model caught a bug another model wrote.** During the deprecated-CRT replacement sweep, one of the agents replaced `sprintf` with `sprintf_s` in a place where the buffer-size semantics were subtly different from what the call site expected. The PR landed. A review pass by a different model caught the mismatch before it shipped. The multi-vendor review workflow earned its keep this weekend, specifically.

## What partners and builders take from this

If you are a partner thinking about whether this engine ships on Windows, the answer as of this Saturday morning is yes. The MSVC build is green. CI keeps it green going forward.

If you are a developer working on your own cross-platform C++ codebase and you are about to try Visual Studio 2026 Insiders for the first time, the six categories above are what is going to hit you. You can pre-empt most of them. Now you know.

If you are an MSVC-team person reading this, the team has done good work on 2026 Insiders. The warnings are genuinely useful and the new tooling is better than 2022. The compatibility breaks are mostly there for good reasons. I'd file a few bug reports if I had more time. They are coming.

Saturday morning, the engine builds clean on three platforms. That is the right thing to start the next weekend with.
