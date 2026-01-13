// ============================================
// CONFIGURAÇÃO
// ============================================
const DEVELOPMENT_MODE = false;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-m1xw.onrender.com/api';

let contas = [];
let contasOffline = [];
let isOnline = false;
let lastDataHash = '';
let sessionToken = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

console.log('Contas a Receber iniciado');

document.addEventListener('DOMContentLoaded', () => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO ATIVADO');
        sessionToken = 'dev-mode';
        inicializarApp();
    } else {
        verificarAutenticacao();
    }
});

// ============================================
// NAVEGAÇÃO POR MESES
// ============================================
function updateDisplay() {
    const display = document.getElementById('currentMonth');
    if (display) {
        display.textContent = `${meses[currentMonth]} ${currentYear}`;
    }
    updateDashboard();
    filterContas();
}

window.changeMonth = function(direction) {
    const newDate = new Date(currentYear, currentMonth + direction, 1);
    currentMonth = newDate.getMonth();
    currentYear = newDate.getFullYear();
    updateDisplay();
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
    
    carregarDadosOffline();
    updateDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
}

// ============================================
// ARMAZENAMENTO OFFLINE (LocalStorage)
// ============================================
function salvarDadosOffline() {
    try {
        localStorage.setItem('contasReceberData', JSON.stringify(contas));
        console.log('💾 Dados salvos offline');
    } catch (error) {
        console.error('Erro ao salvar dados offline:', error);
    }
}

function carregarDadosOffline() {
    try {
        const dados = localStorage.getItem('contasReceberData');
        if (dados) {
            contas = JSON.parse(dados);
            console.log(`💾 ${contas.length} contas carregadas do armazenamento offline`);
            updateAllFilters();
            updateDashboard();
            filterContas();
        }
    } catch (error) {
        console.error('Erro ao carregar dados offline:', error);
    }
}

function salvarContaOffline(conta) {
    try {
        contasOffline = JSON.parse(localStorage.getItem('contasOfflineQueue') || '[]');
        conta._offline = true;
        conta._offlineId = Date.now();
        contasOffline.push(conta);
        localStorage.setItem('contasOfflineQueue', JSON.stringify(contasOffline));
        console.log('💾 Conta salva na fila offline');
    } catch (error) {
        console.error('Erro ao salvar conta offline:', error);
    }
}

async function sincronizarContasOffline() {
    try {
        contasOffline = JSON.parse(localStorage.getItem('contasOfflineQueue') || '[]');
        if (contasOffline.length === 0) return;

        console.log(`🔄 Sincronizando ${contasOffline.length} contas offline...`);

        for (const conta of contasOffline) {
            try {
                const response = await fetch(`${API_URL}/contas`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken
                    },
                    body: JSON.stringify(conta)
                });

                if (response.ok) {
                    contasOffline = contasOffline.filter(c => c._offlineId !== conta._offlineId);
                }
            } catch (error) {
                console.error('Erro ao sincronizar conta:', error);
            }
        }

        localStorage.setItem('contasOfflineQueue', JSON.stringify(contasOffline));
        
        if (contasOffline.length === 0) {
            showToast('Dados sincronizados com sucesso', 'success');
            await loadContas();
        }
    } catch (error) {
        console.error('Erro na sincronização:', error);
    }
}

