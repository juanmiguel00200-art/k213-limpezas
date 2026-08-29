/* ============================================================
   CLEANSYNC — APP COMMON
   VERSÃO DEFINITIVA
   ============================================================

   Compatível com:

   cliente.html
   profissional.html
   admin.html
   chat.html

   Supabase:
   cleaning_requests
   conversations
   messages
   default_checklist
   profiles

   Conversations:
   id
   task_id
   client_id
   professional_id
   created_at
   updated_at

   Messages:
   id
   conversation_id
   sender_id
   content
   created_at

   IMPORTANTE:
   - O relacionamento do chat usa conversations.task_id
   - NÃO usa cleaning_id
   - NÃO usa cleaning_request_id
============================================================ */


/* ============================================================
   SUPABASE
============================================================ */

const SUPABASE_URL =
  window.SUPABASE_URL ||
  'COLOQUE_AQUI_SUA_SUPABASE_URL';

const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY ||
  'COLOQUE_AQUI_SUA_SUPABASE_ANON_KEY';


if (!window.supabase) {

  console.error(
    'Supabase JS não foi carregado.'
  );

}


let sb = null;


try {

  if (
    window.supabase &&
    typeof window.supabase.createClient === 'function'
  ) {

    sb = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    );

  }

}
catch (error) {

  console.error(
    'Erro ao inicializar Supabase:',
    error
  );

}


/* ============================================================
   CONFIGURAÇÕES
============================================================ */

const PRICE_BASE = 40;

const PRICE_WITH_LAUNDRY = 50;

const CLEANING_PHOTOS_BUCKET =
  'cleaning-photos';


/* ============================================================
   ESTADO GLOBAL
============================================================ */

window.CleanSync =
  window.CleanSync || {};

window.CleanSync.supabase =
  sb;


/* ============================================================
   HELPERS
============================================================ */

function debounce(
  fn,
  delay = 300
) {

  let timer = null;

  return function (...args) {

    clearTimeout(timer);

    timer = setTimeout(
      () => fn.apply(this, args),
      delay
    );

  };

}


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


function escapeAttr(value) {

  return escapeHtml(value);

}


function formatDate(value) {

  if (!value) {

    return '—';

  }

  const raw =
    String(value);

  const date =
    new Date(
      raw.length === 10
        ? raw + 'T00:00:00'
        : raw
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return escapeHtml(
      raw
    );

  }

  return date.toLocaleDateString(
    'pt-BR'
  );

}


function formatTime(value) {

  if (!value) {

    return '—';

  }

  return String(value)
    .slice(0, 5);

}


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
   SNACKBAR
============================================================ */

let snackbarTimer = null;


function showSnackbar(
  message,
  duration = 3200
) {

  const snackbar =
    document.getElementById(
      'snackbar'
    );

  if (!snackbar) {

    console.log(
      message
    );

    return;

  }

  snackbar.textContent =
    message;

  snackbar.classList.add(
    'show'
  );

  clearTimeout(
    snackbarTimer
  );

  snackbarTimer =
    setTimeout(
      () => {

        snackbar.classList.remove(
          'show'
        );

      },
      duration
    );

}


/* ============================================================
   SESSÃO
============================================================ */

function getSession() {

  try {

    const raw =
      sessionStorage.getItem(
        'cleansync_session'
      );

    if (raw) {

      return JSON.parse(
        raw
      );

    }

  }
  catch (error) {

    console.warn(
      'Erro ao ler sessão:',
      error
    );

  }

  return {};

}


function saveSession(data) {

  try {

    sessionStorage.setItem(
      'cleansync_session',
      JSON.stringify(
        data || {}
      )
    );

  }
  catch (error) {

    console.warn(
      'Não foi possível salvar sessão:',
      error
    );

  }

}


function clearSession() {

  try {

    sessionStorage.removeItem(
      'cleansync_session'
    );

  }
  catch (error) {

    console.warn(
      'Erro ao limpar sessão:',
      error
    );

  }

}


/* ============================================================
   PERFIL
============================================================ */

