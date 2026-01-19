const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const app = express();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
console.log('✅ Supabase configurado:', supabaseUrl);

// ============================================
// CORS - CONFIGURAÇÃO CORRIGIDA
// ============================================
app.use(cors({
    origin: true, // Permite qualquer origem (use isto apenas em desenvolvimento!)
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'Accept', 'Cache-Control'],
    exposedHeaders: ['Content-Type', 'X-Session-Token'],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Headers adicionais para garantir CORS em todas as respostas
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Session-Token, Accept, Cache-Control');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.sendStatus(204);
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos COM MIME TYPES CORRETOS
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filepath) => {
        // IMPORTANTE: Adicionar charset UTF-8
        if (filepath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filepath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filepath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        // Cache control para desenvolvimento
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }
}));

app.use((req, res, next) => {
    console.log(`📥 ${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// AUTENTICAÇÃO
const PORTAL_URL = process.env.PORTAL_URL || 'https://ir-comercio-portal-zcan.onrender.com';

async function verificarAutenticacao(req, res, next) {
    const publicPaths = ['/', '/health', '/diagnostico.html'];
    if (publicPaths.includes(req.path)) return next();

    // FORÇAR MODO DESENVOLVIMENTO - DESABILITAR PARA PRODUÇÃO
    const DEVELOPMENT_MODE = true; // SEMPRE TRUE = SEM AUTENTICAÇÃO
    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DESENVOLVIMENTO - Autenticação desabilitada');
        return next();
    }

    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken) {
        console.log('❌ Token não fornecido');
        return res.status(401).json({ error: 'Não autenticado' });
    }

    try {
        const verifyResponse = await fetch(`${PORTAL_URL}/api/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken })
        });

        if (!verifyResponse.ok) {
            console.log('❌ Sessão inválida - Status:', verifyResponse.status);
            return res.status(401).json({ error: 'Sessão inválida' });
        }

        const sessionData = await verifyResponse.json();
        if (!sessionData.valid) {
            console.log('❌ Sessão não válida');
            return res.status(401).json({ error: 'Sessão inválida' });
        }

        req.user = sessionData.session;
        req.sessionToken = sessionToken;
        console.log('✅ Autenticação OK');
        next();
    } catch (error) {
        console.error('❌ Erro ao verificar autenticação:', error.message);
        return res.status(500).json({ error: 'Erro ao verificar autenticação', details: error.message });
    }
}

// ROTAS DA API
app.get('/api/contas', verificarAutenticacao, async (req, res) => {
    try {
        console.log('📋 Listando contas...');
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('❌ Erro Supabase ao listar:', error);
            throw error;
        }
        
        console.log(`✅ ${data?.length || 0} contas encontradas`);
        res.json(data || []);
    } catch (error) {
        console.error('❌ Erro ao listar contas:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao listar contas',
            message: error.message
        });
    }
});

app.get('/api/contas/:id', verificarAutenticacao, async (req, res) => {
    try {
        console.log(`🔍 Buscando conta ID: ${req.params.id}`);
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                console.log('❌ Conta não encontrada');
                return res.status(404).json({ success: false, error: 'Conta não encontrada' });
            }
            throw error;
        }

        console.log('✅ Conta encontrada');
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao buscar conta:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar conta',
            message: error.message
        });
    }
});

app.post('/api/contas', verificarAutenticacao, async (req, res) => {
    try {
        console.log('➕ Criando nova conta...');
        
        const contaData = req.body;

        const { data, error } = await supabase
            .from('contas_receber')
            .insert([contaData])
            .select()
            .single();

        if (error) {
            console.error('❌ Erro Supabase ao inserir:', error);
            throw error;
        }

        console.log('✅ Conta criada com sucesso! ID:', data.id);
        res.status(201).json(data);
    } catch (error) {
        console.error('❌ Erro ao criar conta:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao criar conta',
            message: error.message
        });
    }
});

app.put('/api/contas/:id', verificarAutenticacao, async (req, res) => {
    try {
        console.log(`✏️ Atualizando conta ID: ${req.params.id}`);
        
        const contaData = req.body;
        contaData.updated_at = new Date().toISOString();

        const { data, error } = await supabase
            .from('contas_receber')
            .update(contaData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ success: false, error: 'Conta não encontrada' });
            }
            throw error;
        }

        console.log('✅ Conta atualizada com sucesso!');
        res.json(data);
    } catch (error) {
        console.error('❌ Erro ao atualizar conta:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao atualizar conta',
            message: error.message
        });
    }
});

app.delete('/api/contas/:id', verificarAutenticacao, async (req, res) => {
    try {
        console.log(`🗑️ Deletando conta ID: ${req.params.id}`);
        const { error } = await supabase
            .from('contas_receber')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        console.log('✅ Conta deletada com sucesso!');
        res.json({ success: true, message: 'Conta removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro ao deletar conta:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao deletar conta',
            message: error.message
        });
    }
});

// ROTAS DE SAÚDE
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// TRATAMENTO GLOBAL DE ERROS
app.use((err, req, res, next) => {
    console.error('❌ Erro não tratado:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: err.message
    });
});

// INICIAR SERVIDOR
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('===============================================');
    console.log('🚀 CONTAS A RECEBER');
    console.log('===============================================');
    console.log(`✅ Porta: ${PORT}`);
    console.log(`✅ Supabase: ${supabaseUrl}`);
    console.log(`✅ Portal: ${PORTAL_URL}`);
    console.log('⚠️  MODO DESENVOLVIMENTO ATIVO - SEM AUTENTICAÇÃO');
    console.log('⚠️  CORS ABERTO - Todas as origens permitidas');
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
