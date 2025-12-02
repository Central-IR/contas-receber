// ============================================
// CONFIGURAÇÃO
// ============================================
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-m1xw.onrender.com/api';

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

document.addEventListener('DOMContentLoaded', () => {
    verificarAutenticacao();
});

// ============================================
// NAVEGAÇÃO POR MESES
// ============================================
function updateMonthDisplay() {
    const display = document.getElementById('currentMonthDisplay');
    if (display) {
        display.textContent = `${meses[currentMonth]} ${currentYear}`;
    }
    updateDashboard();
    filterContas();
}

window.previousMonth = function() {
    currentMonth--;
    if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateMonthDisplay();
};

window.nextMonth = function() {
    currentMonth++;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    }
    updateMonthDisplay();
};

// ============================================
// MODAL DE CONFIRMAÇÃO PERSONALIZADO
// ============================================
function showConfirm(message, options = {}) {
    return new Promise((resolve) => {
        const { title = 'Confirmação', confirmText = 'Confirmar', cancelText = 'Cancelar', type = 'warning' } = options;

        const modalHTML = `
            <div class="modal-overlay" id="confirmModal" style="z-index: 10001;">
                <div class="modal-content" style="max-width: 450px;">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                    </div>
                    <p style="margin: 1.5rem 0; color: var(--text-primary); font-size: 1rem; line-height: 1.6;">${message}</p>
                    <div class="modal-actions">
                        <button class="secondary" id="modalCancelBtn">${cancelText}</button>
                        <button class="${type === 'warning' ? 'danger' : 'success'}" id="modalConfirmBtn">${confirmText}</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById('confirmModal');
        const confirmBtn = document.getElementById('modalConfirmBtn');
        const cancelBtn = document.getElementById('modalCancelBtn');

        const closeModal = (result) => {
            modal.style.animation = 'fadeOut 0.2s ease forwards';
            setTimeout(() => { 
                modal.remove(); 
                resolve(result); 
            }, 200);
        };

        confirmBtn.addEventListener('click', () => closeModal(true));
        cancelBtn.addEventListener('click', () => closeModal(false));

        if (!document.querySelector('#modalAnimations')) {
            const style = document.createElement('style');
            style.id = 'modalAnimations';
            style.textContent = `@keyframes fadeOut { to { opacity: 0; } }`;
            document.head.appendChild(style);
        }
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
        }
    } catch (error) {
        console.error('Erro ao carregar:', error);
    }
}

function mapearConta(conta) {
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
        status: conta.status || 'PENDENTE',
        observacoes: conta.observacoes || '',
        created_at: conta.created_at || new Date().toISOString()
    };
}

function startPolling() {
    setInterval(() => {
        if (isOnline) loadContas();
    }, 30000); // Polling a cada 30 segundos
}

// ============================================
// DASHBOARD
// ============================================
function updateDashboard() {
    const contasMesAtual = contas.filter(c => {
        const data = new Date(c.data_vencimento + 'T00:00:00');
        return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
    });

    const totalFaturado = contasMesAtual.reduce((sum, c) => sum + c.valor, 0);
    const totalPago = contasMesAtual.filter(c => c.status === 'PAGO').reduce((sum, c) => sum + c.valor, 0);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const totalVencido = contasMesAtual
        .filter(c => {
            if (c.status === 'PAGO') return false;
            const vencimento = new Date(c.data_vencimento + 'T00:00:00');
            return vencimento < hoje;
        })
        .reduce((sum, c) => sum + c.valor, 0);
    
    const totalPendente = contasMesAtual
        .filter(c => {
            if (c.status === 'PAGO') return false;
            const vencimento = new Date(c.data_vencimento + 'T00:00:00');
            return vencimento >= hoje;
        })
        .reduce((sum, c) => sum + c.valor, 0);

    document.getElementById('statFaturado').textContent = `R$ ${totalFaturado.toFixed(2).replace('.', ',')}`;
    document.getElementById('statPago').textContent = `R$ ${totalPago.toFixed(2).replace('.', ',')}`;
    document.getElementById('statVencido').textContent = `R$ ${totalVencido.toFixed(2).replace('.', ',')}`;
    document.getElementById('statPendente').textContent = `R$ ${totalPendente.toFixed(2).replace('.', ',')}`;

    // Mostrar badges de alerta
    const badgeVencido = document.getElementById('pulseBadgeVencido');
    const badgePendente = document.getElementById('pulseBadgePendente');
    const cardVencido = document.getElementById('cardVencido');
    const cardPendente = document.getElementById('cardPendente');

    if (totalVencido > 0) {
        badgeVencido.style.display = 'flex';
        cardVencido.classList.add('has-alert');
    } else {
        badgeVencido.style.display = 'none';
        cardVencido.classList.remove('has-alert');
    }

    if (totalPendente > 0) {
        badgePendente.style.display = 'flex';
        cardPendente.classList.add('has-alert');
    } else {
        badgePendente.style.display = 'none';
        cardPendente.classList.remove('has-alert');
    }
}

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
            showMessage('Conta não encontrada!', 'error');
            return;
        }
    }

    const modalHTML = `
        <div class="modal-overlay" id="formModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${isEditing ? 'Editar Conta' : 'Nova Conta a Receber'}</h3>
                </div>
                
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchFormTab(0)">Informações Básicas</button>
                        <button class="tab-btn" onclick="switchFormTab(1)">Valores e Datas</button>
                        <button class="tab-btn" onclick="switchFormTab(2)">Observações</button>
                    </div>

                    <form id="contaForm" onsubmit="handleSubmit(event)">
                        <input type="hidden" id="editId" value="${editingId || ''}">
                        
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
                                        <option value="GUSTAVO" ${conta?.vendedor === 'GUSTAVO' ? 'selected' : ''}>GUSTAVO</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="banco">Banco *</label>
                                    <select id="banco" required>
                                        <option value="">Selecione...</option>
                                        <option value="BANCO DO BRASIL" ${conta?.banco === 'BANCO DO BRASIL' ? 'selected' : ''}>BANCO DO BRASIL</option>
                                        <option value="CAIXA ECONÔMICA" ${conta?.banco === 'CAIXA ECONÔMICA' ? 'selected' : ''}>CAIXA ECONÔMICA</option>
                                        <option value="BRADESCO" ${conta?.banco === 'BRADESCO' ? 'selected' : ''}>BRADESCO</option>
                                        <option value="ITAÚ" ${conta?.banco === 'ITAÚ' ? 'selected' : ''}>ITAÚ</option>
                                        <option value="SANTANDER" ${conta?.banco === 'SANTANDER' ? 'selected' : ''}>SANTANDER</option>
                                        <option value="SICOOB" ${conta?.banco === 'SICOOB' ? 'selected' : ''}>SICOOB</option>
                                        <option value="OUTRO" ${conta?.banco === 'OUTRO' ? 'selected' : ''}>OUTRO</option>
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
                                <div class="form-group">
                                    <label for="status">Status *</label>
                                    <select id="status" required>
                                        <option value="PENDENTE" ${conta?.status === 'PENDENTE' ? 'selected' : ''}>PENDENTE</option>
                                        <option value="PAGO" ${conta?.status === 'PAGO' ? 'selected' : ''}>PAGO</option>
                                        <option value="VENCIDO" ${conta?.status === 'VENCIDO' ? 'selected' : ''}>VENCIDO</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-observacoes">
                            <div class="form-grid">
                                <div class="form-group" style="grid-column: 1 / -1;">
                                    <label for="observacoes">Observações</label>
                                    <textarea id="observacoes" rows="6">${conta?.observacoes || ''}</textarea>
                                </div>
                            </div>
                        </div>

                        <div class="modal-actions">
                            <button type="submit" class="save">${isEditing ? 'Atualizar' : 'Salvar'}</button>
                            <button type="button" class="secondary" onclick="closeFormModal()">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Campos em maiúsculas
    const camposMaiusculas = ['numero_nf', 'orgao', 'observacoes'];
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
    
    // Auto-atualizar status quando data de pagamento for preenchida
    const dataPagamento = document.getElementById('data_pagamento');
    const statusSelect = document.getElementById('status');
    
    if (dataPagamento && statusSelect) {
        dataPagamento.addEventListener('change', () => {
            if (dataPagamento.value) {
                statusSelect.value = 'PAGO';
            }
        });
    }
    
    setTimeout(() => document.getElementById('numero_nf')?.focus(), 100);
}

function closeFormModal() {
    const modal = document.getElementById('formModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    }
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
async function handleSubmit(event) {
    if (event) event.preventDefault();

    const formData = {
        numero_nf: document.getElementById('numero_nf').value.trim().toUpperCase(),
        orgao: document.getElementById('orgao').value.trim().toUpperCase(),
        vendedor: document.getElementById('vendedor').value.trim(),
        banco: document.getElementById('banco').value.trim(),
        valor: parseFloat(document.getElementById('valor').value),
        data_emissao: document.getElementById('data_emissao').value,
        data_vencimento: document.getElementById('data_vencimento').value,
        data_pagamento: document.getElementById('data_pagamento').value || null,
        status: document.getElementById('status').value,
        observacoes: document.getElementById('observacoes').value.trim().toUpperCase()
    };

    const editId = document.getElementById('editId').value;

    if (!isOnline) {
        showMessage('Sistema offline. Dados não foram salvos.', 'error');
        closeFormModal();
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
            const errorData = await response.json();
            throw new Error(errorData.details || 'Erro ao salvar');
        }

        const savedData = await response.json();
        const mappedData = mapearConta(savedData);

        if (editId) {
            const index = contas.findIndex(c => c.id === editId);
            if (index !== -1) contas[index] = mappedData;
            showMessage('Conta atualizada!', 'success');
        } else {
            contas.push(mappedData);
            showMessage('Conta criada!', 'success');
        }

        lastDataHash = JSON.stringify(contas.map(c => c.id));
        updateAllFilters();
        updateDashboard();
        filterContas();
        closeFormModal();

    } catch (error) {
        console.error('Erro:', error);
        showMessage(`Erro: ${error.message}`, 'error');
    }
}

// ============================================
// EDIÇÃO
// ============================================
window.editConta = function(id) {
    const conta = contas.find(c => c.id === id);
    
    if (!conta) {
        showMessage('Conta não encontrada!', 'error');
        return;
    }
    
    showFormModal(id);
};

// ============================================
// EXCLUSÃO
// ============================================
window.deleteConta = async function(id) {
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
    showMessage('Conta excluída!', 'success');

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
                showMessage('Erro ao excluir', 'error');
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
        showMessage('Conta não encontrada!', 'error');
        return;
    }

    const modalHTML = `
        <div class="modal-overlay" id="viewModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Conta</h3>
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
                            <p><strong>Status:</strong> <span class="badge status-${conta.status.toLowerCase()}">${conta.status}</span></p>
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-valores">
                        <div class="info-section">
                            <h4>Valores e Datas</h4>
                            <p><strong>Valor:</strong> R$ ${conta.valor.toFixed(2).replace('.', ',')}</p>
                            <p><strong>Data de Emissão:</strong> ${formatDate(conta.data_emissao)}</p>
                            <p><strong>Data de Vencimento:</strong> ${formatDate(conta.data_vencimento)}</p>
                            ${conta.data_pagamento ? `<p><strong>Data de Pagamento:</strong> ${formatDate(conta.data_pagamento)}</p>` : '<p><strong>Data de Pagamento:</strong> Não pago</p>'}
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-observacoes">
                        <div class="info-section">
                            <h4>Observações</h4>
                            <p>${conta.observacoes || 'Sem observações'}</p>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="secondary" onclick="closeViewModal()">Fechar</button>
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
        select.innerHTML = '<option value="">Todos</option>';
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
        select.innerHTML = '<option value="">Todos</option>';
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

    // Filtro por mês
    filtered = filtered.filter(c => {
        const data = new Date(c.data_vencimento + 'T00:00:00');
        return data.getMonth() === currentMonth && data.getFullYear() === currentYear;
    });

    // Filtro por vendedor
    if (filterVendedor) {
        filtered = filtered.filter(c => c.vendedor === filterVendedor);
    }

    // Filtro por status
    if (filterStatus) {
        filtered = filtered.filter(c => c.status === filterStatus);
    }

    // Filtro por banco
    if (filterBanco) {
        filtered = filtered.filter(c => c.banco === filterBanco);
    }

    // Busca textual
    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.numero_nf?.toLowerCase().includes(searchTerm) ||
            c.orgao?.toLowerCase().includes(searchTerm) ||
            c.vendedor?.toLowerCase().includes(searchTerm) ||
            c.banco?.toLowerCase().includes(searchTerm)
        );
    }

    filtered.sort((a, b) => new Date(b.data_vencimento) - new Date(a.data_vencimento));
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
                        const statusClass = c.status.toLowerCase();
                        return `
                        <tr>
                            <td><strong>${c.numero_nf}</strong></td>
                            <td>${c.orgao}</td>
                            <td>${c.vendedor}</td>
                            <td>${c.banco}</td>
                            <td><strong>R$ ${c.valor.toFixed(2).replace('.', ',')}</strong></td>
                            <td>${formatDate(c.data_vencimento)}</td>
                            <td>${c.data_pagamento ? formatDate(c.data_pagamento) : '-'}</td>
                            <td>
                                <span class="badge status-${statusClass}">
                                    ${c.status}
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

    const novoStatus = conta.status === 'PAGO' ? 'PENDENTE' : 'PAGO';
    const dataPagamento = novoStatus === 'PAGO' ? new Date().toISOString().split('T')[0] : null;
    
    const statusAnterior = conta.status;
    const dataPagamentoAnterior = conta.data_pagamento;
    
    conta.status = novoStatus;
    conta.data_pagamento = dataPagamento;
    
    updateDashboard();
    filterContas();
    
    showMessage(`Conta marcada como ${novoStatus}!`, 'success');

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
        } catch (error) {
            conta.status = statusAnterior;
            conta.data_pagamento = dataPagamentoAnterior;
            updateDashboard();
            filterContas();
            showMessage('Erro ao atualizar status', 'error');
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
