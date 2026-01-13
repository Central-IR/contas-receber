const DEVELOPMENT_MODE = true;
const PORTAL_URL = 'https://ir-comercio-portal-zcan.onrender.com';
const API_URL = 'https://contas-receber-m1xw.onrender.com'; // Ajustar conforme necessário

let contas = [];
let currentMonth = new Date();
let editingId = null;
let isOnline = false;
let sessionToken = null;

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

        const statusElement = document.getElementById('connectionStatus');
        if (response.ok) {
            statusElement.className = 'connection-status online';
            isOnline = true;
            
            const data = await response.json();
            contas = data;
            renderContas();
            updateStats();
        } else {
            statusElement.className = 'connection-status offline';
            isOnline = false;
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
        document.getElementById('connectionStatus').className = 'connection-status offline';
        isOnline = false;
    }
}

function startPolling() {
    setInterval(async () => {
        if (isOnline) {
            await checkServerStatus();
        }
    }, 10000);
}

function updateDisplay() {
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const monthDisplay = document.getElementById('currentMonth');
    if (monthDisplay) {
        monthDisplay.textContent = `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
    }
    
    renderContas();
    updateStats();
}

function changeMonth(direction) {
    currentMonth.setMonth(currentMonth.getMonth() + direction);
    updateDisplay();
}

function formatCurrency(value) {
    if (!value || value === 'R$ 0,00') return 'R$ 0,00';
    
    // Remove tudo que não é número
    const numbers = value.toString().replace(/[^\d]/g, '');
    
    if (!numbers || numbers === '0') return 'R$ 0,00';
    
    // Converte para número e formata
    const amount = parseFloat(numbers) / 100;
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(value) {
    if (!value) return 0;
    const numbers = value.toString().replace(/[^\d]/g, '');
    return parseFloat(numbers) / 100;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
}

function getStatusConta(conta) {
    if (conta.status === 'PAGO') return 'PAGO';
    
    if (conta.data_vencimento) {
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const vencimento = new Date(conta.data_vencimento + 'T00:00:00');
        vencimento.setHours(0, 0, 0, 0);
        
        if (vencimento < hoje) {
            return 'VENCIDO';
        }
    }
    
    return 'A_RECEBER';
}

function updateStats() {
    let totalPago = 0;
    let totalVencido = 0;
    let totalAReceber = 0;
    let totalFaturado = 0;
    let contasVencidas = [];

    const mesAtual = currentMonth.getMonth();
    const anoAtual = currentMonth.getFullYear();

    contas.forEach(conta => {
        const dataEmissao = new Date(conta.data_emissao + 'T00:00:00');
        const mes = dataEmissao.getMonth();
        const ano = dataEmissao.getFullYear();
        
        const valor = parseCurrency(conta.valor);
        const status = getStatusConta(conta);
        
        // Faturado e Pago são mensais
        if (mes === mesAtual && ano === anoAtual) {
            totalFaturado += valor;
            if (status === 'PAGO') {
                totalPago += valor;
            }
            if (status === 'A_RECEBER') {
                totalAReceber += valor;
            }
        }
        
        // Vencido é universal (todas as contas vencidas)
        if (status === 'VENCIDO') {
            totalVencido += valor;
            contasVencidas.push(conta);
        }
    });

    document.getElementById('statPago').textContent = formatCurrency(totalPago * 100);
    document.getElementById('statVencido').textContent = formatCurrency(totalVencido * 100);
    document.getElementById('statAReceber').textContent = formatCurrency(totalAReceber * 100);
    document.getElementById('statFaturado').textContent = formatCurrency(totalFaturado * 100);

    // Mostrar alerta de vencido
    const pulseBadge = document.getElementById('pulseBadgeVencido');
    const cardVencido = document.getElementById('cardVencido');
    
    if (contasVencidas.length > 0) {
        pulseBadge.style.display = 'block';
        cardVencido.style.cursor = 'pointer';
        cardVencido.onclick = () => showVencidosModal(contasVencidas);
    } else {
        pulseBadge.style.display = 'none';
        cardVencido.style.cursor = 'default';
        cardVencido.onclick = null;
    }

    // Atualizar filtros
    updateFilters();
}

function showVencidosModal(contasVencidas) {
    const container = document.getElementById('vencidosContainer');
    container.innerHTML = '';

    contasVencidas.forEach(conta => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${conta.numero_nf}</td>
            <td>${conta.orgao}</td>
            <td>${formatDate(conta.data_emissao)}</td>
            <td>${formatCurrency(parseCurrency(conta.valor) * 100)}</td>
            <td>${formatDate(conta.data_vencimento)}</td>
        `;
        container.appendChild(tr);
    });

    document.getElementById('vencidosModal').classList.add('show');
}

function closeVencidosModal() {
    document.getElementById('vencidosModal').classList.remove('show');
}

