// Routes: Field operations, approvals, tree notes, operation types
const db = require('../db');
const { uuidv7 } = require('../uuidv7');
const { ApprovalStatus, SyncStatus } = require('../enums');
const { sendJson, parseBody } = require('../lib/http');
const { resolvePalmId, resolveTypeId, resolveWorkerId, cropCodeResolver } = require('../lib/helpers');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function operationsRoutes(req, res, { method, pathname, url }) {
  // 6. Operations API
  if (pathname === '/api/operations') {
    if (method === 'GET') {
      const ops = db.all('SELECT * FROM v_operations ORDER BY performed_at DESC');
      return sendJson(res, 200, ops);
    }
    if (method === 'POST') {
      const op = await parseBody(req);
      const opId = op.id || uuidv7();
      const approvalId = op.approvalId || op.approval_id || ApprovalStatus.fromCode(op.approval || op.approval_status || 'pending');
      const statusId = op.statusId || op.status_id || SyncStatus.SYNCED;
      const sessionUser = req.headers['x-user-id'] || op.workerId || op.worker_id || 'system';
      const nowTime = new Date().toISOString();

      const palmId = (op.targetLevel === 'sector' || op.targetLevel === 'plot' || (!op.palmId && !op.palmCode)) ? null : resolvePalmId(op);
      const typeId = resolveTypeId(op);
      const workerId = resolveWorkerId(op);
      const batchId = op.batchId || op.batch_id || op.bulkId || null;
      const targetLevel = op.targetLevel || op.target_level || 'tree';
      const sectorId = op.sectorId || op.sector_id || null;
      const plotId = op.plotId || op.plot_id || null;
      const treeCount = Number(op.treeCount || op.tree_count || 1);

      db.run(
        `INSERT INTO operations (id, palm_id, type_id, worker_id, performed_at, status_id, approval_id, worker_notes, supervisor_notes, photos, batch_id, target_level, sector_id, plot_id, tree_count, created_at, modified_by, modified_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           status_id = excluded.status_id,
           approval_id = excluded.approval_id,
           worker_notes = excluded.worker_notes,
           supervisor_notes = excluded.supervisor_notes,
           batch_id = excluded.batch_id,
           target_level = excluded.target_level,
           sector_id = excluded.sector_id,
           plot_id = excluded.plot_id,
           tree_count = excluded.tree_count,
           modified_by = excluded.modified_by,
           modified_at = excluded.modified_at`,
        opId, palmId, typeId, workerId, op.at || nowTime, statusId, approvalId, op.notes || '', op.supervisorNote || '', JSON.stringify(op.photos || []),
        batchId, targetLevel, sectorId, plotId, treeCount, nowTime, sessionUser, nowTime
      );

      if (palmId) {
        const notesStr = String(op.notes || '');
        const isNegatedHealthy = notesStr.includes('غير سليم') || notesStr.includes('ليست سليم') || notesStr.includes('غير معاف') || notesStr.includes('مشتبه');
        if (notesStr.includes('إصابة مؤكدة') || notesStr.includes('إصابة سوسة') || typeId === 'op8' || op.health === 'مصابة' || op.treeHealth === 'مصابة' || op.statusCode === 'infected') {
          db.run('UPDATE palms SET status_id = 3, modified_by = ?, modified_at = ? WHERE id = ?', sessionUser, nowTime, palmId);
        } else if (notesStr.includes('اشتباه') || notesStr.includes('تحت المراقبة') || op.health === 'تحت المراقبة' || op.treeHealth === 'تحت المراقبة' || op.statusCode === 'observation') {
          db.run('UPDATE palms SET status_id = 2, modified_by = ?, modified_at = ? WHERE id = ?', sessionUser, nowTime, palmId);
        } else if (!isNegatedHealthy && (op.health === 'سليمة' || op.treeHealth === 'سليمة' || op.statusCode === 'healthy' || notesStr.includes('تم الشفاء') || notesStr.includes('تمت المعالجة والتعافي') || notesStr.includes('خلو تام من الإصابة'))) {
          db.run('UPDATE palms SET status_id = 1, modified_by = ?, modified_at = ? WHERE id = ?', sessionUser, nowTime, palmId);
        }
      }

      return sendJson(res, 201, { success: true, id: opId, message: 'تم تسجيل العملية في قاعدة البيانات' });
    }
  }

  // 6.1 Operations Actions (Batch Approve / Batch Reject / Single Approve / Reject / Update)
  if (pathname === '/api/operations/batch/approve' || pathname === '/api/operations/batch-approve') {
    if (method === 'POST') {
      const body = await parseBody(req);
      const { batchId, ids, supervisorNotes } = body;
      const notes = supervisorNotes || body.supervisorNote || null;
      let count = 0;
      if (batchId) {
        const runRes = db.run(
          `UPDATE operations SET 
             approval_id = ?, 
             supervisor_notes = COALESCE(?, supervisor_notes) 
           WHERE batch_id = ? OR device_info = 'bulk:' || ? OR id = ?`,
          ApprovalStatus.APPROVED, notes, batchId, batchId, batchId
        );
        count = runRes?.changes || 0;
      } else if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const runRes = db.run(
          `UPDATE operations SET 
             approval_id = ?, 
             supervisor_notes = COALESCE(?, supervisor_notes) 
           WHERE id IN (${placeholders})`,
          ApprovalStatus.APPROVED, notes, ...ids
        );
        count = runRes?.changes || 0;
      }
      return sendJson(res, 200, { success: true, affected: count, message: `تم اعتماد ${count} عملية بنجاح` });
    }
  }

  if (pathname === '/api/operations/batch/reject' || pathname === '/api/operations/batch-reject') {
    if (method === 'POST') {
      const body = await parseBody(req);
      const { batchId, ids, supervisorNotes, actionType, action } = body;
      const notes = supervisorNotes || body.supervisorNote || null;
      const targetApproval = ApprovalStatus.fromCode(actionType || action || 'rejected');
      let count = 0;
      if (batchId) {
        const runRes = db.run(
          `UPDATE operations SET 
             approval_id = ?, 
             supervisor_notes = COALESCE(?, supervisor_notes) 
           WHERE batch_id = ? OR device_info = 'bulk:' || ? OR id = ?`,
          targetApproval, notes, batchId, batchId, batchId
        );
        count = runRes?.changes || 0;
      } else if (Array.isArray(ids) && ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',');
        const runRes = db.run(
          `UPDATE operations SET 
             approval_id = ?, 
             supervisor_notes = COALESCE(?, supervisor_notes) 
           WHERE id IN (${placeholders})`,
          targetApproval, notes, ...ids
        );
        count = runRes?.changes || 0;
      }
      return sendJson(res, 200, { success: true, affected: count, message: `تم معالجة ${count} عملية بنجاح` });
    }
  }

  // 6.2 Single Operation Custom Actions (Approve / Reject / Rework / Void)
  if (pathname.startsWith('/api/operations/') && pathname.endsWith('/approve')) {
    const opId = decodeURIComponent(pathname.replace('/api/operations/', '').replace('/approve', ''));
    if (method === 'POST') {
      const body = await parseBody(req);
      const supervisorNotes = body.supervisorNotes || body.supervisorNote || body.notes || null;
      const approver = req.headers['x-user-id'] || 'admin';
      const nowTime = new Date().toISOString();
      const exists = db.get('SELECT * FROM operations WHERE id = ?', opId);
      if (!exists) return sendJson(res, 404, { error: 'العملية غير موجودة' });

      db.run(
        'UPDATE operations SET approval_id = ?, approved_by = ?, supervisor_notes = COALESCE(?, supervisor_notes), modified_by = ?, modified_at = ? WHERE id = ?',
        ApprovalStatus.APPROVED, approver, supervisorNotes, approver, nowTime, opId
      );

      if (exists.palm_id) {
        const n = String(exists.worker_notes || '');
        const isNegatedHealthy = n.includes('غير سليم') || n.includes('ليست سليم') || n.includes('غير معاف') || n.includes('مشتبه');
        if (n.includes('إصابة مؤكدة') || n.includes('إصابة سوسة') || exists.type_id === 'op8') {
          db.run('UPDATE palms SET status_id = 3, modified_by = ?, modified_at = ? WHERE id = ?', approver, nowTime, exists.palm_id);
        } else if (n.includes('اشتباه') || n.includes('تحت المراقبة')) {
          db.run('UPDATE palms SET status_id = 2, modified_by = ?, modified_at = ? WHERE id = ?', approver, nowTime, exists.palm_id);
        } else if (!isNegatedHealthy && (n.includes('تم الشفاء') || n.includes('تمت المعالجة والتعافي') || n.includes('خلو تام من الإصابة'))) {
          db.run('UPDATE palms SET status_id = 1, modified_by = ?, modified_at = ? WHERE id = ?', approver, nowTime, exists.palm_id);
        }
      }

      return sendJson(res, 200, { success: true, message: 'تم اعتماد العملية الزراعية بنجاح' });
    }
  }

  const rejectMatch = pathname.match(/^\/api\/operations\/([^/]+)\/reject$/);
  if (rejectMatch && method === 'POST') {
    const opId = decodeURIComponent(rejectMatch[1]);
    const body = await parseBody(req);
    const supervisorNotes = body.supervisorNotes || body.supervisorNote || body.notes || null;
    const targetApproval = ApprovalStatus.fromCode(body.actionType || body.action || body.approval || 'rejected');
    const exists = db.get('SELECT id FROM operations WHERE id = ?', opId);
    if (!exists) return sendJson(res, 404, { error: 'العملية غير موجودة' });

    db.run(
      'UPDATE operations SET approval_id = ?, supervisor_notes = COALESCE(?, supervisor_notes) WHERE id = ?',
      targetApproval, supervisorNotes, opId
    );
    return sendJson(res, 200, { success: true, message: 'تم معالجة وتحديث حالة العملية الزراعية بنجاح' });
  }

  if (pathname.startsWith('/api/operations/')) {
    if (method === 'PUT') {
      const opId = decodeURIComponent(pathname.replace('/api/operations/', ''));
      const body = await parseBody(req);
      const exists = db.get('SELECT id FROM operations WHERE id = ?', opId);
      if (!exists) return sendJson(res, 404, { error: 'العملية غير موجودة' });

      const approvalId = body.approval ? ApprovalStatus.fromCode(body.approval) : (body.approvalId || null);
      const statusId = body.status ? SyncStatus.fromCode(body.status) : (body.statusId || null);
      const supervisorNotes = body.supervisorNotes || body.supervisorNote || null;
      const workerNotes = body.notes || body.worker_notes || null;

      db.run(
        `UPDATE operations SET 
           approval_id = COALESCE(?, approval_id),
           status_id = COALESCE(?, status_id),
           supervisor_notes = COALESCE(?, supervisor_notes),
           worker_notes = COALESCE(?, worker_notes)
         WHERE id = ?`,
        approvalId, statusId, supervisorNotes, workerNotes, opId
      );
      return sendJson(res, 200, { success: true, message: 'تم تحديث بيانات العملية' });
    }
  }

  // 6.2 Tree Notes & Field Observations API
  if (pathname === '/api/tree-notes' || pathname.startsWith('/api/tree-notes/')) {
    if (pathname === '/api/tree-notes' && method === 'GET') {
      const notes = db.all(`
        SELECT 
          tn.id, tn.palm_id as palmId, tn.palm_code as palmCode,
          tn.author_id as authorId, tn.author_id as createdBy, tn.author_name as authorName,
          u.role as authorRole,
          tn.note_type as noteType, tn.note_type as title, tn.priority,
          tn.content, tn.content as notes, tn.attachments,
          tn.visibility_scope as visibilityScope,
          CASE WHEN tn.visibility_scope = 'individual' THEN 'INDIVIDUAL' ELSE 'ALL_TEAM' END as targetType,
          tn.assigned_to_user_id as assignedToUserId, tn.assigned_to_user_id as assignedTo,
          tn.assigned_to_user_name as assignedToUserName,
          tn.status, tn.execution_notes as executionNotes, tn.execution_proof_photo as executionProofPhoto,
          tn.execution_proof_photo as completionPhoto,
          tn.executed_at as executedAt, tn.executed_at as completedAt,
          tn.executed_by_id as completedBy,
          tn.closed_at as closedAt, tn.closed_by_id as closedBy,
          tn.created_at as createdAt, tn.updated_at as updatedAt
        FROM tree_notes tn
        LEFT JOIN users u ON tn.author_id = u.id
        ORDER BY tn.created_at DESC
      `);
      return sendJson(res, 200, notes);
    }

    if (pathname === '/api/tree-notes' && method === 'POST') {
      const b = await parseBody(req);
      const id = b.id || `tn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const palmId = b.palmId ? resolvePalmId(b) : null;
      const palmCode = b.palmCode || (palmId ? db.get('SELECT code FROM palms WHERE id = ?', palmId)?.code : null) || '';
      
      // Resolve author dynamically from request body or headers
      const authorId = b.createdBy || b.authorId || b.created_by || b.author_id || b.userId || req.headers['x-user-id'] || 'u1';
      const authorUser = db.get('SELECT id, full_name, username, role FROM users WHERE id = ?', authorId);
      const authorName = b.authorName || b.author_name || authorUser?.full_name || authorUser?.username || 'مستخدم';
      
      const noteType = b.title || b.noteType || b.note_type || 'general';
      const priority = b.priority || 'normal';
      const content = b.notes || b.content || (b.title ? `${b.title}` : '');
      const attachments = JSON.stringify(b.attachments || (b.photos ? b.photos : []));
      
      const targetType = (b.targetType || b.target_type || b.visibilityScope || b.visibility_scope || (b.assignedTo || b.assignedToUserId ? 'INDIVIDUAL' : 'ALL_TEAM')).toUpperCase();
      const visibilityScope = targetType === 'INDIVIDUAL' ? 'individual' : 'all_team';
      
      const assignedToUserId = b.assignedTo || b.assigned_to || b.assignedToUserId || b.assigned_to_user_id || null;
      let assignedToUserName = b.assignedToUserName || b.assigned_to_user_name || null;
      if (assignedToUserId && !assignedToUserName) {
        assignedToUserName = db.get('SELECT full_name, username FROM users WHERE id = ?', assignedToUserId)?.full_name || '';
      }
      const status = b.status || 'pending';

      db.run(
        `INSERT INTO tree_notes (
           id, palm_id, palm_code, author_id, author_name, note_type, priority,
           content, attachments, visibility_scope, assigned_to_user_id, assigned_to_user_name, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        id, palmId, palmCode, authorId, authorName, noteType, priority,
        content, attachments, visibilityScope, assignedToUserId, assignedToUserName, status
      );

      return sendJson(res, 201, { success: true, id, message: 'تم حفظ الملاحظة / التكليف الميداني بنجاح' });
    }

    const completeMatch = pathname.match(/^\/api\/tree-notes\/([^/]+)\/complete$/);
    if (completeMatch && method === 'POST') {
      const noteId = decodeURIComponent(completeMatch[1]);
      const b = await parseBody(req);
      const notes = b.executionNotes || b.notes || '';
      const proofPhoto = b.executionProofPhoto || b.proofPhoto || b.photo || '';
      const executedBy = b.completedBy || b.executedById || b.userId || req.headers['x-user-id'] || null;
      db.run(
        `UPDATE tree_notes SET 
           status = 'completed',
           execution_notes = ?,
           execution_proof_photo = ?,
           executed_by_id = COALESCE(?, executed_by_id),
           executed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        notes, proofPhoto, executedBy, noteId
      );
      return sendJson(res, 200, { success: true, message: 'تم توثيق وإتمام التكليف بنجاح' });
    }

    const closeMatch = pathname.match(/^\/api\/tree-notes\/([^/]+)\/close$/);
    if (closeMatch && method === 'POST') {
      const noteId = decodeURIComponent(closeMatch[1]);
      const b = await parseBody(req);
      const closedBy = b.closedBy || b.closedById || b.userId || req.headers['x-user-id'] || null;
      db.run(
        `UPDATE tree_notes SET 
           status = 'closed',
           closed_by_id = COALESCE(?, closed_by_id),
           closed_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        closedBy, noteId
      );
      return sendJson(res, 200, { success: true, message: 'تم اعتماد وإغلاق الملاحظة الميدانية' });
    }

    const startMatch = pathname.match(/^\/api\/tree-notes\/([^/]+)\/start$/);
    if (startMatch && method === 'POST') {
      const noteId = decodeURIComponent(startMatch[1]);
      db.run(
        `UPDATE tree_notes SET 
           status = 'in_progress',
           updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        noteId
      );
      return sendJson(res, 200, { success: true, message: 'تم بدء تنفيذ التكليف' });
    }
  }

  // 6.3 Operation Types Settings API
  if (pathname === '/api/operation-types' || pathname.startsWith('/api/operation-types/')) {
    if (method === 'GET') {
      const types = db.all('SELECT id, category_id as categoryId, name, crop_id as cropId, requires_material as requiresMaterial, allowed_kinds as allowedKinds, scope_type as scopeType, is_critical as isCritical, requires_approval as requiresApproval, active FROM operation_types ORDER BY id ASC');
      const toCropCode = cropCodeResolver();
      types.forEach(ot => {
        ot.cropId = toCropCode(ot.cropId);
      });
      return sendJson(res, 200, types);
    }
    if (method === 'POST') {
      const b = await parseBody(req);
      const id = b.id || `op_${Date.now()}`;
      const catId = b.categoryId || b.category_id || b.catId || 'c_f';
      const name = b.name || id;
      const cropId = b.cropId || b.crop_id || 'all';
      const requiresMaterial = (b.requiresMaterial || b.requires_material) ? 1 : 0;
      const allowedKinds = Array.isArray(b.allowedKinds) ? JSON.stringify(b.allowedKinds) : (typeof b.allowedKinds === 'string' ? b.allowedKinds : '[]');
      const scopeType = b.scopeType || b.scope_type || 'both';
      const isCritical = (b.isCritical || b.is_critical) ? 1 : 0;
      const requiresApproval = b.requiresApproval !== undefined ? (b.requiresApproval ? 1 : 0) : 1;
      const active = b.active !== undefined ? (b.active ? 1 : 0) : (b.inactive ? 0 : 1);
      db.run(
        `INSERT INTO operation_types (id, category_id, name, crop_id, requires_material, allowed_kinds, scope_type, is_critical, requires_approval, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           category_id = excluded.category_id,
           name = excluded.name,
           crop_id = excluded.crop_id,
           requires_material = excluded.requires_material,
           allowed_kinds = excluded.allowed_kinds,
           scope_type = excluded.scope_type,
           is_critical = excluded.is_critical,
           requires_approval = excluded.requires_approval,
           active = excluded.active`,
        id, catId, name, cropId, requiresMaterial, allowedKinds, scopeType, isCritical, requiresApproval, active
      );
      return sendJson(res, 200, { success: true, id, message: 'تم حفظ نوع العملية بنجاح' });
    }
  }

  return NEXT;
};
