# K213 · Gerenciador de Limpezas — Guia de Configuração

Aplicativo de verdade, com **páginas separadas** (não é tudo dentro de um
arquivo só): tela de login, painel do cliente e painel do profissional são
telas diferentes, e cada pessoa só vê a que é dela.

Back-end: **Supabase** (banco de dados + autenticação + tempo real +
fotos, gratuito). Hospedagem: qualquer serviço de arquivos estáticos
(GitHub Pages, Netlify, Vercel).

## Estrutura do projeto

```
k213-projeto/
├── index.html            ← tela de login (única porta de entrada)
├── cliente.html           ← painel do cliente (só quem tem conta "cliente" acessa)
├── profissional.html      ← painel do profissional (só quem tem conta "profissional" acessa)
├── relatorios.html        ← relatórios (só profissional)
├── assets/
│   ├── style.css           ← visual compartilhado por todas as páginas
│   └── app-common.js       ← configuração do Supabase + funções compartilhadas
├── k213-supabase-setup.sql ← script para criar o banco no Supabase
├── README.md
└── LEIA-ME-SETUP.md        ← este guia
```

## Como funciona o acesso (a parte que você pediu)

- Existe **uma única tela de login** (`index.html`).
- Ao entrar, o sistema olha o papel da conta (cliente ou profissional) e
  **redireciona automaticamente**: cliente vai para `cliente.html`,
  profissional vai para `profissional.html`.
- Se um cliente tentar abrir `profissional.html` na mão, é redirecionado
  de volta para a tela dele — e vice-versa. Ninguém vê a tela da outra
  pessoa.
- **Uso real recomendado:** você cria a sua conta como "Profissional".
  Depois, cria (ou pede pro seu cliente criar, pelo link do `index.html`)
  uma conta como "Cliente". Você manda pro cliente só o link do site — a
  tela de login decide pra onde ele vai, você nunca precisa mandar um
  arquivo diferente pra cada um.

## Passo 1 — Criar o projeto no Supabase (grátis)

1. Acesse **https://supabase.com** e crie uma conta.
2. Clique em **New Project**, escolha nome, senha do banco (guarde-a) e
   região (ex: `Central EU` para Suíça).
3. Aguarde ~2 minutos até o projeto ficar pronto.

## Passo 2 — Rodar o script do banco de dados

1. No painel do projeto, abra **SQL Editor → New query**.
2. Copie **todo** o conteúdo de `k213-supabase-setup.sql` e cole no editor.
3. Clique em **Run**. Deve aparecer "Success. No rows returned".

Isso cria: perfis (cliente/profissional), requisições de limpeza,
checklist padrão, regras de segurança (RLS), sincronização em tempo real
e o espaço de armazenamento das fotos.

## Passo 3 — Pegar suas chaves de API

1. No painel, vá em **Settings → API**.
2. Copie o **Project URL** (`https://xxxxxxxx.supabase.co`).
3. Copie a chave **anon public**.

## Passo 4 — Configurar o app (um único lugar agora)

Abra `assets/app-common.js` e troque estas duas linhas no topo:

```js
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_PUBLICA';
```

Como todas as páginas carregam esse mesmo arquivo, você só configura uma
vez e vale para o site inteiro.

> Se abrir sem configurar, cada página mostra um aviso claro dizendo o que
> falta — não fica travado sem explicação.

## Passo 5 — Testar localmente

Abra `index.html` no navegador (duas abas, uma normal e uma anônima),
crie uma conta como **Profissional** em uma e como **Cliente** na outra.
Crie uma requisição na conta do cliente e veja aparecer **automaticamente**
na conta do profissional — essa é a sincronização em tempo real.

Teste também:
- **Checklist:** marque/desmarque os itens no painel do profissional —
  cada clique salva na hora.
- **Cronômetro:** clique em "Iniciar trabalho" e veja o tempo contando
  sozinho, depois "Finalizar trabalho".

### Sobre confirmação de email

Por padrão o Supabase exige confirmar o email antes do primeiro login.
Para testar rápido, desative em **Authentication → Providers → Email →
Confirm email**. Para uso real, é mais seguro manter ativado.

## Passo 6 — Publicar no GitHub Pages (grátis)

1. Crie um repositório novo no GitHub.
2. Suba **todos os arquivos e pastas** deste projeto (mantendo a pasta
   `assets/` junto — as páginas dependem dela).
3. **Settings → Pages** → escolha a branch (`main`) e a pasta (`/root`).
4. Em 1–2 minutos o GitHub mostra o link público, ex:
   `https://seu-usuario.github.io/k213-app/`

O link que você manda pro cliente é o mesmo link principal — a tela de
login cuida do resto.

> **Atenção:** a chave `anon public` do Supabase é feita para ficar
> exposta no navegador — as regras de segurança (RLS) do Passo 2 que
> protegem os dados. Nunca coloque a senha do banco nem a chave
> `service_role` nos arquivos do site.

## Uso no dia a dia

- **Você (profissional):** entra, vê todas as tarefas, inicia/finaliza o
  cronômetro, marca o checklist, envia fotos, conclui, confere relatórios.
- **Cliente:** entra, cria requisições (com ou sem lavagem de roupa),
  acompanha o status e o andamento do serviço.
- Tudo sincroniza automaticamente entre qualquer dispositivo.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Aviso "Configuração pendente" | As chaves em `assets/app-common.js` ainda não foram preenchidas |
| Cliente cai na tela de profissional (ou vice-versa) | Normal — é o redirecionamento automático te levando pra tua tela certa |
| Checklist não marca | Confira se está logado como Profissional — só essa conta edita o checklist da tarefa |
| Requisição não aparece pro profissional | Verifique se o script SQL rodou sem erro, principalmente a linha `alter publication supabase_realtime` |
| Erro ao enviar fotos | Confirme que o bucket `cleaning-photos` foi criado (parte final do script SQL) |
