$ErrorActionPreference = "Stop"

$serviceDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$venvCandidates = @(
  (Join-Path $serviceDir "venv\Scripts\python.exe"),
  (Join-Path $serviceDir ".venv\Scripts\python.exe")
)

$requiredImports = @("flask", "numpy", "cv2", "face_recognition")
$pythonExe = $null

foreach ($candidate in $venvCandidates) {
  if (-not (Test-Path $candidate)) {
    continue
  }

  $importCheck = @"
import importlib.util
modules = $($requiredImports | ConvertTo-Json -Compress)
missing = [name for name in modules if importlib.util.find_spec(name) is None]
raise SystemExit(0 if not missing else 1)
"@

  try {
    & $candidate -c $importCheck 1>$null 2>$null
  } catch {
    continue
  }

  if ($LASTEXITCODE -eq 0) {
    $pythonExe = $candidate
    break
  }
}

if (-not $pythonExe) {
  Write-Error "No usable local virtual environment was found. Expected '.venv' or 'venv' in $serviceDir with flask, numpy, cv2, and face_recognition installed."
}

$appPath = Join-Path $serviceDir "app.py"

if (-not (Test-Path $appPath)) {
  Write-Error "Could not find app.py in $serviceDir."
}

Write-Host "Starting face recognition service with $pythonExe"
& $pythonExe $appPath
