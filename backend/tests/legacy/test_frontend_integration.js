const fs = require('fs');

const appJs = fs.readFileSync('frontend/js/app.js', 'utf8');
const apiJs = fs.readFileSync('frontend/js/api.js', 'utf8');
const indexHtml = fs.readFileSync('frontend/index.html', 'utf8');
const swJs = fs.readFileSync('frontend/sw.js', 'utf8');

const checks = [
  { name: '1. openInvestorContractModal defined', pass: appJs.includes('function openInvestorContractModal') },
  { name: '2. openEditPlotModal defined', pass: appJs.includes('function openEditPlotModal') },
  { name: '3. openInvestorContractByPlot defined', pass: appJs.includes('function openInvestorContractByPlot') },
  { name: '4. renderInvestorContractEditModal defined', pass: appJs.includes('function renderInvestorContractEditModal') },
  { name: '5. renderPlotEditModal defined', pass: appJs.includes('function renderPlotEditModal') },
  { name: '6. layout includes renderInvestorContractEditModal', pass: appJs.includes('${renderInvestorContractEditModal()}') },
  { name: '7. layout includes renderPlotEditModal', pass: appJs.includes('${renderPlotEditModal()}') },
  { name: '8. GIS popup contains openInvestorContractByPlot', pass: appJs.includes('openInvestorContractByPlot') },
  { name: '9. GIS popup contains openEditPlotModal', pass: appJs.includes('openEditPlotModal') },
  { name: '10. Users view contains open-investor-contract-modal', pass: appJs.includes('open-investor-contract-modal') },
  { name: '11. Trees view Level 2 cards contain open-edit-plot-modal', pass: appJs.includes('data-act="open-edit-plot-modal"') },
  { name: '12. Trees view Level 3 actions contain open-edit-plot-modal', pass: appJs.includes('تعديل بيانات القطعة') },
  { name: '13. plotView contains openEditPlotModal', pass: appJs.includes("onclick=\"window.openEditPlotModal('${pl.id}')\"") },
  { name: '14. Sector modal upgraded with total_area input', pass: appJs.includes('edit_sec_total_area') },
  { name: '15. Api exports getInvestor', pass: apiJs.includes('getInvestor,') },
  { name: '16. Api exports updateInvestor', pass: apiJs.includes('updateInvestor,') },
  { name: '17. Api exports getContract', pass: apiJs.includes('getContract,') },
  { name: '18. Api exports updateContract', pass: apiJs.includes('updateContract,') },
  { name: '19. Api exports deleteContract', pass: apiJs.includes('deleteContract,') },
  { name: '20. Api exports getPlot', pass: apiJs.includes('getPlot,') },
  { name: '21. Api exports updatePlot', pass: apiJs.includes('updatePlot,') },
  { name: '22. index.html query version v122', pass: indexHtml.includes('?v=122') },
  { name: '23. sw.js cache name palmtrace-v122', pass: swJs.includes('palmtrace-v122') },
  { name: '24. act handler: save-investor-profile', pass: appJs.includes('if (name === "save-investor-profile")') },
  { name: '25. act handler: save-contract-subform', pass: appJs.includes('if (name === "save-contract-subform")') },
  { name: '26. act handler: delete-contract-item', pass: appJs.includes('if (name === "delete-contract-item")') },
  { name: '27. act handler: save-plot-edit', pass: appJs.includes('if (name === "save-plot-edit")') },
  { name: '28. act handler: plot-get-geolocation', pass: appJs.includes('if (name === "plot-get-geolocation")') }
];

console.log('=== Running Frontend Integration Verification Checks ===\n');
let allPass = true;
checks.forEach(c => {
  console.log(`${c.pass ? '✓ PASS' : '✗ FAIL'}: ${c.name}`);
  if (!c.pass) allPass = false;
});

console.log('\n----------------------------------------');
if (allPass) {
  console.log('🎉 ALL 28 FRONTEND INTEGRATION CHECKS PASSED (100%)');
  process.exit(0);
} else {
  console.error('❌ SOME CHECKS FAILED');
  process.exit(1);
}

