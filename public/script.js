// ============================================
// CONFIGURAÇÃO
// ============================================
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-kkf9.onrender.com/api';
const FRETE_API_URL = 'https://controle-frete.onrender.com/api';';

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

console.log('Contas a Receber iniciada');

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        document.getElementById('splashScreen').style.display = 'none';
        document.querySelector('.app-content').style.display = 'block';
    }, 1500);
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
    updateMonthDisplay();
    checkServerStatus();
    setInterval(checkServerStatus, 15000);
    startPolling();
    sincronizarNotasEntregues();
    setInterval(sincronizarNotasEntregues, 30000);
}

// ============================================
// SINCRONIZAÇÃO CORRIGIDA - CONTAS A RECEBER
// ============================================

async function sincronizarNotasEntregues() {
    if (!isOnline) return;

    console.log('🔄 Iniciando sincronização...');

    try {
        const response = await fetch(`${FRETE_API_URL}/fretes`, {
            method: 'GET',
            headers: { 
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            mode: 'cors'
        });

        if (!response.ok) {
            console.log('⚠️ Erro ao buscar fretes:', response.status);
            return;
        }

        const fretes = await response.json();
        console.log(`📦 ${fretes.length} fretes encontrados`);
        
        // Buscar fretes com status ENTREGUE OU campo entregue=true
        const notasEntregues = fretes.filter(f => {
            return f.status === 'ENTREGUE' || f.entregue === true;
        });

        console.log(`✅ ${notasEntregues.length} fretes entregues encontrados`);

        for (const frete of notasEntregues) {
            console.log(`📋 Verificando frete NF: ${frete.numero_nf}`);
            
            const jaExiste = contas.find(c => c.numero_nf === frete.numero_nf);
            
            if (!jaExiste) {
                console.log(`➕ Criando conta para NF: ${frete.numero_nf}`);
                
                const novaConta = {
                    numero_nf: frete.numero_nf,
                    valor_nota: frete.valor_nf, // ✅ CORRIGIDO: valor_nf (não valor_nota)
                    orgao: frete.orgao || frete.nome_orgao, // ✅ Tentar ambos os campos
                    vendedor: frete.vendedor_responsavel || frete.vendedor, // ✅ Tentar ambos os campos
                    data_emissao: frete.data_emissao,
                    valor_pago: 0,
                    data_pagamento: null,
                    banco: null,
                    status: 'PENDENTE',
                    dados_frete: {
                        transportadora: frete.transportadora,
                        rastreio: frete.rastreio || frete.numero_nf, // Usar NF como rastreio se não tiver
                        data_entrega: frete.data_entrega_realizada || frete.previsao_entrega
                    }
                };

                console.log('📤 Dados a enviar:', novaConta);

                await criarContaAutomatica(novaConta);
            } else {
                console.log(`⏭️ Conta já existe para NF: ${frete.numero_nf}`);
            }
        }

    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
    }
}

async function criarContaAutomatica(contaData) {
    try {
        const response = await fetch(`${API_URL}/contas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            body: JSON.stringify(contaData),
            mode: 'cors'
        });

        if (response.ok) {
            const novaConta = await response.json();
            contas.push(novaConta);
            console.log(`✅ Nota ${contaData.numero_nf} importada automaticamente`);
            updateAllFilters();
            updateDashboard();
            filterContas();
            
            // Mostrar notificação visual
            showMessage(`Nota ${contaData.numero_nf} importada automaticamente!`, 'success');
        } else {
            const errorData = await response.json();
            console.error('❌ Erro ao criar conta:', errorData);
        }
    } catch (error) {
        console.error('❌ Erro ao criar conta automática:', error);
    }
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
            console.log('Servidor ONLINE');
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
        contas = data;
        
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

function startPolling() {
    loadContas();
    setInterval(() => {
        if (isOnline) loadContas();
    }, 10000);
}

// ============================================
// DASHBOARD
// ============================================
function updateDashboard() {
    const contasDoMes = contas.filter(c => {
        const dataEmissao = new Date(c.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === currentMonth && dataEmissao.getFullYear() === currentYear;
    });
    
    const faturado = contasDoMes.reduce((sum, c) => sum + parseFloat(c.valor_nota || 0), 0);
    const pago = contasDoMes.reduce((sum, c) => sum + parseFloat(c.valor_pago || 0), 0);
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const vencido = contasDoMes.filter(c => {
        if (c.status === 'PAGO') return false;
        const dataEmissao = new Date(c.data_emissao + 'T00:00:00');
        const prazo30 = new Date(dataEmissao);
        prazo30.setDate(prazo30.getDate() + 30);
        return prazo30 < hoje;
    }).reduce((sum, c) => sum + (parseFloat(c.valor_nota || 0) - parseFloat(c.valor_pago || 0)), 0);
    
    const pendente = contasDoMes.filter(c => c.status !== 'PAGO')
        .reduce((sum, c) => sum + (parseFloat(c.valor_nota || 0) - parseFloat(c.valor_pago || 0)), 0);
    
    document.getElementById('statFaturado').textContent = `R$ ${faturado.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('statPago').textContent = `R$ ${pago.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('statVencido').textContent = `R$ ${vencido.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    document.getElementById('statPendente').textContent = `R$ ${pendente.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    
    const cardVencido = document.getElementById('cardVencido');
    const badgeVencido = document.getElementById('pulseBadgeVencido');
    
    if (vencido > 0) {
        cardVencido.classList.add('has-alert');
        badgeVencido.style.display = 'flex';
        badgeVencido.textContent = '!';
    } else {
        cardVencido.classList.remove('has-alert');
        badgeVencido.style.display = 'none';
    }
    
    const cardPendente = document.getElementById('cardPendente');
    const badgePendente = document.getElementById('pulseBadgePendente');
    
    if (pendente > 0) {
        cardPendente.classList.add('has-warning');
        badgePendente.style.display = 'flex';
        badgePendente.textContent = '!';
    } else {
        cardPendente.classList.remove('has-warning');
        badgePendente.style.display = 'none';
    }
}

// ============================================
// MODAL DE CONFIRMAÇÃO
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
// MODAL DE PAGAMENTO
// ============================================
function showPagamentoModal(conta) {
    const valorRestante = parseFloat(conta.valor_nota) - parseFloat(conta.valor_pago || 0);
    
    const modalHTML = `
        <div class="modal-overlay" id="pagamentoModal">
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3 class="modal-title">Registrar Pagamento</h3>
                </div>
                
                <div class="info-section" style="margin-bottom: 1.5rem;">
                    <p><strong>NF:</strong> ${conta.numero_nf}</p>
                    <p><strong>Órgão:</strong> ${conta.orgao}</p>
                    <p><strong>Valor da Nota:</strong> R$ ${parseFloat(conta.valor_nota).toFixed(2)}</p>
                    <p><strong>Já Pago:</strong> R$ ${parseFloat(conta.valor_pago || 0).toFixed(2)}</p>
                    <p><strong>Restante:</strong> <span style="color: var(--danger-color); font-weight: bold;">R$ ${valorRestante.toFixed(2)}</span></p>
                </div>

                <form id="pagamentoForm" onsubmit="handlePagamento(event, '${conta.id}')">
                    <div class="form-grid">
                        <div class="form-group">
                            <label for="valor_pagamento">Valor Pago (R$) *</label>
                            <input type="number" id="valor_pagamento" step="0.01" min="0.01" max="${valorRestante}" value="${valorRestante}" required>
                        </div>
                        <div class="form-group">
                            <label for="banco_pagamento">Banco *</label>
                            <select id="banco_pagamento" required>
                                <option value="">Selecione...</option>
                                <option value="BANCO DO BRASIL">Banco do Brasil</option>
                                <option value="CAIXA">Caixa Econômica</option>
                                <option value="BRADESCO">Bradesco</option>
                                <option value="ITAU">Itaú</option>
                                <option value="SANTANDER">Santander</option>
                                <option value="SICOOB">Sicoob</option>
                            </select>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="submit" class="save">Confirmar Pagamento</button>
                        <button type="button" class="secondary" onclick="closePagamentoModal()">Cancelar</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    setTimeout(() => document.getElementById('valor_pagamento')?.focus(), 100);
}

function closePagamentoModal() {
    const modal = document.getElementById('pagamentoModal');
    if (modal) {
        modal.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(() => modal.remove(), 200);
    }
}

async function handlePagamento(event, contaId) {
    event.preventDefault();

    const valorPagamento = parseFloat(document.getElementById('valor_pagamento').value);
    const banco = document.getElementById('banco_pagamento').value;
    const idStr = String(contaId);
    const conta = contas.find(c => String(c.id) === idStr);

    if (!conta) {
        showMessage('Conta não encontrada!', 'error');
        return;
    }

    const novoValorPago = parseFloat(conta.valor_pago || 0) + valorPagamento;
    const valorNota = parseFloat(conta.valor_nota);
    
    let novoStatus = 'PENDENTE';
    if (novoValorPago >= valorNota) {
        novoStatus = 'PAGO';
    }

    const dataAtual = new Date().toISOString().split('T')[0];

    if (!isOnline) {
        showMessage('Sistema offline. Dados não foram salvos.', 'error');
        closePagamentoModal();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/contas/${idStr}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                valor_pago: novoValorPago,
                banco: banco,
                data_pagamento: dataAtual,
                status: novoStatus
            }),
            mode: 'cors'
        });

        if (!response.ok) throw new Error('Erro ao registrar pagamento');

        const savedData = await response.json();
        const index = contas.findIndex(c => String(c.id) === idStr);
        if (index !== -1) contas[index] = savedData;

        showMessage(novoStatus === 'PAGO' ? 'Pagamento completo registrado!' : 'Pagamento parcial registrado!', 'success');
        updateDashboard();
        filterContas();
        closePagamentoModal();

    } catch (error) {
        console.error('Erro:', error);
        showMessage(`Erro: ${error.message}`, 'error');
    }
}

// ============================================
// TOGGLE PAGO
// ============================================
window.togglePago = async function(id) {
    const idStr = String(id);
    const conta = contas.find(c => String(c.id) === idStr);
    
    if (!conta) return;

    if (conta.status === 'PAGO' || parseFloat(conta.valor_pago || 0) > 0) {
        const confirmed = await showConfirm(
            'Deseja reverter o pagamento desta conta?',
            {
                title: 'Reverter Pagamento',
                confirmText: 'Reverter',
                cancelText: 'Cancelar',
                type: 'warning'
            }
        );

        if (!confirmed) return;

        conta.status = 'PENDENTE';
        conta.valor_pago = 0;
        conta.data_pagamento = null;
        conta.banco = null;
        
        updateDashboard();
        filterContas();

        if (isOnline) {
            try {
                await fetch(`${API_URL}/contas/${idStr}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Session-Token': sessionToken,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        status: 'PENDENTE',
                        valor_pago: 0,
                        data_pagamento: null,
                        banco: null
                    }),
                    mode: 'cors'
                });
            } catch (error) {
                console.error('Erro ao reverter:', error);
            }
        }
    } else {
        showPagamentoModal(conta);
    }
};

// ============================================
// VISUALIZAÇÃO
// ============================================
window.viewConta = function(id) {
    const idStr = String(id);
    const conta = contas.find(c => String(c.id) === idStr);
    
    if (!conta) {
        showMessage('Conta não encontrada!', 'error');
        return;
    }

    const modalHTML = `
        <div class="modal-overlay" id="viewModal">
            <div class="modal-content">
                <div class="modal-header">
                    <h3 class="modal-title">Detalhes da Conta a Receber</h3>
                </div>
                
                <div class="tabs-container">
                    <div class="tabs-nav">
                        <button class="tab-btn active" onclick="switchViewTab(0)">Dados da Nota</button>
                        <button class="tab-btn" onclick="switchViewTab(1)">Pagamento</button>
                        <button class="tab-btn" onclick="switchViewTab(2)">Entrega</button>
                    </div>

                    <div class="tab-content active" id="view-tab-nota">
                        <div class="info-section">
                            <h4>Informações da Nota Fiscal</h4>
                            <p><strong>Número NF:</strong> ${conta.numero_nf}</p>
                            <p><strong>Valor da Nota:</strong> R$ ${parseFloat(conta.valor_nota).toFixed(2)}</p>
                            <p><strong>Órgão:</strong> ${conta.orgao}</p>
                            <p><strong>Vendedor:</strong> ${conta.vendedor}</p>
                            <p><strong>Data Emissão:</strong> ${formatDate(conta.data_emissao)}</p>
                            <p><strong>Status:</strong> ${getStatusBadge(getStatusDinamico(conta))}</p>
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-pagamento">
                        <div class="info-section">
                            <h4>Informações de Pagamento</h4>
                            <p><strong>Valor Pago:</strong> R$ ${parseFloat(conta.valor_pago || 0).toFixed(2)}</p>
                            <p><strong>Valor Restante:</strong> R$ ${(parseFloat(conta.valor_nota) - parseFloat(conta.valor_pago || 0)).toFixed(2)}</p>
                            ${conta.banco ? `<p><strong>Banco:</strong> ${conta.banco}</p>` : '<p><em>Banco não informado</em></p>'}
                            ${conta.data_pagamento ? `<p><strong>Data do Pagamento:</strong> ${formatDate(conta.data_pagamento)}</p>` : '<p><em>Ainda não pago</em></p>'}
                        </div>
                    </div>

                    <div class="tab-content" id="view-tab-entrega">
                        <div class="info-section">
                            <h4>Dados da Entrega (Frete)</h4>
                            ${conta.dados_frete ? `
                                <p><strong>Transportadora:</strong> ${conta.dados_frete.transportadora || '-'}</p>
                                <p><strong>Rastreio:</strong> ${conta.dados_frete.rastreio || '-'}</p>
                                <p><strong>Data Entrega:</strong> ${formatDate(conta.dados_frete.data_entrega) || '-'}</p>
                            ` : '<p><em>Dados de frete não disponíveis</em></p>'}
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
// FILTROS
// ============================================
function updateAllFilters() {
    updateVendedoresFilter();
    updateBancosFilter();
    updateStatusFilter();
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

function updateStatusFilter() {
    const select = document.getElementById('filterStatus');
    if (select) {
        const currentValue = select.value;
        select.innerHTML = `
            <option value="">Todos</option>
            <option value="PAGO">Pago</option>
            <option value="VENCIDO">Vencido</option>
            <option value="PENDENTE">Pendente</option>
        `;
        select.value = currentValue;
    }
}

function filterContas() {
    const searchTerm = document.getElementById('search')?.value.toLowerCase() || '';
    const filterVendedor = document.getElementById('filterVendedor')?.value || '';
    const filterStatus = document.getElementById('filterStatus')?.value || '';
    const filterBanco = document.getElementById('filterBanco')?.value || '';
    
    let filtered = [...contas];

    filtered = filtered.filter(c => {
        const dataEmissao = new Date(c.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === currentMonth && dataEmissao.getFullYear() === currentYear;
    });

    if (filterVendedor) {
        filtered = filtered.filter(c => c.vendedor === filterVendedor);
    }

    if (filterBanco) {
        filtered = filtered.filter(c => c.banco === filterBanco);
    }

    if (filterStatus) {
        filtered = filtered.filter(c => getStatusDinamico(c) === filterStatus);
    }

    if (searchTerm) {
        filtered = filtered.filter(c => 
            c.numero_nf?.toLowerCase().includes(searchTerm) ||
            c.orgao?.toLowerCase().includes(searchTerm) ||
            c.vendedor?.toLowerCase().includes(searchTerm)
        );
    }

    filtered.sort((a, b) => new Date(b.data_emissao) - new Date(a.data_emissao));
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
                        <th style="width: 40px; text-align: center;">
                            <span style="font-size: 1.1rem;">✓</span>
                        </th>
                        <th>NF</th>
                        <th>Valor Nota</th>
                        <th>Órgão</th>
                        <th>Vendedor</th>
                        <th>Valor Pago</th>
                        <th>Data Pgto</th>
                        <th>Banco</th>
                        <th>Status</th>
                        <th style="text-align: center;">Ações</th>
                    </tr>
                </thead>
                <tbody>
                    ${contasToRender.map(c => {
                        const isPago = c.status === 'PAGO';
                        const valorPago = parseFloat(c.valor_pago || 0);
                        return `
                        <tr class="${isPago ? 'row-pago' : ''}">
                            <td style="text-align: center; padding: 8px;">
                                <div class="checkbox-wrapper">
                                    <input 
                                        type="checkbox" 
                                        id="check-${c.id}"
                                        ${isPago ? 'checked' : ''}
                                        onchange="togglePago('${c.id}')"
                                        class="styled-checkbox"
                                    >
                                    <label for="check-${c.id}" class="checkbox-label-styled"></label>
                                </div>
                            </td>
                            <td><strong>${c.numero_nf}</strong></td>
                            <td><strong>R$ ${parseFloat(c.valor_nota).toFixed(2)}</strong></td>
                            <td>${c.orgao}</td>
                            <td>${c.vendedor}</td>
                            <td>${valorPago > 0 ? `<strong style="color: var(--success-color);">R$ ${valorPago.toFixed(2)}</strong>` : '-'}</td>
                            <td style="white-space: nowrap;">${c.data_pagamento ? formatDate(c.data_pagamento) : '-'}</td>
                            <td>${c.banco || '-'}</td>
                            <td>${getStatusBadge(getStatusDinamico(c))}</td>
                            <td class="actions-cell" style="text-align: center; white-space: nowrap;">
                                <button onclick="viewConta('${c.id}')" class="action-btn view" title="Ver detalhes">Ver</button>
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

function getStatusDinamico(conta) {
    if (conta.status === 'PAGO') return 'PAGO';
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const dataEmissao = new Date(conta.data_emissao + 'T00:00:00');
    const prazo30 = new Date(dataEmissao);
    prazo30.setDate(prazo30.getDate() + 30);
    
    if (prazo30 < hoje) return 'VENCIDO';
    
    return 'PENDENTE';
}

function getStatusBadge(status) {
    const statusMap = {
        'PAGO': { class: 'entregue', text: 'Pago' },
        'VENCIDO': { class: 'devolvido', text: 'Vencido' },
        'PENDENTE': { class: 'transito', text: 'Pendente' }
    };
    
    const s = statusMap[status] || { class: 'transito', text: status };
    return `<span class="badge ${s.class}">${s.text}</span>`;
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
