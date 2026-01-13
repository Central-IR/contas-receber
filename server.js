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

// Servir arquivos estáticos (Frontend) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de autenticação para API (apenas para POST, PUT, DELETE)
const authenticate = (req, res, next) => {
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

// Health check (SEM autenticação)
app.get('/api/health', (req, res) => {
    console.log('✅ Health check');
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// GET - Listar todas as contas (SEM autenticação para testes)
app.get('/api/contas', async (req, res) => {
    try {
        console.log('📥 GET /api/contas - Listando todas as contas');
        
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('data_vencimento', { ascending: false });

        if (error) {
            console.error('❌ Erro do Supabase:', error);
            throw error;
        }

        console.log(`✅ ${data?.length || 0} contas retornadas`);
        res.json(data || []);
    } catch (error) {
        console.error('❌ Erro ao buscar contas:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar contas', 
            details: error.message 
        });
    }
});

// GET - Buscar conta por ID (SEM autenticação para testes)
app.get('/api/contas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 GET /api/contas/${id} - Buscando conta`);

        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        if (!data) {
            console.log('⚠️ Conta não encontrada');
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        console.log(`✅ Conta encontrada: ${data.numero_nf}`);
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar conta:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar conta', 
            details: error.message 
        });
    }
});

// POST - Criar nova conta (COM autenticação)
app.post('/api/contas', authenticate, async (req, res) => {
    try {
        const contaData = req.body;
        console.log('📥 POST /api/contas - Criando nova conta');

        // Validações básicas
        if (!contaData.numero_nf || !contaData.orgao || !contaData.vendedor || 
            !contaData.banco || !contaData.valor || !contaData.data_emissao || 
            !contaData.data_vencimento) {
            console.log('⚠️ Campos obrigatórios faltando');
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

        console.log(`✅ Conta criada: ${data.numero_nf}`);
        res.status(201).json(data);
    } catch (error) {
        console.error('❌ Erro ao criar conta:', error);
        res.status(500).json({ 
            error: 'Erro ao criar conta', 
            details: error.message 
        });
    }
});

// PUT - Atualizar conta (COM autenticação)
app.put('/api/contas/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const contaData = req.body;
        console.log(`📥 PUT /api/contas/${id} - Atualizando conta`);

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
            console.log('⚠️ Conta não encontrada');
            return res.status(404).json({ error: 'Conta não encontrada' });
        }

        console.log(`✅ Conta atualizada: ${data.numero_nf}`);
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao atualizar conta:', error);
        res.status(500).json({ 
            error: 'Erro ao atualizar conta', 
            details: error.message 
        });
    }
});

// DELETE - Excluir conta (COM autenticação)
app.delete('/api/contas/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 DELETE /api/contas/${id} - Excluindo conta`);

        const { error } = await supabase
            .from('contas_receber')
            .delete()
            .eq('id', id);

        if (error) throw error;

        console.log('✅ Conta excluída com sucesso');
        res.json({ message: 'Conta excluída com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao excluir conta:', error);
        res.status(500).json({ 
            error: 'Erro ao excluir conta', 
            details: error.message 
        });
    }
});

// Rota raiz - redireciona para o index.html
app.get('/', (req, res) => {
    console.log('📄 Servindo index.html');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Rota 404 para API
app.use('/api/*', (req, res) => {
    console.log('⚠️ Rota da API não encontrada:', req.originalUrl);
    res.status(404).json({ error: 'Rota da API não encontrada' });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err);
    res.status(500).json({ 
        error: 'Erro interno do servidor', 
        details: err.message 
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log('🚀 API Contas a Receber RODANDO');
    console.log('═══════════════════════════════════════════════');
    console.log(`📍 Porta: ${PORT}`);
    console.log(`🌐 Frontend: http://localhost:${PORT}`);
    console.log(`🔌 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📊 API Contas: http://localhost:${PORT}/api/contas`);
    console.log('');
    console.log('⚠️  AUTENTICAÇÃO:');
    console.log('   GET (listar/buscar) → SEM autenticação');
    console.log('   POST/PUT/DELETE → COM autenticação (X-Session-Token)');
    console.log('═══════════════════════════════════════════════');
    console.log('');
});
