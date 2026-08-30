/* ============================================================
   CleanSync — núcleo compartilhado (config, auth, utilitários)
   Carregado por todas as páginas via <script src="app-common.js">

   Login por USUÁRIO+SENHA própria (tabela "usuarios"), sem
   depender de confirmação de email. Recuperação de senha por
   CÓDIGO gerado na criação da conta (guarde-o, não tem outro
   jeito de recuperar).

   IMPORTANTE: o cliente do Supabase é guardado na variável "sb"
   (não "supabase") porque a própria biblioteca carregada pelo
   <script src=".../supabase-js@2"> já cria uma global chamada
   "supabase" — usar o mesmo nome de novo quebra a página inteira
   com "Identifier 'supabase' has already been declared".
   ============================================================ */

/* ---------- CONFIGURAÇÃO SUPABASE — edite aqui ---------- */
const SUPABASE_URL = 'https://oyxmrrazgjdnyzhyinhc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IVWPCoIWVhkvP_u7J0ZTsA_QeK-MNNI';

const PRICE_BASE = 40;
const PRICE_WITH_LAUNDRY = 50;

const APP_CONFIGURED = true;
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let realtimeChannel = null;

/* ---------- aviso de configuração pendente ---------- */
function renderSetupWarning(){
  document.body.innerHTML = `
    <div class="setup-warning">
      <h2>⚠️ Configuração pendente</h2>
      <p>Este app ainda não está ligado a um projeto Supabase.</p>
      <p>Abra <code>app-common.js</code>, encontre <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> no topo do arquivo, e substitua pelos valores do seu projeto (Settings → API no painel do Supabase).</p>
    </div>`;
}

/* ============================================================
   AUTENTICAÇÃO PRÓPRIA (usuário + senha + código de recuperação)
   ============================================================ */

