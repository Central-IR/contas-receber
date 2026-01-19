// ============================================
// CONFIGURAÇÃO
// ============================================
const DEVELOPMENT_MODE = false;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-mlxw.onrender.com';

let contas = [];
let isOnline = false;
let sessionToken = null;
let currentMonth = new Date();

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

console.log('✅ Contas a Receber iniciado');
console.log('📍 API URL:', API_URL);
console.log('🔧 Modo desenvolvimento:', DEVELOPMENT_MODE);

// ============================================
// CALENDAR - INTEGRADO NO SCRIPT PRINCIPAL
// ============================================
let calendarYear = new Date().getFullYear();

window.toggleCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    if (modal.classList.contains('show')) {
        modal.classList.remove('show');
    } else {
        calendarYear = currentMonth.getFullYear();
        renderCalendar();
        modal.classList.add('show');
    }
};

window.changeCalendarYear = function(direction) {
    calendarYear += direction;
    renderCalendar();
};

function renderCalendar() {
    const yearElement = document.getElementById('calendarYear');
    const monthsContainer = document.getElementById('calendarMonths');
    
    if (!yearElement || !monthsContainer) return;
    
    yearElement.textContent = calendarYear;
    
    const currentYear = currentMonth.getFullYear();
    const currentMonthIndex = currentMonth.getMonth();
    
    monthsContainer.innerHTML = meses.map((month, index) => {
        const isCurrent = calendarYear === currentYear && index === currentMonthIndex;
        return `
            <div class="calendar-month ${isCurrent ? 'current' : ''}" 
                 onclick="selectMonth(${index})">
                ${month}
            </div>
        `;
    }).join('');
}

window.selectMonth = function(monthIndex) {
    currentMonth = new Date(calendarYear, monthIndex, 1);
    updateDisplay();
    toggleCalendar();
};

// Fechar modal ao clicar fora
document.addEventListener('click', function(event) {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    const calendarContent = modal.querySelector('.calendar-content');
    const calendarBtn = event.target.closest('.calendar-btn[onclick="toggleCalendar()"]');
    
    if (modal.classList.contains('show') && 
        !calendarContent?.contains(event.target) && 
        !calendarBtn) {
        toggleCalendar();
    }
});

// Fechar modal com ESC
document.addEventListener('keydown', function(event) {
    const modal = document.getElementById('calendarModal');
    if (!modal) return;
    
    if (event.key === 'Escape' && modal.classList.contains('show')) {
        toggleCalendar();
    }
});

console.log('✅ Calendar integrado carregado');

// ============================================
// INICIALIZAÇÃO
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO ATIVADO');
        sessionToken = 'dev-mode';
        inicializarApp();
    } else {
        verificarAutenticacao();
    }
    
    setTimeout(setupEventDelegation, 100);
});

function setupEventDelegation() {
    console.log('🔧 Configurando Event Delegation...');
    console.log('✅ Event Delegation configurado');
}

// ============================================
// HANDLERS DE EVENTOS (EXPOSTOS GLOBALMENTE)
// ============================================
window.handleViewClick = function(id) {
    console.log('👁️ Visualizar conta:', id);
    const conta = contas.find(c => String(c.id) === String(id));
    if (!conta) {
        showToast('Conta não encontrada!', 'error');
        return;
    }
    mostrarModalVisualizacao(conta);
};

window.handleEditClick = function(id) {
    console.log('✏️ Editar conta:', id);
    const conta = contas.find(c => String(c.id) === String(id));
    if (!conta) {
        showToast('Conta não encontrada!', 'error');
        return;
    }
    showFormModal(String(id));
};

