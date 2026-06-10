# push-locale-parity-branch.ps1
# Run this from PowerShell to commit and push the locale-parity + dead-infra hygiene changes.
# All 52 files have already been modified on disk by the Claude agent.
# This script handles the git operations.
#
# Usage: cd to repo root, then: .\push-locale-parity-branch.ps1

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

Write-Host "=== Locale Parity + Dead-Infra Hygiene: Git Push Script ===" -ForegroundColor Cyan
Write-Host "Repo: $repo"
Write-Host ""

# Remove stale lock files (Windows can delete these; Linux/POSIX tools can't)
$locks = @(
    ".git\index.lock",
    ".git\config.lock",
    ".git\packed-refs.lock",
    ".git\refs\heads\fix\locale-parity-flydev-hygiene.lock",
    ".git\objects\maintenance.lock"
)
foreach ($lock in $locks) {
    $full = Join-Path $repo $lock
    if (Test-Path $full) {
        Remove-Item $full -Force
        Write-Host "Removed lock: $lock" -ForegroundColor Yellow
    }
}
Write-Host ""

# Save current branch
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "Current branch: $currentBranch"

# Stash working tree changes (saves 410 audit branch modifications)
Write-Host "Stashing current working tree changes..."
git stash push -u -m "wip: audit/site-qa-remediation changes (auto-stash before parity branch)"
Write-Host "Stash done."
Write-Host ""

# Switch to the parity branch (already exists at origin/main commit)
Write-Host "Switching to fix/locale-parity-flydev-hygiene..."
git checkout fix/locale-parity-flydev-hygiene
Write-Host ""

# Stage the 52 changed files
Write-Host "Staging changed files..."
$files = @(
    "blog/index.html",
    "blog/agents-as-team-not-agents-as-tool/index.html",
    "blog/ai-as-interface-not-ai-as-dependency/index.html",
    "blog/ai-as-nervous-system-not-ai-as-factory/index.html",
    "blog/all-eighteen-dlls-green-on-linux/index.html",
    "blog/ar2-gen1-validating-hardware-we-dont-have/index.html",
    "blog/blade-to-raku-renaming-a-runtime/index.html",
    "blog/built-to-take-direction-from-chatgpt-claude-gemini/index.html",
    "blog/claude-writes-gemini-reviews-chatgpt-rubber-ducks/index.html",
    "blog/day-zero-readme-spec-and-bet-on-ar-glasses/index.html",
    "blog/eight-demos-zero-code/index.html",
    "blog/eight-security-findings/index.html",
    "blog/experiences-as-code-not-experiences-as-assets/index.html",
    "blog/foundation-built-by-agents-not-for-agents/index.html",
    "blog/from-54-to-100-tests-passing/index.html",
    "blog/gdc-and-the-mobile-platform-blitz/index.html",
    "blog/gemini-reviewed-claudes-pr/index.html",
    "blog/how-rakuai-works-end-to-end/index.html",
    "blog/mapping-the-agents-before-writing-the-engine/index.html",
    "blog/meshy-pipeline-and-the-robe-that-broke-pose-estimation/index.html",
    "blog/meta-quest-is-now-a-target/index.html",
    "blog/one-saturday-before-the-first-commit/index.html",
    "blog/openxr-and-dual-link-radios/index.html",
    "blog/pink-graphics-score-runaway-xr-crash/index.html",
    "blog/prompt-length-guards-on-every-llm-caller/index.html",
    "blog/rakuai-joins-nvidia-inception/index.html",
    "blog/replacing-seven-brute-force-algorithms/index.html",
    "blog/sdk-parity-and-the-two-stream-bridge/index.html",
    "blog/series/learning-to-code-with-ai/index.html",
    "blog/six-mcp-tools-and-what-the-adapters-unlock/index.html",
    "blog/sketching-the-sdk-folder-structure/index.html",
    "blog/sub-millimeter-anchors-and-calligraphy/index.html",
    "blog/supercharge-your-ai-in-the-real-world/index.html",
    "blog/the-day-visual-studio-2026-hated-our-code/index.html",
    "blog/the-find-replace-that-corrupted-300-files/index.html",
    "blog/the-slow-week-was-the-right-week/index.html",
    "blog/the-test-that-couldnt-find-dxcompiler/index.html",
    "blog/the-week-the-build-stopped-arguing/index.html",
    "blog/the-week-the-engine-grew-up/index.html",
    "blog/the-weekend-i-found-the-stubs/index.html",
    "blog/two-months-in-what-the-engine-has-become/index.html",
    "blog/week-one-282-commits/index.html",
    "blog/when-the-demo-crashed-silently/index.html",
    "de/index.html",
    "es/index.html",
    "fr/index.html",
    "ko/index.html",
    "pt-BR/index.html",
    "zh-CN/index.html",
    "zh-TW/index.html",
    "ko/capture.html"
)

foreach ($f in $files) {
    git add $f
}
Write-Host "Staged $($files.Count) files."
Write-Host ""

# Commit
$msg = "fix: locale parity + dead-infra hygiene (fly.dev retirement)

Website track items:
- Remove stale fly.dev hosts from CSP connect-src in all 43 blog pages
- Fix hCaptcha explicit-render pattern in 7 locale index.html files:
  api.js -> api.js?render=explicit&onload=__rakuOnHCaptchaLoad__
- Add hCaptcha key-injection block (reads from public-config.js) to 7 locale files
- Remove data-sitekey=YOUR_HCAPTCHA_SITE_KEY placeholders from 7 locale files
- Fix RAKU_API_BASE JS: raku-backend.fly.dev / raku-api-staging.fly.dev -> api.rakuai.com
- Bring ko/capture.html CSP to canonical parity (script-src sparkjs.dev/cdn.jsdelivr.net,
  connect-src api.rakuai.com/cdn.raku.games, worker-src blob:)

52 files changed. verify-capture-app-sync unaffected (capture-app/ not touched).
Edge security headers (HSTS/XFO) stay gated -- GitHub Pages cannot set response headers."

git commit -m $msg
Write-Host ""

# Push
Write-Host "Pushing fix/locale-parity-flydev-hygiene to origin..."
git push origin fix/locale-parity-flydev-hygiene
Write-Host ""

Write-Host "=== Push complete! ===" -ForegroundColor Green
Write-Host ""
Write-Host "Next: open PR at https://github.com/RakuXR/rakuxr.github.io/compare/fix/locale-parity-flydev-hygiene"
Write-Host "Wait ~3 min for Copilot + Gemini reviewers before merging."
Write-Host ""

# Restore the audit branch
Write-Host "Restoring $currentBranch..."
git checkout $currentBranch
git stash pop
Write-Host "Restored. Done." -ForegroundColor Green
