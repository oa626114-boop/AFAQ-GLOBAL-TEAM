const DEFAULT_INVITE_CODE = "CHANGE-THIS-BEFORE-LAUNCH";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "Content-Type, Authorization"
    }
  });
}

function clean(value, max = 500) {
  return String(value ?? "").trim().slice(0, max);
}

async function isOwner(request, env) {
  const auth = request.headers.get("Authorization") || "";
  return Boolean(env.OWNER_ADMIN_TOKEN) &&
    auth === `Bearer ${env.OWNER_ADMIN_TOKEN}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "Content-Type, Authorization"
        }
      });
    }

    if (url.pathname === "/health") {
      return json({ ok: true, service: "AFAQ GLOBAL TEAM API" });
    }

    if (url.pathname === "/register" && request.method === "POST") {
      let body;
      try { body = await request.json(); }
      catch { return json({ error: "Invalid JSON" }, 400); }

      const inviteCode = env.INVITE_CODE || DEFAULT_INVITE_CODE;
      if (clean(body.invite_code, 120) !== inviteCode) {
        return json({ error: "رمز الدعوة غير صحيح" }, 403);
      }

      const fullName = clean(body.full_name, 120);
      const email = clean(body.email, 180).toLowerCase();
      const phone = clean(body.phone, 50);
      const country = clean(body.country, 100);

      if (!fullName || !email || !phone || !country || !body.consent) {
        return json({ error: "يرجى إكمال الحقول المطلوبة والموافقة" }, 400);
      }

      try {
        const result = await env.DB.prepare(`
          INSERT INTO applicants
          (full_name,email,phone,country,languages,education,profession,
           skills,experience,interests,group_preference,consent)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,1)
        `).bind(
          fullName, email, phone, country,
          clean(body.languages), clean(body.education), clean(body.profession),
          clean(body.skills), clean(body.experience), clean(body.interests),
          clean(body.group_preference)
        ).run();

        return json({
          ok: true,
          application_id: result.meta.last_row_id,
          message: "تم استلام طلبك. العضوية لا تصبح فعالة إلا بعد موافقة الإدارة."
        }, 201);
      } catch {
        return json({ error: "هذا البريد مسجل مسبقاً أو تعذر حفظ الطلب." }, 409);
      }
    }

    if (url.pathname === "/admin/applicants" && request.method === "GET") {
      if (!await isOwner(request, env)) return json({ error: "غير مصرح" }, 401);
      const result = await env.DB.prepare(
        "SELECT * FROM applicants ORDER BY submitted_at ASC"
      ).all();
      return json({ applicants: result.results || [] });
    }

    const approveMatch = url.pathname.match(/^\/admin\/applicants\/(\d+)\/approve$/);
    if (approveMatch && request.method === "POST") {
      if (!await isOwner(request, env)) return json({ error: "غير مصرح" }, 401);

      const applicantId = Number(approveMatch[1]);
      const row = await env.DB.prepare(
        "SELECT id FROM applicants WHERE id=? AND status='pending'"
      ).bind(applicantId).first();

      if (!row) return json({ error: "الطلب غير موجود أو تمت مراجعته" }, 404);

      const next = await env.DB.prepare(
        "SELECT COALESCE(MAX(sequence_no),0)+1 AS n FROM applicants WHERE membership_id IS NOT NULL"
      ).first();

      const sequence = Number(next.n);
      const membershipId = `AFAQ-${new Date().getFullYear()}-${String(sequence).padStart(4, "0")}`;

      await env.DB.batch([
        env.DB.prepare(
          "UPDATE applicants SET status='approved', membership_id=?, sequence_no=?, reviewed_at=datetime('now') WHERE id=? AND status='pending'"
        ).bind(membershipId, sequence, applicantId),
        env.DB.prepare(
          "INSERT INTO audit_log(applicant_id,action) VALUES (?,?)"
        ).bind(applicantId, `approved:${membershipId}`)
      ]);

      return json({ ok: true, membership_id: membershipId });
    }

    const rejectMatch = url.pathname.match(/^\/admin\/applicants\/(\d+)\/reject$/);
    if (rejectMatch && request.method === "POST") {
      if (!await isOwner(request, env)) return json({ error: "غير مصرح" }, 401);
      const applicantId = Number(rejectMatch[1]);
      const result = await env.DB.prepare(
        "UPDATE applicants SET status='rejected', reviewed_at=datetime('now') WHERE id=? AND status='pending'"
      ).bind(applicantId).run();

      if (!result.meta.changes) return json({ error: "الطلب غير موجود أو تمت مراجعته" }, 404);
      await env.DB.prepare(
        "INSERT INTO audit_log(applicant_id,action) VALUES (?,?)"
      ).bind(applicantId, "rejected").run();

      return json({ ok: true });
    }

    return json({ error: "Not found" }, 404);
  }
};
