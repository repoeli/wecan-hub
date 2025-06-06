-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- Partner table
create table "Partner" (
  id uuid primary key default gen_random_uuid(),
  name text,
  address text,
  lat numeric,
  lng numeric,
  status text check (status in ('pending','approved')),
  created_at timestamptz default now()
);

-- Bin table
create table "Bin" (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references "Partner"(id),
  lat numeric,
  lng numeric,
  status text check (status in ('empty','full','needs_pickup')),
  last_emptied_at timestamptz
);

-- Volunteer table
create table "Volunteer" (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  is_verified boolean default false
);

-- Pickup table
create table "Pickup" (
  id uuid primary key default gen_random_uuid(),
  bin_id uuid references "Bin"(id),
  volunteer_id uuid references "Volunteer"(id),
  state text check (state in ('queued','assigned','collected','delivered')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Impact table
create table "Impact" (
  id uuid primary key default gen_random_uuid(),
  cans int,
  revenue_pence int,
  meals int,
  created_at timestamptz default now()
);

-- Enable Row Level Security on tables
alter table "Partner" enable row level security;
alter table "Bin" enable row level security;
alter table "Volunteer" enable row level security;
alter table "Pickup" enable row level security;
alter table "Impact" enable row level security;

-- anon may select approved partners
create policy "Anon select approved partners"
  on "Partner"
  for select
  to anon
  using (status = 'approved');

-- anon may select bins not needing pickup
create policy "Anon select bins not needing pickup"
  on "Bin"
  for select
  to anon
  using (status != 'needs_pickup');

-- admin full access on all tables
-- Partner
create policy "Admin full access Partner"
  on "Partner"
  for all
  to authenticated
  using (auth.role() = 'admin')
  with check (auth.role() = 'admin');
-- Bin
create policy "Admin full access Bin"
  on "Bin"
  for all
  to authenticated
  using (auth.role() = 'admin')
  with check (auth.role() = 'admin');
-- Volunteer
create policy "Admin full access Volunteer"
  on "Volunteer"
  for all
  to authenticated
  using (auth.role() = 'admin')
  with check (auth.role() = 'admin');
-- Pickup
create policy "Admin full access Pickup"
  on "Pickup"
  for all
  to authenticated
  using (auth.role() = 'admin')
  with check (auth.role() = 'admin');
-- Impact
create policy "Admin full access Impact"
  on "Impact"
  for all
  to authenticated
  using (auth.role() = 'admin')
  with check (auth.role() = 'admin');
