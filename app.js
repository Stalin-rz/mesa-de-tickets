import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase-config.js";

const demoMode = !SUPABASE_URL && !SUPABASE_ANON_KEY;
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;
const ticketsTable = document.getElementById("tabla-tickets");
const staffTable = document.getElementById("tabla-personal");
let tickets = [];
let staff = [];
let demoAdmins = [];
let demoSignupSlots = 0;
let activeDemoAdmin = null;
const demoStaff = [
  { id: "demo-agent-1", full_name: "Agente de prueba 1", role: "service", active: true },
  { id: "demo-agent-2", full_name: "Agente de prueba 2", role: "service", active: true }
];
let demoTickets = [
  {
    id: "demo-ticket-1",
    codigo: "TK-DEMO-0001",
    tipo: "Reseteo de Correo",
    correo: "solicitante1@example.com",
    amie: "17H00001",
    nombre: "Solicitante de prueba",
    asunto: "Ejemplo: recuperar acceso al correo",
    descripcion: "Ticket ficticio para probar asignación y cambio de estado.",
    agente_id: "demo-agent-1",
    estado: "Pendiente",
    created_at: new Date().toISOString()
  },
  {
    id: "demo-ticket-2",
    codigo: "TK-DEMO-0002",
    tipo: "Soporte técnico",
    correo: "solicitante2@example.com",
    amie: null,
    nombre: "Institución de prueba",
    asunto: "Ejemplo: revisar un equipo",
    descripcion: "Segundo ticket ficticio para probar la tabla del administrador.",
    agente_id: null,
    estado: "Atendido",
    created_at: new Date().toISOString()
  }
];

