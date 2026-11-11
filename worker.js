function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  });
}
const clean = (v, n=500) => String(v ?? "").trim().slice(0,n);
async function ownerOnly(request, env) {
  return Boolean(env.OWNER_ADMIN_TOKEN) &&
    request.headers.get("Authorization") === `Bearer ${env.OWNER_ADMIN_TOKEN}`;
}
export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null,{headers:{
   "Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, POST, OPTIONS",
   "Access-Control-Allow-Headers":"Content-Type, Authorization"}});
  if (!env.DB) return json({error:"Database binding DB is missing"},500);
  if (url.pathname === "/health" && request.method === "GET")
   return json({ok:true,service:"AFAQ GLOBAL TEAM API"});
  if (url.pathname === "/register" && request.method === "POST") {
   let b; try { b=await request.json(); } catch { return json({error:"Invalid JSON"},400); }
   if (!env.INVITE_CODE || clean(b.invite_code,120)!==env.INVITE_CODE)
    return json({error:"رمز الدعوة غير صحيح"},403);
   const name=clean(b.full_name,120), email=clean(b.email,180).toLowerCase(),
    phone=clean(b.phone,50), country=clean(b.country,100);
   if(!name||!email||!phone||!country||!b.consent)
    return json({error:"يرجى إكمال الحقول المطلوبة والموافقة"},400);
   try {
    const r=await env.DB.prepare(`INSERT INTO applicants
     (full_name,email,phone,country,languages,education,profession,skills,experience,interests,group_preference,consent)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,1)`).bind(name,email,phone,country,clean(b.languages),clean(b.education),
      clean(b.profession),clean(b.skills),clean(b.experience),clean(b.interests),clean(b.group_preference)).run();
    return json({ok:true,application_id:r.meta.last_row_id,
      message:"تم استلام طلبك. العضوية لا تصبح فعالة إلا بعد موافقة الإدارة."},201);
   } catch { return json({error:"البريد مسجل مسبقاً أو تعذر حفظ الطلب."},409); }
  }
  if (url.pathname==="/admin/applicants" && request.method==="GET") {
   if(!await ownerOnly(request,env)) return json({error:"غير مصرح"},401);
   const r=await env.DB.prepare("SELECT * FROM applicants ORDER BY submitted_at ASC").all();
   return json({applicants:r.results||[]});
  }
  const match=url.pathname.match(/^\/admin\/applicants\/(\d+)\/(approve|reject)$/);
  if(match && request.method==="POST") {
   if(!await ownerOnly(request,env)) return json({error:"غير مصرح"},401);
   const id=Number(match[1]), action=match[2];
   const row=await env.DB.prepare("SELECT id,status FROM applicants WHERE id=?").bind(id).first();
   if(!row || row.status!=="pending") return json({error:"الطلب غير موجود أو تمت مراجعته"},404);
   if(action==="reject") {
    const r=await env.DB.prepare("UPDATE applicants SET status='rejected',reviewed_at=datetime('now') WHERE id=? AND status='pending'").bind(id).run();
    if(!r.meta.changes) return json({error:"تمت مراجعة الطلب مسبقاً"},409);
    await env.DB.prepare("INSERT INTO audit_log(applicant_id,action) VALUES (?,?)").bind(id,"rejected").run();
    return json({ok:true,status:"rejected"});
   }
   await env.DB.prepare("CREATE TABLE IF NOT EXISTS membership_counter (id INTEGER PRIMARY KEY CHECK(id=1), last_no INTEGER NOT NULL)").run();
   await env.DB.prepare("INSERT OR IGNORE INTO membership_counter(id,last_no) VALUES(1,0)").run();
   const counter=await env.DB.prepare("UPDATE membership_counter SET last_no=last_no+1 WHERE id=1 RETURNING last_no").first();
   const no=Number(counter.last_no), year=new Date().getUTCFullYear();
   const membershipId=`AFAQ-${year}-${String(no).padStart(4,"0")}`;
   const r=await env.DB.prepare("UPDATE applicants SET status='approved',membership_id=?,sequence_no=?,reviewed_at=datetime('now') WHERE id=? AND status='pending'").bind(membershipId,no,id).run();
   if(!r.meta.changes) return json({error:"تعذر اعتماد الطلب. راجع الإدارة."},409);
   await env.DB.prepare("INSERT INTO audit_log(applicant_id,action) VALUES (?,?)").bind(id,`approved:${membershipId}`).run();
   return json({ok:true,membership_id:membershipId,status:"approved"});
  }
  return json({error:"Not found"},404);
 }
};
