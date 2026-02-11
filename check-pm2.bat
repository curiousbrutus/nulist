@echo off
REM Quick PM2 Status Check for NeoList
echo.
echo ====================================
echo   PM2 Process Status
echo ====================================
echo.
pm2 list
echo.
echo.
echo Expected processes:
echo   1. neolist (main app)
echo   2. zimbra-queue-worker (MUST BE RUNNING for sync)
echo   3. zimbra-incoming-sync (optional)
echo.
echo If zimbra-queue-worker is NOT running, this is why
echo tasks don't appear in Zimbra mail!
echo.
echo To fix, run: fix-zimbra-sync.bat
echo.
pause
