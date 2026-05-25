import 'dotenv/config';
import pg from 'pg';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

function uuid() { return crypto.randomUUID(); }
function rand(a,b) { return Math.floor(Math.random()*(b-a+1))+a; }
function randF(a,b,d=2) { return parseFloat((Math.random()*(b-a)+a).toFixed(d)); }
function pick(a) { return a[Math.floor(Math.random()*a.length)]; }
function ds(d) { return d.toISOString().split('T')[0]; }
function ts(d) { return d.toISOString(); }

// ── USER DEFINITIONS ──
const USERS = [
  { email:"admin@gmail.com",      name:"Nikhil Solanki",  role:"agency_admin", clientIdx:null },
  { email:"manager1@gmail.com",   name:"Omi Patel",       role:"manager",      clientIdx:null },
  { email:"manager2@gmail.com",   name:"Riya Mehta",      role:"manager",      clientIdx:null },
  { email:"employee1@gmail.com",  name:"Sahil Verma",     role:"employee",     clientIdx:null },
  { email:"employee2@gmail.com",  name:"Priya Sharma",    role:"employee",     clientIdx:null },
  { email:"employee3@gmail.com",  name:"Arjun Nair",      role:"employee",     clientIdx:null },
  { email:"employee4@gmail.com",  name:"Kavya Reddy",     role:"employee",     clientIdx:null },
  // Client users – clientIdx maps to CLIENTS array index
  { email:"apex@gmail.com",       name:"Vikram Desai",    role:"client",       clientIdx:0 },
  { email:"greenleaf@gmail.com",  name:"Ananya Iyer",     role:"client",       clientIdx:1 },
  { email:"novastar@gmail.com",   name:"Rohan Kapoor",    role:"client",       clientIdx:2 },
  { email:"titanforge@gmail.com", name:"Meera Joshi",     role:"client",       clientIdx:3 },
  { email:"urbannest@gmail.com",  name:"Aditya Rao",      role:"client",       clientIdx:4 },
  { email:"cloudpeak@gmail.com",  name:"Neha Gupta",      role:"client",       clientIdx:5 },
  { email:"meridian@gmail.com",   name:"Sanjay Kumar",    role:"client",       clientIdx:6 },
  { email:"pulsewave@gmail.com",  name:"Tanvi Shah",      role:"client",       clientIdx:7 },
];

const CLIENTS = [
  { name:"Apex Fintech Solutions",   industry:"Financial Technology",  budget:45000, status:"active" },
  { name:"GreenLeaf Organics",       industry:"Food & Beverage",       budget:22000, status:"active" },
  { name:"NovaStar Entertainment",   industry:"Media & Entertainment", budget:38000, status:"active" },
  { name:"TitanForge Manufacturing", industry:"Industrial",            budget:18000, status:"active" },
  { name:"UrbanNest Real Estate",    industry:"Real Estate",           budget:55000, status:"active" },
  { name:"CloudPeak Healthcare",     industry:"Healthcare",            budget:32000, status:"active" },
  { name:"Meridian Travel Co.",      industry:"Travel & Hospitality",  budget:27000, status:"active" },
  { name:"PulseWave Fitness",        industry:"Health & Fitness",      budget:15000, status:"connected" },
];

