create type public.app_role as enum ('admin','producer','editor');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_team_member(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

create or replace function public.can_manage(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role in ('admin','producer'))
$$;

create policy "profiles self or team read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_team_member(auth.uid()));
create policy "profiles self update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy "roles read own or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "admins insert roles" on public.user_roles for insert to authenticated
  with check (public.has_role(auth.uid(),'admin'));
create policy "admins delete roles" on public.user_roles for delete to authenticated
  using (public.has_role(auth.uid(),'admin'));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)));
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create table public.editors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.editors to authenticated;
grant all on public.editors to service_role;
alter table public.editors enable row level security;
create policy "team read editors" on public.editors for select to authenticated using (public.is_team_member(auth.uid()));
create policy "managers write editors" on public.editors for all to authenticated using (public.can_manage(auth.uid())) with check (public.can_manage(auth.uid()));

insert into public.editors (name) values
 ('Beau'),('Esoft'),('Jackson'),('Matt'),('Lauren'),('Daniel'),('Maya'),('Will'),('Connor'),('Corey'),('Ben B'),('Danny'),('Bakar'),('Eli');

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  email text,
  phone text,
  branding_notes text,
  assets_link text,
  is_top_agent boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.clients to authenticated;
grant all on public.clients to service_role;
alter table public.clients enable row level security;
create policy "team read clients" on public.clients for select to authenticated using (public.is_team_member(auth.uid()));
create policy "managers write clients" on public.clients for all to authenticated using (public.can_manage(auth.uid())) with check (public.can_manage(auth.uid()));

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  department text not null default 'VE',
  sheet_month text,
  shoot_date date,
  shoot_date_text text,
  calendar_url text,
  order_number text,
  category text,
  photographer text,
  client text,
  address text,
  address_url text,
  status text not null default 'Waiting on photos/footage to be uploaded',
  editor text,
  delivery_text text,
  due_date date,
  deliverable_links text,
  project_name text,
  staff_assigned text,
  notes text,
  source_sheet text,
  source_row int,
  import_key text unique,
  status_updated_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index jobs_status_idx on public.jobs(status);
create index jobs_due_idx on public.jobs(due_date);
grant select, insert, update, delete on public.jobs to authenticated;
grant all on public.jobs to service_role;
alter table public.jobs enable row level security;
create policy "team read jobs" on public.jobs for select to authenticated using (public.is_team_member(auth.uid()));
create policy "team insert jobs" on public.jobs for insert to authenticated with check (public.is_team_member(auth.uid()));
create policy "team update jobs" on public.jobs for update to authenticated using (public.is_team_member(auth.uid())) with check (public.is_team_member(auth.uid()));
create policy "managers delete jobs" on public.jobs for delete to authenticated using (public.can_manage(auth.uid()));

create or replace function public.jobs_before_write()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  -- Default deadline: spreadsheet convention "Deliver by <shoot + 3 days> no later than 5PM"
  if new.due_date is null and new.shoot_date is not null and new.department <> 'Ongoing' then
    new.due_date := new.shoot_date + 3;
  end if;
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    new.status_updated_at := now();
    if new.status in ('Delivered','Delivered / Invoiced') then
      new.delivered_at := coalesce(new.delivered_at, now());
    elsif tg_op = 'UPDATE' then
      new.delivered_at := null;
    end if;
  end if;
  return new;
end $$;
create trigger jobs_before_write before insert or update on public.jobs
  for each row execute function public.jobs_before_write();