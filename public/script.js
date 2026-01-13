// ============================================
// CONFIGURAÇÕES
// ============================================
const DEVELOPMENT_MODE = true; // TRUE = Dados simulados | FALSE = API Real
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-mlxw.onrender.com/api'; // API Contas a Receber

let contas = [];
let currentMonth = new Date();
let isOnline = false;
let sessionToken = null;
let lastDataHash = '';
let useMockData = false; // Flag para fallback com dados mock

console.log('🚀 Contas a Receber iniciada');
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
    loadContas();
}

// ============================================
// STATUS DO SERVIDOR
// ============================================
async function checkServerStatus() {
    // No modo desenvolvimento ou mock, simular status online
    if (DEVELOPMENT_MODE || useMockData) {
        updateConnectionStatus(true);
        return;
    }

    try {
        const headers = {
            'Accept': 'application/json'
        };

        if (sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/health`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        if (response.ok) {
            updateConnectionStatus(true);
        } else if (response.status === 401) {
            console.warn('⚠️ Erro de autenticação (401)');
            updateConnectionStatus(false);
        } else {
            console.warn(`⚠️ Erro ao verificar status: ${response.status}`);
            updateConnectionStatus(false);
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error.message);
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(online) {
    isOnline = online;
    const statusEl = document.getElementById('connectionStatus');
    if (statusEl) {
        statusEl.className = `connection-status ${online ? 'online' : 'offline'}`;
    }
}

// ============================================
// NAVEGAÇÃO DE MESES
// ============================================
function updateDisplay() {
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 
        'Maio', 'Junho', 'Julho', 'Agosto', 
        'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const displayEl = document.getElementById('currentMonthDisplay');
    if (displayEl) {
        displayEl.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
    
    loadContas();
}

function previousMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    updateDisplay();
}

function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    updateDisplay();
}

// ============================================
// CARREGAR CONTAS
// ============================================
async function loadContas() {
    try {
        // No modo desenvolvimento, usar dados simulados
        if (DEVELOPMENT_MODE || useMockData) {
            console.log('📦 Usando dados simulados');
            contas = generateMockData();
            renderContas();
            updateDashboard();
            return;
        }

        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        };

        if (sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        console.log('🔄 Carregando contas da API...');
        console.log('📝 Headers:', { ...headers, 'X-Session-Token': sessionToken ? '***' : 'não definido' });

        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers: headers,
            mode: 'cors'
        });

        console.log('📡 Resposta da API:', response.status, response.statusText);

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error('Não autorizado. Token de sessão inválido ou expirado.');
            }
            throw new Error(`Erro ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        contas = Array.isArray(data) ? data : [];
        
        // Mapear campos do Supabase para o formato esperado
        contas = contas.map(conta => ({
            id: conta.id,
            nf: conta.numero_nf || 'N/A',
            orgao: conta.orgao || '',
            vendedor: conta.vendedor || '',
            banco: conta.banco || '',
            dataEmissao: conta.data_emissao,
            dataVencimento: conta.data_vencimento,
            dataPagamento: conta.data_pagamento,
            valor: parseFloat(conta.valor) || 0,
            status: conta.status || 'PENDENTE',
            observacoes: conta.observacoes || ''
        }));

        renderContas();
        updateDashboard();
        console.log('✅ Contas carregadas com sucesso:', contas.length, 'registros');
        
    } catch (error) {
        console.error('❌ Erro ao carregar contas:', error.message);
        showToast(error.message || 'Erro ao carregar contas', 'error');
        
        // Ativar modo mock como fallback
        if (!useMockData && contas.length === 0) {
            console.log('📦 Ativando dados simulados como fallback');
            useMockData = true;
            loadContas(); // Tentar novamente com dados mock
        }
    }
}

// ============================================
// DADOS SIMULADOS (MODO DESENVOLVIMENTO)
// ============================================
function generateMockData() {
    const vendedores = ['JOÃO SILVA', 'MARIA SANTOS', 'PEDRO OLIVEIRA', 'ANA COSTA'];
    const orgaos = ['PREFEITURA MUNICIPAL', 'GOVERNO DO ESTADO', 'CÂMARA MUNICIPAL', 'SECRETARIA DE OBRAS'];
    const bancos = ['BANCO DO BRASIL', 'CAIXA', 'BRADESCO', 'ITAÚ'];
    const status = ['PAGO', 'PENDENTE', 'VENCIDO'];
    
    const mockContas = [];
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    for (let i = 1; i <= 15; i++) {
        const randomStatus = status[Math.floor(Math.random() * status.length)];
        const randomDay = Math.floor(Math.random() * 28) + 1;
        const valor = (Math.random() * 50000 + 5000).toFixed(2);
        
        mockContas.push({
            id: i,
            nf: `NF-${1000 + i}`,
            orgao: orgaos[Math.floor(Math.random() * orgaos.length)],
            vendedor: vendedores[Math.floor(Math.random() * vendedores.length)],
            banco: bancos[Math.floor(Math.random() * bancos.length)],
            dataEmissao: new Date(year, month, randomDay).toISOString(),
            dataVencimento: new Date(year, month, randomDay + 30).toISOString(),
            dataPagamento: randomStatus === 'PAGO' ? new Date(year, month, randomDay + 25).toISOString() : null,
            valor: parseFloat(valor),
            status: randomStatus,
            observacoes: `Observação para NF-${1000 + i}`
        });
    }
    
    return mockContas;
}

// ============================================
// RENDERIZAR CONTAS
// ============================================
function renderContas() {
    const container = document.getElementById('contasContainer');
    if (!container) return;

    const filteredContas = filterContasData();

    if (filteredContas.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 4rem 2rem; color: var(--text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; opacity: 0.3;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <h3 style="margin-bottom: 0.5rem;">Nenhuma conta encontrada</h3>
                <p>Tente ajustar os filtros ou adicione uma nova conta.</p>
            </div>
        `;
        return;
    }

    const html = `
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
                    ${filteredContas.map(conta => `
                        <tr>
                            <td><strong>${conta.nf}</strong></td>
                            <td>${conta.orgao}</td>
                            <td>${conta.vendedor}</td>
                            <td>${conta.banco}</td>
                            <td>${formatDate(conta.dataEmissao)}</td>
                            <td>${formatDate(conta.dataVencimento)}</td>
                            <td><strong>${formatCurrency(conta.valor)}</strong></td>
                            <td>${getStatusBadge(conta.status)}</td>
                            <td class="actions-cell" style="text-align: center;">
                                <button class="action-btn view" onclick="viewConta(${conta.id})" title="Visualizar">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                        <circle cx="12" cy="12" r="3"></circle>
                                    </svg>
                                </button>
                                <button class="action-btn edit" onclick="editConta(${conta.id})" title="Editar">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                    </svg>
                                </button>
                                <button class="action-btn delete" onclick="deleteConta(${conta.id})" title="Excluir">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = html;
    populateFilters();
}

// ============================================
// ATUALIZAR DASHBOARD
// ============================================
function updateDashboard() {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const contasDoMes = contas.filter(c => {
        const date = new Date(c.dataVencimento);
        return date.getFullYear() === year && date.getMonth() === month;
    });

    const totalPago = contasDoMes
        .filter(c => c.status === 'PAGO')
        .reduce((sum, c) => sum + c.valor, 0);

    const totalVencido = contasDoMes
        .filter(c => c.status === 'VENCIDO' || c.status === 'PENDENTE')
        .reduce((sum, c) => sum + c.valor, 0);

    const totalFaturado = contasDoMes
        .reduce((sum, c) => sum + c.valor, 0);

    document.getElementById('statPago').textContent = formatCurrency(totalPago);
    document.getElementById('statVencido').textContent = formatCurrency(totalVencido);
    document.getElementById('statFaturado').textContent = formatCurrency(totalFaturado);

    // Mostrar badge de alerta se houver contas vencidas
    const hasVencidas = contasDoMes.some(c => c.status === 'VENCIDO');
    const badge = document.getElementById('pulseBadgeVencido');
    if (badge) {
        badge.style.display = hasVencidas ? 'flex' : 'none';
    }
}

// ============================================
// FILTROS
// ============================================
function filterContasData() {
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    const vendedor = document.getElementById('filterVendedor')?.value || '';
    const status = document.getElementById('filterStatus')?.value || '';
    const banco = document.getElementById('filterBanco')?.value || '';

    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    return contas.filter(conta => {
        // Filtrar por mês
        const date = new Date(conta.dataVencimento);
        if (date.getFullYear() !== year || date.getMonth() !== month) {
            return false;
        }

        // Filtrar por busca
        if (search && !conta.nf.toLowerCase().includes(search) && 
            !conta.orgao.toLowerCase().includes(search) &&
            !conta.vendedor.toLowerCase().includes(search)) {
            return false;
        }

        // Filtrar por vendedor
        if (vendedor && conta.vendedor !== vendedor) {
            return false;
        }

        // Filtrar por status
        if (status && conta.status !== status) {
            return false;
        }

        // Filtrar por banco
        if (banco && conta.banco !== banco) {
            return false;
        }

        return true;
    });
}

function filterContas() {
    renderContas();
}

function populateFilters() {
    // Popular filtro de vendedores
    const vendedores = [...new Set(contas.map(c => c.vendedor))].sort();
    const vendedorSelect = document.getElementById('filterVendedor');
    if (vendedorSelect) {
        const currentValue = vendedorSelect.value;
        vendedorSelect.innerHTML = '<option value="">Vendedor</option>' +
            vendedores.map(v => `<option value="${v}">${v}</option>`).join('');
        vendedorSelect.value = currentValue;
    }

    // Popular filtro de bancos
    const bancos = [...new Set(contas.map(c => c.banco))].sort();
    const bancoSelect = document.getElementById('filterBanco');
    if (bancoSelect) {
        const currentValue = bancoSelect.value;
        bancoSelect.innerHTML = '<option value="">Banco</option>' +
            bancos.map(b => `<option value="${b}">${b}</option>`).join('');
        bancoSelect.value = currentValue;
    }
}

// ============================================
// AÇÕES DE CONTA
// ============================================
function toggleForm() {
    showToast('Funcionalidade de formulário será implementada', 'info');
}

function viewConta(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;
    
    showToast(`Visualizando: ${conta.nf}`, 'info');
}

function editConta(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;
    
    showToast(`Editando: ${conta.nf}`, 'info');
}

function deleteConta(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;
    
    if (confirm(`Deseja realmente excluir a conta ${conta.nf}?`)) {
        contas = contas.filter(c => c.id !== id);
        renderContas();
        updateDashboard();
        showToast(`Conta ${conta.nf} excluída com sucesso!`, 'success');
    }
}

// ============================================
// UTILITÁRIOS
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function getStatusBadge(status) {
    const badges = {
        'PAGO': '<span class="status-badge status-success">PAGO</span>',
        'PENDENTE': '<span class="status-badge status-warning">PENDENTE</span>',
        'VENCIDO': '<span class="status-badge status-danger">VENCIDO</span>'
    };
    return badges[status] || status;
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

// ============================================
// FUNÇÃO PARA ALTERNAR MODO (DEBUG)
// ============================================
function toggleMockMode() {
    useMockData = !useMockData;
    const mode = useMockData ? 'DADOS SIMULADOS' : 'API REAL';
    console.log(`🔄 Alternando para: ${mode}`);
    showToast(`Modo alterado para: ${mode}`, 'info');
    loadContas();
}

// Expor função globalmente para debug
window.toggleMockMode = toggleMockMode;
