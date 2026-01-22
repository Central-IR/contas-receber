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
// FORMATAÇÃO DE MOEDA
// ============================================
function formatCurrency(valor) {
    return 'R$ ' + valor.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
}

// ============================================
// NAVEGAÇÃO POR MESES
// ============================================
function updateMonthDisplay() {
    const display = document.getElementById('currentMonth');
    if (display) {
        display.textContent = `${meses[currentMonth]} ${currentYear}`;
    }
    updateDashboard();
    filterContas();
}

window.changeMonth = function(direction) {
    currentMonth = currentMonth + direction;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    } else if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateMonthDisplay();
};

// ============================================
// MODAL DE CONFIRMAÇÃO
// ============================================
function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const existingModal = document.getElementById('confirmModal');
        if (existingModal) existingModal.remove();

        const { title = 'Confirmação', confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'warning' } = options;

        const overlay = document.createElement('div');
        overlay.id = 'confirmModal';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:999999;';

        const box = document.createElement('div');
        box.style.cssText = 'background:#FFFFFF;border-radius:16px;padding:2rem;max-width:450px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.5);';

        box.innerHTML = `
            <h3 style="color:#1A1A1A;margin:0 0 1rem 0;font-size:1.25rem;">${title}</h3>
            <p style="color:#6B7280;margin:0 0 2rem 0;">${message}</p>
            <div style="display:flex;gap:0.75rem;justify-content:flex-end;">
                <button id="btnCancel" style="background:#EF4444;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:600;min-width:100px;">${cancelText}</button>
                <button id="btnConfirm" style="background:#22C55E;color:#fff;border:none;padding:12px 24px;border-radius:8px;cursor:pointer;font-size:0.95rem;font-weight:600;min-width:100px;">${confirmText}</button>
            </div>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        const btnCancel = document.getElementById('btnCancel');
        const btnConfirm = document.getElementById('btnConfirm');

        btnCancel.onclick = () => { overlay.remove(); resolve(false); };
        btnConfirm.onclick = () => { overlay.remove(); resolve(true); };
        overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
}

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
}

// ============================================
// CONEXÃO E STATUS
// ============================================
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            mode: 'cors'
        });

        if (response.status === 401) {
            sessionStorage.removeItem('contasReceberSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;

        if (wasOffline && isOnline) {
            console.log('✅ SERVIDOR ONLINE');
            await loadContas();
        }

        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        isOnline = false;
        updateConnectionStatus();
        return false;
    }
}

function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = isOnline ? 'connection-status online' : 'connection-status offline';
    }
}

// ============================================
// CARREGAMENTO DE DADOS
// ============================================
async function loadContas() {
    if (!isOnline) return;

    try {
        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
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
    
    // Converter observacoes para array se necessário
    if (conta.observacoes) {
        if (Array.isArray(conta.observacoes)) {
            observacoesArray = conta.observacoes;
        } else if (typeof conta.observacoes === 'string') {
            try {
                observacoesArray = JSON.parse(conta.observacoes);
            } catch {
                observacoesArray = [{ texto: conta.observacoes, data: new Date().toISOString() }];
            }
        } else if (typeof conta.observacoes === 'object') {
            observacoesArray = [conta.observacoes];
        }
    }

    return {
        id: conta.id,
        numero_nf: conta.numero_nf || '',
        orgao: conta.orgao || '',
        vendedor: conta.vendedor || '',
        banco: conta.banco || '',
        valor: parseFloat(conta.valor) || 0,
        data_emissao: conta.data_emissao || '',
        data_vencimento: conta.data_vencimento || '',
        data_pagamento: conta.data_pagamento || null,
        status: conta.status || 'A RECEBER',
        tipo_nf: conta.tipo_nf || 'ENVIO',
        observacoes: observacoesArray,
        created_at: conta.created_at || new Date().toISOString()
    };
}

// ============================================
// SINCRONIZAÇÃO DE DADOS
// ============================================
window.sincronizarDados = async function() {
    console.log('🔄 Sincronizando dados...');
    
    const syncButtons = document.querySelectorAll('button[onclick="sincronizarDados()"]');
    syncButtons.forEach(btn => {
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.style.animation = 'spin 1s linear infinite';
        }
    });
    
    try {
        await loadContas();
        showMessage('Dados sincronizados', 'success');
    } catch (error) {
        showMessage('Erro ao sincronizar', 'error');
    }
    
    setTimeout(() => {
        syncButtons.forEach(btn => {
            const svg = btn.querySelector('svg');
            if (svg) {
                svg.style.animation = '';
            }
        });
    }, 1000);
};

function startPolling() {
    setInterval(() => {
        if (isOnline) loadContas();
    }, 30000);
}

// ============================================
// CÁLCULO AUTOMÁTICO DE STATUS
// ============================================
function calcularStatus(conta) {
    if (conta.tipo_nf && conta.tipo_nf !== 'ENVIO') {
        return 'ESPECIAL';
    }

    if (conta.data_pagamento) {
        return 'PAGO';
    }

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const vencimento = new Date(conta.data_vencimento + 'T00:00:00');

    if (vencimento < hoje) {
        return 'VENCIDO';
    }

    return 'A RECEBER';
}

// ============================================
// DASHBOARD
// ============================================
function updateDashboard() {
    const contasMesAtual = contas.filter(c => {
        const data = new Date(c.data_emissao + 'T00:00:00');
        return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
    });

    const contasEnvio = contasMesAtual.filter(c => !c.tipo_nf || c.tipo_nf === 'ENVIO');

    const totalFaturado = contasEnvio.reduce((sum, c) => sum + c.valor, 0);
    const totalPago = contasEnvio.filter(c => c.status === 'PAGO').reduce((sum, c) => sum + c.valor, 0);

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    // VENCIDO: conta TODAS as contas vencidas (independente do mês) que não foram pagas
    const todasContasEnvio = contas.filter(c => !c.tipo_nf || c.tipo_nf === 'ENVIO');
    const totalVencido = todasContasEnvio
        .filter(c => {
            if (c.status === 'PAGO') return false;
            const dataVencimento = new Date(c.data_vencimento + 'T00:00:00');
            return dataVencimento < hoje;
        })
        .reduce((sum, c) => sum + c.valor, 0);

    const totalReceber = totalFaturado - totalPago;

    const statFaturado = document.getElementById('statFaturado');
    const statPago = document.getElementById('statPago');
    const statVencido = document.getElementById('statVencido');
    const statReceber = document.getElementById('statReceber');

    if (statFaturado) statFaturado.textContent = formatCurrency(totalFaturado);
    if (statPago) statPago.textContent = formatCurrency(totalPago);
    if (statVencido) statVencido.textContent = formatCurrency(totalVencido);
    if (statReceber) statReceber.textContent = formatCurrency(totalReceber);

    const badgeVencido = document.getElementById('pulseBadgeVencido');
    const cardVencido = document.getElementById('cardVencido');

    if (badgeVencido && cardVencido) {
        if (totalVencido > 0) {
            badgeVencido.style.display = 'flex';
            cardVencido.classList.add('has-alert');
        } else {
            badgeVencido.style.display = 'none';
            cardVencido.classList.remove('has-alert');
        }
    }
}

function verificarContasVencidas() {
    const jaExibiu = sessionStorage.getItem(NOTIFICATION_KEY);
    if (jaExibiu) return;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const contasVencidas = contas.filter(c => {
        if (c.tipo_nf && c.tipo_nf !== 'ENVIO') return false;
        if (c.status === 'PAGO') return false;
        const vencimento = new Date(c.data_vencimento + 'T00:00:00');
        return vencimento < hoje;
    });

    if (contasVencidas.length > 0) {
        mostrarNotificacaoVencidos(contasVencidas);
        sessionStorage.setItem(NOTIFICATION_KEY, 'true');
    }
}

function mostrarNotificacaoVencidos(contas) {
    const totalVencido = contas.reduce((sum, c) => sum + c.valor, 0);

    const modalHTML = `
        <div class="modal-overlay" id="notificationModal" style="z-index: 999999;">
            <div class="modal-content" style="max-width: 500px; border: 3px solid #e70000;">
                <div class="modal-header" style="background: linear-gradient(135deg, #e70000 0%, #c00000 100%); color: white; padding: 1.5rem;">
                    <h3 class="modal-title" style="margin: 0; font-size: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 2rem;">⚠️</span>
                        Atenção: Contas Vencidas
                    </h3>
                </div>
                
                <div style="padding: 2rem;">
                    <p style="color: #1A1A1A; font-size: 1.1rem; margin-bottom: 1rem;">
                        Você possui <strong style="color: #e70000;">${contas.length} ${contas.length === 1 ? 'conta vencida' : 'contas vencidas'}</strong>
                    </p>
                    
                    <div style="background: #FEE; border-left: 4px solid #e70000; padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px;">
                        <p style="margin: 0; color: #6B7280;">
                            <strong>Total vencido:</strong>
                        </p>
                        <p style="margin: 0.5rem 0 0 0; font-size: 1.5rem; font-weight: bold; color: #e70000;">
                            ${formatCurrency(totalVencido)}
                        </p>
                    </div>
                    
                    <p style="color: #6B7280; font-size: 0.95rem; margin-bottom: 1.5rem;">
                        Esta notificação é exibida apenas no primeiro acesso.
                    </p>
                    
                    <button onclick="fecharNotificacaoVencidos()" 
                            style="width: 100%; background: #e70000; color: white; border: none; padding: 14px; border-radius: 8px; cursor: pointer; font-size: 1rem; font-weight: 600;">
                        Entendi
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.fecharNotificacaoVencidos = function() {
    const modal = document.getElementById('notificationModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    }
};

// ============================================
// MODAL DE CONTAS VENCIDAS
// ============================================
window.showVencidosModal = function() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    const contasVencidas = contas.filter(c => {
        if (c.tipo_nf && c.tipo_nf !== 'ENVIO') return false;
        if (c.status === 'PAGO') return false;
        const vencimento = new Date(c.data_vencimento + 'T00:00:00');
        return vencimento < hoje;
    });

    if (contasVencidas.length === 0) {
        showMessage('Não há contas vencidas no momento!', 'success');
        return;
    }

    const totalVencido = contasVencidas.reduce((sum, c) => sum + c.valor, 0);

    const listaHTML = contasVencidas.map(c => `
        <div style="background: #FEE; border-left: 4px solid #EF4444; padding: 1rem; margin-bottom: 0.75rem; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                <strong style="color: #1A1A1A;">NF: ${c.numero_nf}</strong>
                <strong style="color: #EF4444;">${formatCurrency(c.valor)}</strong>
            </div>
            <p style="margin: 0; color: #6B7280; font-size: 0.9rem;">Órgão: ${c.orgao}</p>
            <p style="margin: 0; color: #6B7280; font-size: 0.9rem;">Vencimento: ${formatDate(c.data_vencimento)}</p>
        </div>
    `).join('');

    const bodyHTML = `
        <h3 style="color: #EF4444; margin: 0 0 1rem 0;">Contas Vencidas (${contasVencidas.length})</h3>
        <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 1rem; margin-bottom: 1.5rem; border-radius: 4px;">
            <p style="margin: 0; color: #92400E; font-weight: 600;">Total Vencido:</p>
            <p style="margin: 0.5rem 0 0 0; font-size: 1.75rem; font-weight: bold; color: #EF4444;">${formatCurrency(totalVencido)}</p>
        </div>
        <div style="max-height: 400px; overflow-y: auto;">
            ${listaHTML}
        </div>
    `;

    const modalBody = document.getElementById('vencidosModalBody');
    const modal = document.getElementById('vencidosModal');
    
    if (modalBody && modal) {
        modalBody.innerHTML = bodyHTML;
        modal.style.display = 'flex';
    }
};

