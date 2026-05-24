---
title: "The Test That Couldn't Find dxcompiler.dll"
date: 2026-03-28
author: Kevin Griffin
tags: [debugging, windows, msvc, dll-loading, abi, weekend-build]
description: "Eight tests, one Windows error code, one missing shader-compiler DLL the runtime could not boot without. The fix turned a hard load-time dependency into a graceful, observable fallback — so the engine runs anywhere, not just on a fully-equipped developer workstation. Portability is a feature partners pay for."
series: learning-to-code-with-ai
slug: the-test-that-couldnt-find-dxcompiler
---

<figure class="post-hero">
<svg viewBox="0 0 1200 480" role="img" aria-label="A missing dxcompiler DLL turned from a hard crash into a graceful fallback path" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="dxc-bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#111128"/><stop offset="1" stop-color="#0a0a1a"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="480" fill="url(#dxc-bg)"/>
  <text x="600" y="62" text-anchor="middle" fill="#e8e8f0" font-family="system-ui,sans-serif" font-size="34" font-weight="700">Boot Without the DLL</text>
  <text x="600" y="98" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="18">Load-time dependency &#8594; observable fallback</text>
  <g font-family="ui-monospace,monospace">
    <rect x="120" y="160" width="360" height="120" rx="14" fill="#1a1a33" stroke="#e84393" stroke-width="2"/>
    <text x="300" y="210" text-anchor="middle" fill="#ff7aa8" font-size="30" font-weight="800">0xC0000135</text>
    <text x="300" y="246" text-anchor="middle" fill="#9090b0" font-family="system-ui,sans-serif" font-size="15">STATUS_DLL_NOT_FOUND</text>
  </g>
  <g font-family="system-ui,sans-serif">
    <path d="M480 220 L600 220" stroke="#6c5ce7" stroke-width="4"/>
    <polygon points="600,220 584,212 584,228" fill="#6c5ce7"/>
    <text x="540" y="205" text-anchor="middle" fill="#a388ff" font-size="13">LoadLibrary</text>
  </g>
  <g font-family="system-ui,sans-serif" font-size="14" fill="#c8c8e0">
    <rect x="620" y="150" width="460" height="50" rx="10" fill="#16213a" stroke="#00cec9"/><text x="850" y="181" text-anchor="middle">DXC present &#8594; full SPIR-V / DXIL</text>
    <rect x="620" y="212" width="460" height="50" rx="10" fill="#16213a" stroke="#6c5ce7"/><text x="850" y="243" text-anchor="middle">D3DCompiler &#8594; reduced (DXIL only)</text>
    <rect x="620" y="274" width="460" height="50" rx="10" fill="#1a1a33" stroke="#e84393"/><text x="850" y="305" text-anchor="middle">none &#8594; magenta placeholder + WARN</text>
  </g>
  <text x="600" y="400" text-anchor="middle" fill="#00cec9" font-family="system-ui,sans-serif" font-size="16" font-weight="700">71% &#8594; 89% tests passing</text>
</svg>
<figcaption>The runtime boots. The capability is opt-in. The failure mode is loud and visible.</figcaption>
</figure>

<p class="post-hook">A runtime that crashes when one optional DLL is missing has quietly confined itself to one kind of machine. Real portability means booting everywhere and degrading loudly — and that is what partners deploy on.</p>

Saturday morning, CI dashboard, eight tests in red. All eight failed with the same Windows error code: `0xc0000135`. Anyone who has spent time on Windows native development knows that one immediately. `STATUS_DLL_NOT_FOUND`. The process tried to load a DLL it needed and the DLL was not on the system.

The DLL in question was `dxcompiler.dll`, the Microsoft DirectX Shader Compiler runtime. The CI machine did not have it. Production user machines might not have it. Anywhere outside a developer's well-equipped workstation, the runtime had been quietly assuming `dxcompiler.dll` was present and crashing hard when it was not.

By the end of Saturday, three problems were fixed and the test suite was at 89% passing, up from 71%. This is the post about each one.

## Why the dependency was hard in the first place

The shader cross-compilation path uses Microsoft's DXC compiler to take HLSL shader source and produce SPIR-V or DXIL bytecode. Most of the engine's shipped shaders are precompiled. A few code paths in the runtime can compile new shaders at runtime: shader-permutation hot-reload during development, dynamic material editing in the editor, and a couple of debug paths.

The original implementation linked against `dxcompiler.lib` with a `#pragma comment(lib, "dxcompiler.lib")` directive in the shader-cross source. This produced a hard load-time dependency. The Windows loader resolves load-time dependencies when the process starts; if the DLL is missing, the process never gets to `main()`. The runtime executable could not start without the DLL on the system.

This is the right answer for a developer who has the full DXC SDK installed. It is the wrong answer for a CI runner, a user machine, or anywhere else where DXC is not present. The runtime should boot. The hot-reload feature should report "not available." Everything else should continue.

## What the fix looked like

Three changes, each small, each precise.

**The shader-cross source moved from load-time to runtime DLL loading.** Replaced the `#pragma comment(lib, ...)` directive with explicit `LoadLibrary` and `GetProcAddress` calls. The DLL is looked up on first use, not at process start. If `LoadLibrary` fails, the code path returns a clear error.

