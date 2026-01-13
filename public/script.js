const DEVELOPMENT_MODE = true;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'
    : '/api'; // Usa caminho relativo em produção

let contas = [];
let currentMonth = new Date();
let editingId = null;
let currentTab = 0;
let currentInfoTab = 0;
let isOnline = false;
let sessionToken = null;
let lastDataHash = '';

const tabs = ['tab-geral', 'tab-pagamento'];
const infoTabs = ['info-tab-geral', 'info-tab-pagamento'];

console.log('🚀 Contas a Receber iniciada');
console.log('📍 API URL:', API_URL);
console.log('🔧 Modo desenvolvimento:', DEVELOPMENT_MODE);

function toUpperCase(value) {
    return value ? String(value).toUpperCase() : '';
}

// Converter input para maiúsculo automaticamente
function setupUpperCaseInputs() {
    const textInputs = document.querySelectorAll('input[type="text"]:not([readonly]), textarea');
    textInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;
            this.value = toUpperCase(this.value);
            this.setSelectionRange(start, end);
        });
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO ATIVADO');
        sessionToken = 'dev-mode';
        inicializarApp();
    } else {
        verificarAutenticacao();
    }
});

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
    updateDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
    setupUpperCaseInputs();
}

async function checkServerStatus() {
    try {
        const headers = {
            'Accept': 'application/json'
        };

        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (response.ok) {
            setOnlineStatus(true);
            const data = await response.json();
            updateLocalData(data);
        } else {
            setOnlineStatus(false);
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        setOnlineStatus(false);
    }
}

function setOnlineStatus(status) {
    isOnline = status;
    const statusElement = document.getElementById('connectionStatus');
    if (statusElement) {
        statusElement.className = status ? 'connection-status online' : 'connection-status offline';
    }
}

function updateLocalData(newData) {
    const newHash = JSON.stringify(newData);
    if (newHash !== lastDataHash) {
        contas = newData;
        lastDataHash = newHash;
        updateDisplay();
    }
}

function startPolling() {
    setInterval(async () => {
        if (isOnline) {
            await checkServerStatus();
        }
    }, 10000);
}

// ============================================
// DISPLAY E FILTROS
// ============================================

function updateDisplay() {
    updateMonthDisplay();
    updateDashboard();
    populateFilters();
    filterContas();
}

function updateMonthDisplay() {
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const monthDisplay = document.getElementById('currentMonth');
    if (monthDisplay) {
        monthDisplay.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
}

function changeMonth(direction) {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + direction, 1);
    updateDisplay();
}

function updateDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filtrar contas do mês atual
    const contasMes = contas.filter(c => {
        const dataEmissao = new Date(c.data_emissao);
        return dataEmissao.getMonth() === currentMonth.getMonth() &&
               dataEmissao.getFullYear() === currentMonth.getFullYear();
    });

    // Calcular valores do mês
    const totalPago = contasMes
        .filter(c => c.status === 'PAGO')
        .reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);

    const totalAReceber = contasMes
        .filter(c => c.status === 'A_RECEBER')
        .reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);

    const totalFaturado = contasMes
        .reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);

    // Calcular vencidos (universal - todas as contas)
    const contasVencidas = contas.filter(c => {
        if (c.status === 'PAGO' || !c.data_vencimento) return false;
        const dataVenc = new Date(c.data_vencimento);
        dataVenc.setHours(0, 0, 0, 0);
        return dataVenc < today;
    });

    const totalVencido = contasVencidas.reduce((sum, c) => sum + parseFloat(c.valor || 0), 0);

    // Atualizar elementos
    document.getElementById('statPago').textContent = formatCurrency(totalPago);
    document.getElementById('statVencido').textContent = formatCurrency(totalVencido);
    document.getElementById('statAReceber').textContent = formatCurrency(totalAReceber);
    document.getElementById('statFaturado').textContent = formatCurrency(totalFaturado);

    // Mostrar/ocultar badge de alerta no card vencido
    const pulseBadge = document.getElementById('pulseBadgeVencido');
    const cardVencido = document.getElementById('cardVencido');
    
    if (contasVencidas.length > 0) {
        if (pulseBadge) {
            pulseBadge.style.display = 'flex';
            pulseBadge.textContent = contasVencidas.length;
        }
        if (cardVencido) {
            cardVencido.style.cursor = 'pointer';
            cardVencido.onclick = () => showVencidosModal();
        }
    } else {
        if (pulseBadge) pulseBadge.style.display = 'none';
        if (cardVencido) {
            cardVencido.style.cursor = 'default';
            cardVencido.onclick = null;
        }
    }
}

