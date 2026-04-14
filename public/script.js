// ============================================
// CONFIGURAÇÃO
// ============================================
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-m1xw.onrender.com/api';
const NOTIFICATION_KEY = 'contasReceberNotificationShown';

let contas = [];
let isOnline = false;
let lastDataHash = '';
let sessionToken = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let showAllMonths = false;
let currentTabIndex = 0;
const tabs = ['tab-basico', 'tab-valores', 'tab-observacoes'];

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

console.log('🚀 Contas a Receber iniciada');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verificarAutenticacao);
} else {
    verificarAutenticacao();
}

// ============================================
// FORMATAÇÃO
// ============================================
function formatCurrency(valor) {
    return 'R$ ' + valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

// ============================================
// NAVEGAÇÃO MENSAL
// ============================================
function updateMonthDisplay() {
    const display = document.getElementById('currentMonth');
    if (display) {
        if (showAllMonths) {
            display.textContent = `Todos os meses de ${currentYear}`;
        } else {
            display.textContent = `${meses[currentMonth]} ${currentYear}`;
        }
    }
    updateDashboard();
    filterContas();
}

window.changeMonth = function(direction) {
    showAllMonths = false;
    currentMonth += direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateMonthDisplay();
};

window.toggleAllMonths = function() {
    showAllMonths = !showAllMonths;
    updateMonthDisplay();
};

// ============================================
// AUTENTICAÇÃO
// ============================================
function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('sessionToken');
    if (tokenFromUrl) {
        sessionToken = tokenFromUrl;
        sessionStorage.setItem('contasReceberSession', tokenFromUrl);
        window.history.replaceState({}, document.title, window.location.pathname);
    } else {
        sessionToken = sessionStorage.getItem('contasReceberSession');
    }
    if (!sessionToken) {
        mostrarTelaAcessoNegado();
        return;
    }
    inicializarApp();
}

