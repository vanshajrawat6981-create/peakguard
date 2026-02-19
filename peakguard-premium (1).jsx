import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const T = {
  bg0:      "#03050a",
  bg1:      "#070c14",
  bg2:      "#0c1220",
  bg3:      "#111827",
  surface:  "#0d1525",
  surfaceHover: "#121d30",
  border:   "#1a2540",
  borderBright: "#243352",
  gold:     "#c8a96e",
  goldDim:  "#9a7a4a",
  goldGlow: "rgba(200,169,110,0.15)",
  cyan:     "#38bdf8",
  cyanDim:  "#0ea5e9",
  cyanGlow: "rgba(56,189,248,0.12)",
  green:    "#34d399",
  greenDim: "#059669",
  greenGlow:"rgba(52,211,153,0.12)",
  red:      "#f87171",
  redDim:   "#dc2626",
  redGlow:  "rgba(248,113,113,0.12)",
  amber:    "#fbbf24",
  text0:    "#f0f4ff",
  text1:    "#94a3b8",
  text2:    "#4a5568",
  text3:    "#2d3748",
};

/* ═══════════════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════════════ */
const genHours = () => Array.from({ length: 24 }, (_, h) => {
  const base = 320 + Math.sin((h - 6) * Math.PI / 12) * 180;
  const noise = (Math.random() - 0.5) * 40;
  const f = Math.round(Math.max(150, base + noise + (h > 14 && h < 20 ? 130 : 0)));
  return { time: `${String(h).padStart(2,"0")}:00`, forecast: f, historical: h < 18 ? f - Math.round((Math.random()-0.5)*18) : null, upper: f+45, lower: Math.max(150,f-45), isPeak: h>=15&&h<=19 };
});

const LOADS = [
  { id:1, name:"HVAC · Main Building",    loc:"Block A",     kw:145, crit:"high",     ctrl:true,  status:"online",  last:"12s" },
  { id:2, name:"Chiller Plant #1",         loc:"Utility",     kw:210, crit:"high",     ctrl:false, status:"online",  last:"8s"  },
  { id:3, name:"Lighting · Floors 1–5",   loc:"Block A/B",   kw:42,  crit:"low",      ctrl:true,  status:"online",  last:"45s" },
  { id:4, name:"EV Charging Bay",          loc:"Parking",     kw:88,  crit:"medium",   ctrl:true,  status:"online",  last:"3s"  },
  { id:5, name:"Server Room Cooling",      loc:"Data Center", kw:95,  crit:"critical", ctrl:false, status:"online",  last:"2s"  },
  { id:6, name:"Workshop Machinery",       loc:"Block C",     kw:175, crit:"medium",   ctrl:true,  status:"offline", last:"2m"  },
  { id:7, name:"Cafeteria Equipment",      loc:"Block B",     kw:38,  crit:"low",      ctrl:true,  status:"online",  last:"18s" },
];

const SUGGESTIONS = [
  { id:1, window:"15:00 – 18:00", reduce:180, conf:91, actions:[
    { id:1, load:"EV Charging Bay",        type:"Defer",        dur:3, kw:88,  comfort:1, ok:false },
    { id:2, load:"HVAC · Main Building",   type:"Setpoint +2°C",dur:3, kw:52,  comfort:3, ok:false },
    { id:3, load:"Lighting · Floors 1–5", type:"Dim 40%",       dur:3, kw:17,  comfort:2, ok:false },
  ]},
  { id:2, window:"16:30 – 17:30", reduce:90,  conf:78, actions:[
    { id:4, load:"Workshop Machinery",     type:"Pause cycle",  dur:1, kw:60,  comfort:2, ok:false },
    { id:5, load:"Cafeteria Equipment",    type:"Standby mode", dur:1, kw:28,  comfort:1, ok:false },
  ]},
];

const AUDIT = [
  { id:1, ts:"10:42:18", user:"j.smith",  role:"admin",    action:"Approved suggestion #A-1042", load:"HVAC · Main Building",  result:"success",  from:"24°C",       to:"26°C"       },
  { id:2, ts:"10:38:04", user:"m.jones",  role:"operator", action:"Rejected suggestion #A-1041", load:"EV Charging Bay",       result:"rejected", from:"—",          to:"—"          },
  { id:3, ts:"09:55:33", user:"j.smith",  role:"admin",    action:"Modified load constraints",   load:"Chiller Plant #1",      result:"success",  from:"minKw: 80",  to:"minKw: 100" },
  { id:4, ts:"09:12:00", user:"system",   role:"auto",     action:"Auto-schedule executed",       load:"Lighting · Floors 1–5", result:"success",  from:"100%",       to:"60%"        },
  { id:5, ts:"08:30:45", user:"r.patel",  role:"operator", action:"Manual override",              load:"Workshop Machinery",    result:"failed",   from:"running",    to:"running"    },
];

const REPORT_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const REPORT = {
  peak:    REPORT_MONTHS.map(m => ({ m, actual: 80+Math.random()*120, target:150 })),
  savings: REPORT_MONTHS.map(m => ({ m, v: 2000+Math.random()*3000 })),
};

const PERMS = {
  viewer:   { approve:false, execute:false, editLoads:false, manageUsers:false },
  operator: { approve:true,  execute:true,  editLoads:false, manageUsers:false },
  admin:    { approve:true,  execute:true,  editLoads:true,  manageUsers:true  },
};

/* ═══════════════════════════════════════════════════════════════
   MICRO-COMPONENTS
═══════════════════════════════════════════════════════════════ */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=JetBrains+Mono:wght@300;400;500;600&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
:root{color-scheme:dark}
body{background:${T.bg0}}
::-webkit-scrollbar{width:3px;height:3px}
::-webkit-scrollbar-track{background:transparent}
::-webkit-scrollbar-thumb{background:${T.border};border-radius:2px}
@keyframes shimmer{0%{background-position:-400% 0}100%{background-position:400% 0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow-border{0%,100%{opacity:.6}50%{opacity:1}}
@keyframes slide-right{from{transform:translateX(-100%)}to{transform:translateX(0)}}
@keyframes number-tick{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
.nav-btn{transition:all .18s ease;border-left:2px solid transparent}
.nav-btn:hover{background:${T.bg3} !important;border-left-color:${T.goldDim} !important}
.nav-btn.active{background:${T.bg3} !important;border-left-color:${T.gold} !important}
.row-hover:hover{background:${T.surfaceHover} !important}
.action-card:hover{border-color:${T.borderBright} !important;transform:translateY(-1px)}
.btn-primary{transition:all .15s;background:linear-gradient(135deg,#1a3a6b,#1e4080)}
.btn-primary:hover{filter:brightness(1.2);transform:translateY(-1px)}
.btn-ghost:hover{background:${T.bg3} !important;border-color:${T.borderBright} !important}
.kpi-card{transition:all .3s ease}
.kpi-card:hover{transform:translateY(-2px)}
.tab-btn:hover{color:${T.text1} !important}
input:focus{outline:none;border-color:${T.cyanDim} !important;box-shadow:0 0 0 3px ${T.cyanGlow}}
select:focus{outline:none}
`;

const Mono = ({ children, color = T.text1, size = 11 }) => (
  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: size, color, letterSpacing: 0.3 }}>{children}</span>
);

const Label = ({ children }) => (
  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: T.text2, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>{children}</div>
);

const Divider = ({ style }) => (
  <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${T.border}, transparent)`, ...style }} />
);

const LiveDot = ({ color = T.green }) => (
  <span style={{ position: "relative", display: "inline-flex", width: 8, height: 8 }}>
    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color, opacity: .4, animation: "pulse 1.8s infinite", transform: "scale(1.8)" }} />
    <span style={{ position: "absolute", inset: 0, borderRadius: "50%", background: color }} />
  </span>
);

