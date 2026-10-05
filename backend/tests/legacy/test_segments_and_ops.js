const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, '..', '..', '..', 'frontend', 'js', 'app.js');
const appCssPath = path.join(__dirname, '..', '..', '..', 'frontend', 'css', 'app.css');
const indexHtmlPath = path.join(__dirname, '..', '..', '..', 'frontend', 'index.html');
const swJsPath = path.join(__dirname, '..', '..', '..', 'frontend', 'sw.js');

const appJs = fs.readFileSync(appJsPath, 'utf8');
const appCss = fs.readFileSync(appCssPath, 'utf8');
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');
const swJs = fs.readFileSync(swJsPath, 'utf8');

console.log('--- 1. Testing opsFiltered return true ---');
const hasReturnTrueInOpsFiltered = appJs.includes('return true;\n  }).sort(') || appJs.includes('return true;\r\n  }).sort(');
console.log('opsFiltered has return true:', hasReturnTrueInOpsFiltered);
if (!hasReturnTrueInOpsFiltered) throw new Error('opsFiltered missing return true');

console.log('--- 2. Testing userSegmentTab and handlers ---');
const hasUserSegmentTab = appJs.includes('userSegmentTab = (function()');
const hasUserSegmentHandler = appJs.includes('if (name === "user-segment")');
const hasUserSegmentCards = appJs.includes('class="user-segment-cards"');
const hasUserSegmentTabs = appJs.includes('class="user-segment-tabs"');
const hasInvestorCol = appJs.includes('userSegmentTab === "investor"');
const hasFieldCol = appJs.includes('userSegmentTab === "field"');
const hasOfficeCol = appJs.includes('userSegmentTab === "office"');

console.log('userSegmentTab declared:', hasUserSegmentTab);
console.log('user-segment handler present:', hasUserSegmentHandler);
console.log('user-segment cards present:', hasUserSegmentCards);
console.log('user-segment tabs present:', hasUserSegmentTabs);
console.log('Contextual columns (investor, field, office):', hasInvestorCol && hasFieldCol && hasOfficeCol);

if (!hasUserSegmentTab || !hasUserSegmentHandler || !hasUserSegmentCards || !hasInvestorCol) {
  throw new Error('User segment functionality missing');
}

console.log('--- 3. Testing CSS ---');
const hasDenseSeparate = appCss.includes('border-collapse: separate !important;');
const hasOverflowVisible = appCss.includes('overflow: visible !important;');
const hasCardsCss = appCss.includes('.user-segment-cards');
const hasTabsCss = appCss.includes('.user-segment-tabs');
const hasMaxContent = appCss.includes('width: max-content;');
console.log('dense separate border-collapse:', hasDenseSeparate);
console.log('sticky-act overflow visible:', hasOverflowVisible);
console.log('cards CSS present:', hasCardsCss);
console.log('tabs CSS present:', hasTabsCss);
console.log('dropdown max-content width:', hasMaxContent);

if (!hasDenseSeparate || !hasOverflowVisible || !hasCardsCss || !hasTabsCss || !hasMaxContent) {
  throw new Error('CSS styling missing');
}

console.log('--- 4. Testing Versions ---');
const hasV100Html = indexHtml.includes('?v=100');
const hasV100Sw = swJs.includes('palmtrace-v100');
console.log('index.html v100:', hasV100Html);
console.log('sw.js v100:', hasV100Sw);

if (!hasV100Html || !hasV100Sw) {
  throw new Error('Versions not updated to v100');
}

console.log('\n=========================================');
console.log('✅ ALL VERIFICATION CHECKS PASSED 100%!');
console.log('=========================================');