function populateFilters() {
    const vendedores = [...new Set(contas.map(c => c.vendedor))].filter(Boolean).sort();
    const bancos = [...new Set(contas.map(c => c.banco))].filter(Boolean).sort();

    const filterVendedor = document.getElementById('filterVendedor');
    const filterBanco = document.getElementById('filterBanco');

    if (filterVendedor) {
        const currentValue = filterVendedor.value;
        filterVendedor.innerHTML = '<option value="">Vendedor</option>' +
            vendedores.map(v => `<option value="${v}">${v}</option>`).join('');
        filterVendedor.value = currentValue;
    }

    if (filterBanco) {
        const currentValue = filterBanco.value;
        filterBanco.innerHTML = '<option value="">Banco</option>' +
            bancos.map(b => `<option value="${b}">${b}</option>`).join('');
        filterBanco.value = currentValue;
    }
}

function filterContas() {
    const searchTerm = document.getElementById('search')?.value.toUpperCase() || '';
    const vendedorFilter = document.getElementById('filterVendedor')?.value || '';
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    const bancoFilter = document.getElementById('filterBanco')?.value || '';

    // Filtrar contas do mês atual
    const contasFiltradas = contas.filter(conta => {
        const dataEmissao = new Date(conta.data_emissao);
        const mesMatch = dataEmissao.getMonth() === currentMonth.getMonth() &&
                        dataEmissao.getFullYear() === currentMonth.getFullYear();

        if (!mesMatch) return false;

        const searchMatch = !searchTerm ||
            conta.numero_nf?.toUpperCase().includes(searchTerm) ||
            conta.orgao?.toUpperCase().includes(searchTerm) ||
            conta.vendedor?.toUpperCase().includes(searchTerm);

        const vendedorMatch = !vendedorFilter || conta.vendedor === vendedorFilter;
        const statusMatch = !statusFilter || conta.status === statusFilter;
        const bancoMatch = !bancoFilter || conta.banco === bancoFilter;

        return searchMatch && vendedorMatch && statusMatch && bancoMatch;
    });

    renderContas(contasFiltradas);
}

