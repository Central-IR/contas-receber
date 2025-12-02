const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

// Middlewares
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Session-Token', 'Accept']
}));
app.use(express.json());

// Middleware de autenticação
const authenticate = (req, res, next) => {
    const sessionToken = req.headers['x-session-token'];
    
    if (!sessionToken) {
        return res.status(401).json({ error: 'Token de sessão não fornecido' });
    }
    
    // Aqui você pode adicionar validação adicional do token se necessário
    req.sessionToken = sessionToken;
    next();
};

// ============================================
// ROTAS
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
            .order('data_vencimento', { ascending: false });

        if (error) throw error;

        res.json(data || []);
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
        if (!contaData.numero_nf || !contaData.orgao || !contaData.vendedor || 
            !contaData.banco || !contaData.valor || !contaData.data_emissao || 
            !contaData.data_vencimento) {
            return res.status(400).json({ 
                error: 'Campos obrigatórios faltando',
                details: 'numero_nf, orgao, vendedor, banco, valor, data_emissao e data_vencimento são obrigatórios'
            });
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

        // Remove o ID do body se existir
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

// Rota 404
app.use((req, res) => {
    res.status(404).json({ error: 'Rota não encontrada' });
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
    console.log(`🚀 API Contas a Receber rodando na porta ${PORT}`);
    console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