async function getCurrentProfile(
  userId
) {

  if (!sb || !userId) {

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
    .maybeSingle();

  if (error) {

    console.error(
      'Erro ao buscar perfil:',
      error
    );

    return null;

  }

  return data || null;

}


function getProfileName(
  profile,
  user
) {

  if (profile) {

    return (
      profile.full_name ||
      profile.name ||
      profile.display_name ||
      profile.username ||
      ''
    );

  }

  return (
    user?.email ||
    ''
  );

}


/* ============================================================
   AUTENTICAÇÃO
============================================================ */

async function requireRole(
  requiredRole = null
) {

  if (!sb) {

    showSnackbar(
      'Erro: Supabase não configurado.'
    );

    return null;

  }

  const {
    data,
    error
  } = await sb.auth.getSession();

  if (
    error ||
    !data ||
    !data.session
  ) {

    window.location.href =
      'index.html';

    return null;

  }

  const user =
    data.session.user;

  const profile =
    await getCurrentProfile(
      user.id
    );

  if (!profile) {

    console.error(
      'Perfil não encontrado.'
    );

    showSnackbar(
      'Perfil do usuário não encontrado.'
    );

    await sb.auth.signOut();

    window.location.href =
      'index.html';

    return null;

  }

  const role =
    profile.role;

  let authorized = true;

  if (requiredRole) {

    if (
      requiredRole === 'profissional'
    ) {

      authorized =
        role === 'profissional' ||
        role === 'admin';

    }
    else if (
      requiredRole === 'cliente'
    ) {

      authorized =
        role === 'cliente';

    }
    else if (
      requiredRole === 'admin'
    ) {

      authorized =
        role === 'admin';

    }
    else {

      authorized =
        role === requiredRole;

    }

  }

  if (!authorized) {

    if (
      role === 'cliente'
    ) {

      window.location.href =
        'cliente.html';

    }
    else if (
      role === 'profissional'
    ) {

      window.location.href =
        'profissional.html';

    }
    else if (
      role === 'admin'
    ) {

      /*
       * Admin pode acessar páginas
       * administrativas/profissionais.
       */

      if (
        requiredRole === 'cliente'
      ) {

        window.location.href =
          'profissional.html';

      }
      else {

        window.location.href =
          'admin.html';

      }

    }
    else {

      window.location.href =
        'index.html';

    }

    return null;

  }

  saveSession({

    user_id:
      user.id,

    email:
      user.email,

    role:
      role,

    name:
      getProfileName(
        profile,
        user
      ),

    address:
      profile.address ||
      ''

  });

  const topName =
    document.getElementById(
      'topWhoName'
    );

  if (topName) {

    topName.textContent =
      getProfileName(
        profile,
        user
      ) ||
      user.email ||
      '';

  }

  const adminLink =
    document.getElementById(
      'navAdminLink'
    );

  if (adminLink) {

    adminLink.style.display =
      role === 'admin'
        ? ''
        : 'none';

  }

  return {

    user,
    profile

  };

}


/* ============================================================
   USUÁRIO ATUAL
============================================================ */

async function getCurrentUser() {

  if (!sb) {

    return null;

  }

  try {

    const {
      data,
      error
    } = await sb.auth.getUser();

    if (
      error ||
      !data?.user
    ) {

      return null;

    }

    return data.user;

  }
  catch (error) {

    console.warn(
      'Erro ao obter usuário:',
      error
    );

    return null;

  }

}


/* ============================================================
   LOGOUT
============================================================ */

async function logout() {

  try {

    if (sb) {

      await sb.auth.signOut();

    }

  }
  catch (error) {

    console.error(
      'Erro ao sair:',
      error
    );

  }

  clearSession();

  window.location.href =
    'index.html';

}


/* ============================================================
   CHECKLIST PADRÃO
============================================================ */

const FALLBACK_CHECKLIST = [

  {
    id: 'entrance',
    label: 'Verificar entrada e acesso'
  },

  {
    id: 'living',
    label: 'Limpar sala e áreas comuns'
  },

  {
    id: 'kitchen',
    label: 'Limpar cozinha'
  },

  {
    id: 'bathroom',
    label: 'Limpar banheiro'
  },

  {
    id: 'bedrooms',
    label: 'Organizar quartos'
  },

  {
    id: 'floor',
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


async function getDefaultChecklist() {

  if (!sb) {

    return FALLBACK_CHECKLIST.map(
      item => ({
        ...item
      })
    );

  }

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
      .maybeSingle();

    if (
      !error &&
      data &&
      Array.isArray(
        data.items
      )
    ) {

      return data.items;

    }

  }
  catch (error) {

    console.warn(
      'Erro no checklist padrão:',
      error
    );

  }

  return FALLBACK_CHECKLIST.map(
    item => ({
      ...item
    })
  );

}


/* ============================================================
   STATUS
============================================================ */

function getStatusLabel(
  status
) {

  const labels = {

    pending:
      'Pendente',

    'in-progress':
      'Em andamento',

    completed:
      'Concluída',

    cancelled:
      'Cancelada'

  };

  return (
    labels[status] ||
    status ||
    'Pendente'
  );

}


function getStatusClass(
  status
) {

  if (
    status === 'completed'
  ) {

    return 'completed';

  }

  if (
    status === 'in-progress'
  ) {

    return 'in-progress';

  }

  if (
    status === 'cancelled'
  ) {

    return 'cancelled';

  }

  return 'pending';

}


/* ============================================================
   CHECKLIST HELPERS
============================================================ */

function normalizeChecklist(
  checklist
) {

  if (
    !Array.isArray(
      checklist
    )
  ) {

    return [];

  }

  return checklist.map(
    (item, index) => ({

      id:
        item?.id ||
        `item_${index}`,

      label:
        item?.label ||
        item?.name ||
        `Tarefa ${index + 1}`,

      done:
        Boolean(
          item?.done
        )

    })
  );

}


function getChecklistProgress(
  checklist
) {

  const items =
    normalizeChecklist(
      checklist
    );

  const total =
    items.length;

  const done =
    items.filter(
      item => item.done
    ).length;

  return {

    total,
    done,

    percent:
      total
        ? Math.round(
            done / total * 100
          )
        : 0

  };

}


/* ============================================================
   RENDER TASK CARD
============================================================ */

function renderTaskCard(
  task,
  mode = 'client'
) {

  if (!task) {

    return '';

  }

  const status =
    task.status ||
    'pending';

  const statusLabel =
    getStatusLabel(
      status
    );

  const statusClass =
    getStatusClass(
      status
    );

  const checklist =
    normalizeChecklist(
      task.checklist
    );

  const progress =
    getChecklistProgress(
      checklist
    );

  const isAdmin =
    mode === 'admin';

  const isCleaner =
    mode === 'cleaner' ||
    mode === 'professional' ||
    mode === 'profissional';

  const isClient =
    mode === 'client' ||
    mode === 'cliente';

  const photos =
    Array.isArray(
      task.photos
    )
      ? task.photos
      : [];

  const refCode =
    task.ref_code ||
    'LIMPEZA';

  const clientName =
    task.client_name ||
    'Cliente';

  const professionalName =
    task.professional_name ||
    '';

  const price =
    task.price !== null &&
    task.price !== undefined
      ? task.price
      : (
          task.laundry_service
            ? PRICE_WITH_LAUNDRY
            : PRICE_BASE
        );

  return `

    <div
      class="task card"
      data-task-id="${escapeAttr(task.id)}"
    >

      <div class="task-head">

        <div>

          <div class="task-ref">
            ${escapeHtml(refCode)}
          </div>

          <h3 class="task-title">
            ${escapeHtml(
              task.address ||
              'Endereço não informado'
            )}
          </h3>

        </div>

        <span
          class="status status-${escapeAttr(statusClass)}"
        >
          ${escapeHtml(statusLabel)}
        </span>

      </div>


      <div class="task-meta">

        <div>
          <strong>📅 Data</strong>
          <span>
            ${escapeHtml(
              formatDate(task.date)
            )}
          </span>
        </div>

        <div>
          <strong>🕐 Horário</strong>
          <span>
            ${escapeHtml(
              formatTime(task.time)
            )}
          </span>
        </div>

        <div>
          <strong>💰 Valor</strong>
          <span>
            ${escapeHtml(
              formatCHF(price)
            )}
          </span>
        </div>

        <div>
          <strong>👥 Hóspedes</strong>
          <span>
            ${escapeHtml(
              task.guest_count || '—'
            )}
          </span>
        </div>

      </div>


      <div class="task-info">

        ${
          task.stay_duration
            ? `
              <span>
                🏠 Estadia:
                ${escapeHtml(
                  task.stay_duration
                )} dias
              </span>
            `
            : ''
        }

        ${
          task.laundry_service
            ? `
              <span>
                🧺 Lavagem incluída
              </span>
            `
            : ''
        }

        ${
          professionalName
            ? `
              <span>
                👤 Profissional:
                ${escapeHtml(
                  professionalName
                )}
              </span>
            `
            : ''
        }

      </div>


      ${
        isCleaner || isAdmin
          ? `
            <div class="task-client">

              <strong>
                Cliente
              </strong>

              <span>
                ${escapeHtml(
                  clientName
                )}
              </span>

            </div>
          `
          : ''
      }


      <div class="checklist-header">

        <strong>
          Checklist
        </strong>

        <span class="checklist-progress">
          ${progress.done} / ${progress.total}
          concluídos
        </span>

      </div>


      <div class="checklist">

        ${
          checklist.length
            ? checklist.map(
                item => {

                  const checked =
                    item.done
                      ? 'checked'
                      : '';

                  return `

                    <label
                      class="checklist-item ${
                        item.done
                          ? 'done'
                          : ''
                      }"
                    >

                      ${
                        isCleaner ||
                        isAdmin
                          ? `
                            <input
                              type="checkbox"
                              id="ck_${escapeAttr(
                                item.id
                              )}_${escapeAttr(
                                task.id
                              )}"
                              ${checked}
                              onchange="
                                toggleChecklistItem(
                                  '${escapeAttr(
                                    task.id
                                  )}',
                                  '${escapeAttr(
                                    item.id
                                  )}'
                                )
                              "
                            >
                          `
                          : `
                            <input
                              type="checkbox"
                              ${checked}
                              disabled
                            >
                          `
                      }

                      <span>
                        ${escapeHtml(
                          item.label
                        )}
                      </span>

                    </label>

                  `;

                }
              ).join('')
            : `
              <div class="empty-small">
                Nenhum item no checklist.
              </div>
            `
        }

      </div>


      ${
        task.notes
          ? `
            <div class="task-notes">

              <strong>
                📝 Observações
              </strong>

              <p>
                ${escapeHtml(
                  task.notes
                )}
              </p>

            </div>
          `
          : ''
      }


      ${
        task.work_start
          ? `
            <div class="timer-box">

              <div>

                <span class="timer-label">
                  ⏱️ Tempo de trabalho
                </span>

                <strong
                  class="live-timer"
                  data-start="${escapeAttr(
                    task.work_start
                  )}"
                  ${
                    task.work_end
                      ? `
                        data-end="${escapeAttr(
                          task.work_end
                        )}"
                      `
                      : ''
                  }
                >
                  00:00:00
                </strong>

              </div>

            </div>
          `
          : ''
      }


      ${
        photos.length
          ? `
            <div class="task-photos">

              <strong>
                📸 Fotos
              </strong>

              <div class="photo-grid">

                ${photos.map(
                  photo => `

                    <a
                      href="${escapeAttr(
                        photo
                      )}"
                      target="_blank"
                      rel="noopener noreferrer"
                    >

                      <img
                        src="${escapeAttr(
                          photo
                        )}"
                        alt="Foto da limpeza"
                        loading="lazy"
                      >

                    </a>

                  `
                ).join('')}

              </div>

            </div>
          `
          : ''
      }


      <div class="task-actions">

        <!-- ==================================================
             CHAT
        ================================================== -->

        <button
          class="btn btn-outline"
          type="button"
          onclick="openChat('${escapeAttr(
            task.id
          )}')"
        >
          💬 Chat
        </button>


        ${
          isCleaner || isAdmin
            ? `

              ${
                status !== 'in-progress' &&
                status !== 'completed'
                  ? `
                    <button
                      class="btn btn-accent"
                      type="button"
                      onclick="startTimer('${escapeAttr(
                        task.id
                      )}')"
                    >
                      ▶️ Iniciar trabalho
                    </button>
                  `
                  : ''
              }


              ${
                status === 'in-progress' &&
                !task.work_end
                  ? `
                    <button
                      class="btn btn-outline"
                      type="button"
                      onclick="stopTimer('${escapeAttr(
                        task.id
                      )}')"
                    >
                      ⏹️ Finalizar trabalho
                    </button>
                  `
                  : ''
              }


              ${
                status === 'in-progress' &&
                task.work_end
                  ? `
                    <button
                      class="btn btn-accent"
                      type="button"
                      onclick="completeTask('${escapeAttr(
                        task.id
                      )}')"
                    >
                      ✅ Concluir tarefa
                    </button>
                  `
                  : ''
              }


              ${
                status !== 'completed'
                  ? `
                    <label
                      class="btn btn-outline photo-upload-label"
                    >
                      📷 Fotos

                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onchange="
                          uploadPhotos(
                            '${escapeAttr(
                              task.id
                            )}',
                            this
                          )
                        "
                      >

                    </label>
                  `
                  : ''
              }

            `
            : ''
        }


        ${
          isClient
            ? `

              ${
                status === 'pending'
                  ? `

                    <button
                      class="btn btn-outline"
                      type="button"
                      onclick="toggleEditForm('${escapeAttr(
                        task.id
                      )}')"
                    >
                      ✏️ Editar
                    </button>

                    <button
                      class="btn btn-danger"
                      type="button"
                      onclick="cancelRequest('${escapeAttr(
                        task.id
                      )}')"
                    >
                      🗑️ Cancelar
                    </button>

                  `
                  : ''
              }

            `
            : ''
        }


        ${
          isAdmin
            ? `

              <button
                class="btn btn-danger"
                type="button"
                onclick="adminDeleteTask('${escapeAttr(
                  task.id
                )}')"
              >
                🗑️ Excluir
              </button>

            `
            : ''
        }

      </div>


      ${
        isClient &&
        status === 'pending'
          ? `

            <div
              class="edit-form"
              id="editForm_${escapeAttr(
                task.id
              )}"
              style="display:none;"
            >

              <div class="field-row">

                <div class="field">

                  <label>
                    Nova data
                  </label>

                  <input
                    type="date"
                    id="editDate_${escapeAttr(
                      task.id
                    )}"
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
                    id="editTime_${escapeAttr(
                      task.id
                    )}"
                    value="${escapeAttr(
                      task.time || ''
                    )}"
                  >

                </div>

              </div>


              <button
                class="btn btn-accent"
                type="button"
                onclick="saveEditRequest('${escapeAttr(
                  task.id
                )}')"
              >
                💾 Salvar alterações
              </button>

            </div>

          `
          : ''
      }

    </div>

  `;

}