function mostrarTelaAcessoNegado(mensagem = 'NÃO AUTORIZADO') {
    document.body.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: var(--bg-primary); color: var(--text-primary); text-align: center; padding: 2rem;">
            <h1 style="font-size: 2.2rem; margin-bottom: 1rem;">${mensagem}</h1>
            <p style="color: var(--text-secondary); margin-bottom: 2rem;">Somente usuários autenticados podem acessar esta área.</p>
            <a href="${PORTAL_URL}" style="display: inline-block; background: var(--btn-register); color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600;">Ir para o Portal</a>
        </div>
    `;
}

async function inicializarApp() {
    updateMonthDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    await loadContas();
    startPolling();
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            const formModal = document.getElementById('formModal');
            if (formModal && formModal.style.display === 'flex') {
                const active = document.activeElement;
                if (active && active.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    handleSubmit(e);
                }
            }
        }
    });
}

// ============================================
// CONEXÃO
// ============================================
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: { 'X-Session-Token': sessionToken, 'Accept': 'application/json' },
            mode: 'cors'
        });
        if (response.status === 401) {
            sessionStorage.removeItem('contasReceberSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }
        const wasOffline = !isOnline;
        isOnline = response.ok;
        if (wasOffline && isOnline) await loadContas();
        updateConnectionStatus();
        return isOnline;
    } catch {
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const el = document.getElementById('connectionStatus');
    if (el) el.className = isOnline ? 'connection-status online' : 'connection-status offline';
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function loadContas() {
    if (!isOnline) return;
    try {
        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: { 'X-Session-Token': sessionToken, 'Accept': 'application/json' },
            mode: 'cors'
        });
        if (response.status === 401) {
            sessionStorage.removeItem('contasReceberSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }
        if (!response.ok) return;
        const data = await response.json();
        contas = data.map(mapearConta);
        const newHash = JSON.stringify(contas.map(c => c.id));
        if (newHash !== lastDataHash) {
            lastDataHash = newHash;
            console.log(`${contas.length} contas carregadas`);
            updateAllFilters();
            updateDashboard();
            filterContas();
            verificarContasVencidas();
        }
    } catch (error) {
        console.error('Erro ao carregar:', error);
    }
}

function mapearConta(conta) {
    let observacoesArray = [];
    if (conta.observacoes) {
        if (Array.isArray(conta.observacoes)) observacoesArray = conta.observacoes;
        else if (typeof conta.observacoes === 'string') {
            try { observacoesArray = JSON.parse(conta.observacoes); } catch { observacoesArray = [{ texto: conta.observacoes, data: new Date().toISOString() }]; }
        } else if (typeof conta.observacoes === 'object') observacoesArray = [conta.observacoes];
    }
    return {
        id: conta.id,
        numero_nf: conta.numero_nf || '',
        orgao: conta.orgao || '',
        vendedor: conta.vendedor || '',
        banco: conta.banco || '',
        valor: parseFloat(conta.valor) || 0,
        valor_pago: parseFloat(conta.valor_pago) || 0,
        data_emissao: conta.data_emissao || '',
        data_vencimento: conta.data_vencimento || '',
        data_pagamento: conta.data_pagamento || null,
        status: conta.status || 'A RECEBER',
        tipo_nf: conta.tipo_nf || 'ENVIO',
        observacoes: observacoesArray,
        created_at: conta.created_at || new Date().toISOString()
    };
}

window.sincronizarDados = async function() {
    const btns = document.querySelectorAll('button[onclick="sincronizarDados()"]');
    btns.forEach(b => { const s = b.querySelector('svg'); if(s) s.style.animation = 'spin 1s linear infinite'; });
    await loadContas();
    showMessage('Dados sincronizados', 'success');
    setTimeout(() => {
        btns.forEach(b => { const s = b.querySelector('svg'); if(s) s.style.animation = ''; });
    }, 1000);
};

function startPolling() {
    setInterval(() => { if (isOnline) loadContas(); }, 30000);
}

// ============================================
// DASHBOARD (quantidade vencida universal)
// ============================================
function updateDashboard() {
    const contasPeriodo = contas.filter(c => {
        if (showAllMonths) {
            const data = new Date(c.data_emissao + 'T00:00:00');
            return data.getFullYear() === currentYear;
        } else {
            const data = new Date(c.data_emissao + 'T00:00:00');
            return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
        }
    });

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const totalFaturado = contasPeriodo.filter(c => !c.tipo_nf || c.tipo_nf === 'ENVIO').reduce((s,c) => s + c.valor, 0);
    const totalPago = contasPeriodo.filter(c => !c.tipo_nf || c.tipo_nf === 'ENVIO').reduce((s,c) => s + (c.valor_pago || 0), 0);
    
    // QUANTIDADE DE VENCIDAS (universal, sem filtro de período)
    const todasEnvio = contas.filter(c => !c.tipo_nf || c.tipo_nf === 'ENVIO');
    const quantidadeVencidas = todasEnvio.filter(c => {
        if (c.status === 'PAGO') return false;
        const venc = new Date(c.data_vencimento + 'T00:00:00');
        return venc < hoje;
    }).length;
    
    const totalReceber = totalFaturado - totalPago;
    document.getElementById('statFaturado').textContent = formatCurrency(totalFaturado);
    document.getElementById('statPago').textContent = formatCurrency(totalPago);
    document.getElementById('statReceber').textContent = formatCurrency(totalReceber);
    document.getElementById('statVencido').textContent = quantidadeVencidas;
    
    const badge = document.getElementById('pulseBadgeVencido');
    const card = document.getElementById('cardVencido');
    if (quantidadeVencidas > 0) {
        badge.style.display = 'flex';
        card.classList.add('has-alert');
    } else {
        badge.style.display = 'none';
        card.classList.remove('has-alert');
    }
}

function verificarContasVencidas() {
    if (sessionStorage.getItem(NOTIFICATION_KEY)) return;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const vencidas = contas.filter(c => {
        if (c.tipo_nf && c.tipo_nf !== 'ENVIO') return false;
        if (c.status === 'PAGO') return false;
        const venc = new Date(c.data_vencimento + 'T00:00:00');
        return venc < hoje;
    });
    if (vencidas.length > 0) {
        mostrarNotificacaoVencidos(vencidas);
        sessionStorage.setItem(NOTIFICATION_KEY, 'true');
    }
}

function mostrarNotificacaoVencidos(contasVencidas) {
    const total = contasVencidas.reduce((s,c) => s + c.valor, 0);
    const modal = document.createElement('div');
    modal.id = 'notificationModal';
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:500px; border:3px solid #EF4444;">
            <div class="modal-header" style="background:#EF4444; color:white;">
                <h3 style="margin:0;">⚠️ Contas Vencidas</h3>
                <button class="close-modal" onclick="fecharNotificacaoVencidos()">✕</button>
            </div>
            <div style="padding:1.5rem;">
                <p>Você possui <strong>${contasVencidas.length} ${contasVencidas.length === 1 ? 'conta vencida' : 'contas vencidas'}</strong></p>
                <div style="background:#FEE; border-left:4px solid #EF4444; padding:1rem; margin:1rem 0;">
                    <strong>Total vencido:</strong> ${formatCurrency(total)}
                </div>
                <button onclick="fecharNotificacaoVencidos()" style="width:100%; background:#EF4444;">Entendi</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}
window.fecharNotificacaoVencidos = function() {
    const modal = document.getElementById('notificationModal');
    if (modal) modal.remove();
};

// ============================================
// MODAL DE VENCIDOS (lista)
// ============================================
let vencidosPage = 1;
const VENCIDOS_PER_PAGE = 5;
let vencidosData = [];

function renderVencidosTable() {
    const start = (vencidosPage-1)*VENCIDOS_PER_PAGE;
    const page = vencidosData.slice(start, start+VENCIDOS_PER_PAGE);
    const totalPages = Math.ceil(vencidosData.length / VENCIDOS_PER_PAGE);
    const body = document.getElementById('vencidosModalBody');
    if (!body) return;
    body.innerHTML = `
        <h3 style="color:#EF4444;">Contas Vencidas (${vencidosData.length})</h3>
        <div style="overflow-x:auto;">
            <table style="width:100%">
                <thead><tr><th>NF</th><th>Órgão</th><th>Valor</th><th>Vencimento</th></tr></thead>
                <tbody>
                    ${page.map(c => `
                        <tr>
                            <td><strong>${c.numero_nf}</strong></td>
                            <td>${c.orgao}</td>
                            <td>${formatCurrency(c.valor)}</td>
                            <td>${formatDate(c.data_vencimento)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <div style="display:flex; justify-content:center; gap:1rem; margin-top:1rem;">
            <button onclick="changeVencidosPage(-1)" ${vencidosPage===1?'disabled':''}>Anterior</button>
            <span>Página ${vencidosPage} de ${totalPages}</span>
            <button onclick="changeVencidosPage(1)" ${vencidosPage===totalPages?'disabled':''}>Próximo</button>
        </div>
    `;
}
window.changeVencidosPage = function(delta) {
    const total = Math.ceil(vencidosData.length / VENCIDOS_PER_PAGE);
    const newPage = vencidosPage + delta;
    if (newPage >=1 && newPage <= total) {
        vencidosPage = newPage;
        renderVencidosTable();
    }
};
window.showVencidosModal = function() {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    vencidosData = contas.filter(c => {
        if (c.tipo_nf && c.tipo_nf !== 'ENVIO') return false;
        if (c.status === 'PAGO') return false;
        const venc = new Date(c.data_vencimento + 'T00:00:00');
        return venc < hoje;
    });
    if (vencidosData.length === 0) {
        showMessage('Nenhuma conta vencida', 'error');
        return;
    }
    vencidosPage = 1;
    renderVencidosTable();
    document.getElementById('vencidosModal').style.display = 'flex';
};
window.closeVencidosModal = function() {
    document.getElementById('vencidosModal').style.display = 'none';
};

// ============================================
// FORMULÁRIO (com abas e observações)
// ============================================
window.toggleForm = () => showFormModal(null);

function showFormModal(editingId = null) {
    const isEditing = !!editingId;
    let conta = null;
    if (isEditing) conta = contas.find(c => c.id === editingId);
    currentTabIndex = 0;
    const obsHTML = (conta?.observacoes || []).map((obs, idx) => `
        <div class="observacao-item">
            <div class="observacao-header">
                <span class="observacao-data">${formatDateTime(obs.data)}</span>
                <button type="button" class="btn-remove-obs" onclick="removerObservacao(${idx})">✕</button>
            </div>
            <p class="observacao-texto">${obs.texto}</p>
        </div>
    `).join('');
    
    const modalHTML = `
        <div class="modal-overlay" id="formModal" style="display:flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${isEditing ? 'Editar Conta' : 'Nova Conta'}</h3>
                    <button class="close-modal" onclick="closeFormModal(false)">✕</button>
                </div>
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchFormTab(0)">Básico</button>
                        <button class="tab-btn" onclick="switchFormTab(1)">Valores</button>
                        <button class="tab-btn" onclick="switchFormTab(2)">Observações</button>
                    </div>
                    <form id="contaForm" onsubmit="handleSubmit(event)">
                        <input type="hidden" id="editId" value="${editingId || ''}">
                        <input type="hidden" id="observacoesData" value='${JSON.stringify(conta?.observacoes || [])}'>
                        <div class="tab-content active" id="tab-basico">
                            <div class="form-grid">
                                <div class="form-group"><label>Número NF *</label><input type="text" id="numero_nf" value="${conta?.numero_nf || ''}" required></div>
                                <div class="form-group"><label>Órgão *</label><input type="text" id="orgao" value="${conta?.orgao || ''}" required></div>
                                <div class="form-group"><label>Vendedor *</label>
                                    <select id="vendedor" required>
                                        <option value="">Selecione</option>
                                        <option value="ROBERTO" ${conta?.vendedor==='ROBERTO'?'selected':''}>ROBERTO</option>
                                        <option value="ISAQUE" ${conta?.vendedor==='ISAQUE'?'selected':''}>ISAQUE</option>
                                        <option value="MIGUEL" ${conta?.vendedor==='MIGUEL'?'selected':''}>MIGUEL</option>
                                    </select>
                                </div>
                                <div class="form-group"><label>Banco *</label>
                                    <select id="banco" required>
                                        <option value="">Selecione</option>
                                        <option value="BANCO DO BRASIL" ${conta?.banco==='BANCO DO BRASIL'?'selected':''}>BANCO DO BRASIL</option>
                                        <option value="BRADESCO" ${conta?.banco==='BRADESCO'?'selected':''}>BRADESCO</option>
                                        <option value="SICOOB" ${conta?.banco==='SICOOB'?'selected':''}>SICOOB</option>
                                    </select>
                                </div>
                                <div class="form-group"><label>Tipo NF *</label>
                                    <select id="tipo_nf">
                                        <option value="ENVIO" ${!conta?.tipo_nf||conta.tipo_nf==='ENVIO'?'selected':''}>Envio</option>
                                        <option value="CANCELADA" ${conta?.tipo_nf==='CANCELADA'?'selected':''}>Cancelada</option>
                                        <option value="REMESSA_AMOSTRA" ${conta?.tipo_nf==='REMESSA_AMOSTRA'?'selected':''}>Remessa Amostra</option>
                                        <option value="SIMPLES_REMESSA" ${conta?.tipo_nf==='SIMPLES_REMESSA'?'selected':''}>Simples Remessa</option>
                                        <option value="DEVOLUCAO" ${conta?.tipo_nf==='DEVOLUCAO'?'selected':''}>Devolução</option>
                                        <option value="DEVOLVIDA" ${conta?.tipo_nf==='DEVOLVIDA'?'selected':''}>Devolvida</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        <div class="tab-content" id="tab-valores">
                            <div class="form-grid">
                                <div class="form-group"><label>Valor NF (R$) *</label><input type="number" id="valor" step="0.01" value="${conta?.valor || ''}" required></div>
                                <div class="form-group"><label>Valor Pago (R$)</label><input type="number" id="valor_pago" step="0.01" value="${conta?.valor_pago || '0'}"></div>
                                <div class="form-group"><label>Data Emissão *</label><input type="date" id="data_emissao" value="${conta?.data_emissao || new Date().toISOString().split('T')[0]}" required></div>
                                <div class="form-group"><label>Data Vencimento *</label><input type="date" id="data_vencimento" value="${conta?.data_vencimento || ''}" required></div>
                                <div class="form-group"><label>Data Pagamento</label><input type="date" id="data_pagamento" value="${conta?.data_pagamento || ''}"></div>
                            </div>
                        </div>
                        <div class="tab-content" id="tab-observacoes">
                            <div class="observacoes-section">
                                <div class="observacoes-list" id="observacoesList">${obsHTML || '<p style="text-align:center; padding:2rem;">Nenhuma observação</p>'}</div>
                                <div class="nova-observacao">
                                    <textarea id="novaObservacao" placeholder="Digite uma observação..." rows="3"></textarea>
                                    <button type="button" class="btn-add-obs" onclick="adicionarObservacao()">+ Adicionar</button>
                                </div>
                            </div>
                        </div>
                        <div class="modal-actions">
                            <button type="button" id="btnPrevious" onclick="previousTab()" class="secondary" style="display:none;">Anterior</button>
                            <button type="button" id="btnNext" onclick="nextTab()" class="secondary">Próximo</button>
                            <button type="button" onclick="closeFormModal(false)" class="btn-cancel">Cancelar</button>
                            <button type="submit" id="btnSave" style="display:none;">${isEditing ? 'Atualizar' : 'Salvar'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    ['numero_nf','orgao'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.addEventListener('input', e => {
            const start = e.target.selectionStart;
            e.target.value = e.target.value.toUpperCase();
            e.target.setSelectionRange(start, start);
        });
    });
    updateNavigationButtons();
    setTimeout(() => document.getElementById('numero_nf')?.focus(), 100);
}

window.switchFormTab = function(idx) {
    currentTabIndex = idx;
    const btns = document.querySelectorAll('#formModal .tab-btn');
    const contents = document.querySelectorAll('#formModal .tab-content');
    btns.forEach((btn,i) => btn.classList.toggle('active', i===idx));
    contents.forEach((c,i) => c.classList.toggle('active', i===idx));
    updateNavigationButtons();
};
function nextTab() { if(currentTabIndex < tabs.length-1) switchFormTab(++currentTabIndex); }
function previousTab() { if(currentTabIndex > 0) switchFormTab(--currentTabIndex); }
function updateNavigationButtons() {
    const btnPrev = document.getElementById('btnPrevious');
    const btnNext = document.getElementById('btnNext');
    const btnSave = document.getElementById('btnSave');
    if(btnPrev) btnPrev.style.display = currentTabIndex===0 ? 'none' : 'inline-block';
    if(btnNext) btnNext.style.display = currentTabIndex===tabs.length-1 ? 'none' : 'inline-block';
    if(btnSave) btnSave.style.display = currentTabIndex===tabs.length-1 ? 'inline-block' : 'none';
}
function closeFormModal(saved=false) {
    const modal = document.getElementById('formModal');
    if(modal) {
        if(!saved) showMessage(modal.querySelector('#editId')?.value ? 'Atualização cancelada' : 'Registro cancelado', 'error');
        modal.style.animation = 'fadeOut 0.2s forwards';
        setTimeout(()=>modal.remove(),200);
    }
}
window.adicionarObservacao = function() {
    const textarea = document.getElementById('novaObservacao');
    const texto = textarea.value.trim().toUpperCase();
    if(!texto) return;
    const data = JSON.parse(document.getElementById('observacoesData').value);
    data.push({ texto, data: new Date().toISOString() });
    document.getElementById('observacoesData').value = JSON.stringify(data);
    textarea.value = '';
    renderizarObservacoes();
};
window.removerObservacao = function(idx) {
    const data = JSON.parse(document.getElementById('observacoesData').value);
    data.splice(idx,1);
    document.getElementById('observacoesData').value = JSON.stringify(data);
    renderizarObservacoes();
};
function renderizarObservacoes() {
    const data = JSON.parse(document.getElementById('observacoesData').value);
    const container = document.getElementById('observacoesList');
    if(!container) return;
    if(data.length===0) {
        container.innerHTML = '<p style="text-align:center; padding:2rem;">Nenhuma observação</p>';
        return;
    }
    container.innerHTML = data.map((obs,idx)=>`
        <div class="observacao-item">
            <div class="observacao-header">
                <span class="observacao-data">${formatDateTime(obs.data)}</span>
                <button type="button" class="btn-remove-obs" onclick="removerObservacao(${idx})">✕</button>
            </div>
            <p class="observacao-texto">${obs.texto}</p>
        </div>
    `).join('');
}

// ============================================
// SUBMIT (salvar)
// ============================================
window.handleSubmit = async function(event) {
    if(event) event.preventDefault();
    const observacoes = JSON.parse(document.getElementById('observacoesData').value);
    const formData = {
        numero_nf: document.getElementById('numero_nf').value.trim().toUpperCase(),
        orgao: document.getElementById('orgao').value.trim().toUpperCase(),
        vendedor: document.getElementById('vendedor').value,
        banco: document.getElementById('banco').value,
        valor: parseFloat(document.getElementById('valor').value),
        valor_pago: parseFloat(document.getElementById('valor_pago').value) || 0,
        data_emissao: document.getElementById('data_emissao').value,
        data_vencimento: document.getElementById('data_vencimento').value,
        data_pagamento: document.getElementById('data_pagamento').value || null,
        tipo_nf: document.getElementById('tipo_nf').value,
        observacoes: observacoes
    };
    formData.status = (formData.data_pagamento ? 'PAGO' : 'A RECEBER');
    const editId = document.getElementById('editId').value;
    if(!isOnline) { closeFormModal(false); return; }
    try {
        const url = editId ? `${API_URL}/contas/${editId}` : `${API_URL}/contas`;
        const method = editId ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type':'application/json', 'X-Session-Token':sessionToken },
            body: JSON.stringify(formData)
        });
        if(response.status===401) { sessionStorage.removeItem('contasReceberSession'); mostrarTelaAcessoNegado(); return; }
        if(!response.ok) throw new Error('Erro ao salvar');
        const saved = await response.json();
        const mapped = mapearConta(saved);
        if(editId) {
            const idx = contas.findIndex(c=>c.id===editId);
            if(idx!==-1) contas[idx]=mapped;
            showMessage(`NF ${formData.numero_nf} atualizada`,'success');
        } else {
            contas.push(mapped);
            showMessage(`NF ${formData.numero_nf} registrada`,'success');
        }
        lastDataHash = JSON.stringify(contas.map(c=>c.id));
        updateAllFilters();
        updateDashboard();
        filterContas();
        closeFormModal(true);
    } catch(err) {
        console.error(err);
        showMessage('Erro ao salvar','error');
    }
};

// ============================================
// EDIÇÃO, EXCLUSÃO, VISUALIZAÇÃO
// ============================================
window.editConta = function(id) { showFormModal(id); };
window.deleteConta = async function(id) {
    const conta = contas.find(c=>c.id===id);
    if(!conta) return;
    if(!confirm(`Excluir NF ${conta.numero_nf}?`)) return;
    const removed = contas.filter(c=>c.id!==id);
    contas = removed;
    updateAllFilters();
    updateDashboard();
    filterContas();
    showMessage(`NF ${conta.numero_nf} excluída`,'error');
    if(isOnline) {
        try {
            await fetch(`${API_URL}/contas/${id}`, { method:'DELETE', headers:{'X-Session-Token':sessionToken} });
        } catch(e) { console.error(e); }
    }
};
window.viewConta = function(id) {
    const conta = contas.find(c=>c.id===id);
    if(!conta) return;
    const tipoLabels = { 'ENVIO':'Envio','CANCELADA':'Cancelada','REMESSA_AMOSTRA':'Remessa Amostra','SIMPLES_REMESSA':'Simples Remessa','DEVOLUCAO':'Devolução','DEVOLVIDA':'Devolvida' };
    const obsHTML = (conta.observacoes||[]).map(obs=>`
        <div class="observacao-item-view">
            <div class="observacao-header"><span class="observacao-data">${formatDateTime(obs.data)}</span></div>
            <p class="observacao-texto">${obs.texto}</p>
        </div>
    `).join('');
    let statusDisplay = conta.status;
    if(conta.tipo_nf && conta.tipo_nf!=='ENVIO') statusDisplay = tipoLabels[conta.tipo_nf] || conta.tipo_nf;
    const modalHTML = `
        <div class="modal-overlay" id="viewModal" style="display:flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Detalhes da Conta</h3>
                    <button class="close-modal" onclick="closeViewModal()">✕</button>
                </div>
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchViewTab(0)">Básico</button>
                        <button class="tab-btn" onclick="switchViewTab(1)">Valores</button>
                        <button class="tab-btn" onclick="switchViewTab(2)">Observações</button>
                    </div>
                    <div class="tab-content active" id="view-tab-basico">
                        <div class="info-section">
                            <p><strong>NF:</strong> ${conta.numero_nf}</p>
                            <p><strong>Órgão:</strong> ${conta.orgao}</p>
                            <p><strong>Vendedor:</strong> ${conta.vendedor}</p>
                            <p><strong>Banco:</strong> ${conta.banco}</p>
                            <p><strong>Tipo NF:</strong> ${tipoLabels[conta.tipo_nf]||conta.tipo_nf}</p>
                            <p><strong>Status:</strong> <span class="badge status-${conta.status.toLowerCase().replace(' ','-')}">${statusDisplay}</span></p>
                        </div>
                    </div>
                    <div class="tab-content" id="view-tab-valores">
                        <div class="info-section">
                            <p><strong>Valor NF:</strong> ${formatCurrency(conta.valor)}</p>
                            <p><strong>Valor Pago:</strong> ${formatCurrency(conta.valor_pago||0)}</p>
                            <p><strong>Emissão:</strong> ${formatDate(conta.data_emissao)}</p>
                            <p><strong>Vencimento:</strong> ${formatDate(conta.data_vencimento)}</p>
                            <p><strong>Pagamento:</strong> ${conta.data_pagamento ? formatDate(conta.data_pagamento) : 'Não pago'}</p>
                        </div>
                    </div>
                    <div class="tab-content" id="view-tab-observacoes">
                        <div class="observacoes-list-view">${obsHTML || '<p style="text-align:center;">Nenhuma observação</p>'}</div>
                    </div>
                </div>
                <div class="modal-actions"><button class="btn-close" onclick="closeViewModal()">Fechar</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
};
window.closeViewModal = function() {
    const modal = document.getElementById('viewModal');
    if(modal) modal.remove();
};
window.switchViewTab = function(idx) {
    const btns = document.querySelectorAll('#viewModal .tab-btn');
    const contents = document.querySelectorAll('#viewModal .tab-content');
    btns.forEach((b,i)=>b.classList.toggle('active',i===idx));
    contents.forEach((c,i)=>c.classList.toggle('active',i===idx));
};

// ============================================
// FILTROS E RENDERIZAÇÃO (com checkbox e status VENCIDO)
// ============================================
function updateAllFilters() {
    const vendedores = [...new Set(contas.map(c=>c.vendedor).filter(Boolean))];
    const bancos = [...new Set(contas.map(c=>c.banco).filter(Boolean))];
    const selVend = document.getElementById('filterVendedor');
    if(selVend) {
        const cur = selVend.value;
        selVend.innerHTML = '<option value="">Todos Vendedores</option>';
        vendedores.sort().forEach(v => { const opt = document.createElement('option'); opt.value=v; opt.text=v; selVend.appendChild(opt); });
        selVend.value = cur;
    }
    const selBanco = document.getElementById('filterBanco');
    if(selBanco) {
        const cur = selBanco.value;
        selBanco.innerHTML = '<option value="">Todos Bancos</option>';
        bancos.sort().forEach(b => { const opt = document.createElement('option'); opt.value=b; opt.text=b; selBanco.appendChild(opt); });
        selBanco.value = cur;
    }
}

function filterContas() {
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    const filterVendedor = document.getElementById('filterVendedor')?.value || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    const filterBanco = document.getElementById('filterBanco')?.value || '';
    let filtered = [...contas];
    if(showAllMonths) {
        filtered = filtered.filter(c => new Date(c.data_emissao+'T00:00:00').getFullYear() === currentYear);
    } else {
        filtered = filtered.filter(c => {
            const d = new Date(c.data_emissao+'T00:00:00');
            return d.getMonth()===currentMonth && d.getFullYear()===currentYear;
        });
    }
    if(filterVendedor) filtered = filtered.filter(c=>c.vendedor===filterVendedor);
    if(filterBanco) filtered = filtered.filter(c=>c.banco===filterBanco);
    if(filterStatus) filtered = filtered.filter(c=>c.status===filterStatus);
    if(search) filtered = filtered.filter(c=>c.numero_nf.toLowerCase().includes(search)||c.orgao.toLowerCase().includes(search)||c.vendedor.toLowerCase().includes(search));
    filtered.sort((a,b)=> (parseInt(a.numero_nf)||0) - (parseInt(b.numero_nf)||0));
    renderContas(filtered);
}

function renderContas(lista) {
    const container = document.getElementById('contasContainer');
    if(!container) return;
    if(!lista.length) { container.innerHTML = '<div style="text-align:center; padding:2rem;">Nenhuma conta encontrada</div>'; return; }
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const tipoLabels = { 'CANCELADA':'Cancelada','REMESSA_AMOSTRA':'Remessa Amostra','SIMPLES_REMESSA':'Simples Remessa','DEVOLUCAO':'Devolução','DEVOLVIDA':'Devolvida' };
    let html = `
        <div style="overflow-x:auto;">
            <table style="width:100%">
                <thead>
                    <tr>
                        <th style="width:50px; text-align:center;">Pago</th>
                        <th>NF</th>
                        <th>Órgão</th>
                        <th>Valor NF</th>
                        <th>Valor Pago</th>
                        <th>Vencimento</th>
                        <th>Status</th>
                        <th style="text-align:center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
    `;
    for(const c of lista) {
        const isEnvio = !c.tipo_nf || c.tipo_nf === 'ENVIO';
        const isPago = c.status === 'PAGO';
        const rowClass = isPago ? 'row-pago' : '';
        let statusBadge = '';
        if(!isEnvio) {
            statusBadge = `<span class="badge status-especial">${tipoLabels[c.tipo_nf] || c.tipo_nf}</span>`;
        } else if(isPago) {
            statusBadge = `<span class="badge status-pago">PAGO</span>`;
        } else {
            const vencimento = new Date(c.data_vencimento+'T00:00:00');
            if(vencimento < hoje) {
                statusBadge = `<span class="badge status-vencido">VENCIDO</span>`;
            } else {
                statusBadge = `<span class="badge status-a-receber">A RECEBER</span>`;
            }
        }
        html += `
            <tr class="${rowClass}" data-id="${c.id}" style="cursor:pointer;">
                <td style="text-align:center;">
                    ${isEnvio ? `<input type="checkbox" class="pago-checkbox" ${isPago ? 'checked' : ''} onchange="togglePagamento('${c.id}', this.checked)">` : '-'}
                </td>
                <td><strong>${c.numero_nf}</strong></td>
                <td>${c.orgao}</td>
                <td><strong>${formatCurrency(c.valor)}</strong></td>
                <td>${formatCurrency(c.valor_pago||0)}</td>
                <td>${c.data_vencimento ? formatDate(c.data_vencimento) : '-'}</td>
                <td>${statusBadge}</td>
                <td class="actions-cell" style="text-align:center;">
                    <button onclick="editConta('${c.id}')" class="action-btn edit">Editar</button>
                    <button onclick="deleteConta('${c.id}')" class="action-btn delete">Excluir</button>
                </td>
            </tr>
        `;
    }
    html += `
                </tbody>
            </table>
        </div>
    `;
    container.innerHTML = html;
    document.querySelectorAll('#contasContainer tbody tr').forEach(tr => {
        tr.addEventListener('click', function(e) {
            if(e.target.tagName==='BUTTON' || e.target.closest('button') || e.target.type==='checkbox') return;
            const id = this.dataset.id;
            if(id) viewConta(id);
        });
    });
}

// ============================================
// TOGGLE PAGAMENTO (checkbox)
// ============================================
window.togglePagamento = async function(id, isChecked) {
    const conta = contas.find(c => c.id === id);
    if(!conta) return;
    const wasPago = conta.status === 'PAGO';
    if(isChecked && !wasPago) {
        if(!confirm(`Confirmar pagamento da NF ${conta.numero_nf}?`)) {
            const chk = document.querySelector(`.pago-checkbox[onchange*="togglePagamento('${id}']`);
            if(chk) chk.checked = false;
            return;
        }
        const updated = {
            ...conta,
            status: 'PAGO',
            valor_pago: conta.valor,
            data_pagamento: new Date().toISOString().split('T')[0]
        };
        const success = await atualizarConta(id, updated);
        if(success) {
            Object.assign(conta, updated);
            showMessage(`NF ${conta.numero_nf} marcada como PAGA`, 'success');
        } else {
            const chk = document.querySelector(`.pago-checkbox[onchange*="togglePagamento('${id}']`);
            if(chk) chk.checked = false;
            return;
        }
    } else if(!isChecked && wasPago) {
        if(!confirm(`Reverter pagamento da NF ${conta.numero_nf}?`)) {
            const chk = document.querySelector(`.pago-checkbox[onchange*="togglePagamento('${id}']`);
            if(chk) chk.checked = true;
            return;
        }
        const updated = {
            ...conta,
            status: 'A RECEBER',
            valor_pago: 0,
            data_pagamento: null
        };
        const success = await atualizarConta(id, updated);
        if(success) {
            Object.assign(conta, updated);
            showMessage(`Pagamento da NF ${conta.numero_nf} revertido`, 'info');
        } else {
            const chk = document.querySelector(`.pago-checkbox[onchange*="togglePagamento('${id}']`);
            if(chk) chk.checked = true;
            return;
        }
    }
    updateDashboard();
    filterContas();
};

async function atualizarConta(id, dadosAtualizados) {
    if(!isOnline) { showMessage('Sistema offline','error'); return false; }
    try {
        const response = await fetch(`${API_URL}/contas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type':'application/json', 'X-Session-Token':sessionToken },
            body: JSON.stringify(dadosAtualizados)
        });
        if(response.status===401) { sessionStorage.removeItem('contasReceberSession'); mostrarTelaAcessoNegado(); return false; }
        if(!response.ok) throw new Error('Erro ao atualizar');
        const saved = await response.json();
        const idx = contas.findIndex(c=>c.id===id);
        if(idx!==-1) contas[idx] = mapearConta(saved);
        return true;
    } catch(err) {
        console.error(err);
        showMessage('Erro ao atualizar status','error');
        return false;
    }
}

function showMessage(msg, type) {
    const div = document.createElement('div');
    div.className = `floating-message ${type}`;
    div.textContent = msg;
    document.body.appendChild(div);
    setTimeout(() => {
        div.style.animation = 'slideOutBottom 0.3s forwards';
        setTimeout(()=>div.remove(),300);
    },3000);
}

console.log('✅ Script carregado com checkboxes, linha verde, status VENCIDO e remoção da coluna Banco');
