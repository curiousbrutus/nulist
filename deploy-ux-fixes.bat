@echo off
echo.
echo ============================================================
echo   NeoList - Quick Fixes Deployment
echo ============================================================
echo.
echo This script will help you deploy the critical UX fixes.
echo.
pause
echo.

echo [Step 1/4] Running Database Migration...
echo.
npx tsx scripts\db\migrate.ts
echo.
if errorlevel 1 (
    echo.
    echo ❌ Migration failed! Please check the error above.
    echo.
    pause
    exit /b 1
)
echo ✅ Migration completed
echo.
pause

echo [Step 2/4] Restarting Application...
echo.
pm2 restart neolist
echo.
if errorlevel 1 (
    echo.
    echo ⚠️  PM2 restart failed. Trying alternative...
    echo.
    pm2 restart all
)
echo ✅ Application restarted
echo.
pause

echo [Step 3/4] Checking Application Status...
echo.
pm2 list
echo.
pause

echo [Step 4/4] Viewing Recent Logs...
echo.
pm2 logs neolist --lines 20 --nostream
echo.
echo.
echo ============================================================
echo   Deployment Complete!
echo ============================================================
echo.
echo Next steps:
echo   1. Clear browser cache (Ctrl+F5)
echo   2. Test with secretary user
echo   3. Test with regular user
echo   4. Monitor logs: pm2 logs neolist
echo.
echo Documentation:
echo   - IMPLEMENTATION_SUMMARY.md (what changed)
echo   - CRITICAL_UX_FIXES.md (detailed guide)
echo   - UX_EXECUTIVE_SUMMARY.md (for management)
echo.
pause
