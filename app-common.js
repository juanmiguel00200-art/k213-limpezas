/* ============================================================
   CLEANSYNC — APP COMMON
   VERSÃO DEFINITIVA
   ============================================================

   Compatível com:

   cliente.html
   profissional.html
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
============================================================ */


/* ============================================================
   SUPABASE
============================================================ */

const SUPABASE_URL =
  window.SUPABASE_URL ||
  'https://oyxmrrazgjdnyzhyinhc.supabase.co';

const SUPABASE_ANON_KEY =
  window.SUPABASE_ANON_KEY ||
  'sb_publishable_IVWPCoIWVhkvP_u7J0ZTsA_QeK-MNNI';


if (
  !window.supabase
) {

  console.error(
    'Supabase JS não foi carregado.'
  );

}


let sb = null;


try {

  sb = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

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

window.CleanSync = window.CleanSync || {};

window.CleanSync.supabase = sb;


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
function formatDate(
  value
) {

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
function formatTime(
  value
) {

  if (!value) {
    return '—';
  }

  return String(value)
    .slice(0, 5);

}


/**
 * Formatação CHF
 */
function formatCHF(
  value
) {

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


function saveSession(
  data
) {

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
 *
 * Aceita:
 * full_name
 * name
 * display_name
 * username
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


  /*
   * Compatibilidade:
   *
   * cliente
   * profissional
   * admin
   */

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


  /*
   * Salva sessão local auxiliar
   */

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


  /*
   * Atualiza nome no topo
   */

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


  /*
   * Mostra link de admin
   */

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
    mode === 'cleaner';


  const isClient =
    mode === 'client';


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

        <!-- CHAT -->

        <button
          class="btn btn-outline"
          type="button"
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
   CHAT
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
   REALTIME
============================================================ */

let realtimeChannel = null;


function startRealtime(
  callback
) {

  if (!sb) {

    return null;

  }


  if (realtimeChannel) {

    sb.removeChannel(
      realtimeChannel
    );

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


  /*
   * Atualiza a página de tarefas
   */

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

  if (!sb || !id) {

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
   Funções utilizadas pelo cliente.html
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
   CRONÔMETRO
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

  if (!id || !itemId) {
    return;
  }


  /*
   * Busca checklist atual
   */

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


  /*
   * Atualiza visualmente sem
   * necessariamente recarregar tudo
   */

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

    /*
     * Busca tarefa
     */

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


    /*
     * Checklist
     */

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


    /*
     * Cronômetro
     */

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


    /*
     * Conclusão
     */

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


    /*
     * Notificação
     *
     * A Edge Function é opcional.
     * Se existir, tenta chamar.
     */

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

  if (!task || !sb) {
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

    /*
     * A tarefa já foi concluída.
     * Falha da notificação não desfaz a conclusão.
     */

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

  if (!id || !input) {
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

      /*
       * Limite simples de segurança
       */

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


    /*
     * Busca fotos existentes
     */

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

  /*
   * Não cria banner agressivo.
   * Apenas prepara instalação PWA.
   */

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

  }
);


/* ============================================================
   EXPORTAÇÃO GLOBAL
   Necessário porque seus HTMLs chamam
   essas funções diretamente.
============================================================ */

Object.assign(
  window,
  {

    sb,

    SUPABASE_URL,
    SUPABASE_ANON_KEY,

    PRICE_BASE,
    PRICE_WITH_LAUNDRY,

    debounce,
    escapeHtml,
    escapeAttr,

    formatDate,
    formatTime,
    formatCHF,
    formatDuration,

    showSnackbar,

    getSession,
    saveSession,
    clearSession,

    getCurrentProfile,
    getProfileName,

    requireRole,
    logout,

    getDefaultChecklist,
    normalizeChecklist,
    getChecklistProgress,

    getStatusLabel,
    getStatusClass,

    renderTaskCard,

    openChat,

    startRealtime,

    attachTimers,

    startTimer,
    stopTimer,
    completeTask,

    toggleChecklistItem,

    uploadPhotos,

    toggleEditForm,
    saveEditRequest,
    cancelRequest,

    adminDeleteTask,

    updateTask,

    updateChecklistItemLabel,
    addChecklistItem,
    removeChecklistItem,

    notifyTaskCompleted,

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