window.closeVencidosModal = function() {
    const modal = document.getElementById('vencidosModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// ============================================
// FORMULÁRIO
// ============================================
window.toggleForm = function() {
    showFormModal(null);
};

function showFormModal(editingId = null) {
    const isEditing = editingId !== null;
    let conta = null;

    if (isEditing) {
        conta = contas.find(c => c.id === editingId);

        if (!conta) {
            return;
        }
    }

    const observacoesHTML = (conta?.observacoes || []).map((obs, index) => `
        <div class="observacao-item">
            <div class="observacao-header">
                <span class="observacao-data">${formatDateTime(obs.data)}</span>
                <button type="button" class="btn-remove-obs" onclick="removerObservacao(${index})" title="Remover">✕</button>
            </div>
            <p class="observacao-texto">${obs.texto}</p>
        </div>
    `).join('');

    const modalHTML = `
        <div class="modal-overlay" id="formModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${isEditing ? 'Editar Conta' : 'Nova Conta a Receber'}</h3>
                    <button class="close-modal" onclick="closeFormModal(false)">✕</button>
                </div>
                
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchFormTab(0)">Informações Básicas</button>
                        <button class="tab-btn" onclick="switchFormTab(1)">Valores e Datas</button>
                        <button class="tab-btn" onclick="switchFormTab(2)">Observações</button>
                    </div>

                    <form id="contaForm" onsubmit="handleSubmit(event)">
                        <input type="hidden" id="editId" value="${editingId || ''}">
                        <input type="hidden" id="observacoesData" value='${JSON.stringify(conta?.observacoes || [])}'>
                        
                        <div class="tab-content active" id="tab-basico">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="numero_nf">Número da NF *</label>
                                    <input type="text" id="numero_nf" value="${conta?.numero_nf || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="orgao">Órgão *</label>
                                    <input type="text" id="orgao" value="${conta?.orgao || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="vendedor">Vendedor *</label>
                                    <select id="vendedor" required>
                                        <option value="">Selecione...</option>
                                        <option value="ROBERTO" ${conta?.vendedor === 'ROBERTO' ? 'selected' : ''}>ROBERTO</option>
                                        <option value="ISAQUE" ${conta?.vendedor === 'ISAQUE' ? 'selected' : ''}>ISAQUE</option>
                                        <option value="MIGUEL" ${conta?.vendedor === 'MIGUEL' ? 'selected' : ''}>MIGUEL</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="banco">Banco *</label>
                                    <select id="banco" required>
                                        <option value="">Selecione...</option>
                                        <option value="BANCO DO BRASIL" ${conta?.banco === 'BANCO DO BRASIL' ? 'selected' : ''}>BANCO DO BRASIL</option>
                                        <option value="BRADESCO" ${conta?.banco === 'BRADESCO' ? 'selected' : ''}>BRADESCO</option>
                                        <option value="SICOOB" ${conta?.banco === 'SICOOB' ? 'selected' : ''}>SICOOB</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="tipo_nf">Tipo de NF *</label>
                                    <select id="tipo_nf" required>
                                        <option value="ENVIO" ${!conta?.tipo_nf || conta?.tipo_nf === 'ENVIO' ? 'selected' : ''}>Envio</option>
                                        <option value="CANCELADA" ${conta?.tipo_nf === 'CANCELADA' ? 'selected' : ''}>Cancelada</option>
                                        <option value="REMESSA_AMOSTRA" ${conta?.tipo_nf === 'REMESSA_AMOSTRA' ? 'selected' : ''}>Remessa de Amostra</option>
                                        <option value="SIMPLES_REMESSA" ${conta?.tipo_nf === 'SIMPLES_REMESSA' ? 'selected' : ''}>Simples Remessa</option>
                                        <option value="DEVOLUCAO" ${conta?.tipo_nf === 'DEVOLUCAO' ? 'selected' : ''}>Devolução</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-valores">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="valor">Valor (R$) *</label>
                                    <input type="number" id="valor" step="0.01" min="0" value="${conta?.valor || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="data_emissao">Data de Emissão *</label>
                                    <input type="date" id="data_emissao" value="${conta?.data_emissao || new Date().toISOString().split('T')[0]}" required>
                                </div>
                                <div class="form-group">
                                    <label for="data_vencimento">Data de Vencimento *</label>
                                    <input type="date" id="data_vencimento" value="${conta?.data_vencimento || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="data_pagamento">Data de Pagamento</label>
                                    <input type="date" id="data_pagamento" value="${conta?.data_pagamento || ''}">
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-observacoes">
                            <div class="observacoes-section">
                                <div class="observacoes-list" id="observacoesList">
                                    ${observacoesHTML || '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhuma observação adicionada</p>'}
                                </div>
                                <div class="nova-observacao">
                                    <textarea id="novaObservacao" placeholder="Digite uma observação..." rows="3"></textarea>
                                    <button type="button" class="btn-add-obs" onclick="adicionarObservacao()">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                        Adicionar Observação
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="submit" class="save">${isEditing ? 'Atualizar' : 'Salvar'}</button>
                            <button type="button" class="btn-cancel" onclick="closeFormModal(false)">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const camposMaiusculas = ['numero_nf', 'orgao'];
    camposMaiusculas.forEach(campoId => {
        const campo = document.getElementById(campoId);
        if (campo) {
            campo.addEventListener('input', (e) => {
                const start = e.target.selectionStart;
                e.target.value = e.target.value.toUpperCase();
                e.target.setSelectionRange(start, start);
            });
        }
    });

    setTimeout(() => document.getElementById('numero_nf')?.focus(), 100);
}

function closeFormModal(saved = false) {
    const modal = document.getElementById('formModal');
    if (modal) {
        const editId = document.getElementById('editId')?.value;
        
        if (!saved) {
            if (editId) {
                showMessage('Atualização cancelada', 'error');
            } else {
                showMessage('Registro cancelado', 'error');
            }
        }
        
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    }
}

// ============================================
// OBSERVAÇÕES
// ============================================
window.adicionarObservacao = function() {
    const textarea = document.getElementById('novaObservacao');
    const texto = textarea.value.trim().toUpperCase();
    
    if (!texto) return;
    
    const observacoesData = JSON.parse(document.getElementById('observacoesData').value);
    observacoesData.push({
        texto: texto,
        data: new Date().toISOString()
    });
    
    document.getElementById('observacoesData').value = JSON.stringify(observacoesData);
    textarea.value = '';
    
    renderizarObservacoes();
};

window.removerObservacao = function(index) {
    const observacoesData = JSON.parse(document.getElementById('observacoesData').value);
    observacoesData.splice(index, 1);
    document.getElementById('observacoesData').value = JSON.stringify(observacoesData);
    renderizarObservacoes();
};

function renderizarObservacoes() {
    const observacoesData = JSON.parse(document.getElementById('observacoesData').value);
    const container = document.getElementById('observacoesList');
    
    if (observacoesData.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhuma observação adicionada</p>';
        return;
    }
    
    container.innerHTML = observacoesData.map((obs, index) => `
        <div class="observacao-item">
            <div class="observacao-header">
                <span class="observacao-data">${formatDateTime(obs.data)}</span>
                <button type="button" class="btn-remove-obs" onclick="removerObservacao(${index})" title="Remover">✕</button>
            </div>
            <p class="observacao-texto">${obs.texto}</p>
        </div>
    `).join('');
}

// ============================================
// SISTEMA DE ABAS
// ============================================
window.switchFormTab = function(index) {
    const tabButtons = document.querySelectorAll('#formModal .tab-btn');
    const tabContents = document.querySelectorAll('#formModal .tab-content');

    tabButtons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    tabContents.forEach((content, i) => {
        content.classList.toggle('active', i === index);
    });
};

// ============================================
// SUBMIT
// ============================================
window.handleSubmit = async function(event) {
    if (event) event.preventDefault();

    const observacoesData = JSON.parse(document.getElementById('observacoesData').value);

    const formData = {
        numero_nf: document.getElementById('numero_nf').value.trim().toUpperCase(),
        orgao: document.getElementById('orgao').value.trim().toUpperCase(),
        vendedor: document.getElementById('vendedor').value.trim(),
        banco: document.getElementById('banco').value.trim(),
        valor: parseFloat(document.getElementById('valor').value),
        data_emissao: document.getElementById('data_emissao').value,
        data_vencimento: document.getElementById('data_vencimento').value,
        data_pagamento: document.getElementById('data_pagamento').value || null,
        tipo_nf: document.getElementById('tipo_nf').value,
        observacoes: observacoesData
    };

    formData.status = calcularStatus(formData);

    const editId = document.getElementById('editId').value;

    if (!isOnline) {
        closeFormModal(false);
        return;
    }

    try {
        const url = editId ? `${API_URL}/contas/${editId}` : `${API_URL}/contas`;
        const method = editId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData),
            mode: 'cors'
        });

        if (response.status === 401) {
            sessionStorage.removeItem('contasReceberSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) {
            throw new Error('Erro ao salvar');
        }

        const savedData = await response.json();
        const mappedData = mapearConta(savedData);

        if (editId) {
            const index = contas.findIndex(c => c.id === editId);
            if (index !== -1) contas[index] = mappedData;
        } else {
            contas.push(mappedData);
            showMessage(`NF ${formData.numero_nf} registrada`, 'success');
        }

        lastDataHash = JSON.stringify(contas.map(c => c.id));
        updateAllFilters();
        updateDashboard();
        filterContas();
        closeFormModal(true);

    } catch (error) {
        console.error('Erro:', error);
    }
};

// ============================================
// EDIÇÃO
// ============================================
window.editConta = function(id) {
    const conta = contas.find(c => c.id === id);

    if (!conta) {
        return;
    }

    showFormModal(id);
};

// ============================================
// EXCLUSÃO
// ============================================
window.deleteConta = async function(id) {
    const conta = contas.find(c => c.id === id);
    const numeroNf = conta?.numero_nf || '';
    
    const confirmed = await showConfirm(
        'Tem certeza que deseja excluir esta conta?',
        {
            title: 'Excluir Conta',
            confirmText: 'Excluir',
            cancelText: 'Cancelar',
            type: 'warning'
        }
    );

    if (!confirmed) return;

    const deletedConta = contas.find(c => c.id === id);
    contas = contas.filter(c => c.id !== id);
    updateAllFilters();
    updateDashboard();
    filterContas();
    showMessage(`NF ${numeroNf} excluída`, 'error');

    if (isOnline) {
        try {
            const response = await fetch(`${API_URL}/contas/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-Session-Token': sessionToken,
                    'Accept': 'application/json'
                },
                mode: 'cors'
            });

            if (!response.ok) throw new Error('Erro ao deletar');
        } catch (error) {
            if (deletedConta) {
                contas.push(deletedConta);
                updateAllFilters();
                updateDashboard();
                filterContas();
            }
        }
    }
};

