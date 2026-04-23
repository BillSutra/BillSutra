@echo off
setlocal

set "SERVICE_DIR=%~dp0"
set "PYTHON_EXE="

if exist "%SERVICE_DIR%.venv\Scripts\python.exe" (
  "%SERVICE_DIR%.venv\Scripts\python.exe" -c "import importlib.util;mods=('flask','numpy','cv2','face_recognition');raise SystemExit(0 if all(importlib.util.find_spec(m) for m in mods) else 1)" >nul 2>&1
  if not errorlevel 1 set "PYTHON_EXE=%SERVICE_DIR%.venv\Scripts\python.exe"
)

if not defined PYTHON_EXE if exist "%SERVICE_DIR%venv\Scripts\python.exe" (
  "%SERVICE_DIR%venv\Scripts\python.exe" -c "import importlib.util;mods=('flask','numpy','cv2','face_recognition');raise SystemExit(0 if all(importlib.util.find_spec(m) for m in mods) else 1)" >nul 2>&1
  if not errorlevel 1 set "PYTHON_EXE=%SERVICE_DIR%venv\Scripts\python.exe"
)

if not defined PYTHON_EXE (
  echo No usable local virtual environment was found. Expected .venv or venv in "%SERVICE_DIR%" with flask, numpy, cv2, and face_recognition installed.
  exit /b 1
)

echo Starting face recognition service with "%PYTHON_EXE%"
"%PYTHON_EXE%" "%SERVICE_DIR%app.py"
