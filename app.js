/**
 * COA — Sistema de Manutenções | app.js
 * Arquitetura modular funcional (sem frameworks)
 * Supabase REST API via fetch nativo
 */

'use strict';

/* ═══════════════════════════════════════════════════════════════════
   0. CONFIGURAÇÃO — Supabase
═══════════════════════════════════════════════════════════════════ */
const SUPABASE_URL    = 'https://srujirreecfntfikenen.supabase.co';
const SUPABASE_ANON   = 'sb_publishable__BX6iM0x3zjzqh070tELzA_tKvPaIUT';
const TABLE           = 'manutencoes';

/* ═══════════════════════════════════════════════════════════════════
   1. CLIENTE SUPABASE — wrapper fetch
═══════════════════════════════════════════════════════════════════ */
const Supabase = (() => {
  let _session = null;

  /** Headers base para todas as requisições */
  function headers(extra = {}) {
    const h = {
      'apikey': SUPABASE_ANON,
      'Content-Type': 'application/json',
      ...extra,
    };
    if (_session?.access_token) {
      h['Authorization'] = `Bearer ${_session.access_token}`;
    }
    return h;
  }

  /** Cadastro com e-mail e senha */
  async function signUp(email, password, fullName) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/signup`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          email,
          password,
          data: { full_name: fullName },
        }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.message || 'Erro ao criar conta');
    // Alguns projetos Supabase requerem confirmação de e-mail;
    // retornamos o objeto para o chamador decidir o fluxo.
    return data;
  }

  /** Login com e-mail e senha */
  async function signIn(email, password) {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ email, password }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      const msg = data.error_description || data.msg || data.message || '';
      // Mensagem amigável para e-mail não confirmado
      if (msg.toLowerCase().includes('email not confirmed') || msg.toLowerCase().includes('email_not_confirmed')) {
        throw new Error('E-mail ainda não confirmado. Verifique sua caixa de entrada ou peça ao administrador para desativar a confirmação de e-mail no Supabase.');
      }
      if (msg.toLowerCase().includes('invalid login') || msg.toLowerCase().includes('invalid credentials')) {
        throw new Error('E-mail ou senha incorretos. Verifique suas credenciais.');
      }
      throw new Error(msg || 'Erro de autenticação. Tente novamente.');
    }
    _session = data;
    persistSession(data);
    return data;
  }

  /** Logout */
  async function signOut() {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: headers(),
      });
    } finally {
      _session = null;
      clearSession();
    }
  }

  /** Restaurar sessão do localStorage */
  function restoreSession() {
    try {
      const raw = localStorage.getItem('coa_session');
      if (!raw) return null;
      const s = JSON.parse(raw);
      // Verificar expiração
      if (s.expires_at && Date.now() / 1000 > s.expires_at) {
        clearSession();
        return null;
      }
      _session = s;
      return s;
    } catch { return null; }
  }

  function persistSession(s) {
    localStorage.setItem('coa_session', JSON.stringify(s));
  }
  function clearSession() {
    localStorage.removeItem('coa_session');
  }

  /** SELECT com filtros opcionais */
  async function select(table, { filters = '', order = 'created_at.desc' } = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=${order}`;
    if (filters) url += `&${filters}`;
    const res = await fetch(url, { headers: headers({ 'Prefer': 'return=representation' }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao buscar dados');
    return data;
  }

  /** INSERT */
  async function insert(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao inserir');
    return Array.isArray(data) ? data[0] : data;
  }

  /** UPDATE por id */
  async function update(table, id, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: headers({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Erro ao atualizar');
    return Array.isArray(data) ? data[0] : data;
  }

  return { signIn, signUp, signOut, restoreSession, select, insert, update, getSession: () => _session };
})();

/* ═══════════════════════════════════════════════════════════════════
   2. MÓDULO DE ESTADO
═══════════════════════════════════════════════════════════════════ */
const State = (() => {
  let _all     = [];   // lista completa do banco
  let _filters = { status: '', categoria: '', search: '' };

  function setAll(list) { _all = list; }
  function getAll()     { return _all; }
  function setFilter(key, val) { _filters[key] = val; }
  function getFiltered() {
    return _all.filter(m => {
      const matchStatus    = !_filters.status    || m.status === _filters.status;
      const matchCategoria = !_filters.categoria || m.categoria === _filters.categoria;
      const matchSearch    = !_filters.search
        || m.titulo.toLowerCase().includes(_filters.search.toLowerCase())
        || (m.descricao || '').toLowerCase().includes(_filters.search.toLowerCase());
      return matchStatus && matchCategoria && matchSearch;
    });
  }

  return { setAll, getAll, setFilter, getFiltered };
})();

/* ═══════════════════════════════════════════════════════════════════
   3. UTILITÁRIOS
═══════════════════════════════════════════════════════════════════ */
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function statusClass(status) {
  const map = {
    'Na Fila':            'status-na-fila',
    'Em Andamento':       'status-em-andamento',
    'Aguardando Terceiro':'status-aguardando',
    'Realizada':          'status-realizada',
  };
  return map[status] || '';
}

function catClass(cat) {
  const map = {
    'Software':     'cat-software',
    'Hardware':     'cat-hardware',
    'Mecânica':     'cat-mecanica',
    'Elétrica':     'cat-eletrica',
    'Apoio':        'cat-apoio',
    'Solinftec':    'cat-solinftec',
    'Administrativo':'cat-admin',
  };
  return map[cat] || '';
}

function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

/* ═══════════════════════════════════════════════════════════════════
   4. MÓDULO DE TELAS
═══════════════════════════════════════════════════════════════════ */
const Screens = (() => {
  function show(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.style.display = '';
    });
    const target = document.getElementById(id);
    if (target) {
      // pequena espera para o display:flex + opacity transition funcionar
      requestAnimationFrame(() => {
        target.classList.add('active');
      });
    }
  }
  return { show };
})();

/* ═══════════════════════════════════════════════════════════════════
   5. MÓDULO DE AUTENTICAÇÃO
═══════════════════════════════════════════════════════════════════ */
const Auth = (() => {
  function init() {
    const session = Supabase.restoreSession();
    if (session) {
      setUserDisplay(session);
      Screens.show('screen-dashboard');
      Dashboard.load();
    } else {
      Screens.show('screen-login');
    }
  }

  function setUserDisplay(session) {
    const email = session?.user?.email || '';
    document.getElementById('user-display').textContent = email;
  }

  async function login(email, password) {
    const session = await Supabase.signIn(email, password);
    setUserDisplay(session);
    Screens.show('screen-dashboard');
    Dashboard.load();
  }

  async function logout() {
    await Supabase.signOut();
    document.getElementById('user-display').textContent = '';
    Screens.show('screen-login');
  }

  return { init, login, logout };
})();

/* ═══════════════════════════════════════════════════════════════════
   6. MÓDULO DO DASHBOARD
═══════════════════════════════════════════════════════════════════ */
const Dashboard = (() => {

  function renderStats(list) {
    const count = (status) => list.filter(m => m.status === status).length;
    document.getElementById('stat-fila').textContent      = count('Na Fila');
    document.getElementById('stat-andamento').textContent = count('Em Andamento');
    document.getElementById('stat-terceiro').textContent  = count('Aguardando Terceiro');
    document.getElementById('stat-realizada').textContent = count('Realizada');
  }

  function renderTable(list) {
    const tbody  = document.getElementById('maint-tbody');
    const empty  = document.getElementById('empty-state');
    const loader = document.getElementById('table-loader');

    loader.classList.add('hidden');

    if (list.length === 0) {
      tbody.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    tbody.innerHTML = list.map(m => `
      <tr data-id="${m.id}">
        <td><strong>${escapeHtml(m.titulo)}</strong></td>
        <td><span class="badge-cat ${catClass(m.categoria)}">${escapeHtml(m.categoria)}</span></td>
        <td><span class="badge-status ${statusClass(m.status)}">${escapeHtml(m.status)}</span></td>
        <td>${escapeHtml(m.solicitante_nome || '—')}</td>
        <td>${formatDate(m.data_solicitacao)}</td>
        <td>${formatDate(m.data_conclusao)}</td>
        <td>
          <button class="btn-row-edit" data-id="${m.id}" aria-label="Editar manutenção ${escapeHtml(m.titulo)}">
            ✏️ Editar
          </button>
        </td>
      </tr>
    `).join('');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async function load() {
    const loader = document.getElementById('table-loader');
    const tbody  = document.getElementById('maint-tbody');
    loader.classList.remove('hidden');
    tbody.innerHTML = '';
    document.getElementById('empty-state').classList.add('hidden');

    try {
      const data = await Supabase.select(TABLE);
      State.setAll(data);
      const filtered = State.getFiltered();
      renderStats(data);
      renderTable(filtered);
    } catch (err) {
      loader.classList.add('hidden');
      showToast('Erro ao carregar manutenções: ' + err.message, 'error');
    }
  }

  function applyFilters() {
    const filtered = State.getFiltered();
    renderTable(filtered);
  }

  return { load, applyFilters, escapeHtml };
})();

/* ═══════════════════════════════════════════════════════════════════
   7. MÓDULO DO MODAL DE MANUTENÇÃO
═══════════════════════════════════════════════════════════════════ */
const Modal = (() => {
  let _editingId = null;

  function open(maintenance = null) {
    _editingId = maintenance?.id || null;
    const isEdit = !!_editingId;

    document.getElementById('modal-title').textContent = isEdit ? 'Editar Manutenção' : 'Nova Manutenção';
    document.getElementById('modal-id').value          = maintenance?.id || '';
    document.getElementById('m-titulo').value          = maintenance?.titulo || '';
    document.getElementById('m-descricao').value       = maintenance?.descricao || '';
    document.getElementById('m-solucao').value         = maintenance?.solucao || '';
    document.getElementById('m-categoria').value       = maintenance?.categoria || '';
    document.getElementById('m-status').value          = maintenance?.status || 'Na Fila';
    document.getElementById('m-data-sol').value        = maintenance?.data_solicitacao
      ? formatDate(maintenance.data_solicitacao)
      : formatDate(new Date().toISOString());
    document.getElementById('m-data-conc').value       = maintenance?.data_conclusao
      ? formatDate(maintenance.data_conclusao)
      : '';

    // Solicitante: quem está logado
    const session = Supabase.getSession();
    document.getElementById('m-solicitante').value = maintenance?.solicitante_nome
      || session?.user?.email
      || '';

    document.getElementById('modal-error').textContent = '';
    document.getElementById('modal-overlay').classList.remove('hidden');

    // Focar no título
    setTimeout(() => document.getElementById('m-titulo').focus(), 100);
  }

  function close() {
    document.getElementById('modal-overlay').classList.add('hidden');
    _editingId = null;
  }

  async function save() {
    const titulo     = document.getElementById('m-titulo').value.trim();
    const categoria  = document.getElementById('m-categoria').value;
    const status     = document.getElementById('m-status').value;
    const descricao  = document.getElementById('m-descricao').value.trim();
    const solucao    = document.getElementById('m-solucao').value.trim();
    const errorEl    = document.getElementById('modal-error');

    errorEl.textContent = '';

    if (!titulo) {
      errorEl.textContent = 'O título é obrigatório.';
      document.getElementById('m-titulo').focus();
      return;
    }
    if (!categoria) {
      errorEl.textContent = 'Selecione uma categoria.';
      return;
    }

    // Mostrar loader
    const btnText   = document.getElementById('btn-save-text');
    const btnLoader = document.getElementById('btn-save-loader');
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    document.getElementById('btn-modal-save').disabled = true;

    try {
      const session = Supabase.getSession();

      if (_editingId) {
        // EDIÇÃO
        const payload = {
          titulo, categoria, status, descricao, solucao,
          updated_at: new Date().toISOString(),
        };
        // Se mudou para "Realizada", registrar data de conclusão
        if (status === 'Realizada') {
          const existing = State.getAll().find(m => m.id === _editingId);
          if (!existing?.data_conclusao) {
            payload.data_conclusao = new Date().toISOString();
          }
        } else {
          // Se saiu de "Realizada", limpar data
          payload.data_conclusao = null;
        }
        await Supabase.update(TABLE, _editingId, payload);
        showToast('Manutenção atualizada com sucesso!', 'success');
      } else {
        // CRIAÇÃO
        const payload = {
          titulo, categoria, status, descricao, solucao,
          data_solicitacao: new Date().toISOString(),
          solicitante_id:   session?.user?.id   || null,
          solicitante_nome: session?.user?.email || null,
          data_conclusao:   status === 'Realizada' ? new Date().toISOString() : null,
        };
        await Supabase.insert(TABLE, payload);
        showToast('Manutenção criada com sucesso!', 'success');
      }

      close();
      await Dashboard.load();

    } catch (err) {
      errorEl.textContent = err.message;
    } finally {
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
      document.getElementById('btn-modal-save').disabled = false;
    }
  }

  return { open, close, save };
})();

/* ═══════════════════════════════════════════════════════════════════
   8. EVENT LISTENERS
═══════════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {

  // ── Tabs Login / Cadastro ──
  function switchTab(tab) {
    const isLogin = tab === 'login';
    document.getElementById('tab-login').classList.toggle('active', isLogin);
    document.getElementById('tab-register').classList.toggle('active', !isLogin);
    document.getElementById('tab-login').setAttribute('aria-selected', isLogin);
    document.getElementById('tab-register').setAttribute('aria-selected', !isLogin);
    document.getElementById('panel-login').classList.toggle('hidden', !isLogin);
    document.getElementById('panel-register').classList.toggle('hidden', isLogin);
    // Limpar erros ao trocar de aba
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    document.getElementById('register-success').classList.add('hidden');
  }
  document.getElementById('tab-login').addEventListener('click',    () => switchTab('login'));
  document.getElementById('tab-register').addEventListener('click', () => switchTab('register'));

  // ── Login ──
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errEl    = document.getElementById('login-error');
    const btnText  = document.getElementById('btn-login-text');
    const btnLoad  = document.getElementById('btn-login-loader');

    errEl.textContent = '';
    btnText.classList.add('hidden');
    btnLoad.classList.remove('hidden');
    document.getElementById('btn-login').disabled = true;

    try {
      await Auth.login(email, password);
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btnText.classList.remove('hidden');
      btnLoad.classList.add('hidden');
      document.getElementById('btn-login').disabled = false;
    }
  });

  // Toggle visibilidade senha (login)
  document.getElementById('btn-toggle-pass').addEventListener('click', () => {
    const input = document.getElementById('login-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // Toggle visibilidade senha (cadastro)
  document.getElementById('btn-toggle-reg-pass').addEventListener('click', () => {
    const input = document.getElementById('reg-password');
    input.type = input.type === 'password' ? 'text' : 'password';
  });

  // ── Cadastro ──
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm  = document.getElementById('reg-confirm').value;
    const errEl    = document.getElementById('register-error');
    const succEl   = document.getElementById('register-success');
    const btnText  = document.getElementById('btn-register-text');
    const btnLoad  = document.getElementById('btn-register-loader');

    errEl.textContent = '';
    succEl.classList.add('hidden');

    if (!name)  { errEl.textContent = 'Informe seu nome completo.'; return; }
    if (!email) { errEl.textContent = 'Informe um e-mail válido.'; return; }
    if (password.length < 6) { errEl.textContent = 'A senha deve ter ao menos 6 caracteres.'; return; }
    if (password !== confirm) { errEl.textContent = 'As senhas não coincidem.'; return; }

    btnText.classList.add('hidden');
    btnLoad.classList.remove('hidden');
    document.getElementById('btn-register').disabled = true;

    try {
      const result = await Supabase.signUp(email, password, name);
      // Se o Supabase retornar sessão direto (confirmação de e-mail desativada)
      if (result.access_token) {
        Supabase.restoreSession();
        showToast('Conta criada! Bem-vindo(a)!', 'success');
        Auth.init();
      } else {
        // Confirmação de e-mail ativada
        succEl.textContent = '✅ Conta criada! Verifique seu e-mail para confirmar o cadastro e então faça o login.';
        succEl.classList.remove('hidden');
        document.getElementById('register-form').reset();
      }
    } catch (err) {
      errEl.textContent = err.message;
    } finally {
      btnText.classList.remove('hidden');
      btnLoad.classList.add('hidden');
      document.getElementById('btn-register').disabled = false;
    }
  });

  // ── Logout ──
  document.getElementById('btn-logout').addEventListener('click', () => Auth.logout());

  // ── Nova manutenção ──
  document.getElementById('btn-nova').addEventListener('click', () => Modal.open());
  document.getElementById('btn-empty-nova').addEventListener('click', () => Modal.open());

  // ── Filtros ──
  document.getElementById('filter-status').addEventListener('change', (e) => {
    State.setFilter('status', e.target.value);
    Dashboard.applyFilters();
  });
  document.getElementById('filter-categoria').addEventListener('change', (e) => {
    State.setFilter('categoria', e.target.value);
    Dashboard.applyFilters();
  });
  let searchTimer;
  document.getElementById('filter-search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      State.setFilter('search', e.target.value);
      Dashboard.applyFilters();
    }, 300);
  });

  // ── Stats clicáveis para filtrar ──
  document.querySelectorAll('.stat-card[data-filter-status]').forEach(card => {
    card.addEventListener('click', () => {
      const status = card.dataset.filterStatus;
      const select = document.getElementById('filter-status');
      // Toggle: se já filtrado, limpa
      if (select.value === status) {
        select.value = '';
        State.setFilter('status', '');
      } else {
        select.value = status;
        State.setFilter('status', status);
      }
      Dashboard.applyFilters();
    });
  });

  // ── Editar linha ──
  document.getElementById('maint-tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-row-edit');
    if (!btn) return;
    const id   = btn.dataset.id;
    const item = State.getAll().find(m => m.id === id);
    if (item) Modal.open(item);
  });

  // ── Modal fechar ──
  document.getElementById('btn-modal-close').addEventListener('click', Modal.close);
  document.getElementById('btn-modal-cancel').addEventListener('click', Modal.close);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === document.getElementById('modal-overlay')) Modal.close();
  });

  // ── Modal salvar ──
  document.getElementById('btn-modal-save').addEventListener('click', Modal.save);

  // ── Fechar modal com Escape ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') Modal.close();
  });

  // ── Inicializar autenticação ──
  Auth.init();
});
