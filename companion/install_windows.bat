@echo off
setlocal enabledelayedexpansion
title Leviathan - Setup

echo.
echo  ==============================================================
echo    LEVIATHAN  -  connecting this computer
echo  ==============================================================
echo.
echo  This gives Leviathan the ability to use this computer.
echo  It takes about a minute. You do not need to do anything
echo  technical - just leave this window open.
echo.

set "INSTALL_DIR=%LOCALAPPDATA%\Leviathan"
set "COMPANION=%INSTALL_DIR%\leviathan_companion.py"
set "RAW_URL=https://raw.githubusercontent.com/thenewera0/Laviathan/main/companion/leviathan_companion.py"

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1

REM ---------------------------------------------------------------- Python
echo  [1/4] Checking for Python...
set "PY="
where py >nul 2>&1 && set "PY=py"
if not defined PY ( where python >nul 2>&1 && set "PY=python" )

if not defined PY (
    echo        Python not found - installing it for you...
    where winget >nul 2>&1
    if errorlevel 1 (
        echo.
        echo  Could not install Python automatically.
        echo  Please install Python from https://python.org/downloads
        echo  ^(tick "Add Python to PATH"^), then run this file again.
        echo.
        pause
        exit /b 1
    )
    winget install -e --id Python.Python.3.12 --silent --accept-package-agreements --accept-source-agreements
    set "PY=py"
    echo        Python installed.
)
echo        Python is ready.

REM ------------------------------------------------------------ companion
echo  [2/4] Getting the latest Leviathan companion...
if exist "%~dp0leviathan_companion.py" (
    copy /Y "%~dp0leviathan_companion.py" "%COMPANION%" >nul
) else (
    powershell -NoProfile -Command ^
      "try{Invoke-WebRequest -Uri '%RAW_URL%' -OutFile '%COMPANION%' -UseBasicParsing}catch{exit 1}"
)
if not exist "%COMPANION%" (
    echo.
    echo  Could not download the companion. Check your internet and retry.
    pause
    exit /b 1
)
echo        Companion ready.

REM ---------------------------------------------------------- dependencies
echo  [3/4] Installing what it needs...
%PY% -m pip install --quiet --disable-pip-version-check --upgrade pip >nul 2>&1
%PY% -m pip install --quiet --disable-pip-version-check websockets psutil mss >nul 2>&1
echo        Done.

REM ------------------------------------------------------------- autostart
echo  [4/4] Making it start automatically...
set "STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "VBS=%INSTALL_DIR%\start_leviathan.vbs"

REM pythonw runs with no console window, so after setup it lives quietly
REM in the background and reconnects on its own after every reboot.
> "%VBS%" echo Set WshShell = CreateObject("WScript.Shell")
>> "%VBS%" echo WshShell.Run "pythonw """"%COMPANION%""""", 0, False

copy /Y "%VBS%" "%STARTUP%\Leviathan.vbs" >nul 2>&1
echo        It will now start by itself whenever you log in.

echo.
echo  ==============================================================
echo    SETUP COMPLETE
echo  ==============================================================
echo.
echo  A 6-digit PAIRING CODE will appear below in a moment.
echo.
echo  Say to Leviathan:  "pair with my computer, the code is ______"
echo.
echo  You only ever do this ONCE. After that this computer is
echo  remembered and reconnects on its own.
echo.
echo  ==============================================================
echo.

%PY% "%COMPANION%"

echo.
echo  Leviathan companion stopped. Close this window.
pause