// ============================================
// VISUALIZAÇÃO
// ============================================
window.viewConta = function(id) {
    const conta = contas.find(c => c.id === id);

    if (!conta) {
        return;
    }

    const tipoNfLabel = {
        'ENVIO': 'Envio',
        'CANCELADA': 'Cancelada',
        'REMESSA_AMOSTRA': 'Remessa de Amostra',
        'SIMPLES_REMESSA': 'Simples Remessa',
        'DEVOLUCAO': 'Devolução'
    };

    const observacoesHTML = (conta.observacoes || []).map(obs => `
        <div class="observacao-item-view">
            <div class="observacao-header">
                <span class="observacao-data">${formatDateTime(obs.data)}</span>
            </div>
            <p class="observacao-texto">${obs.texto}</p>
        </div>
    `).join('');

    const modalHTML = `
        <div class="modal-overlay" id="viewModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Conta</h3>
                    <button class="close-modal" onclick="closeViewModal()">✕</button>
                </div>
                
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchViewTab(0)">Informações Básicas</button>
                        <button class="tab-btn" onclick="switchViewTab(1)">Valores e Datas</button>
                        <button class="tab-btn" onclick="switchViewTab(2)">Observações</button>
                    </div>

                    <div class="tab-content active" id="view-tab-basico">
                        <div class="info-section">
                            <h4>Dados da Conta</h4>
                            <p><strong>Número NF:</strong> ${conta.numero_nf}</p>
                            <p><strong>Órgão:</strong> ${conta.orgao}</p>
                            <p><strong>Vendedor:</strong> ${conta.vendedor}</p>
                            <p><strong>Banco:</strong> ${conta.banco}</p>
                            <p><strong>Tipo de NF:</strong> ${tipoNfLabel[conta.tipo_nf] || conta.tipo_nf}</p>
                            <p><strong>Status:</strong> <span class="badge status-${conta.status.toLowerCase().replace(' ', '-')}">${conta.status}</span></p>
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-valores">
                        <div class="info-section">
                            <h4>Valores e Datas</h4>
                            <p><strong>Valor:</strong> ${formatCurrency(conta.valor)}</p>
                            <p><strong>Data de Emissão:</strong> ${formatDate(conta.data_emissao)}</p>
                            <p><strong>Data de Vencimento:</strong> ${formatDate(conta.data_vencimento)}</p>
                            ${conta.data_pagamento ? `<p><strong>Data de Pagamento:</strong> ${formatDate(conta.data_pagamento)}</p>` : '<p><strong>Data de Pagamento:</strong> Não pago</p>'}
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-observacoes">
                        <div class="info-section">
                            <h4>Observações</h4>
                            <div class="observacoes-list-view">
                                ${observacoesHTML || '<p style="color: var(--text-secondary); text-align: center; padding: 2rem;">Nenhuma observação</p>'}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="btn-close" onclick="closeViewModal()">Fechar</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
};

function closeViewModal() {
    const modal = document.getElementById('viewModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    }
}

window.switchViewTab = function(index) {
    document.querySelectorAll('#viewModal .tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    document.querySelectorAll('#viewModal .tab-content').forEach((content, i) => {
        content.classList.toggle('active', i === index);
    }); 
};

// ============================================
// FILTROS - ATUALIZAÇÃO DINÂMICA
// ============================================
function updateAllFilters() {
    updateVendedoresFilter();
    updateBancosFilter();
}

function updateVendedoresFilter() {
    const vendedores = new Set();
    contas.forEach(c => {
        if (c.vendedor?.trim()) {
            vendedores.add(c.vendedor.trim());
        }
    });

    const select = document.getElementById('filterVendedor');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Todos Vendedores</option>';
        Array.from(vendedores).sort().forEach(v => {
            const option = document.createElement('option');
            option.value = v;
            option.textContent = v;
            select.appendChild(option);
        });
        select.value = currentValue;
    }
}

function updateBancosFilter() {
    const bancos = new Set();
    contas.forEach(c => {
        if (c.banco?.trim()) {
            bancos.add(c.banco.trim());
        }
    });

    const select = document.getElementById('filterBanco');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Todos Bancos</option>';
        Array.from(bancos).sort().forEach(b => {
            const option = document.createElement('option');
            option.value = b;
            option.textContent = b;
            select.appendChild(option);
        });
        select.value = currentValue;
    }
}

// ============================================
// FILTROS E RENDERIZAÇÃO
// ============================================
function filterContas() {
    const searchTerm = document.getElementById('search')?.value.toLowerCase() || '';
    const filterVendedor = document.getElementById('filterVendedor')?.value || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    const filterBanco = document.getElementById('filterBanco')?.value || '';

    let filtered = [...contas];

    filtered = filtered.filter(c => {
        const data = new Date(c.data_emissao + 'T00:00:00');
        return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
    });

    if (filterVendedor) {
        filtered = filtered.filter(c => c.vendedor === filterVendedor);
    }

    if (filterStatus) {
        filtered = filtered.filter(c => c.status === filterStatus);
    }

    if (filterBanco) {
        filtered = filtered.filter(c => c.banco === filterBanco);
    }

    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.numero_nf?.toLowerCase().includes(searchTerm) ||
            c.orgao?.toLowerCase().includes(searchTerm) ||
            c.vendedor?.toLowerCase().includes(searchTerm) ||
            c.banco?.toLowerCase().includes(searchTerm)
        );
    }

    filtered.sort((a, b) => {
        const numA = parseInt(a.numero_nf.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.numero_nf.replace(/\D/g, '')) || 0;
        return numB - numA;
    });
    
    renderContas(filtered);
}

// ============================================
// RENDERIZAÇÃO
// ============================================
function renderContas(contasToRender) {
    const container = document.getElementById('contasContainer');

    if (!container) return;

    if (!contasToRender || contasToRender.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma conta encontrada para este período</div>';
        return;
    }

    const table = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th style="text-align: center; width: 60px;"> </th>
                        <th>NF</th>
                        <th>Órgão</th>
                        <th>Vendedor</th>
                        <th>Banco</th>
                        <th>Valor</th>
                        <th>Vencimento</th>
                        <th>Pagamento</th>
                        <th>Status</th>
                        <th style="text-align: center; min-width: 260px;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${contasToRender.map(c => {
                        const statusClass = c.status.toLowerCase().replace(' ', '-');
                        const isEspecial = c.tipo_nf && c.tipo_nf !== 'ENVIO';
                        const isEnvio = !c.tipo_nf || c.tipo_nf === 'ENVIO';
                        const isPago = c.status === 'PAGO';
                        const rowClass = isPago ? 'row-pago' : '';
                        return `
                        <tr class="${rowClass}">
                            <td style="text-align: center;">
                                ${isEnvio ? `
                                    <button class="check-btn ${isPago ? 'checked' : ''}" 
                                            onclick="togglePago('${c.id}')" 
                                            title="${isPago ? 'Marcar como não pago' : 'Marcar como pago'}">
                                            ✓
                                    </button>
                                ` : '-'}
                            </td>
                            <td><strong>${c.numero_nf}</strong></td>
                            <td>${c.orgao}</td>
                            <td>${c.vendedor}</td>
                            <td>${c.banco}</td>
                            <td><strong>${formatCurrency(c.valor)}</strong></td>
                            <td>${formatDate(c.data_vencimento)}</td>
                            <td>${c.data_pagamento ? formatDate(c.data_pagamento) : '-'}</td>
                            <td>
                                <span class="badge status-${isEspecial ? 'especial' : statusClass}">
                                    ${isEspecial ? c.tipo_nf.replace(/_/g, ' ') : c.status}
                                </span>
                            </td>
                            <td class="actions-cell" style="text-align: center;">
                                <button onclick="viewConta('${c.id}')" class="action-btn view">Ver</button>
                                <button onclick="editConta('${c.id}')" class="action-btn edit">Editar</button>
                                <button onclick="deleteConta('${c.id}')" class="action-btn delete">Excluir</button>
                            </td>
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = table;
}

