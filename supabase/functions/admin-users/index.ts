import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = request.headers.get("Authorization") ?? "";

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData.user) throw new Error("Unauthorized");

    const { data: callerProfile } = await adminClient
      .from("profiles")
      .select("role,is_active")
      .eq("id", userData.user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin" || !callerProfile.is_active) {
      throw new Error("Admin access required");
    }

    const body = await request.json();

    if (body.action === "list") {
      const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) throw listError;
      const { data: profiles, error: profileError } = await adminClient
        .from("profiles")
        .select("id,full_name,email,mobile_number,employee_code,role,branch_id,is_active,branches(name)")
        .order("full_name");
      if (profileError) throw profileError;

      const emailMap = new Map(authUsers.users.map((user) => [user.id, user.email]));
      return Response.json(
        profiles?.map((profile) => ({ ...profile, email: profile.email ?? emailMap.get(profile.id) ?? "" })) ?? [],
        { headers: corsHeaders },
      );
    }

    if (body.action !== "create") throw new Error("Unsupported action");

    const { email, password, fullName, role, branchName, mobileNumber, employeeCode, isActive = true } = body;
    if (!email || !password || !fullName || !role) throw new Error("Missing required fields");
    if (["branch_manager", "engineer"].includes(role) && !branchName) throw new Error("Branch is required for this role");

    let branchId: string | null = null;
    if (branchName) {
      const { data: branch, error: branchError } = await adminClient.from("branches").select("id").eq("name", branchName).single();
      if (branchError || !branch) throw new Error("Invalid branch");
      branchId = branch.id;
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) throw createError ?? new Error("Unable to create user");

    const { error: insertError } = await adminClient.from("profiles").insert({
      id: created.user.id,
      full_name: fullName,
      email: email.trim().toLowerCase(),
      mobile_number: mobileNumber || null,
      employee_code: employeeCode || null,
      role,
      branch_id: branchId,
      is_active: Boolean(isActive),
    });

    if (insertError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw insertError;
    }

    if (role === "engineer") {
      const { data: existingEngineer } = await adminClient.from("engineers").select("id").eq("full_name", fullName).eq("home_branch_id", branchId).maybeSingle();
      if (existingEngineer) {
        await adminClient.from("engineers").update({ user_id: created.user.id, employee_code: employeeCode || null }).eq("id", existingEngineer.id);
      } else {
        await adminClient.from("engineers").insert({ full_name: fullName, home_branch_id: branchId, user_id: created.user.id, employee_code: employeeCode || null });
      }
    }

    return Response.json({ success: true, userId: created.user.id }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 400, headers: corsHeaders });
  }
});
