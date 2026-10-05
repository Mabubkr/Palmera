@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo حذف ملفات قديمة تم نقلها أو تقسيمها في التحديث الأخير...
if exist "frontend\js\app.js" del /q "frontend\js\app.js"
if exist "backend\tests\test_auth_security_lifecycle.js" del /q "backend\tests\test_auth_security_lifecycle.js"
if exist "backend\tests\test_crop_palm_nursery_fixes.js" del /q "backend\tests\test_crop_palm_nursery_fixes.js"
if exist "backend\tests\test_crop_sources_and_tree_form.js" del /q "backend\tests\test_crop_sources_and_tree_form.js"
if exist "backend\tests\test_direct_editing.js" del /q "backend\tests\test_direct_editing.js"
if exist "backend\tests\test_fert_fixes.js" del /q "backend\tests\test_fert_fixes.js"
if exist "backend\tests\test_frontend_integration.js" del /q "backend\tests\test_frontend_integration.js"
if exist "backend\tests\test_gis_plots_import.js" del /q "backend\tests\test_gis_plots_import.js"
if exist "backend\tests\test_multirole_contracts.js" del /q "backend\tests\test_multirole_contracts.js"
if exist "backend\tests\test_offline_hard_refresh.js" del /q "backend\tests\test_offline_hard_refresh.js"
if exist "backend\tests\test_offline_sync_approval.js" del /q "backend\tests\test_offline_sync_approval.js"
if exist "backend\tests\test_segments_and_ops.js" del /q "backend\tests\test_segments_and_ops.js"
if exist "backend\tests\test_smart_inbox_and_projects.js" del /q "backend\tests\test_smart_inbox_and_projects.js"
if exist "backend\tests\test_user_avatar_blood_ux.js" del /q "backend\tests\test_user_avatar_blood_ux.js"
if exist "backend\tests\test_users_polish_fixes.js" del /q "backend\tests\test_users_polish_fixes.js"
if exist "backend\tests\stress_test.js" del /q "backend\tests\stress_test.js"
echo تم. يمكنك حذف هذا الملف الآن.
pause
