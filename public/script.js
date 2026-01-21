// ============================================
// CONFIGURAÇÃO
// ============================================
const DEVELOPMENT_MODE = false;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-api.onrender.com/api';

let contas = [];
let isOnline = false;
let lastDataHash = '';
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

// ============================================
// EVENT DELEGATION
// ============================================
function setupEventDelegation() {
    console.log('🔧 Configurando Event Delegation...');
    console.log('✅ Event Delegation configurado');
}

// ============================================
// HANDLERS DE EVENTOS
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
    
    contas = contas.filter(c => String(c.id) !== idStr);
    updateAllFilters();
    updateDashboard();
    filterContas();
    showToast(`NF ${numeroNF} Excluído`, 'success');
    
    if (isOnline || DEVELOPMENT_MODE) {
        fetch(`${API_URL}/contas/${idStr}`, {
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
                <button class="modal-close-x" onclick="closeViewModal()" title="Fechar">✕</button>
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Conta</h3>
                </div>
                <div class="modal-body">
                    <div class="view-grid">
                        <div class="view-item">
                            <span class="view-label">Nº NF</span>
                            <span class="view-value"><strong>${conta.numero_nf || '-'}</strong></span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Órgão</span>
                            <span class="view-value">${displayValue(conta.orgao)}</span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Vendedor</span>
                            <span class="view-value">${displayValue(conta.vendedor)}</span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Banco</span>
                            <span class="view-value">${displayValue(conta.banco)}</span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Valor</span>
                            <span class="view-value"><strong>R$ ${conta.valor ? parseFloat(conta.valor).toFixed(2) : '0,00'}</strong></span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Data Emissão</span>
                            <span class="view-value">${formatDate(conta.data_emissao)}</span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Data Vencimento</span>
                            <span class="view-value">${formatDate(conta.data_vencimento)}</span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Data Pagamento</span>
                            <span class="view-value">${formatDate(conta.data_pagamento)}</span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Status</span>
                            <span class="view-value">${getStatusBadge(conta.status)}</span>
                        </div>
                        <div class="view-item">
                            <span class="view-label">Tipo NF</span>
                            <span class="view-value">${getTipoNfLabel(conta.tipo_nf)}</span>
                        </div>
                    </div>

                    <div class="observacoes-section">
                        <h4 class="observacoes-title">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                                <line x1="16" y1="13" x2="8" y2="13"></line>
                                <line x1="16" y1="17" x2="8" y2="17"></line>
                                <polyline points="10 9 9 9 8 9"></polyline>
                            </svg>
                            Observações
                        </h4>
                        <div class="observacoes-list">
                            ${observacoesHTML}
                        </div>
                    </div>
                </div>
                <div class="modal-actions">
                    <button type="button" onclick="closeViewModal()" class="btn-secondary">Fechar</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeViewModal = function() {
    const modal = document.getElementById('viewModal');
    if (modal) modal.remove();
};

// ============================================
// AUTENTICAÇÃO
// ============================================
async function verificarAutenticacao() {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (!token) {
        console.log('❌ Token não encontrado, redirecionando...');
        window.location.href = PORTAL_URL;
        return;
    }
    
    sessionToken = token;
    console.log('✅ Token recebido:', token.substring(0, 20) + '...');
    
    inicializarApp();
}

// ============================================
// INICIALIZAR APP
// ============================================
function inicializarApp() {
    console.log('🚀 Inicializando aplicação...');
    
    initCalendar();
    updateMonthDisplay();
    carregarContas();
    
    setInterval(() => {
        if (isOnline || DEVELOPMENT_MODE) {
            carregarContas();
        }
    }, 30000);
}

// ============================================
// CARREGAR CONTAS
// ============================================
async function carregarContas() {
    try {
        console.log('📥 Carregando contas...');
        
        const response = await fetch(`${API_URL}/contas`, {
            headers: {
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            mode: 'cors'
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        console.log('✅ Contas carregadas:', data.length);
        
        contas = data;
        
        updateConnectionStatus(true);
        updateAllFilters();
        updateDashboard();
        filterContas();
        
    } catch (error) {
        console.error('❌ Erro ao carregar contas:', error);
        updateConnectionStatus(false);
        showToast('Erro ao carregar contas', 'error');
    }
}

// ============================================
// ATUALIZAR STATUS DE CONEXÃO
// ============================================
function updateConnectionStatus(online) {
    isOnline = online;
    const statusElement = document.getElementById('connectionStatus');
    
    if (statusElement) {
        if (online) {
            statusElement.classList.remove('offline');
            statusElement.classList.add('online');
        } else {
            statusElement.classList.remove('online');
            statusElement.classList.add('offline');
        }
    }
}

// ============================================
// SINCRONIZAR DADOS
// ============================================
window.sincronizarDados = async function() {
    showToast('Sincronizando...', 'info');
    await carregarContas();
    showToast('Dados sincronizados', 'success');
};

// ============================================
// ATUALIZAR DASHBOARD
// ============================================
function updateDashboard() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    let totalPago = 0;
    let totalVencido = 0;
    let totalFaturado = 0;
    
    contas.forEach(conta => {
        const valor = parseFloat(conta.valor) || 0;
        
        // Faturado: todas as contas
        totalFaturado += valor;
        
        // Pago: status PAGO
        if (conta.status === 'PAGO') {
            totalPago += valor;
        }
        
        // Vencido: não pago e data vencimento menor que hoje
        if (conta.status !== 'PAGO' && conta.data_vencimento) {
            const dataVenc = new Date(conta.data_vencimento + 'T00:00:00');
            dataVenc.setHours(0, 0, 0, 0);
            
            if (dataVenc < hoje) {
                totalVencido += valor;
            }
        }
    });
    
    // A Receber = Faturado - Pago
    const totalReceber = totalFaturado - totalPago;
    
    document.getElementById('statPago').textContent = `R$ ${totalPago.toFixed(2)}`;
    document.getElementById('statVencido').textContent = `R$ ${totalVencido.toFixed(2)}`;
    document.getElementById('statReceber').textContent = `R$ ${totalReceber.toFixed(2)}`;
    document.getElementById('statFaturado').textContent = `R$ ${totalFaturado.toFixed(2)}`;
}

// ============================================
// ATUALIZAR FILTROS
// ============================================
function updateAllFilters() {
    const vendedores = [...new Set(contas.map(c => c.vendedor).filter(Boolean))].sort();
    const bancos = [...new Set(contas.map(c => c.banco).filter(Boolean))].sort();
    
    const filterVendedor = document.getElementById('filterVendedor');
    if (filterVendedor) {
        const currentValue = filterVendedor.value;
        filterVendedor.innerHTML = '<option value="">Todos Vendedores</option>' +
            vendedores.map(v => `<option value="${v}">${v}</option>`).join('');
        filterVendedor.value = currentValue;
    }
    
    const filterBanco = document.getElementById('filterBanco');
    if (filterBanco) {
        const currentValue = filterBanco.value;
        filterBanco.innerHTML = '<option value="">Todos Bancos</option>' +
            bancos.map(b => `<option value="${b}">${b}</option>`).join('');
        filterBanco.value = currentValue;
    }
}

// ============================================
// FILTRAR CONTAS
// ============================================
function filterContas() {
    const searchTerm = document.getElementById('search').value.toLowerCase();
    const filterVendedor = document.getElementById('filterVendedor').value;
    const filterBanco = document.getElementById('filterBanco').value;
    const filterStatus = document.getElementById('filterStatus').value;
    
    const mesAtual = currentMonth.getMonth();
    const anoAtual = currentMonth.getFullYear();
    
    const filtered = contas.filter(conta => {
        const dataEmissao = new Date(conta.data_emissao + 'T00:00:00');
        const mesEmissao = dataEmissao.getMonth();
        const anoEmissao = dataEmissao.getFullYear();
        
        if (mesEmissao !== mesAtual || anoEmissao !== anoAtual) return false;
        
        const matchSearch = !searchTerm || 
            (conta.numero_nf && conta.numero_nf.toLowerCase().includes(searchTerm)) ||
            (conta.orgao && conta.orgao.toLowerCase().includes(searchTerm)) ||
            (conta.vendedor && conta.vendedor.toLowerCase().includes(searchTerm));
        
        const matchVendedor = !filterVendedor || conta.vendedor === filterVendedor;
        const matchBanco = !filterBanco || conta.banco === filterBanco;
        const matchStatus = !filterStatus || conta.status === filterStatus;
        
        return matchSearch && matchVendedor && matchBanco && matchStatus;
    });
    
    renderContas(filtered);
}

// ============================================
// RENDERIZAR CONTAS
// ============================================
function renderContas(contasToRender) {
    const container = document.getElementById('contasContainer');
    
    if (!contasToRender || contasToRender.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity: 0.3; margin-bottom: 1rem;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">Nenhuma conta encontrada</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Tente ajustar os filtros ou adicionar uma nova conta</p>
            </div>
        `;
        return;
    }
    
    const displayValue = (val) => {
        if (!val || val === 'NÃO INFORMADO') return '-';
        return val;
    };
    
    const table = `
        <div class="table-wrapper">
            <table>
                <thead>
                    <tr>
                        <th style="width: 120px;">Nº NF</th>
                        <th style="width: 120px;">Data Emissão</th>
                        <th>Órgão</th>
                        <th style="width: 140px;">Vendedor</th>
                        <th style="width: 140px;">Banco</th>
                        <th style="width: 120px;">Valor</th>
                        <th style="width: 140px;">Status</th>
                        <th style="width: 240px; text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${contasToRender.map(c => `
                        <tr data-id="${c.id}">
                            <td><strong>${c.numero_nf || '-'}</strong></td>
                            <td style="white-space: nowrap;">${formatDate(c.data_emissao)}</td>
                            <td>${displayValue(c.orgao)}</td>
                            <td>${displayValue(c.vendedor)}</td>
                            <td>${displayValue(c.banco)}</td>
                            <td><strong>R$ ${c.valor ? parseFloat(c.valor).toFixed(2) : '0,00'}</strong></td>
                            <td>${getStatusBadgeForRender(c)}</td>
                            <td class="actions-cell" style="text-align: center; white-space: nowrap;">
                                <button class="action-btn view" onclick="handleViewClick('${c.id}')" title="Ver detalhes">Ver</button>
                                <button class="action-btn edit" onclick="handleEditClick('${c.id}')" title="Editar">Editar</button>
                                <button class="action-btn delete" onclick="handleDeleteClick('${c.id}')" title="Excluir">Excluir</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    container.innerHTML = table;
}

// ============================================
// BADGES E LABELS
// ============================================
function getTipoNfLabel(tipo) {
    const labels = {
        'ENVIO': 'Envio',
        'CANCELADA': 'Cancelada',
        'REMESSA_AMOSTRA': 'Remessa de Amostra',
        'SIMPLES_REMESSA': 'Simples Remessa',
        'DEVOLUCAO': 'Devolução'
    };
    return labels[tipo] || tipo || 'Envio';
}

function getStatusBadgeForRender(conta) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (conta.status === 'PAGO') {
        return '<span class="badge entregue">PAGO</span>';
    }
    
    if (conta.data_vencimento) {
        const dataVenc = new Date(conta.data_vencimento + 'T00:00:00');
        dataVenc.setHours(0, 0, 0, 0);
        
        if (dataVenc < hoje) {
            return '<span class="badge devolvido">VENCIDO</span>';
        }
    }
    
    return '<span class="badge transito">PENDENTE</span>';
}

function getStatusBadge(status) {
    const statusMap = {
        'PENDENTE': { class: 'transito', text: 'Pendente' },
        'PAGO': { class: 'entregue', text: 'Pago' },
        'VENCIDO': { class: 'devolvido', text: 'Vencido' },
        'A_RECEBER': { class: 'transito', text: 'A Receber' }
    };
    
    const s = statusMap[status] || { class: 'transito', text: status };
    return `<span class="badge ${s.class}">${s.text}</span>`;
}

// ============================================
// UTILIDADES
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
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

// ============================================
// MODAL DE VENCIDOS
// ============================================
window.showVencidosModal = function() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencidos = contas.filter(c => {
        if (c.status === 'PAGO') return false;
        if (!c.data_vencimento) return false;
        
        const dataVenc = new Date(c.data_vencimento + 'T00:00:00');
        dataVenc.setHours(0, 0, 0, 0);
        return dataVenc < hoje;
    });
    
    vencidos.sort((a, b) => {
        const dataA = new Date(a.data_vencimento);
        const dataB = new Date(b.data_vencimento);
        return dataA - dataB;
    });
    
    const modalBody = document.getElementById('vencidosModalBody');
    if (!modalBody) return;
    
    if (vencidos.length === 0) {
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
                            <th>Data Emissão</th>
                            <th>Órgão</th>
                            <th>Vencimento</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vencidos.map(c => `
                            <tr>
                                <td><strong>${c.numero_nf || '-'}</strong></td>
                                <td style="white-space: nowrap;">${formatDate(c.data_emissao)}</td>
                                <td>${c.orgao || '-'}</td>
                                <td style="white-space: nowrap; color: #EF4444; font-weight: 600;">${formatDate(c.data_vencimento)}</td>
                                <td><strong>R$ ${c.valor ? parseFloat(c.valor).toFixed(2) : '0,00'}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    const modal = document.getElementById('vencidosModal');
    if (modal) {
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
// FORMULÁRIO COMPLETO
// ============================================
window.toggleForm = function() {
    console.log('🆕 Abrindo formulário para nova conta');
    showFormModal(null);
};

window.showFormModal = function(editingId = null) {
    console.log('📝 showFormModal chamada com ID:', editingId);
    
    const isEditing = editingId !== null;
    let conta = null;
    
    if (isEditing) {
        const idStr = String(editingId);
        conta = contas.find(c => String(c.id) === idStr);
        
        if (!conta) {
            showToast('Conta não encontrada!', 'error');
            return;
        }
        console.log('✏️ Editando conta:', conta);
    } else {
        console.log('🆕 Criando nova conta');
    }

    let observacoesArray = [];
    if (conta && conta.observacoes) {
        try {
            observacoesArray = typeof conta.observacoes === 'string' 
                ? JSON.parse(conta.observacoes) 
                : conta.observacoes;
        } catch (e) {
            console.error('Erro ao parsear observações:', e);
        }
    }

    const observacoesHTML = observacoesArray.length > 0 
        ? observacoesArray.map((obs, idx) => `
            <div class="observacao-item" data-index="${idx}">
                <div class="observacao-header">
                    <span class="observacao-data">${new Date(obs.timestamp).toLocaleString('pt-BR')}</span>
                    <button type="button" class="btn-remove-obs" onclick="removerObservacao(${idx})" title="Remover">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
                <p class="observacao-texto">${obs.texto}</p>
            </div>
        `).join('')
        : '<p style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 2rem;">Nenhuma observação registrada</p>';

    const modalHTML = `
        <div class="modal-overlay" id="formModal" style="display: flex;">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">${isEditing ? 'Editar Conta' : 'Nova Conta'}</h3>
                    <button class="close-modal" onclick="closeFormModal(true)">✕</button>
                </div>
                
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchFormTab(0)">Dados da Conta</button>
                        <button class="tab-btn" onclick="switchFormTab(1)">Pagamento</button>
                        <button class="tab-btn" onclick="switchFormTab(2)">Observações</button>
                    </div>

                    <form id="contaForm" onsubmit="handleSubmit(event)">
                        <input type="hidden" id="editId" value="${editingId || ''}">
                        <input type="hidden" id="observacoesData" value='${JSON.stringify(observacoesArray)}'>
                        
                        <div class="tab-content active" id="tab-dados">
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
                                    <label for="vendedor">Vendedor</label>
                                    <select id="vendedor">
                                        <option value="">Selecione...</option>
                                        <option value="ROBERTO" ${conta?.vendedor === 'ROBERTO' ? 'selected' : ''}>ROBERTO</option>
                                        <option value="ISAQUE" ${conta?.vendedor === 'ISAQUE' ? 'selected' : ''}>ISAQUE</option>
                                        <option value="MIGUEL" ${conta?.vendedor === 'MIGUEL' ? 'selected' : ''}>MIGUEL</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="banco">Banco</label>
                                    <select id="banco">
                                        <option value="">Selecione...</option>
                                        <option value="ITAÚ" ${conta?.banco === 'ITAÚ' ? 'selected' : ''}>ITAÚ</option>
                                        <option value="BRADESCO" ${conta?.banco === 'BRADESCO' ? 'selected' : ''}>BRADESCO</option>
                                        <option value="CAIXA" ${conta?.banco === 'CAIXA' ? 'selected' : ''}>CAIXA</option>
                                        <option value="BANCO DO BRASIL" ${conta?.banco === 'BANCO DO BRASIL' ? 'selected' : ''}>BANCO DO BRASIL</option>
                                        <option value="SANTANDER" ${conta?.banco === 'SANTANDER' ? 'selected' : ''}>SANTANDER</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label for="valor">Valor (R$) *</label>
                                    <input type="number" id="valor" step="0.01" min="0" value="${conta?.valor || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="data_emissao">Data de Emissão *</label>
                                    <input type="date" id="data_emissao" value="${conta?.data_emissao || ''}" required>
                                </div>
                                <div class="form-group">
                                    <label for="tipo_nf">Tipo de NF</label>
                                    <select id="tipo_nf">
                                        <option value="ENVIO" ${!conta?.tipo_nf || conta?.tipo_nf === 'ENVIO' ? 'selected' : ''}>Envio</option>
                                        <option value="CANCELADA" ${conta?.tipo_nf === 'CANCELADA' ? 'selected' : ''}>Cancelada</option>
                                        <option value="REMESSA_AMOSTRA" ${conta?.tipo_nf === 'REMESSA_AMOSTRA' ? 'selected' : ''}>Remessa de Amostra</option>
                                        <option value="SIMPLES_REMESSA" ${conta?.tipo_nf === 'SIMPLES_REMESSA' ? 'selected' : ''}>Simples Remessa</option>
                                        <option value="DEVOLUCAO" ${conta?.tipo_nf === 'DEVOLUCAO' ? 'selected' : ''}>Devolução</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-pagamento">
                            <div class="form-grid">
                                <div class="form-group">
                                    <label for="data_vencimento">Data de Vencimento</label>
                                    <input type="date" id="data_vencimento" value="${conta?.data_vencimento || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="data_pagamento">Data de Pagamento</label>
                                    <input type="date" id="data_pagamento" value="${conta?.data_pagamento || ''}">
                                </div>
                                <div class="form-group">
                                    <label for="status">Status</label>
                                    <select id="status">
                                        <option value="A_RECEBER" ${!conta?.status || conta?.status === 'A_RECEBER' ? 'selected' : ''}>A Receber</option>
                                        <option value="PAGO" ${conta?.status === 'PAGO' ? 'selected' : ''}>Pago</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div class="tab-content" id="tab-observacoes">
                            <div class="observacoes-section">
                                <div class="observacoes-list" id="observacoesList">
                                    ${observacoesHTML}
                                </div>
                                
                                <div class="nova-observacao">
                                    <label for="novaObservacao">Nova Observação</label>
                                    <textarea id="novaObservacao" placeholder="Digite sua observação aqui..." rows="3"></textarea>
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
                            <button type="submit" class="save">${editingId ? 'Atualizar' : 'Salvar'}</button>
                            <button type="button" class="secondary" onclick="closeFormModal(true)">Cancelar</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    const existingModal = document.getElementById('formModal');
    if (existingModal) {
        existingModal.remove();
    }

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
    
    console.log('✅ Modal de formulário criado e exibido');
};

// ============================================
// FUNÇÕES DE OBSERVAÇÕES
// ============================================
window.adicionarObservacao = function() {
    const textarea = document.getElementById('novaObservacao');
    const texto = textarea.value.trim();
    
    if (!texto) {
        showToast('Digite uma observação primeiro', 'error');
        return;
    }
    
    const observacoesDataField = document.getElementById('observacoesData');
    let observacoes = JSON.parse(observacoesDataField.value || '[]');
    
    observacoes.push({
        texto: texto,
        timestamp: new Date().toISOString()
    });
    
    observacoesDataField.value = JSON.stringify(observacoes);
    textarea.value = '';
    
    renderObservacoesList(observacoes);
    showToast('Observação adicionada', 'success');
};

window.removerObservacao = function(index) {
    const observacoesDataField = document.getElementById('observacoesData');
    let observacoes = JSON.parse(observacoesDataField.value || '[]');
    
    observacoes.splice(index, 1);
    observacoesDataField.value = JSON.stringify(observacoes);
    
    renderObservacoesList(observacoes);
    showToast('Observação removida', 'info');
};

function renderObservacoesList(observacoes) {
    const container = document.getElementById('observacoesList');
    if (!container) return;
    
    if (observacoes.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic; text-align: center; padding: 2rem;">Nenhuma observação registrada</p>';
        return;
    }
    
    container.innerHTML = observacoes.map((obs, idx) => `
        <div class="observacao-item" data-index="${idx}">
            <div class="observacao-header">
                <span class="observacao-data">${new Date(obs.timestamp).toLocaleString('pt-BR')}</span>
                <button type="button" class="btn-remove-obs" onclick="removerObservacao(${idx})" title="Remover">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>
            <p class="observacao-texto">${obs.texto}</p>
        </div>
    `).join('');
}

// ============================================
// NAVEGAÇÃO DE ABAS
// ============================================
window.switchFormTab = function(tabIndex) {
    const allTabs = document.querySelectorAll('.tab-content');
    const allBtns = document.querySelectorAll('.tab-btn');
    
    allTabs.forEach(tab => tab.classList.remove('active'));
    allBtns.forEach(btn => btn.classList.remove('active'));
    
    allTabs[tabIndex].classList.add('active');
    allBtns[tabIndex].classList.add('active');
};

// ============================================
// FECHAR MODAL
// ============================================
window.closeFormModal = function(askConfirm = false) {
    const modal = document.getElementById('formModal');
    if (!modal) return;
    
    if (askConfirm) {
        const hasData = document.getElementById('numero_nf')?.value.trim() || 
                       document.getElementById('orgao')?.value.trim();
        
        if (hasData) {
            const confirm = window.confirm('Tem certeza? Os dados não salvos serão perdidos.');
            if (!confirm) return;
        }
    }
    
    modal.remove();
};

// ============================================
// SUBMIT DO FORMULÁRIO
// ============================================
window.handleSubmit = async function(event) {
    event.preventDefault();
    
    const editId = document.getElementById('editId').value;
    const isEditing = editId !== '';
    
    const formData = {
        numero_nf: document.getElementById('numero_nf').value.trim(),
        orgao: document.getElementById('orgao').value.trim(),
        vendedor: document.getElementById('vendedor').value,
        banco: document.getElementById('banco').value,
        valor: parseFloat(document.getElementById('valor').value) || 0,
        data_emissao: document.getElementById('data_emissao').value,
        data_vencimento: document.getElementById('data_vencimento').value || null,
        data_pagamento: document.getElementById('data_pagamento').value || null,
        status: document.getElementById('status').value,
        tipo_nf: document.getElementById('tipo_nf').value,
        observacoes: document.getElementById('observacoesData').value
    };
    
    try {
        const url = isEditing ? `${API_URL}/contas/${editId}` : `${API_URL}/contas`;
        const method = isEditing ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            body: JSON.stringify(formData),
            mode: 'cors'
        });
        
        if (!response.ok) throw new Error('Erro ao salvar');
        
        const savedData = await response.json();
        
        if (isEditing) {
            const index = contas.findIndex(c => String(c.id) === editId);
            if (index !== -1) {
                contas[index] = savedData;
            }
            showToast(`NF ${savedData.numero_nf} Atualizado`, 'success');
        } else {
            contas.push(savedData);
            showToast(`NF ${savedData.numero_nf} Criado`, 'success');
        }
        
        updateAllFilters();
        updateDashboard();
        filterContas();
        closeFormModal(false);
        
    } catch (error) {
        console.error('Erro ao salvar:', error);
        showToast('Erro ao salvar conta', 'error');
    }
};

// ============================================
// NAVEGAÇÃO DE MÊS
// ============================================
function updateMonthDisplay() {
    const monthDisplay = document.getElementById('currentMonth');
    if (monthDisplay) {
        monthDisplay.textContent = `${meses[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
}

window.changeMonth = function(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    updateMonthDisplay();
    filterContas();
};

// ============================================
// CALENDÁRIO
// ============================================
function initCalendar() {
    const calendarYear = document.getElementById('calendarYear');
    if (calendarYear) {
        calendarYear.textContent = currentMonth.getFullYear();
    }
    
    renderCalendarMonths();
}

function renderCalendarMonths() {
    const container = document.getElementById('calendarMonths');
    if (!container) return;
    
    const year = currentMonth.getFullYear();
    
    container.innerHTML = meses.map((mes, index) => `
        <button class="calendar-month-btn ${index === currentMonth.getMonth() ? 'active' : ''}" 
                onclick="selectMonth(${index})">
            ${mes}
        </button>
    `).join('');
}

window.selectMonth = function(monthIndex) {
    currentMonth.setMonth(monthIndex);
    updateMonthDisplay();
    renderCalendarMonths();
    toggleCalendar();
    filterContas();
};

window.toggleCalendar = function() {
    const modal = document.getElementById('calendarModal');
    if (modal) {
        modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
    }
};

window.changeCalendarYear = function(direction) {
    currentMonth.setFullYear(currentMonth.getFullYear() + direction);
    document.getElementById('calendarYear').textContent = currentMonth.getFullYear();
    renderCalendarMonths();
};

// Fechar modais ao clicar fora
document.addEventListener('click', function(e) {
    const calendarModal = document.getElementById('calendarModal');
    const vencidosModal = document.getElementById('vencidosModal');
    
    if (e.target === calendarModal) {
        calendarModal.style.display = 'none';
    }
    if (e.target === vencidosModal) {
        vencidosModal.style.display = 'none';
    }
});

// ============================================
// LOG FINAL
// ============================================
console.log('✅ Script completo carregado com sucesso!');
console.log('🔧 Funções exportadas para window:', {
    toggleForm: typeof window.toggleForm,
    showFormModal: typeof window.showFormModal,
    handleEditClick: typeof window.handleEditClick,
    handleSubmit: typeof window.handleSubmit
});
