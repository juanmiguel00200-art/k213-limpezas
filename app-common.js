/* ============================================================
   CLEANSYNC
   APP-COMMON.JS
   VERSÃO DEFINITIVA

   Compatível com:
   - cliente.html
   - profissional.html
   - admin.html
   - chat.html
   - relatorios.html

   Funções principais:
   - Supabase
   - autenticação
   - permissões
   - sessão
   - realtime
   - cards de tarefas
   - checklist
   - cronômetro
   - fotos
   - chat
   - snackbar
============================================================ */


/* ============================================================
   1. CONFIGURAÇÃO SUPABASE
============================================================ */

const SUPABASE_URL =
  'https://oyxmrrazgjdnyzhyinhc.supabase.co';

const SUPABASE_ANON_KEY =
'sb_publishable_IVWPCoIWVhkvP_u7J0ZTsA_QeK-MNNI';


/*
   Evita criar duas instâncias do Supabase
*/

let sb = null;

try {

  if (
    typeof window !== 'undefined' &&
    window.supabase
  ) {

    sb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

  }

} catch (error) {

  console.error(
    'Erro ao inicializar Supabase:',
    error
  );

}


/*
   Disponibiliza a URL globalmente.
   O profissional.html usa window.SUPABASE_URL
   para chamar a Edge Function.
*/

window.SUPABASE_URL = SUPABASE_URL;


/* ============================================================
   2. PREÇOS
============================================================ */

const PRICE_BASE = 40;
const PRICE_WITH_LAUNDRY = 50;


/* ============================================================
   3. ESTADO GLOBAL
============================================================ */

let realtimeChannel = null;

let currentSession = null;

let currentAuthUser = null;


/* ============================================================
   4. UTILITÁRIOS
============================================================ */


/*
   Debounce
*/

function debounce(
  fn,
  delay = 300
) {

  let timer = null;

  return function(...args) {

    clearTimeout(timer);

    timer = setTimeout(
      () => fn.apply(this, args),
      delay
    );

  };

}


/*
   Escape HTML
*/

function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }

  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

}


/*
   Escape para atributo HTML
*/

function escapeAttr(value) {

  return escapeHtml(value);

}


/*
   Formata data
*/

function formatDate(dateValue) {

  if (!dateValue) {
    return '—';
  }

  const date =
    new Date(
      dateValue + (
        dateValue.length === 10
          ? 'T00:00:00'
          : ''
      )
    );

  if (Number.isNaN(date.getTime())) {
    return dateValue;
  }

  return date.toLocaleDateString(
    'pt-BR'
  );

}


/*
   Formata data e hora
*/

function formatDateTime(value) {

  if (!value) {
    return '—';
  }

  const date =
    new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString(
    'pt-BR',
    {
      dateStyle: 'short',
      timeStyle: 'short'
    }
  );

}


/*
   Formata moeda CHF
*/

function formatCHF(value) {

  const number =
    Number(value || 0);

  return number.toLocaleString(
    'pt-BR',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  ) + ' CHF';

}


/* ============================================================
   5. SNACKBAR
============================================================ */

function showSnackbar(message) {

  const snackbar =
    document.getElementById(
      'snackbar'
    );

  if (!snackbar) {

    console.log(message);

    return;

  }

  snackbar.textContent =
    message;

  snackbar.classList.add(
    'show'
  );

  clearTimeout(
    snackbar._timer
  );

  snackbar._timer =
    setTimeout(
      () => {

        snackbar.classList.remove(
          'show'
        );

      },
      3500
    );

}


/* ============================================================
   6. SESSÃO
============================================================ */

function getSession() {

  try {

    const raw =
      sessionStorage.getItem(
        'cleansync_session'
      );

    if (!raw) {

      return {
        address: ''
      };

    }

    return JSON.parse(raw);

  } catch {

    return {
      address: ''
    };

  }

}


/*
   Salva informações extras da sessão
*/

function setSession(data) {

  try {

    const current =
      getSession();

    const merged = {
      ...current,
      ...data
    };

    sessionStorage.setItem(
      'cleansync_session',
      JSON.stringify(merged)
    );

  } catch (error) {

    console.error(
      'Erro ao salvar sessão:',
      error
    );

  }

}


/* ============================================================
   7. USUÁRIO AUTENTICADO
============================================================ */

