/* ============================================================
   CleanSync — APP COMMON
   ============================================================

   Núcleo compartilhado do CleanSync.

   Inclui:
   - Configuração Supabase
   - Login próprio por usuário + senha
   - Recuperação por código
   - Sessão local
   - Controle de acesso
   - Realtime das limpezas
   - Realtime do chat
   - Criação/obtenção de conversa
   - Botão "Abrir chat"
   - Contagem de mensagens
   - Última mensagem
   - Cronômetros
   - Checklist
   - Fotos
   - Ações administrativas
   - Instalação PWA
   - Notificações

   IMPORTANTE:
   O sistema atual usa autenticação própria através da tabela
   "usuarios" e localStorage.

   Por isso NÃO usamos:
       supabase.auth.getUser()

   A sessão atual é:
       k213_session

   ============================================================ */


/* ============================================================
   CONFIGURAÇÃO SUPABASE
============================================================ */

const SUPABASE_URL =
  'https://oyxmrrazgjdnyzhyinhc.supabase.co';

const SUPABASE_ANON_KEY =
  'sb_publishable_IVWPCoIWVhkvP_u7J0ZTsA_QeK-MNNI';


const PRICE_BASE = 40;
const PRICE_WITH_LAUNDRY = 50;

const APP_CONFIGURED = true;


/*
   IMPORTANTE:

   A biblioteca do Supabase já cria window.supabase.

   Por isso usamos "sb" para o cliente.
*/

const sb =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );


/* ============================================================
   CANAIS REALTIME
============================================================ */

let realtimeChannel = null;
let chatRealtimeChannel = null;


/* ============================================================
   AVISO DE CONFIGURAÇÃO
============================================================ */

function renderSetupWarning(){

  document.body.innerHTML = `

    <div class="setup-warning">

      <h2>⚠️ Configuração pendente</h2>

      <p>
        Este app ainda não está ligado
        corretamente ao Supabase.
      </p>

      <p>
        Verifique o arquivo
        <code>app-common.js</code>.
      </p>

    </div>

  `;

}


/* ============================================================
   AUTENTICAÇÃO PRÓPRIA
============================================================ */


/* SHA-256 */

async function sha256Hex(text){

  const buf =
    await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(text)
    );

  return Array
    .from(new Uint8Array(buf))
    .map(
      b =>
        b.toString(16).padStart(2,'0')
    )
    .join('');

}


/* ============================================================
   CÓDIGO DE RECUPERAÇÃO
============================================================ */

function generateRecoveryCode(){

  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  let code = '';

  for(let i = 0; i < 8; i++){

    code +=
      chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];

  }

  return (
    code.slice(0,4) +
    '-' +
    code.slice(4)
  );

}


/* ============================================================
   SESSÃO
============================================================ */

function getSession(){

  try{

    return JSON.parse(
      localStorage.getItem(
        'k213_session'
      ) || 'null'
    );

  }catch{

    return null;

  }

}


function setSession(obj){

  localStorage.setItem(
    'k213_session',
    JSON.stringify(obj)
  );

}


function clearSession(){

  localStorage.removeItem(
    'k213_session'
  );

}


/* ============================================================
   CRIAR CONTA
============================================================ */

async function criarConta(
  name,
  username,
  password,
  role,
  address
){

  const password_hash =
    await sha256Hex(password);

  const recovery_code =
    generateRecoveryCode();


  const { data, error } =
    await sb.rpc(
      'k213_criar_conta',
      {
        p_name: name,
        p_username: username,
        p_password_hash:
          password_hash,
        p_recovery_code:
          recovery_code,
        p_role: role,
        p_address:
          address || null
      }
    );


  if(error){

    throw new Error(
      error.message.includes('já existe')
        ? 'Esse usuário já existe. Escolha outro nome de usuário.'
        : error.message
    );

  }


  const row =
    Array.isArray(data)
      ? data[0]
      : data;


  return {

    user: row,

    recovery_code:
      row.recovery_code

  };

}


/* ============================================================
   LOGIN
============================================================ */

async function entrarComSenha(
  username,
  password
){

  const password_hash =
    await sha256Hex(password);


  const { data, error } =
    await sb.rpc(
      'k213_login',
      {
        p_username:
          username,

        p_password_hash:
          password_hash
      }
    );


  if(error) throw error;


  const row =
    Array.isArray(data)
      ? data[0]
      : data;


  if(!row){

    throw new Error(
      'Usuário ou senha incorretos.'
    );

  }


  return row;

}


/* ============================================================
   REDEFINIR SENHA
============================================================ */

