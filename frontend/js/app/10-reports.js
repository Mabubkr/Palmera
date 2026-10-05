// PalmTrace app — Reports
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function arApproval(v) {
  return v === "approved" ? "معتمدة" : v === "rejected" ? "مرفوضة" : "بانتظار الاعتماد";
}

const REPORT_DEFINITIONS = [
  {
    id: "fert_balances",
    name: "📦 أرصدة وجرد المخزون للمبيدات والأسمدة",
    shortName: "أرصدة وجرد المخزون",
    category: "inventory",
    roles: ["admin", "warehouse_mgr"],
    permKey: "report_inventory",
    desc: "أرصدة المستودع وحد الأمان وتكاليف الشراء والكميات المتاحة"
  },
  {
    id: "fertilizers",
    name: "🧪 حركة الأسمدة والمخزون والاستهلاك",
    shortName: "حركة الأسمدة والمخزون",
    category: "inventory",
    roles: ["admin", "warehouse_mgr", "engineer"],
    permKey: "report_fertilizers",
    desc: "تتبع أذونات الصرف والتوريدات والاستهلاك الحقلي اليومي"
  },
  {
    id: "yields",
    name: "🌾 المحصول والإنتاج والوارد المخزني",
    shortName: "المحصول والإنتاج",
    category: "inventory",
    roles: ["admin", "warehouse_mgr", "engineer"],
    permKey: "report_yields",
    desc: "أوزان المحصول المحصود والوارد إلى المستودع وفرز الجودة"
  },
  {
    id: "ops",
    name: "⚙️ العمليات والخدمات الحقلية",
    shortName: "العمليات الحقلية",
    category: "field",
    roles: ["admin", "engineer"],
    permKey: "report_ops",
    desc: "سجل تنفيذ ومتابعة العمليات الزراعية واعتمادها"
  },
  {
    id: "status",
    name: "🩺 حالات وسلامة الأشجار",
    shortName: "سلامة الأشجار",
    category: "field",
    roles: ["admin", "engineer"],
    permKey: "report_trees",
    desc: "تقرير صحة الأشجار وسوسة النخيل والإصابات المرضية"
  },
  {
    id: "incidents",
    name: "🚨 الحالات العارضة والبلاغات",
    shortName: "البلاغات الميدانية",
    category: "field",
    roles: ["admin", "engineer"],
    permKey: "report_incidents",
    desc: "بلاغات الأعطال والآفات والري بالميدان"
  },
  {
    id: "sectors",
    name: "🗺️ القطاعات والقطع والأصول",
    shortName: "القطاعات والأصول",
    category: "field",
    roles: ["admin", "engineer"],
    permKey: "report_sectors",
    desc: "توزيع النخيل والقطع وشبكات الري"
  },
  {
    id: "offshoots",
    name: "🌱 سجل الفسائل والمشتل",
    shortName: "سجل المشتل",
    category: "nursery",
    roles: ["admin", "engineer", "nursery_mgr"],
    permKey: "report_nursery",
    desc: "مراحل تجذير الفسائل وحركتها بالمشتل"
  },
  {
    id: "offshoot_rev",
    name: "💰 إيرادات وتوريد الفسائل (مالية / مستثمر)",
    shortName: "إيرادات الفسائل",
    category: "finance",
    roles: ["admin", "investor"],
    permKey: "report_financials",
    desc: "الإيرادات المالية ونسب المستثمرين من الفسائل المقلوعة"
  }
];

function isReportPermitted(u, repKey) {
  if (!u) return false;
  if (u.role === "admin") return true;
  const def = REPORT_DEFINITIONS.find(r => r.id === repKey);
  if (!def) return false;
  if (def.roles && def.roles.includes(u.role)) return true;
  if (def.permKey && hasPerm(def.permKey)) return true;
  return false;
}

function getAllowedReports(u) {
  if (!u) return [];
  if (u.role === "admin") return REPORT_DEFINITIONS;
  return REPORT_DEFINITIONS.filter(r => isReportPermitted(u, r.id));
}

function getDefaultReportForUser(u) {
  const allowed = getAllowedReports(u);
  if (allowed.some(r => r.id === reportKind)) {
    return reportKind;
  }
  return allowed[0]?.id || "fert_balances";
}

