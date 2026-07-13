"use client";

import { FormEvent, useEffect, useState } from "react";
import { LockKeyhole, Loader2 } from "lucide-react";
import { DeputationBoard } from "@/components/deputation-board";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Branch } from "@/lib/engineers";

type Profile = {
  full_name: string;
  role: "admin" | "head_office" | "service_manager" | "branch_manager" | "engineer" | "accounts";
  branch_id: string | null;
  branches: { name: string } | null;
};

export function AuthShell() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadProfile() {
      const { data: sessionData } = await supabase!.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        if (active) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      const { data, error: profileError } = await supabase!
        .from("profiles")
        .select("full_name, role, branch_id, branches(name)")
        .eq("id", user.id)
        .single();

      if (active) {
        if (profileError) {
          setError("Your login exists, but no WEB-TADA profile is assigned. Ask the administrator to map your branch and role.");
          setProfile(null);
        } else {
          setProfile(data as unknown as Profile);
          setError("");
        }
        setLoading(false);
      }
    }

    loadProfile();
    const { data: listener } = supabase.auth.onAuthStateChange(() => loadProfile());

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
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
  }

  if (loading) {
    return <div className="auth-screen"><Loader2 className="spin" size={34}/><p>Loading WEB-TADA…</p></div>;
  }

  if (!isSupabaseConfigured || !supabase) {
    return <div className="auth-screen"><div className="auth-card"><h1>Supabase not configured</h1><p>Create <code>.env.local</code> using the supplied project URL and anon key, then restart the development server.</p></div></div>;
  }

  if (!profile) {
    return (
      <div className="auth-screen">
        <form className="auth-card" onSubmit={signIn}>
          <div className="auth-logo">FCV</div>
          <p className="eyebrow">SERVICE OPERATIONS</p>
          <h1>WEB-TADA</h1>
          <p className="auth-subtitle">Sign in to prepare and finalize your branch&apos;s daily deputation.</p>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="manager@fcv.in"/></label>
          <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter password"/></label>
          {error && <div className="auth-error">{error}</div>}
          <button className="auth-submit" disabled={submitting}>{submitting ? <><Loader2 className="spin" size={18}/> Signing in…</> : <><LockKeyhole size={18}/> Sign in</>}</button>
          <small>Authorized FCV users only</small>
        </form>
      </div>
    );
  }

  const elevated = ["admin", "head_office", "service_manager"].includes(profile.role);
  const assignedBranch = profile.branches?.name as Branch | undefined;

  if (!elevated && !assignedBranch) {
    return <div className="auth-screen"><div className="auth-card"><h1>Branch not assigned</h1><p>Your profile does not have an active branch. Contact the WEB-TADA administrator.</p><button className="auth-submit" onClick={signOut}>Sign out</button></div></div>;
  }

  return <DeputationBoard initialBranch={assignedBranch} branchLocked={!elevated} userLabel={`${profile.full_name} · ${profile.role.replaceAll("_", " ")}`} onLogout={signOut}/>;
}
