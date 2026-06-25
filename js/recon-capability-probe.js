// recon-capability-probe.js
// Runtime device-capability probe + reconstruction-engine seam for Raku Capture.
//
// Purpose: decide whether a phone in a PWA can attempt an ON-DEVICE coarse
// reconstruction preview, or whether we should go straight to the CLOUD pass.
// The cloud pass (COLMAP -> Brush -> .spz on the G5/A10G) is always the quality
// keeper; on-device is only ever a fast coarse PREVIEW that swaps out for the
// cloud result when it lands.
//
// Why a PROBE and not a model allowlist (read before editing):
//   * A PWA cannot read the iPhone model string.
//   * iOS Safari exposes NO navigator.deviceMemory, NO performance.memory, NO
//     thermal API, and NO WebXR depth/LiDAR. So the gate is built almost entirely
//     from WebGPU adapter limits + shader-f16 + a timed compute micro-benchmark,
//     with a try/catch memory allocation as a soft signal.
//   * Thresholds below are CONSERVATIVE placeholders and MUST be calibrated on a
//     real device matrix (iPhone 12/A14 .. iPhone 15/A17, a few Android tiers)
//     before the on-device path is relied on. They are tuned to fail safe: when
//     unsure, return a lower tier and let the cloud handle it.
//
// Tiers returned:
//   CLOUD_ONLY        no WebGPU / no compute / fails a hard gate -> cloud does all
//   RENDER_ONLY       can render a splat but not reconstruct on-device -> cloud
//   ON_DEVICE_PREVIEW probe passed -> attempt a coarse on-device preview + cloud
//
// No bundler, no dependencies, ASCII-only. Exposes window.RakuReconProbe.

