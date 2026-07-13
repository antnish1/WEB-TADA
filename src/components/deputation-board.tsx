"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, ClipboardCheck, Cloud, LogOut, Plus, Save, Search, Send, Trash2, Users } from "lucide-react";
import { engineersByBranch, type Branch } from "@/lib/engineers";
import type { CallEntry, DailyStatus, EngineerPlan } from "@/lib/types";
import { createCall, hasOverlap, statusLabels, validatePlan, workStatuses } from "@/lib/utils";
import { loadPlansFromSupabase, savePlansToSupabase } from "@/lib/deputation-repository";
import { isSupabaseConfigured } from "@/lib/supabase";

const branches = Object.keys(engineersByBranch) as Branch[];
const today = new Date().toISOString().slice(0, 10);
const createPlans = (branch: Branch): EngineerPlan[] => engineersByBranch[branch].map((engineerName) => ({ engineerName, status: "NOT_FILLED", remarks: "", expanded: false, calls: [] }));

type DeputationBoardProps = {
  initialBranch?: Branch;
  branchLocked?: boolean;
  userLabel?: string;
  onLogout?: () => void | Promise<void>;
};

export function DeputationBoard({ initialBranch = "JABALPUR BHL", branchLocked = false, userLabel = "Branch Manager", onLogout }: DeputationBoardProps) {
  const safeInitialBranch = branches.includes(initialBranch) ? initialBranch : "JABALPUR BHL";
  const [branch, setBranch] = useState<Branch>(safeInitialBranch);
  const [date, setDate] = useState(today);
  const [plans, setPlans] = useState<EngineerPlan[]>(() => createPlans(safeInitialBranch));
  const [filter, setFilter] = useState<"ALL" | "PENDING" | DailyStatus>("ALL");
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<"local" | "supabase">("local");
  const storageKey = `tada-daily-plan:${branch}:${date}`;

  useEffect(() => {
    if (branchLocked && initialBranch && branches.includes(initialBranch)) setBranch(initialBranch);
  }, [branchLocked, initialBranch]);

  useEffect(() => {
    let active = true;
    async function load() {
      setBusy(true);
      setMessage("");
      try {
        const remote = await loadPlansFromSupabase(branch, date);
        if (active && remote?.length) {
          setPlans(remote);
          setSource("supabase");
          localStorage.setItem(storageKey, JSON.stringify(remote));
          return;
        }
      } catch (error) {
        console.warn("Supabase load failed; using local draft.", error);
      } finally {
        if (active) setBusy(false);
      }
      const saved = localStorage.getItem(storageKey);
      if (active) {
        setPlans(saved ? JSON.parse(saved) : createPlans(branch));
        setSource("local");
      }
    }
    void load();
    return () => { active = false; };
  }, [branch, date, storageKey]);

  useEffect(() => {
    const timer = window.setTimeout(() => localStorage.setItem(storageKey, JSON.stringify(plans)), 400);
    return () => window.clearTimeout(timer);
  }, [plans, storageKey]);

  const counts = useMemo(() => {
    const completed = plans.filter((p) => validatePlan(p).length === 0).length;
    return { total: plans.length, completed, pending: plans.length - completed, onsite: plans.filter((p) => p.status === "ONSITE").length, workshop: plans.filter((p) => p.status === "WORKSHOP").length, calls: plans.reduce((sum, p) => sum + p.calls.length, 0) };
  }, [plans]);

  const visiblePlans = plans.filter((plan) => plan.engineerName.toLowerCase().includes(search.toLowerCase()) && (filter === "ALL" || (filter === "PENDING" ? validatePlan(plan).length > 0 : plan.status === filter)));
  const updatePlan = (engineerName: string, patch: Partial<EngineerPlan>) => setPlans((current) => current.map((p) => p.engineerName === engineerName ? { ...p, ...patch } : p));
  const updateCall = (engineerName: string, callId: string, patch: Partial<CallEntry>) => setPlans((current) => current.map((p) => p.engineerName !== engineerName ? p : { ...p, calls: p.calls.map((c) => c.id === callId ? { ...c, ...patch } : c) }));

  function changeStatus(plan: EngineerPlan, status: DailyStatus) {
    const calls = workStatuses.includes(status) ? (plan.calls.length ? plan.calls.map((c) => ({ ...c, workshopOnsite: status === "WORKSHOP" ? "Workshop" as const : "Onsite" as const })) : [createCall(status)]) : [];
    updatePlan(plan.engineerName, { status, calls, expanded: true });
  }

  async function persist(finalize: boolean) {
    const invalid = plans.filter((p) => validatePlan(p).length > 0);
    if (finalize && invalid.length) {
      setFilter("PENDING");
      setMessage(`Cannot finalize: ${invalid.length} engineer${invalid.length === 1 ? "" : "s"} still need attention.`);
      return;
    }
    localStorage.setItem(storageKey, JSON.stringify(plans));
    setBusy(true);
    try {
      await savePlansToSupabase(branch, date, plans, finalize);
      setSource("supabase");
      setMessage(finalize ? `Finalized ${plans.length} engineers and ${counts.calls} calls in Supabase.` : "Draft saved permanently in Supabase.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unknown error";
      setSource("local");
      setMessage(`${finalize ? "Finalize" : "Cloud save"} unavailable: ${detail} Local draft is safe on this device.`);
    } finally {
      setBusy(false);
    }
  }

  return <main className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">FCV</div><div><strong>TADA</strong><span>Service Operations</span></div></div>
      <nav><button><ClipboardCheck size={18}/> Dashboard</button><button className="active"><Users size={18}/> Today&apos;s Deputation</button><button><ClipboardCheck size={18}/> All Deputations</button></nav>
      <div className="sidebar-note"><Cloud size={16}/> {isSupabaseConfigured ? `Data source: ${source}` : "Supabase not configured"}<br/><strong>{userLabel}</strong><br/>{branch}{onLogout && <button className="logout-link" onClick={() => void onLogout()}><LogOut size={15}/> Sign out</button>}</div>
    </aside>
    <section className="content">
      <header className="topbar"><div><p className="eyebrow">DAILY WORKFORCE PLANNING</p><h1>Today&apos;s Deputation</h1><p className="subtitle">Account for every active engineer and assign one or more calls.</p></div><div className="top-controls"><label>Branch<select value={branch} disabled={branchLocked} onChange={(e) => setBranch(e.target.value as Branch)}>{(branchLocked ? [branch] : branches).map((b) => <option key={b}>{b}</option>)}</select></label><label>Date<input type="date" value={date} onChange={(e) => setDate(e.target.value)}/></label></div></header>
      <section className="stats-grid"><Stat label="Total Engineers" value={counts.total}/><Stat label="Completed" value={counts.completed} positive/><Stat label="Pending" value={counts.pending} warning={counts.pending > 0}/><Stat label="Onsite" value={counts.onsite}/><Stat label="Workshop" value={counts.workshop}/><Stat label="Total Calls" value={counts.calls}/></section>
      <section className="toolbar panel"><div className="search-box"><Search size={17}/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search engineer"/></div><div className="filter-row">{(["ALL","PENDING","ONSITE","WORKSHOP","LEAVE","ABSENT"] as const).map((item) => <button key={item} className={filter === item ? "selected" : ""} onClick={() => setFilter(item)}>{item === "ALL" ? "All Engineers" : item === "PENDING" ? "Pending Only" : statusLabels[item]}</button>)}</div></section>
      {message && <div className={`notice ${message.startsWith("Cannot") || message.includes("unavailable") ? "error" : "success"}`}>{message.startsWith("Cannot") || message.includes("unavailable") ? <AlertTriangle size={18}/> : <CheckCircle2 size={18}/>} {message}</div>}
      <section className="roster">{visiblePlans.map((plan) => { const errors = validatePlan(plan); const overlap = hasOverlap(plan.calls); return <article className={`engineer-card ${errors.length ? "incomplete" : "complete"}`} key={plan.engineerName}>
        <div className="engineer-summary"><button className="expand" onClick={() => updatePlan(plan.engineerName, { expanded: !plan.expanded })}>{plan.expanded ? <ChevronDown/> : <ChevronRight/>}</button><div className="avatar">{plan.engineerName.split(" ").map((x) => x[0]).slice(0,2).join("")}</div><div className="engineer-name"><strong>{plan.engineerName}</strong><span>{plan.calls.length} call{plan.calls.length === 1 ? "" : "s"} assigned</span></div><select className="status-select" value={plan.status} onChange={(e) => changeStatus(plan, e.target.value as DailyStatus)}>{(Object.keys(statusLabels) as DailyStatus[]).map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}</select><div className={`validation-pill ${errors.length ? "bad" : "good"}`}>{errors.length ? `${errors.length} pending` : "Complete"}</div></div>
        {plan.expanded && <div className="engineer-details">{overlap && <div className="inline-warning"><AlertTriangle size={16}/> Planned call timings overlap.</div>}{workStatuses.includes(plan.status) ? <>{plan.calls.map((call, index) => <CallForm key={call.id} call={call} index={index} onChange={(patch) => updateCall(plan.engineerName, call.id, patch)} onRemove={() => updatePlan(plan.engineerName, { calls: plan.calls.filter((c) => c.id !== call.id) })} canRemove={plan.calls.length > 1}/>)}<button className="add-call" onClick={() => updatePlan(plan.engineerName, { calls: [...plan.calls, createCall(plan.status)], expanded: true })}><Plus size={17}/> Add another call</button></> : plan.status !== "NOT_FILLED" ? <label>Remarks / reason<textarea value={plan.remarks} onChange={(e) => updatePlan(plan.engineerName, { remarks: e.target.value })}/></label> : <div className="empty-state">Choose a daily status to account for this engineer.</div>}{errors.length > 0 && <ul className="error-list">{errors.slice(0,5).map((error) => <li key={error}>{error}</li>)}</ul>}</div>}
      </article>; })}</section>
      <footer className="action-bar"><div><strong>{counts.completed}/{counts.total} engineers complete</strong><span>{counts.calls} calls planned for {branch}</span></div><button className="secondary" disabled={busy} onClick={() => void persist(false)}><Save size={18}/> {busy ? "Saving..." : "Save Draft"}</button><button className="primary" disabled={busy} onClick={() => void persist(true)}><Send size={18}/> Finalize & Notify</button></footer>
    </section>
  </main>;
}

function Stat({ label, value, positive, warning }: {label: string; value: number; positive?: boolean; warning?: boolean}) { return <div className={`stat ${positive ? "positive" : ""} ${warning ? "warning" : ""}`}><span>{label}</span><strong>{value}</strong></div>; }
function CallForm({ call, index, onChange, onRemove, canRemove }: {call: CallEntry; index: number; onChange: (patch: Partial<CallEntry>) => void; onRemove: () => void; canRemove: boolean}) { return <section className="call-card"><div className="call-header"><div><span className="call-number">CALL {index + 1}</span><strong>{call.machineNo || "New deputation call"}</strong></div>{canRemove && <button className="icon-danger" onClick={onRemove}><Trash2 size={17}/></button>}</div><div className="form-grid"><Field label="Workshop / Onsite"><select value={call.workshopOnsite} onChange={(e) => onChange({workshopOnsite: e.target.value as CallEntry["workshopOnsite"]})}><option>Onsite</option><option>Workshop</option></select></Field><Field label="Call Type"><select value={call.callType} onChange={(e) => onChange({callType: e.target.value})}>{["U/W","B/W","ASC","P/T","JCB CARE","FREE SERVICE","INSTALLATION","CAMPAIGN","OTHER"].map(x => <option key={x}>{x}</option>)}</select></Field><Field label="Engineer Role"><select value={call.engineerRole} onChange={(e) => onChange({engineerRole: e.target.value as CallEntry["engineerRole"]})}><option>Primary Engineer</option><option>Secondary Engineer</option></select></Field><Field label="Call ID"><input value={call.callId} onChange={(e) => onChange({callId: e.target.value})}/></Field><Field label="Machine No."><input value={call.machineNo} onChange={(e) => onChange({machineNo: e.target.value})}/></Field><Field label="M/C Model"><input value={call.machineModel} onChange={(e) => onChange({machineModel: e.target.value})}/></Field><Field label="Customer Name"><input value={call.customerName} onChange={(e) => onChange({customerName: e.target.value})}/></Field><Field label="Contact Number"><input value={call.contactNumber} onChange={(e) => onChange({contactNumber: e.target.value})}/></Field><Field label="HMR"><input value={call.hmr} onChange={(e) => onChange({hmr: e.target.value})}/></Field><Field label="Breakdown Status"><select value={call.breakdownStatus} onChange={(e) => onChange({breakdownStatus: e.target.value})}><option>Running With Problem</option><option>Machine Breakdown</option><option>Stopped</option><option>Under Observation</option></select></Field><Field label="Planned Start"><input type="time" value={call.deputationTime} onChange={(e) => onChange({deputationTime: e.target.value})}/></Field><Field label="Expected End"><input type="time" value={call.expectedEndTime} onChange={(e) => onChange({expectedEndTime: e.target.value})}/></Field><Field label="Site Distance (km)"><input value={call.siteDistance} onChange={(e) => onChange({siteDistance: e.target.value})}/></Field><Field label="Labour Charge"><input value={call.labourCharge} onChange={(e) => onChange({labourCharge: e.target.value})}/></Field><Field label="Site Location" wide><input value={call.siteLocation} onChange={(e) => onChange({siteLocation: e.target.value})}/></Field><Field label="Complaint" wide><textarea value={call.complaint} onChange={(e) => onChange({complaint: e.target.value})}/></Field></div></section>; }
function Field({ label, wide, children }: {label: string; wide?: boolean; children: React.ReactNode}) { return <label className={wide ? "wide" : ""}><span>{label}</span>{children}</label>; }
