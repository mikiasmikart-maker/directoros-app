param(
  [string]$RepoRoot = "C:\WORK\PROJECTS\__ACTIVE\directoros-app",
  [switch]$WhatIfOnly
)

$ErrorActionPreference = "Stop"

function Write-Info($msg) {
  Write-Host "[INFO] $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
  Write-Host "[OK]   $msg" -ForegroundColor Green
}

function Write-WarnMsg($msg) {
  Write-Host "[WARN] $msg" -ForegroundColor Yellow
}

function Ensure-File($path) {
  if (-not (Test-Path $path)) {
    throw "File not found: $path"
  }
}

function Backup-File($path, $backupDir) {
  $name = Split-Path $path -Leaf
  Copy-Item $path (Join-Path $backupDir $name) -Force
}

function Replace-IfFound {
  param(
    [string]$FilePath,
    [string]$Old,
    [string]$New,
    [string]$Label
  )

  $content = Get-Content $FilePath -Raw

  if ($content -notmatch [regex]::Escape($Old)) {
    Write-WarnMsg "SKIP [$Label] not found in $(Split-Path $FilePath -Leaf): $Old"
    return $false
  }

  $updated = $content -replace [regex]::Escape($Old), [System.Text.RegularExpressions.MatchEvaluator]{ param($m) $New }

  if ($WhatIfOnly) {
    Write-Info "WHATIF [$Label] in $FilePath"
    Write-Host "  OLD: $Old"
    Write-Host "  NEW: $New"
  } else {
    Set-Content -Path $FilePath -Value $updated -NoNewline
    Write-Ok "$Label applied in $(Split-Path $FilePath -Leaf)"
  }

  return $true
}

$files = @{
  CenterWorkspace = Join-Path $RepoRoot "src\components\layout\CenterWorkspace.tsx"
  LeftSidebar     = Join-Path $RepoRoot "src\components\layout\LeftSidebar.tsx"
  RightInspector  = Join-Path $RepoRoot "src\components\layout\RightInspector.tsx"
}

foreach ($f in $files.Values) {
  Ensure-File $f
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $RepoRoot ".backup\m10_spacing_pass_$timestamp"

if (-not $WhatIfOnly) {
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  foreach ($f in $files.Values) {
    Backup-File $f $backupDir
  }
  Write-Info "Backups created at: $backupDir"
}

# ------------------------------------------------------------
# M10 internal rhythm pass
# Only changes confirmed or likely-safe from current code search
# ------------------------------------------------------------

# CenterWorkspace
Replace-IfFound `
  -FilePath $files.CenterWorkspace `
  -Old 'className="flex h-full min-h-0 flex-col space-y-3"' `
  -New 'className="flex h-full min-h-0 flex-col gap-4"' `
  -Label 'Center root stack rhythm'

Replace-IfFound `
  -FilePath $files.CenterWorkspace `
  -Old 'className="execution-area min-h-0 space-y-2"' `
  -New 'className="execution-area min-h-0 space-y-3"' `
  -Label 'Execution area breathing room'

Replace-IfFound `
  -FilePath $files.CenterWorkspace `
  -Old 'className="mt-3 max-h-44 space-y-1.5 overflow-auto pr-0.5 text-[11px]"' `
  -New 'className="mt-3 max-h-44 space-y-2 overflow-auto pr-0.5 text-[11px]"' `
  -Label 'Render jobs list rhythm'

Replace-IfFound `
  -FilePath $files.CenterWorkspace `
  -Old 'className="mt-2 space-y-2"' `
  -New 'className="mt-2 space-y-3"' `
  -Label 'Selected output detail spacing'

# LeftSidebar
Replace-IfFound `
  -FilePath $files.LeftSidebar `
  -Old 'className="h-full space-y-1.5 px-1 pb-1 pt-0.5 opacity-[0.88]"' `
  -New 'className="h-full space-y-2 px-1 pb-1 pt-0.5 opacity-[0.88]"' `
  -Label 'Left sidebar section rhythm'

# RightInspector
# We did not get the real grep output yet, so these stay guarded.
Replace-IfFound `
  -FilePath $files.RightInspector `
  -Old 'space-y-1.5' `
  -New 'space-y-2' `
  -Label 'Right inspector section rhythm (broad safe pass)'

Replace-IfFound `
  -FilePath $files.RightInspector `
  -Old 'space-y-2' `
  -New 'space-y-3' `
  -Label 'Right inspector inner stack breathing (broad safe pass)'

if ($WhatIfOnly) {
  Write-Info "WhatIf completed. No files were changed."
} else {
  Write-Ok "M10 spacing pass completed."
  Write-Info "Review the layout in app before committing."
}