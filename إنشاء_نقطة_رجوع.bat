@echo off
chcp 65001 >nul
title PalmTrace - نقطة رجوع
cd /d "%~dp0"
echo ========================================================
echo    إنشاء نقطة رجوع للنسخة الحالية من PalmTrace
echo ========================================================

echo.
echo  [1/2] نسخة كاملة على الجهاز (الكود + قاعدة البيانات + الإعدادات)...
node scripts\checkpoint.js
if errorlevel 1 (
  echo.
  echo  النسخ ماتمش. صوّر الشاشة دي وابعتها.
  pause
  exit /b
)
echo  تحذير: النسخة دي فيها مفاتيحك السرية وقاعدة البيانات - ماتبعتهاش لحد.

for /f %%v in ('powershell -NoProfile -Command "(Select-String -Path frontend\sw.js -Pattern 'palmtrace-v(\d+)').Matches[0].Groups[1].Value"') do set VER=%%v

echo.
echo  [2/2] علامة رجوع على GitHub (الكود فقط - من غير أسرار ولا قاعدة بيانات)...
where git >nul 2>&1
if errorlevel 1 goto nogit
if not exist .git goto nogit
git rm -r --cached --quiet --ignore-unmatch .env backend/data node_modules >nul 2>&1
git add -A
git ls-files --cached | findstr /R /C:"^\.env$" /C:"\.db$" /C:"^node_modules/" >nul
if not errorlevel 1 (
  echo  توقف: فيه ملف سري كان هيترفع. النسخة اللي على الجهاز اتعملت، بس GitHub لأ.
  git reset >nul
  pause
  exit /b
)
git commit -q -m "checkpoint v%VER%" >nul 2>&1
git branch -f stable-v%VER%
git tag -f checkpoint-v%VER%
git push origin main stable-v%VER%
git push -f origin checkpoint-v%VER%
if errorlevel 1 (
  echo  الرفع على GitHub ماتمش - النسخة اللي على الجهاز موجودة وسليمة. ابعت صورة الشاشة.
) else (
  echo  تم: فرع stable-v%VER% وعلامة checkpoint-v%VER% على GitHub
)
goto done

:nogit
echo  GitHub مش متجهز في الفولدر ده - النسخة اللي على الجهاز اتعملت.

:done
echo.
echo ========================================================
echo  للرجوع: انسخ فولدر نقطة الرجوع لأي مكان وشغّل منه "تشغيل_النظام.bat".
echo ========================================================
pause
