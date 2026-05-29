create table if not exists public.regions (
  region_id uuid primary key default gen_random_uuid(),
  region_code varchar(20) unique,
  region_name varchar(150) not null
);

create table if not exists public.provinces (
  province_id uuid primary key default gen_random_uuid(),
  region_id uuid not null references public.regions(region_id),
  province_name varchar(150) not null,
  constraint provinces_region_name_unique unique (region_id, province_name)
);

create table if not exists public.cities_municipalities (
  city_municipality_id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.provinces(province_id),
  name varchar(150) not null,
  type varchar(50),
  constraint cities_municipalities_province_name_unique unique (province_id, name)
);

alter table public.politicians
  add column if not exists jurisdiction_type varchar(20),
  add column if not exists position_category varchar(50),
  add column if not exists region_id uuid references public.regions(region_id),
  add column if not exists province_id uuid references public.provinces(province_id),
  add column if not exists city_municipality_id uuid references public.cities_municipalities(city_municipality_id);

create index if not exists idx_provinces_region_id on public.provinces(region_id);
create index if not exists idx_cities_municipalities_province_id on public.cities_municipalities(province_id);
create index if not exists idx_politicians_jurisdiction_type on public.politicians(jurisdiction_type);
create index if not exists idx_politicians_position_category on public.politicians(position_category);
create index if not exists idx_politicians_region_id on public.politicians(region_id);
create index if not exists idx_politicians_province_id on public.politicians(province_id);
create index if not exists idx_politicians_city_municipality_id on public.politicians(city_municipality_id);

insert into public.regions (region_code, region_name)
values ('REGION_VII', 'Region VII - Central Visayas')
on conflict (region_code) do update set region_name = excluded.region_name;

insert into public.provinces (region_id, province_name)
select region_id, 'Cebu'
from public.regions
where region_code = 'REGION_VII'
on conflict (region_id, province_name) do nothing;

insert into public.cities_municipalities (province_id, name, type)
select p.province_id, location.name, location.type
from public.provinces p
join public.regions r on r.region_id = p.region_id
cross join (
  values
    ('Cebu City', 'CITY'),
    ('Mandaue City', 'CITY'),
    ('Lapu-Lapu City', 'CITY'),
    ('Talisay City', 'CITY'),
    ('Toledo City', 'CITY'),
    ('Danao City', 'CITY'),
    ('Carcar City', 'CITY'),
    ('Naga City', 'CITY'),
    ('Bogo City', 'CITY'),
    ('Minglanilla', 'MUNICIPALITY'),
    ('Consolacion', 'MUNICIPALITY'),
    ('Liloan', 'MUNICIPALITY'),
    ('Cordova', 'MUNICIPALITY'),
    ('San Fernando', 'MUNICIPALITY'),
    ('Argao', 'MUNICIPALITY'),
    ('Dalaguete', 'MUNICIPALITY'),
    ('Oslob', 'MUNICIPALITY'),
    ('Moalboal', 'MUNICIPALITY'),
    ('Dumanjug', 'MUNICIPALITY'),
    ('Barili', 'MUNICIPALITY'),
    ('Balamban', 'MUNICIPALITY'),
    ('Tuburan', 'MUNICIPALITY'),
    ('Asturias', 'MUNICIPALITY'),
    ('Bantayan', 'MUNICIPALITY'),
    ('Medellin', 'MUNICIPALITY'),
    ('Daanbantayan', 'MUNICIPALITY')
) as location(name, type)
where r.region_code = 'REGION_VII'
  and p.province_name = 'Cebu'
on conflict (province_id, name) do update set type = excluded.type;

update public.politicians
set jurisdiction_type = case
    when jurisdiction_type is not null then jurisdiction_type
    when upper(trim(coalesce(jurisdiction, ''))) = 'NATIONAL' then 'NATIONAL'
    else 'LOCAL'
  end,
  position_category = case
    when position_category is not null then position_category
    when position in ('President', 'Vice President', 'Cabinet Secretary', 'Undersecretary', 'Assistant Secretary') then 'Executive'
    when position in ('Senator', 'Senate President', 'House Representative', 'Party-list Representative', 'Speaker of the House') then 'Legislative'
    when position in ('Chief Justice', 'Associate Justice', 'Judge') then 'Judicial'
    when position in ('Governor', 'Vice Governor', 'Provincial Board Member', 'Mayor', 'Vice Mayor', 'Councilor', 'City Councilor') then 'Local Government'
    else null
  end;

update public.politicians politician
set region_id = r.region_id,
  province_id = p.province_id,
  city_municipality_id = case
    when politician.position in ('Mayor', 'Vice Mayor', 'Councilor', 'City Councilor') then c.city_municipality_id
    else politician.city_municipality_id
  end,
  jurisdiction = case
    when politician.position = 'City Councilor' then 'CEBU_CITY'
    else politician.jurisdiction
  end,
  position = case
    when politician.position = 'City Councilor' then 'Councilor'
    else politician.position
  end
from public.regions r
join public.provinces p on p.region_id = r.region_id and p.province_name = 'Cebu'
left join public.cities_municipalities c on c.province_id = p.province_id and c.name = 'Cebu City'
where r.region_code = 'REGION_VII'
  and politician.jurisdiction_type = 'LOCAL'
  and politician.province_id is null
  and upper(replace(trim(coalesce(politician.jurisdiction, '')), ' ', '_')) in ('CEBU_CITY', 'CEBU');
