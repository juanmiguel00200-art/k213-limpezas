/* ============================================================
   CLEANSYNC
   APP-COMMON.JS — VERSÃO DEFINITIVA (Opção B: login customizado)
   ============================================================

   Compatível com:
   - index.html
   - cliente.html
   - profissional.html
   - admin.html
   - relatorios.html
   - chat.html

   AUTENTICAÇÃO (Opção B — sem Supabase Auth):
   - usuário + senha (hash sha256 calculado no navegador)
   - sessão guardada no localStorage via setSession()/getSession()
   - recuperação por código (não por e-mail)
   - toda ação sensível verifica usuário+hash a cada chamada,
     via RPCs SECURITY DEFINER (login_with_password, create_account,
     reset_password_with_code, k213_admin_*)

   Banco:
   profiles (id, username, password_hash, recovery_code_hash, name, role, address)
   cleaning_requests
   conversations (task_id, client_id, professional_id)
   messages (conversation_id, sender_id, content)
   default_checklist

   NÃO UTILIZA:
   - sb.auth (Supabase Auth)
   - auth.uid()
   - cleaning_id / cleaning_request_id
============================================================ */


/* ============================================================
   1. CONFIGURAÇÃO SUPABASE
============================================================ */

const SUPABASE_URL =
  window.SUPABASE_URL || "";

const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY ||
  window.SUPABASE_KEY ||
  "";


/* ============================================================
   2. CLIENTE SUPABASE
============================================================ */

let sb = window.sb || null;

if (!sb) {

  if (typeof window.supabase === "undefined") {

    console.error("CleanSync: biblioteca Supabase não carregada.");

  } else if (SUPABASE_URL && SUPABASE_ANON_KEY) {

    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        // Opção B não usa Supabase Auth — desliga persistência
        // de sessão do SDK pra não confundir com nossa sessão própria.
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    window.sb = sb;

  } else {

    console.error("CleanSync: SUPABASE_URL ou SUPABASE_ANON_KEY não configurados.");

  }

}


/* ============================================================
   3. APP_CONFIGURED / AVISO DE SETUP
============================================================ */

const APP_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
window.APP_CONFIGURED = APP_CONFIGURED;

function renderSetupWarning() {

  document.body.innerHTML = `
    <div class="setup-warning">
      <h2>⚠️ CleanSync não está configurado</h2>
      <p>
        Defina <code>window.SUPABASE_URL</code> e
        <code>window.SUPABASE_ANON_KEY</code> antes de carregar
        <code>app-common.js</code>.
      </p>
    </div>
  `;

}
window.renderSetupWarning = renderSetupWarning;


/* ============================================================
   4. CONFIGURAÇÕES DO SISTEMA
============================================================ */

const PRICE_BASE = 40;
const PRICE_WITH_LAUNDRY = 50;

window.PRICE_BASE = PRICE_BASE;
window.PRICE_WITH_LAUNDRY = PRICE_WITH_LAUNDRY;


/* ============================================================
   5. HELPERS
============================================================ */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
window.escapeHtml = escapeHtml;

