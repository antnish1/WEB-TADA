"use client";

import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Plus, UserPlus } from "lucide-react";
import { engineersByBranch, type Branch } from "@/lib/engineers";
import { supabase } from "@/lib/supabase";

const roles = ["admin", "head_office", "service_manager", "branch_manager", "engineer", "accounts"] as const;
const branches = Object.keys(engineersByBranch) as Branch[];

type UserRow = {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string | null;
  employee_code: string | null;
  role: string;
  is_active: boolean;
  branches: { name: string } | null;
};

export function AdminUsers({ onBack, onLogout }: { onBack: () => void; onLogout: () => void | Promise<void> }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ fullName: "", email: "", password: "", mobileNumber: "", employeeCode: "", role: "branch_manager", branchName: "", isActive: true });

  async function invoke(payload: Record<string, unknown>) {
    if (!supabase) throw new Error("Supabase is not configured");
    const { data, error } = await supabase.functions.invoke("admin-users", { body: payload });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }

  async function loadUsers() {
    setLoading(true);
    try {
      setUsers(await invoke({ action: "list" }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadUsers(); }, []);

  async function createUser(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await invoke({ action: "create", ...form });
      setMessage("User created in Supabase Auth and profiles successfully.");
      setForm({ fullName: "", email: "", password: "", mobileNumber: "", employeeCode: "", role: "branch_manager", branchName: "", isActive: true });
      await loadUsers();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create user");
    } finally {
      setSaving(false);
    }
  }

  const branchRequired = ["branch_manager", "engineer"].includes(form.role);

  return <main className="admin-page">
    <header className="admin-header">
      <div><button className="link-button" onClick={onBack}><ArrowLeft size={17}/> Back to deputations</button><p className="eyebrow">ADMINISTRATION</p><h1>User Management</h1><p>Create branch managers and other authorized users. Every new account is added to Auth and Profiles together.</p></div>
      <button className="secondary-button" onClick={() => void onLogout()}>Sign out</button>
    </header>

    <section className="admin-grid">
      <form className="admin-card" onSubmit={createUser}>
        <div className="section-title"><UserPlus size={20}/><div><h2>Create User</h2><p>All fields marked required must be completed.</p></div></div>
        <div className="admin-form-grid">
          <label>Full name<input value={form.fullName} onChange={(e) => setForm({...form, fullName:e.target.value})} required/></label>
          <label>Email<input type="email" value={form.email} onChange={(e) => setForm({...form, email:e.target.value})} required/></label>
          <label>Temporary password<input type="password" minLength={6} value={form.password} onChange={(e) => setForm({...form, password:e.target.value})} required/></label>
          <label>Role<select value={form.role} onChange={(e) => setForm({...form, role:e.target.value})}>{roles.map(role => <option key={role} value={role}>{role.replaceAll("_"," ")}</option>)}</select></label>
          <label>Branch<select value={form.branchName} onChange={(e) => setForm({...form, branchName:e.target.value})} required={branchRequired}><option value="">{branchRequired ? "Select branch" : "No branch / all branches"}</option>{branches.map(branch => <option key={branch}>{branch}</option>)}</select></label>
          <label>Employee code<input value={form.employeeCode} onChange={(e) => setForm({...form, employeeCode:e.target.value})}/></label>
          <label>Mobile number<input value={form.mobileNumber} onChange={(e) => setForm({...form, mobileNumber:e.target.value})}/></label>
          <label className="checkbox-label"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({...form, isActive:e.target.checked})}/> Active user</label>
        </div>
        {message && <div className="admin-message">{message}</div>}
        <button className="primary-button" disabled={saving}>{saving ? <><Loader2 className="spin" size={18}/> Creating…</> : <><Plus size={18}/> Create User</>}</button>
      </form>

      <section className="admin-card users-card">
        <div className="section-title"><h2>Existing Users</h2><span>{users.length}</span></div>
        {loading ? <div className="loading-row"><Loader2 className="spin"/> Loading users…</div> : <div className="users-table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Branch</th><th>Status</th></tr></thead><tbody>{users.map(user => <tr key={user.id}><td><strong>{user.full_name}</strong><small>{user.employee_code || user.mobile_number || ""}</small></td><td>{user.email}</td><td>{user.role.replaceAll("_"," ")}</td><td>{user.branches?.name || "All / none"}</td><td>{user.is_active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div>}
      </section>
    </section>
  </main>;
}
