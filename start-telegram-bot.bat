@echo off
echo.
echo ========================================
echo   NeoList Telegram Bot - Quick Start
echo ========================================
echo.
echo This script will help you start everything in order.
echo.
echo STEP 1: Starting Dev Server...
echo.
start "NeoList Dev Server" cmd /k "npm run dev"
timeout /t 5 /nobreak >nul
echo.
echo ✓ Dev server starting in new window
echo   Wait for "Ready" message before continuing...
echo.
pause
echo.
echo STEP 2: Starting ngrok...
echo.
echo Checking if ngrok is installed...
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo ❌ ngrok not found!
    echo.
    echo Please install ngrok:
    echo   1. Download from: https://ngrok.com/download
    echo   2. Extract to C:\Windows\System32 or add to PATH
    echo   3. Or use: winget install ngrok
    echo.
    pause
    exit /b 1
)
echo.
echo ✓ ngrok found
echo.
start "ngrok" cmd /k "ngrok http 3000"
timeout /t 3 /nobreak >nul
echo.
echo ✓ ngrok starting in new window
echo   Copy the https://...ngrok-free.app URL
echo.
pause
echo.
echo STEP 3: Register Webhook
echo.
set /p NGROK_URL="Paste your ngrok URL (https://...): "
if "%NGROK_URL%"=="" (
    echo ❌ No URL provided
    pause
    exit /b 1
)
echo.
echo Registering webhook...
node setup-telegram-webhook.js %NGROK_URL%
echo.
echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo 🤖 Bot: @clawdbot5449bot
echo 📱 Open Telegram and send: /start
echo.
echo Keep all windows open while testing!
echo.
pause