const CRIT_MAP = {
  critical: { bg: "#1a0028", fg: "#e879f9", bd: "#6b21a8" },
  high:     { bg: "#1e0909", fg: "#f87171", bd: "#991b1b" },
  medium:   { bg: "#1c1400", fg: "#fbbf24", bd: "#92400e" },
  low:      { bg: "#071a10", fg: "#34d399", bd: "#065f46" },
  online:   { bg: "#071a10", fg: "#34d399", bd: "#065f46" },
  offline:  { bg: "#111", fg: "#475569", bd: "#1e293b" },
  success:  { bg: "#071a10", fg: "#34d399", bd: "#065f46" },
  rejected: { bg: "#1e0909", fg: "#f87171", bd: "#991b1b" },
  failed:   { bg: "#1e0909", fg: "#f87171", bd: "#991b1b" },
  admin:    { bg: "#1a1200", fg: T.gold,    bd: "#78350f" },
  operator: { bg: "#071420", fg: T.cyan,    bd: "#164e63" },
  viewer:   { bg: "#111",    fg: T.text1,   bd: T.border  },
  auto:     { bg: "#0d1520", fg: "#7dd3fc", bd: "#1e3a5f" },
};
const Chip = ({ label, style }) => {
  const s = CRIT_MAP[label] || CRIT_MAP.low;
  return (
    <span style={{
      background: s.bg, color: s.fg, border: `1px solid ${s.bd}`,
      padding: "3px 9px", borderRadius: 3,
      fontFamily: "'JetBrains Mono', monospace", fontSize: 10,
      textTransform: "uppercase", letterSpacing: 1.2, display: "inline-block",
      ...style,
    }}>{label}</span>
  );
};

const Skeleton = ({ w = "100%", h = 18, r = 4 }) => (
  <div style={{
    width: w, height: h, borderRadius: r,
    background: `linear-gradient(90deg, ${T.bg2} 0%, ${T.bg3} 50%, ${T.bg2} 100%)`,
    backgroundSize: "400% 100%", animation: "shimmer 2s infinite",
  }} />
);

const ComfortBar = ({ score, max = 5 }) => (
  <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
    {Array.from({ length: max }, (_, i) => (
      <div key={i} style={{
        width: 14, height: 4, borderRadius: 2,
        background: i < score
          ? score <= 2 ? T.green : score <= 3 ? T.amber : T.red
          : T.bg3,
        transition: "background .3s",
      }} />
    ))}
  </div>
);

const GlassCard = ({ children, style, glow, animate }) => (
  <div style={{
    background: `linear-gradient(135deg, ${T.bg2}ee 0%, ${T.surface}dd 100%)`,
    border: `1px solid ${T.border}`,
    borderRadius: 12,
    backdropFilter: "blur(8px)",
    boxShadow: glow ? `0 0 40px ${glow}, inset 0 1px 0 rgba(255,255,255,0.04)` : "inset 0 1px 0 rgba(255,255,255,0.03)",
    animation: animate ? "fadeUp .4s ease both" : undefined,
    ...style,
  }}>{children}</div>
);

const CardHeader = ({ title, sub, action }) => (
  <div style={{ padding: "16px 20px", borderBottom: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
    <div>
      <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 600, color: T.text0, letterSpacing: .3 }}>{title}</div>
      {sub && <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.text2, marginTop: 3, letterSpacing: .3 }}>{sub}</div>}
    </div>
    {action}
  </div>
);

const BtnPrimary = ({ children, onClick, small, disabled }) => (
  <button onClick={onClick} disabled={disabled} className="btn-primary" style={{
    background: "linear-gradient(135deg, #1a3a6b, #1e4080)",
    border: `1px solid #2a5298`,
    color: "#93c5fd", fontFamily: "'JetBrains Mono', monospace",
    fontSize: small ? 10 : 11, padding: small ? "4px 12px" : "7px 16px",
    borderRadius: 6, cursor: disabled ? "default" : "pointer",
    opacity: disabled ? .5 : 1, letterSpacing: .5,
  }}>{children}</button>
);

const BtnGhost = ({ children, onClick, small }) => (
  <button onClick={onClick} className="btn-ghost" style={{
    background: "transparent", border: `1px solid ${T.border}`,
    color: T.text2, fontFamily: "'JetBrains Mono', monospace",
    fontSize: small ? 10 : 11, padding: small ? "4px 12px" : "7px 16px",
    borderRadius: 6, cursor: "pointer", letterSpacing: .5,
  }}>{children}</button>
);