function updateFilters() {
    const vendedores = [...new Set(contas.map(c => c.vendedor))].sort();
    const bancos = [...new Set(contas.map(c => c.banco).filter(b => b))].sort();

    const filterVendedor = document.getElementById('filterVendedor');
    const filterBanco = document.getElementById('filterBanco');

    const vendedorAtual = filterVendedor.value;
    const bancoAtual = filterBanco.value;

    filterVendedor.innerHTML = '<option value="">Vendedor</option>';
    vendedores.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        if (v === vendedorAtual) opt.selected = true;
        filterVendedor.appendChild(opt);
    });

    filterBanco.innerHTML = '<option value="">Banco</option>';
    bancos.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        if (b === bancoAtual) opt.selected = true;
        filterBanco.appendChild(opt);
    });
}

function renderContas() {
    const container = document.getElementById('contasContainer');
    container.innerHTML = '';

    const mesAtual = currentMonth.getMonth();
    const anoAtual = currentMonth.getFullYear();

    const contasFiltradas = contas.filter(conta => {
        const dataEmissao = new Date(conta.data_emissao + 'T00:00:00');
        return dataEmissao.getMonth() === mesAtual && dataEmissao.getFullYear() === anoAtual;
    });

    if (contasFiltradas.length === 0) {
        container.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhuma conta encontrada para este mês</td></tr>';
        return;
    }

    contasFiltradas.forEach(conta => {
        const status = getStatusConta(conta);
        const statusClass = status === 'PAGO' ? 'success' : status === 'VENCIDO' ? 'danger' : 'warning';
        const statusLabel = status === 'A_RECEBER' ? 'A Receber' : status === 'PAGO' ? 'Pago' : 'Vencido';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${conta.numero_nf}</td>
            <td>${conta.orgao}</td>
            <td>${conta.vendedor}</td>
            <td>${conta.banco || '-'}</td>
            <td>${formatDate(conta.data_emissao)}</td>
            <td>${formatCurrency(parseCurrency(conta.valor) * 100)}</td>
            <td><span class="badge badge-${statusClass}">${statusLabel}</span></td>
            <td class="actions-cell" style="text-align: center;">
                <button class="action-btn view" onclick="viewConta('${conta.id}')" title="Ver">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                </button>
                <button class="action-btn edit" onclick="editConta('${conta.id}')" title="Editar">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                ${status !== 'PAGO' ? `
                <button class="action-btn success" onclick="marcarPago('${conta.id}')" title="Marcar como Pago">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>
                ` : ''}
                <button class="action-btn delete" onclick="deleteConta('${conta.id}')" title="Excluir">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        `;
        container.appendChild(tr);
    });
}

function filterContas() {
    const search = document.getElementById('search').value.toUpperCase();
    const vendedorFilter = document.getElementById('filterVendedor').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const bancoFilter = document.getElementById('filterBanco').value;

    const rows = document.querySelectorAll('#contasContainer tr');
    
    rows.forEach(row => {
        if (row.querySelector('td[colspan]')) return; // Skip empty message row
        
        const cells = row.querySelectorAll('td');
        const nf = cells[0].textContent;
        const orgao = cells[1].textContent;
        const vendedor = cells[2].textContent;
        const banco = cells[3].textContent;
        const statusBadge = cells[6].querySelector('.badge');
        const status = statusBadge ? statusBadge.textContent.trim() : '';

        const matchSearch = !search || 
            nf.includes(search) || 
            orgao.includes(search) || 
            vendedor.includes(search);
        
        const matchVendedor = !vendedorFilter || vendedor === vendedorFilter;
        const matchBanco = !bancoFilter || banco === bancoFilter;
        
        let matchStatus = true;
        if (statusFilter) {
            if (statusFilter === 'PAGO' && status !== 'Pago') matchStatus = false;
            if (statusFilter === 'A_RECEBER' && status !== 'A Receber') matchStatus = false;
            if (statusFilter === 'VENCIDO' && status !== 'Vencido') matchStatus = false;
        }

        row.style.display = matchSearch && matchVendedor && matchStatus && matchBanco ? '' : 'none';
    });
}

function openFormModal(id = null) {
    editingId = id;
    const modal = document.getElementById('formModal');
    const title = document.getElementById('formModalTitle');
    const form = document.getElementById('contaForm');
    
    form.reset();
    
    if (id) {
        title.textContent = 'Editar NF';
        const conta = contas.find(c => c.id === id);
        if (conta) {
            document.getElementById('numeroNf').value = conta.numero_nf;
            document.getElementById('orgao').value = conta.orgao;
            document.getElementById('vendedor').value = conta.vendedor;
            document.getElementById('banco').value = conta.banco || '';
            document.getElementById('dataEmissao').value = conta.data_emissao;
            document.getElementById('dataVencimento').value = conta.data_vencimento || '';
            document.getElementById('valor').value = conta.valor || '';
            document.getElementById('tipoNf').value = conta.tipo_nf || 'ENVIO';
            document.getElementById('observacoes').value = conta.observacoes || '';
        }
    } else {
        title.textContent = 'Nova NF';
    }
    
    modal.classList.add('show');
    setupUpperCaseInputs();
}

function closeFormModal() {
    document.getElementById('formModal').classList.remove('show');
    editingId = null;
    showToast('Atualização cancelada', 'error');
}

async function saveConta(event) {
    event.preventDefault();
    
    const numeroNf = toUpperCase(document.getElementById('numeroNf').value);
    const orgao = toUpperCase(document.getElementById('orgao').value);
    const vendedor = toUpperCase(document.getElementById('vendedor').value);
    const banco = toUpperCase(document.getElementById('banco').value);
    const dataEmissao = document.getElementById('dataEmissao').value;
    const dataVencimento = document.getElementById('dataVencimento').value;
    const valorInput = document.getElementById('valor').value;
    const valor = valorInput ? formatCurrency(valorInput) : null;
    const tipoNf = document.getElementById('tipoNf').value;
    const observacoes = toUpperCase(document.getElementById('observacoes').value);

    const contaData = {
        numero_nf: numeroNf,
        orgao,
        vendedor,
        banco: banco || null,
        data_emissao: dataEmissao,
        data_vencimento: dataVencimento || null,
        valor: valor || null,
        tipo_nf: tipoNf,
        observacoes: observacoes || null,
        status: editingId ? undefined : 'A_RECEBER'
    };

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        let response;
        if (editingId) {
            response = await fetch(`${API_URL}/contas/${editingId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(contaData)
            });
        } else {
            response = await fetch(`${API_URL}/contas`, {
                method: 'POST',
                headers,
                body: JSON.stringify(contaData)
            });
        }

        if (!response.ok) {
            throw new Error('Erro ao salvar conta');
        }

        await syncData();
        closeFormModal();
        showToast(editingId ? `NF ${numeroNf} atualizada` : `NF ${numeroNf} registrada`, 'success');
        editingId = null;
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
        showToast('Erro ao salvar conta', 'error');
    }
}

