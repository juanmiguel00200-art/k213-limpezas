# K213 · Gerenciador de Limpezas

Aplicativo com **páginas separadas de verdade** para coordenar limpezas de
um imóvel de temporada entre cliente e profissional, com sincronização em
tempo real entre dispositivos diferentes.

Construído para **Könizstrasse 213, Liebefeld**, mas o endereço e o
checklist podem ser editados para qualquer imóvel.

## Como o acesso funciona

- Uma única tela de login (`index.html`).
- Ao entrar, cada conta é levada automaticamente para a página certa:
  **cliente → `cliente.html`**, **profissional → `profissional.html`**.
- Uma conta de cliente não consegue abrir a tela do profissional (e
  vice-versa) — é redirecionada de volta.
- Você usa como profissional; manda o mesmo link do site para o cliente,
  e a tela de login decide para onde ele vai.

## Funcionalidades

- Contas separadas para Cliente e Profissional, com autenticação segura.
- Requisições de limpeza: data, horário, duração da estadia, hóspedes,
  observações.
- Lavagem de roupa opcional: quando marcada, o valor sobe de 40 para
  50 CHF automaticamente.
- Checklist padrão editável pelo profissional, aplicado a cada nova
  requisição, com marcação item a item.
- Cronômetro automático de trabalho (iniciar/finalizar), com tempo total
  calculado sozinho.
- Upload de fotos do serviço concluído.
- Relatórios: total de limpezas, tempo médio, faturamento acumulado.
- Sincronização em tempo real entre qualquer dispositivo logado.
- Código de referência único por requisição (ex: `K213-0007`).

## Estrutura de arquivos

```
index.html            → login (redireciona por papel)
cliente.html           → painel do cliente
profissional.html      → painel do profissional
relatorios.html        → relatórios (profissional)
assets/style.css       → visual compartilhado
assets/app-common.js   → configuração do Supabase + funções compartilhadas
k213-supabase-setup.sql → schema do banco de dados
```

## Stack técnica

- **Front-end:** HTML, CSS e JavaScript puro, sem framework nem build —
  hospedável em qualquer serviço de arquivos estáticos.
- **Back-end:** [Supabase](https://supabase.com) — Postgres gerenciado,
  autenticação, tempo real e armazenamento de arquivos, com plano
  gratuito generoso.
- **Segurança:** Row Level Security (RLS) garante que cada cliente só
  veja suas próprias requisições, e que apenas o profissional edite o
  checklist padrão ou veja todas as tarefas.

## Como configurar

Veja o passo a passo completo em [`LEIA-ME-SETUP.md`](./LEIA-ME-SETUP.md).