/* hash SHA-256 da senha — nunca guardamos senha em texto puro */
async function sha256Hex(text){
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* gera um código de recuperação tipo AB3D-9F2K */
function generateRecoveryCode(){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem 0/O/1/I pra evitar confusão
  let code = '';
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code.slice(0, 4) + '-' + code.slice(4);
}

/* sessão simples guardada no navegador (não é um JWT, é só local) */
function getSession(){
  try { return JSON.parse(localStorage.getItem('k213_session') || 'null'); }
  catch { return null; }
}
function setSession(obj){
  localStorage.setItem('k213_session', JSON.stringify(obj));
  tagOneSignalExternalId(obj.id);
}

/* garante que o OneSignal sabe "quem é quem" no navegador (external_id = id da
   tabela usuarios, que é o mesmo valor usado como client_id em cleaning_requests).
   Sem isso, a notificação de tarefa concluída não sabe pra quem mandar. */
function tagOneSignalExternalId(userId){
  if (!userId || !window.OneSignalDeferred) return;
  window.OneSignalDeferred.push(function(OneSignal){
    OneSignal.login(String(userId));
  });
}
function clearSession(){
  localStorage.removeItem('k213_session');
}

/* cria conta na tabela "usuarios" */
async function criarConta(name, username, password, role, address){
  const password_hash = await sha256Hex(password);
  const recovery_code = generateRecoveryCode();

  const { data, error } = await sb.rpc('k213_criar_conta', {
    p_name: name, p_username: username, p_password_hash: password_hash,
    p_recovery_code: recovery_code, p_role: role, p_address: address || null
  });
  if (error) throw new Error(error.message.includes('já existe') ? 'Esse usuário já existe. Escolha outro nome de usuário.' : error.message);
  const row = Array.isArray(data) ? data[0] : data;
  return { user: row, recovery_code: row.recovery_code };
}

/* login por usuário + senha */
async function entrarComSenha(username, password){
  const password_hash = await sha256Hex(password);
  const { data, error } = await sb.rpc('k213_login', { p_username: username, p_password_hash: password_hash });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Usuário ou senha incorretos.');
  return row;
}

/* redefine a senha usando o código de recuperação, e gera um código novo */
async function redefinirSenha(username, recoveryCode, newPassword){
  const newHash = await sha256Hex(newPassword);
  const newCode = generateRecoveryCode();
  const { data, error } = await sb.rpc('k213_redefinir_senha', {
    p_username: username, p_recovery_code: recoveryCode.toUpperCase(),
    p_new_password_hash: newHash, p_new_recovery_code: newCode
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || !row.ok) throw new Error('Usuário ou código de recuperação incorretos.');
  return newCode;
}

/* ---------- guarda de rota ----------
   Chame no topo de cliente.html / profissional.html / relatorios.html.
   Se não estiver logado -> manda para index.html.
   Se o papel não bater -> manda para a página certa dele. */
async function requireRole(requiredRole){
  if (!APP_CONFIGURED) { renderSetupWarning(); return null; }
  const session = getSession();
  if (!session) { window.location.href = 'index.html'; return null; }
  // admin pode ver qualquer página; as outras páginas exigem o papel exato
  if (session.role !== requiredRole && session.role !== 'admin') {
    window.location.href = session.role === 'admin' ? 'admin.html' : session.role === 'profissional' ? 'profissional.html' : 'cliente.html';
    return null;
  }
  paintWho({ name: session.name, role: session.role });
  tagOneSignalExternalId(session.id);
  return {
    user: { id: session.id, email: session.username },
    profile: { name: session.name, role: session.role }
  };
}

function paintWho(profile){
  const nameEl = document.getElementById('topWhoName');
  if (nameEl) nameEl.textContent = profile.name + ' · ' + (profile.role === 'admin' ? 'Administrador' : profile.role === 'profissional' ? 'Profissional' : 'Cliente');
  const adminLink = document.getElementById('navAdminLink');
  if (adminLink && profile.role === 'admin') adminLink.style.display = '';
}

function logout(){
  if (realtimeChannel && sb) { sb.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (window.OneSignalDeferred) {
    window.OneSignalDeferred.push(function(OneSignal){ OneSignal.logout(); });
  }
  clearSession();
  window.location.href = 'index.html';
}

/* ---------- sincronização em tempo real ----------
   onChange(payload) é chamado a cada INSERT/UPDATE/DELETE em
   cleaning_requests. Cada página decide o que recarregar. */
function startRealtime(onChange){
  if (realtimeChannel || !sb) return;
  realtimeChannel = sb
    .channel('cleaning_requests_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_requests' }, onChange)
    .subscribe();
}

/* ---------- debounce ----------
   Evita recarregar a lista duas vezes seguidas quando uma ação
   do usuário e o evento de tempo real chegam quase juntos. */
function debounce(fn, wait = 250){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/* ---------- instalar app (barra fixa) + ativar notificações (modal central) ----------
   Os navegadores escondem esses avisos de propósito e demoram a mostrar.
   Aqui a gente assume o controle: o convite pra instalar fica fixo
   numa barrinha discreta, e o pedido de notificação aparece como um
   cartão no meio da tela, já com o botão de permitir bem visível. */
function setupInstallAndNotifyBanner(){
  let deferredInstallPrompt = null;
  let showInstall = false;
  let showNotifyModal = false;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstall = true;
    renderInstallBanner();
  });
  window.addEventListener('appinstalled', () => {
    showInstall = false;
    renderInstallBanner();
    showSnackbar('🎉 App instalado! Já pode acessar direto da tela inicial.');
  });

  // se o app já roda instalado (modo standalone), não tem por que oferecer instalar
  if (window.matchMedia('(display-mode: standalone)').matches) showInstall = false;

  // não insiste com quem já respondeu (aceitou/negou) ou já dispensou nesta sessão
  const notifyDismissedThisSession = sessionStorage.getItem('cleansync_notify_dismissed') === '1';
  if ('Notification' in window && Notification.permission === 'default' && !notifyDismissedThisSession) {
    showNotifyModal = true;
  }

  /* ---------- barra fixa de instalação (persiste até instalar ou fechar) ---------- */
  function renderInstallBanner(){
    let el = document.getElementById('installBanner');
    if (!showInstall) { if (el) el.remove(); return; }
    if (el) return; // já está na tela, não precisa recriar

    el = document.createElement('div');
    el.id = 'installBanner';
    el.className = 'install-banner';
    el.innerHTML = `
      <span class="install-banner-icon">📲</span>
      <div class="install-banner-text">
        <strong>Instale o CleanSync</strong>
        <span>Acesso rápido direto da tela inicial, sem precisar abrir o navegador ✨</span>
      </div>
      <button class="btn btn-accent btn-sm" id="btnInstallApp">Instalar</button>
      <button class="install-banner-close" id="btnDismissInstall" aria-label="Fechar">✕</button>
    `;
    document.body.appendChild(el);

    document.getElementById('btnInstallApp').onclick = async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      showInstall = false;
      renderInstallBanner();
    };
    document.getElementById('btnDismissInstall').onclick = () => {
      showInstall = false;
      renderInstallBanner();
    };
  }

  /* ---------- modal central de notificações ---------- */
  function renderNotifyModal(){
    let el = document.getElementById('notifyOverlay');
    if (!showNotifyModal) { if (el) el.remove(); return; }
    if (el) return;

    el = document.createElement('div');
    el.id = 'notifyOverlay';
    el.className = 'notify-overlay';
    el.innerHTML = `
      <div class="notify-modal">
        <div class="notify-emoji">🔔</div>
        <h3>Não perca nenhuma novidade!</h3>
        <p>Ative as notificações e saiba na hora quando uma tarefa for criada, iniciada ou concluída. 🧹✨</p>
        <div class="notify-actions">
          <button class="btn btn-accent" id="btnActivateNotify">✅ Permitir notificações</button>
          <button class="btn btn-ghost" id="btnDismissNotify">Agora não</button>
        </div>
      </div>
    `;
    document.body.appendChild(el);

    document.getElementById('btnActivateNotify').onclick = () => {
      if (window.OneSignalDeferred) {
        window.OneSignalDeferred.push(function(OneSignal){ OneSignal.Slidedown.promptPush(); });
      }
      showNotifyModal = false;
      renderNotifyModal();
    };
    document.getElementById('btnDismissNotify').onclick = () => {
      sessionStorage.setItem('cleansync_notify_dismissed', '1');
      showNotifyModal = false;
      renderNotifyModal();
    };
  }

  renderInstallBanner();
  // o evento beforeinstallprompt pode chegar um instante depois do load
  setTimeout(renderInstallBanner, 800);

  // um pequeno respiro antes do modal de notificação aparecer, pra não
  // assustar a pessoa assim que a página termina de carregar
  if (showNotifyModal) setTimeout(renderNotifyModal, 1000);
}


