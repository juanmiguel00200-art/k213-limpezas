// app-common.js — inicialização do Supabase e funções auxiliares para o app K213
// Gerado/atualizado pelo Copilot conforme solicitado pelo mantenedor do projeto.

const SUPABASE_URL = 'https://oyxmrrazgjdnyzhyinhc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_IVWPCoIWVhkvP_u7J0ZTsA_QeK-MNNI';

// Cria o cliente Supabase e expõe como `supabase` global para compatibilidade
if (typeof window !== 'undefined') {
  // Se o SDK do supabase já estiver carregado no CDN, cria o cliente
  if (typeof supabase !== 'undefined' && supabase.createClient) {
    try {
      window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (e) {
      console.error('Falha ao criar supabase client:', e);
      window.supabase = null;
    }
  } else {
    // SDK não disponível ainda — setamos null e os logs abaixo ajudarão a diagnosticar
    window.supabase = null;
  }
}

// Flags e preços usados nas páginas
const K213_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY);
const PRICE_BASE = 40;
const PRICE_WITH_LAUNDRY = 50;

// Debug: log inicial para verificar carregamento / conexão
if (typeof window !== 'undefined') {
  try {
    console.groupCollapsed('K213 debug');
    console.log('app-common.js carregado');
    console.log('K213_CONFIGURED:', K213_CONFIGURED);
    console.log('SUPABASE_URL:', SUPABASE_URL);
    // nao imprime a key inteira (mas imprime últimos 6 caracteres para ajudar a confirmar)
    console.log('SUPABASE_ANON_KEY (suffix):', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.slice(-6) : null);
    if (!window.supabase) {
      console.warn('Supabase client NÃO disponível — verifique se o SDK foi carregado (cdn) antes deste arquivo.');
    } else {
      console.log('Supabase client criado com sucesso. Testando getUser e leitura de tabela...');
    }
    console.groupEnd();
  } catch (e) { console.warn('Erro nos logs de debug iniciais:', e); }
}