const BtnDanger = ({ children, onClick, small }) => (
  <button onClick={onClick} style={{
    background: "#1e0909", border: "1px solid #7f1d1d",
    color: T.red, fontFamily: "'JetBrains Mono', monospace",
    fontSize: small ? 10 : 11, padding: small ? "4px 12px" : "7px 16px",
    borderRadius: 6, cursor: "pointer", letterSpacing: .5, transition: "all .15s",
  }}>{children}</button>
);

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: T.bg1, border: `1px solid ${T.borderBright}`, borderRadius: 8, padding: "10px 14px", boxShadow: "0 16px 40px rgba(0,0,0,.6)" }}>
      <Mono color={T.text2} size={10}>{label}</Mono>
      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
        {payload.map((p, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, display: "inline-block" }} />
            <Mono color={T.text1} size={11}>{p.name}: <strong style={{ color: T.text0 }}>{Math.round(p.value)} kW</strong></Mono>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════════════
   APP SHELL
═══════════════════════════════════════════════════════════════ */
const NAV = [
  { id:"dashboard",   ico:"◈", label:"Dashboard"  },
  { id:"forecast",    ico:"⌬", label:"Forecast"   },
  { id:"suggestions", ico:"◎", label:"Suggestions"},
  { id:"loads",       ico:"⊞", label:"Loads"      },
  { id:"calendar",    ico:"▦", label:"Calendar"   },
  { id:"reports",     ico:"▨", label:"Reports"    },
  { id:"audit",       ico:"▤", label:"Audit Log"  },
  { id:"admin",       ico:"⬡", label:"Admin", adminOnly:true },
];

export default function App() {
  const [role, setRole]           = useState("operator");
  const [page, setPage]           = useState("dashboard");
  const [sidebar, setSidebar]     = useState(true);
  const [alert, setAlert]         = useState(true);
  const [toast, setToast]         = useState(null);
  const [liveKw, setLiveKw]       = useState(487);
  const [chartData]               = useState(genHours);
  const [loads, setLoads]         = useState(LOADS);
  const [suggs, setSuggs]         = useState(SUGGESTIONS);
  const [loading, setLoading]     = useState(false);
  const perms = PERMS[role];

  useEffect(() => {
    const t = setInterval(() => setLiveKw(v => Math.round(Math.max(300, Math.min(720, v + (Math.random()-.5)*18)))), 2000);
    return () => clearInterval(t);
  }, []);

  const fire = useCallback((msg, type="ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3600);
  }, []);

  const approve = (sid, aid) => {
    if (!perms.approve) return fire("Permission denied — Operator role required", "err");
    setSuggs(p => p.map(s => s.id===sid ? { ...s, actions: s.actions.map(a => a.id===aid ? {...a,ok:true} : a) } : s));
    fire("Action approved and scheduled");
  };

  const go = (p) => {
    setLoading(true);
    setTimeout(() => { setPage(p); setLoading(false); }, 180);
  };

  const isAdmin = role === "admin";

  return (
    <div style={{ fontFamily: "'JetBrains Mono', monospace", background: T.bg0, color: T.text1, minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <style>{css}</style>

      {/* ── ALERT BANNER ── */}
      {alert && (
        <div style={{
          background: `linear-gradient(90deg, #1a0000 0%, #2d0808 40%, #1a0000 100%)`,
          borderBottom: `1px solid #7f1d1d44`,
          padding: "9px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: T.red }} />
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ color: T.red, animation: "pulse 1s infinite", fontSize: 14 }}>▲</span>
            <Mono color="#fca5a5" size={12}>PEAK RISK — HIGH PROBABILITY  ·  Today 15:00–18:00  ·  Estimated overage +180 kW  ·  Immediate action required</Mono>
          </div>
          <button onClick={() => setAlert(false)} style={{ background:"none", border:`1px solid #7f1d1d44`, color:T.text2, padding:"3px 10px", borderRadius:4, fontFamily:"inherit", fontSize:11, cursor:"pointer" }}>Dismiss</button>
        </div>
      )}

      <div style={{ display:"flex", flex:1, overflow:"hidden" }}>
        {/* ── SIDEBAR ── */}
        <div style={{
          width: sidebar ? 220 : 52,
          background: `linear-gradient(180deg, ${T.bg1} 0%, ${T.bg0} 100%)`,
          borderRight: `1px solid ${T.border}`,
          display: "flex", flexDirection: "column",
          transition: "width .22s cubic-bezier(.4,0,.2,1)",
          flexShrink: 0, overflow: "hidden",
        }}>
          {/* Logo */}
          <div style={{ padding: "18px 14px", borderBottom: `1px solid ${T.border}`, display:"flex", alignItems:"center", gap:10, minHeight:60 }}>
            <div style={{
              width:30, height:30, flexShrink:0,
              background: `linear-gradient(135deg, ${T.gold}55, ${T.gold}22)`,
              border: `1px solid ${T.gold}66`,
              borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:14, color: T.gold, boxShadow: `0 0 20px ${T.goldGlow}`,
            }}>⬡</div>
            {sidebar && (
              <div>
                <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:700, color:T.text0, letterSpacing:2, textTransform:"uppercase" }}>PeakGuard</div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8, color:T.goldDim, letterSpacing:3, textTransform:"uppercase" }}>AI Platform</div>
              </div>
            )}
          </div>

          {/* Live pulse */}
          {sidebar && (
            <div style={{ padding:"10px 16px", borderBottom:`1px solid ${T.border}`, display:"flex", alignItems:"center", gap:10 }}>
              <LiveDot />
              <Mono color={T.green} size={10}>LIVE · {liveKw} kW</Mono>
            </div>
          )}

          {/* Nav items */}
          <nav style={{ flex:1, padding:"10px 0", overflowY:"auto" }}>
            {NAV.filter(n => !n.adminOnly || isAdmin).map(n => (
              <button key={n.id} onClick={() => go(n.id)}
                className={`nav-btn ${page===n.id?"active":""}`}
                style={{
                  width:"100%", background: page===n.id ? T.bg3 : "none",
                  borderLeft: `2px solid ${page===n.id ? T.gold : "transparent"}`,
                  border:"none", borderLeft: `2px solid ${page===n.id ? T.gold : "transparent"}`,
                  color: page===n.id ? T.gold : T.text2,
                  padding: sidebar ? "11px 16px" : "11px 0",
                  display:"flex", alignItems:"center", justifyContent: sidebar ? "flex-start" : "center",
                  gap:10, cursor:"pointer",
                  fontFamily:"'JetBrains Mono',monospace", fontSize:11, letterSpacing:.5,
                }}>
                <span style={{ fontSize:15, flexShrink:0, lineHeight:1 }}>{n.ico}</span>
                {sidebar && n.label}
              </button>
            ))}
          </nav>

          {/* Role switcher */}
          {sidebar && (
            <div style={{ padding:"14px 16px", borderTop:`1px solid ${T.border}` }}>
              <Label>Demo Role</Label>
              <select value={role} onChange={e=>setRole(e.target.value)} style={{
                width:"100%", background: T.bg3, border:`1px solid ${T.border}`,
                color:T.gold, padding:"7px 10px", borderRadius:6,
                fontFamily:"'JetBrains Mono',monospace", fontSize:11,
              }}>
                <option value="viewer">Viewer</option>
                <option value="operator">Operator</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          )}

          <button onClick={() => setSidebar(v=>!v)} style={{
            background:"none", border:"none", borderTop:`1px solid ${T.border}`,
            color:T.text3, padding:"10px", cursor:"pointer", fontSize:14,
            fontFamily:"inherit", transition:"color .2s",
          }}>{sidebar ? "◂" : "▸"}</button>
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
          {/* Top bar */}
          <div style={{
            background:`linear-gradient(90deg, ${T.bg1} 0%, ${T.bg0} 100%)`,
            borderBottom:`1px solid ${T.border}`,
            padding:"0 24px", height:52,
            display:"flex", alignItems:"center", justifyContent:"space-between",
          }}>
            <div style={{ display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:15, fontWeight:700, color:T.text0, letterSpacing:1, textTransform:"uppercase" }}>
                {NAV.find(n=>n.id===page)?.label}
              </div>
              <div style={{ width:1, height:16, background:T.border }} />
              <Mono color={T.text2} size={10}>THU 19 FEB 2026  ·  09:42 UTC</Mono>
            </div>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <div style={{ padding:"5px 14px", background:T.bg2, border:`1px solid ${T.border}`, borderRadius:6, display:"flex", gap:8 }}>
                <Mono color={T.text2} size={10}>Facility:</Mono>
                <Mono color={T.cyan} size={10}>Westbrook Campus</Mono>
              </div>
              <div style={{ padding:"5px 14px", background:`${T.goldGlow}`, border:`1px solid ${T.gold}33`, borderRadius:6 }}>
                <Mono color={T.gold} size={10}>{role.toUpperCase()}</Mono>
              </div>
            </div>
          </div>

          {/* Page */}
          <div style={{ flex:1, overflowY:"auto", padding:24 }}>
            {loading ? (
              <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
                <div style={{ display:"flex", gap:16 }}>{[1,2,3,4].map(i=><Skeleton key={i} h={90} />)}</div>
                <Skeleton h={320} r={12} />
                <Skeleton h={200} r={12} />
              </div>
            ) : (
              <div style={{ animation:"fadeUp .3s ease" }}>
                {page==="dashboard"   && <Dashboard chartData={chartData} liveKw={liveKw} suggs={suggs} perms={perms} approve={approve} fire={fire} />}
                {page==="forecast"    && <Forecast chartData={chartData} />}
                {page==="suggestions" && <Suggestions suggs={suggs} perms={perms} approve={approve} fire={fire} />}
                {page==="loads"       && <Loads loads={loads} setLoads={setLoads} perms={perms} fire={fire} />}
                {page==="calendar"    && <CalendarPage />}
                {page==="reports"     && <Reports />}
                {page==="audit"       && <AuditLog />}
                {page==="admin"       && <Admin perms={perms} />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{
          position:"fixed", bottom:28, right:28, zIndex:9999,
          background: toast.type==="err" ? "#1a0505" : T.bg2,
          border:`1px solid ${toast.type==="err" ? "#7f1d1d" : T.green+"55"}`,
          padding:"12px 20px", borderRadius:10,
          boxShadow:"0 20px 60px rgba(0,0,0,.7)",
          animation:"fadeUp .25s ease",
          display:"flex", alignItems:"center", gap:10,
        }}>
          <span style={{ color: toast.type==="err" ? T.red : T.green, fontSize:12 }}>
            {toast.type==="err" ? "✕" : "✓"}
          </span>
          <Mono color={toast.type==="err" ? "#fca5a5" : "#a7f3d0"} size={12}>{toast.msg}</Mono>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
function KPICard({ label, value, sub, alert, color }) {
  const c = color || (alert ? T.red : T.cyan);
  return (
    <div className="kpi-card" style={{
      flex:1, minWidth:160,
      background:`linear-gradient(135deg, ${T.bg2} 0%, ${T.surface} 100%)`,
      border:`1px solid ${alert ? T.red+"33" : T.border}`,
      borderRadius:12, padding:"20px 22px",
      boxShadow: alert ? `0 0 30px ${T.redGlow}` : "none",
      position:"relative", overflow:"hidden",
    }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:`linear-gradient(90deg, transparent, ${c}55, transparent)` }} />
      <Label>{label}</Label>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:26, fontWeight:700, color:T.text0, lineHeight:1, animation:"number-tick .4s ease" }}>{value}</div>
      {sub && <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.text2, marginTop:8 }}>{sub}</div>}
      <div style={{ position:"absolute", bottom:0, right:0, width:60, height:60, borderRadius:"50%", background:`radial-gradient(circle, ${c}11 0%, transparent 70%)`, transform:"translate(20px,20px)" }} />
    </div>
  );
}