(function () {
  'use strict';

  var TIER = {
    CLOUD_ONLY: 'CLOUD_ONLY',
    RENDER_ONLY: 'RENDER_ONLY',
    ON_DEVICE_PREVIEW: 'ON_DEVICE_PREVIEW',
  };

  // Thresholds -- CALIBRATE on real devices. Conservative by design.
  var THRESH = {
    minStorageBindingBytes: 128 * 1024 * 1024,   // spec default floor; below = render-only
    minBufferBytes: 256 * 1024 * 1024,           // need headroom for splat state
    minDeviceMemoryGB: 4,                        // Android-only signal; iOS undefined
    memoryProbeBytes: 256 * 1024 * 1024,         // try/catch allocation target
    // Micro-benchmark: approximate GFLOPS floor to attempt an on-device preview.
    // Placeholder -- an A14 should land near/below this, A16+ above it. CALIBRATE.
    minBenchGflops: 40,
  };

  function nowMs() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : Date.now();
  }

  // Soft memory signal: attempt to allocate (and immediately release) a buffer.
  // On iOS the tab has a hard ceiling (~1.5 GB on A14, ~3 GB on A17) that is the
  // real thing that crashes an over-ambitious job, and it is not otherwise
  // readable. A failed allocation is a strong "do not reconstruct here" signal.
  function probeMemory(bytes) {
    try {
      var buf = new ArrayBuffer(bytes);
      var ok = buf.byteLength === bytes;
      buf = null;
      return ok;
    } catch (e) {
      return false;
    }
  }

  // WebGPU compute micro-benchmark: the one tier signal that is not quantized
  // for fingerprinting and works the same on iOS and Android. Times a fixed
  // FLOP-bound dispatch, discards the first run (shader compile / warm-up), and
  // returns an APPROXIMATE GFLOPS figure. Returns null if anything is unavailable.
  async function microBenchmark(device) {
    var WORKGROUPS = 1024;
    var THREADS = 64;
    var ITERS = 4096; // inner FLOP loop
    var code =
      '@group(0) @binding(0) var<storage, read_write> out : array<f32>;\n' +
      '@compute @workgroup_size(' + THREADS + ')\n' +
      'fn main(@builtin(global_invocation_id) gid : vec3<u32>) {\n' +
      '  var x : f32 = f32(gid.x) * 0.000001 + 1.0;\n' +
      '  for (var i : u32 = 0u; i < ' + ITERS + 'u; i = i + 1u) {\n' +
      '    x = fma(x, 1.0000001, 0.0000001);\n' +
      '    x = x - floor(x);\n' +
      '  }\n' +
      '  out[gid.x] = x;\n' +
      '}\n';
    try {
      var module = device.createShaderModule({ code: code });
      var pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: module, entryPoint: 'main' },
      });
      var n = WORKGROUPS * THREADS;
      var outBuf = device.createBuffer({
        size: n * 4,
        usage: GPUBufferUsage.STORAGE,
      });
      var bind = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: outBuf } }],
      });

      async function runOnce() {
        var enc = device.createCommandEncoder();
        var pass = enc.beginComputePass();
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bind);
        pass.dispatchWorkgroups(WORKGROUPS);
        pass.end();
        device.queue.submit([enc.finish()]);
        await device.queue.onSubmittedWorkDone();
      }

      await runOnce(); // discard: shader compile + warm-up
      var t0 = nowMs();
      var REPS = 4;
      for (var r = 0; r < REPS; r++) { await runOnce(); }
      var ms = (nowMs() - t0) / REPS;
      // ~2 FLOPs per inner iter (fma + sub), times threads*iters.
      var flops = n * ITERS * 2;
      var gflops = (flops / (ms / 1000)) / 1e9;
      outBuf.destroy && outBuf.destroy();
      return { gflops: gflops, msPerRun: ms };
    } catch (e) {
      return null;
    }
  }

  // Run the full probe. Always resolves (never throws); on any failure it falls
  // back to the safest tier. Caller should cache the result per session.
  async function probeReconCapability(options) {
    options = options || {};
    var result = {
      tier: TIER.CLOUD_ONLY,
      webgpu: false,
      shaderF16: false,
      adapterLimits: null,
      deviceMemory: (typeof navigator !== 'undefined') ? navigator.deviceMemory : undefined,
      memoryProbePassed: null,
      bench: null,
      reasons: [],
    };

    if (typeof navigator === 'undefined' || !navigator.gpu) {
      result.reasons.push('no navigator.gpu (WebGPU unavailable)');
      return result;
    }
    result.webgpu = true;

    var adapter;
    try {
      adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    } catch (e) {
      result.reasons.push('requestAdapter threw: ' + (e && e.message ? e.message : e));
      return result;
    }
    if (!adapter) {
      result.reasons.push('no WebGPU adapter');
      return result;
    }

    result.shaderF16 = !!(adapter.features && adapter.features.has && adapter.features.has('shader-f16'));
    var L = adapter.limits || {};
    result.adapterLimits = {
      maxBufferSize: L.maxBufferSize,
      maxStorageBufferBindingSize: L.maxStorageBufferBindingSize,
      maxComputeWorkgroupStorageSize: L.maxComputeWorkgroupStorageSize,
      maxComputeInvocationsPerWorkgroup: L.maxComputeInvocationsPerWorkgroup,
    };

    // Render is possible with WebGPU present; default to RENDER_ONLY and only
    // promote to ON_DEVICE_PREVIEW if every reconstruction gate passes.
    result.tier = TIER.RENDER_ONLY;

    if (!result.shaderF16) {
      result.reasons.push('no shader-f16 (esp. required on iOS for memory headroom)');
      return result; // RENDER_ONLY
    }
    if (typeof result.deviceMemory === 'number' && result.deviceMemory < THRESH.minDeviceMemoryGB) {
      result.reasons.push('deviceMemory ' + result.deviceMemory + 'GB < ' + THRESH.minDeviceMemoryGB);
      return result;
    }
    if (typeof L.maxStorageBufferBindingSize === 'number' &&
        L.maxStorageBufferBindingSize < THRESH.minStorageBindingBytes) {
      result.reasons.push('maxStorageBufferBindingSize below floor');
      return result;
    }
    if (typeof L.maxBufferSize === 'number' && L.maxBufferSize < THRESH.minBufferBytes) {
      result.reasons.push('maxBufferSize below floor');
      return result;
    }

    result.memoryProbePassed = probeMemory(THRESH.memoryProbeBytes);
    if (!result.memoryProbePassed) {
      result.reasons.push('memory allocation probe failed (tab ceiling too low)');
      return result;
    }

    // The decisive tier signal.
    var device = null;
    try {
      device = await adapter.requestDevice();
    } catch (e) {
      result.reasons.push('requestDevice failed: ' + (e && e.message ? e.message : e));
      return result;
    }
    result.bench = await microBenchmark(device);
    device.destroy && device.destroy();

    if (!result.bench) {
      result.reasons.push('micro-benchmark unavailable');
      return result; // RENDER_ONLY: cannot confirm enough compute
    }
    if (result.bench.gflops < THRESH.minBenchGflops) {
      result.reasons.push('benchmark ' + result.bench.gflops.toFixed(1) +
        ' GFLOPS < ' + THRESH.minBenchGflops + ' floor');
      return result;
    }

    result.tier = TIER.ON_DEVICE_PREVIEW;
    result.reasons.push('passed all gates; on-device coarse preview eligible');
    return result;
  }

  // The seam. Decides the reconstruction engine from the probe + the feature
  // flag. Flag precedence (highest first):
  //   1. ?recon=cloud | ?recon=auto | ?recon=off  (URL, for testing)
  //   2. window.RAKU_RECON_ONDEVICE = 'auto' | 'force-cloud' | 'off'
  //   3. default 'auto' (on-device where the probe passes)
  // Returns 'onDevicePreview' or 'cloudOnly'. Cloud is ALWAYS started by the
  // caller regardless; this only decides whether to ALSO attempt on-device.
  function readFlag() {
    var p = null;
    try { p = new URLSearchParams(window.location.search).get('recon'); } catch (e) { p = null; }
    if (p === 'cloud' || p === 'off' || p === 'auto') {
      return p === 'cloud' ? 'force-cloud' : p;
    }
    if (typeof window !== 'undefined' && window.RAKU_RECON_ONDEVICE) {
      return window.RAKU_RECON_ONDEVICE;
    }
    return 'auto';
  }

  function resolveReconEngine(probe) {
    var flag = readFlag();
    if (flag === 'force-cloud' || flag === 'off') {
      return { engine: 'cloudOnly', flag: flag, tier: probe ? probe.tier : null };
    }
    var onDevice = probe && probe.tier === TIER.ON_DEVICE_PREVIEW;
    return {
      engine: onDevice ? 'onDevicePreview' : 'cloudOnly',
      flag: flag,
      tier: probe ? probe.tier : null,
    };
  }

  window.RakuReconProbe = {
    TIER: TIER,
    THRESH: THRESH,
    probeReconCapability: probeReconCapability,
    resolveReconEngine: resolveReconEngine,
  };
})();