**Fallback paths added for when DXC is missing.** When `dxcompiler.dll` is not present, the shader-cross subsystem falls back to one of two paths. If the older D3DCompiler is available, it falls back to that with reduced functionality (no SPIR-V output, only DXIL). If even D3DCompiler is missing, it falls back to a placeholder SPIR-V blob that produces a noisy magenta-only fragment shader. The placeholder ensures the runtime continues to work end-to-end in environments where no shader compiler is available; the visual signal makes it obvious that you are running in placeholder mode.

**The graceful-fail path logs and emits telemetry.** Every fallback is logged at WARNING level with the specific subsystem that fell back and the reason. Telemetry records the fallback for ops visibility. A developer running locally without DXC sees the warning in their console and knows to install DXC if they need real shader compilation. A user running the runtime with the assumption that everything is precompiled sees no warning at all because the precompiled shaders work fine without DXC.

This is the right shape for the dependency. The runtime is portable. The capability is opt-in based on what is installed. The failure mode is observable.

## Two adjacent bugs that fell out of the same audit

While I was in the shader-loading code with the lid off, two other tests were failing in adjacent ways and I fixed them in the same pass.

**Audio bus effects ABI mismatch.** The `raku_audio_bus_add_effect` and `raku_audio_bus_remove_effect` C API functions had been written with a `(handle, struct*)` signature, but the test suite was calling them with `(handle, handle)` because that is what the rest of the audio API used. The tests were segfaulting because the struct-pointer dereference was reading whatever happened to live at the address the second handle's bits resembled. ABI mismatch.

The fix was to change the C API to match the rest of the audio module: `(handle, handle)`. This is the right shape for the API because effect chains in the audio bus are first-class objects that the runtime tracks. The struct-pointer version had been a holdover from an earlier API design that did not survive the rest of the refactor. The test suite was right; the implementation was stale.

**Memory-leak test stubs overriding real implementations.** The asset-streaming subsystem has a memory-leak test that exercises reference counting on streamed assets. The test was failing because a stub implementation of `AssetStreamingManager` had been left in the test fixture and was overriding the real implementation from the runtime DLL. The test was exercising the stub, not the real code. The stub had a memory leak. The real implementation did not. The test was right about there being a leak; it was wrong about whose leak it was.

The fix was to remove the stub from the test fixture and to add `RAKU_STREAMING_API` exports on the real implementation so the test could link against it cleanly. Once linked correctly, the test passed against the real code.

## What the three fixes unblocked together

Eight tests went green on the dxcompiler fix. Two on the audio-bus fix. Three on the memory-leak fix. Total tests passing climbed from 39/55 to 49/55. The 89% number is the right milestone to celebrate but the deeper milestone is that the runtime now works without DXC, which means it will work in environments I have not anticipated yet.

## What I learned

Three things.

**Hard load-time dependencies are a portability defect.** Anywhere your runtime has a load-time dependency on a DLL or shared object that is not universally present, the runtime has constrained itself to environments that include that DLL. That constraint is fine to make on purpose. It is bad to make on accident. The audit of "what does our runtime require at load time" is worth running.

**`0xc0000135` is the most common Windows DLL error code, and the message reveals nothing.** The error tells you a DLL is missing. It does not tell you which one. The diagnostic tools to figure out which (`Process Monitor`, `Dependencies.exe`, the new Windows ETW tracing) all work, but they all require you to know they exist and to set them up before the failure happens. The runtime now emits a clear error message when a graceful fallback fires, naming the DLL that was missing. Future-me will be grateful.

**ABI mismatches between tests and implementations are usually correct on the test side.** The tests were written against the API the rest of the codebase exposed. When the tests disagreed with the implementation, the tests were right. This is the inverse of the usual instinct, which is to "fix the test." The right instinct is to look at the broader API surface and ask which side is the outlier.

## What partners and builders should take from this

If you are evaluating an engine for partnership and you are deploying to environments where the developer's machine and the production environment are different (which is almost every deployment), ask the team about their hard load-time dependencies. The right answer is a short list, all justified. The wrong answer is a long list, half of which the team has forgotten about.

If you are a Windows-native developer and you are not yet using `LoadLibrary` plus `GetProcAddress` for any DLL that is not universally present, this is the gentle nudge. The pattern is small. The portability win is large.

If you are an AI lab whose coding agent writes Windows code, the patterns to watch for in agent-authored code are `#pragma comment(lib, ...)` directives that should be runtime loads and ABI signatures that drift from the rest of the codebase. Both are flagged by static analysis. Both should be in the agent's review checklist.

End-of-weekend wrap. The runtime boots cleanly on machines that do not have DXC. Eleven tests went green in two days. The next audit is on the calendar.

Back to building.

<div class="post-cta">
<h3>A runtime that runs where your hardware lives</h3>
<p>RakuAI is the spatial runtime built for smart glasses and the messy real world — portable, graceful under missing dependencies, observable when it falls back. See what it takes to deploy everywhere.</p>
<div class="cta-buttons">
<a class="cta-btn cta-primary" href="/smart-glasses.html">For Smart Glasses</a>
<a class="cta-btn cta-secondary" href="/developers/">For Developers</a>
</div>
</div>
