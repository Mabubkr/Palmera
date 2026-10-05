const fs = require('fs');
const js = fs.readFileSync('frontend/js/app.js', 'utf8');
const lines = js.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('save-os') || l.includes('open-os') || l.includes('new-os') || l.includes('nurseryView') || l.includes('add-sucker') || l.includes('add-offshoot') || l.includes('receive-os')) {
    if (l.includes('function') || l.includes('case') || l.includes('if (name') || l.includes('button')) {
      console.log(idx + 1, l.trim().slice(0, 100));
    }
  }
});

