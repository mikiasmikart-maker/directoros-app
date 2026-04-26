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

function Replace-Strict {
  param(
    [string]$FilePath,
    [string]$Old,
    [string]$New,
    [string]$Label
  )

  $content = Get-Content $FilePath -Raw

  if ($content -notmatch [regex]::Escape($Old)) {
    throw "Expected fragment not found in $FilePath for [$Label]: $Old"
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
}

$files = @{
  App             = Join-Path $RepoRoot "src\App.tsx"
  CenterWorkspace = Join-Path $RepoRoot "src\components\layout\CenterWorkspace.tsx"
  LeftSidebar     = Join-Path $RepoRoot "src\components\layout\LeftSidebar.tsx"
  RightInspector  = Join-Path $RepoRoot "src\components\layout\RightInspector.tsx"
}

foreach ($f in $files.Values) {
  Ensure-File $f
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupDir = Join-Path $RepoRoot ".backup\m10_ui_patch_$timestamp"

if (-not $WhatIfOnly) {
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  foreach ($f in $files.Values) {
    Backup-File $f $backupDir
  }
  Write-Info "Backups created at: $backupDir"
}

# --- Wrapper shell refinements ---
Replace-Strict -FilePath $files.App `
  -Old 'bg-slate-600' `
  -New 'bg-neutral-950' `
  -Label 'App background'

Replace-Strict -FilePath $files.CenterWorkspace `
  -Old 'bg-slate-700' `
  -New 'bg-neutral-900' `
  -Label 'Center surface'

Replace-Strict -FilePath $files.CenterWorkspace `
  -Old 'p-4' `
  -New 'p-5' `
  -Label 'Center shell padding'

Replace-Strict -FilePath $files.LeftSidebar `
  -Old 'bg-slate-700' `
  -New 'bg-neutral-950' `
  -Label 'Left surface'

Replace-Strict -FilePath $files.LeftSidebar `
  -Old 'p-4' `
  -New 'p-3' `
  -Label 'Left shell padding'

Replace-Strict -FilePath $files.RightInspector `
  -Old 'bg-slate-700' `
  -New 'bg-neutral-950' `
  -Label 'Right surface'

Replace-Strict -FilePath $files.RightInspector `
  -Old 'p-4' `
  -New 'p-3' `
  -Label 'Right shell padding'

# --- Internal rhythm refinements ---
Replace-Strict -FilePath $files.CenterWorkspace `
  -Old 'flex flex-col gap-4 space-y-6' `
  -New 'flex flex-col gap-6' `
  -Label 'Center internal rhythm'

Replace-Strict -FilePath $files.LeftSidebar `
  -Old 'flex flex-col gap-2 space-y-4' `
  -New 'flex flex-col gap-3' `
  -Label 'Left internal rhythm'

Replace-Strict -FilePath $files.RightInspector `
  -Old 'flex flex-col gap-2 space-y-4' `
  -New 'flex flex-col gap-3' `
  -Label 'Right internal rhythm'

if ($WhatIfOnly) {
  Write-Info "WhatIf completed. No files were changed."
} else {
  Write-Ok "M10 UI patch applied successfully."
  Write-Info "Review in app, then commit if it looks right."
}