function escapeAttribute(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
window.escapeAttribute = escapeAttribute;


/* ============================================================
   6. DEBOUNCE
============================================================ */

function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
window.debounce = debounce;


/* ============================================================
   7. SNACKBAR
============================================================ */

function showSnackbar(message) {

  const snackbar = document.getElementById("snackbar");

  if (!snackbar) {
    console.log("[CleanSync]", message);
    return;
  }

  snackbar.textContent = message;
  snackbar.classList.add("show");

  clearTimeout(window.__cleanSyncSnackbarTimer);
  window.__cleanSyncSnackbarTimer = setTimeout(() => {
    snackbar.classList.remove("show");
  }, 3200);

}
window.showSnackbar = showSnackbar;


/* ============================================================
   8. HASH DE SENHA (SHA-256, via Web Crypto API do navegador)
============================================================ */

async function sha256Hex(text) {
  const data = new TextEncoder().encode(String(text ?? ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}
window.sha256Hex = sha256Hex;


/* ============================================================
   9. SESSÃO (localStorage — SEM Supabase Auth)
============================================================ */

const CLEANSYNC_SESSION_KEY = "cleansync_session";

/*
 * setSession({ id, username, name, role, password_hash, address })
 * Guarda a sessão no localStorage. Chamado depois de login/signup.
 */
function setSession(sessionData) {
  try {
    localStorage.setItem(CLEANSYNC_SESSION_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.error("setSession:", error);
  }
}
window.setSession = setSession;

/*
 * getSession() — SÍNCRONO, sem await.
 * Retorna { id, username, name, role, password_hash, address } ou null.
 */
function getSession() {
  try {
    const raw = localStorage.getItem(CLEANSYNC_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error("getSession:", error);
    return null;
  }
}
window.getSession = getSession;

function clearSession() {
  try {
    localStorage.removeItem(CLEANSYNC_SESSION_KEY);
  } catch (error) {
    console.error("clearSession:", error);
  }
}
window.clearSession = clearSession;


/* ============================================================
   10. NORMALIZAÇÃO DE ROLE
============================================================ */

function normalizeRole(role) {

  const value = String(role || "").trim().toLowerCase();

  if (["professional", "profissional", "cleaner", "cleaning"].includes(value)) {
    return "profissional";
  }

  if (["admin", "administrator", "administrador"].includes(value)) {
    return "admin";
  }

  if (["client", "cliente"].includes(value)) {
    return "cliente";
  }

  return value;

}
window.normalizeRole = normalizeRole;


/* ============================================================
   11. ENTRAR / CRIAR CONTA / RECUPERAR SENHA
        (wrappers em torno das RPCs SQL)
============================================================ */

async function entrarComSenha(username, password) {

  if (!sb) throw new Error("Supabase não inicializado.");

  const passwordHash = await sha256Hex(password);

  const { data, error } = await sb.rpc("login_with_password", {
    p_username: username,
    p_password_hash: passwordHash
  });

  if (error) {
    throw new Error(error.message || "Usuário ou senha inválidos.");
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Usuário ou senha inválidos.");
  }

  return row; // { id, username, name, role, address }

}
window.entrarComSenha = entrarComSenha;


async function criarConta(name, username, password, role, address) {

  if (!sb) throw new Error("Supabase não inicializado.");

  const passwordHash = await sha256Hex(password);

  const { data, error } = await sb.rpc("create_account", {
    p_name: name,
    p_username: username,
    p_password_hash: passwordHash,
    p_role: role,
    p_address: address || null
  });

  if (error) {
    throw new Error(error.message || "Não foi possível criar a conta.");
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    throw new Error("Não foi possível criar a conta.");
  }

  return {
    user: {
      id: row.id,
      username: row.username,
      name: row.name,
      role: row.role,
      address: row.address
    },
    recovery_code: row.recovery_code
  };

}
window.criarConta = criarConta;


async function redefinirSenha(username, code, newPassword) {

  if (!sb) throw new Error("Supabase não inicializado.");

  const newPasswordHash = await sha256Hex(newPassword);

  const { data, error } = await sb.rpc("reset_password_with_code", {
    p_username: username,
    p_code: code,
    p_new_password_hash: newPasswordHash
  });

  if (error) {
    throw new Error(error.message || "Usuário ou código de recuperação inválidos.");
  }

  return data; // novo código de recuperação

}
window.redefinirSenha = redefinirSenha;


/* ============================================================
   12. REQUIRE ROLE (agora baseado na sessão local, não no Supabase Auth)
============================================================ */

async function requireRole(expectedRole) {

  const session = getSession();

  if (!session || !session.id) {
    window.location.href = "index.html";
    return null;
  }

  const actualRole = normalizeRole(session.role);
  const wantedRole = normalizeRole(expectedRole);

  /*
   * ADMIN possui acesso às áreas administrativas/profissionais.
   */
  const allowed =
    actualRole === wantedRole ||
    (actualRole === "admin" && (wantedRole === "profissional" || wantedRole === "admin"));

  if (!allowed) {

    if (actualRole === "cliente") {
      window.location.href = "cliente.html";
    } else if (actualRole === "profissional" || actualRole === "admin") {
      window.location.href = "profissional.html";
    } else {
      window.location.href = "index.html";
    }

    return null;

  }

  const profile = {
    id: session.id,
    name: session.name,
    role: session.role,
    username: session.username,
    address: session.address
  };

  const user = {
    id: session.id,
    username: session.username
  };

  updateTopWhoName(profile, user);

  return { user, profile };

}
window.requireRole = requireRole;


/* ============================================================
   13. NOME NO TOPO
============================================================ */

function updateTopWhoName(profile, user) {

  const element = document.getElementById("topWhoName");
  if (!element) return;

  element.textContent =
    (profile && profile.name) ||
    (user && user.username) ||
    "";

}
window.updateTopWhoName = updateTopWhoName;


/* ============================================================
   14. LOGOUT
============================================================ */

function logout() {
  clearSession();
  window.location.href = "index.html";
}
window.logout = logout;


/* ============================================================
   15. STATUS
============================================================ */

function formatStatus(status) {
  switch (status) {
    case "pending": return "Pendente";
    case "in-progress": return "Em andamento";
    case "completed": return "Concluída";
    case "cancelled": return "Cancelada";
    default: return status || "—";
  }
}
window.formatStatus = formatStatus;


/* ============================================================
   16. DATA
============================================================ */

function formatTaskDate(date, time) {

  if (!date) return "—";

  try {

    const raw = date + (time ? "T" + time : "T00:00:00");
    const d = new Date(raw);

    if (Number.isNaN(d.getTime())) return escapeHtml(date);

    const formatted = d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

    return time ? formatted + " · " + escapeHtml(time) : formatted;

  } catch {
    return escapeHtml(date);
  }

}
window.formatTaskDate = formatTaskDate;


/* ============================================================
   17. GET DEFAULT CHECKLIST
============================================================ */

async function getDefaultChecklist() {

  if (!sb) return [];

  try {

    const { data, error } = await sb
      .from("default_checklist")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.warn("Checklist padrão não encontrado:", error.message);
      return [];
    }

    if (Array.isArray(data?.items)) return data.items;

    return [];

  } catch (error) {
    console.error("getDefaultChecklist:", error);
    return [];
  }

}
window.getDefaultChecklist = getDefaultChecklist;


/* ============================================================
   18. CHECKLIST NORMALIZATION
============================================================ */

function normalizeChecklist(checklist) {

  if (!Array.isArray(checklist)) return [];

  return checklist.map((item, index) => ({
    id: item?.id || "item_" + index,
    label: item?.label || item?.name || "Tarefa",
    done: Boolean(item?.done)
  }));

}
window.normalizeChecklist = normalizeChecklist;


/* ============================================================
   19. TIMER
============================================================ */

function calculateWorkSeconds(task) {

  if (!task?.work_start) return 0;

  const start = new Date(task.work_start).getTime();
  if (Number.isNaN(start)) return 0;

  const end = task.work_end ? new Date(task.work_end).getTime() : Date.now();

  return Math.max(0, Math.floor((end - start) / 1000));

}

function formatDuration(totalSeconds) {

  const seconds = Math.max(0, Number(totalSeconds) || 0);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");

}

window.calculateWorkSeconds = calculateWorkSeconds;
window.formatDuration = formatDuration;


/* ============================================================
   20. ATTACH TIMERS
============================================================ */

function attachTimers(tasks) {

  if (!Array.isArray(tasks)) return;

  const update = () => {
    tasks.forEach(task => {
      const element = document.querySelector(`[data-timer-id="${escapeAttribute(task.id)}"]`);
      if (!element) return;
      element.textContent = formatDuration(calculateWorkSeconds(task));
    });
  };

  update();

  clearInterval(window.__cleanSyncTimerInterval);
  window.__cleanSyncTimerInterval = setInterval(update, 1000);

}
window.attachTimers = attachTimers;


/* ============================================================
   21. CHAT — URL E BOTÃO
============================================================ */

function getChatUrl(taskId) {
  if (!taskId) return "chat.html";
  return "chat.html?task=" + encodeURIComponent(taskId);
}
window.getChatUrl = getChatUrl;

function renderChatButton(task) {

  if (!task?.id) return "";

  return `
    <a
      href="${escapeAttribute(getChatUrl(task.id))}"
      class="btn btn-outline chat-task-button"
      title="Abrir conversa desta limpeza"
      aria-label="Abrir chat desta limpeza"
    >
      💬 Chat
    </a>
  `;

}
window.renderChatButton = renderChatButton;


/* ============================================================
   22. RENDER TASK CARD
============================================================ */

function renderTaskCard(task, mode = "client") {

  if (!task) return "";

  const role = normalizeRole(mode);
  const isClient = role === "cliente" || mode === "client";
  const isAdmin = role === "admin" || mode === "admin";
  const isCleaner = role === "profissional" || mode === "cleaner" || mode === "professional";

  const checklist = normalizeChecklist(task.checklist);
  const doneCount = checklist.filter(item => item.done).length;
  const checklistTotal = checklist.length;
  const checklistPercent = checklistTotal > 0 ? Math.round((doneCount / checklistTotal) * 100) : 0;

  const laundry = Boolean(task.laundry_service);
  const price = Number(task.price ?? (laundry ? PRICE_WITH_LAUNDRY : PRICE_BASE));
  const status = task.status || "pending";
  const taskId = task.id;

  const ref = task.ref_code || (taskId ? String(taskId).slice(0, 8) : "—");
  const clientName = task.client_name || task.client_email || "Cliente";
  const address = task.address || "Endereço não informado";
  const date = formatTaskDate(task.date, task.time);
  const notes = task.notes || "";
  const photos = Array.isArray(task.photos) ? task.photos : [];

  let html = `
    <article class="task card" data-task-id="${escapeAttribute(taskId)}">
      <div class="task-head">
        <div>
          <div class="task-ref">#${escapeHtml(ref)}</div>
          <h3 class="task-title">${escapeHtml(clientName)}</h3>
        </div>
        <div class="status status-${escapeAttribute(status)}">
          ${escapeHtml(formatStatus(status))}
        </div>
      </div>

      <div class="task-meta">
        <div class="task-meta-item"><span>DATA</span><strong>${date}</strong></div>
        <div class="task-meta-item"><span>ENDEREÇO</span><strong>${escapeHtml(address)}</strong></div>
        <div class="task-meta-item"><span>HÓSPEDES</span><strong>${escapeHtml(task.guest_count ?? "—")}</strong></div>
        <div class="task-meta-item"><span>ESTADIA</span><strong>${escapeHtml(task.stay_duration ?? "—")}${task.stay_duration ? " dias" : ""}</strong></div>
      </div>

      <div class="task-price-row">
        <div>
          <span class="task-label">SERVIÇO</span>
          <strong>Limpeza${laundry ? " + Lavagem" : ""}</strong>
        </div>
        <div class="task-price">${price}<small>CHF</small></div>
      </div>
  `;

  if (checklistTotal > 0) {
    html += `
      <div class="checklist-section">
        <div class="checklist-header">
          <span>Checklist</span>
          <span class="checklist-progress">${doneCount} / ${checklistTotal} concluídos</span>
        </div>
        <div class="checklist-bar" aria-hidden="true">
          <div class="checklist-fill" style="width:${checklistPercent}%"></div>
        </div>
        <div class="checklist-list">
          ${checklist.map(item => {
            const done = Boolean(item.done);
            const checkboxId = "ck_" + String(item.id) + "_" + String(taskId);
            return `
              <label class="checklist-item ${done ? "done" : ""}">
                <input
                  type="checkbox"
                  id="${escapeAttribute(checkboxId)}"
                  ${done ? "checked" : ""}
                  ${(isCleaner || isAdmin)
                    ? `onclick="toggleChecklistItem('${escapeAttribute(taskId)}','${escapeAttribute(item.id)}')"`
                    : "disabled"}
                >
                <span>${escapeHtml(item.label)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  if (notes) {
    html += `
      <div class="task-notes">
        <span>OBSERVAÇÕES</span>
        <p>${escapeHtml(notes)}</p>
      </div>
    `;
  }

  if (isCleaner || isAdmin) {
    html += `
      <div class="task-timer">
        <div>
          <span>TEMPO DE TRABALHO</span>
          <strong data-timer-id="${escapeAttribute(taskId)}">${formatDuration(calculateWorkSeconds(task))}</strong>
        </div>
        ${task.work_start && !task.work_end ? `<span class="timer-live">● CONTANDO</span>` : ""}
      </div>
    `;
  }

  if (photos.length > 0) {
    html += `
      <div class="task-photos">
        <div class="task-label">FOTOS</div>
        <div class="photo-grid">
          ${photos.map(photo => `
            <a href="${escapeAttribute(photo)}" target="_blank" rel="noopener noreferrer">
              <img src="${escapeAttribute(photo)}" alt="Foto da limpeza" loading="lazy">
            </a>
          `).join("")}
        </div>
      </div>
    `;
  }

  html += `<div class="task-actions">${renderChatButton(task)}`;

  if (isClient) {

    if (status === "pending") {
      html += `
        <button type="button" class="btn btn-outline" onclick="toggleEditForm('${escapeAttribute(taskId)}')">✏️ Editar</button>
        <button type="button" class="btn btn-danger" onclick="cancelRequest('${escapeAttribute(taskId)}')">🗑️ Cancelar</button>
      `;
    }

    html += `
      <div class="edit-form" id="editForm_${escapeAttribute(taskId)}" style="display:none;">
        <div class="field-row">
          <div class="field">
            <label>Nova data</label>
            <input type="date" id="editDate_${escapeAttribute(taskId)}" value="${escapeAttribute(task.date || "")}">
          </div>
          <div class="field">
            <label>Novo horário</label>
            <input type="time" id="editTime_${escapeAttribute(taskId)}" value="${escapeAttribute(task.time || "")}">
          </div>
        </div>
        <button type="button" class="btn btn-accent" onclick="saveEditRequest('${escapeAttribute(taskId)}')">Salvar alteração</button>
      </div>
    `;

  }

  if (isCleaner || isAdmin) {

    if (status === "pending") {
      html += `<button type="button" class="btn btn-accent" onclick="startTimer('${escapeAttribute(taskId)}')">▶️ Iniciar trabalho</button>`;
    }

    if (status === "in-progress") {
      html += `
        <button type="button" class="btn btn-outline" onclick="stopTimer('${escapeAttribute(taskId)}')">⏹️ Finalizar trabalho</button>
        <button type="button" class="btn btn-accent" onclick="completeTask('${escapeAttribute(taskId)}')">✅ Concluir tarefa</button>
      `;
    }

    if (status === "completed") {
      html += `<span class="task-completed-label">✓ Serviço concluído</span>`;
    }

    html += `
      <label class="btn btn-outline photo-upload-button">
        📸 Fotos
        <input type="file" accept="image/*" multiple hidden onchange="uploadPhotos('${escapeAttribute(taskId)}', this)">
      </label>
    `;

  }

  if (isAdmin) {
    html += `<button type="button" class="btn btn-danger" onclick="deleteTask('${escapeAttribute(taskId)}')">🗑️ Excluir</button>`;
  }

  html += `</div></article>`;

  return html;

}
window.renderTaskCard = renderTaskCard;


/* ============================================================
   23. DELETE TASK — ADMIN
============================================================ */

async function deleteTask(id) {

  if (!id) return;
  if (!confirm("Tem certeza que deseja excluir esta tarefa?\n\nEssa ação não poderá ser desfeita.")) return;
  if (!sb) { alert("Supabase não está disponível."); return; }

  try {

    const { error } = await sb.from("cleaning_requests").delete().eq("id", id);
    if (error) throw error;

    showSnackbar("🗑️ Tarefa excluída.");

    if (typeof window.reloadTasks === "function") window.reloadTasks();
    if (typeof window.reloadRequests === "function") window.reloadRequests();

  } catch (error) {
    console.error("deleteTask:", error);
    alert("Erro ao excluir tarefa: " + error.message);
  }

}
window.deleteTask = deleteTask;


/* ============================================================
   24. REALTIME CLEANING REQUESTS
============================================================ */

let cleanSyncRealtimeChannel = null;

function startRealtime(callback) {

  if (!sb) {
    console.warn("Realtime: Supabase não inicializado.");
    return null;
  }

  if (cleanSyncRealtimeChannel) {
    try { sb.removeChannel(cleanSyncRealtimeChannel); } catch {}
    cleanSyncRealtimeChannel = null;
  }

  const channelName = "cleansync-cleaning-requests-" + Date.now();

  cleanSyncRealtimeChannel = sb
    .channel(channelName)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "cleaning_requests" },
      payload => {
        console.log("CleanSync Realtime:", payload);
        if (typeof callback === "function") callback(payload);
      }
    )
    .subscribe(status => {
      console.log("CleanSync Realtime status:", status);
    });

  return cleanSyncRealtimeChannel;

}
window.startRealtime = startRealtime;


/* ============================================================
   25. STOP REALTIME
============================================================ */

function stopRealtime() {
  if (!sb || !cleanSyncRealtimeChannel) return;
  try { sb.removeChannel(cleanSyncRealtimeChannel); } catch {}
  cleanSyncRealtimeChannel = null;
}
window.stopRealtime = stopRealtime;


/* ============================================================
   26. INSTALL / NOTIFICATION BANNER
============================================================ */

function setupInstallAndNotifyBanner() {

  let deferredPrompt = null;

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredPrompt = event;
    window.__cleanSyncInstallPrompt = deferredPrompt;
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.__cleanSyncInstallPrompt = null;
  });

}
window.setupInstallAndNotifyBanner = setupInstallAndNotifyBanner;


/* ============================================================
   27. SERVICE WORKER
============================================================ */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("service-worker.js")
      .then(registration => {
        console.log("CleanSync Service Worker:", registration.scope);
      })
      .catch(error => {
        console.warn("Service Worker:", error);
      });
  });
}


/* ============================================================
   28. CLEANUP
============================================================ */

window.addEventListener("beforeunload", () => {

  if (cleanSyncRealtimeChannel && sb) {
    try { sb.removeChannel(cleanSyncRealtimeChannel); } catch {}
  }

  if (window.__cleanSyncTimerInterval) {
    clearInterval(window.__cleanSyncTimerInterval);
  }

});


/* ============================================================
   29. DEBUG
============================================================ */

console.log("%cCleanSync App Common carregado (Opção B — login customizado)", "font-weight:bold");
console.log("Chat:", "chat.html?task=ID");
console.log("Tabela de conversas:", "conversations.task_id");
console.log("Tabela de mensagens:", "messages.conversation_id");
console.log("Sessão local:", CLEANSYNC_SESSION_KEY);