// Utilitários
function escapeHtml(str){
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDuration(seconds){
  if (!seconds || isNaN(seconds)) return '0m';
  seconds = Math.round(seconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(input){
  if (!input) return '';
  try{
    const d = new Date(input);
    if (isNaN(d)) return String(input);
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  } catch(e){ return String(input); }
}

function showSnackbar(text, timeout = 3000){
  const el = document.getElementById('snackbar');
  if (!el) return;
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(el._hideTimer);
  el._hideTimer = setTimeout(() => el.classList.remove('show'), timeout);
}

async function logout(){
  try{
    if (window.supabase) await window.supabase.auth.signOut();
  } catch(e){ console.warn('Erro ao deslogar', e); }
  window.location.href = 'index.html';
}

function renderSetupWarning(){
  alert('Arquivo app-common.js não está configurado corretamente. Verifique SUPABASE_URL e SUPABASE_ANON_KEY.');
}

// Sessão e perfil
async function getSessionAndProfile(){
  if (!window.supabase) return null;
  try{
    const { data: { user } } = await window.supabase.auth.getUser();
    if (!user) return null;
    const { data: profile, error } = await window.supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    if (error) return null;
    return { user, profile };
  } catch(e){ console.error(e); return null; }
}

async function ensureProfile(user){
  // cria perfil quando necessário (usado no registro)
  if (!window.supabase) throw new Error('Supabase não configurado');
  const { data: existing } = await window.supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (existing) return existing;
  const pending = localStorage.getItem('k213_pending_profile');
  const payload = pending ? JSON.parse(pending) : { name: user.email.split('@')[0], role: 'cliente' };
  const insert = { id: user.id, name: payload.name, role: payload.role, email: user.email, created_at: new Date().toISOString() };
  const { data, error } = await window.supabase.from('profiles').insert(insert).select().maybeSingle();
  if (error) throw error;
  localStorage.removeItem('k213_pending_profile');
  return data;
}

async function requireRole(role){
  const ctx = await getSessionAndProfile();
  if (!ctx) { window.location.href = 'index.html'; return null; }
  if (!ctx.profile) { // tenta garantir profile
    try{ ctx.profile = await ensureProfile(ctx.user); }catch(e){}
  }
  if (role === 'profissional' && ctx.profile && ctx.profile.role !== 'profissional') { window.location.href = 'cliente.html'; return null; }
  if (role === 'cliente' && ctx.profile && ctx.profile.role !== 'cliente') { window.location.href = 'profissional.html'; return null; }
  // atualiza nome no topo se houver
  const top = document.getElementById('topWhoName');
  if (top && ctx.profile) top.textContent = ctx.profile.name || '';
  return ctx;
}

// Realtime helper (limpo: evita múltiplas subscrições)
function startRealtime(cb){
  if (!window.supabase) return;
  if (window._k213_realtime) {
    window._k213_realtime.unsubscribe();
  }
  const channel = window.supabase.channel('public:cleaning_requests')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'cleaning_requests' }, payload => {
      try{ cb(payload); } catch(e){ console.error(e); }
    })
    .subscribe();
  window._k213_realtime = channel;
  return channel;
}

// Default checklist fetch
async function getDefaultChecklist(){
  if (!window.supabase) return [];
  try{
    const { data, error } = await window.supabase.from('default_checklist').select('items').eq('id', 1).maybeSingle();
    if (error || !data) return [
      { id: 'bed', label: 'Arrumar camas' },
      { id: 'bath', label: 'Limpar banheiro' },
      { id: 'vacuum', label: 'Aspirar' },
      { id: 'laundry', label: 'Lavagem de roupa (se contratada)' }
    ];
    return data.items || [];
  } catch(e){ console.error(e); return []; }
}

// Render simplificado de um cartão de tarefa — suficiente para as páginas já existentes
function renderTaskCard(req, role){
  const statusLabel = req.status || '';
  const ref = req.ref_code ? escapeHtml(req.ref_code) : '';
  const addr = escapeHtml(req.address || '');
  const price = (req.price != null) ? Number(req.price).toFixed(2) + ' CHF' : (PRICE_BASE + ' CHF');
  const client = escapeHtml(req.client_name || '');
  const date = formatDate(req.date || req.created_at || req.completed_at);

  // botões contextuais
  let actions = '';
  if (role === 'cleaner' || role === 'profissional'){
    actions += req.status !== 'in-progress' ? `<button class="btn" onclick="startTimer(${req.id})">Iniciar</button>` : `<button class="btn" onclick="stopTimer(${req.id})">Parar</button>`;
    actions += ` <button class="btn" onclick="completeTask(${req.id})">Concluir</button>`;
  } else if (role === 'client'){
    actions += `<button class="btn" onclick="editRequest(${req.id})">Editar</button> <button class="btn btn-danger" onclick="cancelRequest(${req.id})">Cancelar</button>`;
  }

  // upload input (hidden) — a página chama uploadPhotos(id, input)
  const photosInput = `<input type="file" accept="image/*" multiple style="display:none;" id="upload-${req.id}" onchange="uploadPhotos(${req.id}, this)" />`;

  return `
    <div class="task ${escapeHtml(statusLabel)}">
      <div class="task-top">
        <div><div class="task-ref">${ref}</div><div class="task-addr">${addr}</div></div>
        <div class="task-badges">
          <span class="badge price">${price}</span>
          <span style="font-family:var(--mono); font-size:12px; color:var(--muted);">${date}</span>
        </div>
      </div>
      <div class="task-notes">Cliente: ${client} · Hóspedes: ${req.guest_count || '-'} · Estadia: ${req.stay_duration || '-'} dias ${req.laundry_service ? '· 🧺 com lavagem' : ''}</div>
      <div class="task-actions">${actions} ${photosInput}</div>
    </div>
  `;
}

// attachTimers pode ser uma função leve que garante que não ocorram erros quando chamada
function attachTimers(requests){
  // para evitar erros: apenas garante que inputs de upload existam ao renderizar
  if (!Array.isArray(requests)) return;
  requests.forEach(r => {
    const el = document.getElementById(`upload-${r.id}`);
    // nada mais por enquanto; função existe para compatibilidade
  });
}

// Auto-teste de debug: se o client Supabase existe, tenta getUser e um select curto
if (typeof window !== 'undefined' && window.supabase) {
  (async () => {
    try {
      console.groupCollapsed('K213 Supabase self-check');
      const userRes = await window.supabase.auth.getUser();
      console.log('auth.getUser ->', userRes);
      try {
        const testRes = await window.supabase.from('cleaning_requests').select('id').limit(1);
        console.log('test select cleaning_requests ->', testRes);
      } catch (qErr) {
        console.warn('Erro ao executar select de teste (pode ser RLS ou tabela ausente) ->', qErr);
      }
      console.groupEnd();
    } catch (e) {
      console.error('Erro no self-check do Supabase ->', e);
    }
  })();
}

// export globals para as páginas (algumas usam sem prefixo)
if (typeof window !== 'undefined'){
  window.K213_CONFIGURED = K213_CONFIGURED;
  window.PRICE_BASE = PRICE_BASE;
  window.PRICE_WITH_LAUNDRY = PRICE_WITH_LAUNDRY;
  window.escapeHtml = escapeHtml;
  window.formatDuration = formatDuration;
  window.formatDate = formatDate;
  window.showSnackbar = showSnackbar;
  window.logout = logout;
  window.renderSetupWarning = renderSetupWarning;
  window.getSessionAndProfile = getSessionAndProfile;
  window.ensureProfile = ensureProfile;
  window.requireRole = requireRole;
  window.startRealtime = startRealtime;
  window.getDefaultChecklist = getDefaultChecklist;
  window.renderTaskCard = renderTaskCard;
  window.attachTimers = attachTimers;
}