function viewConta(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;

    const status = getStatusConta(conta);
    const statusLabel = status === 'A_RECEBER' ? 'A Receber' : status === 'PAGO' ? 'Pago' : 'Vencido';

    document.getElementById('modalNumero').textContent = conta.numero_nf;
    document.getElementById('infoOrgao').textContent = conta.orgao;
    document.getElementById('infoVendedor').textContent = conta.vendedor;
    document.getElementById('infoBanco').textContent = conta.banco || '-';
    document.getElementById('infoValor').textContent = formatCurrency(parseCurrency(conta.valor) * 100);
    document.getElementById('infoDataEmissao').textContent = formatDate(conta.data_emissao);
    document.getElementById('infoDataVencimento').textContent = formatDate(conta.data_vencimento);
    document.getElementById('infoDataPagamento').textContent = formatDate(conta.data_pagamento);
    document.getElementById('infoStatus').textContent = statusLabel;
    document.getElementById('infoTipoNf').textContent = conta.tipo_nf === 'ENVIO' ? 'Envio' : 'Retorno';
    document.getElementById('infoObservacoes').textContent = conta.observacoes || '-';

    document.getElementById('infoModal').classList.add('show');
}

function closeInfoModal() {
    document.getElementById('infoModal').classList.remove('show');
}

function editConta(id) {
    openFormModal(id);
}

async function marcarPago(id) {
    if (!confirm('Marcar esta conta como paga?')) return;

    try {
        const headers = {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };

        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const hoje = new Date().toISOString().split('T')[0];
        const response = await fetch(`${API_URL}/contas/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                status: 'PAGO',
                data_pagamento: hoje
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao atualizar status');
        }

        await syncData();
        showToast('Conta marcada como paga', 'success');
    } catch (error) {
        console.error('❌ Erro ao marcar como pago:', error);
        showToast('Erro ao atualizar status', 'error');
    }
}

async function deleteConta(id) {
    const conta = contas.find(c => c.id === id);
    if (!conta) return;

    if (!confirm(`Excluir a NF ${conta.numero_nf}?`)) return;

    try {
        const headers = {
            'Accept': 'application/json'
        };

        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/contas/${id}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) {
            throw new Error('Erro ao excluir conta');
        }

        await syncData();
        showToast(`NF ${conta.numero_nf} excluída`, 'error');
    } catch (error) {
        console.error('❌ Erro ao excluir:', error);
        showToast('Erro ao excluir conta', 'error');
    }
}

async function syncData() {
    try {
        const headers = {
            'Accept': 'application/json'
        };

        if (!DEVELOPMENT_MODE && sessionToken) {
            headers['X-Session-Token'] = sessionToken;
        }

        const response = await fetch(`${API_URL}/contas`, {
            method: 'GET',
            headers
        });

        if (!response.ok) {
            throw new Error('Erro ao sincronizar');
        }

        contas = await response.json();
        renderContas();
        updateStats();
        showToast('Dados sincronizados', 'success');
    } catch (error) {
        console.error('❌ Erro ao sincronizar:', error);
        showToast('Erro ao sincronizar dados', 'error');
    }
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

// Adicionar máscara de moeda no campo valor
document.addEventListener('DOMContentLoaded', () => {
    const valorInput = document.getElementById('valor');
    if (valorInput) {
        valorInput.addEventListener('input', function(e) {
            let value = this.value.replace(/\D/g, '');
            if (value) {
                value = (parseInt(value) / 100).toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL'
                });
                this.value = value;
            }
        });
    }
});