function byId(id) {
  return document.getElementById(id);
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function setLoginStatus(message, isError = true) {
  const status = byId("login-status");
  status.textContent = message;
  status.className = `text-sm ${isError ? "text-rose-700" : "text-emerald-700"}`;
}

function showLoginAfterRegistration(email, message) {
  byId("register-form").classList.add("hidden");
  byId("login-form").classList.remove("hidden");
  byId("login-email").value = email;
  byId("login-password").value = "";
  setLoginStatus(message, false);
}

function attachPasswordToggle(inputId, buttonId) {
  const input = byId(inputId);
  const button = byId(buttonId);
  const icon = button.querySelector("i");

  button.addEventListener("click", () => {
    const showing = input.type === "password";
    input.type = showing ? "text" : "password";
    button.setAttribute("aria-label", showing ? "Ocultar contraseña" : "Mostrar contraseña");
    button.title = showing ? "Ocultar contraseña" : "Mostrar contraseña";
    icon.classList.toggle("fa-eye", !showing);
    icon.classList.toggle("fa-eye-slash", showing);
  });
}

attachPasswordToggle("login-password", "toggle-login-password");
attachPasswordToggle("register-password", "toggle-register-password");
attachPasswordToggle("staff-password", "toggle-staff-password");

function showPublicView() {
  byId("public-view").classList.remove("hidden");
  byId("admin-view").classList.add("hidden");
}

window.abrirModal = () => byId("modalTicket").classList.remove("hidden");
window.cerrarModal = () => byId("modalTicket").classList.add("hidden");
window.abrirLogin = () => {
  byId("login-form").classList.remove("hidden");
  byId("register-form").classList.add("hidden");
  byId("loginModal").classList.remove("hidden");
  setLoginStatus(demoMode
    ? "Modo de prueba: ingresa cualquier correo y contraseña."
    : supabase ? "" : "Falta completar la configuración de Supabase.", false);
};
window.cerrarLogin = () => byId("loginModal").classList.add("hidden");

byId("show-register").addEventListener("click", () => {
  byId("login-form").classList.add("hidden");
  byId("register-form").classList.remove("hidden");
  byId("register-status").textContent = demoMode
    ? "En esta prueba, el primer registro crea el admin inicial. Los datos se borran al recargar."
    : "El registro solo se acepta si es la primera cuenta admin o hay cupos habilitados.";
});

byId("back-to-login").addEventListener("click", () => {
  byId("register-form").classList.add("hidden");
  byId("login-form").classList.remove("hidden");
});

function getTicketFormValues() {
  return {
    codigo: `TK-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    tipo: byId("req-tipo").value,
    correo: byId("req-correo").value.trim(),
    amie: byId("req-amie").value.trim() || null,
    nombre: byId("req-nombre").value.trim(),
    asunto: byId("req-asunto").value.trim(),
    descripcion: byId("req-descripcion").value.trim()
  };
}

byId("ticketForm").addEventListener("submit", async event => {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector('[type="submit"]');
  const status = byId("ticket-status");
  status.textContent = "";

  const request = getTicketFormValues();
  let error = null;

  if (!demoMode) {
    if (!supabase) {
      status.textContent = "Falta completar la configuración de Supabase.";
      return;
    }
    submitButton.disabled = true;
    submitButton.textContent = "Enviando...";
    ({ error } = await supabase.from("tickets").insert(request));
    submitButton.disabled = false;
    submitButton.textContent = "Generar Ticket";
  } else {
    demoTickets.unshift({
      ...request,
      id: `demo-ticket-${Date.now()}`,
      agente_id: null,
      estado: "Pendiente",
      created_at: new Date().toISOString()
    });
    tickets = demoTickets;
    renderTickets();
  }

  if (error) {
    status.textContent = "No se pudo registrar la solicitud. Inténtalo de nuevo.";
    return;
  }

  byId("ticketForm").reset();
  window.cerrarModal();
  byId("ticket-success-code").textContent = request.codigo;
  byId("ticketSuccess").classList.remove("hidden");
});

function renderStaff() {
  staffTable.innerHTML = staff.map(person => `
    <tr>
      <td class="px-5 py-3 font-medium text-slate-800">${escapeHtml(person.full_name)}</td>
      <td class="px-5 py-3">${person.role === "admin" ? "Administrador" : "Servicio"}</td>
      <td class="px-5 py-3"><span class="inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full ${person.active ? "bg-emerald-500" : "bg-slate-400"}"></span>${person.active ? "Activo" : "Inactivo"}</span></td>
      <td class="px-5 py-3">${person.role === "service" ? `
        <div class="flex items-center gap-8">
          <button data-toggle-staff="${escapeHtml(person.id)}" class="text-sm font-medium text-indigo-700 hover:text-indigo-900">${person.active ? "Desactivar" : "Activar"}</button>
          <button data-delete-staff="${escapeHtml(person.id)}" class="border-l border-slate-200 pl-6 text-sm text-rose-700 hover:text-rose-900" aria-label="Eliminar ${escapeHtml(person.full_name)}">Eliminar</button>
        </div>
      ` : "Protegido"}</td>
    </tr>
  `).join("");
}

function renderTickets() {
  const query = byId("filtro-texto").value.trim().toLowerCase();
  const category = byId("filtro-categoria").value;
  const status = byId("filtro-estado").value;
  const filtered = tickets.filter(ticket => {
    const matchesText = [ticket.codigo, ticket.correo, ticket.amie, ticket.nombre, ticket.asunto]
      .some(value => String(value || "").toLowerCase().includes(query));
    return matchesText && (!category || ticket.tipo === category) && (!status || ticket.estado === status);
  });

  byId("total-tickets").textContent = tickets.length;
  byId("total-pendientes").textContent = tickets.filter(ticket => ticket.estado === "Pendiente").length;
  byId("total-atendidos").textContent = tickets.filter(ticket => ticket.estado === "Atendido").length;
  byId("total-sin-asignar").textContent = tickets.filter(ticket => !ticket.agente_id).length;
  byId("vacio").classList.toggle("hidden", filtered.length > 0);

  ticketsTable.innerHTML = filtered.map(ticket => {
    const agentOptions = staff.filter(person => person.active && person.role !== "admin").map(person => `
      <option value="${escapeHtml(person.id)}" ${ticket.agente_id === person.id ? "selected" : ""}>${escapeHtml(person.full_name)}</option>
    `).join("");
    const statusClass = ticket.estado === "Atendido"
      ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
      : "bg-amber-100 text-amber-800 hover:bg-amber-200";

    return `
      <tr class="hover:bg-slate-50 border-b border-slate-200">
        <td class="px-5 py-4 font-mono font-bold text-indigo-700">${escapeHtml(ticket.codigo)}</td>
        <td class="px-5 py-4"><div class="font-medium text-slate-800">${escapeHtml(ticket.nombre || "Sin nombre")}</div><div class="text-xs text-slate-500">${escapeHtml(ticket.correo)}</div>${ticket.amie ? `<span class="inline-block bg-slate-200 text-slate-700 text-[10px] px-1.5 py-0.5 rounded mt-1 font-mono">AMIE: ${escapeHtml(ticket.amie)}</span>` : ""}</td>
        <td class="px-5 py-4"><span class="inline-block px-2.5 py-1 text-xs rounded-full font-medium bg-indigo-50 text-indigo-800 mb-1">${escapeHtml(ticket.tipo)}</span><div class="text-xs text-slate-700 font-medium" title="${escapeHtml(ticket.descripcion)}">${escapeHtml(ticket.asunto)}</div></td>
        <td class="px-5 py-4"><select data-agent-ticket="${escapeHtml(ticket.id)}" class="border border-slate-300 rounded px-2 py-1 text-xs"><option value="">Sin asignar</option>${agentOptions}</select></td>
        <td class="px-5 py-4"><button data-toggle-ticket="${escapeHtml(ticket.id)}" class="px-3 py-1 rounded-full text-xs font-semibold ${statusClass}">${escapeHtml(ticket.estado)}</button></td>
        <td class="px-5 py-4 text-center"><button data-delete-ticket="${escapeHtml(ticket.id)}" class="text-rose-600 hover:text-rose-800 p-1" title="Eliminar ticket" aria-label="Eliminar ${escapeHtml(ticket.codigo)}"><i class="fa-regular fa-trash-can"></i></button></td>
      </tr>
    `;
  }).join("");
}

async function loadDashboard() {
  byId("dashboard-status").textContent = "Cargando tickets y personal...";
  if (demoMode) {
    tickets = demoTickets;
    staff = demoStaff;
    byId("admin-signup-slots").value = demoSignupSlots;
    byId("dashboard-status").textContent = "Datos de demostración; los cambios se borran al recargar la página.";
    renderStaff();
    renderTickets();
    return;
  }
  if (!supabase) {
    byId("dashboard-status").textContent = "Falta completar la configuración de Supabase.";
    return;
  }

  const [ticketsResult, staffResult, settingsResult] = await Promise.all([
    supabase.from("tickets").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role, active").order("full_name"),
    supabase.from("admin_registration_settings").select("remaining_signups").eq("singleton", true).single()
  ]);

  if (ticketsResult.error || staffResult.error || settingsResult.error) {
    byId("dashboard-status").textContent = "No fue posible cargar los datos. Revisa las políticas de Supabase.";
    return;
  }

  tickets = ticketsResult.data;
  staff = staffResult.data;
  byId("admin-signup-slots").value = settingsResult.data.remaining_signups;
  byId("dashboard-status").textContent = "";
  renderStaff();
  renderTickets();
}

async function activateAdmin(user) {
  let profileResult = await supabase
    .from("profiles")
    .select("full_name, role, active")
    .eq("id", user.id)
    .maybeSingle();

  if (!profileResult.error && !profileResult.data && user.email_confirmed_at) {
    const { error: registrationError } = await supabase.functions.invoke("claim-admin-registration");
    if (!registrationError) {
      profileResult = await supabase
        .from("profiles")
        .select("full_name, role, active")
        .eq("id", user.id)
        .maybeSingle();
    }
  }

  const { data: profile, error } = profileResult;

  if (error || !profile || profile.role !== "admin" || !profile.active) {
    await supabase.auth.signOut();
    showPublicView();
    setLoginStatus("Esta cuenta no tiene permisos de administrador o no quedan cupos de registro.");
    byId("loginModal").classList.remove("hidden");
    return false;
  }

  byId("admin-name").textContent = profile.full_name;
  byId("public-view").classList.add("hidden");
  byId("admin-view").classList.remove("hidden");
  window.cerrarLogin();
  await loadDashboard();
  return true;
}

byId("login-form").addEventListener("submit", async event => {
  event.preventDefault();
  if (demoMode) {
    const email = byId("login-email").value.trim().toLowerCase();
    const password = byId("login-password").value;
    activeDemoAdmin = demoAdmins.find(admin => admin.email === email && admin.password === password) || null;
    if (!activeDemoAdmin) {
      setLoginStatus(demoAdmins.length
        ? "Correo o contraseña incorrectos. Usa la cuenta que registraste."
        : "Todavía no existe una cuenta. Usa Registrarse para crear el primer administrador.");
      return;
    }
    byId("admin-name").textContent = "Modo de demostración";
    byId("public-view").classList.add("hidden");
    byId("admin-view").classList.remove("hidden");
    window.cerrarLogin();
    await loadDashboard();
    return;
  }
  if (!supabase) {
    setLoginStatus("Falta completar la configuración de Supabase.");
    return;
  }

  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  setLoginStatus("Conectando...", false);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: byId("login-email").value.trim(),
    password: byId("login-password").value
  });
  button.disabled = false;

  if (error) {
    setLoginStatus("No se pudo iniciar sesión. Verifica tus datos.");
    return;
  }

  await activateAdmin(data.user);
});

byId("register-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = byId("register-status");
  const firstName = byId("register-first-name").value.trim();
  const lastName = byId("register-last-name").value.trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const email = byId("register-email").value.trim().toLowerCase();
  const password = byId("register-password").value;

  if (demoMode) {
    const alreadyRegistered = demoAdmins.some(admin => admin.email === email);
    if (alreadyRegistered) {
      status.textContent = "Ese correo ya tiene una cuenta de prueba.";
      return;
    }
    if (demoAdmins.length > 0 && demoSignupSlots < 1) {
      status.textContent = "El registro está cerrado. Un administrador debe habilitar un cupo.";
      return;
    }

    if (demoAdmins.length > 0) demoSignupSlots -= 1;
    demoAdmins.push({ full_name: fullName, email, password });
    showLoginAfterRegistration(email, "Registro completado. Inicia sesión para continuar.");
    return;
  }

  if (!supabase) {
    status.textContent = "Falta completar la configuración de Supabase.";
    return;
  }

  const button = event.currentTarget.querySelector('[type="submit"]');
  button.disabled = true;
  status.textContent = "Creando cuenta...";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName, full_name: fullName } }
  });
  button.disabled = false;

  if (error) {
    status.textContent = "No se pudo registrar. Verifica los datos o si quedan cupos disponibles.";
    return;
  }

  if (data.session) {
    const { error: registrationError } = await supabase.functions.invoke("claim-admin-registration");
    if (registrationError) {
      status.textContent = "La cuenta se creó, pero no hay un cupo disponible para hacerla administradora.";
      return;
    }
    await supabase.auth.signOut();
    showLoginAfterRegistration(email, "Registro completado. Inicia sesión para continuar.");
    return;
  }

  showLoginAfterRegistration(email, "Cuenta creada. Confirma el correo y luego inicia sesión para activar el acceso de administrador.");
});

byId("cerrar-sesion").addEventListener("click", async () => {
  if (supabase) await supabase.auth.signOut();
  activeDemoAdmin = null;
  showPublicView();
});

byId("admin-signup-settings-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = byId("admin-signup-settings-status");
  const slots = Number(byId("admin-signup-slots").value);
  if (!Number.isInteger(slots) || slots < 0 || slots > 100) {
    status.textContent = "Indica entre 0 y 100 cupos.";
    return;
  }

  if (demoMode) {
    demoSignupSlots = slots;
    status.textContent = `Se habilitaron ${slots} registros de prueba.`;
    return;
  }
  if (!supabase) {
    status.textContent = "Falta completar la configuración de Supabase.";
    return;
  }

  const { error } = await supabase
    .from("admin_registration_settings")
    .update({ remaining_signups: slots })
    .eq("singleton", true);
  status.textContent = error ? "No se pudieron guardar los cupos." : `Se habilitaron ${slots} registros.`;
});

byId("admin-invite-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = byId("admin-invite-status");
  const button = byId("admin-invite-submit");

  if (demoMode || !supabase) {
    status.textContent = "Las invitaciones requieren conectar Supabase y desplegar la función protegida.";
    status.className = "mt-3 text-sm text-amber-800";
    return;
  }

  button.disabled = true;
  status.textContent = "Enviando invitación...";
  status.className = "mt-3 text-sm text-slate-600";
  const { error } = await supabase.functions.invoke("invite-admin", {
    body: {
      first_name: byId("admin-invite-first-name").value.trim(),
      last_name: byId("admin-invite-last-name").value.trim(),
      email: byId("admin-invite-email").value.trim()
    }
  });
  button.disabled = false;

  if (error) {
    status.textContent = "No se pudo enviar la invitación. Verifica tu rol y la configuración de la función.";
    status.className = "mt-3 text-sm text-rose-700";
    return;
  }

  event.currentTarget.reset();
  status.textContent = "Invitación enviada. La cuenta quedará como administrador al aceptar el correo.";
  status.className = "mt-3 text-sm text-emerald-700";
  await loadDashboard();
});

byId("staff-invite-form").addEventListener("submit", async event => {
  event.preventDefault();
  const status = byId("staff-invite-status");
  const button = byId("staff-invite-submit");
  const firstName = byId("staff-first-name").value.trim();
  const lastName = byId("staff-last-name").value.trim();
  const email = byId("staff-email").value.trim().toLowerCase();
  const password = byId("staff-password").value;

  if (demoMode) {
    demoStaff.push({
      id: `demo-agent-${crypto.randomUUID()}`,
      full_name: `${firstName} ${lastName}`,
      role: "service",
      active: true
    });
    event.currentTarget.reset();
    status.textContent = "Personal de prueba agregado. La cuenta se perderá al recargar.";
    await loadDashboard();
    return;
  }
  if (!supabase) {
    status.textContent = "Falta completar la configuración de Supabase.";
    return;
  }

  button.disabled = true;
  status.textContent = "Enviando invitación...";
  const { error } = await supabase.functions.invoke("manage-staff", {
    body: { action: "create", first_name: firstName, last_name: lastName, email, password }
  });
  button.disabled = false;

  if (error) {
    status.textContent = "No se pudo invitar al personal. Verifica tu acceso y la configuración de Supabase.";
    return;
  }

  event.currentTarget.reset();
  status.textContent = "Cuenta creada. Entrega la contraseña inicial por un canal seguro.";
  await loadDashboard();
});

staffTable.addEventListener("click", async event => {
  const toggleButton = event.target.closest("[data-toggle-staff]");
  const deleteButton = event.target.closest("[data-delete-staff]");

  if (toggleButton) {
    const person = staff.find(item => item.id === toggleButton.dataset.toggleStaff);
    if (!person || person.role !== "service") return;

    if (demoMode) {
      person.active = !person.active;
      renderStaff();
      return;
    }
    if (!supabase) return;

    const { error } = await supabase.functions.invoke("manage-staff", {
      body: { action: "set-active", user_id: person.id, active: !person.active }
    });
    if (error) byId("dashboard-status").textContent = "No se pudo cambiar el estado del personal.";
    else await loadDashboard();
  }

  const personToDelete = staff.find(item => item.id === deleteButton?.dataset.deleteStaff);
  if (deleteButton && personToDelete?.role === "service" && window.confirm(`¿Eliminar permanentemente a ${personToDelete.full_name}? También se quitará su asignación de los tickets. Esta acción no se puede deshacer.`)) {
    if (demoMode) {
      const deletedId = deleteButton.dataset.deleteStaff;
      const index = demoStaff.findIndex(person => person.id === deletedId);
      if (index >= 0) demoStaff.splice(index, 1);
      demoTickets.forEach(ticket => {
        if (ticket.agente_id === deletedId) ticket.agente_id = null;
      });
      await loadDashboard();
      return;
    }
    if (!supabase) return;

    const { error } = await supabase.functions.invoke("manage-staff", {
      body: { action: "delete", user_id: deleteButton.dataset.deleteStaff }
    });
    if (error) byId("dashboard-status").textContent = "No se pudo eliminar la cuenta del personal.";
    else await loadDashboard();
  }
});

byId("filtro-texto").addEventListener("input", renderTickets);
byId("filtro-categoria").addEventListener("change", renderTickets);
byId("filtro-estado").addEventListener("change", renderTickets);

ticketsTable.addEventListener("change", async event => {
  const ticketId = event.target.dataset.agentTicket;
  if (!ticketId) return;
  if (demoMode) {
    const ticket = demoTickets.find(item => item.id === ticketId);
    if (ticket) ticket.agente_id = event.target.value || null;
    tickets = demoTickets;
    renderTickets();
    return;
  }

  const { error } = await supabase.from("tickets").update({ agente_id: event.target.value || null }).eq("id", ticketId);
  if (error) byId("dashboard-status").textContent = "No se pudo actualizar la asignación.";
  else await loadDashboard();
});

ticketsTable.addEventListener("click", async event => {
  const toggleButton = event.target.closest("[data-toggle-ticket]");
  const deleteButton = event.target.closest("[data-delete-ticket]");

  if (toggleButton) {
    const ticket = tickets.find(item => item.id === toggleButton.dataset.toggleTicket);
    if (demoMode) {
      ticket.estado = ticket.estado === "Pendiente" ? "Atendido" : "Pendiente";
      tickets = demoTickets;
      renderTickets();
      return;
    }

    const { error } = await supabase.from("tickets").update({ estado: ticket.estado === "Pendiente" ? "Atendido" : "Pendiente" }).eq("id", ticket.id);
    if (error) byId("dashboard-status").textContent = "No se pudo actualizar el estado.";
    else await loadDashboard();
  }

  if (deleteButton && window.confirm("¿Eliminar este ticket definitivamente?")) {
    if (demoMode) {
      demoTickets = demoTickets.filter(item => item.id !== deleteButton.dataset.deleteTicket);
      tickets = demoTickets;
      renderTickets();
      return;
    }

    const { error } = await supabase.from("tickets").delete().eq("id", deleteButton.dataset.deleteTicket);
    if (error) byId("dashboard-status").textContent = "No se pudo eliminar el ticket.";
    else await loadDashboard();
  }
});

byId("exportar-csv").addEventListener("click", () => {
  const columns = ["codigo", "tipo", "correo", "amie", "nombre", "asunto", "estado", "created_at"];
  const rows = [columns.join(","), ...tickets.map(ticket => columns.map(column => {
    const value = String(ticket[column] || "").replace(/"/g, '""');
    return `"${value}"`;
  }).join(","))];
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
  link.download = `tickets_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
});

byId("ticket-success-close").addEventListener("click", () => byId("ticketSuccess").classList.add("hidden"));
byId("ticketSuccess").addEventListener("click", event => {
  if (event.target === event.currentTarget) event.currentTarget.classList.add("hidden");
});

if (supabase) {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await activateAdmin(session.user);
  supabase.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") showPublicView();
  });
}