async function redefinirSenha(
  username,
  recoveryCode,
  newPassword
){

  const newHash =
    await sha256Hex(newPassword);

  const newCode =
    generateRecoveryCode();


  const { data, error } =
    await sb.rpc(
      'k213_redefinir_senha',
      {

        p_username:
          username,

        p_recovery_code:
          recoveryCode.toUpperCase(),

        p_new_password_hash:
          newHash,

        p_new_recovery_code:
          newCode

      }
    );


  if(error) throw error;


  const row =
    Array.isArray(data)
      ? data[0]
      : data;


  if(!row || !row.ok){

    throw new Error(
      'Usuário ou código de recuperação incorretos.'
    );

  }


  return newCode;

}


/* ============================================================
   NORMALIZAR ROLE
============================================================ */

function normalizeRole(role){

  if(role === 'professional')
    return 'professional';

  if(role === 'profissional')
    return 'professional';

  if(role === 'cleaner')
    return 'professional';

  if(role === 'client')
    return 'client';

  if(role === 'cliente')
    return 'client';

  if(role === 'admin')
    return 'admin';

  return role;

}


/* ============================================================
   CONTROLE DE ACESSO
============================================================ */

async function requireRole(requiredRole){

  if(!APP_CONFIGURED){

    renderSetupWarning();

    return null;

  }


  const session =
    getSession();


  if(!session){

    window.location.href =
      'index.html';

    return null;

  }


  const actualRole =
    normalizeRole(
      session.role
    );


  const required =
    normalizeRole(
      requiredRole
    );


  if(
    required &&
    actualRole !== required &&
    actualRole !== 'admin'
  ){

    if(actualRole === 'professional'){

      window.location.href =
        'profissional.html';

    }

    else if(actualRole === 'client'){

      window.location.href =
        'cliente.html';

    }

    else if(actualRole === 'admin'){

      window.location.href =
        'admin.html';

    }

    else{

      window.location.href =
        'index.html';

    }


    return null;

  }


  const profile = {

    id:
      session.id,

    full_name:
      session.name ||
      session.full_name ||
      session.username ||
      '',

    name:
      session.name ||
      session.full_name ||
      session.username ||
      '',

    role:
      actualRole,

    username:
      session.username,

    email:
      session.email ||
      session.username ||
      ''

  };


  paintWho(profile);


  return {

    user: {

      id:
        session.id,

      email:
        session.email ||
        session.username ||
        ''

    },

    profile

  };

}


/* ============================================================
   MOSTRAR USUÁRIO NO TOPO
============================================================ */

function paintWho(profile){

  const nameEl =
    document.getElementById(
      'topWhoName'
    );


  if(nameEl){

    const role =
      normalizeRole(
        profile.role
      );


    const roleLabel =
      role === 'admin'
        ? 'Administrador'
        : role === 'professional'
          ? 'Profissional'
          : 'Cliente';


    nameEl.textContent =
      (
        profile.full_name ||
        profile.name ||
        ''
      ) +
      ' · ' +
      roleLabel;

  }


  const adminLink =
    document.getElementById(
      'navAdminLink'
    );


  if(
    adminLink &&
    normalizeRole(profile.role) === 'admin'
  ){

    adminLink.style.display = '';

  }

}


/* ============================================================
   LOGOUT
============================================================ */

function logout(){

  if(
    realtimeChannel &&
    sb
  ){

    sb.removeChannel(
      realtimeChannel
    );

    realtimeChannel =
      null;

  }


  if(
    chatRealtimeChannel &&
    sb
  ){

    sb.removeChannel(
      chatRealtimeChannel
    );

    chatRealtimeChannel =
      null;

  }


  clearSession();


  window.location.href =
    'index.html';

}


/* ============================================================
   REALTIME — LIMPEZAS
============================================================ */

function startRealtime(onChange){

  if(
    realtimeChannel ||
    !sb
  ) return;


  realtimeChannel =
    sb
      .channel(
        'cleaning_requests_sync'
      )

      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'cleaning_requests'
        },
        onChange
      )

      .subscribe();

}


/* ============================================================
   DEBOUNCE
============================================================ */

function debounce(
  fn,
  wait = 250
){

  let t;


  return (...args) => {

    clearTimeout(t);


    t =
      setTimeout(
        () => fn(...args),
        wait
      );

  };

}


/* ============================================================
   ============================================================
   CHAT — FUNÇÕES PRINCIPAIS
   ============================================================
============================================================ */


/*
   Retorna o ID do usuário da sessão atual.
*/

function getCurrentUserId(){

  const session =
    getSession();

  return session
    ? session.id
    : null;

}


/* ============================================================
   OBTER / CRIAR CONVERSA
============================================================ */