const CAMP = [
  // 0: Apex
  [{n:"Apex — Google Search: Investment App Installs",p:"google_ads",b:12000,s:"active"},
   {n:"Apex — Meta Lead Gen: Credit Score Tool",p:"meta_ads",b:10000,s:"active"},
   {n:"Apex — LinkedIn B2B: Wealth Manager Outreach",p:"linkedin_ads",b:8000,s:"active"},
   {n:"Apex — Mailchimp: Monthly Investor Newsletter",p:"mailchimp",b:1500,s:"active"},
   {n:"Apex — Twitter Brand Awareness: FinTech Insights",p:"twitter_ads",b:5000,s:"paused"}],
  // 1: GreenLeaf
  [{n:"GreenLeaf — Meta: Farm-to-Table Awareness",p:"meta_ads",b:7000,s:"active"},
   {n:"GreenLeaf — Google Shopping: Organic Snacks",p:"google_ads",b:6000,s:"active"},
   {n:"GreenLeaf — Mailchimp: Recipe of the Week",p:"mailchimp",b:800,s:"active"},
   {n:"GreenLeaf — Twitter: Sustainability Messaging",p:"twitter_ads",b:3000,s:"completed"}],
  // 2: NovaStar
  [{n:"NovaStar — Meta: Summer Blockbuster Trailer",p:"meta_ads",b:15000,s:"active"},
   {n:"NovaStar — Google Video: YouTube Pre-Roll Ads",p:"google_ads",b:12000,s:"active"},
   {n:"NovaStar — Twitter: Fan Engagement & Polls",p:"twitter_ads",b:6000,s:"active"},
   {n:"NovaStar — Mailchimp: Premiere Invites & VIP",p:"mailchimp",b:1200,s:"active"}],
  // 3: TitanForge
  [{n:"TitanForge — LinkedIn: Industrial Procurement",p:"linkedin_ads",b:9000,s:"active"},
   {n:"TitanForge — Google Search: CNC Machine Parts",p:"google_ads",b:5000,s:"active"},
   {n:"TitanForge — Mailchimp: Product Catalog Updates",p:"mailchimp",b:500,s:"active"}],
  // 4: UrbanNest
  [{n:"UrbanNest — Google: Luxury Condo Search Ads",p:"google_ads",b:20000,s:"active"},
   {n:"UrbanNest — Meta: Virtual Tour Retargeting",p:"meta_ads",b:18000,s:"active"},
   {n:"UrbanNest — LinkedIn: Commercial Leasing B2B",p:"linkedin_ads",b:7000,s:"active"},
   {n:"UrbanNest — Mailchimp: New Listings Weekly",p:"mailchimp",b:1000,s:"active"},
   {n:"UrbanNest — Twitter: Market Trends Commentary",p:"twitter_ads",b:4000,s:"paused"}],
  // 5: CloudPeak
  [{n:"CloudPeak — Google: Telemedicine Appointments",p:"google_ads",b:14000,s:"active"},
   {n:"CloudPeak — Meta: Wellness Program Awareness",p:"meta_ads",b:9000,s:"active"},
   {n:"CloudPeak — Mailchimp: Patient Health Tips",p:"mailchimp",b:1200,s:"active"},
   {n:"CloudPeak — LinkedIn: Medical Staff Recruitment",p:"linkedin_ads",b:5000,s:"completed"}],
  // 6: Meridian
  [{n:"Meridian — Meta: Dream Vacation Carousels",p:"meta_ads",b:10000,s:"active"},
   {n:"Meridian — Google: Last-Minute Flight Deals",p:"google_ads",b:8000,s:"active"},
   {n:"Meridian — Mailchimp: Seasonal Travel Guides",p:"mailchimp",b:900,s:"active"},
   {n:"Meridian — Twitter: Travel Tips & Destinations",p:"twitter_ads",b:4000,s:"active"}],
  // 7: PulseWave
  [{n:"PulseWave — Meta: New Year Gym Membership",p:"meta_ads",b:6000,s:"active"},
   {n:"PulseWave — Google: Online Fitness Classes",p:"google_ads",b:4000,s:"active"},
   {n:"PulseWave — Mailchimp: Weekly Workout Plans",p:"mailchimp",b:500,s:"active"}],
];

const SEASON = [0.80,0.75,0.85,0.95,1.10,1.35,1.20,0.70,0.80,0.90,1.00,1.05];