/* ============================================================
   CHAT — NÚCLEO
============================================================ */

/*
   IMPORTANTE:

   A conversa é encontrada por:

       conversations.task_id

   Nunca por:

       cleaning_id
       cleaning_request_id
*/


let activeChatConversation = null;

let chatRealtimeChannel = null;

let chatMessagesCallback = null;


/* ============================================================
   ABRIR CHAT
============================================================ */

function openChat(
  taskId
) {

  if (!taskId) {

    showSnackbar(
      'Não foi possível abrir o chat.'
    );

    return;

  }

  window.location.href =
    `chat.html?task=${encodeURIComponent(
      taskId
    )}`;

}


/* ============================================================
   OBTER TASK ID DA URL
============================================================ */

function getChatTaskId() {

  try {

    const params =
      new URLSearchParams(
        window.location.search
      );

    return (
      params.get('task') ||
      params.get('task_id') ||
      ''
    );

  }
  catch (error) {

    console.warn(
      'Erro ao ler task da URL:',
      error
    );

    return '';

  }

}


/* ============================================================
   BUSCAR TAREFA
============================================================ */

async function getTaskById(
  taskId
) {

  if (
    !sb ||
    !taskId
  ) {

    return null;

  }

  const {
    data,
    error
  } = await sb
    .from('cleaning_requests')
    .select('*')
    .eq(
      'id',
      taskId
    )
    .maybeSingle();

  if (error) {

    console.error(
      'Erro ao buscar tarefa:',
      error
    );

    return null;

  }

  return data || null;

}