window.handleDeleteClick = function(id) {
    console.log('🗑️ Tentando excluir conta:', id);
    
    const confirmar = confirm('Tem certeza que deseja excluir esta conta?');
    
    if (!confirmar) {
        console.log('❌ Exclusão cancelada pelo usuário');
        return;
    }
    
    console.log('✅ Usuário confirmou exclusão');
    
    const idStr = String(id);
    const deletedConta = contas.find(c => String(c.id) === idStr);
    const numeroNF = deletedConta ? deletedConta.numero_nf : '';
    
    console.log('🗑️ Deletando NF:', numeroNF);
    
    // Remove localmente
    contas = contas.filter(c => String(c.id) !== idStr);
    updateAllFilters();
    updateDashboard();
    filterContas();
    showToast(`NF ${numeroNF} Excluído`, 'success');
    
    // Remove no servidor
    if (isOnline || DEVELOPMENT_MODE) {
        fetch(`${API_URL}/api/contas/${idStr}`, {
            method: 'DELETE',
            headers: {
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            mode: 'cors'
        })
        .then(response => {
            if (!response.ok) throw new Error('Erro ao deletar no servidor');
            console.log('✅ Deletado no servidor com sucesso');
        })
        .catch(error => {
            console.error('❌ Erro ao deletar no servidor:', error);
            if (deletedConta) {
                contas.push(deletedConta);
                updateAllFilters();
                updateDashboard();
                filterContas();
                showToast('Erro ao excluir no servidor', 'error');
            }
        });
    }
};

// ============================================
// MODAL DE VISUALIZAÇÃO
// ============================================
function mostrarModalVisualizacao(conta) {
    let observacoesArray = [];
    if (conta.observacoes) {
        try {
            observacoesArray = typeof conta.observacoes === 'string' 
                ? JSON.parse(conta.observacoes) 
                : conta.observacoes;
        } catch (e) {
            console.error('Erro ao parsear observações:', e);
        }
    }

    const observacoesHTML = observacoesArray.length > 0 
        ? observacoesArray.map(obs => `
            <div class="observacao-item-view">
                <div class="observacao-header">
                    <span class="observacao-data">${new Date(obs.timestamp).toLocaleString('pt-BR')}</span>
                </div>
                <p class="observacao-texto">${obs.texto}</p>
            </div>
        `).join('')
        : '<p style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 1rem;">Nenhuma observação registrada</p>';

    const displayValue = (val) => {
        if (!val || val === 'NÃO INFORMADO') return '-';
        return val;
    };

    const modalHTML = `
        <div class="modal-overlay" id="viewModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Conta</h3>
                    <button class="close-modal" onclick="closeViewModal()">✕</button>
                </div>
                
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchViewTab(0)">Dados da Conta</button>
                        <button class="tab-btn" onclick="switchViewTab(1)">Pagamento</button>
                        <button class="tab-btn" onclick="switchViewTab(2)">Observações</button>
                    </div>

                    <div class="tab-content active" id="view-tab-dados">
                        <div class="info-section">
                            <h4>Informações Gerais</h4>
                            <p><strong>Número NF:</strong> ${conta.numero_nf || '-'}</p>
                            <p><strong>Órgão:</strong> ${conta.orgao || '-'}</p>
                            <p><strong>Vendedor:</strong> ${displayValue(conta.vendedor)}</p>
                            <p><strong>Banco:</strong> ${displayValue(conta.banco)}</p>
                            <p><strong>Valor:</strong> R$ ${conta.valor ? parseFloat(conta.valor).toFixed(2) : '0,00'}</p>
                            <p><strong>Tipo NF:</strong> ${getTipoNfLabel(conta.tipo_nf)}</p>
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-pagamento">
                        <div class="info-section">
                            <h4>Dados de Pagamento</h4>
                            <p><strong>Data Emissão:</strong> ${conta.data_emissao ? formatDate(conta.data_emissao) : '-'}</p>
                            <p><strong>Data Vencimento:</strong> ${conta.data_vencimento ? formatDate(conta.data_vencimento) : '-'}</p>
                            <p><strong>Data Pagamento:</strong> ${conta.data_pagamento ? formatDate(conta.data_pagamento) : '-'}</p>
                            <p><strong>Status:</strong> ${getStatusBadge(conta.status)}</p>
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-observacoes">
                        <div class="info-section">
                            <h4>Observações</h4>
                            <div class="observacoes-list-view">
                                ${observacoesHTML}
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button class="secondary" onclick="closeViewModal()">Fechar</button>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('viewModal');
    if (existingModal) existingModal.remove();
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeViewModal = function() {
    const modal = document.getElementById('viewModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    }
};

window.switchViewTab = function(index) {
    document.querySelectorAll('#viewModal .tab-btn').forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });
    
    document.querySelectorAll('#viewModal .tab-content').forEach((content, i) => {
        content.classList.toggle('active', i === index);
    });
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

function inicializarApp() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            inicializarApp();
        });
        return;
    }
    
    updateDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
}

// ============================================
// CONEXÃO E STATUS
// ============================================
async function checkServerStatus() {
    try {
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };
        
        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/api/contas`, {
            method: 'GET',
            headers: headers,
            mode: 'cors',
            credentials: 'include'
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('contasReceberSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('✅ Servidor ONLINE');
            await loadContas();
        }
        
        updateConnectionStatus();
        return isOnline;
    } catch (error) {
        console.error('❌ Erro ao verificar servidor:', error);
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
async function loadContas(showMessage = false) {
    if (!isOnline && !DEVELOPMENT_MODE) {
        if (showMessage) {
            showToast('Sistema offline. Não foi possível sincronizar.', 'error');
        }
        return;
    }

    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_URL}/api/contas?_t=${timestamp}`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            mode: 'cors',
            credentials: 'include'
        });

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('contasReceberSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return;
        }

        if (!response.ok) {
            if (showMessage) {
                showToast('Erro ao sincronizar dados', 'error');
            }
            return;
        }

        const data = await response.json();
        contas = data;
        
        console.log(`✅ ${contas.length} contas carregadas`);
        
        updateAllFilters();
        updateDashboard();
        filterContas();
        
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
        if (showMessage) {
            showToast('Erro ao sincronizar dados', 'error');
        }
    }
}

window.sincronizarDados = async function() {
    console.log('🔄 Sincronizando dados...');
    
    const syncButtons = document.querySelectorAll('button[onclick="sincronizarDados()"]');
    syncButtons.forEach(btn => {
        const svg = btn.querySelector('svg');
        if (svg) {
            svg.style.animation = 'spin 1s linear infinite';
        }
    });
    
    showToast('Dados sincronizados', 'success');
    await loadContas(true);
    
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
    loadContas();
    setInterval(() => {
        if (isOnline) loadContas();
    }, 10000);
}

// ============================================
// NAVEGAÇÃO POR MESES
// ============================================
function updateDisplay() {
    const display = document.getElementById('currentMonth');
    if (display) {
        display.textContent = `${meses[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
    updateDashboard();
    filterContas();
}

window.changeMonth = function(direction) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    updateDisplay();
};

// ============================================
// DASHBOARD ATUALIZADO
// ============================================
function updateDashboard() {
    const statPago = document.getElementById('statPago');
    const statVencido = document.getElementById('statVencido');
    const statReceber = document.getElementById('statReceber');
    const statFaturado = document.getElementById('statFaturado');
    
    if (!statPago || !statVencido || !statReceber || !statFaturado) {
        console.warn('⚠️ Elementos do dashboard não encontrados');
        return;
    }
    
    const contasMesAtual = contas.filter(c => {
        const data = new Date(c.data_vencimento);
        return data.getMonth() === currentMonth.getMonth() && data.getFullYear() === currentMonth.getFullYear();
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    // Total Pago
    const totalPago = contasMesAtual
        .filter(c => c.status === 'PAGO')
        .reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);
    
    // Total Vencido (pendente + data vencimento menor que hoje)
    const totalVencido = contasMesAtual
        .filter(c => {
            if (c.status === 'PAGO') return false;
            if (!c.data_vencimento) return false;
            const venc = new Date(c.data_vencimento);
            venc.setHours(0, 0, 0, 0);
            return venc <= hoje;
        })
        .reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);
    
    // Total Faturado
    const totalFaturado = contasMesAtual
        .reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);
    
    // A Receber = Total Faturado - Total Pago
    const totalReceber = totalFaturado - totalPago;
    
    statPago.textContent = `R$ ${totalPago.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    statVencido.textContent = `R$ ${totalVencido.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    statReceber.textContent = `R$ ${totalReceber.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    statFaturado.textContent = `R$ ${totalFaturado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    // Badge de alerta para vencidos
    const cardVencido = document.getElementById('cardVencido');
    if (!cardVencido) return;
    
    let pulseBadge = cardVencido.querySelector('.pulse-badge');
    if (pulseBadge) {
        pulseBadge.remove();
    }
    
    if (totalVencido > 0) {
        cardVencido.classList.add('has-alert');
        
        pulseBadge = document.createElement('div');
        pulseBadge.className = 'pulse-badge';
        pulseBadge.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        `;
        cardVencido.appendChild(pulseBadge);
    } else {
        cardVencido.classList.remove('has-alert');
    }
}

// ============================================
// MODAL DE CONTAS VENCIDAS
// ============================================
window.showVencidosModal = function() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const contasVencidas = contas.filter(c => {
        if (c.status === 'PAGO') return false;
        if (!c.data_vencimento) return false;
        
        const venc = new Date(c.data_vencimento);
        venc.setHours(0, 0, 0, 0);
        return venc <= hoje;
    });
    
    contasVencidas.sort((a, b) => {
        const dataA = new Date(a.data_vencimento);
        const dataB = new Date(b.data_vencimento);
        return dataA - dataB;
    });
    
    const modalBody = document.getElementById('vencidosModalBody');
    if (!modalBody) return;
    
    if (contasVencidas.length === 0) {
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.3; margin-bottom: 1rem;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <path d="M12 8l0 4"></path>
                    <path d="M12 16l.01 0"></path>
                </svg>
                <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">Nenhuma conta vencida</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Todas as contas estão em dia</p>
            </div>
        `;
    } else {
        modalBody.innerHTML = `
            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Nº NF</th>
                            <th>Órgão</th>
                            <th>Vencimento</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${contasVencidas.map(c => `
                            <tr>
                                <td><strong>${c.numero_nf || '-'}</strong></td>
                                <td>${c.orgao || '-'}</td>
                                <td style="white-space: nowrap; color: #EF4444; font-weight: 600;">${formatDate(c.data_vencimento)}</td>
                                <td><strong>R$ ${parseFloat(c.valor || 0).toFixed(2)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    const vencidosModal = document.getElementById('vencidosModal');
    if (vencidosModal) {
        vencidosModal.style.display = 'flex';
    }
};

window.closeVencidosModal = function() {
    const vencidosModal = document.getElementById('vencidosModal');
    if (vencidosModal) {
        vencidosModal.style.display = 'none';
    }
};

// ============================================
// FORMULÁRIO COM OBSERVAÇÕES
// ============================================
window.toggleForm = function() {
    console.log('🆕 Abrindo formulário para nova conta');
    showFormModal(null);
};

function showFormModal(editingId = null) {
    console.log('📝 showFormModal chamada com ID:', editingId);
    showToast('Formulário em desenvolvimento', 'error');
    // TODO: Implementar formulário completo
}

window.showFormModal = showFormModal;

// ============================================
// FILTROS - ATUALIZAÇÃO DINÂMICA
// ============================================
function updateAllFilters() {
    updateVendedorFilter();
    updateBancoFilter();
}

function updateVendedorFilter() {
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

function updateBancoFilter() {
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
    const filterBanco = document.getElementById('filterBanco')?.value || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    
    let filtered = [...contas];

    filtered = filtered.filter(c => {
        const dataVencimento = new Date(c.data_vencimento);
        return dataVencimento.getMonth() === currentMonth.getMonth() && dataVencimento.getFullYear() === currentMonth.getFullYear();
    });

    if (filterVendedor) {
        filtered = filtered.filter(c => c.vendedor === filterVendedor);
    }

    if (filterBanco) {
        filtered = filtered.filter(c => c.banco === filterBanco);
    }

    if (filterStatus) {
        filtered = filtered.filter(c => c.status === filterStatus);
    }

    if (searchTerm) {
        filtered = filtered.filter(c => {
            const searchFields = [
                c.numero_nf,
                c.orgao,
                c.vendedor,
                c.banco
            ];
            
            return searchFields.some(field => 
                field && field.toString().toLowerCase().includes(searchTerm)
            );
        });
    }

    filtered.sort((a, b) => {
        const numA = parseInt(a.numero_nf) || 0;
        const numB = parseInt(b.numero_nf) || 0;
        return numA - numB;
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
        container.innerHTML = '<div style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma conta encontrada</div>';
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
                        <th>Emissão</th>
                        <th>Vencimento</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${contasToRender.map(c => {
                        const displayValue = (val) => {
                            if (!val || val === 'NÃO INFORMADO') return '-';
                            return val;
                        };
                        
                        return `
                        <tr data-id="${c.id}">
                            <td><strong>${c.numero_nf || '-'}</strong></td>
                            <td style="max-width: 200px; word-wrap: break-word; white-space: normal;">${c.orgao || '-'}</td>
                            <td>${displayValue(c.vendedor)}</td>
                            <td>${displayValue(c.banco)}</td>
                            <td style="white-space: nowrap;">${formatDate(c.data_emissao)}</td>
                            <td style="white-space: nowrap;">${formatDate(c.data_vencimento)}</td>
                            <td><strong>R$ ${c.valor ? parseFloat(c.valor).toFixed(2) : '0,00'}</strong></td>
                            <td>${getStatusBadge(c.status)}</td>
                            <td class="actions-cell" style="text-align: center; white-space: nowrap;">
                                <button class="action-btn view" onclick="handleViewClick('${c.id}')" title="Ver detalhes">Ver</button>
                                <button class="action-btn edit" onclick="handleEditClick('${c.id}')" title="Editar">Editar</button>
                                <button class="action-btn delete" onclick="handleDeleteClick('${c.id}')" title="Excluir">Excluir</button>
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
// UTILITÁRIOS
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function getTipoNfLabel(tipo) {
    const labels = {
        'ENVIO': 'Envio',
        'DEVOLUCAO': 'Devolução',
        'SIMPLES_REMESSA': 'Simples Remessa',
        'REMESSA_AMOSTRA': 'Remessa de Amostra'
    };
    return labels[tipo] || tipo || 'Envio';
}

function getStatusBadge(status) {
    const badges = {
        'PAGO': '<span class="status-badge status-success">PAGO</span>',
        'PENDENTE': '<span class="status-badge status-warning">PENDENTE</span>',
        'VENCIDO': '<span class="status-badge status-danger">VENCIDO</span>',
        'ESPECIAL': '<span class="badge badge-especial">ESPECIAL</span>'
    };
    return badges[status] || `<span class="status-badge">${status}</span>`;
}

function showToast(message, type) {
    const oldMessages = document.querySelectorAll('.floating-message');
    oldMessages.forEach(msg => msg.remove());
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `floating-message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOutBottom 0.3s ease forwards';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

console.log('✅ Script completo carregado com sucesso!');
console.log('📅 Calendar integrado no script principal');
