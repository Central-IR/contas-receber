// ============================================
// CONTAS A RECEBER - SERVER.JS (CORRIGIDO)
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// SUPABASE CLIENT
// ============================================
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('✅ Cliente Supabase inicializado');

// ============================================
// MIDDLEWARES (ORDEM CORRETA!)
// ============================================
app.use(cors({
    origin: [
        'https://ir-comercio-portal-zcan.onrender.com',
        'https://contas-receber.onrender.com',
        'https://contas-receber-kkf9.onrender.com', // ADICIONE ESTA LINHA!
        'https://controle-frete-m4gi.onrender.com',
        'http://localhost:3000',
        'http://localhost:10000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Session-Token', 'Accept']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos ANTES das rotas da API
app.use(express.static(path.join(__dirname, 'public')));

// Log de requisições para debug
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
        const response = await fetch(`${process.env.FRETE_API_URL}/fretes`, {
            method: 'GET',
            headers: {
                'X-Session-Token': sessionToken,
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            console.log('Erro ao buscar fretes:', response.status);
            return;
        }

        const fretes = await response.json();
        const notasEntregues = fretes.filter(f => f.entregue === true);

        for (const frete of notasEntregues) {
            const existe = await pool.query(
                'SELECT id FROM contas_receber WHERE numero_nf = $1',
                [frete.numero_nf]
            );

            if (existe.rows.length === 0) {
                await pool.query(
                    `INSERT INTO contas_receber 
                    (numero_nf, valor_nota, orgao, vendedor, data_emissao, dados_frete, status) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        frete.numero_nf,
                        frete.valor_nota,
                        frete.orgao,
                        frete.vendedor_responsavel,
                        frete.data_emissao,
                        JSON.stringify({
                            transportadora: frete.transportadora,
                            rastreio: frete.rastreio,
                            data_entrega: frete.data_entrega_realizada || frete.data_entrega
                        }),
                        'PENDENTE'
                    ]
                );
                console.log(`✅ Nota ${frete.numero_nf} importada automaticamente`);
            }
        }
    } catch (error) {
        console.error('Erro na sincronização:', error.message);
    }
}

// ============================================
// ROTAS DA API
// ============================================

// Health check ANTES de outras rotas
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        service: 'Contas a Receber', 
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development'
    });
});

// GET - Listar todas as contas
app.get('/api/contas', verificarToken, async (req, res) => {
    try {
        await sincronizarNotasEntregues(req.headers['x-session-token']);
        
        const result = await pool.query(
            'SELECT * FROM contas_receber ORDER BY data_emissao DESC'
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Erro ao listar contas:', error);
        res.status(500).json({ error: 'Erro ao listar contas', details: error.message });
    }
});

// GET - Buscar conta por ID
app.get('/api/contas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'SELECT * FROM contas_receber WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao buscar conta:', error);
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

        const result = await pool.query(
            `INSERT INTO contas_receber 
            (numero_nf, valor_nota, orgao, vendedor, data_emissao, valor_pago, data_pagamento, banco, status, dados_frete) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) 
            RETURNING *`,
            [numero_nf, valor_nota, orgao, vendedor, data_emissao, valor_pago || 0, data_pagamento, banco, status || 'PENDENTE', dados_frete ? JSON.stringify(dados_frete) : null]
        );

        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao criar conta:', error);
        res.status(500).json({ error: 'Erro ao criar conta', details: error.message });
    }
});

// PATCH - Registrar pagamento
app.patch('/api/contas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { valor_pago, banco, data_pagamento, status } = req.body;

        const result = await pool.query(
            `UPDATE contas_receber 
            SET valor_pago = $1, banco = $2, data_pagamento = $3, status = $4
            WHERE id = $5 
            RETURNING *`,
            [valor_pago, banco, data_pagamento, status, id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Erro ao registrar pagamento:', error);
        res.status(500).json({ error: 'Erro ao registrar pagamento', details: error.message });
    }
});

// DELETE - Excluir conta
app.delete('/api/contas/:id', verificarToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'DELETE FROM contas_receber WHERE id = $1 RETURNING *',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        res.json({ message: 'Conta excluída com sucesso', conta: result.rows[0] });
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        res.status(500).json({ error: 'Erro ao excluir conta', details: error.message });
    }
});

// POST - Sincronizar manualmente
app.post('/api/sincronizar', verificarToken, async (req, res) => {
    try {
        await sincronizarNotasEntregues(req.headers['x-session-token']);
        res.json({ message: 'Sincronização realizada com sucesso' });
    } catch (error) {
        console.error('Erro na sincronização:', error);
        res.status(500).json({ error: 'Erro na sincronização', details: error.message });
    }
});

// ============================================
// ROTA RAIZ - Deve vir POR ÚLTIMO!
// ============================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota catch-all para SPA (ÚLTIMA ROTA!)
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
    console.error('Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor', 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined 
    });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`💵 Servidor Contas a Receber rodando na porta ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`📦 Ambiente: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM recebido, fechando servidor...');
    server.close(() => {
        console.log('Servidor fechado');
        pool.end();
        process.exit(0);
    });
});

process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});
