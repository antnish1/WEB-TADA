"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";
import { DeputationBoard } from "@/components/deputation-board";
import { AdminUsers } from "@/components/admin-users";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Branch } from "@/lib/engineers";

type Profile = {
  full_name: string;
  role: "admin" | "head_office" | "service_manager" | "branch_manager" | "engineer" | "accounts";
  branch_id: string | null;
  branch_name: string | null;
};

export function AuthShellV2() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"deputations" | "users">("deputations");

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;

    async function loadProfile() {
      const { data: sessionData, error: sessionError } = await supabase!.auth.getSession();
      const user = sessionData.session?.user;

      if (sessionError) {
        if (active) {
          setError(`Unable to read login session: ${sessionError.message}`);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      if (!user) {
        if (active) { setProfile(null); setLoading(false); }
        return;
      }

      const { data: profileData, error: profileError } = await supabase!
        .from("profiles")
        .select("full_name, role, branch_id, is_active")
        .eq("id", user.id)
        .maybeSingle();

      if (!active) return;

      if (profileError) {
        setError(`Profile lookup failed: ${profileError.message}`);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!profileData) {
        setError("Your login exists, but no matching WEB-TADA profile was returned. Confirm the app and profile use the same Supabase project.");
        setProfile(null);
        setLoading(false);
        return;
      }

      if (!profileData.is_active) {
        setError("Your WEB-TADA profile is inactive. Ask an administrator to reactivate it.");
        setProfile(null);
        setLoading(false);
        return;
      }

      let branchName: string | null = null;
      if (profileData.branch_id) {
        const { data: branchData, error: branchError } = await supabase!
          .from("branches")
          .select("name")
          .eq("id", profileData.branch_id)
          .maybeSingle();

        if (branchError) {
          setError(`Branch lookup failed: ${branchError.message}`);
          setProfile(null);
          setLoading(false);
          return;
        }
        branchName = branchData?.name ?? null;
      }

      setProfile({
        full_name: profileData.full_name,
        role: profileData.role,
        branch_id: profileData.branch_id,
        branch_name: branchName,
      });
      setError("");
      setLoading(false);
    }

    void loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void loadProfile());
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true);
    setError("");
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) setError(signInError.message);
    setSubmitting(false);
  }

  async function signOut() {
    await supabase?.auth.signOut();
    setProfile(null);
    setView("deputations");
  }

  if (loading) return <div className="auth-screen"><Loader2 className="spin" size={34}/><p>Loading WEB-TADA…</p></div>;
  if (!isSupabaseConfigured || !supabase) return <div className="auth-screen"><div className="auth-card"><h1>Supabase not configured</h1><p>Create <code>.env.local</code> and restart the development server.</p></div></div>;

  if (!profile) {
    return <div className="auth-screen"><form className="auth-card" onSubmit={signIn}>
      <div className="auth-logo">FCV</div><p className="eyebrow">SERVICE OPERATIONS</p><h1>WEB-TADA</h1>
      <p className="auth-subtitle">Sign in to prepare and finalize your branch&apos;s daily deputation.</p>
      <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"/></label>
      <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password"/></label>
      {error && <div className="auth-error">{error}</div>}
      <button className="auth-submit" disabled={submitting}>{submitting ? <><Loader2 className="spin" size={18}/> Signing in…</> : <><LockKeyhole size={18}/> Sign in</>}</button>
      <small>Authorized FCV users only</small>
    </form></div>;
  }

  const elevated = ["admin", "head_office", "service_manager"].includes(profile.role);
  const assignedBranch = profile.branch_name as Branch | undefined;

  if (!elevated && !assignedBranch) {
    return <div className="auth-screen"><div className="auth-card"><h1>Branch not assigned</h1><p>Your profile does not have an active branch.</p><button className="auth-submit" onClick={signOut}>Sign out</button></div></div>;
  }

  if (profile.role === "admin" && view === "users") {
    return <AdminUsers onBack={() => setView("deputations")} onLogout={signOut}/>;
  }

  return <DeputationBoard
    initialBranch={assignedBranch}
    branchLocked={!elevated}
    userLabel={`${profile.full_name} · ${profile.role.replaceAll("_", " ")}`}
    onLogout={signOut}
    onManageUsers={profile.role === "admin" ? () => setView("users") : undefined}
  />;
}