function genMetric(cid,clid,plat,budget,date,sm) {
  const db=(budget/30)*sm, wd=([0,6].includes(date.getDay()))?0.65:1.08;
  const spend=parseFloat((db*wd*randF(0.82,1.18)).toFixed(2));
  let ctr,cpc,cv;
  switch(plat){
    case'google_ads':ctr=randF(.028,.065);cpc=randF(.9,3.8);cv=randF(.025,.055);break;
    case'meta_ads':ctr=randF(.01,.035);cpc=randF(.4,2.1);cv=randF(.018,.042);break;
    case'linkedin_ads':ctr=randF(.004,.012);cpc=randF(4.5,12);cv=randF(.03,.075);break;
    case'twitter_ads':ctr=randF(.008,.022);cpc=randF(.5,2.5);cv=randF(.012,.03);break;
    default:ctr=randF(.02,.055);cpc=randF(.05,.2);cv=randF(.01,.035);
  }
  const sc=Math.max(cpc,.01),cl=Math.min(50000,Math.max(1,Math.round(spend/sc)));
  const imp=Math.min(500000,Math.max(cl,Math.round(cl/Math.max(ctr,.001))));
  const reach=Math.min(400000,Math.round(imp*randF(.6,.85)));
  const leads=Math.max(0,Math.round(cl*cv)),conv=Math.max(0,Math.round(leads*randF(.4,.75)));
  const rev=parseFloat((conv*randF(45,320)).toFixed(2));
  return [uuid(),cid,clid,ds(date),spend,imp,cl,leads,reach,conv,rev,plat,ts(new Date(date.getTime()+rand(3600000,86400000)))];
}

// ─── ASSIGNMENT STRUCTURE ───
// Manager1 (Omi) → clients: Apex(0), GreenLeaf(1), UrbanNest(4), Meridian(6)
// Manager2 (Riya) → clients: NovaStar(2), TitanForge(3), CloudPeak(5), PulseWave(7)
// Employee1 (Sahil)  → reports to Manager1
// Employee2 (Priya)  → reports to Manager1
// Employee3 (Arjun)  → reports to Manager2
// Employee4 (Kavya)  → reports to Manager2
const MGR1_CLIENTS = [0,1,4,6];
const MGR2_CLIENTS = [2,3,5,7];
const MGR1_EMPS = [0,1]; // employee indices (employee1, employee2)
const MGR2_EMPS = [2,3]; // employee indices (employee3, employee4)