async function getOrCreateConversation(
  cleaningId
){

  if(!cleaningId){

    throw new Error(
      'ID da limpeza não informado.'
    );

  }


  /*
     Primeiro tenta encontrar uma conversa
     existente.
  */

  const {
    data: existing,
    error: findError
  } = await sb
    .from('conversations')
    .select(`
      id,
      task_id,
      client_id,
      professional_id,
      created_at
    `)
    .eq(
      'task_id',
      cleaningId
    )
    .maybeSingle();


  if(findError){

    /*
       Se o banco estiver usando RPC
       para criação, tentamos abaixo.
    */

    console.warn(
      'Busca direta da conversa:',
      findError.message
    );

  }


  if(existing){

    return existing;

  }


  /*
     Busca a limpeza para descobrir
     cliente e profissional.
  */

  const {
    data: cleaning,
    error: cleaningError
  } = await sb
    .from('cleaning_requests')
    .select(`
      id,
      client_id,
      professional_id
    `)
    .eq(
      'id',
      cleaningId
    )
    .single();


  if(cleaningError){

    throw new Error(
      'Não foi possível localizar a limpeza: ' +
      cleaningError.message
    );

  }


  if(
    !cleaning.client_id ||
    !cleaning.professional_id
  ){

    throw new Error(
      'Esta limpeza ainda não possui cliente e profissional vinculados.'
    );

  }


  /*
     Tenta criação direta.
  */

  const {
    data: created,
    error: createError
  } = await sb
    .from('conversations')
    .insert({

      task_id:
        cleaning.id,

      client_id:
        cleaning.client_id,

      professional_id:
        cleaning.professional_id

    })
    .select()
    .single();


  if(!createError && created){

    return created;

  }


  /*
     Caso exista RPC no banco,
     tenta também.

     Isso é útil para o sistema atual,
     principalmente porque ele usa sessão
     própria.
  */

  const {
    data: rpcData,
    error: rpcError
  } = await sb.rpc(
    'create_cleaning_conversation',
    {
      p_cleaning_id:
        cleaningId
    }
  );


  if(!rpcError){

    const conversationId =
      Array.isArray(rpcData)
        ? rpcData[0]?.id ||
          rpcData[0]
        : rpcData?.id ||
          rpcData;


    if(conversationId){

      return {

        id:
          conversationId,

        task_id:
          cleaning.id,

        client_id:
          cleaning.client_id,

        professional_id:
          cleaning.professional_id

      };

    }

  }


  throw new Error(
    createError?.message ||
    rpcError?.message ||
    'Não foi possível criar a conversa.'
  );

}


/* ============================================================
   BOTÃO DE CHAT
============================================================ */

function chatButtonHtml(
  task,
  extraClass = ''
){

  if(!task || !task.id){

    return '';

  }


  return `

    <button
      type="button"
      class="btn btn-outline chat-open-btn ${extraClass}"
      onclick="openChat('${task.id}')"
    >
      💬 Abrir chat
    </button>

  `;

}


/* ============================================================
   ABRIR CHAT
============================================================ */

async function openChat(
  cleaningId
){

  if(!cleaningId){

    showSnackbar(
      'Limpeza não encontrada.'
    );

    return;

  }


  try{

    showSnackbar(
      'Abrindo chat...'
    );


    /*
       Confirma que a limpeza existe.
    */

    const {
      data: cleaning,
      error
    } = await sb
      .from('cleaning_requests')
      .select(`
        id,
        ref_code,
        client_name,
        client_id,
        professional_id,
        address,
        date
      `)
      .eq(
        'id',
        cleaningId
      )
      .single();


    if(error){

      throw error;

    }


    /*
       Cria ou recupera conversa.
    */

    const conversation =
      await getOrCreateConversation(
        cleaningId
      );


    /*
       Guarda contexto local para o chat.html.
    */

    sessionStorage.setItem(
      'cleansync_chat_context',
      JSON.stringify({

        conversationId:
          conversation.id,

        cleaningId:
          cleaning.id,

        refCode:
          cleaning.ref_code,

        address:
          cleaning.address

      })
    );


    /*
       Abre a página do chat.
    */

    window.location.href =
      'chat.html?conversation=' +
      encodeURIComponent(
        conversation.id
      ) +
      '&task=' +
      encodeURIComponent(
        cleaning.id
      );

  }
  catch(error){

    console.error(
      'Erro ao abrir chat:',
      error
    );


    showSnackbar(
      'Erro ao abrir chat: ' +
      error.message
    );

  }

}


/* ============================================================
   CARREGAR MENSAGENS
============================================================ */

