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

   RELAÇÃO DO CHAT:

   cleaning_requests.id
          ↓
   conversations.task_id
          ↓
   messages.conversation_id

   IMPORTANTE:
   NÃO utiliza:
   cleaning_id
   cleaning_request_id
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

  if (window.supabase) {

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


/**
 * Debounce
 */
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


/**
 * Escape HTML
 */
function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {

    return '';

  }

  return String(value)
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );

}


/**
 * Escape para atributo HTML
 */
function escapeAttr(value) {

  return escapeHtml(value);

}


/**
 * Formatação de data
 */
function formatDate(value) {

  if (!value) {

    return '—';

  }


  const date =
    new Date(
      value + (
        String(value).length === 10
          ? 'T00:00:00'
          : ''
      )
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return escapeHtml(value);

  }


  return date.toLocaleDateString(
    'pt-BR'
  );

}


/**
 * Formatação de hora
 */
function formatTime(value) {

  if (!value) {

    return '—';

  }


  return String(value)
    .slice(0, 5);

}


/**
 * Formatação CHF
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


/**
 * Nome seguro do perfil
 */
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
   AUTENTICAÇÃO / REQUIRE ROLE
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
      requiredRole ===
      'profissional'
    ) {

      authorized =
        role === 'profissional' ||
        role === 'admin';

    }

    else if (
      requiredRole ===
      'cliente'
    ) {

      authorized =
        role === 'cliente';

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
      role === 'profissional' ||
      role === 'admin'
    ) {

      window.location.href =
        'profissional.html';

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
        item.id ||
        `item_${index}`,

      label:
        item.label ||
        item.name ||
        `Tarefa ${index + 1}`,

      done:
        Boolean(
          item.done
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


  let html = `

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
          class="status status-${statusClass}"
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
                      class="checklist-item
                      ${item.done ? 'done' : ''}"
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
                                  '${escapeAttr(task.id)}',
                                  '${escapeAttr(item.id)}'
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
                      ? `data-end="${escapeAttr(
                          task.work_end
                        )}"`
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

            </div>
          `
          : ''
      }


      <div class="task-actions">

        <!-- ==================================================
             CHAT
             Disponível para:
             cliente
             profissional
             admin
        =================================================== -->

        <button
          class="btn btn-outline chat-task-button"
          type="button"
          data-chat-task-id="${escapeAttr(task.id)}"
          onclick="openChat('${escapeAttr(task.id)}')"
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
                      onclick="startTimer('${escapeAttr(task.id)}')"
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
                      onclick="stopTimer('${escapeAttr(task.id)}')"
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
                      onclick="completeTask('${escapeAttr(task.id)}')"
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
                            '${escapeAttr(task.id)}',
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
                      onclick="toggleEditForm('${escapeAttr(task.id)}')"
                    >
                      ✏️ Editar
                    </button>

                    <button
                      class="btn btn-danger"
                      type="button"
                      onclick="cancelRequest('${escapeAttr(task.id)}')"
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
                onclick="adminDeleteTask('${escapeAttr(task.id)}')"
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
              id="editForm_${escapeAttr(task.id)}"
              style="display:none;"
            >

              <div class="field-row">

                <div class="field">

                  <label>
                    Nova data
                  </label>

                  <input
                    type="date"
                    id="editDate_${escapeAttr(task.id)}"
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
                    id="editTime_${escapeAttr(task.id)}"
                    value="${escapeAttr(
                      task.time || ''
                    )}"
                  >

                </div>

              </div>


              <button
                class="btn btn-accent"
                type="button"
                onclick="saveEditRequest('${escapeAttr(task.id)}')"
              >
                💾 Salvar alterações
              </button>

            </div>
          `
          : ''
      }

    </div>

  `;


  return html;

}


/* ============================================================
   CHAT — UTILITÁRIOS
============================================================ */


/**
 * Obtém o usuário autenticado.
 */
async function getAuthenticatedUser() {

  if (!sb) {

    return null;

  }


  try {

    const {
      data,
      error
    } = await sb.auth.getSession();


    if (
      error ||
      !data?.session?.user
    ) {

      return null;

    }


    return data.session.user;

  }
  catch (error) {

    console.error(
      'Erro ao obter usuário autenticado:',
      error
    );

    return null;

  }

}


/**
 * Obtém a conversa vinculada à tarefa.
 *
 * RELAÇÃO CORRETA:
 *
 * conversations.task_id
 * =
 * cleaning_requests.id
 */
async function getConversationByTask(
  taskId
) {

  if (!sb || !taskId) {

    return {
      data: null,
      error: new Error(
        'Task ID não informado.'
      )
    };

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

  }


  return {
    data: data || null,
    error
  };

}


/**
 * Obtém ou cria a conversa de uma tarefa.
 *
 * O profissional e o cliente são
 * obtidos da própria cleaning_requests.
 */
async function getOrCreateConversation(
  taskId
) {

  if (!sb || !taskId) {

    return {
      data: null,
      error: new Error(
        'Tarefa não informada.'
      )
    };

  }


  /*
   * Usuário autenticado
   */

  const user =
    await getAuthenticatedUser();


  if (!user) {

    return {
      data: null,
      error: new Error(
        'Usuário não autenticado.'
      )
    };

  }


  /*
   * Primeiro tenta encontrar
   * uma conversa existente.
   */

  const existing =
    await getConversationByTask(
      taskId
    );


  if (existing.error) {

    return existing;

  }


  if (existing.data) {

    return existing;

  }


  /*
   * Busca os participantes na tarefa.
   */

  const {
    data: task,
    error: taskError
  } = await sb
    .from('cleaning_requests')
    .select(
      'id, client_id, professional_id'
    )
    .eq(
      'id',
      taskId
    )
    .maybeSingle();


  if (taskError) {

    console.error(
      'Erro ao buscar tarefa para chat:',
      taskError
    );

    return {
      data: null,
      error: taskError
    };

  }


  if (!task) {

    return {
      data: null,
      error: new Error(
        'Tarefa não encontrada.'
      )
    };

  }


  /*
   * Verifica se o usuário faz
   * parte da conversa.
   *
   * Admin também pode acessar.
   */

  const profile =
    await getCurrentProfile(
      user.id
    );


  const isAdmin =
    profile?.role === 'admin';


  const isClient =
    task.client_id === user.id;


  const isProfessional =
    task.professional_id === user.id;


  if (
    !isAdmin &&
    !isClient &&
    !isProfessional
  ) {

    return {
      data: null,
      error: new Error(
        'Você não tem acesso ao chat desta tarefa.'
      )
    };

  }


  /*
   * Não existe conversa.
   *
   * Cria usando:
   *
   * task_id
   * client_id
   * professional_id
   */

  const {
    data: created,
    error: createError
  } = await sb
    .from('conversations')
    .insert({

      task_id:
        task.id,

      client_id:
        task.client_id,

      professional_id:
        task.professional_id

    })
    .select('*')
    .single();


  /*
   * Pode ocorrer conflito se
   * outro cliente/aba criou a conversa
   * exatamente ao mesmo tempo.
   *
   * Nesse caso tenta buscar novamente.
   */

  if (
    createError
  ) {

    console.warn(
      'Não foi possível criar conversa. Tentando localizar existente:',
      createError
    );


    const retry =
      await getConversationByTask(
        taskId
      );


    if (
      retry.data
    ) {

      return retry;

    }


    return {
      data: null,
      error: createError
    };

  }


  return {
    data: created,
    error: null
  };

}


/**
 * Abre o chat da tarefa.
 */
function openChat(
  taskId
) {

  if (!taskId) {

    showSnackbar(
      'Não foi possível abrir o chat.'
    );

    return;

  }


  const url =
    `chat.html?task=${encodeURIComponent(
      taskId
    )}`;


  window.location.href =
    url;

}


/**
 * Obtém o task ID da URL.
 *
 * Aceita:
 *
 * ?task=UUID
 *
 * Também aceita:
 *
 * ?task_id=UUID
 *
 * para compatibilidade.
 */
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
      'Erro ao obter task ID:',
      error
    );

    return '';

  }

}


/* ============================================================
   CHAT — MENSAGENS
============================================================ */


/**
 * Busca mensagens de uma conversa.
 */
async function getChatMessages(
  conversationId
) {

  if (
    !sb ||
    !conversationId
  ) {

    return {
      data: [],
      error: new Error(
        'Conversation ID não informado.'
      )
    };

  }


  const {
    data,
    error
  } = await sb
    .from('messages')
    .select(
      'id, conversation_id, sender_id, content, created_at'
    )
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


  if (error) {

    console.error(
      'Erro ao carregar mensagens:',
      error
    );

  }


  return {
    data: data || [],
    error
  };

}


/**
 * Envia mensagem.
 */
async function sendChatMessage(
  conversationId,
  content
) {

  if (!sb) {

    return {
      data: null,
      error: new Error(
        'Supabase não configurado.'
      )
    };

  }


  const text =
    String(
      content || ''
    ).trim();


  if (!conversationId) {

    return {
      data: null,
      error: new Error(
        'Conversa não informada.'
      )
    };

  }


  if (!text) {

    return {
      data: null,
      error: new Error(
        'Digite uma mensagem.'
      )
    };

  }


  const user =
    await getAuthenticatedUser();


  if (!user) {

    return {
      data: null,
      error: new Error(
        'Usuário não autenticado.'
      )
    };

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
        text

    })
    .select(
      'id, conversation_id, sender_id, content, created_at'
    )
    .single();


  if (error) {

    console.error(
      'Erro ao enviar mensagem:',
      error
    );

  }


  return {
    data: data || null,
    error
  };

}


/* ============================================================
   CHAT — REALTIME
============================================================ */

let chatRealtimeChannel =
  null;


/**
 * Inicia realtime das mensagens.
 *
 * Escuta SOMENTE a conversa atual.
 */
function startChatRealtime(
  conversationId,
  callback
) {

  if (
    !sb ||
    !conversationId
  ) {

    return null;

  }


  stopChatRealtime();


  const channelName =
    'cleansync-chat-' +
    String(conversationId) +
    '-' +
    Date.now();


  chatRealtimeChannel =
    sb
      .channel(
        channelName
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
              typeof callback ===
              'function'
            ) {

              callback(
                payload.new,
                payload
              );

            }

          }
          catch (error) {

            console.error(
              'Erro no callback do chat:',
              error
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


/**
 * Para realtime do chat.
 */
function stopChatRealtime() {

  if (
    sb &&
    chatRealtimeChannel
  ) {

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

  }


  chatRealtimeChannel =
    null;

}


/**
 * Inicialização automática
 * do chat.html.
 *
 * Esta função não exige que
 * chat.html use obrigatoriamente
 * uma estrutura específica.
 *
 * Se os elementos existirem,
 * ela conecta automaticamente:
 *
 * #chatMessages
 * #chatInput
 * #chatSendButton
 * #chatTitle
 */
async function initializeChatPage() {

  /*
   * Só executa se estiver
   * realmente na página do chat.
   */

  const isChatPage =
    /chat\.html$/i.test(
      window.location.pathname
    ) ||
    document.getElementById(
      'chatMessages'
    ) ||
    document.getElementById(
      'chatInput'
    );


  if (!isChatPage) {

    return null;

  }


  const taskId =
    getChatTaskId();


  if (!taskId) {

    console.warn(
      'Chat: task ID não informado.'
    );

    return null;

  }


  const user =
    await getAuthenticatedUser();


  if (!user) {

    window.location.href =
      'index.html';

    return null;

  }


  /*
   * Obtém/cria conversa.
   */

  const conversationResult =
    await getOrCreateConversation(
      taskId
    );


  if (
    conversationResult.error ||
    !conversationResult.data
  ) {

    console.error(
      'Erro ao abrir conversa:',
      conversationResult.error
    );


    showSnackbar(
      conversationResult.error?.message ||
      'Não foi possível abrir o chat.'
    );


    return null;

  }


  const conversation =
    conversationResult.data;


  /*
   * Carrega título da tarefa
   * quando possível.
   */

  const {
    data: task
  } = await sb
    .from('cleaning_requests')
    .select(
      'id, ref_code, address, client_id, professional_id'
    )
    .eq(
      'id',
      taskId
    )
    .maybeSingle();


  const chatTitle =
    document.getElementById(
      'chatTitle'
    );


  if (chatTitle) {

    chatTitle.textContent =
      task?.ref_code
        ? `Chat — ${task.ref_code}`
        : 'Chat da limpeza';

  }


  /*
   * Carrega mensagens.
   */

  const messagesResult =
    await getChatMessages(
      conversation.id
    );


  if (
    messagesResult.error
  ) {

    showSnackbar(
      'Erro ao carregar mensagens.'
    );

  }


  /*
   * Renderizador padrão.
   *
   * Se o chat.html possuir
   * uma função própria chamada
   * window.renderChatMessages,
   * usamos ela.
   */

  const renderMessages =
    messages => {

      if (
        typeof window.renderChatMessages ===
        'function'
      ) {

        window.renderChatMessages(
          messages,
          user.id,
          conversation
        );

        return;

      }


      const container =
        document.getElementById(
          'chatMessages'
        );


      if (!container) {

        return;

      }


      container.innerHTML =
        messages.map(
          message => {

            const own =
              message.sender_id ===
              user.id;


            const time =
              message.created_at
                ? new Date(
                    message.created_at
                  ).toLocaleTimeString(
                    'pt-BR',
                    {
                      hour: '2-digit',
                      minute: '2-digit'
                    }
                  )
                : '';


            return `

              <div
                class="chat-message ${
                  own
                    ? 'chat-message-own'
                    : 'chat-message-other'
                }"
                data-message-id="${escapeAttr(
                  message.id
                )}"
              >

                <div class="chat-message-content">
                  ${escapeHtml(
                    message.content
                  )}
                </div>

                <div class="chat-message-time">
                  ${escapeHtml(
                    time
                  )}
                </div>

              </div>

            `;

          }
        ).join('');


      container.scrollTop =
        container.scrollHeight;

    };


  renderMessages(
    messagesResult.data || []
  );


  /*
   * Realtime.
   */

  startChatRealtime(
    conversation.id,
    async message => {

      /*
       * Se o chat.html possui
       * renderizador próprio,
       * deixa ele cuidar da UI.
       */

      if (
        typeof window.handleIncomingChatMessage ===
        'function'
      ) {

        window.handleIncomingChatMessage(
          message,
          user.id,
          conversation
        );

        return;

      }


      /*
       * Caso contrário,
       * adiciona a mensagem
       * carregando novamente
       * apenas quando necessário.
       */

      const latest =
        await getChatMessages(
          conversation.id
        );


      if (!latest.error) {

        renderMessages(
          latest.data
        );

      }

    }
  );


  /*
   * Envio de mensagem padrão.
   */

  const input =
    document.getElementById(
      'chatInput'
    );


  const sendButton =
    document.getElementById(
      'chatSendButton'
    ) ||
    document.getElementById(
      'sendChatButton'
    );


  async function sendCurrentMessage() {

    if (!input) {

      return;

    }


    const text =
      input.value.trim();


    if (!text) {

      return;

    }


    if (sendButton) {

      sendButton.disabled =
        true;

    }


    const result =
      await sendChatMessage(
        conversation.id,
        text
      );


    if (sendButton) {

      sendButton.disabled =
        false;

    }


    if (result.error) {

      showSnackbar(
        result.error.message ||
        'Erro ao enviar mensagem.'
      );

      return;

    }


    input.value = '';


    /*
     * Em instalações onde o Realtime
     * demora alguns instantes,
     * atualizamos imediatamente.
     */

    if (
      result.data
    ) {

      if (
        typeof window.handleIncomingChatMessage ===
        'function'
      ) {

        window.handleIncomingChatMessage(
          result.data,
          user.id,
          conversation
        );

      }
      else {

        const latest =
          await getChatMessages(
            conversation.id
          );


        if (!latest.error) {

          renderMessages(
            latest.data
          );

        }

      }

    }

  }


  if (sendButton) {

    /*
     * Remove listeners anteriores
     * registrados pela função.
     */

    if (
      !sendButton.dataset.cleansyncBound
    ) {

      sendButton.addEventListener(
        'click',
        sendCurrentMessage
      );


      sendButton.dataset.cleansyncBound =
        'true';

    }

  }


  if (input) {

    if (
      !input.dataset.cleansyncBound
    ) {

      input.addEventListener(
        'keydown',
        event => {

          /*
           * Enter envia.
           *
           * Shift + Enter
           * cria nova linha.
           */

          if (
            event.key === 'Enter' &&
            !event.shiftKey
          ) {

            event.preventDefault();

            sendCurrentMessage();

          }

        }
      );


      input.dataset.cleansyncBound =
        'true';

    }

  }


  return {

    taskId,

    conversation,

    user,

    task,

    messages:
      messagesResult.data || []

  };

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
            new Date(start);


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
   REALTIME — TAREFAS
============================================================ */

let realtimeChannel = null;


function startRealtime(
  callback
) {

  if (!sb) {

    return null;

  }


  if (realtimeChannel) {

    try {

      sb.removeChannel(
        realtimeChannel
      );

    }
    catch (error) {

      console.warn(
        error
      );

    }

  }


  realtimeChannel =
    sb
      .channel(
        'cleansync-global-' +
        Date.now()
      )


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
              'Realtime callback error:',
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
   ADMIN
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
    .from(
      'cleaning_requests'
    )
    .update(
      fields
    )
    .eq(
      'id',
      id
    );

}


/* ============================================================
   PÁGINA DE CLIENTE
============================================================ */

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
    form.style.display ===
    'none' ||
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


  const {
    error
  } = await sb
    .from(
      'cleaning_requests'
    )
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
   CRONÔMETRO — CONTROLE
============================================================ */

async function startTimer(
  id
) {

  if (!id) {

    return;

  }


  const {
    data: existing,
    error: fetchError
  } = await sb
    .from(
      'cleaning_requests'
    )
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
    .from(
      'cleaning_requests'
    )
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


async function stopTimer(
  id
) {

  if (!id) {

    return;

  }


  const {
    error
  } = await sb
    .from(
      'cleaning_requests'
    )
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
    !itemId
  ) {

    return;

  }


  const {
    data: row,
    error: fetchError
  } = await sb
    .from(
      'cleaning_requests'
    )
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
          item.id === itemId
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
    .from(
      'cleaning_requests'
    )
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

  if (!id) {

    return;

  }


  try {

    const {
      data: task,
      error: fetchError
    } = await sb
      .from(
        'cleaning_requests'
      )
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
      .from(
        'cleaning_requests'
      )
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
   NOTIFICAÇÃO DE TAREFA CONCLUÍDA
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
    !input
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
      .from(
        'cleaning_requests'
      )
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
      .from(
        'cleaning_requests'
      )
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
        item.id === itemId
          ? {
              ...item,
              label
            }
          : item
    );


  const {
    error
  } = await sb
    .from(
      'default_checklist'
    )
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
    .from(
      'default_checklist'
    )
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
        item.id !== itemId
    );


  const {
    error
  } = await sb
    .from(
      'default_checklist'
    )
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
   PWA / INSTALL BANNER
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
   INICIALIZAÇÃO GLOBAL
============================================================ */

document.addEventListener(
  'DOMContentLoaded',
  () => {

    setupInstallAndNotifyBanner();


    /*
     * Chat é inicializado somente
     * se chat.html / elementos de
     * chat estiverem presentes.
     */

    initializeChatPage()
      .catch(
        error => {

          console.error(
            'Erro na inicialização do chat:',
            error
          );

        }
      );

  }
);


/* ============================================================
   EXPORTAÇÃO GLOBAL
============================================================ */

Object.assign(
  window,
  {

    /* Supabase */

    sb,

    SUPABASE_URL,
    SUPABASE_ANON_KEY,


    /* Configuração */

    PRICE_BASE,
    PRICE_WITH_LAUNDRY,


    /* Helpers */

    debounce,
    escapeHtml,
    escapeAttr,

    formatDate,
    formatTime,
    formatCHF,
    formatDuration,


    /* Snackbar */

    showSnackbar,


    /* Sessão */

    getSession,
    saveSession,
    clearSession,


    /* Perfil */

    getCurrentProfile,
    getProfileName,
    getAuthenticatedUser,


    /* Auth */

    requireRole,
    logout,


    /* Checklist */

    getDefaultChecklist,
    normalizeChecklist,
    getChecklistProgress,

    getStatusLabel,
    getStatusClass,


    /* Tasks */

    renderTaskCard,

    updateTask,

    cancelRequest,

    toggleEditForm,
    saveEditRequest,

    adminDeleteTask,


    /* Chat */

    openChat,

    getChatTaskId,

    getConversationByTask,

    getOrCreateConversation,

    getChatMessages,

    sendChatMessage,

    startChatRealtime,

    stopChatRealtime,

    initializeChatPage,


    /* Realtime */

    startRealtime,


    /* Timer */

    attachTimers,

    startTimer,
    stopTimer,
    completeTask,


    /* Checklist */

    toggleChecklistItem,


    /* Fotos */

    uploadPhotos,


    /* Notificação */

    notifyTaskCompleted,


    /* Admin checklist */

    updateChecklistItemLabel,
    addChecklistItem,
    removeChecklistItem,


    /* PWA */

    setupInstallAndNotifyBanner,
    registerCleanSyncServiceWorker

  }
);


/* ============================================================
   LOG
============================================================ */

console.log(
  'CleanSync app-common carregado.'
);

console.log(
  'CleanSync Chat integrado: conversations.task_id → messages.conversation_id'
);