async function seed() {
  const c = await pool.connect();
  console.log('[seed] Connected');
  try {
    await c.query('BEGIN');

    // ── 1. NUKE EVERYTHING ──
    console.log('[seed] Clearing ALL data...');
    await c.query('DELETE FROM campaign_metrics');
    await c.query('DELETE FROM employee_campaign_assignments');
    await c.query('DELETE FROM sync_logs');
    await c.query('DELETE FROM platform_credentials');
    await c.query('DELETE FROM manager_client_assignments');
    await c.query('DELETE FROM campaigns');
    await c.query('DELETE FROM clients');
    await c.query('DELETE FROM users');
    console.log('[seed] ✅ All tables cleared');

    // ── 2. CREATE USERS ──
    console.log('[seed] Creating users...');
    const userIds = [];
    for (const u of USERS) {
      const id = uuid();
      userIds.push(id);
      await c.query(
        `INSERT INTO users (id, email, name, role, is_active, created_at) VALUES ($1,$2,$3,$4,true,$5)`,
        [id, u.email, u.name, u.role, ts(new Date('2025-05-10T10:00:00Z'))]
      );
    }
    // Index mapping: 0=admin, 1=mgr1, 2=mgr2, 3=emp1, 4=emp2, 5=emp3, 6=emp4, 7+=clients
    const adminId=userIds[0], mgr1Id=userIds[1], mgr2Id=userIds[2];
    const empIds=[userIds[3],userIds[4],userIds[5],userIds[6]];
    console.log(`[seed] ✅ ${USERS.length} users created`);

    // ── 3. ASSIGN EMPLOYEES TO MANAGERS ──
    for (const ei of MGR1_EMPS) await c.query(`UPDATE users SET manager_id=$1 WHERE id=$2`,[mgr1Id,empIds[ei]]);
    for (const ei of MGR2_EMPS) await c.query(`UPDATE users SET manager_id=$1 WHERE id=$2`,[mgr2Id,empIds[ei]]);
    console.log('[seed] ✅ Employees assigned to managers');

    // ── 4. CREATE CLIENTS ──
    console.log('[seed] Creating clients...');
    const clientIds = [];
    for (let i=0;i<CLIENTS.length;i++) {
      const id=uuid(); clientIds.push(id);
      const clientUserId = userIds[7+i]; // client user starts at index 7
      await c.query(
        `INSERT INTO clients (id,name,industry,monthly_budget,onboarding_status,is_active,created_at) VALUES ($1,$2,$3,$4,$5,true,$6)`,
        [id,CLIENTS[i].name,CLIENTS[i].industry,CLIENTS[i].budget,CLIENTS[i].status,ts(new Date('2025-05-15T10:00:00Z'))]
      );
      // Link client user to client
      await c.query(`UPDATE users SET client_id=$1 WHERE id=$2`,[id,clientUserId]);
    }
    console.log(`[seed] ✅ ${CLIENTS.length} clients created`);

    // ── 5. MANAGER → CLIENT ASSIGNMENTS ──
    for (const ci of MGR1_CLIENTS)
      await c.query(`INSERT INTO manager_client_assignments (id,manager_id,client_id,assigned_by,assigned_at) VALUES ($1,$2,$3,$4,$5)`,
        [uuid(),mgr1Id,clientIds[ci],adminId,ts(new Date('2025-05-20T14:00:00Z'))]);
    for (const ci of MGR2_CLIENTS)
      await c.query(`INSERT INTO manager_client_assignments (id,manager_id,client_id,assigned_by,assigned_at) VALUES ($1,$2,$3,$4,$5)`,
        [uuid(),mgr2Id,clientIds[ci],adminId,ts(new Date('2025-05-20T14:00:00Z'))]);
    console.log('[seed] ✅ Clients assigned to managers');

    // ── 6. CREATE CAMPAIGNS ──
    const allCamps = [];
    for (let ci=0;ci<CLIENTS.length;ci++) {
      for (const t of CAMP[ci]) {
        const id=uuid();
        const ed = t.s==='completed' ? '2026-02-28' : '2026-05-31';
        await c.query(`INSERT INTO campaigns (id,client_id,name,platform,status,budget,start_date,end_date,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [id,clientIds[ci],t.n,t.p,t.s,t.b,'2025-06-01',ed,ts(new Date('2025-05-25T09:00:00Z'))]);
        allCamps.push({id,ci,clid:clientIds[ci],p:t.p,b:t.b,s:t.s});
      }
    }
    console.log(`[seed] ✅ ${allCamps.length} campaigns created`);

    // ── 7. EMPLOYEE → CAMPAIGN ASSIGNMENTS ──
    let ecaCount=0;
    // Manager1's clients' campaigns → employee1 & employee2
    const m1Camps = allCamps.filter(x=>MGR1_CLIENTS.includes(x.ci));
    for (let i=0;i<m1Camps.length;i++) {
      const primary = empIds[MGR1_EMPS[i%MGR1_EMPS.length]];
      await c.query(`INSERT INTO employee_campaign_assignments (id,employee_id,campaign_id) VALUES ($1,$2,$3)`,[uuid(),primary,m1Camps[i].id]);
      ecaCount++;
      if (i%3===0) { // some get both employees
        const second = empIds[MGR1_EMPS[(i+1)%MGR1_EMPS.length]];
        await c.query(`INSERT INTO employee_campaign_assignments (id,employee_id,campaign_id) VALUES ($1,$2,$3)`,[uuid(),second,m1Camps[i].id]);
        ecaCount++;
      }
    }
    // Manager2's clients' campaigns → employee3 & employee4
    const m2Camps = allCamps.filter(x=>MGR2_CLIENTS.includes(x.ci));
    for (let i=0;i<m2Camps.length;i++) {
      const primary = empIds[MGR2_EMPS[i%MGR2_EMPS.length]];
      await c.query(`INSERT INTO employee_campaign_assignments (id,employee_id,campaign_id) VALUES ($1,$2,$3)`,[uuid(),primary,m2Camps[i].id]);
      ecaCount++;
      if (i%3===0) {
        const second = empIds[MGR2_EMPS[(i+1)%MGR2_EMPS.length]];
        await c.query(`INSERT INTO employee_campaign_assignments (id,employee_id,campaign_id) VALUES ($1,$2,$3)`,[uuid(),second,m2Camps[i].id]);
        ecaCount++;
      }
    }
    console.log(`[seed] ✅ ${ecaCount} employee-campaign assignments`);

    // ── 8. DAILY METRICS (12 months) ──
    console.log('[seed] Generating daily metrics...');
    let mc=0; const batch=[];
    async function flush() {
      if(!batch.length) return;
      const ph=[],fv=[]; let pi=1;
      for(const r of batch){
        ph.push(`($${pi},$${pi+1},$${pi+2},$${pi+3},$${pi+4},$${pi+5},$${pi+6},$${pi+7},$${pi+8},$${pi+9},$${pi+10},$${pi+11},$${pi+12})`);
        fv.push(...r); pi+=13;
      }
      await c.query(`INSERT INTO campaign_metrics (id,campaign_id,client_id,date,spend,impressions,clicks,leads,reach,conversions,revenue,source,synced_at) VALUES ${ph.join(',')}`,fv);
      batch.length=0;
    }
    for(const camp of allCamps){
      const end = camp.s==='completed'?new Date('2026-02-28'):new Date('2026-05-20');
      const pause = camp.s==='paused'?new Date('2026-01-15'):null;
      let d=new Date('2025-06-01');
      while(d<=end){
        if(pause&&d>pause) break;
        const mi=(d.getMonth()-5+12)%12;
        batch.push(genMetric(camp.id,camp.clid,camp.p,camp.b,new Date(d),SEASON[mi]));
        mc++; if(batch.length>=200) await flush();
        d.setDate(d.getDate()+1);
      }
    }
    await flush();
    console.log(`[seed] ✅ ${mc.toLocaleString()} metric rows`);

    // ── 9. PLATFORM CREDENTIALS ──
    let cc=0;
    for(let ci=0;ci<CLIENTS.length;ci++){
      const plats=[...new Set(CAMP[ci].map(t=>t.p))];
      for(const p of plats){
        await c.query(`INSERT INTO platform_credentials (id,client_id,platform,access_token,refresh_token,account_id,is_verified,token_expires_at,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [uuid(),clientIds[ci],p,`tok_${p}_${ci}`,`rtk_${p}_${ci}`,`acct-${rand(100000,999999)}`,true,ts(new Date('2026-12-31')),ts(new Date('2025-05-20'))]);
        cc++;
      }
    }
    console.log(`[seed] ✅ ${cc} platform credentials`);

    // ── 10. SYNC LOGS ──
    let sc=0;
    for(let ci=0;ci<CLIENTS.length;ci++){
      const plats=[...new Set(CAMP[ci].map(t=>t.p))];
      for(const p of plats){
        let d=new Date('2025-11-01');
        while(d<=new Date('2026-05-20')){
          const ok=Math.random()>.06;
          await c.query(`INSERT INTO sync_logs (id,client_id,platform,status,records_synced,error_message,synced_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [uuid(),clientIds[ci],p,ok?'success':'failed',ok?rand(15,180):0,ok?null:pick(['API rate limit exceeded','Invalid access token','Connection timeout','Partial data received']),
             ts(new Date(d.getTime()+rand(0,43200000)))]);
          sc++; d.setDate(d.getDate()+rand(3,4));
        }
      }
    }
    console.log(`[seed] ✅ ${sc} sync logs`);

    await c.query('COMMIT');

    console.log(`\n${'═'.repeat(55)}`);
    console.log(` ✅  SEED COMPLETE`);
    console.log(`${'═'.repeat(55)}`);
    console.log(` Users: ${USERS.length} (1 admin, 2 managers, 4 employees, 8 clients)`);
    console.log(` Clients: ${CLIENTS.length} | Campaigns: ${allCamps.length}`);
    console.log(` Metrics: ${mc.toLocaleString()} | Sync Logs: ${sc}`);
    console.log(` Credentials: ${cc} | Employee-Campaign: ${ecaCount}`);
    console.log(`${'═'.repeat(55)}\n`);

  } catch(e) {
    await c.query('ROLLBACK');
    console.error('[seed] ❌ Failed:',e.message,e.stack);
    process.exit(1);
  } finally { c.release(); await pool.end(); }
}
seed();