/* ============================================================
   AUTORIZAÇÃO DO CHAT
============================================================ */

function isChatParticipant(
  task,
  userId,
  role
) {

  if (
    !task ||
    !userId
  ) {

    return false;

  }

  if (
    role === 'admin'
  ) {

    return true;

  }

  return (
    String(task.client_id || '') ===
      String(userId) ||

    String(task.professional_id || '') ===
      String(userId)
  );

}


/* ============================================================
   OBTER/CRIAR CONVERSA
============================================================ */

async function getOrCreateConversation(
  taskId
) {

  if (
    !sb ||
    !taskId
  ) {

    throw new Error(
      'Tarefa inválida.'
    );

  }

  const user =
    await getCurrentUser();

  if (!user) {

    throw new Error(
      'Usuário não autenticado.'
    );

  }

  const task =
    await getTaskById(
      taskId
    );

  if (!task) {

    throw new Error(
      'Tarefa não encontrada.'
    );

  }

  const profile =
    await getCurrentProfile(
      user.id
    );

  const role =
    profile?.role ||
    '';

  if (
    !isChatParticipant(
      task,
      user.id,
      role
    )
  ) {

    throw new Error(
      'Você não tem permissão para acessar este chat.'
    );

  }


  /*
   * Primeiro tenta encontrar
   * conversa existente.
   */

  let {
    data: conversation,
    error: findError
  } = await sb
    .from('conversations')
    .select('*')
    .eq(
      'task_id',
      taskId
    )
    .maybeSingle();


  if (findError) {

    console.error(
      'Erro ao procurar conversa:',
      findError
    );

    throw findError;

  }


  /*
   * Se não existe, cria.
   *
   * O professional_id pode ser
   * nulo caso a tarefa ainda não
   * tenha profissional.
   */

  if (!conversation) {

    const payload = {

      task_id:
        task.id,

      client_id:
        task.client_id,

      professional_id:
        task.professional_id || null

    };


    const {
      data: created,
      error: createError
    } = await sb
      .from('conversations')
      .insert(
        payload
      )
      .select('*')
      .single();


    if (
      createError
    ) {

      /*
       * Se outra aba/usuário criou
       * simultaneamente, tenta buscar
       * novamente.
       */

      const {
        data: existingAfterConflict
      } = await sb
        .from('conversations')
        .select('*')
        .eq(
          'task_id',
          taskId
        )
        .maybeSingle();


      if (
        existingAfterConflict
      ) {

        conversation =
          existingAfterConflict;

      }
      else {

        console.error(
          'Erro ao criar conversa:',
          createError
        );

        throw createError;

      }

    }
    else {

      conversation =
        created;

    }

  }


  /*
   * Atualiza participantes caso
   * a conversa tenha sido criada
   * antes de um profissional ser
   * atribuído.
   */

  if (
    conversation &&
    (
      String(
        conversation.client_id || ''
      ) !== String(
        task.client_id || ''
      ) ||
      String(
        conversation.professional_id || ''
      ) !== String(
        task.professional_id || ''
      )
    )
  ) {

    const {
      data: synchronized,
      error: syncError
    } = await sb
      .from('conversations')
      .update({

        client_id:
          task.client_id,

        professional_id:
          task.professional_id || null,

        updated_at:
          new Date().toISOString()

      })
      .eq(
        'id',
        conversation.id
      )
      .select('*')
      .single();

    if (!syncError && synchronized) {

      conversation =
        synchronized;

    }

  }


  activeChatConversation =
    conversation;

  return conversation;

}


/* ============================================================
   BUSCAR CONVERSA EXISTENTE
============================================================ */

async function getConversationByTaskId(
  taskId
) {

  if (
    !sb ||
    !taskId
  ) {

    return null;

  }

  const {
    data,
    error
  } = await sb
    .from('conversations')
    .select('*')
    .eq(
      'task_id',
      taskId
    )
    .maybeSingle();

  if (error) {

    console.error(
      'Erro ao buscar conversa:',
      error
    );

    return null;

  }

  return data || null;

}


/* ============================================================
   BUSCAR MENSAGENS
============================================================ */

async function getChatMessages(
  conversationId,
  options = {}
) {

  if (
    !sb ||
    !conversationId
  ) {

    return [];

  }

  const limit =
    Math.min(
      Math.max(
        Number(
          options.limit || 200
        ),
        1
      ),
      500
    );

  let query =
    sb
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
      )
      .limit(
        limit
      );


  if (
    options.before
  ) {

    query =
      query.lt(
        'created_at',
        options.before
      );

  }


  const {
    data,
    error
  } = await query;

  if (error) {

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
) {

  if (
    !sb ||
    !conversationId
  ) {

    throw new Error(
      'Conversa inválida.'
    );

  }

  const message =
    String(
      content || ''
    ).trim();

  if (!message) {

    throw new Error(
      'Digite uma mensagem.'
    );

  }

  if (
    message.length >
    5000
  ) {

    throw new Error(
      'A mensagem não pode ultrapassar 5000 caracteres.'
    );

  }

  const user =
    await getCurrentUser();

  if (!user) {

    throw new Error(
      'Usuário não autenticado.'
    );

  }


  /*
   * Confirma que a conversa
   * pertence ao usuário.
   */

  const {
    data: conversation,
    error: conversationError
  } = await sb
    .from('conversations')
    .select(`
      id,
      task_id,
      client_id,
      professional_id
    `)
    .eq(
      'id',
      conversationId
    )
    .maybeSingle();

  if (conversationError) {

    throw conversationError;

  }

  if (!conversation) {

    throw new Error(
      'Conversa não encontrada.'
    );

  }

  const profile =
    await getCurrentProfile(
      user.id
    );

  const role =
    profile?.role ||
    '';

  if (
    role !== 'admin' &&
    String(
      conversation.client_id || ''
    ) !== String(
      user.id
    ) &&
    String(
      conversation.professional_id || ''
    ) !== String(
      user.id
    )
  ) {

    throw new Error(
      'Você não tem permissão para enviar mensagens nesta conversa.'
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
        user.id,

      content:
        message

    })
    .select(`
      id,
      conversation_id,
      sender_id,
      content,
      created_at
    `)
    .single();

  if (error) {

    console.error(
      'Erro ao enviar mensagem:',
      error
    );

    throw error;

  }


  /*
   * Atualiza timestamp da conversa.
   */

  await sb
    .from('conversations')
    .update({

      updated_at:
        new Date().toISOString()

    })
    .eq(
      'id',
      conversationId
    );


  return data;

}


/* ============================================================
   REALTIME DO CHAT
============================================================ */