function reportRows() {
  const me = session();
  if (!isReportPermitted(me, reportKind)) {
    return [];
  }
  const st = Store.get();
  const inRange = (d) => {
    if (!d) return true;
    const x = String(d).slice(0,10);
    if (reportFrom && x < reportFrom) return false;
    if (reportTo && x > reportTo) return false;
    return true;
  };
  const locOk = (plotId) => {
    if (!plotId) return true;
    if (plotId.startsWith("base:")) {
      const bId = plotId.slice(5);
      const subs = st.plots.filter(p => p.id.startsWith(bId) || plotBaseId(p) === bId);
      if (reportSec && !subs.some(p => p.sector === reportSec)) return false;
      if (reportPlot && !subs.some(p => p.id === reportPlot) && plotId !== reportPlot) return false;
      return true;
    }
    const pl = st.plots.find(p => p.id === plotId);
    if (reportSec && pl?.sector !== reportSec) return false;
    if (reportPlot && plotId !== reportPlot && plotBaseId(plotId) !== reportPlot.replace("base:", "")) return false;
    return true;
  };

  // Helper to find investor for a plot / palm
  const investorFor = (plotId, palmId) => {
    return (st.users || []).find(u => u.role === "investor" && (
      (plotId && (u.plots || []).includes(plotId)) ||
      (palmId && (u.palmIds || []).includes(palmId))
    ));
  };

  const currentRole = session()?.role;
  const currentInvId = currentRole === "investor" ? session()?.id : reportInvestor;

  if (reportKind === "offshoot_rev") {
    return st.offshoots.filter(o => {
      if (!inRange(o.date)) return false;
      const m = palmById(o.motherId);
      if (!locOk(m?.plot)) return false;
      const cId = m?.cropId || "palm";
      if (reportCrop !== "all" && cId !== reportCrop) return false;
      const inv = investorFor(m?.plot, m?.id);
      if (currentInvId && inv?.id !== currentInvId) return false;
      if (reportSt && o.health !== reportSt && osStage(o) !== reportSt && osStatus(o) !== reportSt) return false;
      return true;
    }).map(o => {
      const m = palmById(o.motherId);
      const pl = st.plots.find(p => p.id === m?.plot);
      const inv = investorFor(m?.plot, m?.id);
      const w = Number(o.weight) || 0;
      const vari = o.variety || m?.variety || "—";
      const isPrem = ["مجدول", "برحي", "عجوة"].some(v => vari.includes(v));
      let unitPrice = Number(o.price);
      if (!unitPrice) {
        unitPrice = w >= 20 ? (isPrem ? 500 : 380) : w >= 15 ? (isPrem ? 420 : 300) : w >= 10 ? (isPrem ? 320 : 240) : (isPrem ? 250 : 180);
      }
      return {
        date: fmtDate(o.date),
        code: o.tempCode,
        motherCode: m?.code || "—",
        type: vari,
        loc: pl ? `${pl.sector} / ${pl.name}` : (m?.plot || "—"),
        plotId: m?.plot || "",
        who: inv ? inv.name : "المزرعة (الإدارة)",
        investorId: inv?.id || "",
        weight: w ? `${w} كجم` : "—",
        st: osStatus(o),
        price: unitPrice,
        currency: st.settings.currency || "ج.م",
        raw: o
      };
    });
  }

  if (reportKind === "offshoots") {
    return st.offshoots.filter(o => {
      if (!inRange(o.date)) return false;
      const m = palmById(o.motherId);
      if (!locOk(m?.plot)) return false;
      const cId = m?.cropId || "palm";
      if (reportCrop !== "all" && cId !== reportCrop) return false;
      if (reportNsStage !== "all" && osStage(o) !== reportNsStage) return false;
      if (reportNsSource !== "all" && o.source !== reportNsSource) return false;
      if (reportSt && o.health !== reportSt && osStage(o) !== reportSt && osStatus(o) !== reportSt) return false;
      return true;
    }).map(o => {
      const m = palmById(o.motherId);
      const pl = st.plots.find(p => p.id === m?.plot);
      const srcObj = (st.propagationSourceTypes || [
        { code: 'F', name: 'فسيلة' }, { code: 'N', name: 'نسيج' }, { code: 'C', name: 'عقلة خضرية' }, { code: 'S', name: 'شتلة مطعومة' }
      ]).find(s => s.code === o.source);
      const srcName = srcObj ? srcObj.name : (o.source === 'F' ? 'فسيلة' : o.source || 'فسيلة');
      const w = Number(o.weight) || 0;
      return {
        date: fmtDate(o.date),
        code: o.tempCode || o.id,
        motherCode: m?.code || "—",
        type: o.variety || m?.variety || "—",
        source: srcName,
        stage: osStatus(o),
        stageKey: osStage(o),
        weight: w ? `${w} كجم` : "—",
        loc: pl ? `${sectorName(pl.sector)} / ${pl.name}` : (m?.plot || "المشتل"),
        who: m?.code || "—",
        st: o.health || "سليمة",
        raw: o
      };
    });
  }

  if (reportKind === "yields") {
    return (st.yields || []).filter(y => {
      if (!inRange(y.date || y.season)) return false;
      const cId = y.cropId || "palm";
      if (reportCrop !== "all" && cId !== reportCrop) return false;
      const plotId = y.plotId || (y.level === "palm" ? palmById(y.palmId)?.plot : "");
      if (plotId && !locOk(plotId)) return false;
      if (reportYieldQuality !== "all" && y.quality !== reportYieldQuality) return false;
      if (reportVariety && (y.variety || "") !== reportVariety) return false;
      return true;
    }).map(y => {
      const cLabel = cropSingle(y.cropId || "palm");
      const plotId = y.plotId || (y.level === "palm" ? palmById(y.palmId)?.plot : "");
      const pl = st.plots.find(p => p.id === plotId);
      const kg = Number(y.kg) || 0;
      let locStr = "—";
      if (Array.isArray(y.plotIds) && y.plotIds.length > 1) {
        locStr = `${y.plotIds.length} قطع (${y.plotIds.map(p => plotName(p)).join(", ")})`;
      } else if (pl) {
        locStr = `${sectorName(pl.sector)} / ${pl.name}`;
      } else if (plotId) {
        locStr = plotName(plotId);
      } else if (y.sectorId) {
        locStr = sectorName(y.sectorId);
      }
      return {
        date: fmtDate(y.date || y.season),
        code: y.batch || y.id,
        crop: cLabel,
        variety: y.variety || "عام",
        type: `${cropIcon(y.cropId||"palm", 13)} ${cLabel} (${y.variety||"عام"})`,
        kg,
        quality: y.quality || "ممتاز",
        boxes: y.boxes || "—",
        loc: locStr,
        notes: y.notes || "—",
        who: y.teamLeader || "فريق الحصاد",
        st: `${kg.toLocaleString()} كجم (${y.quality||"ممتاز"})`,
        raw: y
      };
    });
  }

  if (reportKind === "status") {
    return (st.palms || []).filter(p => {
      const cId = p.cropId || "palm";
      if (reportCrop !== "all" && cId !== reportCrop) return false;
      if (!locOk(p.plot)) return false;
      if (reportTreeSt !== "all" && p.status !== reportTreeSt) return false;
      return true;
    }).map(p => {
      const pl = st.plots.find(x => x.id === p.plot);
      const cLabel = cropSingle(p.cropId || "palm");
      return {
        date: fmtDate(p.plantDate) || "—",
        code: p.code,
        crop: cLabel,
        variety: p.variety || "—",
        type: `${cropIcon(p.cropId||"palm", 13)} ${cLabel} (${p.variety||"عام"})`,
        loc: pl ? `${sectorName(pl.sector)} / ${pl.name}` : (p.plot || "—"),
        sector: pl ? sectorName(pl.sector) : "—",
        plotName: pl ? pl.name : (p.plot || "—"),
        who: p.supplier || "مشتل المزرعة",
        st: p.status || "سليمة",
        notes: p.notes || "—",
        raw: p
      };
    });
  }

  if (reportKind === "sectors") {
    return (st.plots || []).filter(p => !reportSec || p.sector === reportSec).map(pl => {
      const palms = (st.palms || []).filter(p => p.plot === pl.id);
      const cropPalms = palms.filter(p => (p.cropId || "palm") === "palm");
      const cropOlives = palms.filter(p => p.cropId === "olive");
      const filterPalms = palms.filter(p => (reportCrop === "all" || (p.cropId || "palm") === reportCrop));
      const secName = sectorName(pl.sector);
      return {
        date: "—",
        code: pl.id,
        name: pl.name,
        sector: secName,
        type: secName,
        loc: `${secName} / ${pl.name}`,
        area: pl.area || "—",
        palmCount: cropPalms.length,
        oliveCount: cropOlives.length,
        totalAssets: filterPalms.length,
        irrigation: pl.irrigationType || "تنقيط",
        who: "إدارة الميدان",
        st: `${filterPalms.length} أصل`,
        raw: pl
      };
    });
  }

  if (reportKind === "fert_balances") {
    return (st.fertilizers || []).filter(f => {
      if (reportCrop !== "all" && f.cropId && f.cropId !== "all" && f.cropId !== reportCrop) return false;
      if (reportFertKind && f.kind !== reportFertKind) return false;
      const stock = Number(f.stock) || 0;
      const minAlert = Number(f.minAlert) || 0;
      const isLow = stock <= minAlert;
      const isEmpty = stock <= 0;
      if (reportStockStatus === "low" && !isLow) return false;
      if (reportStockStatus === "empty" && !isEmpty) return false;
      if (reportStockStatus === "ok" && isLow) return false;
      if (reportFert && f.id !== reportFert) return false;
      return true;
    }).map(f => {
      const stock = Number(f.stock) || 0;
      const allocated = Number(f.allocated) || 0;
      const consumed = Number(f.consumed) || 0;
      const minAlert = Number(f.minAlert) || 0;
      const grandTotal = stock + allocated;
      const isLow = stock <= minAlert;
      const isEmpty = stock <= 0;
      const cropLabel = f.cropId === "olive" ? "زيتون" : (f.cropId === "palm" ? "نخيل" : "مشترك");
      const stText = isEmpty ? "نافد" : isLow ? "بحد الأمان" : "كافٍ وآمن";
      const cost = Number(f.unitCost || f.cost) || 0;
      const totalVal = Math.round(stock * cost);
      return {
        date: "—",
        code: f.id,
        name: f.name,
        type: `${f.name} (${f.kind || "سماد"})`,
        kind: f.kind || "سماد",
        crop: cropLabel,
        unit: f.unit || "كجم",
        stock,
        allocated,
        consumed,
        grandTotal,
        minAlert,
        cost,
        value: totalVal,
        loc: "المستودع الرئيسي",
        who: "أمين المستودع",
        st: stText,
        isLow,
        isEmpty,
        raw: f
      };
    });
  }

  if (reportKind === "fertilizers") {
    const vouchers = (st.fertilizerVouchers || []).filter(v => {
      if (!inRange(v.date || v.createdAt)) return false;
      if (reportSec && v.sectorId && v.sectorId !== reportSec) return false;
      if (reportPlot && v.plotId && v.plotId !== reportPlot) return false;
      if (reportSt === "approved" && v.status !== "received") return false;
      if (reportSt === "pending" && v.status !== "pending") return false;
      if (reportSt === "rejected" && v.status !== "rejected") return false;
      if (reportFert && v.fertId !== reportFert) return false;
      if (reportAction) {
        if (reportAction === "supply" && v.type !== "supply") return false;
        if (reportAction === "issue" && v.type !== "issue") return false;
        if (reportAction === "consumption") return false;
      }
      if (reportUser) {
        if (v.type === "supply") {
          if (v.toUser !== reportUser && v.userId !== reportUser) return false;
        } else {
          if (v.toUser !== reportUser && v.receivedBy !== reportUser) return false;
        }
      }
      return true;
    }).map(v => {
      const isSupply = v.type === "supply";
      const toUserObj = (st.users || []).find(usr => usr.id === v.toUser);
      const toUserName = toUserObj ? toUserObj.name : (v.toUser || "—");
      const secName = v.sectorId ? (sectorName(v.sectorId) || v.sectorId) : "المستودع الرئيسي";
      const fertObj = (st.fertilizers || []).find(f => f.id === v.fertId);
      const fertName = v.fertName || fertObj?.name || "مركب غير محدد";
      return {
        date: fmtDate(v.date || v.createdAt),
        code: v.id,
        actionType: isSupply ? "توريد" : "صرف عهدة",
        type: isSupply ? "🚛 توريد للمستودع" : "📦 إذن صرف عهدة",
        material: fertName,
        qty: Number(v.qty) || 0,
        unit: v.unit || fertObj?.unit || "كجم",
        loc: secName,
        who: isSupply ? (v.from || v.supplier || "المورد") : toUserName,
        whoId: isSupply ? "" : v.toUser,
        st: v.status === "received" ? "✅ مستلم بالموقع" : v.status === "rejected" ? "❌ مرفوض" : "⏳ معلق بالانتظار",
        statusKey: v.status,
        raw: v
      };
    });

    const matOps = (reportAction === "supply" ? [] : (st.operations || []).filter(o => {
      if (!o.material) return false;
      if (!inRange(o.at)) return false;
      const p = palmById(o.palmId);
      if (!locOk(p?.plot)) return false;
      const cId = p?.cropId || "palm";
      if (reportCrop !== "all" && cId !== reportCrop) return false;
      if (reportSt && o.approval !== reportSt) return false;
      if (reportUser && o.workerId !== reportUser) return false;
      if (reportFert) {
        const fertObj = (st.fertilizers || []).find(f => f.id === reportFert);
        if (fertObj && !o.material.toLowerCase().includes(fertObj.name.toLowerCase()) && fertObj.name !== o.material) return false;
      }
      if (reportAction && reportAction !== "all" && reportAction !== "consumption") return false;
      return true;
    }).map(o => {
      const p = palmById(o.palmId);
      const pl = st.plots.find(x => x.id === p?.plot);
      const worker = userBy(o.workerId);
      return {
        date: fmtDate(o.at),
        code: p?.code || o.id,
        actionType: "استهلاك",
        type: `🌾 استهلاك حقلي`,
        material: o.material,
        qty: parseFloat(o.dose) || 1,
        unit: o.doseUnit || "جرعة/شجرة",
        loc: pl ? `${sectorName(pl.sector)} / ${pl.name}` : "الحقل",
        who: worker?.name || "عامل الموقع",
        whoId: o.workerId,
        st: arApproval(o.approval),
        statusKey: o.approval,
        raw: o
      };
    }));

    return [...vouchers, ...matOps].sort((a,b) => (b.date||"").localeCompare(a.date||""));
  }

  if (reportKind === "incidents") {
    const ops = (st.operations || []).filter(o => {
      if (!inRange(o.at)) return false;
      const t = (st.operationTypes || []).find(ty => ty.id === o.typeId);
      if (catName(t?.catId) !== "عارضة") return false;
      const p = palmById(o.palmId);
      if (!locOk(p?.plot)) return false;
      const cId = p?.cropId || "palm";
      if (reportCrop !== "all" && cId !== reportCrop) return false;
      if (reportSt && o.approval !== reportSt) return false;
      if (reportUser && o.workerId !== reportUser) return false;
      return true;
    }).sort((a,b)=>new Date(b.at)-new Date(a.at));

    return ops.map(o => {
      const p = palmById(o.palmId);
      const pl = (st.plots || []).find(x => x.id === p?.plot);
      const worker = userBy(o.workerId);
      const isWeevil = (typeName(o.typeId) || "").includes("سوسة") || (o.notes || "").includes("سوسة");
      return {
        date: fmtDate(o.at),
        code: p?.code || o.id,
        type: `${isWeevil ? '🚨' : '⚠️'} ${typeName(o.typeId)}`,
        loc: pl ? `${sectorName(pl.sector)} / ${pl.name}` : (p?.plot || "الحقل"),
        who: worker?.name || "عامل الموقع",
        st: arApproval(o.approval),
        approvalKey: o.approval,
        supervisorNote: o.supervisorNote || "—",
        notes: o.notes || "—",
        isWeevil,
        raw: o
      };
    });
  }

  const ops = (st.operations || []).filter(o => {
    if (!inRange(o.at)) return false;
    const p = palmById(o.palmId);
    if (!locOk(p?.plot)) return false;
    const cId = p?.cropId || "palm";
    if (reportCrop !== "all" && cId !== reportCrop) return false;
    if (reportSt && o.approval !== reportSt) return false;
    if (reportOpType && o.typeId !== reportOpType) return false;
    if (reportUser && o.workerId !== reportUser) return false;
    return true;
  }).sort((a,b)=>new Date(b.at)-new Date(a.at));

  return ops.map(o => {
    const p = palmById(o.palmId);
    const pl = (st.plots || []).find(x => x.id === p?.plot);
    const worker = userBy(o.workerId);
    return {
      date: fmtDate(o.at),
      code: p?.code || o.id,
      type: `${cropIcon(p?.cropId||"palm", 13)} ${typeName(o.typeId)}`,
      loc: pl ? `${sectorName(pl.sector)} / ${pl.name}` : (p?.plot || "—"),
      who: worker?.name || "عامل الموقع",
      st: arApproval(o.approval),
      supervisorNote: o.supervisorNote || "—",
      raw: o
    };
  });
}
function reportsView() {
  const st = Store.get();
  const me = session();
  const isInv = me?.role === "investor";
  const isWhMgr = me?.role === "warehouse_mgr";
  const activeCrops = (st.crops || []).filter(c => c.active);
  const allowedReports = getAllowedReports(me);
  if (allowedReports.length === 0) {
    return `<div class="card" style="text-align:center;padding:40px">
      <h3>🔒 لا تملك صلاحية للوصول إلى أي من تقارير النظام</h3>
      <p class="muted">يرجى مراجعة إدارة النظام لمنحك الصلاحيات المناسبة لدورك.</p>
    </div>`;
  }
  if (!allowedReports.some(r => r.id === reportKind)) {
    reportKind = getDefaultReportForUser(me);
  }
  const kinds = allowedReports.map(r => [r.id, r.name]);
  const rows = reportRows();
  const approved = rows.filter(r => r.st === "معتمدة" || r.statusKey === "received" || (r.raw && r.raw.approval === "approved")).length;
  const pending = rows.filter(r => r.st === "بانتظار الاعتماد" || r.statusKey === "pending" || (r.raw && r.raw.approval === "pending")).length;
  const crit = rows.filter(r => (r.type||"").includes("سوسة")).length;

  const isOffshootRev = reportKind === "offshoot_rev";
  const isFertBalances = reportKind === "fert_balances";
  const isFertilizers = reportKind === "fertilizers";

  const totalRev = isOffshootRev ? rows.reduce((a,r) => a + (r.price || 0), 0) : 0;
  const invRev = isOffshootRev ? rows.filter(r => r.investorId).reduce((a,r) => a + (r.price || 0), 0) : 0;
  const avgPrice = (isOffshootRev && rows.length) ? Math.round(totalRev / rows.length) : 0;

  const counts = {};
  rows.forEach(r => {
    let k = r.type;
    if (r.actionType) k = `${r.actionType}: ${r.material}`;
    else if (isFertBalances) k = r.kind;
    else if (reportKind === "offshoots") k = `${r.stage} (${r.type})`;
    else if (reportKind === "yields") k = `${r.crop} - ${r.variety} (${r.quality})`;
    else if (reportKind === "status") k = r.st;
    else if (reportKind === "sectors") k = r.sector;
    else if (reportKind === "incidents") k = r.type;
    counts[k] = (counts[k]||0)+1;
  });
  const maxC = Math.max(1, ...Object.values(counts));
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  if (reportPage > pages) reportPage = pages;
  const slice = rows.slice((reportPage-1)*50, reportPage*50);
  const plots = st.plots.filter(p => !reportSec || p.sector === reportSec);
  const investors = (st.users || []).filter(u => u.role === "investor");
  const fieldUsers = (st.users || []).filter(u => ["engineer", "worker", "warehouse_mgr", "admin"].includes(u.role));

  // Build Dynamic Filters based on active reportKind
  let dynamicFilters = "";
  if (isFertBalances) {
    dynamicFilters = `
      <select id="rf_fert_kind" style="width:auto">
        <option value="" ${!reportFertKind?'selected':''}>كل تصنيفات المركبات</option>
        <option value="كيميائي" ${reportFertKind==='كيميائي'?'selected':''}>سماد كيميائي</option>
        <option value="عضوي" ${reportFertKind==='عضوي'?'selected':''}>سماد عضوي</option>
        <option value="مبيد" ${reportFertKind==='مبيد'?'selected':''}>مبيد وقائي / علاجي</option>
        <option value="عناصر صغرى" ${reportFertKind==='عناصر صغرى'?'selected':''}>عناصر صغرى مخلبية</option>
        <option value="أحماض أمينية" ${reportFertKind==='أحماض أمينية'?'selected':''}>أحماض أمينية ومحفزات</option>
        <option value="مخصب" ${reportFertKind==='مخصب'?'selected':''}>مخصب / معالجة تربة</option>
      </select>
      <select id="rf_stock_st" style="width:auto">
        <option value="" ${!reportStockStatus?'selected':''}>كل حالات التوفر</option>
        <option value="ok" ${reportStockStatus==='ok'?'selected':''}>✅ متوفر وكافٍ</option>
        <option value="low" ${reportStockStatus==='low'?'selected':''}>⚠️ بحد الأمان أو منخفض</option>
        <option value="empty" ${reportStockStatus==='empty'?'selected':''}>🚨 نافد تماماً (صفر)</option>
      </select>
      <select id="rf_fert" style="width:auto">
        <option value="">كل الأصناف المسجلة</option>
        ${(st.fertilizers||[]).map(f => `<option value="${f.id}" ${reportFert===f.id?'selected':''}>${f.name}</option>`).join("")}
      </select>
    `;
  } else if (isFertilizers) {
    dynamicFilters = `
      <input id="rfrom" type="date" value="${reportFrom}" title="من تاريخ" style="width:auto" />
      <input id="rto" type="date" value="${reportTo}" title="إلى تاريخ" style="width:auto" />
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="rplot" style="width:auto"><option value="">كل القطع</option>${plots.map(p=>`<option value="${p.id}" ${reportPlot===p.id?"selected":""}>${p.name}</option>`)}</select>
      <select id="rf_user" style="width:auto">
        <option value="">👤 كل المستلمين والمسؤولين (مهندسين وعمال)</option>
        ${fieldUsers.map(u => `<option value="${u.id}" ${reportUser===u.id?'selected':''}>${u.name} (${roleLabel(u.role)})</option>`).join("")}
      </select>
      <select id="rf_fert" style="width:auto">
        <option value="">📦 كل الأسمدة والمبيدات</option>
        ${(st.fertilizers||[]).map(f => `<option value="${f.id}" ${reportFert===f.id?'selected':''}>${f.name}</option>`).join("")}
      </select>
      <select id="rf_action" style="width:auto">
        <option value="" ${!reportAction?'selected':''}>كل أنواع الحركات</option>
        <option value="issue" ${reportAction==='issue'?'selected':''}>📦 صرف عهدة للميدان</option>
        <option value="supply" ${reportAction==='supply'?'selected':''}>🚛 توريد جديد للمستودع</option>
        <option value="consumption" ${reportAction==='consumption'?'selected':''}>🌾 استهلاك حقلي مباشر</option>
      </select>
      <select id="rst" style="width:auto">
        <option value="">كل الحالات</option>
        <option value="approved" ${reportSt==="approved"?"selected":""}>✅ معتمدة / مستلمة</option>
        <option value="pending" ${reportSt==="pending"?"selected":""}>⏳ معلقة بالانتظار</option>
        <option value="rejected" ${reportSt==="rejected"?"selected":""}>❌ مرفوضة</option>
      </select>
    `;
  } else if (reportKind === "ops") {
    dynamicFilters = `
      <input id="rfrom" type="date" value="${reportFrom}" title="من تاريخ" style="width:auto" />
      <input id="rto" type="date" value="${reportTo}" title="إلى تاريخ" style="width:auto" />
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="rplot" style="width:auto"><option value="">كل القطع</option>${plots.map(p=>`<option value="${p.id}" ${reportPlot===p.id?"selected":""}>${p.name}</option>`)}</select>
      <select id="rf_op_type" style="width:auto">
        <option value="">كل أنواع العمليات</option>
        ${(st.operationTypes||[]).map(t => `<option value="${t.id}" ${reportOpType===t.id?'selected':''}>${t.name}</option>`).join("")}
      </select>
      <select id="rf_user" style="width:auto">
        <option value="">كل المنفذين (عمال)</option>
        ${(st.users||[]).filter(u => u.role === "worker").map(u => `<option value="${u.id}" ${reportUser===u.id?'selected':''}>${u.name}</option>`).join("")}
      </select>
      <select id="rst" style="width:auto"><option value="">كل الحالات</option>
        <option value="approved" ${reportSt==="approved"?"selected":""}>معتمدة</option>
        <option value="pending" ${reportSt==="pending"?"selected":""}>معلقة</option>
        <option value="rejected" ${reportSt==="rejected"?"selected":""}>مرفوضة</option>
      </select>
    `;
  } else if (isOffshootRev) {
    dynamicFilters = `
      <input id="rfrom" type="date" value="${reportFrom}" title="من تاريخ" style="width:auto" />
      <input id="rto" type="date" value="${reportTo}" title="إلى تاريخ" style="width:auto" />
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="rplot" style="width:auto"><option value="">كل القطع</option>${plots.map(p=>`<option value="${p.id}" ${reportPlot===p.id?"selected":""}>${p.name}</option>`)}</select>
      ${!isInv ? `
        <select id="rinv" style="width:auto">
          <option value="">كل المستثمرين</option>
          ${investors.map(u=>`<option value="${u.id}" ${reportInvestor===u.id?'selected':''}>${u.name}</option>`).join("")}
        </select>
      ` : ''}
      <select id="rst" style="width:auto"><option value="">كل الحالات</option>
        <option value="approved" ${reportSt==="approved"?"selected":""}>معتمدة</option>
        <option value="pending" ${reportSt==="pending"?"selected":""}>معلقة</option>
        <option value="rejected" ${reportSt==="rejected"?"selected":""}>مرفوضة</option>
      </select>
    `;
  } else if (reportKind === "offshoots") {
    dynamicFilters = `
      <input id="rfrom" type="date" value="${reportFrom}" title="من تاريخ التسجيل/القلع" style="width:auto" />
      <input id="rto" type="date" value="${reportTo}" title="إلى تاريخ" style="width:auto" />
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="rplot" style="width:auto"><option value="">كل القطع</option>${plots.map(p=>`<option value="${p.id}" ${reportPlot===p.id?"selected":""}>${p.name}</option>`)}</select>
      <select id="rf_ns_stage" style="width:auto">
        <option value="all" ${reportNsStage==='all'?'selected':''}>كل مراحل المشتل</option>
        <option value="in" ${reportNsStage==='in'?'selected':''}>📥 استلام / بالمشتل</option>
        <option value="prep" ${reportNsStage==='prep'?'selected':''}>🌱 تحت التجهيز والتجذير</option>
        <option value="ready" ${reportNsStage==='ready'?'selected':''}>✅ جاهزة للزراعة</option>
        <option value="issued" ${reportNsStage==='issued'?'selected':''}>🚜 صُرفت / زُرعت بالحقل</option>
      </select>
      <select id="rf_ns_source" style="width:auto">
        <option value="all" ${reportNsSource==='all'?'selected':''}>كل مصادر الإكثار</option>
        <option value="F" ${reportNsSource==='F'?'selected':''}>🌴 فسيلة حقلية</option>
        <option value="N" ${reportNsSource==='N'?'selected':''}>🧪 زراعة أنسجة</option>
        <option value="C" ${reportNsSource==='C'?'selected':''}>🌿 عقلة خضرية</option>
        <option value="S" ${reportNsSource==='S'?'selected':''}>🪴 شتلة مطعومة</option>
      </select>
      <select id="rst" style="width:auto">
        <option value="">كل الحالات الصحية</option>
        <option value="سليمة" ${reportSt==="سليمة"?"selected":""}>سليمة</option>
        <option value="مصابة" ${reportSt==="مصابة"?"selected":""}>مصابة / تحت العلاج</option>
      </select>
    `;
  } else if (reportKind === "yields") {
    const yieldCropVars = (reportCrop !== "all" 
      ? (st.cropVarieties || []).filter(v => v.cropId === reportCrop).map(v => v.name) 
      : (st.varieties || []));
    dynamicFilters = `
      <input id="rfrom" type="date" value="${reportFrom}" title="من تاريخ الحصاد" style="width:auto" />
      <input id="rto" type="date" value="${reportTo}" title="إلى تاريخ" style="width:auto" />
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="rplot" style="width:auto"><option value="">كل القطع</option>${plots.map(p=>`<option value="${p.id}" ${reportPlot===p.id?"selected":""}>${p.name}</option>`)}</select>
      <select id="rf_variety" style="width:auto">
        <option value="" ${!reportVariety?'selected':''}>كل الأصناف</option>
        ${yieldCropVars.map(v => `<option value="${v}" ${reportVariety===v?'selected':''}>${v}</option>`).join("")}
      </select>
      <select id="rf_yield_quality" style="width:auto">
        <option value="all" ${reportYieldQuality==='all'?'selected':''}>كل درجات الجودة</option>
        <option value="ممتاز" ${reportYieldQuality==='ممتاز'?'selected':''}>🌟 فرز أول (ممتاز)</option>
        <option value="جيد" ${reportYieldQuality==='جيد'?'selected':''}>👍 فرز ثانٍ (جيد)</option>
        <option value="صناعي" ${reportYieldQuality==='صناعي'?'selected':''}>🏭 فرز صناعي / تصنيع</option>
      </select>
    `;
  } else if (reportKind === "incidents") {
    dynamicFilters = `
      <input id="rfrom" type="date" value="${reportFrom}" title="من تاريخ" style="width:auto" />
      <input id="rto" type="date" value="${reportTo}" title="إلى تاريخ" style="width:auto" />
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="rplot" style="width:auto"><option value="">كل القطع</option>${plots.map(p=>`<option value="${p.id}" ${reportPlot===p.id?"selected":""}>${p.name}</option>`)}</select>
      <select id="rst" style="width:auto">
        <option value="">كل حالات المعالجة</option>
        <option value="approved" ${reportSt==="approved"?"selected":""}>✅ معتمدة / معالجة</option>
        <option value="pending" ${reportSt==="pending"?"selected":""}>⏳ بانتظار الفحص والمعالجة</option>
      </select>
    `;
  } else if (reportKind === "status") {
    dynamicFilters = `
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
      <select id="rplot" style="width:auto"><option value="">كل القطع</option>${plots.map(p=>`<option value="${p.id}" ${reportPlot===p.id?"selected":""}>${p.name}</option>`)}</select>
      <select id="rf_tree_st" style="width:auto">
        <option value="all" ${reportTreeSt==='all'?'selected':''}>كل حالات الأشجار</option>
        <option value="سليمة" ${reportTreeSt==='سليمة'?'selected':''}>✅ سليمة ومثمرة</option>
        <option value="مصابة" ${reportTreeSt==='مصابة'?'selected':''}>⚠️ مصابة / رعاية خاصة</option>
        <option value="علاج" ${reportTreeSt==='علاج'?'selected':''}>🩺 تحت بروتوكول العلاج</option>
        <option value="ميتة" ${reportTreeSt==='ميتة'?'selected':''}>❌ ميتة / يلزم استبدال</option>
      </select>
    `;
  } else if (reportKind === "sectors") {
    dynamicFilters = `
      <select id="rsec" style="width:auto"><option value="">كل القطاعات</option>${st.sectors.map(s=>`<option value="${s.id}" ${reportSec===s.id?"selected":""}>${s.name}</option>`)}</select>
    `;
  }

  // Selected User Specific Breakdown for Fertilizers
  const selUser = reportUser ? (st.users || []).find(u => u.id === reportUser) : null;
  let userHighlightBlock = "";
  if (isFertilizers && selUser) {
    const userReceived = rows.filter(r => r.whoId === reportUser && r.actionType === "صرف عهدة" && (r.statusKey === "received" || r.st.includes("مستلم"))).reduce((a,r) => a + (r.qty || 0), 0);
    const userPending = rows.filter(r => r.whoId === reportUser && r.actionType === "صرف عهدة" && (r.statusKey === "pending" || r.st.includes("معلق"))).reduce((a,r) => a + (r.qty || 0), 0);
    const userFieldConsumed = rows.filter(r => r.whoId === reportUser && r.actionType === "استهلاك").reduce((a,r) => a + (r.qty || 0), 0);
    const userVouchersCount = rows.filter(r => r.whoId === reportUser && r.actionType === "صرف عهدة").length;
    const userCustodyRem = Math.max(0, userReceived - userFieldConsumed);

    userHighlightBlock = `
      <div class="card" style="background:#F0F9FF;border:1.5px solid #0284C7;margin:12px 0;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <h4 style="margin:0;color:#0369A1">👤 كشف عهدة واستلامات المسؤول: <b>${selUser.name}</b> (${roleLabel(selUser.role)})</h4>
          <span class="chip" style="background:#E0F2FE;color:#0369A1;font-weight:700">عدد أذونات الصرف: ${userVouchersCount} إذن</span>
        </div>
        <div class="grid grid-4" style="margin-top:8px;gap:8px">
          <div class="card kpi kpi-compact" style="background:#fff"><div class="n" style="color:var(--green)">${userReceived.toLocaleString()}</div><div class="l">مستلم فعلياً بالموقع</div></div>
          <div class="card kpi kpi-compact" style="background:#fff"><div class="n" style="color:#D97706">${userPending.toLocaleString()}</div><div class="l">بانتظار تأكيد الاستلام (معلق)</div></div>
          <div class="card kpi kpi-compact" style="background:#fff"><div class="n" style="color:#2563EB">${userFieldConsumed.toLocaleString()}</div><div class="l">المستهلك والمطبق بالحقل</div></div>
          <div class="card kpi kpi-compact" style="background:#fff"><div class="n" style="color:#7C3AED">${userCustodyRem.toLocaleString()}</div><div class="l">الرصيد المتبقي بعهدته</div></div>
        </div>
      </div>
    `;
  }

  // Summary KPI Cards based on report kind
  let kpiCards = "";
  if (isFertBalances) {
    const totStock = rows.reduce((a,r) => a + (r.stock || 0), 0);
    const totAlloc = rows.reduce((a,r) => a + (r.allocated || 0), 0);
    const totCons = rows.reduce((a,r) => a + (r.consumed || 0), 0);
    const totVal = rows.reduce((a,r) => a + (r.value || 0), 0);
    const lowCount = rows.filter(r => r.isLow).length;
    kpiCards = `
      <div class="grid grid-4" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">إجمالي الأصناف بالمخزن</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${totStock.toLocaleString()}</div><div class="l">رصيد المستودع المتاح</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${totAlloc.toLocaleString()}</div><div class="l">المنصرف عهدة للموقع</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#2563EB">${totCons.toLocaleString()}</div><div class="l">المستهلك الفعلي بالحقل</div></div>
      </div>
      ${lowCount > 0 ? `
        <div class="card" style="margin-bottom:10px;padding:8px 12px;background:#FFFBEB;border:1px solid #FDE68A;color:#92400E;display:flex;align-items:center;gap:10px">
          <span style="font-size:18px">⚠️</span>
          <div style="font-size:12px"><b>تنبيه مخزون:</b> يوجد <b>${lowCount}</b> صنف قد بلغ أو نزل عن حد الأمان وإعادة الطلب.</div>
        </div>
      ` : ''}
    `;
  } else if (isFertilizers) {
    const totIssued = rows.filter(r => r.actionType === "صرف عهدة").reduce((a,r) => a + (r.qty || 0), 0);
    const totSupplied = rows.filter(r => r.actionType === "توريد").reduce((a,r) => a + (r.qty || 0), 0);
    const totConsumed = rows.filter(r => r.actionType === "استهلاك").reduce((a,r) => a + (r.qty || 0), 0);
    kpiCards = `
      <div class="grid grid-4" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">إجمالي الحركات والحالات</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${totSupplied.toLocaleString()}</div><div class="l">إجمالي الكميات المورّدة</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${totIssued.toLocaleString()}</div><div class="l">إجمالي المنصرف عهدة</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#2563EB">${totConsumed.toLocaleString()}</div><div class="l">إجمالي المستهلك بالحقل</div></div>
      </div>
      ${userHighlightBlock}
    `;
  } else if (isOffshootRev) {
    kpiCards = `
      <div class="grid grid-3" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">إجمالي الفسائل المقلوعة</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${money(totalRev)}</div><div class="l">إجمالي الإيراد التقديري (${st.settings.currency||"ج.م"})</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#C85A2E">${money(invRev)}</div><div class="l">نصيب المستثمرين (${st.settings.currency||"ج.م"})</div></div>
      </div>
      <div class="card" style="margin-bottom:10px;padding:8px 12px;font-size:12px;background:#F0FDF4;border:1px solid #BBF7D0">
        💡 <b>تحليل إيراد الفسائل:</b> متوسط سعر الفسيلة المقدر في هذه الفترة هو <b>${money(avgPrice)}</b>. يتم التوزيع حسب نخلة الأم المقلوعة منها والقطعة التابعة لكل مستثمر.
      </div>
    `;
  } else if (reportKind === "offshoots") {
    const readyN = rows.filter(r => r.stageKey === "ready").length;
    const prepN = rows.filter(r => r.stageKey === "prep").length;
    const inN = rows.filter(r => r.stageKey === "in" || r.stageKey === "stock").length;
    const issuedN = rows.filter(r => r.stageKey === "issued").length;
    kpiCards = `
      <div class="grid grid-4" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">إجمالي الفسائل بالسجل</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${readyN}</div><div class="l">جاهزة للصرف والزراعة</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${prepN}</div><div class="l">تحت التجهيز والتجذير</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#2563EB">${issuedN}</div><div class="l">صُرفت أو زُرعت بالحقل</div></div>
      </div>
    `;
  } else if (reportKind === "yields") {
    const totKg = rows.reduce((a,r) => a + (r.kg || 0), 0);
    const totTons = (totKg / 1000).toFixed(2);
    const premKg = rows.filter(r => (r.quality || "").includes("ممتاز")).reduce((a,r) => a + (r.kg || 0), 0);
    const premRate = totKg > 0 ? Math.round((premKg / totKg) * 100) : 0;
    kpiCards = `
      <div class="grid grid-3" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${totKg.toLocaleString()} كجم</div><div class="l">إجمالي المحصول (${totTons} طن)</div></div>
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">عدد لوطات ودفعات الحصاد</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${premRate}%</div><div class="l">نسبة الجودة الممتازة (${premKg.toLocaleString()} كجم)</div></div>
      </div>
    `;
  } else if (reportKind === "incidents") {
    const weevils = rows.filter(r => r.isWeevil).length;
    const solved = rows.filter(r => r.approvalKey === "approved").length;
    const waiting = rows.filter(r => r.approvalKey === "pending").length;
    kpiCards = `
      <div class="grid grid-4" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">إجمالي البلاغات والحالات</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#C62828">${weevils}</div><div class="l">🚨 إصابات سوسة النخيل</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${solved}</div><div class="l">✅ حالات معتمدة / معالجة</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${waiting}</div><div class="l">⏳ بانتظار الفحص والمعالجة</div></div>
      </div>
    `;
  } else if (reportKind === "status") {
    const healthy = rows.filter(r => (r.st || "").includes("سليمة")).length;
    const sick = rows.filter(r => (r.st || "").includes("مصابة") || (r.st || "").includes("علاج")).length;
    const dead = rows.filter(r => (r.st || "").includes("ميتة")).length;
    const healthPercent = rows.length > 0 ? Math.round((healthy / rows.length) * 100) : 100;
    kpiCards = `
      <div class="grid grid-4" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">إجمالي الأشجار والأصول</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${healthy}</div><div class="l">أصول سليمة (${healthPercent}%)</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${sick}</div><div class="l">تحت العلاج والمكافحة</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#C62828">${dead}</div><div class="l">أصول تالفة / يلزم استبدال</div></div>
      </div>
    `;
  } else if (reportKind === "sectors") {
    const secSet = new Set(rows.map(r => r.sector));
    const totPalms = rows.reduce((a,r) => a + (r.palmCount || 0), 0);
    const totAssets = rows.reduce((a,r) => a + (r.totalAssets || 0), 0);
    kpiCards = `
      <div class="grid grid-4" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${secSet.size}</div><div class="l">عدد القطاعات المحددة</div></div>
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">عدد القطع والأحواض</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${totPalms.toLocaleString()}</div><div class="l">إجمالي أشجار النخيل</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#2563EB">${totAssets.toLocaleString()}</div><div class="l">إجمالي الأصول بالمزارع</div></div>
      </div>
    `;
  } else {
    kpiCards = `
      <div class="grid grid-4" style="margin:8px 0;gap:8px">
        <div class="card kpi kpi-compact"><div class="n">${rows.length}</div><div class="l">إجمالي العمليات المنفذة</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:var(--green)">${approved}</div><div class="l">عمليات معتمدة ✅</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#D97706">${pending}</div><div class="l">بانتظار الاعتماد ⏳</div></div>
        <div class="card kpi kpi-compact"><div class="n" style="color:#C62828">${rows.filter(r=>r.st==='مرفوضة'||r.raw?.approval==='rejected').length}</div><div class="l">عمليات مرفوضة ❌</div></div>
      </div>
    `;
  }

  const chartTitle = isOffshootRev ? "الصنف" : (isFertBalances ? "تصنيف المركب" : (isFertilizers ? "نوع الحركة والمركب" : (reportKind === "offshoots" ? "مرحلة المشتل والصنف" : (reportKind === "yields" ? "المحصول والجودة" : (reportKind === "status" ? "الحالة الصحية للأشجار" : (reportKind === "sectors" ? "القطاع" : "نوع العملية / البلاغ"))))));

  // Yields Variety Breakdown Block
  let yieldsVarietyBlock = "";
  if (reportKind === "yields") {
    const varMap = {};
    rows.forEach(r => {
      const vName = r.variety || "عام / غير محدد";
      if (!varMap[vName]) {
        varMap[vName] = { name: vName, crop: r.crop, kg: 0, kgEx: 0, kgGd: 0, kgBad: 0, batches: 0 };
      }
      const y = r.raw || {};
      const w = Number(r.kg) || 0;
      varMap[vName].kg += w;
      varMap[vName].kgEx += (+y.kgEx || (r.quality === "ممتاز" ? w : 0) || 0);
      varMap[vName].kgGd += (+y.kgGd || (r.quality === "جيد" ? w : 0) || 0);
      varMap[vName].kgBad += (+y.kgBad || 0);
      varMap[vName].batches += 1;
    });
    const varList = Object.values(varMap).sort((a, b) => b.kg - a.kg);
    const totKgAll = varList.reduce((a, b) => a + b.kg, 0) || 1;
    const maxVarKg = Math.max(1, ...varList.map(v => v.kg));

    yieldsVarietyBlock = `
      <div class="card" style="background:#fff;border:1.5px solid var(--green);margin-bottom:14px;padding:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:10px">
          <div>
            <h3 style="margin:0;color:var(--green-d);font-size:15px">🌾 كشف تفصيلي بإنتاجية الأصناف (كم كيلو تم حصاده من كل صنف)</h3>
            <div class="muted" style="font-size:12px">إجمالي المحصول المفلتر: <b>${totKgAll.toLocaleString()} كجم</b> (${(totKgAll/1000).toFixed(2)} طن) موزعة على ${varList.length} أصناف</div>
          </div>
          <span class="chip" style="background:#e8f5e9;color:#1b5e20;font-weight:700">${varList.length} أصناف مسجلة</span>
        </div>

        <!-- Variety Breakdown Table -->
        <div class="grid-wrap" style="margin-bottom:12px"><table class="dense" style="width:100%">
          <thead>
            <tr style="background:#f9fafb">
              <th>الصنف الزراعي</th>
              <th>المحصول</th>
              <th style="color:var(--green-d)">الوزن الصافي (كجم)</th>
              <th>بالطن (طن)</th>
              <th>حصة الصنف من الإجمالي</th>
              <th style="color:#1b5e20">🌟 ممتاز (كجم)</th>
              <th style="color:#0d47a1">👍 جيد (كجم)</th>
              <th style="color:#e65100">🍂 تالف (كجم)</th>
              <th>عدد الشحنات</th>
            </tr>
          </thead>
          <tbody>
            ${varList.map(v => {
              const pctOfTot = Math.round(v.kg / totKgAll * 100);
              const tons = (v.kg / 1000).toFixed(2);
              return `<tr>
                <td style="font-weight:bold;font-size:13.5px;color:var(--text)">🌱 ${v.name}</td>
                <td>${v.crop}</td>
                <td style="font-weight:800;font-size:14px;color:var(--green-d)">${v.kg.toLocaleString()} كجم</td>
                <td style="font-weight:600">${tons} طن</td>
                <td>
                  <div style="display:flex;align-items:center;gap:6px">
                    <div style="flex:1;background:#e5e7eb;height:8px;border-radius:4px;overflow:hidden;min-width:60px">
                      <div style="background:var(--green);height:100%;width:${pctOfTot}%"></div>
                    </div>
                    <span style="font-weight:bold;font-size:11.5px">${pctOfTot}%</span>
                  </div>
                </td>
                <td style="color:#1b5e20;font-weight:bold">${v.kgEx.toLocaleString()}</td>
                <td style="color:#0d47a1;font-weight:bold">${v.kgGd.toLocaleString()}</td>
                <td style="color:#e65100;font-weight:bold">${v.kgBad.toLocaleString()}</td>
                <td><span class="chip" style="font-size:11px">${v.batches} شحنة</span></td>
              </tr>`;
            }).join("")}
          </tbody>
          <tfoot>
            <tr style="background:#f3f4f6;font-weight:bold">
              <td colspan="2" style="text-align:center">الإجمالي الكلي</td>
              <td style="color:var(--green-d);font-size:15px">${totKgAll.toLocaleString()} كجم</td>
              <td>${(totKgAll/1000).toFixed(2)} طن</td>
              <td>100%</td>
              <td style="color:#1b5e20">${varList.reduce((a,v)=>a+v.kgEx,0).toLocaleString()}</td>
              <td style="color:#0d47a1">${varList.reduce((a,v)=>a+v.kgGd,0).toLocaleString()}</td>
              <td style="color:#e65100">${varList.reduce((a,v)=>a+v.kgBad,0).toLocaleString()}</td>
              <td>${rows.length} شحنة</td>
            </tr>
          </tfoot>
        </table></div>

        <!-- Variety Visual Bar Breakdown -->
        <div style="margin-top:10px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);margin-bottom:6px">مقارنة أوزان الأصناف بيانياً:</div>
          ${varList.map(v => `
            <div class="bar-row" style="margin-bottom:4px">
              <div class="bar-lab" style="min-width:140px;font-size:12px"><b>${v.name}</b> (${v.crop})</div>
              <div class="bar-track" style="height:14px"><div class="bar-fill" style="width:${Math.round(v.kg/maxVarKg*100)}%;background:var(--green)"></div></div>
              <b style="min-width:90px;text-align:left;font-size:12.5px;color:var(--green-d)">${v.kg.toLocaleString()} كجم</b>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  return `<div class="page-head">
      <div><h3>${isWhMgr ? "تقارير حركة وجرد المستودع" : "مركز التقارير والتحليلات"}</h3><div class="muted">${company().companyName||""} • ${isInv ? `محفظة المستثمر (${session()?.name || ""})` : isWhMgr ? `إدارة المستودع والمخزون (${session()?.name || ""})` : "إدارة العمليات والمالية والمخازن"}</div></div>
      <div class="actions" style="margin:0">
        <button class="btn btn-primary icon-btn" data-act="export-rep">تصدير Excel/CSV</button>
        <button class="btn btn-ghost icon-btn" data-act="print-rep">PDF / طباعة رسمية</button>
      </div>
    </div>
    <div class="card filter-bar" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <select id="rkind" data-act="rkind">${kinds.map(([k,n])=>`<option value="${k}" ${reportKind===k?"selected":""}>${n}</option>`)}</select>
      <select id="rcrop">
        <option value="all" ${reportCrop==='all'?'selected':''}>🌐 كل المحاصيل</option>
        ${activeCrops.map(c=>`<option value="${c.id}" ${reportCrop===c.id?'selected':''}>${cropIcon(c.id, 14)} ${c.name}</option>`).join("")}
      </select>
      ${dynamicFilters}
      <button class="btn btn-primary icon-btn" data-act="apply-rep">تطبيق الفلترة</button>
    </div>

    ${kpiCards}

    ${yieldsVarietyBlock}

    ${crit?`<div class="card" style="background:#FFEBEE;margin-bottom:12px"><b>بلاغات حرجة / سوسة: ${crit}</b></div>`:""}
    
    <div class="card" style="margin-bottom:12px">
      <h3>توزيع البيانات حسب ${chartTitle} في الفترة</h3>
      ${Object.entries(counts).slice(0,8).map(([k,v])=>`<div class="bar-row"><div class="bar-lab">${k||"—"}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxC*100)}%"></div></div><b>${v}</b></div>`).join("")||"<div class='muted'>لا بيانات</div>"}
    </div>

    <div class="card">
      <div class="muted">${rows.length} سجل — صفحة ${reportPage}/${pages}</div>
      <div class="grid-wrap"><table class="dense" id="reptable">
        ${isFertBalances ? `
          <thead>
            <tr>
              <th>#</th>
              <th>كود الصنف</th>
              <th>اسم المركب / السماد</th>
              <th>المحصول</th>
              <th>التصنيف</th>
              <th>الوحدة</th>
              <th>رصيد المستودع</th>
              <th>عهدة الموقع</th>
              <th>المستهلك بالحقل</th>
              <th>الإجمالي الكلي</th>
              <th>حد الأمان</th>
              <th>حالة الرصيد</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td>${codeHtml(r.code)}</td>
            <td><b>${r.name}</b></td>
            <td>${r.crop}</td>
            <td><span class="status ${r.kind==='عضوي'?'st-ok':r.kind==='مبيد'?'st-bad':'st-sync'}">${r.kind}</span></td>
            <td>${r.unit}</td>
            <td><b style="color:${r.isLow?'#C62828':'var(--green-d)'}">${(r.stock||0).toLocaleString()}</b></td>
            <td><span style="color:#D97706;font-weight:700">${(r.allocated||0).toLocaleString()}</span></td>
            <td><span style="color:#2563EB">${(r.consumed||0).toLocaleString()}</span></td>
            <td><b>${(r.grandTotal||0).toLocaleString()}</b></td>
            <td class="muted">${(r.minAlert||0).toLocaleString()}</td>
            <td><span class="status ${r.isLow ? 'badge-warn' : 'badge-ok'}">${r.st}</span></td>
          </tr>`).join("")||"<tr><td colspan='12'>لا توجد أصناف مطابقة</td></tr>"}</tbody>
          <tfoot>
            <tr style="background:#F9F9F6;font-weight:bold">
              <td colspan="6" style="text-align:center">الإجمالي العام (${rows.length} صنف)</td>
              <td style="color:var(--green-d)">${rows.reduce((a,r)=>a+(r.stock||0),0).toLocaleString()}</td>
              <td style="color:#D97706">${rows.reduce((a,r)=>a+(r.allocated||0),0).toLocaleString()}</td>
              <td style="color:#2563EB">${rows.reduce((a,r)=>a+(r.consumed||0),0).toLocaleString()}</td>
              <td>${rows.reduce((a,r)=>a+(r.grandTotal||0),0).toLocaleString()}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        ` : isFertilizers ? `
          <thead>
            <tr>
              <th>#</th>
              <th>رقم الحركة / الكود</th>
              <th>التاريخ</th>
              <th>نوع الحركة</th>
              <th>المركب / السماد</th>
              <th>الكمية</th>
              <th>الوحدة</th>
              <th>الموقع / القطاع</th>
              <th>المستلم / المسؤول</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td>${codeHtml(r.code)}</td>
            <td>${r.date}</td>
            <td><span class="status ${r.actionType==='توريد'?'st-ok':r.actionType==='صرف عهدة'?'st-sync':'st-bad'}">${r.type}</span></td>
            <td><b>${r.material}</b></td>
            <td style="font-weight:700">${(r.qty||0).toLocaleString()}</td>
            <td>${r.unit}</td>
            <td>${r.loc}</td>
            <td><b>${r.who}</b></td>
            <td><span class="status ${r.statusKey==='received'||r.statusKey==='approved'?'badge-ok':r.statusKey==='rejected'?'badge-bad':'badge-warn'}">${r.st}</span></td>
          </tr>`).join("")||"<tr><td colspan='10'>لا حركات مسجلة في هذا النطاق</td></tr>"}</tbody>
          <tfoot>
            <tr style="background:#F9F9F6;font-weight:bold">
              <td colspan="5" style="text-align:center">إجمالي الكميات المسجلة</td>
              <td colspan="5" style="color:var(--green-d);font-size:14px">${rows.reduce((a,r)=>a+(r.qty||0),0).toLocaleString()}</td>
            </tr>
          </tfoot>
        ` : isOffshootRev ? `
          <thead>
            <tr>
              <th>#</th>
              <th>كود الفسيلة</th>
              <th>الأصل (الأم)</th>
              <th>الموقع (القطعة)</th>
              <th>المستثمر</th>
              <th>الصنف</th>
              <th>الوزن</th>
              <th>تاريخ القلع</th>
              <th>الحالة بالمشتل</th>
              <th>السعر التقديري</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td>${codeHtml(r.code)}</td>
            <td>${codeHtml(r.motherCode)}</td>
            <td>${r.loc}</td>
            <td><b>${r.who}</b></td>
            <td>${r.type}</td>
            <td>${r.weight}</td>
            <td>${r.date}</td>
            <td><span class="status badge-ok">${r.st}</span></td>
            <td style="color:var(--green);font-weight:700">${money(r.price)}</td>
          </tr>`).join("")||"<tr><td colspan='10'>لا بيانات مطابقة في هذا النطاق</td></tr>"}</tbody>
        ` : reportKind === "offshoots" ? `
          <thead>
            <tr>
              <th>#</th>
              <th>كود الفسيلة</th>
              <th>النخلة الأم</th>
              <th>الموقع</th>
              <th>الصنف</th>
              <th>مصدر الإكثار</th>
              <th>الوزن</th>
              <th>تاريخ التسجيل</th>
              <th>مرحلة المشتل</th>
              <th>الحالة الصحية</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td>${codeHtml(r.code)}</td>
            <td>${codeHtml(r.motherCode)}</td>
            <td>${r.loc}</td>
            <td><b>${r.type}</b></td>
            <td><span class="chip" style="font-size:11px">${r.source}</span></td>
            <td>${r.weight}</td>
            <td>${r.date}</td>
            <td><span class="status ${r.stageKey==='ready'?'st-ok':r.stageKey==='prep'?'st-wait':'st-sync'}">${r.stage}</span></td>
            <td><span class="status ${r.st==='سليمة'?'badge-ok':'badge-bad'}">${r.st}</span></td>
          </tr>`).join("")||"<tr><td colspan='10'>لا توجد فسائل مسجلة مطابقة</td></tr>"}</tbody>
        ` : reportKind === "yields" ? `
          <thead>
            <tr>
              <th>#</th>
              <th>رقم اللوط / الدفعة</th>
              <th>تاريخ الحصاد</th>
              <th>المحصول والصنف</th>
              <th>الموقع (القطاع/القطعة)</th>
              <th>الكمية (كجم)</th>
              <th>الصناديق</th>
              <th>درجة الجودة</th>
              <th>المسؤول</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td><b class="chip" style="font-size:12px">${r.code}</b></td>
            <td>${r.date}</td>
            <td>${r.type}</td>
            <td>${r.loc}</td>
            <td><b style="color:var(--green-d);font-size:13px">${(r.kg||0).toLocaleString()}</b></td>
            <td>${r.boxes}</td>
            <td><span class="status ${r.quality==='ممتاز'?'st-ok':r.quality==='جيد'?'st-sync':'st-wait'}">${r.quality}</span></td>
            <td>${r.who}</td>
            <td class="muted">${r.notes}</td>
          </tr>`).join("")||"<tr><td colspan='10'>لا توجد دفعات حصاد في هذا النطاق</td></tr>"}</tbody>
          <tfoot>
            <tr style="background:#F9F9F6;font-weight:bold">
              <td colspan="5" style="text-align:center">إجمالي إنتاج الحصاد المسجل</td>
              <td colspan="5" style="color:var(--green-d);font-size:14px">${rows.reduce((a,r)=>a+(r.kg||0),0).toLocaleString()} كجم (${(rows.reduce((a,r)=>a+(r.kg||0),0)/1000).toFixed(2)} طن)</td>
            </tr>
          </tfoot>
        ` : reportKind === "incidents" ? `
          <thead>
            <tr>
              <th>#</th>
              <th>كود الأصل / النخلة</th>
              <th>الموقع</th>
              <th>نوع البلاغ / الإصابة</th>
              <th>تاريخ الرصد</th>
              <th>القائم بالرصد</th>
              <th>حالة المعالجة</th>
              <th>توجيه المشرف</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td>${codeHtml(r.code)}</td>
            <td>${r.loc}</td>
            <td><b>${r.type}</b></td>
            <td>${r.date}</td>
            <td>${r.who}</td>
            <td><span class="status ${r.approvalKey==='approved'?'badge-ok':'badge-warn'}">${r.st}</span></td>
            <td style="color:${r.supervisorNote!=='—'?'#B45309':'inherit'}">${r.supervisorNote}</td>
          </tr>`).join("")||"<tr><td colspan='8'>لا توجد بلاغات أو حالات عارضة في هذا النطاق</td></tr>"}</tbody>
        ` : reportKind === "status" ? `
          <thead>
            <tr>
              <th>#</th>
              <th>كود الشجرة</th>
              <th>المحصول</th>
              <th>الصنف</th>
              <th>القطاع</th>
              <th>القطعة</th>
              <th>تاريخ الزراعة</th>
              <th>الحالة الصحية</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td>${codeHtml(r.code)}</td>
            <td>${r.crop}</td>
            <td><b>${r.variety}</b></td>
            <td>${r.sector}</td>
            <td>${r.plotName}</td>
            <td>${r.date}</td>
            <td><span class="status ${r.st==='سليمة'?'badge-ok':r.st==='ميتة'?'badge-bad':'badge-warn'}">${r.st}</span></td>
            <td class="muted">${r.notes}</td>
          </tr>`).join("")||"<tr><td colspan='9'>لا توجد أشجار مسجلة في هذا النطاق</td></tr>"}</tbody>
        ` : reportKind === "sectors" ? `
          <thead>
            <tr>
              <th>#</th>
              <th>كود القطعة</th>
              <th>اسم القطعة</th>
              <th>القطاع</th>
              <th>المساحة (فدان)</th>
              <th>أشجار النخيل</th>
              <th>الزيتون / أخرى</th>
              <th>إجمالي الأصول</th>
              <th>شبكة الري</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td><b>${r.code}</b></td>
            <td><b>${r.name}</b></td>
            <td>${r.sector}</td>
            <td>${r.area}</td>
            <td style="color:var(--green-d);font-weight:bold">${r.palmCount}</td>
            <td style="color:#2563EB;font-weight:bold">${r.oliveCount}</td>
            <td><b class="chip" style="font-size:12px">${r.totalAssets}</b></td>
            <td class="muted">${r.irrigation}</td>
          </tr>`).join("")||"<tr><td colspan='9'>لا توجد قطع مسجلة</td></tr>"}</tbody>
        ` : `
          <thead>
            <tr>
              <th>#</th>
              <th>كود النخلة</th>
              <th>نوع العملية المنفذة</th>
              <th>الموقع (القطاع/القطعة)</th>
              <th>العامل المنفذ</th>
              <th>تاريخ التنفيذ</th>
              <th>حالة الاعتماد</th>
              <th>توجيه المشرف</th>
            </tr>
          </thead>
          <tbody>${slice.map((r,i)=>`<tr>
            <td>${(reportPage-1)*50+i+1}</td>
            <td>${codeHtml(r.code)}</td>
            <td><b>${r.type}</b></td>
            <td>${r.loc}</td>
            <td>${r.who}</td>
            <td>${r.date}</td>
            <td><span class="status ${r.st==='معتمدة'?'badge-ok':r.st==='مرفوضة'?'badge-bad':'badge-warn'}">${r.st}</span></td>
            <td style="color:${r.supervisorNote!=='—'?'#B45309':'inherit'}">${r.supervisorNote}</td>
          </tr>`).join("")||"<tr><td colspan='8'>لا توجد عمليات مسجلة في هذا النطاق</td></tr>"}</tbody>
        `}
      </table></div>
      <div class="pager">
        <button class="btn btn-ghost icon-btn" data-act="rep-page" data-id="${Math.max(1,reportPage-1)}">السابق</button>
        <span>${reportPage} / ${pages}</span>
        <button class="btn btn-ghost icon-btn" data-act="rep-page" data-id="${Math.min(pages,reportPage+1)}">التالي</button>
      </div>
    </div>`;
}

