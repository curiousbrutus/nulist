@echo off
echo.
echo ============================================================
echo   NeoList Zimbra Sync - Service Check and Start
echo ============================================================
echo.

echo [Step 1] Checking PM2 status...
echo.
pm2 list
echo.

echo.
echo ============================================================
echo   What would you like to do?
echo ============================================================
echo   1. Start ALL services (neolist + workers)
echo   2. Start ONLY zimbra-queue-worker
echo   3. View zimbra-queue-worker logs
echo   4. Run diagnostic test
echo   5. Exit
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" (
    echo.
    echo Starting ALL services...
    pm2 start ecosystem.config.js
    echo.
    echo Services started! Checking status...
    pm2 list
    pause
    goto end
)

if "%choice%"=="2" (
    echo.
    echo Starting zimbra-queue-worker...
    pm2 start ecosystem.config.js --only zimbra-queue-worker
    echo.
    echo Worker started! Checking status...
    pm2 list
    pause
    goto end
)

if "%choice%"=="3" (
    echo.
    echo Showing last 50 lines of worker logs...
    echo (Press Ctrl+C to exit logs)
    pm2 logs zimbra-queue-worker --lines 50
    goto end
)

if "%choice%"=="4" (
    echo.
    echo Running diagnostic test...
    npx tsx test-sync-issue.ts
    echo.
    pause
    goto end
)

:end
echo.
echo Done!