async function getCurrentUser() {

  if (!sb) {

    console.error(
      'Supabase não inicializado.'
    );

    return null;

  }

  const {
    data,
    error
  } = await sb.auth.getUser();

  if (error) {

    console.error(
      'Erro ao obter usuário:',
      error
    );

    return null;

  }

  return data.user || null;

}


/* ============================================================
   8. PERFIL
============================================================ */

async function getCurrentProfile(
  userId
) {

  if (!userId) {
    return null;
  }

  const {
    data,
    error
  } = await sb
    .from('profiles')
    .select('*')
    .eq(
      'id',
      userId
    )
    .single();

  if (error) {

    console.error(
      'Erro ao carregar perfil:',
      error
    );

    return null;

  }

  return data;

}


/* ============================================================
   9. REQUIRE ROLE
============================================================ */

async function requireRole(
  requiredRole = null
) {

  try {

    if (!sb) {

      alert(
        'Supabase não foi configurado no app-common.js.'
      );

      return null;

    }


    /*
       Obtém sessão
    */

    const {
      data: sessionData,
      error: sessionError
    } =
      await sb.auth.getSession();


    if (
      sessionError ||
      !sessionData ||
      !sessionData.session
    ) {

      window.location.href =
        'index.html';

      return null;

    }


    const session =
      sessionData.session;

    currentSession =
      session;


    const user =
      session.user;

    currentAuthUser =
      user;


    /*
       Perfil
    */

    const profile =
      await getCurrentProfile(
        user.id
      );


    if (!profile) {

      alert(
        'Seu perfil não foi encontrado.'
      );

      await sb.auth.signOut();

      window.location.href =
        'index.html';

      return null;

    }


    /*
       Nome
    */

    const profileName =
      profile.full_name ||
      profile.name ||
      user.user_metadata?.full_name ||
      user.email ||
      'Usuário';


    profile.full_name =
      profileName;


    if (!profile.name) {

      profile.name =
        profileName;

    }


    /*
       Preenche nome do topo
    */

    const topWhoName =
      document.getElementById(
        'topWhoName'
      );

    if (topWhoName) {

      topWhoName.textContent =
        profileName;

    }


    /*
       Permissão
    */

    if (requiredRole) {

      const role =
        profile.role;


      /*
         Admin possui acesso
         ao painel profissional
      */

      const allowed =
        role === requiredRole ||
        (
          requiredRole === 'profissional' &&
          role === 'admin'
        );


      if (!allowed) {

        if (role === 'cliente') {

          window.location.href =
            'cliente.html';

        }

        else if (
          role === 'profissional' ||
          role === 'admin'
        ) {

          window.location.href =
            'profissional.html';

        }

        else {

          await sb.auth.signOut();

          window.location.href =
            'index.html';

        }

        return null;

      }

    }


    /*
       Salva sessão local
    */

    setSession({

      user_id:
        user.id,

      email:
        user.email,

      role:
        profile.role,

      name:
        profileName

    });


    return {

      user,
      profile,
      session

    };

  } catch (error) {

    console.error(
      'requireRole:',
      error
    );

    window.location.href =
      'index.html';

    return null;

  }

}


/* ============================================================
   10. LOGOUT
============================================================ */

async function logout() {

  try {

    if (sb) {

      await sb.auth.signOut();

    }

  } catch (error) {

    console.error(
      'Erro ao sair:',
      error
    );

  }


  try {

    sessionStorage.removeItem(
      'cleansync_session'
    );

  } catch {}


  window.location.href =
    'index.html';

}


/* ============================================================
   11. CHECKLIST PADRÃO
============================================================ */

async function getDefaultChecklist() {

  /*
     Primeiro tenta buscar do banco.
  */

  try {

    const {
      data,
      error
    } = await sb
      .from('default_checklist')
      .select('items')
      .eq(
        'id',
        1
      )
      .single();


    if (
      !error &&
      data &&
      Array.isArray(data.items)
    ) {

      return data.items;

    }

  } catch (error) {

    console.warn(
      'Não foi possível carregar checklist do banco:',
      error
    );

  }


  /*
     Fallback.
     Caso a tabela ainda não exista
     ou esteja vazia.
  */

  return [

    {
      id: 'bathroom',
      label: 'Limpar banheiro'
    },

    {
      id: 'bedroom',
      label: 'Organizar quartos'
    },

    {
      id: 'kitchen',
      label: 'Limpar cozinha'
    },

    {
      id: 'living',
      label: 'Limpar sala'
    },

    {
      id: 'floors',
      label: 'Limpar pisos'
    },

    {
      id: 'trash',
      label: 'Retirar lixo'
    },

    {
      id: 'laundry',
      label: 'Lavagem de roupa'
    }

  ];

}


