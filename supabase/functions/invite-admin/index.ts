import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Método no permitido." }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Solicitud no autorizada o función mal configurada." }, 401);
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const accessToken = authorization.slice("Bearer ".length);
  const { data: userData, error: authError } = await adminClient.auth.getUser(accessToken);
  if (authError || !userData.user) return jsonResponse({ error: "Sesión inválida." }, 401);

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (profileError || !profile || profile.role !== "admin" || !profile.active) {
    return jsonResponse({ error: "Se requiere una cuenta administradora activa." }, 403);
  }

  let payload: { email?: unknown; first_name?: unknown; last_name?: unknown };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: "Datos de invitación no válidos." }, 400);
  }

  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const firstName = typeof payload.first_name === "string" ? payload.first_name.trim() : "";
  const lastName = typeof payload.last_name === "string" ? payload.last_name.trim() : "";
  const fullName = `${firstName} ${lastName}`.trim();
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !firstName || firstName.length > 60 || !lastName || lastName.length > 60) {
    return jsonResponse({ error: "Ingresa nombres, apellidos y correo válidos." }, 400);
  }

  const { data: invitation, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { first_name: firstName, last_name: lastName, full_name: fullName }
  });
  if (inviteError || !invitation.user) {
    return jsonResponse({ error: "No se pudo crear la invitación." }, 400);
  }

  const { error: claimError } = await adminClient.rpc("claim_admin_registration", {
    p_user_id: invitation.user.id,
    p_email: email,
    p_full_name: fullName,
    p_initial_admin_email: null
  });
  if (claimError) {
    await adminClient.auth.admin.deleteUser(invitation.user.id);
    return jsonResponse({ error: "No quedan cupos para registrar administradores." }, 403);
  }

  return jsonResponse({ message: "Invitación enviada." }, 201);
});