function stopChatRealtime() {

  if (
    !sb ||
    !chatRealtimeChannel
  ) {

    return;

  }

  try {

    sb.removeChannel(
      chatRealtimeChannel
    );

  }
  catch (error) {

    console.warn(
      'Erro ao remover realtime do chat:',
      error
    );

  }

  chatRealtimeChannel =
    null;

}


function startChatRealtime(
  conversationId,
  callback
) {

  stopChatRealtime();

  if (
    !sb ||
    !conversationId
  ) {

    return null;

  }

  chatMessagesCallback =
    typeof callback === 'function'
      ? callback
      : null;


  chatRealtimeChannel =
    sb
      .channel(
        'cleansync-chat-' +
        conversationId +
        '-' +
        Date.now()
      )

      .on(

        'postgres_changes',

        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter:
            `conversation_id=eq.${conversationId}`
        },

        payload => {

          try {

            if (
              typeof chatMessagesCallback ===
              'function'
            ) {

              chatMessagesCallback(
                payload
              );

            }

          }
          catch (error) {

            console.error(
              'Chat realtime callback:',
              error
            );

          }

        }

      )

      .subscribe(
        status => {

          console.log(
            'CleanSync chat realtime:',
            status
          );

        }
      );


  return chatRealtimeChannel;

}


/* ============================================================
   INICIALIZAR CHAT
============================================================ */

async function initChat(
  taskId,
  callbacks = {}
) {

  try {

    if (!taskId) {

      throw new Error(
        'Nenhuma tarefa foi informada.'
      );

    }

    const conversation =
      await getOrCreateConversation(
        taskId
      );

    const messages =
      await getChatMessages(
        conversation.id
      );


    /*
     * Realtime
     */

    startChatRealtime(
      conversation.id,
      payload => {

        if (
          typeof callbacks.onMessage ===
          'function'
        ) {

          callbacks.onMessage(
            payload.new
          );

        }

      }
    );


    if (
      typeof callbacks.onReady ===
      'function'
    ) {

      callbacks.onReady({

        taskId,

        conversation,

        messages

      });

    }


    return {

      taskId,

      conversation,

      messages

    };

  }
  catch (error) {

    console.error(
      'Erro ao inicializar chat:',
      error
    );


    if (
      typeof callbacks.onError ===
      'function'
    ) {

      callbacks.onError(
        error
      );

    }


    return null;

  }

}


/* ============================================================
   DESTRUIR CHAT
============================================================ */

function destroyChat() {

  stopChatRealtime();

  activeChatConversation =
    null;

  chatMessagesCallback =
    null;

}


/* ============================================================
   REALTIME GLOBAL
============================================================ */

let realtimeChannel = null;


function stopRealtime() {

  if (
    sb &&
    realtimeChannel
  ) {

    try {

      sb.removeChannel(
        realtimeChannel
      );

    }
    catch (error) {

      console.warn(
        'Erro ao remover realtime:',
        error
      );

    }

  }

  realtimeChannel =
    null;

}