// ============================================
// TOGGLE STATUS PAGO
// ============================================
window.togglePago = async function(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;

    const novoStatus = conta.status === 'PAGO' ? 'A RECEBER' : 'PAGO';
    const dataPagamento = novoStatus === 'PAGO' ? new Date().toISOString().split('T')[0] : null;

    const statusAnterior = conta.status;
    const dataPagamentoAnterior = conta.data_pagamento;

    conta.status = novoStatus;
    conta.data_pagamento = dataPagamento;

    updateDashboard();
    filterContas();

    if (novoStatus === 'PAGO') {
        showMessage('Pagamento confirmado', 'success');
    } else {
        showMessage('Confirmação de pagamento revogada', 'error');
    }

    if (isOnline) {
        try {
            const response = await fetch(`${API_URL}/contas/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Token': sessionToken,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(conta),
                mode: 'cors'
            });

            if (!response.ok) throw new Error('Erro ao atualizar');

            const savedData = await response.json();
            const index = contas.findIndex(c => c.id === id);
            if (index !== -1) contas[index] = mapearConta(savedData);
            
            updateDashboard();
            filterContas();
        } catch (error) {
            conta.status = statusAnterior;
            conta.data_pagamento = dataPagamentoAnterior;
            updateDashboard();
            filterContas();
        }
    }
};

// ============================================
// UTILIDADES
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatDateTime(isoString) {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showMessage(message, type) {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());

    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;

    document.body.appendChild(messageDiv);

    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}
