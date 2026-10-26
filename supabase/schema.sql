create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role text not null default 'service' check (role in ('admin', 'service')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  tipo text not null,
  correo text not null,
  amie text,
  nombre text not null default '',
  asunto text not null,
  descripcion text not null,
  agente_id uuid references public.profiles (id) on delete set null,
  estado text not null default 'Pendiente' check (estado in ('Pendiente', 'Atendido')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_registration_settings (
  singleton boolean primary key default true check (singleton),
  remaining_signups integer not null default 0 check (remaining_signups between 0 and 100)
);

insert into public.admin_registration_settings (singleton, remaining_signups)
values (true, 0)
on conflict (singleton) do nothing;

alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.admin_registration_settings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and active = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.claim_admin_registration(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_initial_admin_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  has_admin boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended('admin-registration', 0));

  if p_user_id is null or p_full_name is null or length(trim(p_full_name)) not between 1 and 120 then
    raise exception 'Nombre o cuenta inválidos.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from auth.users
    where id = p_user_id and lower(email) = lower(p_email)
  ) then
    raise exception 'La cuenta no coincide.' using errcode = '42501';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'La cuenta ya tiene un perfil.' using errcode = '23505';
  end if;

  select exists (select 1 from public.profiles where role = 'admin') into has_admin;
  if has_admin then
    update public.admin_registration_settings
    set remaining_signups = remaining_signups - 1
    where singleton = true and remaining_signups > 0;
    if not found then
      raise exception 'No hay registros habilitados.' using errcode = '42501';
    end if;
  elsif p_initial_admin_email is null or lower(p_email) <> lower(p_initial_admin_email) then
    raise exception 'El correo no es el administrador inicial autorizado.' using errcode = '42501';
  end if;

  insert into public.profiles (id, full_name, role, active)
  values (p_user_id, trim(p_full_name), 'admin', true);

  return p_user_id;
end;
$$;

revoke all on function public.claim_admin_registration(uuid, text, text, text) from public;
grant execute on function public.claim_admin_registration(uuid, text, text, text) to service_role;

create or replace function public.set_service_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set active = p_active
  where id = p_user_id and role = 'service';

  if not found then
    raise exception 'Solo se puede cambiar el estado del personal de servicio.' using errcode = '42501';
  end if;

  if not p_active then
    update public.tickets set agente_id = null where agente_id = p_user_id;
  end if;
end;
$$;

revoke all on function public.set_service_active(uuid, boolean) from public;
grant execute on function public.set_service_active(uuid, boolean) to service_role;

grant select on public.profiles to authenticated;
grant update (active) on public.profiles to authenticated;
grant select, update, delete on public.tickets to authenticated;
grant select, update (remaining_signups) on public.admin_registration_settings to authenticated;
grant insert (codigo, tipo, correo, amie, nombre, asunto, descripcion)
  on public.tickets to anon, authenticated;

drop policy if exists "profiles_read_self_or_admin" on public.profiles;
create policy "profiles_read_self_or_admin"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "admin_update_profiles" on public.profiles;
create policy "admin_update_profiles"
  on public.profiles for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin_read_registration_settings" on public.admin_registration_settings;
create policy "admin_read_registration_settings"
  on public.admin_registration_settings for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "admin_update_registration_settings" on public.admin_registration_settings;
create policy "admin_update_registration_settings"
  on public.admin_registration_settings for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "public_submit_tickets" on public.tickets;
create policy "public_submit_tickets"
  on public.tickets for insert to anon, authenticated
  with check (estado = 'Pendiente' and agente_id is null);

drop policy if exists "admin_read_tickets" on public.tickets;
create policy "admin_read_tickets"
  on public.tickets for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "admin_update_tickets" on public.tickets;
create policy "admin_update_tickets"
  on public.tickets for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "admin_delete_tickets" on public.tickets;
create policy "admin_delete_tickets"
  on public.tickets for delete to authenticated
  using ((select public.is_admin()));