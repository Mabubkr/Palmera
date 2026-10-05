@echo off
chcp 65001 >nul
title PalmTrace
echo ========================================================
echo    جاري تشغيل خادم نظام إدارة النخيل (PalmTrace)...
echo    لإيقاف الخادم: أغلق هذه النافذة
echo ========================================================
cd /d "%~dp0"
if not exist .env copy .env.example .env >nul
if not exist node_modules\nodemailer (
  echo تثبيت/تحديث المكتبات...
  call npm install
)
node scripts\check-port.js
if errorlevel 1 (
  pause
  exit /b
)
start "" /b node scripts\open-when-ready.js
echo    المتصفح هيفتح لوحده أول ما الخادم يجهز...
node backend\server.js
pause
