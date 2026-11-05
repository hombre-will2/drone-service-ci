create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  drone_model text check (drone_model is null or char_length(btrim(drone_model)) between 1 and 80),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(btrim(message)) between 10 and 1000),
  publication_consent boolean not null check (publication_consent is true),
  created_at timestamptz not null default now()
);

alter table public.reviews enable row level security;

grant usage on schema public to anon;
grant select on public.reviews to anon;
grant insert (name, drone_model, rating, message, publication_consent) on public.reviews to anon;

drop policy if exists "Anyone can read published reviews" on public.reviews;
create policy "Anyone can read published reviews"
  on public.reviews for select to anon
  using (true);

drop policy if exists "Customers can submit reviews with publication consent" on public.reviews;
create policy "Customers can submit reviews with publication consent"
  on public.reviews for insert to anon
  with check (publication_consent is true);
