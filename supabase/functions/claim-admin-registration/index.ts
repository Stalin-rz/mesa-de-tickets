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
  const { data: userData, error: userError } = await client.auth.getUser(token);
  const user = userData.user;
  if (userError || !user?.email || !user.email_confirmed_at) {
    return respond("Confirma tu correo antes de completar el registro.", 403);
  }

  const metadataName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name.trim()
    : "";
  const fullName = metadataName || user.email.split("@")[0];
  const { error } = await client.rpc("claim_admin_registration", {
    p_user_id: user.id,
    p_email: user.email,
    p_full_name: fullName,
    p_initial_admin_email: Deno.env.get("INITIAL_ADMIN_EMAIL") ?? null
  });

  if (error) return respond("No hay autorización o cupo disponible para crear un administrador.", 403);
  return respond("Registro de administrador completado.", 201);
});
