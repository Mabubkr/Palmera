@echo off
chcp 65001 >nul
title PalmTrace - GitHub
cd /d "%~dp0"
echo ========================================================
echo    رفع النسخة الحالية على GitHub: Mabubkr/Palmera
echo ========================================================
where git >nul 2>&1
if errorlevel 1 (
  echo.
  echo  برنامج Git مش متثبت على الجهاز. هيتفتح موقع التحميل: ثبّته بالإعدادات الافتراضية ثم شغّل الملف ده تاني.
  start https://git-scm.com/download/win
  pause
  exit /b
)

set FIRST=0
if not exist .git (
  set FIRST=1
  git init -b main
  git remote add origin https://github.com/Mabubkr/Palmera.git
)

git config user.name >nul 2>&1 || git config user.name "Mabubkr"
git config user.email >nul 2>&1 || git config user.email "mohamedabubkr2020@gmail.com"

git rm -r --cached --quiet --ignore-unmatch .env backend/data node_modules >nul 2>&1
git add -A

rem Safety: never publish secrets or the database
git ls-files --cached | findstr /R /C:"^\.env$" /C:"\.db$" /C:"^node_modules/" /C:"\.pdf$" >nul
if not errorlevel 1 (
  echo.
  echo  توقف: فيه ملف سري أو قاعدة بيانات كان هيترفع. ماتمش رفع أي حاجة.
  git reset >nul
  pause
  exit /b
)

git commit -m "PalmTrace: تحديث %date% %time:~0,5%"
echo.
echo  جاري الرفع... لو ظهرت نافذة تسجيل دخول GitHub، سجّل دخولك واقبل.
rem First upload replaces the old GitHub history (it contained a .env file with a database password)
if "%FIRST%"=="1" (
  git push -u --force origin main
) else (
  git push -u origin main
)
if errorlevel 1 (
  echo.
  echo  الرفع ماتمش. ابعت صورة الشاشة دي.
) else (
  echo.
  echo  تم الرفع بنجاح: https://github.com/Mabubkr/Palmera
)
pause
