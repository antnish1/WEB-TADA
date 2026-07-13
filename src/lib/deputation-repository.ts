import type { Branch } from "@/lib/engineers";
import type { DailyStatus, EngineerPlan } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const toDbStatus = (status: DailyStatus) => status.toLowerCase();
const fromDbStatus = (status: string) => status.toUpperCase() as DailyStatus;

export async function loadPlansFromSupabase(branch: Branch, date: string): Promise<EngineerPlan[] | null> {
  if (!isSupabaseConfigured || !supabase) return null;

  const { data: branchRow, error: branchError } = await supabase
    .from("branches")
    .select("id")
    .eq("name", branch)
    .single();
  if (branchError) throw branchError;

  const { data: engineers, error: engineerError } = await supabase
    .from("engineers")
    .select("id, full_name")
    .eq("home_branch_id", branchRow.id)
    .eq("is_active", true)
    .order("full_name");
  if (engineerError) throw engineerError;

  const { data: dailyPlans, error: planError } = await supabase
    .from("daily_engineer_plans")
    .select("id, engineer_id, status, remarks, finalized_at")
    .eq("branch_id", branchRow.id)
    .eq("plan_date", date);
  if (planError) throw planError;

  const planIds = (dailyPlans ?? []).map((plan) => plan.id);
  const { data: deputations, error: depError } = planIds.length
    ? await supabase.from("deputations").select("*").in("daily_plan_id", planIds).order("sequence_number")
    : { data: [], error: null };
  if (depError) throw depError;

  return (engineers ?? []).map((engineer) => {
    const plan = (dailyPlans ?? []).find((item) => item.engineer_id === engineer.id);
    const calls = (deputations ?? [])
      .filter((item) => item.daily_plan_id === plan?.id)
      .map((item) => ({
        id: item.id,
        workshopOnsite: item.work_type,
        callType: item.call_type ?? "U/W",
        engineerRole: item.engineer_role ?? "Primary Engineer",
        complaint: item.complaint ?? "",
        customerName: item.customer_name ?? "",
        contactNumber: item.contact_number ?? "",
        machineNo: item.machine_number ?? "",
        hmr: item.hmr?.toString() ?? "",
        breakdownStatus: item.breakdown_status ?? "Running With Problem",
        machineModel: item.machine_model ?? "",
        siteLocation: item.site_location ?? "",
        deputationTime: item.deputation_time?.slice(0, 5) ?? "",
        expectedEndTime: item.expected_completion_time?.slice(0, 5) ?? "",
        callId: item.call_id ?? "",
        labourCharge: item.labour_charge?.toString() ?? "",
        siteDistance: item.expected_distance_km?.toString() ?? "",
      }));

    return {
      engineerName: engineer.full_name,
      status: plan ? fromDbStatus(plan.status) : "NOT_FILLED",
      remarks: plan?.remarks ?? "",
      expanded: false,
      calls,
    };
  });
}

export async function savePlansToSupabase(branch: Branch, date: string, plans: EngineerPlan[], finalize: boolean): Promise<void> {
  if (!isSupabaseConfigured || !supabase) throw new Error("Supabase is not configured.");

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) throw new Error("Please sign in before saving to Supabase.");

  const { data: branchRow, error: branchError } = await supabase.from("branches").select("id").eq("name", branch).single();
  if (branchError) throw branchError;

  const { data: engineers, error: engineerError } = await supabase
    .from("engineers")
    .select("id, full_name")
    .eq("home_branch_id", branchRow.id)
    .eq("is_active", true);
  if (engineerError) throw engineerError;

  for (const plan of plans) {
    const engineer = (engineers ?? []).find((item) => item.full_name === plan.engineerName);
    if (!engineer) continue;

    const { data: savedPlan, error: planError } = await supabase
      .from("daily_engineer_plans")
      .upsert({
        plan_date: date,
        branch_id: branchRow.id,
        engineer_id: engineer.id,
        status: toDbStatus(plan.status),
        remarks: plan.remarks || null,
        finalized_at: finalize ? new Date().toISOString() : null,
        finalized_by: finalize ? userId : null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      }, { onConflict: "plan_date,engineer_id" })
      .select("id")
      .single();
    if (planError) throw planError;

    const { error: deleteError } = await supabase.from("deputations").delete().eq("daily_plan_id", savedPlan.id);
    if (deleteError) throw deleteError;

    if (plan.calls.length) {
      const rows = plan.calls.map((call, index) => ({
        daily_plan_id: savedPlan.id,
        sequence_number: index + 1,
        work_type: call.workshopOnsite,
        call_type: call.callType || null,
        engineer_role: call.engineerRole,
        complaint: call.complaint || null,
        customer_name: call.customerName || null,
        contact_number: call.contactNumber || null,
        machine_number: call.machineNo || null,
        hmr: call.hmr ? Number(call.hmr) : null,
        breakdown_status: call.breakdownStatus || null,
        machine_model: call.machineModel || null,
        site_location: call.siteLocation || null,
        deputation_time: call.deputationTime || null,
        expected_completion_time: call.expectedEndTime || null,
        call_id: call.callId || null,
        labour_charge: call.labourCharge ? Number(call.labourCharge) : null,
        expected_distance_km: call.siteDistance ? Number(call.siteDistance) : null,
        status: finalize ? "assigned" : "draft",
      }));
      const { error: insertError } = await supabase.from("deputations").insert(rows);
      if (insertError) throw insertError;
    }
  }
}
