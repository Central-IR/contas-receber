// ============================================
// CONTAS A RECEBER - SERVER.JS (SUPABASE)
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// SUPABASE CLIENT
// ============================================
const { createClient } = require('@supabase/supabase-js');

console.log('═══════════════════════════════════════════');
console.log('🔍 VERIFICANDO VARIÁVEIS DE AMBIENTE');
console.log('═══════════════════════════════════════════');
console.log('PORT:', process.env.PORT || '10000 (default)');
console.log('NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurada' : '❌ FALTANDO');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ FALTANDO');
console.log('FRETE_API_URL:', process.env.FRETE_API_URL || 'https://controle-frete.onrender.com (default)');
console.log('═══════════════════════════════════════════\n');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ ERRO CRÍTICO: Variáveis do Supabase não configuradas!');
    console.error('Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no Render.');
    process.exit(1);
}

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('✅ Cliente Supabase inicializado com sucesso!\n');

// ============================================
// MIDDLEWARES
// ============================================
app.use(cors({
    origin: [
        'https://ir-comercio-portal-zcan.onrender.com',
        'https://contas-receber.onrender.com',
        'https://contas-receber-kkf9.onrender.com',
        'https://controle-frete-m4gi.onrender.com',
        'https://controle-frete.onrender.com',
        'http://localhost:3000',
        'http://localhost:10000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-Token', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Log de requisições
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Middleware de autenticação
function verificarToken(req, res, next) {
    const token = req.headers['x-session-token'];
    
    if (!token) {
        return res.status(401).json({ error: 'Token não fornecido' });
    }
    
    if (token.length > 0) {
        next();
    } else {
        res.status(401).json({ error: 'Token inválido' });
    }
}

// ============================================
// SINCRONIZAÇÃO COM CONTROLE DE FRETE
// ============================================
async function sincronizarNotasEntregues(sessionToken) {
    try {
        const response = await fetch(`${process.env.FRETE_API_URL || 'https://controle-frete.onrender.com'}/fretes`, {
            method: 'GET',
            headers: {
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.log('⚠️ Erro ao buscar fretes:', response.status);
            return;
        }

        const fretes = await response.json();
        const notasEntregues = fretes.filter(f => f.entregue === true);

        for (const frete of notasEntregues) {
            // Verificar se já existe
            const { data: existe, error: erroExiste } = await supabase
                .from('contas_receber')
                .select('id')
                .eq('numero_nf', frete.numero_nf)
                .single();

            if (!existe && !erroExiste) {
                // Inserir nova conta
                const { error: erroInsert } = await supabase
                    .from('contas_receber')
                    .insert({
                        numero_nf: frete.numero_nf,
                        valor_nota: frete.valor_nota,
                        orgao: frete.orgao,
                        vendedor: frete.vendedor_responsavel,
                        data_emissao: frete.data_emissao,
                        valor_pago: 0,
                        status: 'PENDENTE',
                        dados_frete: {
                            transportadora: frete.transportadora,
                            rastreio: frete.rastreio,
                            data_entrega: frete.data_entrega_realizada || frete.data_entrega
                        }
                    });

                if (!erroInsert) {
                    console.log(`✅ Nota ${frete.numero_nf} importada automaticamente`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Erro na sincronização:', error.message);
    }
}

// ============================================
// ROTAS DA API
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Contas a Receber', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        database: 'Supabase'
    });
});

// GET - Listar todas as contas
app.get('/api/contas', verificarToken, async (req, res) => {
    try {
        // Sincronizar antes de listar
        await sincronizarNotasEntregues(req.headers['x-session-token']);
        
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('data_emissao', { ascending: false });

        if (error) {
            console.error('❌ Erro Supabase:', error);
            return res.status(500).json({ error: 'Erro ao listar contas', details: error.message });
        }

        console.log(`✅ ${data.length} contas carregadas`);
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao listar contas:', error);
        res.status(500).json({ error: 'Erro ao listar contas', details: error.message });
    }
});

// GET - Buscar conta por ID
app.get('/api/contas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar conta:', error);
        res.status(500).json({ error: 'Erro ao buscar conta', details: error.message });
    }
});

// POST - Criar nova conta
app.post('/api/contas', verificarToken, async (req, res) => {
    try {
        const {
            numero_nf,
            valor_nota,
            orgao,
            vendedor,
            data_emissao,
            valor_pago,
            data_pagamento,
            banco,
            status,
            dados_frete
        } = req.body;

        if (!numero_nf || !valor_nota || !orgao || !vendedor || !data_emissao) {
            return res.status(400).json({ error: 'Campos obrigatórios faltando' });
        }

        const { data, error } = await supabase
            .from('contas_receber')
            .insert({
                numero_nf,
                valor_nota,
                orgao,
                vendedor,
                data_emissao,
                valor_pago: valor_pago || 0,
                data_pagamento,
                banco,
                status: status || 'PENDENTE',
                dados_frete
            })
            .select()
            .single();

        if (error) {
            console.error('❌ Erro Supabase:', error);
            return res.status(500).json({ error: 'Erro ao criar conta', details: error.message });
        }

        console.log(`✅ Conta criada: ${numero_nf}`);
        res.status(201).json(data);
    } catch (error) {
        console.error('❌ Erro ao criar conta:', error);
        res.status(500).json({ error: 'Erro ao criar conta', details: error.message });
    }
});

// PATCH - Registrar pagamento
app.patch('/api/contas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { valor_pago, banco, data_pagamento, status } = req.body;

        const { data, error } = await supabase
            .from('contas_receber')
            .update({
                valor_pago,
                banco,
                data_pagamento,
                status
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('❌ Erro Supabase:', error);
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        console.log(`✅ Pagamento registrado para conta ${id}`);
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao registrar pagamento:', error);
        res.status(500).json({ error: 'Erro ao registrar pagamento', details: error.message });
    }
});

// DELETE - Excluir conta
app.delete('/api/contas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data, error } = await supabase
            .from('contas_receber')
            .delete()
            .eq('id', id)
            .select()
            .single();

        if (error) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        console.log(`✅ Conta excluída: ${id}`);
        res.json({ message: 'Conta excluída com sucesso', conta: data });
    } catch (error) {
        console.error('❌ Erro ao excluir conta:', error);
        res.status(500).json({ error: 'Erro ao excluir conta', details: error.message });
    }
});

// POST - Sincronizar manualmente
app.post('/api/sincronizar', verificarToken, async (req, res) => {
    try {
        await sincronizarNotasEntregues(req.headers['x-session-token']);
        res.json({ message: 'Sincronização realizada com sucesso' });
    } catch (error) {
        console.error('❌ Erro na sincronização:', error);
        res.status(500).json({ error: 'Erro na sincronização', details: error.message });
    }
});

// ============================================
// ROTAS DO FRONTEND
// ============================================

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota catch-all para SPA
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.status(404).json({ error: 'Rota não encontrada' });
    }
});

// ============================================
// TRATAMENTO DE ERROS
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor', 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('═══════════════════════════════════════════');
    console.log('💵 CONTAS A RECEBER - SERVIDOR INICIADO');
    console.log('═══════════════════════════════════════════');
    console.log(`🌐 Porta: ${PORT}`);
    console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Banco: Supabase`);
    console.log(`🔗 URL: http://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM recebido, fechando servidor...');
    server.close(() => {
        console.log('✅ Servidor fechado');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('⚠️ SIGINT recebido, fechando servidor...');
    server.close(() => {
        console.log('✅ Servidor fechado');
        process.exit(0);
    });
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});