function Dashboard({ chartData, liveKw, suggs, perms, approve, fire }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {/* KPIs */}
      <div style={{ display:"flex", gap:14, flexWrap:"wrap" }}>
        <KPICard label="Current Load" value={`${liveKw} kW`} sub="↻ Live — updating every 2s" alert={liveKw>450} />
        <KPICard label="Peak Prediction" value="712 kW" sub="Expected 16:30 today" alert color={T.amber} />
        <KPICard label="Expected Cost" value="$3,840" sub="Without intervention" color={T.text1} />
        <KPICard label="Potential Savings" value="$680" sub="With 3 suggested actions" color={T.green} />
      </div>

      <div style={{ display:"flex", gap:20 }}>
        {/* Main chart */}
        <GlassCard style={{ flex:1 }}>
          <CardHeader
            title="Load Forecast — Today"
            sub="Historical actuals + AI prediction with 90% confidence band"
            action={
              <div style={{ display:"flex", gap:16 }}>
                {[["─", T.cyan, "Forecast"],["─", T.green, "Actual"]].map(([sym,c,l]) => (
                  <div key={l} style={{ display:"flex", gap:6, alignItems:"center" }}>
                    <span style={{ color:c, fontSize:14, fontFamily:"monospace" }}>{sym}</span>
                    <Mono color={T.text2} size={10}>{l}</Mono>
                  </div>
                ))}
              </div>
            }
          />
          <div style={{ padding:"20px 20px 16px" }}>
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={chartData} margin={{ left:-10, right:10 }}>
                <defs>
                  <linearGradient id="dg1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.cyan} stopOpacity={.18} />
                    <stop offset="100%" stopColor={T.cyan} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.amber} stopOpacity={.06} />
                    <stop offset="100%" stopColor={T.amber} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={T.border} vertical={false} />
                <XAxis dataKey="time" tick={{ fill:T.text2, fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:T.text2, fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} unit=" kW" width={64} />
                <Tooltip content={<ChartTip />} />
                <ReferenceLine x="15:00" stroke={T.red} strokeDasharray="3 5" strokeWidth={1} label={{ value:"PEAK START", fill:T.red, fontSize:8, fontFamily:"JetBrains Mono", dy:-8 }} />
                <ReferenceLine x="18:00" stroke={T.red} strokeDasharray="3 5" strokeWidth={1} />
                {/* Confidence band */}
                <Area type="monotone" dataKey="upper" stroke="none" fill="url(#dg2)" fillOpacity={1} name="Upper CI" />
                <Area type="monotone" dataKey="lower" stroke="none" fill={T.bg1} fillOpacity={1} name="Lower CI" />
                {/* Main lines */}
                <Area type="monotone" dataKey="forecast" stroke={T.cyan} strokeWidth={2} fill="url(#dg1)" dot={false} name="Forecast" />
                <Line type="monotone" dataKey="historical" stroke={T.green} strokeWidth={1.5} dot={false} connectNulls={false} name="Actual" strokeDasharray="0" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        {/* Quick Actions */}
        <GlassCard style={{ width:272, display:"flex", flexDirection:"column" }} glow={T.redGlow}>
          <CardHeader title="Quick Actions" sub="Top AI recs · Peak window 15:00" />
          <div style={{ padding:"14px 16px", display:"flex", flexDirection:"column", gap:10, flex:1 }}>
            {suggs[0].actions.map((a, idx) => (
              <div key={a.id} className="action-card" style={{
                background: T.bg0, border:`1px solid ${T.border}`,
                borderRadius:10, padding:"12px 14px",
                opacity: a.ok ? .55 : 1, transition:"all .2s",
                animationDelay:`${idx*80}ms`,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                  <Mono color={T.cyan} size={11}>{a.load}</Mono>
                  <Mono color={T.green} size={12}>−{a.kw} kW</Mono>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <Mono color={T.text2} size={10}>{a.type}</Mono>
                  <ComfortBar score={a.comfort} />
                </div>
                {perms.approve && !a.ok ? (
                  <BtnPrimary small onClick={() => approve(suggs[0].id, a.id)}>ACCEPT →</BtnPrimary>
                ) : a.ok ? (
                  <Mono color={T.green} size={10}>✓ SCHEDULED</Mono>
                ) : (
                  <Mono color={T.text3} size={10}>View only</Mono>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Risk Timeline */}
      <GlassCard>
        <CardHeader title="24-Hour Risk Timeline" sub="Hover to inspect load forecast per interval" />
        <div style={{ padding:"16px 20px 20px" }}>
          <div style={{ display:"flex", gap:3, height:40, borderRadius:8, overflow:"hidden" }}>
            {chartData.map((d, i) => {
              const p = d.isPeak ? 1 : d.forecast > 450 ? 0.6 : d.forecast > 380 ? 0.3 : 0.05;
              const col = d.isPeak ? T.red : d.forecast>450 ? T.amber : d.forecast>380 ? T.gold+"66" : T.border;
              return (
                <div key={i} title={`${d.time} · ${d.forecast} kW`} style={{
                  flex:1, background:col, opacity:.85,
                  cursor:"pointer", transition:"all .15s", borderRadius:2,
                }} />
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
            {["00:00","06:00","12:00","15:00","18:00","23:00"].map(t => <Mono key={t} color={T.text3} size={9}>{t}</Mono>)}
          </div>
          <div style={{ display:"flex", gap:20, marginTop:14 }}>
            {[[T.border,"Low"],[T.gold+"66","Elevated"],[T.amber,"Medium"],[T.red,"High — Action Required"]].map(([c,l]) => (
              <div key={l} style={{ display:"flex", gap:7, alignItems:"center" }}>
                <div style={{ width:12, height:12, background:c, borderRadius:2 }} />
                <Mono color={T.text2} size={10}>{l}</Mono>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   FORECAST
═══════════════════════════════════════════════════════════════ */
function Forecast({ chartData }) {
  const [horizon, setH] = useState("24h");
  const [res, setR] = useState("1h");
  const SegControl = ({ opts, val, set }) => (
    <div style={{ display:"flex", background:T.bg2, borderRadius:6, padding:2, border:`1px solid ${T.border}` }}>
      {opts.map(o => (
        <button key={o} onClick={() => set(o)} style={{
          padding:"4px 12px", borderRadius:4, background: val===o ? T.bg3 : "none",
          border: val===o ? `1px solid ${T.borderBright}` : "1px solid transparent",
          color: val===o ? T.text0 : T.text2,
          fontFamily:"'JetBrains Mono',monospace", fontSize:10, cursor:"pointer", transition:"all .15s",
        }}>{o}</button>
      ))}
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", gap:20, alignItems:"center" }}>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}><Mono size={10}>Horizon</Mono><SegControl opts={["24h","48h","7d"]} val={horizon} set={setH} /></div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}><Mono size={10}>Resolution</Mono><SegControl opts={["15m","1h","4h"]} val={res} set={setR} /></div>
      </div>

      <GlassCard>
        <CardHeader title="Load Forecast Curve" sub="AI demand prediction with confidence intervals" />
        <div style={{ padding:"16px 20px 20px" }}>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={chartData} margin={{ left:-10, right:10 }}>
              <defs>
                <linearGradient id="fg1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={T.gold} stopOpacity={.2} />
                  <stop offset="100%" stopColor={T.gold} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke={T.border} vertical={false} />
              <XAxis dataKey="time" tick={{ fill:T.text2, fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:T.text2, fontSize:10, fontFamily:"JetBrains Mono" }} axisLine={false} unit=" kW" width={64} />
              <Tooltip content={<ChartTip />} />
              <Area type="monotone" dataKey="upper" stroke="none" fill={T.amber+"0a"} />
              <Area type="monotone" dataKey="forecast" stroke={T.gold} strokeWidth={2} fill="url(#fg1)" dot={false} name="Forecast" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader title="Peak Probability Heatmap" sub="Hour-by-hour demand peak likelihood" />
        <div style={{ padding:"16px 20px 20px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(24, 1fr)", gap:3, height:72 }}>
            {chartData.map((d, i) => {
              const prob = d.isPeak ? .82+Math.random()*.12 : Math.random()*.25;
              return (
                <div key={i} title={`${d.time} · ${Math.round(prob*100)}%`} style={{
                  borderRadius:4, cursor:"pointer",
                  background:`rgba(248,113,113,${prob*0.9})`,
                  display:"flex", flexDirection:"column", justifyContent:"flex-end",
                  alignItems:"center", paddingBottom:4,
                }}>
                  <span style={{ fontSize:7, color:`rgba(255,255,255,${Math.max(0,prob-.2)})`, fontFamily:"JetBrains Mono" }}>{d.time.slice(0,2)}</span>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:10 }}>
            <Mono size={9} color={T.text3}>0% probability</Mono>
            <Mono size={9} color={T.text3}>100% probability</Mono>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <CardHeader title="Cost Projection" sub="Estimated demand charges ($/interval)" />
        <div style={{ padding:"16px 20px 20px" }}>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData.filter((_,i)=>i%2===0)} margin={{ left:-10, right:10 }}>
              <CartesianGrid strokeDasharray="2 6" stroke={T.border} vertical={false} />
              <XAxis dataKey="time" tick={{ fill:T.text2, fontSize:9, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill:T.text2, fontSize:9, fontFamily:"JetBrains Mono" }} axisLine={false} unit=" $" width={50} />
              <Tooltip content={<ChartTip />} />
              <Bar dataKey="forecast" fill={T.cyanDim} opacity={.7} radius={[3,3,0,0]} name="Est. Cost" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUGGESTIONS
═══════════════════════════════════════════════════════════════ */
function Suggestions({ suggs, perms, approve, fire }) {
  const [simId, setSimId] = useState(null);

  const simulate = (id) => {
    setSimId(id);
    setTimeout(() => { setSimId(null); fire("Simulation complete — projected peak reduction: 164 kW"); }, 2200);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {suggs.map((s, si) => {
        const total = s.actions.reduce((a,b) => a+b.kw, 0);
        const approved = s.actions.filter(a=>a.ok).length;
        return (
          <GlassCard key={s.id} style={{ animationDelay:`${si*80}ms` }}>
            {/* Header */}
            <div style={{
              padding:"16px 20px",
              borderBottom:`1px solid ${T.border}`,
              background:`linear-gradient(90deg, ${T.redGlow}, transparent)`,
              display:"flex", justifyContent:"space-between", alignItems:"center",
            }}>
              <div style={{ display:"flex", gap:24, alignItems:"center" }}>
                <div>
                  <div style={{ fontFamily:"'Syne',sans-serif", fontSize:14, fontWeight:700, color:T.text0 }}>Peak Window</div>
                  <Mono color={T.gold} size={13}>{s.window}</Mono>
                </div>
                <Divider style={{ width:1, height:32, background:T.border, display:"inline-block" }} />
                <div><Label>Required</Label><Mono color={T.red} size={13}>{s.reduce} kW</Mono></div>
                <div><Label>Confidence</Label><Mono color={T.green} size={13}>{s.conf}%</Mono></div>
                <div><Label>Potential</Label><Mono color={T.cyan} size={13}>−{total} kW</Mono></div>
                <div><Label>Approved</Label><Mono color={T.text1} size={13}>{approved}/{s.actions.length}</Mono></div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                {perms.execute && <BtnGhost small onClick={() => simulate(s.id)}>{simId===s.id ? "⟳ Simulating…" : "Simulate"}</BtnGhost>}
                {perms.approve && <BtnPrimary small onClick={() => fire("All actions approved and scheduled")}>Approve All</BtnPrimary>}
                <BtnDanger small onClick={() => fire("Plan rejected — reason logged", "err")}>Reject</BtnDanger>
              </div>
            </div>

            {/* Action rows */}
            <div style={{ padding:"0 20px" }}>
              <div style={{
                display:"grid", gridTemplateColumns:"2fr 1fr 80px 100px 100px 120px",
                padding:"10px 0", borderBottom:`1px solid ${T.border}`,
              }}>
                {["Load","Action","Duration","Reduction","Comfort","Status"].map(h=>(
                  <Label key={h}>{h}</Label>
                ))}
              </div>
              {s.actions.map((a, ai) => (
                <div key={a.id} style={{
                  display:"grid", gridTemplateColumns:"2fr 1fr 80px 100px 100px 120px",
                  alignItems:"center", padding:"13px 0",
                  borderBottom: ai < s.actions.length-1 ? `1px solid ${T.bg0}` : "none",
                  opacity: a.ok ? .5 : 1, transition:"opacity .3s",
                }}>
                  <Mono color={T.text0} size={12}>{a.load}</Mono>
                  <Mono color={T.text2} size={11}>{a.type}</Mono>
                  <Mono color={T.text2} size={11}>{a.dur}h</Mono>
                  <Mono color={T.green} size={12}>−{a.kw} kW</Mono>
                  <ComfortBar score={a.comfort} />
                  <div>
                    {a.ok ? (
                      <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                        <span style={{ color:T.green, fontSize:11 }}>✓</span>
                        <Mono color={T.green} size={10}>Scheduled</Mono>
                      </div>
                    ) : perms.approve ? (
                      <button onClick={() => approve(s.id, a.id)} style={{
                        background:`${T.green}15`, border:`1px solid ${T.green}44`,
                        color:T.green, padding:"5px 12px", borderRadius:5,
                        fontFamily:"'JetBrains Mono',monospace", fontSize:10, cursor:"pointer",
                        transition:"all .15s",
                      }}>Approve</button>
                    ) : (
                      <Mono color={T.text3} size={10}>Pending</Mono>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOADS
═══════════════════════════════════════════════════════════════ */
function Loads({ loads, setLoads, perms, fire }) {
  const [sel, setSel] = useState(null);
  const [tab, setTab] = useState("config");

  const toggle = (id) => {
    if (!perms.editLoads) return fire("Admin access required to edit loads", "err");
    setLoads(p => p.map(l => l.id===id ? {...l,ctrl:!l.ctrl} : l));
    fire("Load configuration saved");
  };

  const TABS = ["config","constraints","endpoint","test"];

  return (
    <div style={{ display:"flex", gap:20 }}>
      <GlassCard style={{ flex:1, overflow:"hidden" }}>
        <CardHeader
          title="Load Inventory"
          sub={`${loads.length} loads registered · ${loads.filter(l=>l.ctrl).length} controllable`}
          action={perms.editLoads && <BtnPrimary small>+ Add Load</BtnPrimary>}
        />
        <div style={{ overflowX:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead>
              <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                {["Name","Location","Avg kW","Criticality","Ctrl","Status","Response",""].map(h=>(
                  <th key={h} style={{ padding:"10px 16px", textAlign:"left" }}><Label>{h}</Label></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loads.map(l => (
                <tr key={l.id} className="row-hover" onClick={() => setSel(l)} style={{
                  borderBottom:`1px solid ${T.bg1}`,
                  background: sel?.id===l.id ? T.bg3 : "transparent",
                  cursor:"pointer", transition:"background .15s",
                }}>
                  <td style={{ padding:"13px 16px" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <LiveDot color={l.status==="online" ? T.green : T.text3} />
                      <Mono color={T.text0} size={12}>{l.name}</Mono>
                    </div>
                  </td>
                  <td style={{ padding:"13px 16px" }}><Mono color={T.text2} size={11}>{l.loc}</Mono></td>
                  <td style={{ padding:"13px 16px" }}><Mono color={T.cyan} size={12}>{l.kw}</Mono></td>
                  <td style={{ padding:"13px 16px" }}><Chip label={l.crit} /></td>
                  <td style={{ padding:"13px 16px" }}>
                    <div onClick={e=>{e.stopPropagation();toggle(l.id)}} style={{
                      width:38, height:21, borderRadius:11,
                      background: l.ctrl ? `linear-gradient(90deg,${T.cyanDim},${T.cyan})` : T.bg3,
                      border:`1px solid ${l.ctrl ? T.cyan+"44" : T.border}`,
                      position:"relative", cursor:"pointer", transition:"all .25s",
                      boxShadow: l.ctrl ? `0 0 10px ${T.cyanGlow}` : "none",
                    }}>
                      <div style={{
                        position:"absolute", top:2, left: l.ctrl ? 19 : 2,
                        width:15, height:15, borderRadius:"50%",
                        background: l.ctrl ? "#fff" : T.text3,
                        transition:"left .22s, background .22s",
                        boxShadow:"0 1px 3px rgba(0,0,0,.4)",
                      }} />
                    </div>
                  </td>
                  <td style={{ padding:"13px 16px" }}><Chip label={l.status} /></td>
                  <td style={{ padding:"13px 16px" }}><Mono color={T.text3} size={10}>{l.last} ago</Mono></td>
                  <td style={{ padding:"13px 16px" }}><BtnGhost small>Edit</BtnGhost></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Drawer */}
      {sel && (
        <GlassCard style={{ width:300, flexShrink:0, display:"flex", flexDirection:"column", animation:"fadeUp .2s ease" }}>
          <div style={{ padding:"16px 18px", borderBottom:`1px solid ${T.border}`, display:"flex", justifyContent:"space-between" }}>
            <div>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:13, fontWeight:600, color:T.text0, marginBottom:3 }}>{sel.name}</div>
              <Mono color={T.text2} size={10}>{sel.loc} · {sel.kw} kW avg</Mono>
            </div>
            <button onClick={()=>setSel(null)} style={{ background:"none", border:`1px solid ${T.border}`, color:T.text2, width:26, height:26, borderRadius:6, cursor:"pointer", fontSize:13 }}>×</button>
          </div>

          <div style={{ display:"flex", borderBottom:`1px solid ${T.border}` }}>
            {TABS.map(t => (
              <button key={t} onClick={()=>setTab(t)} className="tab-btn" style={{
                flex:1, padding:"9px 4px", background: tab===t ? T.bg3 : "none",
                border:"none", borderBottom: tab===t ? `2px solid ${T.gold}` : "2px solid transparent",
                color: tab===t ? T.gold : T.text2,
                fontFamily:"'JetBrains Mono',monospace", fontSize:9, textTransform:"uppercase", letterSpacing:1, cursor:"pointer",
              }}>{t}</button>
            ))}
          </div>

          <div style={{ padding:18, flex:1, overflowY:"auto" }}>
            {tab==="config" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {[["Name",sel.name],["Location",sel.loc],["Avg kW",`${sel.kw}`],["Criticality",sel.crit]].map(([k,v])=>(
                  <div key={k}>
                    <Label>{k}</Label>
                    <input defaultValue={v} disabled={!perms.editLoads} style={{
                      width:"100%", background:T.bg0, border:`1px solid ${T.border}`,
                      color: perms.editLoads ? T.text0 : T.text2,
                      padding:"8px 10px", borderRadius:6,
                      fontFamily:"'JetBrains Mono',monospace", fontSize:11,
                    }} />
                  </div>
                ))}
                {perms.editLoads && <BtnPrimary onClick={() => fire("Configuration saved")}>Save Changes</BtnPrimary>}
              </div>
            )}
            {tab==="constraints" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {[["Min kW","50"],["Max kW","220"],["Min Off (min)","15"],["Max Off (min)","120"]].map(([k,v])=>(
                  <div key={k}>
                    <Label>{k}</Label>
                    <input defaultValue={v} disabled={!perms.editLoads} style={{ width:"100%", background:T.bg0, border:`1px solid ${T.border}`, color:T.text0, padding:"8px 10px", borderRadius:6, fontFamily:"'JetBrains Mono',monospace", fontSize:11 }} />
                  </div>
                ))}
              </div>
            )}
            {tab==="endpoint" && (
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {[["API Endpoint","https://bms.local/api/v2/loads/42"],["Auth Token","••••••••••••••••"]].map(([k,v])=>(
                  <div key={k}>
                    <Label>{k}</Label>
                    <input defaultValue={v} type={k==="Auth Token"?"password":"text"} style={{ width:"100%", background:T.bg0, border:`1px solid ${T.border}`, color:T.text0, padding:"8px 10px", borderRadius:6, fontFamily:"'JetBrains Mono',monospace", fontSize:11 }} />
                  </div>
                ))}
              </div>
            )}
            {tab==="test" && (
              <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                <Mono size={11}>Send a test command to verify BMS connectivity.</Mono>
                <BtnGhost onClick={() => fire("Test command sent — 200 OK · 38ms")}>⬡ Send Test Command</BtnGhost>
                <div style={{ background:T.bg0, border:`1px solid ${T.border}`, borderRadius:8, padding:"12px 14px", fontFamily:"'JetBrains Mono',monospace", fontSize:10, lineHeight:1.8 }}>
                  <div><span style={{color:T.text3}}>{">"} </span><span style={{color:T.green}}>Connected</span></div>
                  <div><span style={{color:T.text3}}>{">"} </span><span style={{color:T.text1}}>Status: 200 OK</span></div>
                  <div><span style={{color:T.text3}}>{">"} </span><span style={{color:T.text1}}>Latency: 38ms</span></div>
                  <div><span style={{color:T.text3}}>{">"} </span><span style={{color:T.cyan}}>Last check: 2s ago</span></div>
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CALENDAR
═══════════════════════════════════════════════════════════════ */
const EVENTS = [
  {d:3,type:"holiday",label:"Holiday"},
  {d:7,type:"maintenance",label:"Maintenance"},
  {d:12,type:"exam",label:"Exam Period"},
  {d:15,type:"peak",label:"Peak Warning"},
  {d:19,type:"today",label:"Today"},
  {d:22,type:"custom",label:"Special Event"},
  {d:28,type:"maintenance",label:"Scheduled Maint."},
];
const EV_COLOR = { holiday:T.cyan, maintenance:T.amber, exam:"#a78bfa", peak:T.red, today:T.gold, custom:"#22d3ee" };

function CalendarPage() {
  const days = Array.from({length:28},(_,i)=>i+1);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:18, fontWeight:700, color:T.text0 }}>February 2026</div>
        <div style={{ display:"flex", gap:16 }}>
          {Object.entries(EV_COLOR).filter(([k])=>k!=="today").map(([t,c])=>(
            <div key={t} style={{ display:"flex", gap:6, alignItems:"center" }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:c }} />
              <Mono color={T.text2} size={10}>{t}</Mono>
            </div>
          ))}
        </div>
      </div>
      <GlassCard style={{ overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", borderBottom:`1px solid ${T.border}` }}>
          {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(d=>(
            <div key={d} style={{ padding:"10px", textAlign:"center" }}><Label>{d}</Label></div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)" }}>
          {days.map(d => {
            const ev = EVENTS.find(e=>e.d===d);
            const isToday = d===19;
            const c = ev ? EV_COLOR[ev.type] : null;
            return (
              <div key={d} className="row-hover" style={{
                minHeight:84, padding:"10px 10px 8px",
                borderRight:`1px solid ${T.bg1}`, borderBottom:`1px solid ${T.bg1}`,
                background: isToday ? `${T.gold}0a` : "transparent",
                cursor:"pointer", transition:"background .15s",
              }}>
                <div style={{
                  fontFamily:"'JetBrains Mono',monospace", fontSize:12,
                  color: isToday ? T.gold : T.text2, fontWeight: isToday ? 600 : 400,
                  width:24, height:24, borderRadius:"50%",
                  border: isToday ? `1px solid ${T.gold}66` : "none",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow: isToday ? `0 0 10px ${T.goldGlow}` : "none",
                }}>{d}</div>
                {ev && (
                  <div style={{
                    marginTop:6,
                    background:`${c}15`,
                    borderLeft:`2px solid ${c}`,
                    borderRadius:"0 4px 4px 0",
                    padding:"3px 7px",
                  }}>
                    <Mono color={c} size={9}>{ev.label}</Mono>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REPORTS
═══════════════════════════════════════════════════════════════ */
function Reports() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, fontWeight:700, color:T.text0 }}>Performance Reports — 2025</div>
        <div style={{ display:"flex", gap:8 }}>
          <BtnGhost small>Export CSV</BtnGhost>
          <BtnGhost small>Export PDF</BtnGhost>
        </div>
      </div>

      {/* Summary strip */}
      <div style={{ display:"flex", gap:14 }}>
        {[["Peaks Avoided","247",T.green],["kW Reduced (YTD)","18,430",T.cyan],["Savings (YTD)","$41,200",T.gold],["Avg Decision","2.4 min",T.text1],["Uptime","99.7%",T.green]].map(([k,v,c])=>(
          <div key={k} style={{
            flex:1, background:T.bg2, border:`1px solid ${T.border}`,
            borderRadius:10, padding:"14px 16px",
          }}>
            <Label>{k}</Label>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:18 }}>
        <GlassCard>
          <CardHeader title="Peak Reduction Trend" sub="Actual vs. target kW reduction" />
          <div style={{ padding:"16px 20px 20px" }}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={REPORT.peak} margin={{ left:-10, right:10 }}>
                <CartesianGrid strokeDasharray="2 6" stroke={T.border} vertical={false} />
                <XAxis dataKey="m" tick={{ fill:T.text2, fontSize:9, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:T.text2, fontSize:9, fontFamily:"JetBrains Mono" }} axisLine={false} unit=" kW" width={48} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="actual" fill={T.cyan} opacity={.75} radius={[3,3,0,0]} name="Actual" />
                <Line type="monotone" dataKey="target" stroke={T.amber} strokeWidth={1.5} dot={false} name="Target" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard>
          <CardHeader title="Cost Savings" sub="Monthly demand charge savings ($)" />
          <div style={{ padding:"16px 20px 20px" }}>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={REPORT.savings} margin={{ left:-10, right:10 }}>
                <defs>
                  <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={T.green} stopOpacity={.2} />
                    <stop offset="100%" stopColor={T.green} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 6" stroke={T.border} vertical={false} />
                <XAxis dataKey="m" tick={{ fill:T.text2, fontSize:9, fontFamily:"JetBrains Mono" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill:T.text2, fontSize:9, fontFamily:"JetBrains Mono" }} axisLine={false} unit=" $" width={52} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey="v" stroke={T.green} strokeWidth={2} fill="url(#sg)" name="Savings" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <GlassCard>
        <CardHeader title="Action Acceptance Rate" sub="How operators responded to AI suggestions" />
        <div style={{ padding:"20px", display:"flex", gap:32, alignItems:"center" }}>
          {[["Accepted","68%",T.green],["Modified","18%",T.amber],["Rejected","14%",T.red]].map(([l,v,c])=>(
            <div key={l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'Syne',sans-serif", fontSize:36, fontWeight:800, color:c, lineHeight:1 }}>{v}</div>
              <Mono color={T.text2} size={10}>{l}</Mono>
            </div>
          ))}
          <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
            {[["Accepted",68,T.green],["Modified",18,T.amber],["Rejected",14,T.red]].map(([l,v,c])=>(
              <div key={l} style={{ display:"flex", gap:12, alignItems:"center" }}>
                <Mono color={T.text2} size={10} style={{ width:60 }}>{l}</Mono>
                <div style={{ flex:1, height:6, background:T.bg3, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ width:`${v}%`, height:"100%", background:c, borderRadius:3, transition:"width 1s ease", boxShadow:`0 0 8px ${c}55` }} />
                </div>
                <Mono color={c} size={11}>{v}%</Mono>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   AUDIT LOG
═══════════════════════════════════════════════════════════════ */
function AuditLog() {
  const [q, setQ] = useState("");
  const filtered = AUDIT.filter(l => !q || [l.user,l.action,l.load].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div style={{ display:"flex", gap:10 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter by user, action, or load…"
          style={{ flex:1, background:T.bg2, border:`1px solid ${T.border}`, color:T.text0, padding:"9px 14px", borderRadius:8, fontFamily:"'JetBrains Mono',monospace", fontSize:12 }} />
        {["User","Load","Date Range"].map(f=><BtnGhost key={f} small>{f}</BtnGhost>)}
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {filtered.map((l, i) => (
          <div key={l.id} style={{
            background:`linear-gradient(135deg, ${T.bg2}, ${T.surface})`,
            border:`1px solid ${T.border}`,
            borderRadius:10, padding:"14px 18px",
            display:"flex", alignItems:"flex-start", gap:16,
            animation:`fadeUp .3s ease ${i*50}ms both`,
            borderLeft:`3px solid ${l.result==="success" ? T.green : l.result==="rejected" ? T.amber : T.red}`,
          }}>
            <div style={{ paddingTop:2, flexShrink:0 }}>
              <Mono color={T.text3} size={10}>{l.ts}</Mono>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:6 }}>
                <Mono color={T.text0} size={12}>{l.action}</Mono>
                <Chip label={l.result} />
              </div>
              <div style={{ display:"flex", gap:16, marginBottom: l.from!=="—" ? 10 : 0 }}>
                <div style={{ display:"flex", gap:6 }}>
                  <Mono color={T.text3} size={10}>User</Mono>
                  <Chip label={l.role} style={{ fontSize:9, padding:"1px 7px" }} />
                  <Mono color={T.text2} size={10}>{l.user}</Mono>
                </div>
                <div style={{ display:"flex", gap:6 }}>
                  <Mono color={T.text3} size={10}>Load</Mono>
                  <Mono color={T.text1} size={10}>{l.load}</Mono>
                </div>
              </div>
              {l.from !== "—" && (
                <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                  <code style={{ background:"#1e0909", border:`1px solid #7f1d1d44`, color:T.red, padding:"2px 10px", borderRadius:4, fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>{l.from}</code>
                  <span style={{ color:T.text3, fontSize:12 }}>→</span>
                  <code style={{ background:"#071a10", border:`1px solid ${T.green}33`, color:T.green, padding:"2px 10px", borderRadius:4, fontSize:10, fontFamily:"'JetBrains Mono',monospace" }}>{l.to}</code>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN
═══════════════════════════════════════════════════════════════ */
const USERS = [
  { name:"John Smith",  email:"j.smith@facility.com",  role:"admin",    last:"2m ago"  },
  { name:"Maria Jones", email:"m.jones@facility.com",  role:"operator", last:"1h ago"  },
  { name:"Raj Patel",   email:"r.patel@facility.com",  role:"operator", last:"3h ago"  },
  { name:"Sara Chen",   email:"s.chen@facility.com",   role:"viewer",   last:"1d ago"  },
];

function Admin({ perms }) {
  if (!perms.manageUsers) return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:360, gap:14 }}>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:48, color:T.border }}>⊘</div>
      <div style={{ fontFamily:"'Syne',sans-serif", fontSize:16, color:T.text2 }}>Access Restricted</div>
      <Mono color={T.text3} size={11}>Switch to Admin role to access user management</Mono>
    </div>
  );
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      <div style={{ display:"flex", gap:14 }}>
        {[["Total Users","4",T.text0],["Active Today","3",T.green],["Pending Invites","2",T.amber]].map(([k,v,c])=>(
          <div key={k} style={{ flex:1, background:T.bg2, border:`1px solid ${T.border}`, borderRadius:10, padding:"16px 20px" }}>
            <Label>{k}</Label>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:28, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      <GlassCard>
        <CardHeader title="User Management" sub="Manage roles and access permissions" action={<BtnPrimary small>+ Invite User</BtnPrimary>} />
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${T.border}` }}>
              {["Name","Email","Role","Last Active",""].map(h=>(
                <th key={h} style={{ padding:"10px 18px", textAlign:"left" }}><Label>{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {USERS.map(u=>(
              <tr key={u.email} className="row-hover" style={{ borderBottom:`1px solid ${T.bg1}`, transition:"background .15s" }}>
                <td style={{ padding:"13px 18px" }}><Mono color={T.text0} size={12}>{u.name}</Mono></td>
                <td style={{ padding:"13px 18px" }}><Mono color={T.text2} size={11}>{u.email}</Mono></td>
                <td style={{ padding:"13px 18px" }}><Chip label={u.role} /></td>
                <td style={{ padding:"13px 18px" }}><Mono color={T.text3} size={10}>{u.last}</Mono></td>
                <td style={{ padding:"13px 18px" }}><BtnGhost small>Edit</BtnGhost></td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassCard>
    </div>
  );
}
