<#
.SYNOPSIS
    Refresh the raku-mcp developer JWT and write it into Claude Desktop's MCP config.

.DESCRIPTION
    The developer JWT used to authenticate against https://raku-mcp.fly.dev/mcp/
    expires every 24 hours. This script exchanges your long-lived raku_ API key
    for a fresh JWT and patches it into your Claude Desktop config so the MCP
    connector keeps working without manual edits.

    Run it from a scheduled task once a day, or by hand when you notice the
    Raku tools have disappeared from Claude.

.PARAMETER ApiKey
    Your raku_ API key. If omitted, reads $env:RAKU_API_KEY.

.PARAMETER ApiBase
    raku-api base URL. Default: https://raku-api.fly.dev (production).

.PARAMETER ConfigPath
    Claude Desktop config path. Defaults to
    $env:APPDATA\Claude\claude_desktop_config.json on Windows.

.EXAMPLE
    .\Refresh-RakuMcpJwt.ps1
    # Uses $env:RAKU_API_KEY, patches the default config.
#>

[CmdletBinding()]
param(
    [string]$ApiKey   = $env:RAKU_API_KEY,
    [string]$ApiBase  = "https://raku-api.fly.dev",
    [string]$ConfigPath = (Join-Path $env:APPDATA "Claude\claude_desktop_config.json")
)

$ErrorActionPreference = "Stop"

if (-not $ApiKey) {
    Write-Error "Set RAKU_API_KEY or pass -ApiKey. Get one at https://rakuai.com/developers/login.html"
    exit 1
}
if ($ApiKey -notlike "raku_*") {
    Write-Error "ApiKey doesn't look like a raku_ key."
    exit 1
}

Write-Host "Exchanging API key for JWT..." -ForegroundColor Cyan
$body = @{ api_key = $ApiKey } | ConvertTo-Json -Compress
try {
    $resp = Invoke-RestMethod -Method Post -Uri "$ApiBase/api/v1/auth/token" `
        -ContentType 'application/json' -Body $body
} catch {
    Write-Error "Token exchange failed: $($_.Exception.Message)"
    exit 1
}
$jwt = $resp.access_token
if (-not $jwt) {
    Write-Error "No access_token in response."
    exit 1
}
Write-Host "  got JWT (length $($jwt.Length), expires in $($resp.expires_in)s)" -ForegroundColor DarkGray

# Load existing config (or scaffold one)
if (Test-Path $ConfigPath) {
    $cfg = Get-Content $ConfigPath -Raw | ConvertFrom-Json -AsHashtable
} else {
    Write-Host "  config file doesn't exist yet, creating: $ConfigPath" -ForegroundColor DarkGray
    New-Item -ItemType Directory -Force -Path (Split-Path $ConfigPath) | Out-Null
    $cfg = @{}
}

if (-not $cfg.ContainsKey("mcpServers")) { $cfg.mcpServers = @{} }
$cfg.mcpServers.raku = @{
    type    = "http"
    url     = "https://raku-mcp.fly.dev/mcp/"
    headers = @{ Authorization = "Bearer $jwt" }
}

$json = $cfg | ConvertTo-Json -Depth 10
Set-Content -Path $ConfigPath -Value $json -Encoding UTF8
Write-Host "  patched $ConfigPath" -ForegroundColor Green
Write-Host ""
Write-Host "Restart Claude Desktop for the new JWT to take effect." -ForegroundColor Yellow
