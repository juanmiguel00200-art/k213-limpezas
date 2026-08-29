/* ============================================================
   CleanSync — núcleo compartilhado
   ============================================================

   Inclui:
   - Configuração Supabase
   - Autenticação própria
   - Sessão local
   - Controle de acesso
   - Realtime das tarefas
   - Cronômetros
   - Checklist
   - Fotos
   - Administração
   - PWA / instalação
   - OneSignal
   - CHAT CLIENTE ↔ PROFISSIONAL
   - Realtime das mensagens

   IMPORTANTE:
   O projeto CleanSync utiliza autenticação própria através da
   tabela "usuarios", e NÃO Supabase Auth.

   Por isso, o chat utiliza os IDs dos usuários armazenados na
   sessão local e os IDs presentes em cleaning_requests.
   ============================================================ */


/* ============================================================
   CONFIGURAÇÃO SUPABASE
   ============================================================ */

const SUPABASE_URL = 'https://oyxmrrazgjdnyzhyinhc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IVWPCoIWVhkvP_u7J0ZTsA_QeK-MNNI';

const PRICE_BASE = 40;
const PRICE_WITH_LAUNDRY = 50;

const APP_CONFIGURED = true;

const sb = window.supabase.createClient(
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
        Este app ainda não está ligado a um projeto Supabase.
      </p>

      <p>
        Abra <code>app-common.js</code>, encontre
        <code>SUPABASE_URL</code> e
        <code>SUPABASE_ANON_KEY</code>
        no topo do arquivo.
      </p>
    </div>
  `;
}


/* ============================================================
   AUTENTICAÇÃO PRÓPRIA
   ============================================================ */

async function sha256Hex(text){
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text)
  );

  return Array.from(
    new Uint8Array(buf)
  )
  .map(b => b.toString(16).padStart(2, '0'))
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
    code += chars[
      Math.floor(Math.random() * chars.length)
    ];
  }

  return code.slice(0,4) + '-' + code.slice(4);
}


/* ============================================================
   SESSÃO
   ============================================================ */

function getSession(){

  try{

    return JSON.parse(
      localStorage.getItem('k213_session') || 'null'
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

  localStorage.removeItem('k213_session');

}


/* ============================================================
   CRIAÇÃO DE CONTA
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
        p_password_hash: password_hash,
        p_recovery_code: recovery_code,
        p_role: role,
        p_address: address || null
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
    recovery_code: row.recovery_code
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
        p_username: username,
        p_password_hash: password_hash
      }
    );

  if(error)
    throw error;

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
   RECUPERAÇÃO DE SENHA
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
        p_username: username,
        p_recovery_code:
          recoveryCode.toUpperCase(),

        p_new_password_hash:
          newHash,

        p_new_recovery_code:
          newCode
      }
    );

  if(error)
    throw error;

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
   GUARDA DE ROTA
   ============================================================ */

async function requireRole(requiredRole){

  if(!APP_CONFIGURED){

    renderSetupWarning();

    return null;

  }

  const session = getSession();

  if(!session){

    window.location.href =
      'index.html';

    return null;

  }


  if(
    session.role !== requiredRole &&
    session.role !== 'admin'
  ){

    window.location.href =
      session.role === 'admin'
        ? 'admin.html'
        : session.role === 'profissional'
          ? 'profissional.html'
          : 'cliente.html';

    return null;

  }


  paintWho({
    name: session.name,
    role: session.role
  });


  return {

    user: {
      id: session.id,
      email: session.username
    },

    profile: {
      name: session.name,
      role: session.role
    }

  };

}


/* ============================================================
   IDENTIFICAÇÃO DO USUÁRIO
   ============================================================ */

function paintWho(profile){

  const nameEl =
    document.getElementById(
      'topWhoName'
    );

  if(nameEl){

    nameEl.textContent =
      profile.name +
      ' · ' +
      (
        profile.role === 'admin'
          ? 'Administrador'
          : profile.role === 'profissional'
            ? 'Profissional'
            : 'Cliente'
      );

  }


  const adminLink =
    document.getElementById(
      'navAdminLink'
    );

  if(
    adminLink &&
    profile.role === 'admin'
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

    realtimeChannel = null;

  }


  if(
    chatRealtimeChannel &&
    sb
  ){

    sb.removeChannel(
      chatRealtimeChannel
    );

    chatRealtimeChannel = null;

  }


  clearSession();

  window.location.href =
    'index.html';

}


/* ============================================================
   REALTIME DAS TAREFAS
   ============================================================ */

function startRealtime(onChange){

  if(
    realtimeChannel ||
    !sb
  )
    return;


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

    t = setTimeout(
      () => fn(...args),
      wait
    );

  };

}


/* ============================================================
   ============================================================
   CHAT — CLIENTE ↔ PROFISSIONAL
   ============================================================
   ============================================================ */


/*
   Obtém o usuário atual da sessão.
*/

function getCurrentChatUser(){

  const session =
    getSession();

  if(!session)
    return null;

  return {

    id: session.id,

    name:
      session.name || 'Usuário',

    username:
      session.username || '',

    role:
      session.role || ''

  };

}


/*
   Cria ou recupera a conversa vinculada
   à determinada tarefa.
*/

async function getOrCreateConversation(task){

  if(!task || !task.id){

    throw new Error(
      'Tarefa inválida para iniciar o chat.'
    );

  }


  const currentUser =
    getCurrentChatUser();

  if(!currentUser){

    throw new Error(
      'Você precisa estar logado para usar o chat.'
    );

  }


  /*
     Primeiro procuramos uma conversa existente
     para essa tarefa.
  */

  const {
    data: existing,
    error: existingError
  } = await sb

    .from('conversations')

    .select('*')

    .eq('task_id', task.id)

    .maybeSingle();


  if(existingError)
    throw existingError;


  if(existing){

    return existing;

  }


  /*
     Determina cliente e profissional.
  */

  const clientId =
    task.client_id || null;

  const professionalId =
    task.professional_id || null;


  if(!clientId || !professionalId){

    throw new Error(
      'Esta tarefa ainda não possui cliente e profissional vinculados.'
    );

  }


  /*
     Tenta criar a conversa.
  */

  const {
    data,
    error
  } = await sb

    .from('conversations')

    .insert({

      task_id:
        task.id,

      client_id:
        clientId,

      professional_id:
        professionalId

    })

    .select('*')

    .single();


  /*
     Se outro usuário criou ao mesmo tempo,
     tentamos recuperar a conversa.
  */

  if(error){

    const {
      data: retry
    } = await sb

      .from('conversations')

      .select('*')

      .eq('task_id', task.id)

      .maybeSingle();


    if(retry)
      return retry;


    throw error;

  }


  return data;

}


/*
   Abre o chat da tarefa.
*/

async function openChat(taskId){

  if(!taskId){

    alert(
      'Não foi possível identificar a tarefa.'
    );

    return;

  }


  try{

    /*
       Busca a tarefa.
    */

    const {
      data: task,
      error
    } = await sb

      .from('cleaning_requests')

      .select('*')

      .eq('id', taskId)

      .single();


    if(error)
      throw error;


    /*
       Cria/recupera a conversa.
    */

    const conversation =
      await getOrCreateConversation(
        task
      );


    /*
       Guarda temporariamente para
       a página chat.html.
    */

    sessionStorage.setItem(
      'cleansync_chat_task',
      JSON.stringify(task)
    );


    sessionStorage.setItem(
      'cleansync_chat_conversation',
      JSON.stringify(conversation)
    );


    /*
       Abre a página do chat.
    */

    window.location.href =
      'chat.html?conversation=' +
      encodeURIComponent(
        conversation.id
      );

  }catch(error){

    console.error(
      'Erro ao abrir chat:',
      error
    );

    alert(
      'Não foi possível abrir o chat: ' +
      error.message
    );

  }

}


/*
   Recupera a conversa armazenada.
*/

function getStoredConversation(){

  try{

    return JSON.parse(
      sessionStorage.getItem(
        'cleansync_chat_conversation'
      ) || 'null'
    );

  }catch{

    return null;

  }

}


/*
   Recupera a tarefa armazenada.
*/

function getStoredChatTask(){

  try{

    return JSON.parse(
      sessionStorage.getItem(
        'cleansync_chat_task'
      ) || 'null'
    );

  }catch{

    return null;

  }

}


/*
   Limpa o contexto do chat.
*/

function clearChatStorage(){

  sessionStorage.removeItem(
    'cleansync_chat_task'
  );

  sessionStorage.removeItem(
    'cleansync_chat_conversation'
  );

}


/* ============================================================
   BUSCAR MENSAGENS
   ============================================================ */

async function loadChatMessages(
  conversationId
){

  if(!conversationId)
    return [];


  const {
    data,
    error
  } = await sb

    .from('messages')

    .select('*')

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


  if(error)
    throw error;


  return data || [];

}


/* ============================================================
   ENVIAR MENSAGEM
   ============================================================ */

async function sendChatMessage(
  conversationId,
  content
){

  const currentUser =
    getCurrentChatUser();


  if(!currentUser){

    throw new Error(
      'Usuário não autenticado.'
    );

  }


  const text =
    String(content || '').trim();


  if(!text){

    throw new Error(
      'Digite uma mensagem.'
    );

  }


  if(!conversationId){

    throw new Error(
      'Conversa não encontrada.'
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
        currentUser.id,

      content:
        text

    })

    .select('*')

    .single();


  if(error)
    throw error;


  return data;

}


/* ============================================================
   REALTIME DO CHAT
   ============================================================ */

function startChatRealtime(
  conversationId,
  onMessage
){

  if(
    !conversationId ||
    !sb
  )
    return null;


  /*
     Remove canal anterior.
  */

  if(chatRealtimeChannel){

    sb.removeChannel(
      chatRealtimeChannel
    );

    chatRealtimeChannel = null;

  }


  const channelName =
    'chat_' +
    String(conversationId)
      .replace(/[^a-zA-Z0-9_-]/g, '');


  chatRealtimeChannel =
    sb

      .channel(channelName)

      .on(

        'postgres_changes',

        {
          event: 'INSERT',

          schema: 'public',

          table: 'messages',

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

      .subscribe();


  return chatRealtimeChannel;

}


/*
   Desliga o Realtime do chat.
*/

function stopChatRealtime(){

  if(
    chatRealtimeChannel &&
    sb
  ){

    sb.removeChannel(
      chatRealtimeChannel
    );

    chatRealtimeChannel = null;

  }

}


/* ============================================================
   CONTAGEM DE MENSAGENS
   ============================================================ */

async function getChatMessageCount(
  conversationId
){

  if(!conversationId)
    return 0;


  const {
    count,
    error
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


  if(error){

    console.warn(
      'Erro ao contar mensagens:',
      error.message
    );

    return 0;

  }


  return count || 0;

}


/* ============================================================
   ÚLTIMA MENSAGEM
   ============================================================ */

async function getLastChatMessage(
  conversationId
){

  if(!conversationId)
    return null;


  const {
    data,
    error
  } = await sb

    .from('messages')

    .select('*')

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

    .limit(1)
    .maybeSingle();


  if(error){

    console.warn(
      'Erro ao buscar última mensagem:',
      error.message
    );

    return null;

  }


  return data || null;

}


/* ============================================================
   FORMATAÇÃO DE HORA DO CHAT
   ============================================================ */

function formatChatTime(
  timestamp
){

  if(!timestamp)
    return '';


  const d =
    new Date(timestamp);


  return d.toLocaleTimeString(
    'pt-BR',
    {
      hour: '2-digit',
      minute: '2-digit'
    }
  );

}


/* ============================================================
   FORMATAÇÃO DE DATA/HORA COMPLETA
   ============================================================ */

function formatChatDateTime(
  timestamp
){

  if(!timestamp)
    return '';


  const d =
    new Date(timestamp);


  return d.toLocaleString(
    'pt-BR',
    {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }
  );

}


/* ============================================================
   NOTIFICAÇÃO LOCAL DE NOVA MENSAGEM
   ============================================================ */

function notifyNewChatMessage(
  message
){

  if(!message)
    return;


  const current =
    getCurrentChatUser();


  if(
    current &&
    message.sender_id ===
    current.id
  ){

    return;

  }


  showSnackbar(
    '💬 Nova mensagem recebida'
  );


  /*
     Se as notificações do navegador
     estiverem permitidas, podemos avisar.
  */

  try{

    if(
      'Notification' in window &&
      Notification.permission ===
      'granted'
    ){

      new Notification(
        'CleanSync · Nova mensagem',
        {
          body:
            message.content ||
            'Você recebeu uma nova mensagem.'
        }
      );

    }

  }catch(error){

    console.warn(
      'Notificação local indisponível:',
      error
    );

  }

}


/* ============================================================
   BOTÃO / BADGE DE CHAT
   ============================================================ */

function chatButtonHtml(
  task
){

  if(
    !task ||
    !task.id
  ){

    return '';

  }


  return `
    <button
      class="btn btn-outline"
      onclick="openChat('${task.id}')"
      type="button"
    >
      💬 Abrir chat
    </button>
  `;

}


/* ============================================================
   INSTALAÇÃO PWA + NOTIFICAÇÕES
   ============================================================ */

function setupInstallAndNotifyBanner(){

  let deferredInstallPrompt = null;

  let showInstall = false;

  let showNotifyModal = false;


  window.addEventListener(
    'beforeinstallprompt',
    (e) => {

      e.preventDefault();

      deferredInstallPrompt = e;

      showInstall = true;

      renderInstallBanner();

    }
  );


  window.addEventListener(
    'appinstalled',
    () => {

      showInstall = false;

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

    showInstall = false;

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

    showNotifyModal = true;

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
          Acesso rápido direto da tela inicial,
          sem precisar abrir o navegador ✨
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


    document.body.appendChild(el);


    document.getElementById(
      'btnInstallApp'
    ).onclick =
      async () => {

        if(!deferredInstallPrompt)
          return;


        deferredInstallPrompt.prompt();


        await deferredInstallPrompt.userChoice;


        deferredInstallPrompt =
          null;

        showInstall =
          false;

        renderInstallBanner();

      };


    document.getElementById(
      'btnDismissInstall'
    ).onclick =
      () => {

        showInstall =
          false;

        renderInstallBanner();

      };

  }


  /* ========================================================
     MODAL DE NOTIFICAÇÕES
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
          Ative as notificações e saiba
          na hora quando uma tarefa for
          criada, iniciada, concluída ou
          quando houver novidades. 🧹✨
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


    document.body.appendChild(el);


    document.getElementById(
      'btnActivateNotify'
    ).onclick =
      () => {

        if(
          window.OneSignalDeferred
        ){

          window.OneSignalDeferred.push(
            function(OneSignal){

              OneSignal
                .Slidedown
                .promptPush();

            }
          );

        }


        showNotifyModal =
          false;

        renderNotifyModal();

      };


    document.getElementById(
      'btnDismissNotify'
    ).onclick =
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
   SNACKBAR
   ============================================================ */

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

    document.body.appendChild(el);

  }


  el.textContent =
    msg;


  el.classList.add(
    'show'
  );


  setTimeout(
    () =>
      el.classList.remove(
        'show'
      ),
    4000
  );

}


/* ============================================================
   FORMATAÇÃO
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


function getElapsedTime(
  startIso
){

  const elapsed =
    Math.floor(
      (
        Date.now() -
        new Date(startIso).getTime()
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
      (totalSeconds % 3600) / 60
    );


  const s =
    Math.floor(
      totalSeconds % 60
    );


  return h > 0
    ? `${h}h ${m}min ${s}s`
    : `${m}min ${s}s`;

}


function escapeHtml(str){

  if(str == null)
    return '';


  return String(str)
    .replace(
      /[&<>"']/g,
      c =>
        ({
          '&':'&amp;',
          '<':'&lt;',
          '>':'&gt;',
          '"':'&quot;',
          "'":'&#39;'
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

    .from('default_checklist')

    .select('items')

    .eq('id', 1)

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
   CRONÔMETROS ATIVOS
   ============================================================ */

const _activeTimerKeys =
  new Set();


function attachTimers(list){

  list.forEach(req => {

    if(
      req.status === 'in-progress' &&
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
        _activeTimerKeys.has(key)
      )
        return;


      _activeTimerKeys.add(key);


      setInterval(
        () => {

          document
            .querySelectorAll(
              `[data-timer-start="${start}"]`
            )
            .forEach(el => {

              el.textContent =
                getElapsedTime(
                  start
                );

            });

        },
        1000
      );

    }

  });

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
        .replace(',', '.')
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

    .from('cleaning_requests')

    .update({
      price: parsed
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

    .from('cleaning_requests')

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

  let timerHtml = '';


  /* ========================================================
     CRONÔMETRO
     ======================================================== */

  if(
    req.status === 'in-progress' &&
    req.work_start
  ){

    timerHtml = `

      <div class="timer-box">

        <div
          class="timer-display"
          data-timer-start="${req.work_start}"
        >
          ${getElapsedTime(req.work_start)}
        </div>

        ${
          mode === 'cleaner' ||
          mode === 'admin'

            ? `

              <div class="timer-controls">

                <button
                  class="btn btn-danger btn-lg"
                  onclick="stopTimer('${req.id}')"
                >
                  ⏹ Finalizar trabalho
                </button>

              </div>

            `

            : `

              <p
                style="
                  font-size:12.5px;
                  color:var(--info);
                  margin-top:8px;
                "
              >
                Trabalho em andamento…
              </p>

            `
        }

      </div>

    `;

  }


  else if(
    req.status === 'pending' &&
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
        new Date(req.work_end) -
        new Date(req.work_start)
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
        ${formatDuration(duration)}
      </p>

    `;

  }


  /* ========================================================
     FOTOS
     ======================================================== */

  let photosHtml = '';


  if(
    req.photos &&
    req.photos.length
  ){

    photosHtml = `

      <div class="photo-row">

        ${
          req.photos.map(
            p => `

              <img
                src="${escapeHtml(p)}"
                alt="foto"
                onclick="window.open('${escapeHtml(p)}','_blank')"
              >

            `
          ).join('')
        }

      </div>

    `;

  }


  /* ========================================================
     CHECKLIST
     ======================================================== */

  let checklistHtml = '';


  if(
    mode === 'cleaner' ||
    mode === 'admin'
  ){

    const total =
      (
        req.checklist || []
      ).length;


    const done =
      (
        req.checklist || []
      )
      .filter(
        i => i.done
      )
      .length;


    checklistHtml =
      total

        ? `

          <div class="checklist">

            <h4>
              Checklist
            </h4>

            <div class="checklist-progress">
              ${done} / ${total} concluídos
            </div>

            ${
              req.checklist.map(
                item => {

                  const isLaundry =
                    item.id === 'laundry' ||
                    (
                      item.label &&
                      item.label.includes(
                        'Lavagem de roupa'
                      )
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
                        ${escapeHtml(item.label)}
                      </label>

                      ${
                        isLaundry

                          ? `
                            <span class="plus">
                              +10 CHF
                            </span>
                          `

                          : ''
                      }

                    </div>

                  `;

                }
              ).join('')
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

        `

        : '';

  }


  /* ========================================================
     AÇÕES
     ======================================================== */

  let actionsHtml = '';

  let editFormHtml = '';


  /*
     CLIENTE
  */

  if(
    mode === 'client' &&
    req.status === 'pending'
  ){

    actionsHtml = `

      <div class="task-actions">

        <button
          class="btn btn-outline"
          onclick="toggleEditForm('${req.id}')"
        >
          Editar
        </button>

        <button
          class="btn btn-danger"
          onclick="cancelRequest('${req.id}')"
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


  /*
     PROFISSIONAL
  */

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


  /*
     ADMIN
  */

  if(mode === 'admin'){

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
     CHAT
     ======================================================== */

  /*
     O chat aparece para cliente,
     profissional e administrador.

     Para não alterar o restante do
     layout, ele entra no bloco
     task-actions.
  */

  if(
    mode === 'client' ||
    mode === 'cleaner' ||
    mode === 'admin'
  ){

    actionsHtml += `

      <div class="task-actions">

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
     RETORNO DO CARD
     ======================================================== */

  return `

    <div
      class="task ${req.status}"
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
              req.address
            )}
          </div>

        </div>


        <div class="task-badges">

          <span
            class="
              badge
              price
              ${req.laundry_service
                ? 'laundry'
                : ''}
            "
          >
            ${req.price} CHF
          </span>

          <span
            class="
              badge
              ${req.status}
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
            ${formatDate(req.date)}
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
            ${req.stay_duration} dias
          </div>

        </div>


        <div class="info-item">

          <div class="label">
            Hóspedes
          </div>

          <div class="value">
            ${req.guest_count}
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

            ? `

              <div class="info-item">

                <div class="label">
                  Cliente
                </div>

                <div class="value">
                  ${escapeHtml(
                    req.client_name
                  )}
                </div>

              </div>

            `

            : ''
        }

      </div>


      ${
        req.notes

          ? `

            <div class="task-notes">

              <strong>
                Obs:
              </strong>

              ${escapeHtml(
                req.notes
              )}

            </div>

          `

          : ''
      }


      ${timerHtml}


      ${checklistHtml}


      ${
        mode === 'client'
          ? photosHtml
          : ''
      }


      ${actionsHtml}


      ${editFormHtml}

    </div>

  `;

}