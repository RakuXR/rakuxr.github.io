---
title: "All Eighteen DLLs Green on Linux"
date: 2026-04-04
author: Kevin Griffin
tags: [build, linux, symbol-visibility, cross-platform, ci, weekend-build]
description: "The runtime has been building on Windows since December. Linux had been mostly working, but a small number of the eighteen native DLLs would not build cleanly because of symbol-visibility issues that nobody enjoys. Spent this Saturday tracing the symbol-visibility problem to its root and clearing the last few DLLs. Linux is now a first-class target."
series: learning-to-code-with-ai
slug: all-eighteen-dlls-green-on-linux
---

The Linux build had been a known partial-pass for weeks. Most of the eighteen native runtime DLLs (the engine is structured as a fleet of focused shared libraries) had been building clean. A few had not. The failures had the same shape every time: undefined-symbol errors at link time on functions that obviously did exist in the codebase. Anyone who has worked on Linux shared libraries in C++ knows where this is going.

This Saturday I sat down with the intent of finishing the job. By the end of Saturday, all eighteen DLLs were building clean and the Linux CI pipeline was reporting full green.

This is the post about what the actual issue was, what the fix looked like, and why I think building on three platforms (Linux, macOS, Windows MSVC) is a discipline worth paying for.

## What the failure looked like

The pattern was always something like this. A test binary that links against, say, `libraku_runtime.so` would fail to link with errors like:

```
undefined reference to `raku_runtime_create_session(...)'
undefined reference to `raku_runtime_initialize(...)'
undefined reference to `raku_runtime_shutdown(...)'
```

The functions did exist. They had been written. They were in the source files. They had been compiled. The object files contained them. The shared library, when inspected with `nm -D libraku_runtime.so`, did not export them.

This is the classic Linux shared-library symbol-visibility problem. The runtime had been built with the CMake flag `-fvisibility=hidden` on its source files, which is a perfectly good default. The intent of `-fvisibility=hidden` is to keep internal symbols out of the public-symbol table of the shared library. Anything that needs to be public has to be explicitly tagged with `__attribute__((visibility("default")))` or with a macro that expands to it.

The runtime's build system had a macro called `RAKU_API` that was supposed to expand to the right visibility attribute on each platform. On Windows, `RAKU_API` expanded to `__declspec(dllexport)` when building the DLL and `__declspec(dllimport)` when consuming it. On Linux, it was supposed to expand to `__attribute__((visibility("default")))` when building and to nothing when consuming.

The problem was that the Linux side of the macro had not been applied to every public function. Some functions had been tagged. Many had not. The ones that had not been tagged were getting hidden by the `-fvisibility=hidden` default and disappearing from the public symbol table.

## What the fix looked like

Three steps, all mechanical, all worth writing down.

**One: audit every public-API header for missing `RAKU_API` tags.** Wrote a script that parses each `.h` file in the public API and finds every function declaration that should be public but is not tagged. The script reports the function, the file, and the line. Ran the script. Got a list of three hundred and forty seven functions across eighteen DLLs that needed the tag.

**Two: sweep-add the tag.** This is exactly the kind of mechanical refactor an agent does well. The issue framing said: "for each function listed below, add `RAKU_API` to the declaration line. Do not modify the function body. Do not modify any other line. Run the build after each subsystem's batch and confirm it still builds on Linux." The agent did this cleanly, subsystem by subsystem. Each subsystem PR was reviewable on its own and the Linux build went greener with each merge.

**Three: a CI check that prevents regression.** Added a check that runs at PR time. The check builds the runtime on Linux, runs `nm -D` on each produced `.so`, compares the exported symbol list against the expected set declared in the public-API headers, and fails the PR if any expected symbol is missing. This is the kind of guardrail that will catch the next instance of "I forgot to tag a new function" the day it lands instead of months later.

By the end of Saturday, all eighteen DLLs were exporting their full public surface. The test binaries linked. The tests ran. The Linux build was green.

## Why three platforms is worth paying for

A natural question: why bother with Linux at all? The runtime targets AR glasses, which run a specialized OS that is neither Linux nor Windows nor macOS in the way a developer machine is. Why pay the cross-platform cost on top of the cost of supporting the actual target hardware?

Three reasons.

**One: server-side AI inference and cloud rendering happen on Linux.** Any cloud-side component of an AR experience (model serving, world-state synchronization, persistence) is running on Linux. The runtime has hooks that the cloud side calls. Those hooks have to build and run on Linux for the cloud side to integrate. If the runtime is a Windows-only beast, the cloud side has to either build a separate communication shim or run the runtime under a Linux compatibility layer. Neither is what I want partners to do.

**Two: CI on Linux is faster and cheaper than CI on Windows.** Every PR I merge runs through CI. Linux CI runners are smaller, faster, and cheaper than Windows CI runners. The faster the CI loop, the more iterations the agents and I can run in a Saturday. Linux as a first-class build target accelerates the entire dev workflow.

**Three: cross-platform discipline catches bugs.** This is the deepest reason. When a codebase only builds on one platform, the patterns the developers reach for are the patterns that work on that platform. Cross-platform builds force the patterns to be portable: explicit visibility attributes instead of implicit, explicit cross-platform type widths instead of "long is 32 bits on this compiler," explicit threading semantics instead of "this works on Windows." Today's symbol-visibility fix is exactly that pattern. The codebase is stronger after the fix than it was before, on every platform, because the fix made the visibility contract explicit.

## What this generalizes to

A few honest patterns.

**Symbol visibility on Linux is a tax everyone pays once.** The first time a project hits this issue, it is mysterious and frustrating. Once the fix is in place (the `RAKU_API` macro, applied consistently, with a CI guard), it is invisible. The cost is the first time. Pay it early.

**CI guards for symbol-visibility regressions are not optional.** The kind of bug that takes months to surface, because a function nobody is using yet is missing its tag, is exactly the kind of bug a CI guard catches the day it lands. Set the guard.

**Cross-platform builds make the codebase more honest.** Anywhere a codebase relies on implicit behavior of one platform, the cross-platform port forces the behavior to become explicit. Every time I have ported a codebase to a new platform, the new platform has surfaced bugs that the original platform was quietly absorbing. The fixes are improvements on every platform, not just the new one.

## What partners and builders should take from this

If you are a partner deciding which engine to build on for a cross-platform AR product, ask the team how their build matrix looks. A team that builds on Linux, macOS, and Windows is a team whose codebase has been disciplined by the differences between the three platforms. A team that builds on one is a team whose codebase has not.

If you are a developer working on your own cross-platform shared-library project, the symbol-visibility audit is the audit you should run today, not in March when a test starts failing for reasons that take three days to diagnose. Run `nm -D` on your shared libraries. Compare against your headers. The discrepancies are the audit.

If you are an AI lab whose coding agent writes cross-platform native code, the visibility-attribute macro is the kind of thing the agent needs in its working knowledge. An agent that writes a new public function and forgets to tag it is an agent that costs you a follow-up PR. An agent that tags every public function consistently is an agent that pays for itself.

Saturday wrap. Eighteen DLLs green on Linux. The CI is faster now. The codebase is more honest. The build matrix is three platforms wide.

Back to building.
