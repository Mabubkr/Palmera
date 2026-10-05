// PalmTrace app — UI action handlers, part 7 of 9 (starts at: name === "print-rep")
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

async function actionsPart07(name, id, el, st) {
  if (name === "print-rep") {
    const me = session();
    if (!isReportPermitted(me, reportKind)) {
      return toast("عفواً، لا تملك صلاحية لطباعة هذا التقرير 🔒");
    }
    const co = company();
    const rows = reportRows();
    const selUser = reportUser ? (st.users || []).find(u => u.id === reportUser) : null;
    const kindLabels = {
      ops: "العمليات والخدمات الحقلية",
      fertilizers: "حركة الأسمدة والمخزون والاستهلاك",
      fert_balances: "أرصدة وجرد المستودع للمبيدات والأسمدة",
      offshoot_rev: "إيرادات وتوريد الفسائل (مالية / مستثمر)",
      offshoots: "سجل الفسائل والمشتل",
      yields: "المحصول والإنتاج الزراعي",
      incidents: "الحالات العارضة والبلاغات",
      status: "حالات وسلامة الأشجار",
      sectors: "القطاعات والقطع والأصول"
    };
    const reportTitle = kindLabels[reportKind] || "تقرير رسمي عام";

    let kpisHtml = "";
    if (reportKind === "fert_balances") {
      const totStock = rows.reduce((a,r) => a + (r.stock || 0), 0);
      const totAlloc = rows.reduce((a,r) => a + (r.allocated || 0), 0);
      const totCons = rows.reduce((a,r) => a + (r.consumed || 0), 0);
      const totVal = rows.reduce((a,r) => a + (r.value || 0), 0);
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">عدد الأصناف</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${totStock.toLocaleString()}</b><div style="font-size:11px;color:#64748b">رصيد المستودع</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#D97706">${totAlloc.toLocaleString()}</b><div style="font-size:11px;color:#64748b">عهدة الموقع</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#2563EB">${totCons.toLocaleString()}</b><div style="font-size:11px;color:#64748b">المستهلك بالحقل</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#7C3AED">${Math.round(totVal).toLocaleString()}</b><div style="font-size:11px;color:#64748b">القيمة التقديرية</div></div>
        </div>
      `;
    } else if (reportKind === "fertilizers") {
      const totSupplied = rows.filter(r => r.actionType === "توريد").reduce((a,r) => a + (r.qty || 0), 0);
      const totIssued = rows.filter(r => r.actionType === "صرف عهدة").reduce((a,r) => a + (r.qty || 0), 0);
      const totConsumed = rows.filter(r => r.actionType === "استهلاك").reduce((a,r) => a + (r.qty || 0), 0);
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">إجمالي الحركات</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${totSupplied.toLocaleString()}</b><div style="font-size:11px;color:#64748b">المورّد للمستودع</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#D97706">${totIssued.toLocaleString()}</b><div style="font-size:11px;color:#64748b">المنصرف عهدة</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#2563EB">${totConsumed.toLocaleString()}</b><div style="font-size:11px;color:#64748b">المستهلك بالحقل</div></div>
        </div>
      `;
      if (selUser) {
        const uRec = rows.filter(r => r.whoId === reportUser && r.actionType === "صرف عهدة" && (r.statusKey === "received" || r.st.includes("مستلم"))).reduce((a,r) => a + (r.qty || 0), 0);
        const uPend = rows.filter(r => r.whoId === reportUser && r.actionType === "صرف عهدة" && (r.statusKey === "pending" || r.st.includes("معلق"))).reduce((a,r) => a + (r.qty || 0), 0);
        const uCons = rows.filter(r => r.whoId === reportUser && r.actionType === "استهلاك").reduce((a,r) => a + (r.qty || 0), 0);
        kpisHtml += `
          <div style="background:#F0F9FF;border:1px solid #0284C7;border-radius:6px;padding:10px;margin-bottom:14px">
            <b>👤 ملخص عهدة المسؤول المحدّد: ${selUser.name} (${roleLabel(selUser.role)})</b>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:6px">
              <div>المستلم فعلياً: <b>${uRec.toLocaleString()}</b></div>
              <div>المعلق بالانتظار: <b>${uPend.toLocaleString()}</b></div>
              <div>المستهلك بالحقل: <b>${uCons.toLocaleString()}</b></div>
              <div>الرصيد المتبقي بعهدته: <b>${Math.max(0, uRec - uCons).toLocaleString()}</b></div>
            </div>
          </div>
        `;
      }
    } else if (reportKind === "offshoot_rev") {
      const totR = rows.reduce((a,r) => a + (r.price || 0), 0);
      const invR = rows.filter(r => r.investorId).reduce((a,r) => a + (r.price || 0), 0);
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">إجمالي الفسائل المقلوعة</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${money(totR)}</b><div style="font-size:11px;color:#64748b">الإيراد التقديري (${st.settings?.currency||"ج.م"})</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#C85A2E">${money(invR)}</b><div style="font-size:11px;color:#64748b">نصيب المستثمرين (${st.settings?.currency||"ج.م"})</div></div>
        </div>
      `;
    } else if (reportKind === "offshoots") {
      const readyN = rows.filter(r => r.stageKey === "ready").length;
      const prepN = rows.filter(r => r.stageKey === "prep").length;
      const issuedN = rows.filter(r => r.stageKey === "issued").length;
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">إجمالي الفسائل بالسجل</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${readyN}</b><div style="font-size:11px;color:#64748b">جاهزة للزراعة</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#D97706">${prepN}</b><div style="font-size:11px;color:#64748b">تحت التجهيز</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#2563EB">${issuedN}</b><div style="font-size:11px;color:#64748b">صُرفت / زُرعت</div></div>
        </div>
      `;
    } else if (reportKind === "yields") {
      const totKg = rows.reduce((a,r) => a + (r.kg || 0), 0);
      const premKg = rows.filter(r => (r.quality || "").includes("ممتاز")).reduce((a,r) => a + (r.kg || 0), 0);
      const vMap = {};
      rows.forEach(r => {
        const v = r.variety || "عام / غير محدد";
        if (!vMap[v]) vMap[v] = { name: v, crop: r.crop, kg: 0, count: 0 };
        vMap[v].kg += (r.kg || 0);
        vMap[v].count += 1;
      });
      const vList = Object.values(vMap).sort((a, b) => b.kg - a.kg);
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${totKg.toLocaleString()} كجم</b><div style="font-size:11px;color:#64748b">إجمالي المحصول (${(totKg/1000).toFixed(2)} طن)</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">عدد دفعات الحصاد</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#D97706">${premKg.toLocaleString()} كجم</b><div style="font-size:11px;color:#64748b">إنتاج الجودة الممتازة</div></div>
        </div>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:8px 12px;margin-bottom:14px">
          <b style="color:#166534;font-size:11.5px">🌾 كشف إنتاجية الأصناف:</b>
          <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
            ${vList.map(v => `<span style="background:#fff;padding:3px 8px;border-radius:4px;border:1px solid #86efac;font-size:11px"><b>${v.name}</b> (${v.crop}): <b>${v.kg.toLocaleString()} كجم</b> (${totKg ? Math.round(v.kg/totKg*100) : 0}%)</span>`).join("")}
          </div>
        </div>
      `;
    } else if (reportKind === "incidents") {
      const weevils = rows.filter(r => r.isWeevil).length;
      const solved = rows.filter(r => r.approvalKey === "approved").length;
      const waiting = rows.filter(r => r.approvalKey === "pending").length;
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">إجمالي البلاغات</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#DC2626">${weevils}</b><div style="font-size:11px;color:#64748b">إصابات سوسة النخيل</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${solved}</b><div style="font-size:11px;color:#64748b">معتمدة / معالجة</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#D97706">${waiting}</b><div style="font-size:11px;color:#64748b">بانتظار المعالجة</div></div>
        </div>
      `;
    } else if (reportKind === "status") {
      const healthy = rows.filter(r => (r.st || "").includes("سليمة")).length;
      const sick = rows.filter(r => (r.st || "").includes("مصابة") || (r.st || "").includes("علاج")).length;
      const dead = rows.filter(r => (r.st || "").includes("ميتة")).length;
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">إجمالي الأشجار والأصول</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${healthy}</b><div style="font-size:11px;color:#64748b">سليمة</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#D97706">${sick}</b><div style="font-size:11px;color:#64748b">تحت العلاج</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#DC2626">${dead}</b><div style="font-size:11px;color:#64748b">تالفة / ميتة</div></div>
        </div>
      `;
    } else if (reportKind === "sectors") {
      const totP = rows.reduce((a,r) => a + (r.palmCount || 0), 0);
      const totA = rows.reduce((a,r) => a + (r.totalAssets || 0), 0);
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">عدد القطع</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${totP.toLocaleString()}</b><div style="font-size:11px;color:#64748b">أشجار النخيل</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#2563EB">${totA.toLocaleString()}</b><div style="font-size:11px;color:#64748b">إجمالي الأصول</div></div>
        </div>
      `;
    } else {
      const app = rows.filter(r => r.st === "معتمدة" || r.raw?.approval === "approved").length;
      const pen = rows.filter(r => r.st === "معلقة" || r.raw?.approval === "pending").length;
      kpisHtml = `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b>${rows.length}</b><div style="font-size:11px;color:#64748b">إجمالي العمليات</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#16A34A">${app}</b><div style="font-size:11px;color:#64748b">معتمدة</div></div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;padding:8px;text-align:center;border-radius:6px"><b style="color:#D97706">${pen}</b><div style="font-size:11px;color:#64748b">معلقة</div></div>
        </div>
      `;
    }

    let tableHtml = "";
    if (reportKind === "fert_balances") {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th><th>كود الصنف</th><th>اسم المركب</th><th>المحصول</th><th>التصنيف</th><th>الوحدة</th><th>المستودع</th><th>العهدة</th><th>المستهلك</th><th>الإجمالي</th><th>حد الأمان</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r,i) => `<tr>
              <td style="text-align:center">${i+1}</td>
              <td style="font-family:monospace">${r.code}</td>
              <td><b>${r.name}</b></td>
              <td>${r.crop}</td>
              <td>${r.kind}</td>
              <td>${r.unit}</td>
              <td style="font-weight:bold;color:${r.isLow?'#DC2626':'#16A34A'}">${(r.stock||0).toLocaleString()}</td>
              <td style="color:#D97706">${(r.allocated||0).toLocaleString()}</td>
              <td style="color:#2563EB">${(r.consumed||0).toLocaleString()}</td>
              <td><b>${(r.grandTotal||0).toLocaleString()}</b></td>
              <td>${(r.minAlert||0).toLocaleString()}</td>
              <td>${r.st}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot>
            <tr style="background:#eee;font-weight:bold">
              <td colspan="6" style="text-align:center">الإجمالي (${rows.length} صنف)</td>
              <td>${rows.reduce((a,r)=>a+(r.stock||0),0).toLocaleString()}</td>
              <td>${rows.reduce((a,r)=>a+(r.allocated||0),0).toLocaleString()}</td>
              <td>${rows.reduce((a,r)=>a+(r.consumed||0),0).toLocaleString()}</td>
              <td>${rows.reduce((a,r)=>a+(r.grandTotal||0),0).toLocaleString()}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
      `;
    } else if (reportKind === "fertilizers") {
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th>#</th><th>رقم الحركة</th><th>التاريخ</th><th>النوع</th><th>المركب / السماد</th><th>الكمية</th><th>الوحدة</th><th>الموقع</th><th>المسؤول</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((r,i) => `<tr>
              <td style="text-align:center">${i+1}</td>
              <td style="font-family:monospace">${r.code}</td>
              <td>${r.date}</td>
              <td>${r.actionType || r.type}</td>
              <td><b>${r.material || r.type}</b></td>
              <td style="font-weight:bold">${(r.qty||0).toLocaleString()}</td>
              <td>${r.unit}</td>
              <td>${r.loc}</td>
              <td>${r.who}</td>
              <td>${r.st}</td>
            </tr>`).join("")}
          </tbody>
          <tfoot>
            <tr style="background:#eee;font-weight:bold">
              <td colspan="5" style="text-align:center">إجمالي الكميات (${rows.length} حركة)</td>
              <td colspan="5">${rows.reduce((a,r)=>a+(r.qty||0),0).toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else {
      tableHtml = $("#reptable")?.outerHTML || "";
    }

    const printDoc = `<!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8">
      <title>${reportTitle} - ${co.companyName || "منظومة النخيل"}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; margin: 0; padding: 12px; color: #1e293b; direction: rtl; font-size: 12px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2d6a4f; padding-bottom: 12px; margin-bottom: 14px; }
        .brand { display: flex; align-items: center; gap: 14px; }
        .brand img { max-height: 55px; }
        .brand h2 { margin: 0; color: #1b4332; font-size: 20px; }
        .brand p { margin: 2px 0 0; color: #52796f; font-size: 12px; }
        .meta { font-size: 11px; color: #64748b; line-height: 1.6; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
        th { background: #2d6a4f; color: #fff; padding: 6px 5px; text-align: right; border: 1px solid #2d6a4f; }
        td { border: 1px solid #cbd5e1; padding: 5px; text-align: right; }
        tr:nth-child(even) { background: #f8fafc; }
        .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-top: 30px; text-align: center; page-break-inside: avoid; }
        .sig-box { border-top: 1px dashed #94a3b8; padding-top: 8px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand">
          ${co.logo ? `<img src="${co.logo}">` : `<div style="font-size:32px">🌴</div>`}
          <div>
            <h2>${co.companyName || "منظومة إدارة النخيل والمزارع"}</h2>
            <p>${reportTitle}</p>
          </div>
        </div>
        <div class="meta">
          <div><b>تاريخ التقرير:</b> ${new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' })}</div>
          <div><b>الفترة:</b> من ${reportFrom || "البداية"} إلى ${reportTo || "الآن"}</div>
          ${selUser ? `<div><b>المسؤول المستهدف:</b> ${selUser.name} (${roleLabel(selUser.role)})</div>` : ''}
          ${reportSec ? `<div><b>القطاع:</b> ${sectorName(reportSec)}</div>` : ''}
        </div>
      </div>

      ${kpisHtml}
      ${tableHtml}

      <div class="signatures">
        <div class="sig-box">
          <b>إعداد / المسؤول المباشر</b><br><br>
          التوقيع: ............................
        </div>
        <div class="sig-box">
          <b>أمين المستودع / المهندس الزراعي</b><br><br>
          التوقيع: ............................
        </div>
        <div class="sig-box">
          <b>اعتماد الإدارة الزراعية والمالية</b><br><br>
          الختم والاعتماد: ............................
        </div>
      </div>
    </body>
    </html>`;

    const w = window.open("", "_blank");
    w.document.write(printDoc);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 250);
    return;
  }
  if (name === "pick-crop-icon") {
    const targetInputId = el?.dataset?.target;
    const previewId = el?.dataset?.preview;
    const icon = el?.dataset?.icon;
    if (targetInputId && icon) {
      const inp = document.getElementById(targetInputId);
      if (inp) {
        inp.value = icon;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
      }
      const prev = document.getElementById(previewId);
      if (prev) prev.innerHTML = cropIcon(icon, 24);
    }
    return;
  }
  if (name === "trigger-logo-upload") {
    $("#clogo")?.click();
    return;
  }
  if (name === "remove-logo") {
    st.settings.logo = "";
    Store.set({ settings: st.settings });
    toast("تمت إزالة شعار الشركة بنجاح");
    render();
    return;
  }
  if (name === "confirm-reset-data") {
    if (confirm("⚠️ تحذير شديد الأهمية:\nهل أنت متأكد تماماً من رغبتك في مسح كافة البيانات المحلية واستعادة البيانات التجريبية الافتراضية؟\nلا يمكن التراجع عن هذا الإجراء.")) {
      act("reset");
    }
    return;
  }
  if (name === "save-company" || name === "save-all-farm-settings") {
    const targetCompId = id || st.activeCompanyId || (st.companies && st.companies[0]?.id) || "comp_bashayer";
    const comp = (st.companies || []).find(c => c.id === targetCompId);
    const file = $("#clogo")?.files?.[0];

    const apply = async (logo) => {
      const legalName = $("#coname")?.value || "";
      const tradeName = $("#cotradename")?.value || legalName;
      const cr = $("#c_cr")?.value || "";
      const tax = $("#c_tax")?.value || "";
      const email = $("#c_email")?.value || "";
      const phone = $("#c_phone")?.value || "";
      const currCode = $("#ccode")?.value || "EGP";
      const currName = $("#ccurname")?.value || "جنيه مصري";

      // 1. Update active company in st.companies
      if (comp) {
        comp.name = legalName;
        comp.tradeName = tradeName;
        comp.trade_name = tradeName;
        comp.commercialRegistry = cr;
        comp.commercial_registry = cr;
        comp.taxNumber = tax;
        comp.tax_number = tax;
        comp.email = email;
        comp.phone = phone;
        comp.currencyCode = currCode;
        comp.currency_code = currCode;
        if (logo !== undefined) comp.logo = logo;
      }

      // 2. Settings backward compatibility
      st.settings.companyName = legalName;
      st.settings.commercialRegister = cr;
      st.settings.taxId = tax;
      st.settings.officialEmail = email;
      st.settings.officialPhone = phone;
      st.settings.currency = currCode;
      st.settings.currencyName = currName;
      if (logo !== undefined) st.settings.logo = logo;
      if ($("#c_trace_whatsapp")) st.settings.traceWhatsapp = $("#c_trace_whatsapp").value.trim();
      if ($("#c_trace_msg")) st.settings.traceOrderMsg = $("#c_trace_msg").value.trim();

      // 3. Also update farm project settings if fields are present
      if ($("#proj_name_input")) {
        const targetProjId = st.activeProjectId || (st.projects && st.projects[0]?.id) || "proj_farafra_01";
        const proj = (st.projects || []).find(p => p.id === targetProjId);
        const pName = $("#proj_name_input")?.value || legalName;
        const pPrefix = ($("#proj_prefix_input")?.value || "BSH1").toUpperCase();
        const pArea = parseFloat($("#proj_area_input")?.value) || 0;
        const pLoc = $("#proj_loc_input")?.value || "";
        const pTz = $("#proj_tz_input")?.value || "Africa/Cairo";
        const pGps = $("#proj_gps_input")?.value || "";
        const pLandUnit = $("#c_land_unit")?.value || "فدان";
        const pWeightUnit = $("#c_weight_unit")?.value || "كجم";

        if (proj) {
          proj.name = pName;
          proj.codePrefix = pPrefix;
          proj.code_prefix = pPrefix;
          proj.areaFeddan = pArea;
          proj.area_feddan = pArea;
          proj.locationName = pLoc;
          proj.location_name = pLoc;
          proj.timezone = pTz;
        }

        st.settings.landUnit = pLandUnit;
        st.settings.weightUnit = pWeightUnit;
        st.settings.defaultGps = pGps;
        st.settings.timezone = pTz;

        if (typeof Api !== "undefined" && typeof Api.updateProject === "function") {
          await Api.updateProject(targetProjId, {
            name: pName,
            codePrefix: pPrefix,
            areaFeddan: pArea,
            locationName: pLoc,
            timezone: pTz
          });
        }
      }

      Store.set({ companies: st.companies, projects: st.projects, settings: st.settings });

      // 4. Persist to backend
      if (typeof Api !== "undefined" && typeof Api.updateCompany === "function") {
        await Api.updateCompany(targetCompId, {
          name: legalName,
          tradeName,
          taxNumber: tax,
          commercialRegistry: cr,
          logo: logo !== undefined ? logo : comp?.logo,
          currencyCode: currCode,
          phone,
          email
        });
      }

      if (typeof Api !== "undefined" && typeof Api.updateSettings === "function") {
        await Api.updateSettings(st.settings);
      }

      if (typeof AuditLog !== "undefined") {
        AuditLog.log({
          module: "settings",
          action: "update",
          summary: `تحديث بيانات وهوية المزرعة والمنشأة [${legalName}]`,
          details: { companyId: targetCompId, tradeName, cr, tax }
        });
      }

      toast("تم حفظ بيانات وإعدادات المزرعة بنجاح ✅");
      render();
    };

    if (file) {
      const rd = new FileReader();
      rd.onload = () => apply(rd.result);
      rd.readAsDataURL(file);
    } else {
      apply();
    }
    return;
  }

  if (name === "save-farm-project") {
    const targetProjId = id || st.activeProjectId || (st.projects && st.projects[0]?.id);
    const proj = (st.projects || []).find(p => p.id === targetProjId);

    const pName = $("#proj_name_input")?.value || "";
    const pPrefix = ($("#proj_prefix_input")?.value || "").toUpperCase();
    const pArea = parseFloat($("#proj_area_input")?.value) || 0;
    const pLoc = $("#proj_loc_input")?.value || "";
    const pTz = $("#proj_tz_input")?.value || "Africa/Cairo";
    const pGps = $("#proj_gps_input")?.value || "";
    const pLandUnit = $("#c_land_unit")?.value || "فدان";
    const pWeightUnit = $("#c_weight_unit")?.value || "كجم";

    if (proj) {
      proj.name = pName;
      proj.codePrefix = pPrefix;
      proj.code_prefix = pPrefix;
      proj.areaFeddan = pArea;
      proj.area_feddan = pArea;
      proj.locationName = pLoc;
      proj.location_name = pLoc;
      proj.timezone = pTz;
    }

    st.settings.landUnit = pLandUnit;
    st.settings.weightUnit = pWeightUnit;
    st.settings.defaultGps = pGps;
    st.settings.timezone = pTz;

    Store.set({ projects: st.projects, settings: st.settings });

    if (typeof Api !== "undefined" && typeof Api.updateProject === "function") {
      await Api.updateProject(targetProjId, {
        name: pName,
        codePrefix: pPrefix,
        areaFeddan: pArea,
        locationName: pLoc,
        timezone: pTz
      });
    }

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        module: "settings",
        action: "update",
        summary: `تحديث إعدادات وبيانات المزرعة [${pName}]`,
        details: { projectId: targetProjId, codePrefix: pPrefix, area: pArea, location: pLoc }
      });
    }

    toast("تم حفظ بيانات وإعدادات المزرعة بنجاح ✅");
    render();
    return;
  }

  if (name === "open-new-project-modal") {
    showNewProjectModal = true;
    render();
    return;
  }
  if (name === "close-new-project-modal") {
    showNewProjectModal = false;
    render();
    return;
  }
  if (name === "save-new-project") {
    const pName = ($("#np_name")?.value || "").trim();
    const pPrefix = ($("#np_prefix")?.value || "").trim().toUpperCase();
    const pArea = parseFloat($("#np_area")?.value) || 0;
    const pLoc = ($("#np_loc")?.value || "").trim();
    const pTz = $("#np_tz")?.value || "Africa/Cairo";
    const switchNow = $("#np_switch_now")?.checked !== false;
    const cloneStarter = $("#np_clone_starter")?.checked === true;

    if (!pName) return toast("اسم المزرعة / المشروع مطلوب");
    if (!pPrefix) return toast("كود البادئة (Prefix) مطلوب");

    const newId = `proj_${Date.now()}`;
    const newProj = {
      id: newId,
      companyId: st.activeCompanyId || (st.companies && st.companies[0]?.id) || "comp_bashayer",
      name: pName,
      codePrefix: pPrefix,
      areaFeddan: pArea,
      locationName: pLoc,
      timezone: pTz
    };

    st.projects = st.projects || [];
    st.projects.push(newProj);

    if (switchNow) {
      st.activeProjectId = newId;
    }
    Store.set({ projects: st.projects, activeProjectId: st.activeProjectId });

    // إرسال المشروع للخادم
    if (typeof Api !== "undefined") {
      try {
        await fetch(`${Api.API_URL}/projects`, {
          method: "POST",
          headers: Api.getHeaders(),
          body: JSON.stringify(newProj)
        });
        if (cloneStarter && typeof Api.cloneStarterPack === "function") {
          await Api.cloneStarterPack(newId);
        }
      } catch (err) {
        console.warn("Could not sync new project to server immediately:", err);
      }
    }

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        module: "projects",
        action: "create",
        summary: `إضافة مشروع / مزرعة جديدة [${pName}] بكود [${pPrefix}]`,
        details: newProj
      });
    }

    showNewProjectModal = false;
    toast(`تم إنشاء المزرعة [${pName}] بنجاح ✅`);
    render();
    return;
  }

  if (name === "switch-active-project") {
    const newProjId = id || el?.value;
    if (!newProjId) return;
    const proj = (st.projects || []).find(p => p.id === newProjId);
    if (!proj) return;
    st.activeProjectId = newProjId;
    Store.set({ activeProjectId: newProjId, activeCompanyId: proj.companyId || st.activeCompanyId });
    try { localStorage.setItem("palm_active_project_id", newProjId); } catch (_) {}
    toast(`تم التبديل إلى: ${proj.name} 🌴`);
    if (typeof Api !== "undefined" && typeof Api.pullLatest === "function") {
      try { await Api.pullLatest(newProjId); } catch (_) {}
    }
    render();
    return;
  }

  if (name === "clone-starter-pack") {
    const targetProjId = id || st.activeProjectId;
    if (!confirm("هل ترغب في استيراد القالب الافتراضي للمزرعة (الأسمدة، القطاعات النموذجية، العمليات) الآن؟")) return;
    
    if (typeof Api !== "undefined" && typeof Api.cloneStarterPack === "function") {
      const res = await Api.cloneStarterPack(targetProjId);
      if (res && res.success) {
        await Api.pullLatest(targetProjId);
        toast("تم استيراد حزمة الإطلاق الافتراضية بنجاح ✅");
      } else {
        toast("تعذر استيراد القالب: " + (res?.error || "خطأ غير متوقع"));
      }
    }
    render();
    return;
  }
  if (name === "filter-var-crop") {
    varCropFilter = id; render(); return;
  }
  if (name === "tog-crop") {
    const c = (st.crops||[]).find(x => x.id === id);
    if (!c) return;
    if (c.active && (st.crops||[]).filter(x=>x.active).length <= 1) {
      return toast("يجب أن يبقى محصول واحد نشط على الأقل بالمزرعة");
    }
    c.active = !c.active;
    Store.set({ crops: st.crops });
    if (typeof Api !== "undefined" && typeof Api.toggleCrop === "function") {
      Api.toggleCrop(c.id, c.active);
    }
    toast(c.active ? `تم تنشيط ${c.name}` : `تم تعطيل ${c.name}`);
    render(); return;
  }
  if (name === "edit-crop") {
    editCropId = id;
    setForm = "edit-crop";
    render();
    setTimeout(() => {
      const card = $("#crop_edit_card");
      if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
    return;
  }
  if (name === "cancel-crop-edit") {
    editCropId = null;
    setForm = "";
    render();
    return;
  }
  if (name === "save-crop-edit") {
    const targetId = id || editCropId;
    const c = (st.crops||[]).find(x => x.id === targetId);
    if (!c) return;
    const nameC = ($("#cname_edit")?.value || $("#c_name")?.value || "").trim();
    if (!nameC) return toast("اسم المحصول مطلوب");
    c.name = nameC;
    c.icon = ($("#cicon_edit")?.value || "").trim() || c.icon || "🌳";
    c.single = ($("#csingle_edit")?.value || $("#c_single")?.value || "").trim() || nameC;
    c.plural = ($("#cplural_edit")?.value || $("#c_plural")?.value || "").trim() || nameC;

    const srcCode = $("#csource_edit")?.value;
    if (srcCode) {
      c.primarySourceCode = srcCode;
      const srcObj = (st.propagationSourceTypes || []).find(s => s.code === srcCode);
      if (srcObj) c.offspring = srcObj.name;
    }
    const usageId = $("#cusage_edit")?.value;
    if (usageId) {
      c.usageType = usageId;
      const usageObj = (st.cropUsageTypes || []).find(u => u.id === usageId);
      if (usageObj) c.notes = usageObj.name;
    }
    c.yieldName = ($("#cyield_edit")?.value || $("#c_yield")?.value || "").trim() || c.yieldName;
    c.unit = ($("#cunit_edit")?.value || $("#c_unit")?.value || "").trim() || "كجم";
    c.codePrefix = ($("#cprefix_edit")?.value || $("#c_prefix")?.value || "").trim().toUpperCase() || c.codePrefix || "C";
    editCropId = null;
    setForm = "";
    Store.set({ crops: st.crops });
    if (typeof Api !== "undefined" && typeof Api.updateCrop === "function") {
      Api.updateCrop(c);
    }
    toast("حُفظت تعديلات المحصول بنجاح");
    render();
    return;
  }
  if (name === "add-crop-source-from-picker") {
    const c = (st.crops||[]).find(x => x.id === editCropId);
    if (!c) return;
    const sel = $("#n_src_picker");
    const code = sel?.value;
    if (!code) return toast("اختر مصدراً من القائمة أولاً");
    const opt = sel.selectedOptions?.[0];
    const srcName = opt?.dataset?.name || (st.propagationSourceTypes || []).find(s => s.code === code)?.name || code;
    c.sources = c.sources || [];
    if (c.sources.some(s => s.code === code)) return toast("المصدر مضاف مسبقاً لهذا المحصول");
    c.sources.push({ code, name: srcName });
    Store.set({ crops: st.crops });
    toast(`أُضيف المصدر ${code}: ${srcName}`);
    render();
    return;
  }
  if (name === "add-crop-source") {
    const c = (st.crops||[]).find(x => x.id === editCropId);
    if (!c) return;
    const scode = ($("#n_src_code")?.value || "").trim().toUpperCase();
    const sname = ($("#n_src_name")?.value || "").trim();
    if (!scode || !sname) return toast("أدخل حرف الكود واسم المصدر");
    c.sources = c.sources || [];
    if (c.sources.some(s => s.code === scode)) return toast("حرف الكود موجود مسبقاً لهذا المحصول");
    c.sources.push({ code: scode, name: sname });
    Store.set({ crops: st.crops });
    toast(`أُضيف المصدر ${scode}`);
    render();
    return;
  }
  if (name === "del-crop-source") {
    const c = (st.crops||[]).find(x => x.id === editCropId);
    if (!c) return;
    c.sources = (c.sources || []).filter(s => s.code !== id);
    Store.set({ crops: st.crops });
    toast("حُذف المصدر");
    render();
    return;
  }
  if (name === "add-prop-source-type") {
    const code = ($("#new_pst_code")?.value || "").trim().toUpperCase();
    const sname = ($("#new_pst_name")?.value || "").trim();
    const notes = ($("#new_pst_notes")?.value || "").trim();
    const cropId = $("#new_pst_crop")?.value || "all";
    if (!code || !sname) return toast("أدخل حرف التكويد واسم المصدر");
    st.propagationSourceTypes = st.propagationSourceTypes || [];
    if (st.propagationSourceTypes.some(s => s.code === code)) return toast(`حرف التكويد (${code}) مستخدم مسبقاً`);
    const newPst = { id: Store.uid("pst"), code, name: sname, notes, defaultCropId: cropId };
    st.propagationSourceTypes.push(newPst);
    Store.set({ propagationSourceTypes: st.propagationSourceTypes });
    if (window.Api && typeof Api.createPropagationSourceType === "function") {
      Api.createPropagationSourceType(newPst);
    }
    toast(`أُضيف نوع المصدر: ${code} - ${sname}`);
    render();
    return;
  }
  if (name === "del-prop-source-type") {
    const item = (st.propagationSourceTypes || []).find(s => s.id === id || s.code === id);
    if (!item) return;
    if (["F", "N", "C", "S"].includes(item.code)) return toast("لا يمكن حذف المصادر القياسية الأساسية");
    st.propagationSourceTypes = (st.propagationSourceTypes || []).filter(s => s.id !== item.id && s.code !== item.code);
    Store.set({ propagationSourceTypes: st.propagationSourceTypes });
    if (window.Api && typeof Api.deletePropagationSourceType === "function") {
      Api.deletePropagationSourceType(item.code);
    }
    toast("حُذف نوع المصدر");
    render();
    return;
  }
  if (name === "add-crop-usage") {
    const uname = ($("#new_cut_name")?.value || "").trim();
    const desc = ($("#new_cut_desc")?.value || "").trim();
    if (!uname) return toast("أدخل اسم تصنيف الاستخدام");
    st.cropUsageTypes = st.cropUsageTypes || [];
    const uid = "use_" + Math.random().toString(36).slice(2, 6);
    st.cropUsageTypes.push({ id: uid, name: uname, desc });
    Store.set({ cropUsageTypes: st.cropUsageTypes });
    toast(`أُضيف التصنيف: ${uname}`);
    render();
    return;
  }
  if (name === "add-crop") {
    const nameC = ($("#cname_new")?.value||"").trim();
    const single = ($("#csingle_new")?.value||"").trim() || nameC;
    const plural = ($("#cplural_new")?.value||"").trim() || nameC;
    const yieldName = ($("#cyield_new")?.value||"").trim() || "محصول";
    const icon = ($("#cicon_new")?.value||"").trim() || "🌳";
    const codePrefix = ($("#cprefix_new")?.value||"").trim().toUpperCase() || "C";
    const unit = ($("#cunit_new")?.value||"").trim() || "كجم";
    const primarySourceCode = $("#csource_new")?.value || "S";
    const usageType = $("#cusage_new")?.value || "main";
    if (!nameC) return toast("أدخل اسم المحصول الجديد");
    
    const srcObj = (st.propagationSourceTypes || []).find(s => s.code === primarySourceCode);
    const offspring = srcObj ? srcObj.name : "شتلة";
    const usageObj = (st.cropUsageTypes || []).find(u => u.id === usageType);
    const notes = usageObj ? usageObj.name : "";
    
    // Checked approved sources
    const checkedSrcCodes = $$(".c_new_src").filter(c => c.checked).map(c => c.value);
    if (!checkedSrcCodes.includes(primarySourceCode)) checkedSrcCodes.unshift(primarySourceCode);
    const sources = checkedSrcCodes.map(code => {
      const ps = (st.propagationSourceTypes || []).find(s => s.code === code);
      return { code, name: ps ? ps.name : code };
    });

    const newId = "crop_" + Math.random().toString(36).slice(2, 6);
    st.crops = st.crops || [];
    const newCropObj = {
      id: newId, name: nameC, single, plural,
      offspring, primarySourceCode, usageType, notes,
      yieldName, unit, codePrefix, active: true, icon,
      sources
    };
    st.crops.push(newCropObj);
    Store.set({ crops: st.crops });
    if (window.Api && typeof Api.createCrop === "function") {
      Api.createCrop(newCropObj);
    }
    setForm = "";
    toast(`أُضيف المحصول الجديد: ${nameC}`);
    render();
    return;
  }
  if (name === "edit-crop-var") {
    editVarId = id; setForm = "edit-var"; render(); return;
  }
  if (name === "cancel-crop-var") {
    editVarId = null; setForm = ""; render(); return;
  }
  if (name === "save-crop-var") {
    const targetId = id || editVarId;
    const cv = (st.cropVarieties||[]).find(x => x.id === targetId);
    if (!cv) return;
    const newName = ($("#vname_edit")?.value || $("#evname")?.value || "").trim();
    const newCrop = $("#vcrop_edit")?.value || $("#evcrop")?.value || cv.cropId;
    const newUsage = ($("#vusage_edit")?.value || $("#evusage")?.value || "").trim();
    if (!newName) return toast("اسم الصنف مطلوب");
    const oldName = cv.name;
    cv.name = newName;
    cv.cropId = newCrop;
    cv.usage = newUsage;
    if (oldName !== newName) {
      st.palms.forEach(p => { if (p.variety === oldName) p.variety = newName; });
      if (st.varieties) {
        st.varieties = st.varieties.map(v => v === oldName ? newName : v);
      }
    }
    editVarId = null;
    setForm = "";
    Store.set({ cropVarieties: st.cropVarieties, varieties: st.varieties, palms: st.palms });
    toast("حُفظ تعديل الصنف وتحديث الأشجار");
    render(); return;
  }
  if (name === "add-var" || name === "add-crop-var") {
    const v = ($("#vname")?.value||"").trim();
    const cropId = $("#vcrop")?.value || "palm";
    const usage = ($("#vusage")?.value||"").trim();
    if (!v) return toast("أدخل اسم الصنف");
    st.cropVarieties = st.cropVarieties || [];
    if (!st.cropVarieties.some(x => x.name === v && x.cropId === cropId)) {
      st.cropVarieties.push({ id: Store.uid("cv"), cropId, name: v, usage });
    }
    if (cropId === "palm" && !st.varieties.includes(v)) {
      st.varieties.push(v);
    }
    Store.set({ cropVarieties: st.cropVarieties, varieties: st.varieties });
    setForm = "";
    toast("أُضيف الصنف بنجاح");
    render(); return;
  }
  if (name === "del-crop-var") {
    const cv = (st.cropVarieties||[]).find(x => x.id === id);
    if (!cv) return;
    const isUsed = st.palms.some(p => p.variety === cv.name);
    if (isUsed) return toast("لا يمكن حذف صنف مستخدم في أشجار المزرعة");
    st.cropVarieties = (st.cropVarieties||[]).filter(x => x.id !== id);
    st.varieties = (st.varieties||[]).filter(x => x !== cv.name);
    Store.set({ cropVarieties: st.cropVarieties, varieties: st.varieties });
    toast("حُذف الصنف");
    render(); return;
  }
  if (name === "go-variety-trees") {
    const variety = el?.dataset?.variety || id;
    const cropId = el?.dataset?.crop || "palm";
    browseCrop = cropId === "all" ? "" : cropId;
    browseSec = null;
    browsePlotGroup = null;
    browsePlot = null;
    palmQ = variety;
    palmPage = 1;
    go("palms");
    return;
  }
  if (name === "add-role") {
    const id = ($("#rid").value||"").trim();
    const nameR = ($("#rname").value||"").trim();
    if (!id || !nameR) return toast("أدخل معرف واسم الدور");
    const matrix = {};
    $$(".rmx").forEach(c => {
      if (!c.checked) return;
      matrix[c.dataset.s] = (matrix[c.dataset.s]||"") + c.dataset.k;
    });
    const perms = [];
    if (matrix.palms) perms.push("palms");
    if (matrix.gis) perms.push("gis");
    if (matrix.ops) perms.push("ops");
    if ((matrix.ops||"").includes("a")) perms.push("approve");
    if (matrix.nursery) perms.push("nursery");
    if (matrix.fertilizers) perms.push("fertilizers");
    if (matrix.yields) perms.push("yields");
    if (matrix.reports) perms.push("reports");
    if (matrix.zakat) perms.push("zakat");
    if (matrix.farmers) perms.push("farmers");
    if (matrix.users) perms.push("users");
    if (matrix.settings) perms.push("settings");
    const rdesc = ($("#rdesc")?.value || "").trim();
    const newRole = { id, name: nameR, perms: [...new Set(perms)], matrix, desc: rdesc };
    st.roles = (st.roles || []).filter(r => r.id !== id);
    st.roles.push(newRole);
    st.availableRoles = st.availableRoles || [];
    if (!st.availableRoles.some(r => r.id === id)) {
      st.availableRoles.push({ id, nameAr: nameR, description: rdesc, matrix, perms: newRole.perms });
    }
    Store.set({ roles: st.roles, availableRoles: st.availableRoles });
    if (typeof API !== "undefined" && API.post) {
      API.post("/api/roles", { id, name: nameR, nameAr: nameR, description: rdesc, matrix, perms: newRole.perms }).catch(err => console.warn("API save role error:", err));
    }
    toast("أُضيف الدور وحُفظ في قاعدة البيانات بنجاح ✅"); render(); return;
  }
  if (name === "save-role-perms") {
    const rid = $("#erole").value;
    const role = st.roles.find(r => r.id === rid);
    const roleName = role?.name || rid;
    if (!confirm(`هل أنت متأكد من حفظ وتطبيق مصفوفة الصلاحيات المحددة للدور [${roleName}]؟`)) return;
    const matrix = {};
    $$(".rmx").forEach(c => {
      if (!c.checked) return;
      matrix[c.dataset.s] = (matrix[c.dataset.s] || "") + c.dataset.k;
    });
    const perms = [];
    if (matrix.palms) perms.push("palms");
    if (matrix.gis) perms.push("gis");
    if (matrix.ops) perms.push("ops");
    if ((matrix.ops || "").includes("a")) perms.push("approve");
    if (matrix.nursery) perms.push("nursery");
    if (matrix.fertilizers) perms.push("fertilizers");
    if (matrix.yields) perms.push("yields");
    if (matrix.reports) perms.push("reports");
    if (matrix.zakat) perms.push("zakat");
    if (matrix.farmers) perms.push("farmers");
    if (matrix.users) perms.push("users");
    if (matrix.settings) perms.push("settings");
    const updatedDesc = ($("#rdesc")?.value || role?.desc || "").trim();
    st.roles = st.roles.map(r => r.id === rid ? { ...r, perms, matrix, desc: updatedDesc } : r);
    st.availableRoles = (st.availableRoles || []).map(r => r.id === rid ? { ...r, nameAr: roleName, description: updatedDesc, matrix, perms } : r);
    Store.set({ roles: st.roles, availableRoles: st.availableRoles });
    if (typeof API !== "undefined" && API.post) {
      API.post("/api/roles", { id: rid, name: roleName, nameAr: roleName, description: updatedDesc, matrix, perms }).catch(err => console.warn("API save role error:", err));
    }
    toast("حُفظت صلاحيات الدور وتحدثت في قاعدة البيانات ✅"); render(); return;
  }
  if (name === "delete-role") {
    const rid = id || $("#erole")?.value;
    if (!rid) return;
    const protectedRoles = ["admin", "super_admin", "engineer", "worker", "investor", "nursery_mgr", "warehouse_mgr", "customer_care", "tenant_user"];
    if (protectedRoles.includes(rid)) return toast("لا يمكن حذف الأدوار القياسية الأساسية للنظام");
    if (!confirm(`هل أنت متأكد من حذف الدور المخصص [${rid}] نهائياً من النظام وقاعدة البيانات؟`)) return;
    st.roles = (st.roles || []).filter(r => r.id !== rid);
    st.availableRoles = (st.availableRoles || []).filter(r => r.id !== rid);
    editRoleId = st.roles[0]?.id || null;
    Store.set({ roles: st.roles, availableRoles: st.availableRoles });
    if (typeof API !== "undefined" && API.del) {
      API.del(`/api/roles/${encodeURIComponent(rid)}`).catch(err => console.warn("API delete role error:", err));
    }
    toast("تم حذف الدور المخصص بنجاح 🗑️"); render(); return;
  }
  if (name === "chip-pop") {
    $$(".chip.more.open").forEach(c => { if (c !== el) c.classList.remove("open"); });
    el?.classList.toggle("open");
    return;
  }
  if (name === "mx-all") {
    $$(".rmx").forEach(c => { if (c.dataset.k === "r") c.checked = true; });
    return;
  }
  if (name === "mx-clear") {
    $$(".rmx, .mx-col, .mx-row").forEach(c => { c.checked = false; });
    return;
  }
  if (name === "edit-char") {
    const c = st.charities.find(x => x.id === id);
    if (!c) return;
    const name = prompt("اسم الجهة", c.name); if (name===null) return;
    if (!name.trim()) return toast("الاسم مطلوب");
    c.name = name.trim();
    c.address = prompt("العنوان", c.address||"") || c.address;
    c.phone = prompt("التواصل", c.phone||"") || c.phone;
    c.receive = prompt("both أو cash أو in_kind", c.receive||"both") || c.receive;
    Store.set({ charities: st.charities }); toast("تم التعديل"); render(); return;
  }
  if (name === "scope-add") {
    const v = $("#scopeadd")?.value; if (!v) return toast("اختر قطاعاً أو قطعة");
    const st2 = Store.get();
    if (v.startsWith("SEC:")) st2.plots.filter(p => p.sector === v.slice(4)).forEach(p => draftScope.add(p.id));
    else draftScope.add(v);
    paintScopePicker(); return;
  }
  if (name === "scope-clear") { draftScope.clear(); paintScopePicker(); return; }
  if (name === "scope-drop") { draftScope.delete(id); paintScopePicker(); return; }
  if (name === "scope-drop-sec") {
    Store.get().plots.filter(p => p.sector === id).forEach(p => draftScope.delete(p.id));
    paintScopePicker(); return;
  }
  if (name === "add-user") {
    if (!$("#uname")?.value || !$("#uuser")?.value) return toast("الاسم واسم الدخول مطلوبان");
    const me = session();
    const isEng = me && me.role === "engineer";
    const role = isEng ? "worker" : ($("#urole")?.value || "worker");
    let userRoles = [role];
    if (!isEng) {
      const checkedRoles = Array.from(document.querySelectorAll(".user-role-chk:checked")).map(el => el.value);
      if (role && !checkedRoles.includes(role)) checkedRoles.unshift(role);
      if (checkedRoles.length > 0) userRoles = checkedRoles;
    }

    let assignedPlots = [...draftScope];
    if (isEng) {
      assignedPlots = assignedPlots.filter(pId => (me.plots || []).includes(pId));
    }

    const matrix = {};
    const customPerms = [];
    $$(".rmx-user").forEach(c => {
      if (!c.checked) return;
      if (!matrix[c.dataset.s]) matrix[c.dataset.s] = "";
      if (!matrix[c.dataset.s].includes(c.dataset.k)) {
        matrix[c.dataset.s] += c.dataset.k;
      }
      if (c.dataset.pid) customPerms.push(c.dataset.pid);
    });
    if (isEng) {
      delete matrix.users;
      delete matrix.settings;
      delete matrix.zakat;
      Object.keys(matrix).forEach(s => {
        matrix[s] = matrix[s].replace(/[da]/g, "");
      });
    }

    const targetCompId = st.activeCompanyId || me?.activeCompanyId || me?.companyId || "comp_bashayer";
    const targetProjId = st.activeProjectId || me?.activeProjectId || me?.projectId || "proj_farafra_01";

    const tempPass = $("#upass")?.value || ("Palm#" + Math.floor(1000 + Math.random() * 9000) + "!xK");
    const email = $("#uemail")?.value?.trim() || "";
    const mustChange = $("#umust_change") ? $("#umust_change").checked : true;

    const newUser = {
      id: Store.uid("u"),
      name: $("#uname").value.trim(),
      user: $("#uuser").value.trim(),
      pass: tempPass,
      email,
      role,
      roles: userRoles,
      phone: $("#uphone")?.value?.trim() || "",
      avatar: $("#new_uavatar_val")?.value || "",
      bloodType: $("#ublood")?.value || "",
      plots: assignedPlots,
      palmIds: [],
      active: $("#uactive")?.value !== "0",
      mustChangePassword: mustChange,
      inventoryScope: $("#uinventory_scope")?.value || null,
      matrix,
      customPerms
    };

    st.users.push(newUser);
    Store.set({ users: st.users });

    if (typeof Api !== "undefined" && typeof Api.createUser === "function") {
      try {
        const res = await Api.createUser({
          id: newUser.id,
          username: newUser.user,
          fullName: newUser.name,
          role: newUser.role,
          roles: newUser.roles,
          phone: newUser.phone,
          email: newUser.email,
          pass: tempPass,
          active: newUser.active,
          mustChangePassword: mustChange,
          avatar: newUser.avatar,
          bloodType: newUser.bloodType,
          plots: newUser.plots
        });
        if (res && res.tempPassword) {
          newUser.tempPassword = res.tempPassword;
        }
        if (res && res.id) {
          newUser.id = res.id;
        }
      } catch (err) {
        console.warn("API create user error:", err);
      }
    }

    if (typeof AuditLog !== "undefined") {
      AuditLog.log({
        action: "create",
        module: "users",
        severity: "info",
        title: `إضافة مستخدم جديد: ${newUser.name}`,
        summary: `تم إنشاء حساب للمستخدم [${newUser.name}] (${newUser.user}) بدور [${newUser.role}] بواسطة ${session()?.name}`,
        details: { name: newUser.name, user: newUser.user, role: newUser.role, phone: newUser.phone, plots: newUser.plots },
        targetType: "user",
        targetId: newUser.id,
        user: session()?.name || "مستخدم",
        role: session()?.role || "worker"
      });
    }

    toast("تمت إضافة المستخدم بنجاح ✅");
    go("users");

    sharedCredentialsData = {
      ...newUser,
      tempPassword: newUser.tempPassword || tempPass,
      title: "تم إنشاء الحساب بنجاح — مشاركة بيانات الدخول"
    };
    render();
    return;
  }
  return ACT_NEXT;
}