// ============================================
// CONEXÃO E STATUS
// ============================================
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

        if (!DEVELOPMENT_MODE && response.status === 401) {
            sessionStorage.removeItem('contasReceberSession');
            mostrarTelaAcessoNegado('Sua sessão expirou');
            return false;
        }

        const wasOffline = !isOnline;
        isOnline = response.ok;
        
        if (wasOffline && isOnline) {
            console.log('Servidor ONLINE');
            await sincronizarContasOffline();
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
async function loadContas(showMessage = false) {
    if (!isOnline) {
        if (showMessage) {
            showToast('Sistema offline. Não foi possível sincronizar.', 'error');
        }
        return;
    }

    try {
        const timestamp = new Date().getTime();
        const response = await fetch(`${API_URL}/contas?_t=${timestamp}`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            mode: 'cors'
        });

        if (response.status === 401) {
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
        lastDataHash = JSON.stringify(contas.map(c => c.id));
        
        salvarDadosOffline();
        
        console.log(`[${new Date().toLocaleTimeString()}] ${contas.length} contas carregadas`);
        
        updateAllFilters();
        updateDashboard();
        filterContas();
        
        if (showMessage) {
            showToast('Dados sincronizados', 'success');
        }
        
        verificarContasVencidas();
    } catch (error) {
        console.error('Erro ao carregar contas:', error);
        if (showMessage) {
            showToast('Erro ao sincronizar', 'error');
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
    
    if (isOnline) {
        await sincronizarContasOffline();
    }
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
// DASHBOARD ATUALIZADO
// ============================================
function updateDashboard() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const contasDoMes = contas.filter(c => {
        const dataEmissao = new Date(c.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === currentMonth && 
               dataEmissao.getFullYear() === currentYear;
    });
    
    let totalPago = 0;
    let totalVencido = 0;
    let totalAReceber = 0;
    let totalFaturado = 0;
    let contadorVencido = 0;
    
    contasDoMes.forEach(c => {
        const valor = parseFloat(c.valor) || 0;
        totalFaturado += valor;
        
        if (c.status === 'PAGO') {
            totalPago += valor;
        } else if (c.status === 'A_RECEBER') {
            totalAReceber += valor;
            
            if (c.data_vencimento) {
                const dataVencimento = new Date(c.data_vencimento + 'T00:00:00');
                dataVencimento.setHours(0, 0, 0, 0);
                
                if (dataVencimento < hoje) {
                    totalVencido += valor;
                    contadorVencido++;
                }
            }
        }
    });
    
    const statPago = document.getElementById('statPago');
    const statVencido = document.getElementById('statVencido');
    const statAReceber = document.getElementById('statAReceber');
    const statFaturado = document.getElementById('statFaturado');
    
    if (statPago) statPago.textContent = formatCurrency(totalPago);
    if (statVencido) statVencido.textContent = formatCurrency(totalVencido);
    if (statAReceber) statAReceber.textContent = formatCurrency(totalAReceber);
    if (statFaturado) statFaturado.textContent = formatCurrency(totalFaturado);
    
    const cardVencido = document.getElementById('cardVencido');
    if (cardVencido && contadorVencido > 0) {
        cardVencido.classList.add('pulse-alert');
    } else if (cardVencido) {
        cardVencido.classList.remove('pulse-alert');
    }
}

// ============================================
// FILTROS
// ============================================
function updateAllFilters() {
    const vendedores = new Set();
    const bancos = new Set();
    const status = new Set(['A_RECEBER', 'PAGO', 'VENCIDO']);
    
    contas.forEach(c => {
        if (c.vendedor && c.vendedor !== 'NÃO INFORMADO') vendedores.add(c.vendedor);
        if (c.banco && c.banco !== 'NÃO INFORMADO') bancos.add(c.banco);
    });
    
    updateFilterSelect('filterVendedor', Array.from(vendedores).sort(), 'Todos Vendedores');
    updateFilterSelect('filterBanco', Array.from(bancos).sort(), 'Todos Bancos');
    updateFilterSelect('filterStatus', Array.from(status).map(s => ({ 
        value: s, 
        label: s === 'A_RECEBER' ? 'A Receber' : s === 'PAGO' ? 'Pago' : 'Vencido'
    })), 'Todos os Status');
}

function updateFilterSelect(id, options, placeholder) {
    const select = document.getElementById(id);
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = `<option value="">${placeholder}</option>`;
    
    if (Array.isArray(options) && options.length > 0) {
        options.forEach(opt => {
            const value = typeof opt === 'object' ? opt.value : opt;
            const label = typeof opt === 'object' ? opt.label : opt;
            select.innerHTML += `<option value="${value}" ${value === currentValue ? 'selected' : ''}>${label}</option>`;
        });
    }
}

window.filterContas = function() {
    const search = document.getElementById('search')?.value.toLowerCase() || '';
    const filterVendedor = document.getElementById('filterVendedor')?.value || '';
    const filterBanco = document.getElementById('filterBanco')?.value || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const filtered = contas.filter(c => {
        const dataEmissao = new Date(c.data_emissao + 'T00:00:00');
        const noMes = dataEmissao.getMonth() === currentMonth && 
                      dataEmissao.getFullYear() === currentYear;
        
        if (!noMes) return false;
        
        const matchSearch = !search || 
            (c.numero_nf && c.numero_nf.toLowerCase().includes(search)) ||
            (c.orgao && c.orgao.toLowerCase().includes(search)) ||
            (c.vendedor && c.vendedor.toLowerCase().includes(search));
        
        const matchVendedor = !filterVendedor || c.vendedor === filterVendedor;
        const matchBanco = !filterBanco || c.banco === filterBanco;
        
        let matchStatus = true;
        if (filterStatus) {
            if (filterStatus === 'VENCIDO') {
                if (c.status === 'A_RECEBER' && c.data_vencimento) {
                    const dataVencimento = new Date(c.data_vencimento + 'T00:00:00');
                    dataVencimento.setHours(0, 0, 0, 0);
                    matchStatus = dataVencimento < hoje;
                } else {
                    matchStatus = false;
                }
            } else {
                matchStatus = c.status === filterStatus;
            }
        }
        
        return matchSearch && matchVendedor && matchBanco && matchStatus;
    });
    
    renderContas(filtered);
};

// ============================================
// RENDERIZAÇÃO DA TABELA
// ============================================
function renderContas(contasList) {
    const container = document.getElementById('contasContainer');
    if (!container) return;
    
    if (!contasList || contasList.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--text-secondary);">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" style="opacity: 0.3; margin-bottom: 1rem;">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p style="font-size: 1.1rem; font-weight: 600; margin: 0;">Nenhuma conta encontrada</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">Registre uma nova conta para começar</p>
            </div>
        `;
        return;
    }
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const table = `
        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th>Nº NF</th>
                        <th>Data Emissão</th>
                        <th>Órgão</th>
                        <th>Vendedor</th>
                        <th>Banco</th>
                        <th>Valor</th>
                        <th>Status</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${contasList.map(c => {
                        let status = c.status || 'A_RECEBER';
                        let badgeClass = 'badge';
                        let badgeText = '';
                        
                        if (status === 'PAGO') {
                            badgeClass += ' entregue';
                            badgeText = 'Pago';
                        } else if (status === 'A_RECEBER') {
                            if (c.data_vencimento) {
                                const dataVencimento = new Date(c.data_vencimento + 'T00:00:00');
                                dataVencimento.setHours(0, 0, 0, 0);
                                
                                if (dataVencimento < hoje) {
                                    badgeClass += ' devolvido';
                                    badgeText = 'Vencido';
                                } else {
                                    badgeClass += ' transito';
                                    badgeText = 'A Receber';
                                }
                            } else {
                                badgeClass += ' transito';
                                badgeText = 'A Receber';
                            }
                        }
                        
                        const isPago = c.status === 'PAGO';
                        
                        return `
                        <tr class="${isPago ? 'row-entregue' : ''}">
                            <td><strong>${c.numero_nf || '-'}</strong></td>
                            <td style="white-space: nowrap;">${formatDate(c.data_emissao)}</td>
                            <td style="max-width: 200px; word-wrap: break-word; white-space: normal;">${c.orgao || '-'}</td>
                            <td>${c.vendedor || '-'}</td>
                            <td>${c.banco || '-'}</td>
                            <td><strong>R$ ${c.valor ? parseFloat(c.valor).toFixed(2) : '0,00'}</strong></td>
                            <td><span class="${badgeClass}">${badgeText}</span></td>
                            <td class="actions-cell" style="text-align: center; white-space: nowrap;">
                                <button onclick="viewConta('${c.id}')" class="action-btn view" title="Ver detalhes">Ver</button>
                                <button onclick="editConta('${c.id}')" class="action-btn edit" title="Editar">Editar</button>
                                <button onclick="deleteConta('${c.id}')" class="action-btn delete" title="Excluir">Excluir</button>
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
// UTILIDADES
// ============================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function formatCurrency(value) {
    return 'R$ ' + value.toLocaleString('pt-BR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
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
// MODAL DE CONTAS VENCIDAS
// ============================================
function verificarContasVencidas() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencidas = contas.filter(c => {
        if (c.status !== 'A_RECEBER') return false;
        if (!c.data_vencimento) return false;
        
        const dataVencimento = new Date(c.data_vencimento + 'T00:00:00');
        dataVencimento.setHours(0, 0, 0, 0);
        
        return dataVencimento < hoje;
    });
    
    if (vencidas.length === 0) return;
    
    const alertShown = sessionStorage.getItem('vencidoAlertShown');
    if (!alertShown) {
        setTimeout(() => {
            showVencidoModal();
            sessionStorage.setItem('vencidoAlertShown', 'true');
        }, 1000);
    }
}

window.showVencidoModal = function() {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencidas = contas.filter(c => {
        if (c.status !== 'A_RECEBER') return false;
        if (!c.data_vencimento) return false;
        
        const dataVencimento = new Date(c.data_vencimento + 'T00:00:00');
        dataVencimento.setHours(0, 0, 0, 0);
        
        return dataVencimento < hoje;
    });
    
    vencidas.sort((a, b) => {
        const dataA = new Date(a.data_vencimento);
        const dataB = new Date(b.data_vencimento);
        return dataA - dataB;
    });
    
    const modalBody = document.getElementById('vencidoModalBody');
    if (!modalBody) return;
    
    if (vencidas.length === 0) {
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
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${vencidas.map(c => {
                            return `
                            <tr>
                                <td><strong>${c.numero_nf || '-'}</strong></td>
                                <td style="white-space: nowrap;">${formatDate(c.data_emissao)}</td>
                                <td>${c.orgao || '-'}</td>
                                <td style="white-space: nowrap; color: #EF4444; font-weight: 600;">R$ ${parseFloat(c.valor || 0).toFixed(2)}</td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }
    
    const modal = document.getElementById('vencidoModal');
    if (modal) {
        modal.style.display = 'flex';
    }
};

window.closeVencidoModal = function() {
    const modal = document.getElementById('vencidoModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// ============================================
// FUNÇÕES CRUD (placeholder - implementação completa segue)
// ============================================
window.toggleForm = function() {
    showToast('Funcionalidade em desenvolvimento', 'success');
};

window.viewConta = function(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;
    showToast(`Visualizando NF ${conta.numero_nf}`, 'success');
};

window.editConta = function(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;
    showToast(`Editando NF ${conta.numero_nf}`, 'success');
};

window.deleteConta = async function(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;
    
    const confirmed = confirm(`Deseja realmente excluir a NF ${conta.numero_nf}?`);
    if (!confirmed) return;
    
    if (isOnline) {
        try {
            const response = await fetch(`${API_URL}/contas/${id}`, {
                method: 'DELETE',
                headers: {
                    'X-Session-Token': sessionToken
                }
            });
            
            if (response.ok) {
                showToast(`NF ${conta.numero_nf} excluída`, 'success');
                await loadContas();
            } else {
                showToast('Erro ao excluir conta', 'error');
            }
        } catch (error) {
            console.error('Erro ao excluir:', error);
            showToast('Erro ao excluir conta', 'error');
        }
    } else {
        showToast('Rede indisponível no momento. Dados salvos localmente.', 'error');
    }
};

// Limpar flag de alerta ao fechar a página
window.addEventListener('beforeunload', () => {
    sessionStorage.removeItem('vencidoAlertShown');
});
