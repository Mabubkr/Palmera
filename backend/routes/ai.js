// Routes: Agri-AI hub (Gemini)
const db = require('../db');
const AgriAI = require('../agri_ai_service');
const { sendJson, parseBody } = require('../lib/http');

const NEXT = Symbol.for('palmtrace.next-route');

// Returns NEXT when no route in this module matched the request.
module.exports = async function aiRoutes(req, res, { method, pathname, url }) {
  // 15. Agri-AI Hub Endpoints
  if (pathname === '/api/ai/diagnose-pest' && method === 'POST') {
    const body = await parseBody(req);
    const result = await AgriAI.diagnosePest(body);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/ai/analyze-lab-report' && method === 'POST') {
    const body = await parseBody(req);
    const result = await AgriAI.analyzeLabReport(body);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/ai/parse-voice-action' && method === 'POST') {
    const body = await parseBody(req);
    const result = await AgriAI.parseVoiceAction(body);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/ai/voice-transcribe' && method === 'POST') {
    const body = await parseBody(req, 6 * 1024 * 1024);
    const result = await AgriAI.transcribeVoice(body);
    return sendJson(res, result.success ? 200 : 400, result);
  }

  if (pathname === '/api/ai/agri-chat' && method === 'POST') {
    const body = await parseBody(req);
    const result = await AgriAI.chatAgriAdvisor(body);
    return sendJson(res, 200, result);
  }

  if (pathname === '/api/ai/test-key' && method === 'POST') {
    const body = await parseBody(req);
    const testKey = (body.apiKey || AgriAI.getApiKey() || '').trim();
    if (!testKey) {
      return sendJson(res, 400, { success: false, error: 'يرجى إدخال مفتاح API للفحص' });
    }
    try {
      let activeModel = 'gemini-3.5-flash';
      let testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${testKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'PING' }] }] })
      });
      if (testRes.status !== 200) {
        activeModel = 'gemini-3.8-flash';
        testRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${testKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'PING' }] }] })
        });
      }
      const testData = await testRes.json();
      if (testRes.status === 200) {
        AgriAI.setApiKey(testKey);
        db.run(
          `INSERT INTO system_settings (key, value, updated_at) VALUES ('gemini_api_key', ?, CURRENT_TIMESTAMP)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`,
          testKey
        );
        return sendJson(res, 200, { success: true, message: 'مفتاح Google Gemini صالح ومفعل بنجاح!', model: activeModel });
      } else {
        return sendJson(res, 400, { success: false, error: testData?.error?.message || 'المفتاح غير صالح أو انتهت صلاحيته' });
      }
    } catch (err) {
      return sendJson(res, 500, { success: false, error: 'خطأ في الاتصال بسيرفرات جوجل: ' + err.message });
    }
  }

  if (pathname === '/api/ai/status' && method === 'GET') {
    const currentKey = AgriAI.getApiKey();
    return sendJson(res, 200, {
      active: Boolean(currentKey),
      keyConfigured: Boolean(currentKey),
      maskedKey: currentKey ? (currentKey.slice(0, 6) + '...' + currentKey.slice(-4)) : '',
      model: 'gemini-3.5-flash'
    });
  }

  return NEXT;
};