/* ============================================================
   12. CHECKLIST DA TAREFA
============================================================ */

function normalizeChecklist(
  checklist
) {

  if (!Array.isArray(checklist)) {

    return [];

  }

  return checklist.map(
    (item, index) => ({

      id:
        item.id ||
        `item_${index}`,

      label:
        item.label ||
        'Tarefa',

      done:
        Boolean(
          item.done
        )

    })
  );

}


/* ============================================================
   13. STATUS
============================================================ */

function getStatusLabel(
  status
) {

  switch (status) {

    case 'pending':
      return 'Pendente';

    case 'in-progress':
      return 'Em andamento';

    case 'completed':
      return 'Concluída';

    case 'cancelled':
      return 'Cancelada';

    default:
      return status || 'Desconhecido';

  }

}


function getStatusClass(
  status
) {

  switch (status) {

    case 'pending':
      return 'status-pending';

    case 'in-progress':
      return 'status-progress';

    case 'completed':
      return 'status-completed';

    case 'cancelled':
      return 'status-cancelled';

    default:
      return '';

  }

}


/* ============================================================
   14. CHECKLIST HTML
============================================================ */

function renderChecklist(
  task
) {

  const checklist =
    normalizeChecklist(
      task.checklist
    );


  if (!checklist.length) {

    return `
      <div class="checklist">
        <div class="checklist-progress">
          Sem checklist
        </div>
      </div>
    `;

  }


  const doneCount =
    checklist.filter(
      item => item.done
    ).length;


  return `

    <div class="checklist">

      <div class="checklist-head">

        <strong>
          Checklist
        </strong>

        <span class="checklist-progress">
          ${doneCount} / ${checklist.length} concluídos
        </span>

      </div>


      <div class="checklist-list">

        ${checklist.map(item => {

          const id =
            escapeAttr(
              item.id
            );

          const label =
            escapeHtml(
              item.label
            );

          return `

            <label
              class="checklist-item ${item.done ? 'done' : ''}"
            >

              <input
                type="checkbox"
                id="ck_${id}_${task.id}"
                ${item.done ? 'checked' : ''}
                onchange="
                  if (
                    typeof toggleChecklistItem === 'function'
                  ) {
                    toggleChecklistItem(
                      '${id}',
                      '${escapeAttr(task.id)}'
                    );
                  }
                "
              >

              <span>
                ${label}
              </span>

            </label>

          `;

        }).join('')}

      </div>

    </div>

  `;

}


/* ============================================================
   15. TIMER
============================================================ */

function calculateElapsed(
  start,
  end = null
) {

  if (!start) {
    return 0;
  }

  const startDate =
    new Date(start);

  if (
    Number.isNaN(
      startDate.getTime()
    )
  ) {

    return 0;

  }

  const endDate =
    end
      ? new Date(end)
      : new Date();

  const seconds =
    Math.max(
      0,
      Math.floor(
        (
          endDate.getTime() -
          startDate.getTime()
        ) / 1000
      )
    );

  return seconds;

}


function formatElapsed(
  seconds
) {

  seconds =
    Math.max(
      0,
      Number(seconds || 0)
    );


  const hours =
    Math.floor(
      seconds / 3600
    );


  const minutes =
    Math.floor(
      (
        seconds % 3600
      ) / 60
    );


  const secs =
    seconds % 60;


  return [
    String(hours).padStart(
      2,
      '0'
    ),

    String(minutes).padStart(
      2,
      '0'
    ),

    String(secs).padStart(
      2,
      '0'
    )

  ].join(':');

}


/* ============================================================
   16. TIMER VISUAL
============================================================ */

function updateTimerElement(
  task
) {

  const timer =
    document.querySelector(
      `[data-timer-id="${task.id}"]`
    );


  if (!timer) {
    return;
  }


  if (!task.work_start) {

    timer.textContent =
      '00:00:00';

    return;

  }


  const elapsed =
    calculateElapsed(
      task.work_start,
      task.work_end
    );


  timer.textContent =
    formatElapsed(
      elapsed
    );

}


/* ============================================================
   17. ATTACH TIMERS
============================================================ */

