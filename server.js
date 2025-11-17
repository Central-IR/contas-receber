// ============================================
// CONTAS A RECEBER - SERVER.JS
// ============================================
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 10000;

// ============================================
// BANCO DE DADOS
// ============================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Criar tabela se não existir
pool.query(`
    CREATE TABLE IF NOT EXISTS contas_receber (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        numero_nf VARCHAR(50) UNIQUE NOT NULL,
        valor_nota DECIMAL(10,2) NOT NULL,
        orgao TEXT NOT NULL,
        vendedor VARCHAR(100) NOT NULL,
        data_emissao DATE NOT NULL,
        valor_pago DECIMAL(10,2) DEFAULT 0,
        data_pagamento DATE,
        banco VARCHAR(100),
        status VARCHAR(20) DEFAULT 'PENDENTE' CHECK (status IN ('PAGO', 'VENCIDO', 'PENDENTE')),
        dados_frete JSONB,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
`).then(() => console.log('✅ Tabela contas_receber verificada'))
  .catch(err => console.error('❌ Erro ao criar tabela:', err));

// ============================================
// MIDDLEWARES
// ============================================
app.use(cors({
    origin: [
        'https://ir-comercio-portal-zcan.onrender.com',
        'https://contas-receber.onrender.com',
        'https://controle-frete-m4gi.onrender.com',
        'http://localhost:3000',
        'http://localhost:10000'
    ],
    credentials: true
}));

app.use(express.json());
app.use(express.static('public'));

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
            // Verifica se já existe
            const existe = await pool.query(
                'SELECT id FROM contas_receber WHERE numero_nf = $1',
                [frete.numero_nf]
            );

            if (existe.rows.length === 0) {
                // Cria nova conta a receber
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

// GET - Listar todas as contas
app.get('/api/contas', verificarToken, async (req, res) => {
    try {
        // Sincronizar antes de listar
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

// POST - Criar nova conta (manual ou automático)
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

        // Validações
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
// ROTA RAIZ
// ============================================
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', service: 'Contas a Receber', timestamp: new Date().toISOString() });
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, () => {
    console.log(`💵 Servidor Contas a Receber rodando na porta ${PORT}`);
    console.log(`🌐 http://localhost:${PORT}`);
});

// Tratamento de erros não capturados
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});
