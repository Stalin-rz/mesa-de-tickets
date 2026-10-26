import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function respond(message: string, status: number) {
  return new Response(JSON.stringify({ message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

Deno.serve(async request => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return respond("Método no permitido.", 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!authorization?.startsWith("Bearer ") || !supabaseUrl || !serviceRoleKey) {
    return respond("Se requiere una sesión válida.", 401);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const token = authorization.slice("Bearer ".length);
  const { data: userData, error: authError } = await client.auth.getUser(token);
  if (authError || !userData.user) return respond("Sesión inválida.", 401);

  const { data: caller, error: callerError } = await client
    .from("profiles")
    .select("role, active")
    .eq("id", userData.user.id)
    .maybeSingle();
  if (callerError || caller?.role !== "admin" || !caller.active) {
    return respond("Se requiere una cuenta administradora activa.", 403);
  }

  let payload: { action?: unknown; first_name?: unknown; last_name?: unknown; email?: unknown; password?: unknown; user_id?: unknown; active?: unknown };
  try {
    payload = await request.json();
  } catch {
    return respond("Solicitud no válida.", 400);
  }

  if (payload.action === "create") {
    const firstName = typeof payload.first_name === "string" ? payload.first_name.trim() : "";
    const lastName = typeof payload.last_name === "string" ? payload.last_name.trim() : "";
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    const password = typeof payload.password === "string" ? payload.password : "";
    const fullName = `${firstName} ${lastName}`.trim();
    if (!firstName || !lastName || firstName.length > 60 || lastName.length > 60 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 8 || password.length > 72) {
      return respond("Verifica nombres, apellidos, correo y contraseña (8 a 72 caracteres).", 400);
    }

    const { data: createdUser, error: createError } = await client.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName, full_name: fullName, role: "service" }
    });
    if (createError || !createdUser.user) return respond("No se pudo crear la cuenta. Verifica que el correo no esté registrado.", 400);

    const { error: profileError } = await client.from("profiles").insert({
      id: createdUser.user.id,
      full_name: fullName,
      role: "service",
      active: true
    });
    if (profileError) {
      await client.auth.admin.deleteUser(createdUser.user.id);
      return respond("No se pudo crear el perfil de servicio.", 500);
    }

    return respond("Cuenta de servicio creada.", 201);
  }

  if (payload.action === "delete") {
    const userId = typeof payload.user_id === "string" ? payload.user_id : "";
    const { data: target, error: targetError } = await client
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (targetError || target?.role !== "service") return respond("Solo se puede eliminar personal de servicio.", 404);

    const { error: deleteError } = await client.auth.admin.deleteUser(userId);
    if (deleteError) return respond("No se pudo eliminar la cuenta.", 500);
    return respond("Cuenta de servicio eliminada.", 200);
  }

  if (payload.action === "set-active") {
    const userId = typeof payload.user_id === "string" ? payload.user_id : "";
    if (typeof payload.active !== "boolean") return respond("Estado no válido.", 400);
    const { error } = await client.rpc("set_service_active", {
      p_user_id: userId,
      p_active: payload.active
    });
    if (error) return respond("Solo se puede cambiar el estado del personal de servicio.", 403);
    return respond("Estado actualizado.", 200);
  }

  return respond("Acción no permitida.", 400);
});