function attachTimers(
  tasks
) {

  if (!Array.isArray(tasks)) {
    return;
  }


  tasks.forEach(
    task => {

      updateTimerElement(
        task
      );

    }
  );


  /*
     Um único intervalo global.
  */

  if (
    window.__cleanSyncTimerInterval
  ) {

    clearInterval(
      window.__cleanSyncTimerInterval
    );

  }


  window.__cleanSyncTimerInterval =
    setInterval(
      () => {

        tasks.forEach(
          task => {

            if (
              task.work_start &&
              !task.work_end
            ) {

              updateTimerElement(
                task
              );

            }

          }
        );

      },
      1000
    );

}


/* ============================================================
   18. BOTÃO DE CHAT
============================================================ */

function chatButton(
  task
) {

  if (!task || !task.id) {
    return '';
  }


  return `

    <button
      type="button"
      class="btn btn-outline task-chat-btn"
      onclick="
        window.location.href =
          'chat.html?task=${encodeURIComponent(task.id)}'
      "
    >
      💬 Chat
    </button>

  `;

}


/* ============================================================
   19. RENDER TASK CARD
============================================================ */

function renderTaskCard(
  task,
  mode = 'client'
) {

  if (!task) {
    return '';
  }


  const checklist =
    normalizeChecklist(
      task.checklist
    );


  const doneCount =
    checklist.filter(
      item => item.done
    ).length;


  const totalCount =
    checklist.length;


  const status =
    task.status || 'pending';


  const statusLabel =
    getStatusLabel(
      status
    );


  const statusClass =
    getStatusClass(
      status
    );


  const price =
    Number(
      task.price || (
        task.laundry_service
          ? PRICE_WITH_LAUNDRY
          : PRICE_BASE
      )
    );


  const taskId =
    escapeAttr(
      task.id
    );


  const refCode =
    escapeHtml(
      task.ref_code ||
      'SEM REFERÊNCIA'
    );


  const clientName =
    escapeHtml(
      task.client_name ||
      'Cliente'
    );


  const address =
    escapeHtml(
      task.address ||
      'Endereço não informado'
    );


  const date =
    escapeHtml(
      formatDate(
        task.date
      )
    );


  const time =
    escapeHtml(
      task.time ||
      '—'
    );


  const notes =
    escapeHtml(
      task.notes ||
      ''
    );


  const duration =
    task.stay_duration ||
    '—';


  const guests =
    task.guest_count ||
    '—';


  /*
     Admin
  */

  const isAdmin =
    mode === 'admin';


  /*
     Cliente
  */

  const isClient =
    mode === 'client';


  /*
     Profissional
  */

  const isCleaner =
    mode === 'cleaner';


  let actions =
    '';


  /*
     ==========================================================
     CLIENTE
     ==========================================================
  */

  if (isClient) {

    actions += chatButton(
      task
    );


    if (
      status === 'pending'
    ) {

      actions += `

        <button
          type="button"
          class="btn btn-outline"
          onclick="
            toggleEditForm(
              '${taskId}'
            )
          "
        >
          ✏️ Editar
        </button>

        <button
          type="button"
          class="btn btn-danger"
          onclick="
            cancelRequest(
              '${taskId}'
            )
          "
        >
          🗑️ Cancelar
        </button>

      `;

    }

  }


  /*
     ==========================================================
     PROFISSIONAL
     ==========================================================
  */

  if (isCleaner) {

    actions += chatButton(
      task
    );


    if (
      status === 'pending'
    ) {

      actions += `

        <button
          type="button"
          class="btn btn-accent"
          onclick="
            startTimer(
              '${taskId}'
            )
          "
        >
          ▶️ Iniciar trabalho
        </button>

      `;

    }


    if (
      status === 'in-progress'
    ) {

      actions += `

        <button
          type="button"
          class="btn btn-outline"
          onclick="
            stopTimer(
              '${taskId}'
            )
          "
        >
          ⏹️ Finalizar trabalho
        </button>

        <button
          type="button"
          class="btn btn-accent"
          onclick="
            completeTask(
              '${taskId}'
            )
          "
        >
          ✅ Concluir
        </button>

      `;

    }


    if (
      status !== 'completed'
    ) {

      actions += `

        <label
          class="btn btn-outline"
          style="cursor:pointer;"
        >
          📸 Fotos

          <input
            type="file"
            accept="image/*"
            multiple
            style="display:none;"
            onchange="
              uploadPhotos(
                '${taskId}',
                this
              )
            "
          >

        </label>

      `;

    }

  }


  /*
     ==========================================================
     ADMIN
     ==========================================================
  */

  if (isAdmin) {

    actions += chatButton(
      task
    );


    actions += `

      <button
        type="button"
        class="btn btn-outline"
        onclick="
          adminEditPrice(
            '${taskId}',
            ${price}
          )
        "
      >
        💰 Valor
      </button>

      <button
        type="button"
        class="btn btn-danger"
        onclick="
          adminDeleteTask(
            '${taskId}'
          )
        "
      >
        🗑️ Excluir
      </button>

    `;

  }


  /*
     Fotos
  */

  let photosHtml =
    '';


  if (
    Array.isArray(
      task.photos
    ) &&
    task.photos.length
  ) {

    photosHtml = `

      <div class="task-photos">

        ${task.photos.map(
          photo => `

            <a
              href="${escapeAttr(photo)}"
              target="_blank"
              rel="noopener"
            >

              <img
                src="${escapeAttr(photo)}"
                alt="Foto da limpeza"
                loading="lazy"
              >

            </a>

          `
        ).join('')}

      </div>

    `;

  }


  /*
     Tempo
  */

  const timerHtml =
    task.work_start

      ? `

        <div class="task-timer">

          <span>
            ⏱️ Tempo
          </span>

          <strong
            data-timer-id="${taskId}"
          >
            ${formatElapsed(
              calculateElapsed(
                task.work_start,
                task.work_end
              )
            )}
          </strong>

        </div>

      `

      : '';


  /*
     Observações
  */

  const notesHtml =
    notes

      ? `

        <div class="task-notes">

          <strong>
            Observações
          </strong>

          <div>
            ${notes}
          </div>

        </div>

      `

      : '';


  /*
     Formulário de edição
     usado pelo cliente
  */

  const editForm =
    isClient &&
    status === 'pending'

      ? `

        <div
          id="editForm_${taskId}"
          class="task-edit-form"
          style="display:none;"
        >

          <div class="field-row">

            <div class="field">

              <label>
                Nova data
              </label>

              <input
                type="date"
                id="editDate_${taskId}"
                value="${escapeAttr(
                  task.date || ''
                )}"
              >

            </div>


            <div class="field">

              <label>
                Novo horário
              </label>

              <input
                type="time"
                id="editTime_${taskId}"
                value="${escapeAttr(
                  task.time || ''
                )}"
              >

            </div>

          </div>


          <button
            type="button"
            class="btn btn-accent"
            onclick="
              saveEditRequest(
                '${taskId}'
              )
            "
          >
            💾 Salvar alterações
          </button>

        </div>

      `

      : '';


  /*
     Card final
  */

  return `

    <article
      class="task"
      data-task-id="${taskId}"
    >

      <div class="task-head">

        <div>

          <div class="task-ref">
            ${refCode}
          </div>

          <h3>
            ${clientName}
          </h3>

        </div>


        <span
          class="status ${statusClass}"
        >
          ${statusLabel}
        </span>

      </div>


      <div class="task-grid">

        <div class="task-info">

          <span>
            📅
            <strong>
              Data
            </strong>
          </span>

          <b>
            ${date}
          </b>

        </div>


        <div class="task-info">

          <span>
            🕐
            <strong>
              Horário
            </strong>
          </span>

          <b>
            ${time}
          </b>

        </div>


        <div class="task-info">

          <span>
            📍
            <strong>
              Endereço
            </strong>
          </span>

          <b>
            ${address}
          </b>

        </div>


        <div class="task-info">

          <span>
            👥
            <strong>
              Hóspedes
            </strong>
          </span>

          <b>
            ${guests}
          </b>

        </div>


        <div class="task-info">

          <span>
            🏠
            <strong>
              Estadia
            </strong>
          </span>

          <b>
            ${duration} dias
          </b>

        </div>


        <div class="task-info">

          <span>
            💰
            <strong>
              Valor
            </strong>
          </span>

          <b>
            ${formatCHF(price)}
          </b>

        </div>

      </div>


      ${
        task.laundry_service
          ? `
            <div class="laundry-badge">
              🧺 Lavagem de roupa incluída
            </div>
          `
          : ''
      }


      ${
        totalCount
          ? renderChecklist(task)
          : ''
      }


      ${timerHtml}


      ${notesHtml}


      ${photosHtml}


      ${
        actions
          ? `
            <div class="task-actions">
              ${actions}
            </div>
          `
          : ''
      }


      ${editForm}

    </article>

  `;

}


