const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Session-Token', 'Accept']
}));
app.use(express.json());

// Servir arquivos estáticos (Frontend)
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de autenticação para API
const DEVELOPMENT_MODE = true; // Mudar para false em produção

const authenticate = (req, res, next) => {
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO - Autenticação desabilitada');
        return next();
    }

    const sessionToken = req.headers['x-session-token'];
    
    if (!sessionToken) {
        return res.status(401).json({ error: 'Token de sessão não fornecido' });
    }
    
    req.sessionToken = sessionToken;
    next();
};

// ============================================
// ROTAS DA API
// ============================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// GET - Listar todas as contas
app.get('/api/contas', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('data_emissao', { ascending: false });

        if (error) throw error;

        // Atualizar status baseado na data de vencimento
        const contasAtualizadas = data.map(conta => {
            if (conta.status === 'PAGO') return conta;
            
            if (conta.data_vencimento) {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const vencimento = new Date(conta.data_vencimento + 'T00:00:00');
                vencimento.setHours(0, 0, 0, 0);
                
                if (vencimento < hoje) {
                    conta.status = 'VENCIDO';
                } else {
                    conta.status = 'A_RECEBER';
                }
            } else {
                conta.status = 'A_RECEBER';
            }
            
            return conta;
        });

        res.json(contasAtualizadas || []);
    } catch (error) {
        console.error('Erro ao buscar contas:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar contas', 
            details: error.message 
        });
    }
});

// GET - Buscar conta por ID
app.get('/api/contas/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao buscar conta:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar conta', 
            details: error.message 
        });
    }
});

// POST - Criar nova conta
app.post('/api/contas', authenticate, async (req, res) => {
    try {
        const contaData = req.body;

        // Validações básicas
        if (!contaData.numero_nf || !contaData.orgao || !contaData.vendedor || !contaData.data_emissao) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios faltando',
                details: 'numero_nf, orgao, vendedor e data_emissao são obrigatórios'
            });
        }

        // Define status como A_RECEBER se não fornecido
        if (!contaData.status) {
            contaData.status = 'A_RECEBER';
        }

        const { data, error } = await supabase
            .from('contas_receber')
            .insert([contaData])
            .select()
            .single();

        if (error) throw error;

        res.status(201).json(data);
    } catch (error) {
        console.error('Erro ao criar conta:', error);
        res.status(500).json({ 
            error: 'Erro ao criar conta', 
            details: error.message 
        });
    }
});

// PUT - Atualizar conta
app.put('/api/contas/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const contaData = req.body;

        // Remove campos que não devem ser atualizados
        delete contaData.id;
        delete contaData.created_at;

        const { data, error } = await supabase
            .from('contas_receber')
            .update(contaData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        if (!data) {
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        res.json(data);
    } catch (error) {
        console.error('Erro ao atualizar conta:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar conta', 
            details: error.message 
        });
    }
});

// DELETE - Excluir conta
app.delete('/api/contas/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await supabase
            .from('contas_receber')
            .delete()
            .eq('id', id);

        if (error) throw error;

        res.json({ message: 'Conta excluída com sucesso' });
    } catch (error) {
        console.error('Erro ao excluir conta:', error);
        res.status(500).json({ 
            error: 'Erro ao excluir conta', 
            details: error.message 
        });
    }
});

// Rota raiz - redireciona para o index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota 404 para API
app.use('/api/*', (req, res) => {
    res.status(404).json({ error: 'Rota da API não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor', 
        details: err.message 
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('');
    console.log('===============================================');
    console.log('🚀 CONTAS A RECEBER');
    console.log('===============================================');
    console.log(`✅ Porta: ${PORT}`);
    console.log(`✅ Supabase: ${process.env.SUPABASE_URL}`);
    console.log('===============================================');
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    process.exit(1);
});

module.exports = app;
