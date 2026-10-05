/**
 * Enterprise Enum Dictionaries & Lookup Constants
 * خريطة الثوابت المعيارية لتخزين الأرقام (SMALLINT / INTEGER) في قاعدة البيانات
 * مع الحفاظ على الأكواد والترجمات العربية والإنجليزية والشارات الملونة.
 */

const TreeHealthStatus = Object.freeze({
  HEALTHY: 1,
  OBSERVATION: 2,
  INFECTED: 3,
  UPROOTED: 4,
  DEAD: 5,
  list: [
    { id: 1, code: 'healthy', labelAr: 'سليمة', labelEn: 'Healthy', badgeColor: '#16A34A', badgeBg: '#DCFCE7', requiresAlert: 0 },
    { id: 2, code: 'observation', labelAr: 'تحت المراقبة', labelEn: 'Under Observation', badgeColor: '#D97706', badgeBg: '#FEF3C7', requiresAlert: 1 },
    { id: 3, code: 'infected', labelAr: 'مصابة', labelEn: 'Infected', badgeColor: '#DC2626', badgeBg: '#FEE2E2', requiresAlert: 1 },
    { id: 4, code: 'uprooted', labelAr: 'مقلوعة', labelEn: 'Uprooted', badgeColor: '#64748B', badgeBg: '#F1F5F9', requiresAlert: 0 },
    { id: 5, code: 'dead', labelAr: 'ميتة', labelEn: 'Dead', badgeColor: '#0F172A', badgeBg: '#E2E8F0', requiresAlert: 0 }
  ],
  fromCode(code) {
    if (!code) return this.HEALTHY;
    const s = String(code).trim().toLowerCase();
    const found = this.list.find(item => 
      item.code === s || 
      item.labelAr === code || 
      item.labelEn.toLowerCase() === s ||
      (s.includes("مراقب") && item.code === "observation") ||
      (s.includes("سوس") && item.code === "infected") ||
      (s.includes("مصاب") && item.code === "infected") ||
      (s.includes("ميت") && item.code === "dead") ||
      (s.includes("سليم") && item.code === "healthy") ||
      (s.includes("مقلوع") && item.code === "uprooted")
    );
    return found ? found.id : this.HEALTHY;
  },
  fromId(id) {
    return this.list.find(item => item.id === Number(id)) || this.list[0];
  }
});

const ApprovalStatus = Object.freeze({
  PENDING: 1,
  APPROVED: 2,
  REJECTED: 3,
  NEEDS_REWORK: 4,
  VOIDED: 5,
  list: [
    { id: 1, code: 'pending', labelAr: 'قيد الاعتماد', labelEn: 'Pending Review', badgeColor: '#D97706', badgeBg: '#FEF3C7' },
    { id: 2, code: 'approved', labelAr: 'معتمد', labelEn: 'Approved', badgeColor: '#16A34A', badgeBg: '#DCFCE7' },
    { id: 3, code: 'rejected', labelAr: 'مرفوض', labelEn: 'Rejected', badgeColor: '#DC2626', badgeBg: '#FEE2E2' },
    { id: 4, code: 'needs_rework', labelAr: 'مطلوب إعادة التنفيذ', labelEn: 'Needs Rework', badgeColor: '#C2410C', badgeBg: '#FFEDD5' },
    { id: 5, code: 'voided', labelAr: 'ملغاة ومغلقة', labelEn: 'Voided & Closed', badgeColor: '#64748B', badgeBg: '#F1F5F9' }
  ],
  fromCode(code) {
    const c = String(code).toLowerCase();
    if (c === 'approved') return this.APPROVED;
    if (c === 'rejected') return this.REJECTED;
    if (c === 'needs_rework' || c === 'rework') return this.NEEDS_REWORK;
    if (c === 'voided' || c === 'closed') return this.VOIDED;
    return this.PENDING;
  },
  fromId(id) {
    return this.list.find(item => item.id === Number(id)) || this.list[0];
  }
});

const SyncStatus = Object.freeze({
  DRAFT: 1,
  PENDING_SYNC: 2,
  SYNCED: 3,
  list: [
    { id: 1, code: 'draft', labelAr: 'مسودة محلية', labelEn: 'Draft', badgeColor: '#64748B', badgeBg: '#F1F5F9' },
    { id: 2, code: 'pending_sync', labelAr: 'قيد المزامنة', labelEn: 'Pending Sync', badgeColor: '#D97706', badgeBg: '#FEF3C7' },
    { id: 3, code: 'synced', labelAr: 'تمت المزامنة', labelEn: 'Synced', badgeColor: '#16A34A', badgeBg: '#DCFCE7' }
  ],
  fromCode(code) {
    const c = String(code).toLowerCase();
    if (c === 'draft') return this.DRAFT;
    if (c === 'pending' || c === 'pending_sync') return this.PENDING_SYNC;
    return this.SYNCED;
  },
  fromId(id) {
    return this.list.find(item => item.id === Number(id)) || this.list[2];
  }
});

const YieldQualityGrade = Object.freeze({
  GRADE_A: 1,
  GRADE_B: 2,
  GRADE_C: 3,
  list: [
    { id: 1, code: 'grade_a', labelAr: 'ممتاز / نخب أول', labelEn: 'Grade A / Premium', badgeColor: '#16A34A', badgeBg: '#DCFCE7' },
    { id: 2, code: 'grade_b', labelAr: 'جيد / نخب ثانٍ', labelEn: 'Grade B', badgeColor: '#2563EB', badgeBg: '#DBEAFE' },
    { id: 3, code: 'grade_c', labelAr: 'تالف / فرز', labelEn: 'Cull / Low Grade', badgeColor: '#D97706', badgeBg: '#FEF3C7' }
  ],
  fromCode(code) {
    const c = String(code).toLowerCase();
    if (c.includes('جيد') || c === 'grade_b') return this.GRADE_B;
    if (c.includes('تالف') || c.includes('فرز') || c === 'grade_c') return this.GRADE_C;
    return this.GRADE_A;
  },
  fromId(id) {
    return this.list.find(item => item.id === Number(id)) || this.list[0];
  }
});

const TreeOriginType = Object.freeze({
  INTERNAL: 1,
  PURCHASED: 2,
  TISSUE_CULTURE: 3,
  OFFSHOOT: 4,
  list: [
    { id: 1, code: 'internal', labelAr: 'داخلي / ترقيد بالمزرعة', labelEn: 'Internal Farm' },
    { id: 2, code: 'purchased', labelAr: 'شراء خارجي', labelEn: 'Purchased External' },
    { id: 3, code: 'tissue_culture', labelAr: 'زراعة أنسجة', labelEn: 'Tissue Culture' },
    { id: 4, code: 'offshoot', labelAr: 'فسيلة أرضية/هوائية', labelEn: 'Offshoot' }
  ],
  fromCode(code) {
    const c = String(code).toLowerCase();
    if (c.includes('شراء') || c === 'purchased') return this.PURCHASED;
    if (c.includes('أنسجة') || c === 'tissue_culture') return this.TISSUE_CULTURE;
    if (c.includes('فسيلة') || c === 'offshoot') return this.OFFSHOOT;
    return this.INTERNAL;
  },
  fromId(id) {
    return this.list.find(item => item.id === Number(id)) || this.list[0];
  }
});

module.exports = {
  TreeHealthStatus,
  ApprovalStatus,
  SyncStatus,
  YieldQualityGrade,
  TreeOriginType
};