/* ============================================================
   20. ADMIN — ALTERAR VALOR
============================================================ */

async function adminEditPrice(
  id,
  currentPrice
) {

  const value =
    prompt(
      'Digite o novo valor em CHF:',
      currentPrice
    );


  if (
    value === null
  ) {

    return;

  }


  const price =
    Number(
      String(value)
        .replace(',', '.')
    );


  if (
    !Number.isFinite(price) ||
    price < 0
  ) {

    alert(
      'Digite um valor válido.'
    );

    return;

  }


  const {
    error
  } = await sb
    .from('cleaning_requests')
    .update({
      price
    })
    .eq(
      'id',
      id
    );


  if (error) {

    alert(
      'Erro ao alterar valor: ' +
      error.message
    );

    return;

  }


  showSnackbar(
    '💰 Valor atualizado!'
  );


  if (
    typeof loadCleanerTasks ===
    'function'
  ) {

    loadCleanerTasks();

  }

}


/* ============================================================
   21. ADMIN — EXCLUIR TAREFA
============================================================ */

async function adminDeleteTask(
  id
) {

  const confirmed =
    confirm(
      'Tem certeza que deseja excluir esta tarefa?\n\n' +
      'Esta ação não poderá ser desfeita.'
    );


  if (!confirmed) {
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


  if (error) {

    alert(
      'Erro ao excluir tarefa: ' +
      error.message
    );

    return;

  }


  showSnackbar(
    '🗑️ Tarefa excluída.'
  );


  if (
    typeof loadCleanerTasks ===
    'function'
  ) {

    loadCleanerTasks();

  }

}


/* ============================================================
   22. REALTIME
============================================================ */

function startRealtime(
  callback
) {

  if (!sb) {

    console.error(
      'Supabase não inicializado.'
    );

    return null;

  }


  /*
     Remove canal anterior
  */

  if (realtimeChannel) {

    try {

      sb.removeChannel(
        realtimeChannel
      );

    } catch {}

  }


  const channelName =
    'cleansync-realtime-' +
    Date.now();


  realtimeChannel =
    sb
      .channel(
        channelName
      )


      .on(

        'postgres_changes',

        {
          event: '*',
          schema: 'public',
          table: 'cleaning_requests'
        },

        payload => {

          console.log(
            'Realtime cleaning_requests:',
            payload
          );


          if (
            typeof callback ===
            'function'
          ) {

            callback(
              payload
            );

          }

        }

      )


      .on(

        'postgres_changes',

        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },

        payload => {

          console.log(
            'Realtime messages:',
            payload
          );

        }

      )


      .subscribe(
        status => {

          console.log(
            'CleanSync realtime:',
            status
          );

        }
      );


  return realtimeChannel;

}