/* ---------- snackbar ---------- */
function showSnackbar(msg){
  let el = document.getElementById('snackbar');
  if (!el) {
    el = document.createElement('div');
    el.id = 'snackbar';
    el.className = 'snackbar';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 4000);
}

/* ---------- utilitários de formatação ---------- */
function formatDate(dateString){
  if (!dateString) return '';
  const d = new Date(dateString + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}
function getElapsedTime(startIso){
  const elapsed = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  return formatDuration(elapsed);
}
function formatDuration(totalSeconds){
  totalSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return h > 0 ? `${h}h ${m}min ${s}s` : `${m}min ${s}s`;
}
function escapeHtml(str){
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- checklist padrão ---------- */
async function getDefaultChecklist(){
  const { data, error } = await sb.from('default_checklist').select('items').eq('id', 1).single();
  if (error || !data) return [];
  return data.items;
}

/* ---------- cronômetros ativos na tela ---------- */
const _activeTimerKeys = new Set();
function attachTimers(list){
  list.forEach(req => {
    if (req.status === 'in-progress' && req.work_start) {
      const start = req.work_start;
      const key = 'timer_' + req.id + '_' + start;
      if (_activeTimerKeys.has(key)) return;
      _activeTimerKeys.add(key);
      setInterval(() => {
        document.querySelectorAll(`[data-timer-start="${start}"]`).forEach(el => {
          el.textContent = getElapsedTime(start);
        });
      }, 1000);
    }
  });
}

/* ---------- ações exclusivas do administrador ----------
   Mexem direto na tabela cleaning_requests (mesma tabela que
   cliente/profissional já usam), então dependem das mesmas
   políticas de RLS que já permitem escrita nessa tabela.
   Depois de agir, tenta recarregar a tela chamando a função de
   reload da própria página (reloadTasks em profissional.html,
   reloadRequests em cliente.html) — o que existir no escopo global. */
function _adminReload(){
  if (typeof reloadTasks === 'function') reloadTasks();
  else if (typeof reloadRequests === 'function') reloadRequests();
}

async function adminEditPrice(id, currentPrice){
  const input = prompt('Novo valor (em CHF):', currentPrice);
  if (input === null) return;
  const parsed = parseFloat(String(input).replace(',', '.'));
  if (isNaN(parsed) || parsed < 0) return alert('Digite um valor numérico válido.');

  const { error } = await sb.from('cleaning_requests').update({ price: parsed }).eq('id', id);
  if (error) return alert('Erro ao atualizar valor: ' + error.message);
  showSnackbar('💰 Valor atualizado para ' + parsed + ' CHF!');
  _adminReload();
}

async function adminDeleteTask(id, label){
  if (!confirm(`Excluir permanentemente a tarefa "${label}"? Isso não pode ser desfeito.`)) return;

  const { error } = await sb.from('cleaning_requests').delete().eq('id', id);
  if (error) return alert('Erro ao excluir: ' + error.message);
  showSnackbar('🗑️ Tarefa excluída.');
  _adminReload();
}

/* ---------- cartão de tarefa (compartilhado entre cliente/profissional) ---------- */
/* rótulo em português pro status de uma tarefa (usado em vários lugares) */
function statusLabel(status){
  return status === 'pending' ? 'Pendente' : status === 'in-progress' ? 'Em andamento' : 'Concluída';
}

function renderTaskCard(req, mode){
  if (mode === 'preview') {
    const dataFmt = (req.date || '').split('-').reverse().join('/');
    return `<div class="task ${req.status}" style="padding:16px 18px; margin-bottom:10px;">
      <div class="task-top" style="padding-bottom:0; margin-bottom:0; border-bottom:none;">
        <div>
          <div class="task-ref">${dataFmt} · ${req.time || ''}</div>
          <div class="task-addr" style="font-size:17px;">${escapeHtml(req.address)}</div>
        </div>
        <div class="task-badges">
          <span class="badge ${req.status}">${statusLabel(req.status)}</span>
          <span class="badge price">${req.price} CHF</span>
        </div>
      </div>
    </div>`;
  }

  let timerHtml = '';
  if (req.status === 'in-progress' && req.work_start) {
    timerHtml = `<div class="timer-box">
      <div class="timer-display" data-timer-start="${req.work_start}">${getElapsedTime(req.work_start)}</div>
      ${mode === 'cleaner' || mode === 'admin'
        ? `<div class="timer-controls"><button class="btn btn-danger btn-lg" onclick="stopTimer('${req.id}')">⏹ Finalizar trabalho</button></div>`
        : `<p style="font-size:12.5px; color:var(--info); margin-top:8px;">Trabalho em andamento…</p>`}
    </div>`;
  } else if (req.status === 'pending' && (mode === 'cleaner' || mode === 'admin')) {
    timerHtml = `<div class="timer-box">
      <p style="font-size:12.5px; color:var(--muted); margin-bottom:12px;">Aguardando início do trabalho</p>
      <div class="timer-controls"><button class="btn btn-success btn-lg" onclick="startTimer('${req.id}')">▶ Iniciar trabalho</button></div>
    </div>`;
  } else if (req.work_end && req.work_start) {
    const duration = (new Date(req.work_end) - new Date(req.work_start)) / 1000;
    timerHtml = `<p style="color:var(--success); margin-top:10px; font-size:13px; font-weight:600;">⏱️ Tempo total: ${formatDuration(duration)}</p>`;
  }

  let photosHtml = '';
  if (req.photos && req.photos.length) {
    photosHtml = `<div class="photo-row">${req.photos.map(p => `<img src="${p}" alt="foto" onclick="window.open('${p}','_blank')">`).join('')}</div>`;
  }

  let checklistHtml = '';
  if (mode === 'cleaner' || mode === 'admin') {
    const total = (req.checklist || []).length;
    const done = (req.checklist || []).filter(i => i.done).length;
    checklistHtml = total ? `
      <div class="checklist">
        <h4>Checklist</h4>
        <div class="checklist-progress">${done} / ${total} concluídos</div>
        ${req.checklist.map(item => {
          const isLaundry = item.id === 'laundry' || item.label.includes('Lavagem de roupa');
          return `<div class="checklist-item ${isLaundry ? 'laundry-item' : ''} ${item.done ? 'done' : ''}">
            <input type="checkbox" id="ck_${item.id}_${req.id}" ${item.done ? 'checked' : ''} onchange="toggleChecklistItem('${req.id}', '${item.id}')">
            <label for="ck_${item.id}_${req.id}">${escapeHtml(item.label)}</label>
            ${isLaundry ? '<span class="plus">+10 CHF</span>' : ''}
          </div>`;
        }).join('')}
      </div>
      <div class="field">
        <label>Fotos (opcional)</label>
        <input type="file" accept="image/*" multiple onchange="uploadPhotos('${req.id}', this)">
      </div>
      ${photosHtml}
    ` : '';
  }

  let actionsHtml = '';
  let editFormHtml = '';
  if (mode === 'client' && req.status === 'pending') {
    actionsHtml = `<div class="task-actions">
      <button class="btn btn-outline" onclick="toggleEditForm('${req.id}')">Editar</button>
      <button class="btn btn-danger" onclick="cancelRequest('${req.id}')">Cancelar</button>
    </div>`;
    editFormHtml = `<div class="task-edit-form" id="editForm_${req.id}" style="display:none;">
      <div class="field-row">
        <div class="field"><label>Data</label><input type="date" id="editDate_${req.id}" value="${req.date || ''}"></div>
        <div class="field"><label>Horário</label><input type="time" id="editTime_${req.id}" value="${req.time ? req.time.slice(0,5) : ''}"></div>
      </div>
      <div class="edit-actions">
        <button class="btn btn-outline" onclick="toggleEditForm('${req.id}')">Cancelar</button>
        <button class="btn btn-accent" onclick="saveEditRequest('${req.id}')">Salvar alterações</button>
      </div>
    </div>`;
  }
  if ((mode === 'cleaner' || mode === 'admin') && req.status !== 'completed') {
    actionsHtml += `<div class="task-actions"><button class="btn btn-success" onclick="completeTask('${req.id}')">✅ Marcar como concluída</button></div>`;
  }
  if (mode === 'admin') {
    actionsHtml += `<div class="task-actions">
      <button class="btn btn-outline" onclick="adminEditPrice('${req.id}', ${Number(req.price) || 0})">💰 Editar valor</button>
      <button class="btn btn-danger" onclick="adminDeleteTask('${req.id}', '${escapeHtml(req.ref_code || req.address || '')}')">🗑️ Excluir tarefa</button>
    </div>`;
  }

  // botão de mensagens fica disponível em todos os modos com tarefa de verdade
  actionsHtml += `<div class="task-actions">
    <button class="btn btn-outline" onclick="toggleChat('${req.id}')">💬 Mensagens <span class="chat-badge" id="chatBadge_${req.id}" style="display:none;"></span></button>
  </div>`;
  const chatHtml = `<div class="chat-box" id="chatBox_${req.id}" style="display:none;">
    <div class="chat-messages" id="chatMessages_${req.id}"><div class="spinner" style="margin:20px auto;"></div></div>
    <form class="chat-input-row" onsubmit="sendChatMessage(event, '${req.id}')">
      <input type="text" id="chatInput_${req.id}" placeholder="Escreva uma mensagem…" autocomplete="off">
      <button type="submit" class="btn btn-accent" style="clip-path:none;">Enviar</button>
    </form>
  </div>`;

  return `
  <div class="task ${req.status}">
    <div class="task-top">
      <div>
        <div class="task-ref">${req.ref_code || ''}</div>
        <div class="task-addr">${escapeHtml(req.address)}</div>
      </div>
      <div class="task-badges">
        <span class="badge price ${req.laundry_service ? 'laundry' : ''}">${req.price} CHF</span>
        <span class="badge ${req.status}">${statusLabel(req.status)}</span>
      </div>
    </div>
    <div class="task-info">
      <div class="info-item"><div class="label">Data</div><div class="value">${formatDate(req.date)}</div></div>
      <div class="info-item"><div class="label">Horário</div><div class="value">${req.time ? req.time.slice(0,5) : ''}</div></div>
      <div class="info-item"><div class="label">Estadia</div><div class="value">${req.stay_duration} dias</div></div>
      <div class="info-item"><div class="label">Hóspedes</div><div class="value">${req.guest_count}</div></div>
      <div class="info-item"><div class="label">Lavagem</div><div class="value">${req.laundry_service ? '✅ Sim' : '❌ Não'}</div></div>
      ${(mode === 'cleaner' || mode === 'admin') ? `<div class="info-item"><div class="label">Cliente</div><div class="value">${escapeHtml(req.client_name)}</div></div>` : ''}
    </div>
    ${req.notes ? `<div class="task-notes"><strong>Obs:</strong> ${escapeHtml(req.notes)}</div>` : ''}
    ${timerHtml}
    ${checklistHtml}
    ${mode === 'client' ? photosHtml : ''}
    ${actionsHtml}
    ${editFormHtml}
    ${mode !== 'preview' ? chatHtml : ''}
  </div>`;
}

/* ---------- chat por tarefa ---------- */
const _chatOpen = new Set();       // ids de tarefa com o chat aberto na tela
const _chatChannels = {};          // canais realtime ativos, por id de tarefa
const _chatUnread = {};            // contagem de não lidas, por id de tarefa

async function toggleChat(requestId){
  const box = document.getElementById('chatBox_' + requestId);
  if (!box) return;
  const isOpen = box.style.display !== 'none';
  if (isOpen) {
    box.style.display = 'none';
    _chatOpen.delete(requestId);
    return;
  }
  box.style.display = 'block';
  _chatOpen.add(requestId);
  clearChatBadge(requestId);
  await loadChatMessages(requestId);
  subscribeChat(requestId);
  const input = document.getElementById('chatInput_' + requestId);
  if (input) input.focus();
}

function clearChatBadge(requestId){
  _chatUnread[requestId] = 0;
  const badge = document.getElementById('chatBadge_' + requestId);
  if (badge) { badge.style.display = 'none'; badge.textContent = ''; }
}

function renderChatMessages(requestId, messages){
  const container = document.getElementById('chatMessages_' + requestId);
  if (!container) return;
  const session = getSession();
  if (!messages.length) {
    container.innerHTML = '<p style="color:var(--muted); font-size:12.5px; text-align:center; padding:14px 0;">Nenhuma mensagem ainda. Escreva a primeira!</p>';
    return;
  }
  container.innerHTML = messages.map(m => {
    const mine = session && session.username === m.sender_username;
    const time = new Date(m.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<div class="chat-bubble ${mine ? 'mine' : ''}">
      <div class="chat-bubble-meta">${escapeHtml(m.sender_name)} · ${time}</div>
      <div class="chat-bubble-content">${escapeHtml(m.content)}</div>
    </div>`;
  }).join('');
  container.scrollTop = container.scrollHeight;
}

async function loadChatMessages(requestId){
  const { data, error } = await sb.from('mensagens').select('*').eq('request_id', requestId).order('created_at', { ascending: true });
  if (error) { console.error(error); return; }
  renderChatMessages(requestId, data || []);
}

function subscribeChat(requestId){
  if (_chatChannels[requestId]) return; // já assinado
  _chatChannels[requestId] = sb
    .channel('mensagens_' + requestId)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens', filter: `request_id=eq.${requestId}` }, () => {
      if (_chatOpen.has(requestId)) {
        loadChatMessages(requestId);
      } else {
        _chatUnread[requestId] = (_chatUnread[requestId] || 0) + 1;
        const badge = document.getElementById('chatBadge_' + requestId);
        if (badge) { badge.style.display = 'inline-block'; badge.textContent = _chatUnread[requestId]; }
      }
    })
    .subscribe();
}

async function sendChatMessage(evt, requestId){
  evt.preventDefault();
  const input = document.getElementById('chatInput_' + requestId);
  const content = input.value.trim();
  if (!content) return;
  const session = getSession();
  input.value = '';
  input.disabled = true;
  const { error } = await sb.from('mensagens').insert({
    request_id: requestId,
    sender_role: session.role,
    sender_name: session.name,
    sender_username: session.username,
    content
  });
  input.disabled = false;
  input.focus();
  if (error) { alert('Erro ao enviar: ' + error.message); return; }
  await loadChatMessages(requestId);
}

// assina notificação de mensagem nova em tarefas ainda não abertas na tela,
// pra acender o badge de "não lida" sem precisar abrir o chat primeiro.
function watchChatBadgesFor(requestIds){
  requestIds.forEach(id => subscribeChat(id));
}

/* ============================================================
   Widget flutuante do assistente de IA (Gemini via Edge Function)
   ============================================================ */
let _aiWidgetBuilt = false;

function setupAIWidget(){
  if (_aiWidgetBuilt) return;
  _aiWidgetBuilt = true;

  const btn = document.createElement('button');
  btn.id = 'aiWidgetButton';
  btn.setAttribute('aria-label', 'Assistente de IA');
  btn.style.cssText = `
    position:fixed; bottom:22px; right:22px; z-index:900; width:56px; height:56px;
    border-radius:50%; border:none; cursor:pointer; font-size:26px;
    background:linear-gradient(135deg,var(--wine),var(--pink)); color:#fff;
    box-shadow:0 10px 30px -8px rgba(196,26,72,.7);
  `;
  btn.textContent = '🤖';
  btn.onclick = toggleAIPanel;
  document.body.appendChild(btn);

  const panel = document.createElement('div');
  panel.id = 'aiWidgetPanel';
  panel.style.cssText = `
    position:fixed; bottom:88px; right:22px; z-index:900; width:min(360px, calc(100vw - 44px));
    max-height:min(520px, calc(100vh - 130px)); display:none; flex-direction:column;
    background:var(--dark3); border:1px solid var(--border-strong); border-radius:var(--radius);
    box-shadow:0 30px 80px -20px rgba(0,0,0,.75); overflow:hidden;
  `;
  panel.innerHTML = `
    <div style="padding:14px 16px; background:linear-gradient(135deg,var(--wine),var(--pink)); display:flex; align-items:center; justify-content:space-between;">
      <div>
        <div style="font-family:var(--display); font-size:18px; font-weight:600; color:#fff;">Assistente CleanSync</div>
        <div style="font-size:10.5px; color:rgba(255,255,255,.8); font-family:var(--mono); letter-spacing:.05em;">POWERED BY GEMINI</div>
      </div>
      <button id="aiWidgetClose" style="background:transparent; border:none; color:#fff; font-size:18px; cursor:pointer; padding:4px 6px;">✕</button>
    </div>
    <div id="aiWidgetMessages" style="flex:1; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:10px; min-height:180px;">
      <div class="chat-bubble">
        <div class="chat-bubble-content">Oi! Posso ajudar com dúvidas sobre o app, explicar como funciona a busca de endereço por CEP, ou resumir tarefas concluídas (se você for admin). O que você precisa?</div>
      </div>
    </div>
    <form id="aiWidgetForm" style="display:flex; gap:8px; padding:12px; border-top:1px solid var(--border);">
      <input type="text" id="aiWidgetInput" placeholder="Pergunte alguma coisa…" autocomplete="off"
        style="flex:1; padding:10px 12px; border:1.5px solid var(--border-strong); border-radius:var(--radius-sm); background:var(--dark2); color:var(--cream); font-family:var(--sans); font-size:13.5px;">
      <button type="submit" class="btn btn-accent" style="clip-path:none;">➤</button>
    </form>
  `;
  document.body.appendChild(panel);

  document.getElementById('aiWidgetClose').onclick = toggleAIPanel;
  document.getElementById('aiWidgetForm').addEventListener('submit', sendAIMessage);
}

function toggleAIPanel(){
  const panel = document.getElementById('aiWidgetPanel');
  if (!panel) return;
  const isOpen = panel.style.display === 'flex';
  panel.style.display = isOpen ? 'none' : 'flex';
  if (!isOpen) document.getElementById('aiWidgetInput').focus();
}

function addAIBubble(content, mine){
  const container = document.getElementById('aiWidgetMessages');
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble' + (mine ? ' mine' : '');
  bubble.innerHTML = `<div class="chat-bubble-content"></div>`;
  bubble.querySelector('.chat-bubble-content').textContent = content;
  container.appendChild(bubble);
  container.scrollTop = container.scrollHeight;
  return bubble;
}

async function sendAIMessage(evt, taskId){
  evt.preventDefault();
  const form = evt.target;
  const input = form.querySelector('input[type=text]') || document.getElementById('aiWidgetInput');
  const message = input.value.trim();
  if (!message) return;
  const session = getSession();
  input.value = '';
  input.disabled = true;
  addAIBubble(message, true);

  const loadingBubble = addAIBubble('Digitando…', false);

  try {
    const resp = await fetch(SUPABASE_URL + '/functions/v1/gemini-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY
      },
      body: JSON.stringify({
        message,
        taskId: taskId || null,
        username: session.username,
        passwordHash: session.password_hash
      })
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Erro ao falar com o assistente.');

    const reply = data.reply || 'Não consegui gerar uma resposta no momento.';
    loadingBubble.querySelector('.chat-bubble-content').textContent = reply;
  } catch (err) {
    loadingBubble.querySelector('.chat-bubble-content').textContent = '⚠️ Não consegui responder agora (' + err.message + ').';
  } finally {
    input.disabled = false;
    input.focus();
  }
}

/* pra admin: pergunta pelo faturamento/resumo do mês (a function já monta os dados sozinha em modo geral) */
async function askAIResumoTarefas(){
  setupAIWidget();
  const panel = document.getElementById('aiWidgetPanel');
  if (panel.style.display !== 'flex') toggleAIPanel();

  const input = document.getElementById('aiWidgetInput');
  input.value = 'Me dê um resumo em texto corrido do faturamento e das tarefas deste mês.';
  document.getElementById('aiWidgetForm').dispatchEvent(new Event('submit'));
}