function renderContas(contasList) {
    const container = document.getElementById('contasContainer');
    if (!container) return;

    if (contasList.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 1rem; opacity: 0.3;">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>Nenhuma conta encontrada neste mês</p>
                </td>
            </tr>
        `;
        return;
    }

    container.innerHTML = contasList.map(conta => {
        const statusClass = conta.status === 'PAGO' ? 'status-success' : 'status-warning';
        const statusText = conta.status === 'PAGO' ? 'PAGO' : 'A RECEBER';
        
        return `
            <tr>
                <td><strong>${conta.numero_nf}</strong></td>
                <td>${conta.orgao}</td>
                <td>${conta.vendedor}</td>
                <td>${conta.banco || '-'}</td>
                <td>${formatDate(conta.data_emissao)}</td>
                <td><strong>${formatCurrency(conta.valor)}</strong></td>
                <td><span class="status-badge ${statusClass}">${statusText}</span></td>
                <td style="text-align: center;">
                    <div class="action-buttons">
                        <button onclick="viewConta('${conta.id}')" class="btn-action btn-view" title="Ver">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <button onclick="editConta('${conta.id}')" class="btn-action btn-edit" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button onclick="confirmDelete('${conta.id}')" class="btn-action btn-delete" title="Excluir">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ============================================
// MODAL DE FORMULÁRIO
// ============================================

function openFormModal() {
    editingId = null;
    currentTab = 0;
    
    document.getElementById('formModalTitle').textContent = 'Nova Conta a Receber';
    
    // Limpar formulário
    document.getElementById('numeroNF').value = '';
    document.getElementById('orgao').value = '';
    document.getElementById('vendedor').value = '';
    document.getElementById('banco').value = '';
    document.getElementById('dataEmissao').value = '';
    document.getElementById('dataVencimento').value = '';
    document.getElementById('valor').value = '';
    document.getElementById('tipoNF').value = 'ENVIO';
    document.getElementById('observacoes').value = '';
    document.getElementById('dataPagamento').value = '';
    document.getElementById('status').value = 'A_RECEBER';
    
    switchTab('tab-geral');
    document.getElementById('formModal').classList.add('show');
    setupUpperCaseInputs();
}

function closeFormModal() {
    const confirmed = confirm('Atualização cancelada');
    if (confirmed) {
        document.getElementById('formModal').classList.remove('show');
        showToast('Atualização cancelada', 'error');
    }
}

function switchTab(tabId) {
    tabs.forEach((tab, index) => {
        const tabElement = document.getElementById(tab);
        const btnElement = document.querySelector(`.tabs-nav .tab-btn:nth-child(${index + 1})`);
        
        if (tab === tabId) {
            tabElement.classList.add('active');
            btnElement.classList.add('active');
            currentTab = index;
        } else {
            tabElement.classList.remove('active');
            btnElement.classList.remove('active');
        }
    });
    
    updateModalButtons();
}

function nextTab() {
    if (currentTab < tabs.length - 1) {
        switchTab(tabs[currentTab + 1]);
    }
}

function previousTab() {
    if (currentTab > 0) {
        switchTab(tabs[currentTab - 1]);
    }
}

function updateModalButtons() {
    const btnPrevious = document.getElementById('btnPrevious');
    const btnNext = document.getElementById('btnNext');
    const btnSave = document.getElementById('btnSave');
    
    if (currentTab === 0) {
        btnPrevious.style.display = 'none';
        btnNext.style.display = 'inline-block';
        btnSave.style.display = 'none';
    } else if (currentTab === tabs.length - 1) {
        btnPrevious.style.display = 'inline-block';
        btnNext.style.display = 'none';
        btnSave.style.display = 'inline-block';
    } else {
        btnPrevious.style.display = 'inline-block';
        btnNext.style.display = 'inline-block';
        btnSave.style.display = 'none';
    }
}

async function saveConta() {
    const numeroNF = document.getElementById('numeroNF').value.trim();
    const orgao = document.getElementById('orgao').value.trim();
    const vendedor = document.getElementById('vendedor').value.trim();
    const dataEmissao = document.getElementById('dataEmissao').value;

    if (!numeroNF || !orgao || !vendedor || !dataEmissao) {
        alert('Preencha todos os campos obrigatórios: NF, Órgão, Vendedor e Data Emissão');
        return;
    }

    const valorInput = document.getElementById('valor').value.replace(/[^\d,]/g, '').replace(',', '.');
    const valor = parseFloat(valorInput) || 0;

    const contaData = {
        numero_nf: numeroNF,
        orgao: orgao,
        vendedor: vendedor,
        banco: document.getElementById('banco').value.trim() || null,
        valor: valor,
        data_emissao: dataEmissao,
        data_vencimento: document.getElementById('dataVencimento').value || null,
        data_pagamento: document.getElementById('dataPagamento').value || null,
        status: document.getElementById('status').value,
        tipo_nf: document.getElementById('tipoNF').value,
        observacoes: document.getElementById('observacoes').value.trim() || null
    };

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const url = editingId ? `${API_URL}/contas/${editingId}` : `${API_URL}/contas`;
        const method = editingId ? 'PUT' : 'POST';

        const response = await fetch(url, {
            method: method,
            headers: headers,
            body: JSON.stringify(contaData),
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const savedConta = await response.json();

        if (editingId) {
            const index = contas.findIndex(c => c.id === editingId);
            if (index !== -1) {
                contas[index] = savedConta;
            }
            showToast(`NF ${numeroNF} atualizada`, 'success');
        } else {
            contas.unshift(savedConta);
            showToast(`NF ${numeroNF} registrada`, 'success');
        }

        lastDataHash = JSON.stringify(contas);
        updateDisplay();
        document.getElementById('formModal').classList.remove('show');
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        alert('Erro ao salvar conta. Tente novamente.');
    }
}

async function editConta(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;

    editingId = id;
    currentTab = 0;

    document.getElementById('formModalTitle').textContent = 'Editar Conta a Receber';
    
    document.getElementById('numeroNF').value = conta.numero_nf;
    document.getElementById('orgao').value = conta.orgao;
    document.getElementById('vendedor').value = conta.vendedor;
    document.getElementById('banco').value = conta.banco || '';
    document.getElementById('dataEmissao').value = conta.data_emissao;
    document.getElementById('dataVencimento').value = conta.data_vencimento || '';
    document.getElementById('valor').value = formatCurrency(conta.valor).replace('R$ ', '');
    document.getElementById('tipoNF').value = conta.tipo_nf || 'ENVIO';
    document.getElementById('observacoes').value = conta.observacoes || '';
    document.getElementById('dataPagamento').value = conta.data_pagamento || '';
    document.getElementById('status').value = conta.status || 'A_RECEBER';

    switchTab('tab-geral');
    document.getElementById('formModal').classList.add('show');
    setupUpperCaseInputs();
}

function confirmDelete(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;

    if (confirm(`Deseja excluir a NF ${conta.numero_nf}?`)) {
        deleteConta(id, conta.numero_nf);
    }
}

async function deleteConta(id, numeroNF) {
    try {
        const headers = {
            'Accept': 'application/json'
        };

        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/contas/${id}`, {
            method: 'DELETE',
            headers: headers,
            mode: 'cors'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        contas = contas.filter(c => c.id !== id);
        lastDataHash = JSON.stringify(contas);
        updateDisplay();
        showToast(`NF ${numeroNF} excluída`, 'error');
    } catch (error) {
        console.error('❌ Erro ao excluir:', error);
        alert('Erro ao excluir conta. Tente novamente.');
    }
}

// ============================================
// MODAL DE VISUALIZAÇÃO
// ============================================

function viewConta(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;

    currentInfoTab = 0;

    document.getElementById('modalNumero').textContent = conta.numero_nf;

    // Tab Geral
    document.getElementById('info-tab-geral').innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <label>Número NF</label>
                <span>${conta.numero_nf}</span>
            </div>
            <div class="info-item">
                <label>Órgão</label>
                <span>${conta.orgao}</span>
            </div>
            <div class="info-item">
                <label>Vendedor</label>
                <span>${conta.vendedor}</span>
            </div>
            <div class="info-item">
                <label>Banco</label>
                <span>${conta.banco || '-'}</span>
            </div>
            <div class="info-item">
                <label>Data Emissão</label>
                <span>${formatDate(conta.data_emissao)}</span>
            </div>
            <div class="info-item">
                <label>Data Vencimento</label>
                <span>${conta.data_vencimento ? formatDate(conta.data_vencimento) : '-'}</span>
            </div>
            <div class="info-item">
                <label>Valor</label>
                <span><strong>${formatCurrency(conta.valor)}</strong></span>
            </div>
            <div class="info-item">
                <label>Tipo NF</label>
                <span>${conta.tipo_nf || 'ENVIO'}</span>
            </div>
            ${conta.observacoes ? `
            <div class="info-item" style="grid-column: 1 / -1;">
                <label>Observações</label>
                <span>${conta.observacoes}</span>
            </div>
            ` : ''}
        </div>
    `;

    // Tab Pagamento
    document.getElementById('info-tab-pagamento').innerHTML = `
        <div class="info-grid">
            <div class="info-item">
                <label>Data Pagamento</label>
                <span>${conta.data_pagamento ? formatDate(conta.data_pagamento) : '-'}</span>
            </div>
            <div class="info-item">
                <label>Status</label>
                <span class="status-badge ${conta.status === 'PAGO' ? 'status-success' : 'status-warning'}">
                    ${conta.status === 'PAGO' ? 'PAGO' : 'A RECEBER'}
                </span>
            </div>
        </div>
    `;

    switchInfoTab('info-tab-geral');
    document.getElementById('infoModal').classList.add('show');
}

function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('show');
}

function switchInfoTab(tabId) {
    infoTabs.forEach((tab, index) => {
        const tabElement = document.getElementById(tab);
        const btnElement = document.querySelector(`#infoModal .tabs-nav .tab-btn:nth-child(${index + 1})`);
        
        if (tab === tabId) {
            tabElement.classList.add('active');
            btnElement.classList.add('active');
            currentInfoTab = index;
        } else {
            tabElement.classList.remove('active');
            btnElement.classList.remove('active');
        }
    });
    
    updateInfoModalButtons();
}

function nextInfoTab() {
    if (currentInfoTab < infoTabs.length - 1) {
        switchInfoTab(infoTabs[currentInfoTab + 1]);
    }
}

function previousInfoTab() {
    if (currentInfoTab > 0) {
        switchInfoTab(infoTabs[currentInfoTab - 1]);
    }
}

function updateInfoModalButtons() {
    const btnPrevious = document.getElementById('btnInfoPrevious');
    const btnNext = document.getElementById('btnInfoNext');
    const btnClose = document.getElementById('btnInfoClose');
    
    if (currentInfoTab === 0) {
        btnPrevious.style.display = 'none';
        btnNext.style.display = 'inline-block';
    } else if (currentInfoTab === infoTabs.length - 1) {
        btnPrevious.style.display = 'inline-block';
        btnNext.style.display = 'none';
    } else {
        btnPrevious.style.display = 'inline-block';
        btnNext.style.display = 'inline-block';
    }
}

// ============================================
// MODAL DE VENCIDOS
// ============================================

function showVencidosModal() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const contasVencidas = contas.filter(c => {
        if (c.status === 'PAGO' || !c.data_vencimento) return false;
        const dataVenc = new Date(c.data_vencimento);
        dataVenc.setHours(0, 0, 0, 0);
        return dataVenc < today;
    });

    const container = document.getElementById('vencidosContainer');
    
    if (contasVencidas.length === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    Nenhuma conta vencida
                </td>
            </tr>
        `;
    } else {
        container.innerHTML = contasVencidas.map(conta => `
            <tr>
                <td><strong>${conta.numero_nf}</strong></td>
                <td>${conta.orgao}</td>
                <td>${formatDate(conta.data_emissao)}</td>
                <td style="color: var(--alert-color);"><strong>${formatDate(conta.data_vencimento)}</strong></td>
                <td><strong>${formatCurrency(conta.valor)}</strong></td>
                <td style="text-align: center;">
                    <div class="action-buttons">
                        <button onclick="viewConta('${conta.id}')" class="btn-action btn-view" title="Ver">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                        <button onclick="editConta('${conta.id}')" class="btn-action btn-edit" title="Editar">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('vencidosModal').classList.add('show');
}

function closeVencidosModal() {
    document.getElementById('vencidosModal').classList.remove('show');
}

// ============================================
// SINCRONIZAÇÃO
// ============================================

async function syncData() {
    showToast('Sincronizando...', 'info');
    await checkServerStatus();
    showToast('Dados sincronizados', 'success');
}

// ============================================
// UTILIDADES
// ============================================

function formatCurrency(value) {
    const num = parseFloat(value) || 0;
    return `R$ ${num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function showToast(message, type = 'success') {
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

// Fechar modais ao clicar fora
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('show');
    }
});