/* ============================================================
   23. SERVICE WORKER / INSTALAÇÃO
============================================================ */

function setupInstallAndNotifyBanner() {

  /*
     Não força instalação.
     Apenas prepara o evento PWA.
  */

  window.__deferredInstallPrompt =
    null;


  window.addEventListener(
    'beforeinstallprompt',
    event => {

      event.preventDefault();

      window.__deferredInstallPrompt =
        event;

      console.log(
        'PWA disponível para instalação.'
      );

    }
  );

}


/*
   Instalar PWA manualmente
*/

async function installApp() {

  const promptEvent =
    window.__deferredInstallPrompt;


  if (!promptEvent) {

    showSnackbar(
      'A instalação não está disponível agora.'
    );

    return;

  }


  promptEvent.prompt();


  const result =
    await promptEvent.userChoice;


  console.log(
    'Instalação:',
    result
  );


  window.__deferredInstallPrompt =
    null;

}


/* ============================================================
   24. LIMPEZA AO SAIR
============================================================ */

window.addEventListener(
  'beforeunload',
  () => {

    if (
      realtimeChannel &&
      sb
    ) {

      try {

        sb.removeChannel(
          realtimeChannel
        );

      } catch {}

    }


    if (
      window.__cleanSyncTimerInterval
    ) {

      clearInterval(
        window.__cleanSyncTimerInterval
      );

    }

  }
);


/* ============================================================
   25. DEBUG
============================================================ */

console.log(
  '%cCleanSync App Common carregado',
  'font-weight:bold;'
);

console.log(
  'Supabase:',
  Boolean(sb)
);

console.log(
  'Versão:',
  '10.0'
);