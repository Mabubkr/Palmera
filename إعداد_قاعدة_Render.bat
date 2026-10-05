@echo off
chcp 65001 >nul
title PalmTrace - Render database
cd /d "%~dp0"
echo ========================================================
echo   حفظ رابط قاعدة بيانات Render في ملف الإعدادات (.env)
echo ========================================================
echo.
echo  من لوحة Render: افتح قاعدة البيانات ثم انسخ External Database URL
echo  والصقه هنا (زر الفأرة الأيمن = لصق) ثم اضغط Enter:
echo.
set /p RURL=URL: 
if "%RURL%"=="" (
  echo لم يتم إدخال رابط.
  pause
  exit /b
)
node scripts\set-env.js RENDER_PG_URL "%RURL%"
echo.
echo تم. يمكنك إغلاق هذه النافذة.
pause
