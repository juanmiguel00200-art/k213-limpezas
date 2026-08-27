-- ============================================================
-- K213 · Gerenciador de Limpezas — Schema Supabase
-- ============================================================
-- Como usar:
-- 1. Crie um projeto gratuito em https://supabase.com
-- 2. Abra "SQL Editor" no painel do projeto
-- 3. Cole TODO este arquivo e clique em "Run"
-- ============================================================

-- ------------------------------------------------------------
-- 1. PERFIS (nome + papel de cada usuário)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null check (role in ('cliente','profissional')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Perfis visíveis para autenticados"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Usuário cria seu próprio perfil"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Usuário atualiza seu próprio perfil"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id);

-- Função auxiliar: o usuário atual é profissional?
create or replace function public.is_profissional()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'profissional'
  );
$$;

-- ------------------------------------------------------------
-- 2. CHECKLIST PADRÃO (configuração única, editável pelo profissional)
-- ------------------------------------------------------------
create table if not exists public.default_checklist (
  id int primary key default 1,
  items jsonb not null,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

alter table public.default_checklist enable row level security;

create policy "Checklist visível para autenticados"
  on public.default_checklist for select
  to authenticated
  using (true);

create policy "Somente profissional edita o checklist"
  on public.default_checklist for all
  to authenticated
  using (public.is_profissional())
  with check (public.is_profissional());

insert into public.default_checklist (id, items) values (
  1,
  '[
    {"id":"c1","label":"Pegar a chave no cofre (código enviado pelo Fabio)"},
    {"id":"c2","label":"Tirar os sapatos durante a limpeza"},
    {"id":"c3","label":"Trocar a roupa de cama (sala/quarto)"},
    {"id":"c4","label":"Aspirar o chão (todos os cômodos)"},
    {"id":"c5","label":"Limpar janelas da cozinha, sala e quarto (com spray de vidro)"},
    {"id":"c6","label":"Descartar o lixo (contêiner ou levar consigo)"},
    {"id":"c7","label":"Tirar o pó (móveis, peitoris, interruptores, maçanetas)"},
    {"id":"c8","label":"Arejar o apartamento antes da chegada do hóspede"},
    {"id":"c9","label":"Arrumar tudo para ficar fotogênico (almofadas, decoração)"},
    {"id":"c10","label":"Fechar o armário de produtos de limpeza com chave"},
    {"id":"c11","label":"Verificar e avisar o Fabio sobre danos ou problemas"},
    {"id":"c12","label":"Limpar a banheira"},
    {"id":"c13","label":"Remover calcário das torneiras (chuveiro e lavabo)"},
    {"id":"c14","label":"Lavar o vaso sanitário"},
    {"id":"c15","label":"Sacudir/trocar o pano de chão (a cada 2–3 estadias)"},
    {"id":"c16","label":"Pendurar uma toalha de mão nova"},
    {"id":"c17","label":"Esvaziar lixeiras e colocar sacos novos"},
    {"id":"c18","label":"Repor papel higiênico e sabonete"},
    {"id":"c19","label":"Verificar utensílios de cozinha (lavar novamente se necessário)"},
    {"id":"c20","label":"Guardar tudo limpo e organizado na cozinha"},
    {"id":"c21","label":"Limpar bancadas, fogão e pia"},
    {"id":"c22","label":"Verificar geladeira (descartar alimentos esquecidos)"},
    {"id":"c23","label":"Esvaziar e limpar a máquina de café"},
    {"id":"c24","label":"Repor 3 cápsulas de cada tipo (total 9)"},
    {"id":"c25","label":"Verificar chão – lavar se houver manchas"},
    {"id":"c26","label":"Verificar o espelho (borrifar com spray se necessário)"},
    {"id":"c27","label":"Colocar toalhas enroladas sobre a cama (1 grande + 1 pequena por hóspede)"},
    {"id":"c28","label":"Ao sair: colocar a chave de volta no cofre e enviar foto para o Fabio"},
    {"id":"laundry","label":"🧺 Lavagem de roupa (opcional) → +10 CHF"}
  ]'::jsonb
) on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3. REQUISIÇÕES DE LIMPEZA
-- ------------------------------------------------------------
create table if not exists public.cleaning_requests (
  id uuid primary key default gen_random_uuid(),
  ref_code text,
  client_id uuid references auth.users on delete cascade not null,
  client_name text not null,
  client_email text,
  address text not null default 'Könizstrasse 213, Liebefeld',
  date date not null,
  time time not null,
  stay_duration int not null,
  guest_count int not null,
  notes text,
  laundry_service boolean not null default false,
  price numeric not null default 40,
  status text not null default 'pending' check (status in ('pending','in-progress','completed')),
  checklist jsonb not null default '[]',
  work_start timestamptz,
  work_end timestamptz,
  photos jsonb not null default '[]',
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.cleaning_requests enable row level security;

create policy "Cliente vê as próprias, profissional vê todas"
  on public.cleaning_requests for select
  to authenticated
  using (auth.uid() = client_id or public.is_profissional());

create policy "Cliente cria sua própria requisição"
  on public.cleaning_requests for insert
  to authenticated
  with check (auth.uid() = client_id);

create policy "Cliente edita enquanto pendente, profissional edita tudo"
  on public.cleaning_requests for update
  to authenticated
  using (
    (auth.uid() = client_id and status = 'pending')
    or public.is_profissional()
  );

create policy "Cliente cancela enquanto pendente"
  on public.cleaning_requests for delete
  to authenticated
  using (auth.uid() = client_id and status = 'pending');

-- Código de referência sequencial tipo bilhete: K213-0001, K213-0002...
create sequence if not exists public.cleaning_ref_seq;

create or replace function public.set_ref_code()
returns trigger
language plpgsql
as $$
begin
  new.ref_code := 'K213-' || lpad(nextval('public.cleaning_ref_seq')::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_set_ref_code on public.cleaning_requests;
create trigger trg_set_ref_code
  before insert on public.cleaning_requests
  for each row execute function public.set_ref_code();

-- Sincronização em tempo real
alter publication supabase_realtime add table public.cleaning_requests;

-- ------------------------------------------------------------
-- 4. ARMAZENAMENTO DE FOTOS
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cleaning-photos', 'cleaning-photos', true)
on conflict (id) do nothing;

create policy "Fotos públicas para leitura"
  on storage.objects for select
  using (bucket_id = 'cleaning-photos');

create policy "Autenticados podem enviar fotos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'cleaning-photos');

-- ============================================================
-- Fim do script. Se tudo rodou sem erro, o backend está pronto.
-- ============================================================
