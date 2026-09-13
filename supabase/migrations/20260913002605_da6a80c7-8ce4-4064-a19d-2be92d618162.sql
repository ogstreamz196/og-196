create extension if not exists pg_trgm with schema extensions;

create table if not exists public.tv_catalog_items (
  id bigint generated always as identity primary key,
  generation uuid not null,
  section text not null,
  category text not null,
  title text not null,
  logo text,
  url_template text not null,
  idx integer not null
);

create index if not exists tv_catalog_items_gen_section_cat_idx on public.tv_catalog_items (generation, section, category, idx);
create index if not exists tv_catalog_items_gen_section_idx on public.tv_catalog_items (generation, section, idx);
create index if not exists tv_catalog_items_title_trgm on public.tv_catalog_items using gin (title extensions.gin_trgm_ops);

create table if not exists public.tv_catalog_categories (
  id bigint generated always as identity primary key,
  generation uuid not null,
  section text not null,
  category text not null,
  item_count integer not null default 0
);
create index if not exists tv_catalog_categories_gen_section_idx on public.tv_catalog_categories (generation, section);

create table if not exists public.tv_catalog_meta (
  id smallint primary key default 1 check (id = 1),
  generation uuid,
  status text not null default 'idle',
  total integer not null default 0,
  error text,
  started_at timestamptz,
  refreshed_at timestamptz
);
insert into public.tv_catalog_meta (id) values (1) on conflict (id) do nothing;

grant select on public.tv_catalog_items to authenticated;
grant select on public.tv_catalog_categories to authenticated;
grant select on public.tv_catalog_meta to authenticated;
grant all on public.tv_catalog_items to service_role;
grant all on public.tv_catalog_categories to service_role;
grant all on public.tv_catalog_meta to service_role;

alter table public.tv_catalog_items enable row level security;
alter table public.tv_catalog_categories enable row level security;
alter table public.tv_catalog_meta enable row level security;

drop policy if exists "tv catalog items readable" on public.tv_catalog_items;
create policy "tv catalog items readable" on public.tv_catalog_items for select to authenticated using (true);
drop policy if exists "tv catalog categories readable" on public.tv_catalog_categories;
create policy "tv catalog categories readable" on public.tv_catalog_categories for select to authenticated using (true);
drop policy if exists "tv catalog meta readable" on public.tv_catalog_meta;
create policy "tv catalog meta readable" on public.tv_catalog_meta for select to authenticated using (true);

create or replace function public.tv_catalog_finish(_generation uuid, _total integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.tv_catalog_categories where generation <> _generation;
  insert into public.tv_catalog_categories (generation, section, category, item_count)
  select _generation, section, category, count(*)::int
  from public.tv_catalog_items
  where generation = _generation
  group by section, category;

  update public.tv_catalog_meta
  set generation = _generation, status = 'ready', total = _total, error = null, refreshed_at = now()
  where id = 1;

  delete from public.tv_catalog_items where generation <> _generation;
end;
$$;
revoke all on function public.tv_catalog_finish(uuid, integer) from public, anon, authenticated;
grant execute on function public.tv_catalog_finish(uuid, integer) to service_role;

create or replace function public.tv_categories(_section text)
returns table (category text, item_count integer)
language sql
stable
security definer
set search_path = public
as $$
  select c.category, c.item_count
  from public.tv_catalog_categories c
  join public.tv_catalog_meta m on m.id = 1 and m.generation = c.generation
  where c.section = _section
  order by c.category;
$$;
grant execute on function public.tv_categories(text) to authenticated, service_role;

create or replace function public.tv_items(_section text, _category text, _search text, _limit integer, _offset integer)
returns table (id bigint, title text, category text, logo text, url_template text)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.title, i.category, i.logo, i.url_template
  from public.tv_catalog_items i
  join public.tv_catalog_meta m on m.id = 1 and m.generation = i.generation
  where i.section = _section
    and (_category is null or i.category = _category)
    and (_search is null or _search = '' or i.title ilike '%' || _search || '%')
  order by i.idx
  limit least(coalesce(_limit, 200), 500)
  offset greatest(coalesce(_offset, 0), 0);
$$;
grant execute on function public.tv_items(text, text, text, integer, integer) to authenticated, service_role;