async function loadChatMessages(
  conversationId
){

  if(!conversationId){

    return [];

  }


  const {
    data,
    error
  } = await sb
    .from('messages')
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      created_at
    `)
    .eq(
      'conversation_id',
      conversationId
    )
    .order(
      'created_at',
      {
        ascending: true
      }
    );


  if(error){

    console.error(
      'Erro ao carregar mensagens:',
      error
    );

    throw error;

  }


  return data || [];

}


/* ============================================================
   ENVIAR MENSAGEM
============================================================ */

async function sendChatMessage(
  conversationId,
  content
){

  const senderId =
    getCurrentUserId();


  if(!senderId){

    throw new Error(
      'Usuário não está logado.'
    );

  }


  const text =
    String(content || '').trim();


  if(!text){

    throw new Error(
      'Digite uma mensagem.'
    );

  }


  if(text.length > 2000){

    throw new Error(
      'A mensagem é muito longa.'
    );

  }


  const {
    data,
    error
  } = await sb
    .from('messages')
    .insert({

      conversation_id:
        conversationId,

      sender_id:
        senderId,

      content:
        text

    })
    .select()
    .single();


  if(error){

    console.error(
      'Erro ao enviar mensagem:',
      error
    );

    throw error;

  }


  return data;

}


/* ============================================================
   REALTIME DO CHAT
============================================================ */

function startChatRealtime(
  conversationId,
  onMessage
){

  if(!conversationId){

    return null;

  }


  if(chatRealtimeChannel){

    sb.removeChannel(
      chatRealtimeChannel
    );

    chatRealtimeChannel =
      null;

  }


  chatRealtimeChannel =
    sb
      .channel(
        'cleansync-chat-' +
        conversationId
      )

      .on(
        'postgres_changes',
        {

          event:
            'INSERT',

          schema:
            'public',

          table:
            'messages',

          filter:
            'conversation_id=eq.' +
            conversationId

        },

        payload => {

          if(
            typeof onMessage ===
            'function'
          ){

            onMessage(
              payload.new
            );

          }

        }

      )

      .subscribe(
        status => {

          console.log(
            'CleanSync Chat Realtime:',
            status
          );

        }
      );


  return chatRealtimeChannel;

}


/* ============================================================
   PARAR REALTIME DO CHAT
============================================================ */

function stopChatRealtime(){

  if(
    chatRealtimeChannel
  ){

    sb.removeChannel(
      chatRealtimeChannel
    );

    chatRealtimeChannel =
      null;

  }

}


/* ============================================================
   CONTADOR DE MENSAGENS
============================================================ */

async function getChatInfo(
  conversationId
){

  if(!conversationId){

    return {

      count: 0,

      lastMessage: null

    };

  }


  const {
    data,
    error
  } = await sb
    .from('messages')
    .select(`
      content,
      created_at
    `)
    .eq(
      'conversation_id',
      conversationId
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    )
    .limit(1);


  if(error){

    console.error(
      'Erro ao obter chat:',
      error
    );

    return {

      count: 0,

      lastMessage: null

    };

  }


  const {
    count,
    error: countError
  } = await sb
    .from('messages')
    .select(
      'id',
      {
        count: 'exact',
        head: true
      }
    )
    .eq(
      'conversation_id',
      conversationId
    );


  return {

    count:
      countError
        ? 0
        : count || 0,

    lastMessage:
      data?.[0] || null

  };

}


/* ============================================================
   OBTER CONVERSA DA LIMPEZA
============================================================ */

async function getConversationForTask(
  taskId
){

  if(!taskId){

    return null;

  }


  const {
    data,
    error
  } = await sb
    .from('conversations')
    .select(`
      id,
      task_id,
      client_id,
      professional_id,
      created_at
    `)
    .eq(
      'task_id',
      taskId
    )
    .maybeSingle();


  if(error){

    console.error(
      'Erro ao buscar conversa:',
      error
    );

    return null;

  }


  return data || null;

}


/* ============================================================
   ============================================================
   UTILITÁRIOS
   ============================================================
============================================================ */


/* Snackbar */

function showSnackbar(msg){

  let el =
    document.getElementById(
      'snackbar'
    );


  if(!el){

    el =
      document.createElement(
        'div'
      );

    el.id =
      'snackbar';

    el.className =
      'snackbar';

    document.body.appendChild(
      el
    );

  }


  el.textContent =
    msg;


  el.classList.add(
    'show'
  );


  setTimeout(
    () => {

      el.classList.remove(
        'show'
      );

    },
    4000
  );

}


/* ============================================================
   FORMATAÇÃO DE DATA
============================================================ */

function formatDate(
  dateString
){

  if(!dateString)
    return '';


  const d =
    new Date(
      dateString +
      'T00:00:00'
    );


  return d.toLocaleDateString(
    'pt-BR'
  );

}


/* ============================================================
   TEMPO
============================================================ */

function getElapsedTime(
  startIso
){

  const elapsed =
    Math.floor(
      (
        Date.now() -
        new Date(
          startIso
        ).getTime()
      ) / 1000
    );


  return formatDuration(
    elapsed
  );

}


function formatDuration(
  totalSeconds
){

  totalSeconds =
    Math.max(
      0,
      Math.floor(
        totalSeconds
      )
    );


  const h =
    Math.floor(
      totalSeconds / 3600
    );


  const m =
    Math.floor(
      (
        totalSeconds % 3600
      ) / 60
    );


  const s =
    Math.floor(
      totalSeconds % 60
    );


  return h > 0
    ? `${h}h ${m}min ${s}s`
    : `${m}min ${s}s`;

}


/* ============================================================
   ESCAPE HTML
============================================================ */

function escapeHtml(str){

  if(str == null)
    return '';


  return String(str)
    .replace(
      /[&<>"']/g,
      c => ({

        '&':
          '&amp;',

        '<':
          '&lt;',

        '>':
          '&gt;',

        '"':
          '&quot;',

        "'":
          '&#39;'

      }[c])
    );

}


/* ============================================================
   CHECKLIST PADRÃO
============================================================ */

async function getDefaultChecklist(){

  const {
    data,
    error
  } = await sb
    .from(
      'default_checklist'
    )
    .select(
      'items'
    )
    .eq(
      'id',
      1
    )
    .single();


  if(
    error ||
    !data
  ){

    return [];

  }


  return data.items;

}


/* ============================================================
   CRONÔMETROS
============================================================ */

const _activeTimerKeys =
  new Set();


function attachTimers(
  list
){

  list.forEach(
    req => {

      if(
        req.status ===
          'in-progress' &&
        req.work_start
      ){

        const start =
          req.work_start;


        const key =
          'timer_' +
          req.id +
          '_' +
          start;


        if(
          _activeTimerKeys
            .has(key)
        ){

          return;

        }


        _activeTimerKeys
          .add(key);


        setInterval(
          () => {

            document
              .querySelectorAll(
                `[data-timer-start="${start}"]`
              )
              .forEach(
                el => {

                  el.textContent =
                    getElapsedTime(
                      start
                    );

                }
              );

          },
          1000
        );

      }

    }
  );

}


/* ============================================================
   ADMIN
============================================================ */

function _adminReload(){

  if(
    typeof reloadTasks ===
    'function'
  ){

    reloadTasks();

  }

  else if(
    typeof reloadRequests ===
    'function'
  ){

    reloadRequests();

  }

}


/* ============================================================
   ADMIN — ALTERAR PREÇO
============================================================ */

async function adminEditPrice(
  id,
  currentPrice
){

  const input =
    prompt(
      'Novo valor (em CHF):',
      currentPrice
    );


  if(input === null)
    return;


  const parsed =
    parseFloat(
      String(input)
        .replace(
          ',',
          '.'
        )
    );


  if(
    isNaN(parsed) ||
    parsed < 0
  ){

    return alert(
      'Digite um valor numérico válido.'
    );

  }


  const {
    error
  } = await sb
    .from(
      'cleaning_requests'
    )
    .update({

      price:
        parsed

    })
    .eq(
      'id',
      id
    );


  if(error){

    return alert(
      'Erro ao atualizar valor: ' +
      error.message
    );

  }


  showSnackbar(
    '💰 Valor atualizado para ' +
    parsed +
    ' CHF!'
  );


  _adminReload();

}


/* ============================================================
   ADMIN — EXCLUIR
============================================================ */

async function adminDeleteTask(
  id,
  label
){

  if(
    !confirm(
      `Excluir permanentemente a tarefa "${label}"? Isso não pode ser desfeito.`
    )
  ){

    return;

  }


  const {
    error
  } = await sb
    .from(
      'cleaning_requests'
    )
    .delete()
    .eq(
      'id',
      id
    );


  if(error){

    return alert(
      'Erro ao excluir: ' +
      error.message
    );

  }


  showSnackbar(
    '🗑️ Tarefa excluída.'
  );


  _adminReload();

}


/* ============================================================
   CARTÃO DE TAREFA
============================================================ */

function renderTaskCard(
  req,
  mode
){

  let timerHtml =
    '';


  if(
    req.status ===
      'in-progress' &&
    req.work_start
  ){

    timerHtml = `

      <div class="timer-box">

        <div
          class="timer-display"
          data-timer-start="${req.work_start}"
        >
          ${getElapsedTime(
            req.work_start
          )}
        </div>

        ${
          mode === 'cleaner' ||
          mode === 'admin'

          ?

          `<div class="timer-controls">

            <button
              class="btn btn-danger btn-lg"
              onclick="stopTimer('${req.id}')"
            >
              ⏹ Finalizar trabalho
            </button>

          </div>`

          :

          `<p
            style="
              font-size:12.5px;
              color:var(--info);
              margin-top:8px;
            "
          >
            Trabalho em andamento…
          </p>`

        }

      </div>

    `;

  }

  else if(
    req.status ===
      'pending' &&
    (
      mode === 'cleaner' ||
      mode === 'admin'
    )
  ){

    timerHtml = `

      <div class="timer-box">

        <p
          style="
            font-size:12.5px;
            color:var(--muted);
            margin-bottom:12px;
          "
        >
          Aguardando início do trabalho
        </p>

        <div class="timer-controls">

          <button
            class="btn btn-success btn-lg"
            onclick="startTimer('${req.id}')"
          >
            ▶ Iniciar trabalho
          </button>

        </div>

      </div>

    `;

  }

  else if(
    req.work_end &&
    req.work_start
  ){

    const duration =
      (
        new Date(
          req.work_end
        ) -
        new Date(
          req.work_start
        )
      ) / 1000;


    timerHtml = `

      <p
        style="
          color:var(--success);
          margin-top:10px;
          font-size:13px;
          font-weight:600;
        "
      >
        ⏱️ Tempo total:
        ${formatDuration(
          duration
        )}
      </p>

    `;

  }


  /* ========================================================
     FOTOS
  ======================================================== */

  let photosHtml =
    '';


  if(
    req.photos &&
    req.photos.length
  ){

    photosHtml = `

      <div class="photo-row">

        ${
          req.photos
            .map(
              p => `

                <img
                  src="${escapeHtml(p)}"
                  alt="foto"
                  onclick="window.open('${escapeHtml(p)}','_blank')"
                >

              `
            )
            .join('')
        }

      </div>

    `;

  }


  /* ========================================================
     CHECKLIST
  ======================================================== */

  let checklistHtml =
    '';


  if(
    mode === 'cleaner' ||
    mode === 'admin'
  ){

    const total =
      (
        req.checklist ||
        []
      ).length;


    const done =
      (
        req.checklist ||
        []
      ).filter(
        i => i.done
      ).length;


    if(total){

      checklistHtml = `

        <div class="checklist">

          <h4>
            Checklist
          </h4>

          <div class="checklist-progress">
            ${done} / ${total}
            concluídos
          </div>

          ${
            req.checklist
              .map(
                item => {

                  const isLaundry =
                    item.id === 'laundry' ||
                    String(
                      item.label ||
                      ''
                    )
                    .includes(
                      'Lavagem de roupa'
                    );


                  return `

                    <div
                      class="
                        checklist-item
                        ${isLaundry ? 'laundry-item' : ''}
                        ${item.done ? 'done' : ''}
                      "
                    >

                      <input
                        type="checkbox"
                        id="ck_${item.id}_${req.id}"
                        ${item.done ? 'checked' : ''}
                        onchange="
                          toggleChecklistItem(
                            '${req.id}',
                            '${item.id}'
                          )
                        "
                      >

                      <label
                        for="ck_${item.id}_${req.id}"
                      >
                        ${escapeHtml(
                          item.label
                        )}
                      </label>

                      ${
                        isLaundry
                          ? '<span class="plus">+10 CHF</span>'
                          : ''
                      }

                    </div>

                  `;

                }
              )
              .join('')
          }

        </div>


        <div class="field">

          <label>
            Fotos (opcional)
          </label>

          <input
            type="file"
            accept="image/*"
            multiple
            onchange="
              uploadPhotos(
                '${req.id}',
                this
              )
            "
          >

        </div>

        ${photosHtml}

      `;

    }

  }


  /* ========================================================
     AÇÕES
  ======================================================== */

  let actionsHtml =
    '';


  let editFormHtml =
    '';


  /* CLIENTE */

  if(
    mode === 'client' &&
    req.status === 'pending'
  ){

    actionsHtml += `

      <div class="task-actions">

        <button
          class="btn btn-outline"
          onclick="
            toggleEditForm(
              '${req.id}'
            )
          "
        >
          Editar
        </button>

        <button
          class="btn btn-danger"
          onclick="
            cancelRequest(
              '${req.id}'
            )
          "
        >
          Cancelar
        </button>

      </div>

    `;


    editFormHtml = `

      <div
        class="task-edit-form"
        id="editForm_${req.id}"
        style="display:none;"
      >

        <div class="field-row">

          <div class="field">

            <label>
              Data
            </label>

            <input
              type="date"
              id="editDate_${req.id}"
              value="${req.date || ''}"
            >

          </div>


          <div class="field">

            <label>
              Horário
            </label>

            <input
              type="time"
              id="editTime_${req.id}"
              value="${
                req.time
                  ? req.time.slice(0,5)
                  : ''
              }"
            >

          </div>

        </div>


        <div class="edit-actions">

          <button
            class="btn btn-outline"
            onclick="
              toggleEditForm(
                '${req.id}'
              )
            "
          >
            Cancelar
          </button>

          <button
            class="btn btn-accent"
            onclick="
              saveEditRequest(
                '${req.id}'
              )
            "
          >
            Salvar alterações
          </button>

        </div>

      </div>

    `;

  }


  /* PROFISSIONAL / ADMIN */

  if(
    (
      mode === 'cleaner' ||
      mode === 'admin'
    ) &&
    req.status !== 'completed'
  ){

    actionsHtml += `

      <div class="task-actions">

        <button
          class="btn btn-success"
          onclick="
            completeTask(
              '${req.id}'
            )
          "
        >
          ✅ Marcar como concluída
        </button>

      </div>

    `;

  }


  /* ADMIN */

  if(
    mode === 'admin'
  ){

    actionsHtml += `

      <div class="task-actions">

        <button
          class="btn btn-outline"
          onclick="
            adminEditPrice(
              '${req.id}',
              ${Number(req.price) || 0}
            )
          "
        >
          💰 Editar valor
        </button>

        <button
          class="btn btn-danger"
          onclick="
            adminDeleteTask(
              '${req.id}',
              '${escapeHtml(
                req.ref_code ||
                req.address ||
                ''
              )}'
            )
          "
        >
          🗑️ Excluir tarefa
        </button>

      </div>

    `;

  }


  /* ========================================================
     BOTÃO CHAT
  ======================================================== */

  let chatHtml =
    '';


  /*
     Só mostra chat quando existe
     cliente + profissional.
  */

  if(
    req.client_id &&
    req.professional_id
  ){

    chatHtml = `

      <div class="task-actions chat-task-action">

        ${chatButtonHtml(req)}

      </div>

    `;

  }


  /* ========================================================
     STATUS
  ======================================================== */

  const statusLabel =
    req.status === 'pending'
      ? 'Pendente'
      : req.status === 'in-progress'
        ? 'Em andamento'
        : 'Concluída';


  /* ========================================================
     HTML FINAL
  ======================================================== */

  return `

    <div
      class="task ${escapeHtml(
        req.status || ''
      )}"
    >

      <div class="task-top">

        <div>

          <div class="task-ref">
            ${escapeHtml(
              req.ref_code || ''
            )}
          </div>

          <div class="task-addr">
            ${escapeHtml(
              req.address || ''
            )}
          </div>

        </div>


        <div class="task-badges">

          <span
            class="
              badge
              price
              ${
                req.laundry_service
                  ? 'laundry'
                  : ''
              }
            "
          >
            ${req.price || 0} CHF
          </span>

          <span
            class="
              badge
              ${escapeHtml(
                req.status || ''
              )}
            "
          >
            ${statusLabel}
          </span>

        </div>

      </div>


      <div class="task-info">

        <div class="info-item">

          <div class="label">
            Data
          </div>

          <div class="value">
            ${formatDate(
              req.date
            )}
          </div>

        </div>


        <div class="info-item">

          <div class="label">
            Horário
          </div>

          <div class="value">
            ${
              req.time
                ? req.time.slice(0,5)
                : ''
            }
          </div>

        </div>


        <div class="info-item">

          <div class="label">
            Estadia
          </div>

          <div class="value">
            ${
              req.stay_duration ||
              0
            } dias
          </div>

        </div>


        <div class="info-item">

          <div class="label">
            Hóspedes
          </div>

          <div class="value">
            ${
              req.guest_count ||
              0
            }
          </div>

        </div>


        <div class="info-item">

          <div class="label">
            Lavagem
          </div>

          <div class="value">
            ${
              req.laundry_service
                ? '✅ Sim'
                : '❌ Não'
            }
          </div>

        </div>


        ${
          (
            mode === 'cleaner' ||
            mode === 'admin'
          )

          ?

          `

            <div class="info-item">

              <div class="label">
                Cliente
              </div>

              <div class="value">
                ${escapeHtml(
                  req.client_name ||
                  ''
                )}
              </div>

            </div>

          `

          :

          ''

        }

      </div>


      ${
        req.notes

        ?

        `

          <div class="task-notes">

            <strong>
              Obs:
            </strong>

            ${escapeHtml(
              req.notes
            )}

          </div>

        `

        :

        ''

      }


      ${timerHtml}


      ${checklistHtml}


      ${
        mode === 'client'
          ? photosHtml
          : ''
      }


      ${actionsHtml}


      ${chatHtml}


      ${editFormHtml}

    </div>

  `;

}


/* ============================================================
   INSTALAÇÃO PWA + NOTIFICAÇÕES
============================================================ */

function setupInstallAndNotifyBanner(){

  let deferredInstallPrompt =
    null;


  let showInstall =
    false;


  let showNotifyModal =
    false;


  window.addEventListener(
    'beforeinstallprompt',
    e => {

      e.preventDefault();

      deferredInstallPrompt =
        e;

      showInstall =
        true;

      renderInstallBanner();

    }
  );


  window.addEventListener(
    'appinstalled',
    () => {

      showInstall =
        false;

      renderInstallBanner();

      showSnackbar(
        '🎉 App instalado! Já pode acessar direto da tela inicial.'
      );

    }
  );


  if(
    window.matchMedia(
      '(display-mode: standalone)'
    ).matches
  ){

    showInstall =
      false;

  }


  const notifyDismissedThisSession =
    sessionStorage.getItem(
      'cleansync_notify_dismissed'
    ) === '1';


  if(
    'Notification' in window &&
    Notification.permission === 'default' &&
    !notifyDismissedThisSession
  ){

    showNotifyModal =
      true;

  }


  /* ========================================================
     BARRA DE INSTALAÇÃO
  ======================================================== */

  function renderInstallBanner(){

    let el =
      document.getElementById(
        'installBanner'
      );


    if(!showInstall){

      if(el)
        el.remove();

      return;

    }


    if(el)
      return;


    el =
      document.createElement(
        'div'
      );


    el.id =
      'installBanner';


    el.className =
      'install-banner';


    el.innerHTML = `

      <span class="install-banner-icon">
        📲
      </span>

      <div class="install-banner-text">

        <strong>
          Instale o CleanSync
        </strong>

        <span>
          Acesso rápido direto da tela inicial.
        </span>

      </div>

      <button
        class="btn btn-accent btn-sm"
        id="btnInstallApp"
      >
        Instalar
      </button>

      <button
        class="install-banner-close"
        id="btnDismissInstall"
        aria-label="Fechar"
      >
        ✕
      </button>

    `;


    document.body.appendChild(
      el
    );


    document
      .getElementById(
        'btnInstallApp'
      )
      .onclick =
      async () => {

        if(
          !deferredInstallPrompt
        ){

          return;

        }


        deferredInstallPrompt
          .prompt();


        await deferredInstallPrompt
          .userChoice;


        deferredInstallPrompt =
          null;


        showInstall =
          false;


        renderInstallBanner();

      };


    document
      .getElementById(
        'btnDismissInstall'
      )
      .onclick =
      () => {

        showInstall =
          false;

        renderInstallBanner();

      };

  }


  /* ========================================================
     MODAL NOTIFICAÇÕES
  ======================================================== */

  function renderNotifyModal(){

    let el =
      document.getElementById(
        'notifyOverlay'
      );


    if(!showNotifyModal){

      if(el)
        el.remove();

      return;

    }


    if(el)
      return;


    el =
      document.createElement(
        'div'
      );


    el.id =
      'notifyOverlay';


    el.className =
      'notify-overlay';


    el.innerHTML = `

      <div class="notify-modal">

        <div class="notify-emoji">
          🔔
        </div>

        <h3>
          Não perca nenhuma novidade!
        </h3>

        <p>
          Ative as notificações e saiba na hora
          quando uma tarefa for criada,
          iniciada ou concluída. 🧹✨
        </p>

        <div class="notify-actions">

          <button
            class="btn btn-accent"
            id="btnActivateNotify"
          >
            ✅ Permitir notificações
          </button>

          <button
            class="btn btn-ghost"
            id="btnDismissNotify"
          >
            Agora não
          </button>

        </div>

      </div>

    `;


    document.body.appendChild(
      el
    );


    document
      .getElementById(
        'btnActivateNotify'
      )
      .onclick =
      () => {

        if(
          window.OneSignalDeferred
        ){

          window
            .OneSignalDeferred
            .push(
              function(OneSignal){

                OneSignal
                  .Slidedown
                  .promptPush();

              }
            );

        }

        else if(
          'Notification' in window
        ){

          Notification
            .requestPermission();

        }


        showNotifyModal =
          false;

        renderNotifyModal();

      };


    document
      .getElementById(
        'btnDismissNotify'
      )
      .onclick =
      () => {

        sessionStorage.setItem(
          'cleansync_notify_dismissed',
          '1'
        );


        showNotifyModal =
          false;


        renderNotifyModal();

      };

  }


  renderInstallBanner();


  setTimeout(
    renderInstallBanner,
    800
  );


  if(showNotifyModal){

    setTimeout(
      renderNotifyModal,
      1000
    );

  }

}


/* ============================================================
   SERVICE WORKER
============================================================ */

function registerCleanSyncServiceWorker(){

  if(
    'serviceWorker' in navigator
  ){

    navigator
      .serviceWorker
      .register(
        'service-worker.js'
      )
      .catch(
        console.error
      );

  }

}


/* ============================================================
   INICIALIZAÇÃO AUTOMÁTICA
============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    /*
       Não chamamos requireRole automaticamente,
       porque cada página define seu próprio papel.
    */

  }
);


/* ============================================================
   FIM DO APP-COMMON
============================================================ */