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
   1.1 CLIENTE DO GATEWAY DE EQUIPAMENTOS (equipment-agent)
═══════════════════════════════════════════════════════════════════ */
const Gateway = (() => {
  let _fazendasCache = null;
  const _equipamentosCache = {};

  async function getFazendas() {
    if (_fazendasCache) return _fazendasCache;
    try {
      const res = await fetch('/api/gateway/fazendas');
      if (!res.ok) throw new Error('Erro ao obter fazendas');
      _fazendasCache = await res.json();
      return _fazendasCache;
    } catch (err) {
      console.warn('Falha no gateway de fazendas, utilizando lista padrão:', err.message);
      _fazendasCache = [
        { codigo: '5',  nome: '5 - São Manoel' },
        { codigo: '6',  nome: '6 - Tangara' },
        { codigo: '21', nome: '21 - São Pedro' },
        { codigo: '25', nome: '25 - São Judas' },
        { codigo: '26', nome: '26 - São Francisco' },
        { codigo: '33', nome: '33 - Santana' },
        { codigo: '34', nome: '34 - Santa Eliza' },
        { codigo: '36', nome: '36 - Santa Francisca' },
        { codigo: '17', nome: '17 - Santa Lucia 1' },
        { codigo: '24', nome: '24 - Santa Lucia 2' },
        { codigo: '18', nome: '18 - Caroline' },
        { codigo: '27', nome: '27 - São João' },
        { codigo: '28', nome: '28 - Santa Luzia' },
        { codigo: '10', nome: '10 - Santa Adelina' }
      ];
      return _fazendasCache;
    }
  }

  async function getEquipamentos(fazendaCod, search = '') {
    const cacheKey = `${fazendaCod}_${search}`;
    if (_equipamentosCache[cacheKey]) return _equipamentosCache[cacheKey];

    try {
      const params = new URLSearchParams();
      if (fazendaCod) params.set('fazenda', fazendaCod);
      if (search) params.set('search', search);

      const res = await fetch(`/api/gateway/equipamentos?${params.toString()}`);
      if (!res.ok) throw new Error('Erro ao obter equipamentos');
      const data = await res.json();
      _equipamentosCache[cacheKey] = data;
      return data;
    } catch (err) {
      console.warn('Falha no gateway de equipamentos:', err.message);
      return [];
    }
  }

  return { getFazendas, getEquipamentos };
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
        || (m.descricao || '').toLowerCase().includes(_filters.search.toLowerCase())
        || (m.solicitante_nome || '').toLowerCase().includes(_filters.search.toLowerCase())
        || (m.responsavel_nome || '').toLowerCase().includes(_filters.search.toLowerCase())
        || (m.fazenda || '').toLowerCase().includes(_filters.search.toLowerCase())
        || (m.frota || '').toLowerCase().includes(_filters.search.toLowerCase())
        || (m.equipamento || '').toLowerCase().includes(_filters.search.toLowerCase());
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

function getUserDisplayName(user) {
  if (!user) return 'Usuário';
  return (
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.raw_user_meta_data?.full_name ||
    (user.email ? user.email.split('@')[0] : 'Usuário')
  );
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
    const name = getUserDisplayName(session?.user);
    document.getElementById('user-display').textContent = `👤 ${name}`;
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
        <td>
          <strong>${escapeHtml(m.titulo)}</strong>
          ${m.equipamento ? `<div class="table-subtext">🚜 ${escapeHtml(m.equipamento)}</div>` : ''}
        </td>
        <td><span class="badge-farm">${escapeHtml(m.fazenda || '—')}</span></td>
        <td><span class="badge-frota">${escapeHtml(m.frota || '—')}</span></td>
        <td><span class="badge-cat ${catClass(m.categoria)}">${escapeHtml(m.categoria)}</span></td>
        <td><span class="badge-status ${statusClass(m.status)}">${escapeHtml(m.status)}</span></td>
        <td>${escapeHtml(m.solicitante_nome || '—')}</td>
        <td>${escapeHtml(m.responsavel_nome || '—')}</td>
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

  async function onFazendaChange(fazendaCod, selectedFrota = null) {
    const frotaSelect = document.getElementById('m-frota');
    frotaSelect.innerHTML = '<option value="" disabled selected>Carregando frotas...</option>';
    frotaSelect.disabled = true;

    if (!fazendaCod) {
      frotaSelect.innerHTML = '<option value="" disabled selected>Selecione a fazenda primeiro</option>';
      return;
    }

    const equipamentos = await Gateway.getEquipamentos(fazendaCod);
    frotaSelect.innerHTML = '<option value="" disabled selected>Selecione a frota</option>';

    equipamentos.forEach(eq => {
      const opt = document.createElement('option');
      const val = eq.frota || eq.codigo;
      opt.value = val;
      opt.dataset.desc = eq.descricao || '';
      opt.dataset.codigo = eq.codigo || '';
      opt.textContent = `${val} — ${eq.descricao}`;
      if (selectedFrota && (val === selectedFrota || eq.codigo === selectedFrota)) {
        opt.selected = true;
      }
      frotaSelect.appendChild(opt);
    });

    frotaSelect.disabled = false;
  }

  async function open(maintenance = null) {
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

    // Solicitante: campo preenchível pelo usuário
    document.getElementById('m-solicitante').value = maintenance?.solicitante_nome || '';

    // Responsável: registrado automaticamente com o usuário logado
    const session = Supabase.getSession();
    const currentUser = getUserDisplayName(session?.user);
    document.getElementById('m-responsavel').value = maintenance?.responsavel_nome || currentUser;

    // Equipamento
    document.getElementById('m-equipamento').value = maintenance?.equipamento || '';

    // Carregar Fazendas via Gateway
    const fazendaSelect = document.getElementById('m-fazenda');
    fazendaSelect.innerHTML = '<option value="" disabled selected>Carregando fazendas...</option>';
    const fazendas = await Gateway.getFazendas();

    fazendaSelect.innerHTML = '<option value="" disabled selected>Selecione a fazenda</option>';
    fazendas.forEach(f => {
      const opt = document.createElement('option');
      opt.value = f.codigo;
      opt.textContent = f.nome;
      if (maintenance?.fazenda && (maintenance.fazenda === f.codigo || maintenance.fazenda === f.nome)) {
        opt.selected = true;
      }
      fazendaSelect.appendChild(opt);
    });

    if (maintenance?.fazenda) {
      const match = fazendas.find(f => f.codigo === maintenance.fazenda || f.nome === maintenance.fazenda);
      const cod = match ? match.codigo : maintenance.fazenda;
      await onFazendaChange(cod, maintenance.frota);
    } else {
      const frotaSelect = document.getElementById('m-frota');
      frotaSelect.innerHTML = '<option value="" disabled selected>Selecione a fazenda primeiro</option>';
      frotaSelect.disabled = true;
    }

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
    const titulo      = document.getElementById('m-titulo').value.trim();
    const fazendaCod  = document.getElementById('m-fazenda').value;
    const frota       = document.getElementById('m-frota').value;
    const equipamento = document.getElementById('m-equipamento').value.trim();
    const categoria   = document.getElementById('m-categoria').value;
    const status      = document.getElementById('m-status').value;
    const solicitante = document.getElementById('m-solicitante').value.trim();
    const descricao   = document.getElementById('m-descricao').value.trim();
    const solucao     = document.getElementById('m-solucao').value.trim();
    const errorEl     = document.getElementById('modal-error');

    errorEl.textContent = '';

    if (!titulo) {
      errorEl.textContent = 'O título é obrigatório.';
      document.getElementById('m-titulo').focus();
      return;
    }
    if (!fazendaCod) {
      errorEl.textContent = 'Selecione uma fazenda.';
      document.getElementById('m-fazenda').focus();
      return;
    }
    if (!frota) {
      errorEl.textContent = 'Selecione uma frota.';
      document.getElementById('m-frota').focus();
      return;
    }
    if (!equipamento) {
      errorEl.textContent = 'O equipamento é obrigatório.';
      document.getElementById('m-equipamento').focus();
      return;
    }
    if (!categoria) {
      errorEl.textContent = 'Selecione uma categoria.';
      return;
    }
    if (!solicitante) {
      errorEl.textContent = 'O campo Solicitante é obrigatório.';
      document.getElementById('m-solicitante').focus();
      return;
    }

    const fazendaOpt = document.getElementById('m-fazenda').selectedOptions[0];
    const fazendaNome = fazendaOpt ? fazendaOpt.textContent : fazendaCod;

    // Mostrar loader
    const btnText   = document.getElementById('btn-save-text');
    const btnLoader = document.getElementById('btn-save-loader');
    btnText.classList.add('hidden');
    btnLoader.classList.remove('hidden');
    document.getElementById('btn-modal-save').disabled = true;

    try {
      const session = Supabase.getSession();
      const responsavelNome = getUserDisplayName(session?.user);

      if (_editingId) {
        // EDIÇÃO
        const payload = {
          titulo, categoria, status, descricao, solucao,
          solicitante_nome: solicitante,
          fazenda:          fazendaNome,
          frota:            frota,
          equipamento:      equipamento,
          updated_at:       new Date().toISOString(),
        };
        // Se mudou para "Realizada", registrar data de conclusão
        if (status === 'Realizada') {
          const existing = State.getAll().find(m => m.id === _editingId);
          if (!existing?.data_conclusao) {
            payload.data_conclusao = new Date().toISOString();
          }
        } else {
          payload.data_conclusao = null;
        }

        try {
          await Supabase.update(TABLE, _editingId, payload);
        } catch (updateErr) {
          const msg = updateErr.message || '';
          if (msg.includes('column') || msg.includes('schema cache')) {
            delete payload.responsavel_id;
            delete payload.responsavel_nome;
            delete payload.fazenda;
            delete payload.frota;
            delete payload.equipamento;
            await Supabase.update(TABLE, _editingId, payload);
            showToast('Manutenção atualizada! (Execute a migração SQL no Supabase para salvar as novas colunas)', 'warning');
          } else {
            throw updateErr;
          }
        }
        showToast('Manutenção atualizada com sucesso!', 'success');
      } else {
        // CRIAÇÃO
        const payload = {
          titulo, categoria, status, descricao, solucao,
          solicitante_nome: solicitante,
          responsavel_id:   session?.user?.id   || null,
          responsavel_nome: responsavelNome,
          fazenda:          fazendaNome,
          frota:            frota,
          equipamento:      equipamento,
          data_solicitacao: new Date().toISOString(),
          data_conclusao:   status === 'Realizada' ? new Date().toISOString() : null,
        };

        try {
          await Supabase.insert(TABLE, payload);
          showToast('Manutenção criada com sucesso!', 'success');
        } catch (insertErr) {
          const msg = insertErr.message || '';
          if (msg.includes('column') || msg.includes('schema cache')) {
            delete payload.responsavel_id;
            delete payload.responsavel_nome;
            delete payload.fazenda;
            delete payload.frota;
            delete payload.equipamento;
            await Supabase.insert(TABLE, payload);
            showToast('Manutenção criada! (Aviso: execute a migração SQL no Supabase para salvar fazenda/frota)', 'warning');
          } else {
            throw insertErr;
          }
        }
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

  return { open, close, save, onFazendaChange };
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

  // ── Gateway: Eventos de seleção no Modal ──
  document.getElementById('m-fazenda').addEventListener('change', async (e) => {
    const fazendaCod = e.target.value;
    document.getElementById('m-equipamento').value = '';
    await Modal.onFazendaChange(fazendaCod);
  });

  document.getElementById('m-frota').addEventListener('change', (e) => {
    const selectedOption = e.target.selectedOptions[0];
    const desc = selectedOption?.dataset?.desc || '';
    if (desc) {
      document.getElementById('m-equipamento').value = desc;
    }
  });

  // ── Fechar modal com Escape ──
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') Modal.close();
  });

  // ── Inicializar autenticação ──
  Auth.init();
});
