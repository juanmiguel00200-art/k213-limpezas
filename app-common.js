/* ============================================================
   K213 — núcleo compartilhado (config, auth, utilitários)
   Carregado por todas as páginas via <script src="assets/app-common.js">
   ============================================================ */

/* ---------- CONFIGURAÇÃO SUPABASE — edite aqui ---------- */
const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
const SUPABASE_ANON_KEY = 'SUA_CHAVE_ANON_PUBLICA';

const PRICE_BASE = 40;
const PRICE_WITH_LAUNDRY = 50;

const K213_CONFIGURED = !(SUPABASE_URL.includes('SEU-PROJETO') || SUPABASE_ANON_KEY.includes('SUA_CHAVE'));
const supabase = K213_CONFIGURED ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let realtimeChannel = null;

/* ---------- aviso de configuração pendente ---------- */
function renderSetupWarning(){
  document.body.innerHTML = `
    <div class="setup-warning">
      <h2>⚠️ Configuração pendente</h2>
      <p>Este app ainda não está ligado a um projeto Supabase.</p>
      <p>Abra <code>assets/app-common.js</code>, encontre <code>SUPABASE_URL</code> e <code>SUPABASE_ANON_KEY</code> no topo do arquivo, e substitua pelos valores do seu projeto (Settings → API no painel do Supabase).</p>
      <p>Consulte <strong>LEIA-ME-SETUP.md</strong> para o passo a passo completo.</p>
    </div>`;
}

/* ---------- perfil ---------- */
async function ensureProfile(user){
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (profile) return profile;

  let pending = JSON.parse(localStorage.getItem('k213_pending_profile') || 'null');
  if (!pending) {
    const name = prompt('Complete seu cadastro — qual é o seu nome?') || user.email;
    const role = confirm('Você é o(a) profissional de limpeza?\n\nOK = Profissional   |   Cancelar = Cliente') ? 'profissional' : 'cliente';
    pending = { name, role };
  }
  const { data: newProfile, error } = await supabase.from('profiles')
    .insert({ id: user.id, name: pending.name, role: pending.role })
    .select().single();
  localStorage.removeItem('k213_pending_profile');
  if (error) { console.error(error); return { id: user.id, name: user.email, role: 'cliente' }; }
  return newProfile;
}

async function getSessionAndProfile(){
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  const profile = await ensureProfile(session.user);
  return { user: session.user, profile };
}

/* ---------- guarda de rota ----------
   Chame no topo de cliente.html / profissional.html / relatorios.html.
   Se não estiver logado -> manda para index.html.
   Se o papel não bater -> manda para a página certa dele (não deixa
   cliente ver tela de profissional nem vice-versa). */
async function requireRole(requiredRole){
  if (!K213_CONFIGURED) { renderSetupWarning(); return null; }
  const ctx = await getSessionAndProfile();
  if (!ctx) { window.location.href = 'index.html'; return null; }
  if (ctx.profile.role !== requiredRole) {
    window.location.href = ctx.profile.role === 'profissional' ? 'profissional.html' : 'cliente.html';
    return null;
  }
  paintWho(ctx.profile);
  return ctx;
}

function paintWho(profile){
  const nameEl = document.getElementById('topWhoName');
  if (nameEl) nameEl.textContent = profile.name + ' · ' + (profile.role === 'profissional' ? 'Profissional' : 'Cliente');
}

async function logout(){
  if (realtimeChannel && supabase) { supabase.removeChannel(realtimeChannel); realtimeChannel = null; }
  if (supabase) await supabase.auth.signOut();
  window.location.href = 'index.html';
}

/* ---------- sincronização em tempo real ----------
   onChange(payload) é chamado a cada INSERT/UPDATE/DELETE em
   cleaning_requests. Cada página decide o que recarregar. */
function startRealtime(onChange){
  if (realtimeChannel || !supabase) return;
  realtimeChannel = supabase
    .channel('cleaning_requests_sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_requests' }, onChange)
    .subscribe();
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
  const { data, error } = await supabase.from('default_checklist').select('items').eq('id', 1).single();
  if (error || !data) return [];
  return data.items;
}

/* ---------- cronômetros ativos na tela ----------
   Reinicia os intervalos toda vez que a lista é redesenhada,
   sem duplicar contadores para o mesmo work_start. */
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

/* ---------- cartão de tarefa (compartilhado entre cliente/profissional) ---------- */
function renderTaskCard(req, mode){
  // mode: 'client' (somente leitura, sem checklist) | 'cleaner' (controla tudo)
  let timerHtml = '';
  if (req.status === 'in-progress' && req.work_start) {
    timerHtml = `<div class="timer-box">
      <div class="timer-display" data-timer-start="${req.work_start}">${getElapsedTime(req.work_start)}</div>
      ${mode === 'cleaner'
        ? `<div class="timer-controls"><button class="btn btn-danger btn-lg" onclick="stopTimer('${req.id}')">⏹ Finalizar trabalho</button></div>`
        : `<p style="font-size:12.5px; color:var(--info); margin-top:8px;">Trabalho em andamento…</p>`}
    </div>`;
  } else if (req.status === 'pending' && mode === 'cleaner') {
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
  if (mode === 'cleaner') {
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
  if (mode === 'client' && req.status === 'pending') {
    actionsHtml = `<div class="task-actions">
      <button class="btn btn-outline" onclick="editRequest('${req.id}')">Editar</button>
      <button class="btn btn-danger" onclick="cancelRequest('${req.id}')">Cancelar</button>
    </div>`;
  }
  if (mode === 'cleaner' && req.status !== 'completed') {
    actionsHtml += `<div class="task-actions"><button class="btn btn-success" onclick="completeTask('${req.id}')">✅ Marcar como concluída</button></div>`;
  }

  const statusLabel = req.status === 'pending' ? 'Pendente' : req.status === 'in-progress' ? 'Em andamento' : 'Concluída';

  return `
  <div class="task ${req.status}">
    <div class="task-top">
      <div>
        <div class="task-ref">${req.ref_code || ''}</div>
        <div class="task-addr">${escapeHtml(req.address)}</div>
      </div>
      <div class="task-badges">
        <span class="badge price ${req.laundry_service ? 'laundry' : ''}">${req.price} CHF</span>
        <span class="badge ${req.status}">${statusLabel}</span>
      </div>
    </div>
    <div class="task-info">
      <div class="info-item"><div class="label">Data</div><div class="value">${formatDate(req.date)}</div></div>
      <div class="info-item"><div class="label">Horário</div><div class="value">${req.time ? req.time.slice(0,5) : ''}</div></div>
      <div class="info-item"><div class="label">Estadia</div><div class="value">${req.stay_duration} dias</div></div>
      <div class="info-item"><div class="label">Hóspedes</div><div class="value">${req.guest_count}</div></div>
      <div class="info-item"><div class="label">Lavagem</div><div class="value">${req.laundry_service ? '✅ Sim' : '❌ Não'}</div></div>
      ${mode === 'cleaner' ? `<div class="info-item"><div class="label">Cliente</div><div class="value">${escapeHtml(req.client_name)}</div></div>` : ''}
    </div>
    ${req.notes ? `<div class="task-notes"><strong>Obs:</strong> ${escapeHtml(req.notes)}</div>` : ''}
    ${timerHtml}
    ${checklistHtml}
    ${mode === 'client' ? photosHtml : ''}
    ${actionsHtml}
  </div>`;
}