function startRealtime(
  callback
) {

  if (!sb) {

    return null;

  }

  stopRealtime();


  realtimeChannel =
    sb
      .channel(
        'cleansync-global-' +
        Date.now()
      )


      /*
       * Tarefas
       */

      .on(

        'postgres_changes',

        {
          event: '*',
          schema: 'public',
          table: 'cleaning_requests'
        },

        payload => {

          try {

            if (
              typeof callback ===
              'function'
            ) {

              callback(
                payload
              );

            }

          }
          catch (error) {

            console.error(
              'Realtime task callback:',
              error
            );

          }

        }

      )


      /*
       * Conversas
       */

      .on(

        'postgres_changes',

        {
          event: '*',
          schema: 'public',
          table: 'conversations'
        },

        payload => {

          try {

            if (
              typeof callback ===
              'function'
            ) {

              callback({

                ...payload,

                table:
                  'conversations'

              });

            }

          }
          catch (error) {

            console.error(
              'Realtime conversation callback:',
              error
            );

          }

        }

      )


      /*
       * Mensagens
       *
       * Escuta mensagens globalmente.
       * A autorização continua sendo
       * feita pelas policies do Supabase.
       */

      .on(

        'postgres_changes',

        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },

        payload => {

          try {

            if (
              typeof callback ===
              'function'
            ) {

              callback({

                ...payload,

                table:
                  'messages'

              });

            }

          }
          catch (error) {

            console.error(
              'Realtime message callback:',
              error
            );

          }

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
   ADMIN — EXCLUIR TAREFA
============================================================ */

async function adminDeleteTask(
  id
) {

  if (!id) {

    return;

  }

  const confirmed =
    confirm(
      'Tem certeza que deseja excluir esta tarefa?\n\n' +
      'A tarefa e os dados relacionados ao chat poderão ser removidos.\n' +
      'Esta ação não poderá ser desfeita.'
    );

  if (!confirmed) {

    return;

  }

  if (!sb) {

    alert(
      'Supabase não configurado.'
    );

    return;

  }


  /*
   * Primeiro procura conversa.
   */

  let conversation = null;

  try {

    conversation =
      await getConversationByTaskId(
        id
      );

  }
  catch (error) {

    console.warn(
      'Não foi possível localizar conversa:',
      error
    );

  }


  /*
   * Exclui mensagens primeiro.
   */

  if (conversation?.id) {

    const {
      error: messagesError
    } = await sb
      .from('messages')
      .delete()
      .eq(
        'conversation_id',
        conversation.id
      );

    if (messagesError) {

      console.warn(
        'Não foi possível excluir mensagens:',
        messagesError
      );

    }


    /*
     * Depois exclui conversa.
     */

    const {
      error: conversationError
    } = await sb
      .from('conversations')
      .delete()
      .eq(
        'id',
        conversation.id
      );

    if (conversationError) {

      console.warn(
        'Não foi possível excluir conversa:',
        conversationError
      );

    }

  }


  /*
   * Finalmente exclui tarefa.
   */

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

    console.error(
      error
    );

    alert(
      'Erro ao excluir tarefa:\n' +
      error.message
    );

    return;

  }


  showSnackbar(
    '🗑️ Tarefa excluída.'
  );


  if (
    typeof window.reloadTasks ===
    'function'
  ) {

    window.reloadTasks();

  }
  else if (
    typeof window.reloadRequests ===
    'function'
  ) {

    window.reloadRequests();

  }

}


/* ============================================================
   EDITAR TAREFA
============================================================ */

async function updateTask(
  id,
  fields
) {

  if (
    !sb ||
    !id
  ) {

    return {

      error:
        new Error(
          'Dados inválidos.'
        )

    };

  }

  return await sb
    .from('cleaning_requests')
    .update(
      fields
    )
    .eq(
      'id',
      id
    );

}


/* ============================================================
   CANCELAR REQUISIÇÃO
============================================================ */

/*
   ALTERAÇÃO DEFINITIVA:

   Antes:
   DELETE da tarefa.

   Agora:
   status = cancelled

   Assim:
   - mantém histórico;
   - mantém referências;
   - não quebra o chat;
   - não perde dados administrativos.
*/

async function cancelRequest(
  id
) {

  if (!id) {

    return;

  }

  const confirmed =
    confirm(
      'Tem certeza que deseja cancelar esta requisição?'
    );

  if (!confirmed) {

    return;

  }

  if (!sb) {

    alert(
      'Supabase não configurado.'
    );

    return;

  }


  const {
    error
  } = await sb
    .from('cleaning_requests')
    .update({

      status:
        'cancelled'

    })
    .eq(
      'id',
      id
    );


  if (error) {

    alert(
      'Erro ao cancelar:\n' +
      error.message
    );

    return;

  }


  showSnackbar(
    '🗑️ Requisição cancelada.'
  );


  if (
    typeof window.reloadRequests ===
    'function'
  ) {

    window.reloadRequests();

  }
  else if (
    typeof window.reloadTasks ===
    'function'
  ) {

    window.reloadTasks();

  }

}


/* ============================================================
   EDIT FORM
============================================================ */

function toggleEditForm(
  id
) {

  const form =
    document.getElementById(
      'editForm_' + id
    );

  if (!form) {

    return;

  }

  if (
    form.style.display === 'none' ||
    !form.style.display
  ) {

    form.style.display =
      'block';

  }
  else {

    form.style.display =
      'none';

  }

}


async function saveEditRequest(
  id
) {

  const dateInput =
    document.getElementById(
      'editDate_' + id
    );

  const timeInput =
    document.getElementById(
      'editTime_' + id
    );

  if (
    !dateInput ||
    !timeInput
  ) {

    return;

  }

  const newDate =
    dateInput.value;

  const newTime =
    timeInput.value;

  if (
    !newDate ||
    !newTime
  ) {

    alert(
      'Preencha data e horário.'
    );

    return;

  }

  if (!sb) {

    alert(
      'Supabase não configurado.'
    );

    return;

  }

  const {
    error
  } = await sb
    .from('cleaning_requests')
    .update({

      date:
        newDate,

      time:
        newTime

    })
    .eq(
      'id',
      id
    );

  if (error) {

    alert(
      'Erro:\n' +
      error.message
    );

    return;

  }

  showSnackbar(
    '✅ Requisição atualizada!'
  );

  if (
    typeof window.reloadRequests ===
    'function'
  ) {

    window.reloadRequests();

  }

}


/* ============================================================
   CRONÔMETRO
============================================================ */

let timerInterval = null;


function attachTimers(
  tasks = []
) {

  clearInterval(
    timerInterval
  );

  function updateTimers() {

    document
      .querySelectorAll(
        '.live-timer'
      )
      .forEach(
        element => {

          const start =
            element.dataset.start;

          const end =
            element.dataset.end;

          if (!start) {

            element.textContent =
              '00:00:00';

            return;

          }

          const startDate =
            new Date(
              start
            );

          const endDate =
            end
              ? new Date(end)
              : new Date();

          let seconds =
            Math.floor(
              (
                endDate.getTime() -
                startDate.getTime()
              ) / 1000
            );

          if (
            !Number.isFinite(
              seconds
            ) ||
            seconds < 0
          ) {

            seconds = 0;

          }

          element.textContent =
            formatDuration(
              seconds
            );

        }
      );

  }

  updateTimers();

  timerInterval =
    setInterval(
      updateTimers,
      1000
    );

}


function formatDuration(
  totalSeconds
) {

  const seconds =
    Math.max(
      0,
      Math.floor(
        totalSeconds
      )
    );

  const h =
    Math.floor(
      seconds / 3600
    );

  const m =
    Math.floor(
      (
        seconds % 3600
      ) / 60
    );

  const s =
    seconds % 60;

  return [

    String(h).padStart(
      2,
      '0'
    ),

    String(m).padStart(
      2,
      '0'
    ),

    String(s).padStart(
      2,
      '0'
    )

  ].join(':');

}


/* ============================================================
   INICIAR TRABALHO
============================================================ */

async function startTimer(
  id
) {

  if (!id) {

    return;

  }

  if (!sb) {

    alert(
      'Supabase não configurado.'
    );

    return;

  }

  const {
    data: existing,
    error: fetchError
  } = await sb
    .from('cleaning_requests')
    .select(
      'status, work_start, work_end'
    )
    .eq(
      'id',
      id
    )
    .single();

  if (fetchError) {

    alert(
      'Erro ao carregar tarefa:\n' +
      fetchError.message
    );

    return;

  }

  if (
    existing &&
    existing.status ===
      'completed'
  ) {

    showSnackbar(
      'Esta tarefa já foi concluída.'
    );

    return;

  }

  if (
    existing &&
    existing.work_start &&
    !existing.work_end
  ) {

    showSnackbar(
      'O cronômetro já está em andamento.'
    );

    return;

  }

  const {
    error
  } = await sb
    .from('cleaning_requests')
    .update({

      status:
        'in-progress',

      work_start:
        new Date().toISOString(),

      work_end:
        null

    })
    .eq(
      'id',
      id
    );

  if (error) {

    alert(
      'Erro ao iniciar:\n' +
      error.message
    );

    return;

  }

  showSnackbar(
    '⏱️ Trabalho iniciado!'
  );

  if (
    typeof window.reloadTasks ===
    'function'
  ) {

    window.reloadTasks();

  }
  else {

    location.reload();

  }

}


/* ============================================================
   FINALIZAR CRONÔMETRO
============================================================ */

async function stopTimer(
  id
) {

  if (!id) {

    return;

  }

  if (!sb) {

    alert(
      'Supabase não configurado.'
    );

    return;

  }

  const {
    error
  } = await sb
    .from('cleaning_requests')
    .update({

      work_end:
        new Date().toISOString()

    })
    .eq(
      'id',
      id
    );

  if (error) {

    alert(
      'Erro ao finalizar:\n' +
      error.message
    );

    return;

  }

  showSnackbar(
    '⏹️ Trabalho finalizado!'
  );

  if (
    typeof window.reloadTasks ===
    'function'
  ) {

    window.reloadTasks();

  }
  else {

    location.reload();

  }

}


/* ============================================================
   CHECKLIST
============================================================ */

async function toggleChecklistItem(
  id,
  itemId
) {

  if (
    !id ||
    !itemId ||
    !sb
  ) {

    return;

  }

  const {
    data: row,
    error: fetchError
  } = await sb
    .from('cleaning_requests')
    .select(
      'checklist'
    )
    .eq(
      'id',
      id
    )
    .single();

  if (fetchError) {

    console.error(
      fetchError
    );

    showSnackbar(
      'Erro ao carregar checklist.'
    );

    return;

  }

  const checklist =
    normalizeChecklist(
      row?.checklist
    );

  const updated =
    checklist.map(
      item => {

        if (
          String(item.id) ===
          String(itemId)
        ) {

          return {

            ...item,

            done:
              !item.done

          };

        }

        return item;

      }
    );

  const {
    error
  } = await sb
    .from('cleaning_requests')
    .update({

      checklist:
        updated

    })
    .eq(
      'id',
      id
    );

  if (error) {

    console.error(
      error
    );

    showSnackbar(
      'Erro ao atualizar checklist.'
    );

    if (
      typeof window.reloadTasks ===
      'function'
    ) {

      window.reloadTasks();

    }

    return;

  }

  const checkbox =
    document.getElementById(
      `ck_${itemId}_${id}`
    );

  if (checkbox) {

    const itemDiv =
      checkbox.closest(
        '.checklist-item'
      );

    if (itemDiv) {

      itemDiv.classList.toggle(
        'done',
        checkbox.checked
      );

    }

    const task =
      checkbox.closest(
        '.task'
      );

    if (task) {

      const boxes =
        task.querySelectorAll(
          '.checklist-item input[type="checkbox"]'
        );

      const done =
        task.querySelectorAll(
          '.checklist-item input[type="checkbox"]:checked'
        ).length;

      const progress =
        task.querySelector(
          '.checklist-progress'
        );

      if (progress) {

        progress.textContent =
          `${done} / ${boxes.length} concluídos`;

      }

    }

  }

}


/* ============================================================
   CONCLUIR TAREFA
============================================================ */

async function completeTask(
  id
) {

  if (
    !id ||
    !sb
  ) {

    return;

  }

  try {

    const {
      data: task,
      error: fetchError
    } = await sb
      .from('cleaning_requests')
      .select('*')
      .eq(
        'id',
        id
      )
      .single();

    if (fetchError) {

      throw fetchError;

    }

    if (!task) {

      throw new Error(
        'Tarefa não encontrada.'
      );

    }

    const checklist =
      normalizeChecklist(
        task.checklist
      );

    const allDone =
      checklist.length === 0 ||
      checklist.every(
        item => item.done
      );

    if (!allDone) {

      const continueAnyway =
        confirm(
          'Alguns itens do checklist ainda não foram concluídos.\n\n' +
          'Deseja concluir a tarefa mesmo assim?'
        );

      if (!continueAnyway) {

        return;

      }

    }

    if (
      !task.work_start ||
      !task.work_end
    ) {

      alert(
        'Use o cronômetro antes de concluir a tarefa.\n\n' +
        'Inicie o trabalho e depois finalize o cronômetro.'
      );

      return;

    }

    const {
      data: updatedTask,
      error: updateError
    } = await sb
      .from('cleaning_requests')
      .update({

        status:
          'completed',

        completed_at:
          new Date().toISOString()

      })
      .eq(
        'id',
        id
      )
      .select()
      .single();

    if (updateError) {

      throw updateError;

    }

    showSnackbar(
      '✅ Tarefa concluída!'
    );

    if (
      typeof window.reloadTasks ===
      'function'
    ) {

      window.reloadTasks();

    }

    await notifyTaskCompleted(
      updatedTask
    );

  }
  catch (error) {

    console.error(
      'Erro ao concluir:',
      error
    );

    alert(
      'Erro ao concluir tarefa:\n' +
      (
        error.message ||
        error
      )
    );

  }

}


/* ============================================================
   NOTIFICAÇÃO
============================================================ */

async function notifyTaskCompleted(
  task
) {

  if (
    !task ||
    !sb
  ) {

    return;

  }

  try {

    const {
      data,
      error
    } = await sb.auth.getSession();

    if (
      error ||
      !data?.session
    ) {

      console.warn(
        'Sessão não disponível para notificação.'
      );

      return;

    }

    const supabaseUrl =
      window.SUPABASE_URL ||
      SUPABASE_URL;

    if (
      !supabaseUrl ||
      supabaseUrl.includes(
        'COLOQUE_AQUI'
      )
    ) {

      console.warn(
        'SUPABASE_URL não configurada.'
      );

      return;

    }

    const response =
      await fetch(
        `${supabaseUrl}/functions/v1/notify-task-completed`,
        {

          method:
            'POST',

          headers: {

            'Content-Type':
              'application/json',

            'Authorization':
              `Bearer ${data.session.access_token}`

          },

          body:
            JSON.stringify({

              taskId:
                task.id

            })

        }
      );

    const result =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (!response.ok) {

      console.warn(
        'Notificação não enviada:',
        result
      );

      return;

    }

    console.log(
      'Notificação processada:',
      result
    );

  }
  catch (error) {

    console.warn(
      'Falha na notificação:',
      error
    );

  }

}


/* ============================================================
   FOTOS
============================================================ */

async function uploadPhotos(
  id,
  input
) {

  if (
    !id ||
    !input ||
    !sb
  ) {

    return;

  }

  const files =
    Array.from(
      input.files || []
    );

  if (!files.length) {

    return;

  }

  showSnackbar(
    '📤 Enviando fotos...'
  );

  try {

    const uploadedUrls = [];

    for (
      const file of files
    ) {

      if (
        file.size >
        15 * 1024 * 1024
      ) {

        throw new Error(
          `${file.name} é maior que 15 MB.`
        );

      }

      if (
        !file.type.startsWith(
          'image/'
        )
      ) {

        throw new Error(
          `${file.name} não é uma imagem válida.`
        );

      }

      const safeName =
        file.name
          .replace(
            /[^a-zA-Z0-9.\-_]/g,
            '_'
          );

      const path =
        `${id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}-${safeName}`;

      const {
        error: uploadError
      } = await sb.storage
        .from(
          CLEANING_PHOTOS_BUCKET
        )
        .upload(
          path,
          file,
          {
            upsert: false
          }
        );

      if (uploadError) {

        throw uploadError;

      }

      const {
        data
      } = sb.storage
        .from(
          CLEANING_PHOTOS_BUCKET
        )
        .getPublicUrl(
          path
        );

      if (
        data?.publicUrl
      ) {

        uploadedUrls.push(
          data.publicUrl
        );

      }

    }

    if (!uploadedUrls.length) {

      throw new Error(
        'Nenhuma foto foi enviada.'
      );

    }

    const {
      data: row,
      error: fetchError
    } = await sb
      .from('cleaning_requests')
      .select(
        'photos'
      )
      .eq(
        'id',
        id
      )
      .single();

    if (fetchError) {

      throw fetchError;

    }

    const existingPhotos =
      Array.isArray(
        row?.photos
      )
        ? row.photos
        : [];

    const allPhotos = [

      ...existingPhotos,

      ...uploadedUrls

    ];

    const {
      error: updateError
    } = await sb
      .from('cleaning_requests')
      .update({

        photos:
          allPhotos

      })
      .eq(
        'id',
        id
      );

    if (updateError) {

      throw updateError;

    }

    input.value = '';

    showSnackbar(
      '📸 Fotos enviadas!'
    );

    if (
      typeof window.reloadTasks ===
      'function'
    ) {

      window.reloadTasks();

    }

  }
  catch (error) {

    console.error(
      error
    );

    alert(
      'Erro ao enviar fotos:\n' +
      error.message
    );

  }

}


/* ============================================================
   CHECKLIST ADMIN
============================================================ */

async function updateChecklistItemLabel(
  itemId,
  newLabel
) {

  const label =
    String(
      newLabel || ''
    ).trim();

  if (!label) {

    showSnackbar(
      'O nome da tarefa não pode ficar vazio.'
    );

    return;

  }

  const items =
    await getDefaultChecklist();

  const updated =
    items.map(
      item =>
        String(item.id) ===
        String(itemId)
          ? {
              ...item,
              label
            }
          : item
    );

  const {
    error
  } = await sb
    .from('default_checklist')
    .update({

      items:
        updated,

      updated_at:
        new Date().toISOString()

    })
    .eq(
      'id',
      1
    );

  if (error) {

    alert(
      'Erro:\n' +
      error.message
    );

    return;

  }

  showSnackbar(
    '✅ Checklist atualizado.'
  );

}


async function addChecklistItem() {

  const items =
    await getDefaultChecklist();

  items.push({

    id:
      'item_' +
      Date.now(),

    label:
      'Nova tarefa'

  });

  const {
    error
  } = await sb
    .from('default_checklist')
    .update({

      items,

      updated_at:
        new Date().toISOString()

    })
    .eq(
      'id',
      1
    );

  if (error) {

    alert(
      'Erro:\n' +
      error.message
    );

    return;

  }

  showSnackbar(
    '✅ Item adicionado.'
  );

  if (
    typeof window.loadChecklistEditor ===
    'function'
  ) {

    window.loadChecklistEditor();

  }
  else {

    location.reload();

  }

}


async function removeChecklistItem(
  itemId
) {

  const confirmed =
    confirm(
      'Remover este item do checklist padrão?'
    );

  if (!confirmed) {

    return;

  }

  const items =
    (
      await getDefaultChecklist()
    ).filter(
      item =>
        String(item.id) !==
        String(itemId)
    );

  const {
    error
  } = await sb
    .from('default_checklist')
    .update({

      items,

      updated_at:
        new Date().toISOString()

    })
    .eq(
      'id',
      1
    );

  if (error) {

    alert(
      'Erro:\n' +
      error.message
    );

    return;

  }

  showSnackbar(
    '🗑️ Item removido.'
  );

  if (
    typeof window.loadChecklistEditor ===
    'function'
  ) {

    window.loadChecklistEditor();

  }
  else {

    location.reload();

  }

}


/* ============================================================
   PWA
============================================================ */

let deferredInstallPrompt =
  null;


window.addEventListener(
  'beforeinstallprompt',
  event => {

    event.preventDefault();

    deferredInstallPrompt =
      event;

  }
);


function setupInstallAndNotifyBanner() {

  window.CleanSync.installApp =
    async function () {

      if (!deferredInstallPrompt) {

        showSnackbar(
          'A instalação não está disponível neste momento.'
        );

        return;

      }

      deferredInstallPrompt.prompt();

      const result =
        await deferredInstallPrompt.userChoice;

      console.log(
        'PWA install:',
        result
      );

      deferredInstallPrompt =
        null;

    };

}


/* ============================================================
   SERVICE WORKER
============================================================ */

function registerCleanSyncServiceWorker() {

  if (
    !('serviceWorker' in navigator)
  ) {

    return;

  }

  navigator.serviceWorker
    .register(
      'service-worker.js'
    )
    .then(
      registration => {

        console.log(
          'CleanSync Service Worker:',
          registration.scope
        );

      }
    )
    .catch(
      error => {

        console.warn(
          'Service Worker:',
          error
        );

      }
    );

}


/* ============================================================
   AUTO-INICIALIZAÇÃO
============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    setupInstallAndNotifyBanner();

  }
);


/* ============================================================
   LIMPEZA AO SAIR DA PÁGINA
============================================================ */

window.addEventListener(
  'pagehide',
  () => {

    /*
     * Não remove o realtime global
     * de forma agressiva em todas as
     * páginas, mas encerra o chat.
     */

    stopChatRealtime();

  }
);


/* ============================================================
   EXPORTAÇÃO GLOBAL
============================================================ */

Object.assign(
  window,
  {

    /*
     * Supabase
     */

    sb,

    SUPABASE_URL,
    SUPABASE_ANON_KEY,


    /*
     * Configuração
     */

    PRICE_BASE,
    PRICE_WITH_LAUNDRY,


    /*
     * Helpers
     */

    debounce,
    escapeHtml,
    escapeAttr,

    formatDate,
    formatTime,
    formatCHF,
    formatDuration,


    /*
     * Snackbar
     */

    showSnackbar,


    /*
     * Sessão
     */

    getSession,
    saveSession,
    clearSession,


    /*
     * Usuário/perfil
     */

    getCurrentUser,
    getCurrentProfile,
    getProfileName,


    /*
     * Autenticação
     */

    requireRole,
    logout,


    /*
     * Checklist
     */

    getDefaultChecklist,
    normalizeChecklist,
    getChecklistProgress,

    getStatusLabel,
    getStatusClass,


    /*
     * Cards
     */

    renderTaskCard,


    /*
     * Tarefas
     */

    getTaskById,
    updateTask,


    /*
     * Chat
     */

    openChat,
    getChatTaskId,

    getConversationByTaskId,
    getOrCreateConversation,

    getChatMessages,
    sendChatMessage,

    startChatRealtime,
    stopChatRealtime,

    initChat,
    destroyChat,


    /*
     * Realtime
     */

    startRealtime,
    stopRealtime,


    /*
     * Cronômetro
     */

    attachTimers,

    startTimer,
    stopTimer,
    completeTask,


    /*
     * Checklist
     */

    toggleChecklistItem,


    /*
     * Fotos
     */

    uploadPhotos,


    /*
     * Cliente
     */

    toggleEditForm,
    saveEditRequest,
    cancelRequest,


    /*
     * Admin
     */

    adminDeleteTask,

    updateChecklistItemLabel,
    addChecklistItem,
    removeChecklistItem,


    /*
     * Notificação
     */

    notifyTaskCompleted,


    /*
     * PWA
     */

    setupInstallAndNotifyBanner,
    registerCleanSyncServiceWorker

  }
);


/* ============================================================
   LOG FINAL
============================================================ */

console.log(
  'CleanSync app-common DEFINITIVO carregado.'
);

console.log(
  'Chat: conversations.task_id → messages.conversation_id'
);