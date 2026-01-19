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
// CORS - ULTRA PERMISSIVO (NUCLEAR OPTION)
// ============================================

// Middleware 1: Permitir tudo antes de qualquer rota
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Middleware 2: CORS package (redundante, mas garante)
app.use(cors({
    origin: '*',
    credentials: true,
    methods: '*',
    allowedHeaders: '*',
    optionsSuccessStatus: 200
}));

// Middleware 3: JSON parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Middleware 4: Logs
app.use((req, res, next) => {
    console.log(`📥 ${req.method} ${req.path}`);
    next();
});

// ============================================
// SERVIR ARQUIVOS ESTÁTICOS
// ============================================
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, filepath) => {
        if (filepath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        } else if (filepath.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
        } else if (filepath.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html; charset=utf-8');
        }
        res.setHeader('Cache-Control', 'no-cache');
    }
}));

// ============================================
// AUTENTICAÇÃO (DESABILITADA EM DEV)
// ============================================
const DEVELOPMENT_MODE = true;
const PORTAL_URL = process.env.PORTAL_URL || 'https://ir-comercio-portal-zcan.onrender.com';

async function verificarAutenticacao(req, res, next) {
    const publicPaths = ['/', '/health', '/diagnostico.html'];
    if (publicPaths.includes(req.path)) return next();

    if (DEVELOPMENT_MODE) {
        console.log('⚠️ MODO DEV - Autenticação desabilitada');
        return next();
    }

    const sessionToken = req.headers['x-session-token'];
    if (!sessionToken) {
        return res.status(401).json({ error: 'Não autenticado' });
    }

    try {
        const verifyResponse = await fetch(`${PORTAL_URL}/api/verify-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionToken })
        });

        if (!verifyResponse.ok) {
            return res.status(401).json({ error: 'Sessão inválida' });
        }

        const sessionData = await verifyResponse.json();
        if (!sessionData.valid) {
            return res.status(401).json({ error: 'Sessão inválida' });
        }

        req.user = sessionData.session;
        req.sessionToken = sessionToken;
        next();
    } catch (error) {
        console.error('❌ Erro na autenticação:', error.message);
        return res.status(500).json({ error: 'Erro ao verificar autenticação' });
    }
}

// ============================================
// ROTAS DA API
// ============================================

// GET /api/contas - Listar todas as contas
app.get('/api/contas', verificarAutenticacao, async (req, res) => {
    try {
        console.log('📋 Listando contas...');
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        
        console.log(`✅ ${data?.length || 0} contas encontradas`);
        res.json(data || []);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao listar contas',
            message: error.message
        });
    }
});

// GET /api/contas/:id - Buscar conta por ID
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
                return res.status(404).json({ success: false, error: 'Conta não encontrada' });
            }
            throw error;
        }

        console.log('✅ Conta encontrada');
        res.json(data);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao buscar conta',
            message: error.message
        });
    }
});

// POST /api/contas - Criar nova conta
app.post('/api/contas', verificarAutenticacao, async (req, res) => {
    try {
        console.log('➕ Criando conta...');
        const { data, error } = await supabase
            .from('contas_receber')
            .insert([req.body])
            .select()
            .single();

        if (error) throw error;

        console.log('✅ Conta criada! ID:', data.id);
        res.status(201).json(data);
    } catch (error) {
        console.error('❌ Erro:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao criar conta',
            message: error.message
        });
    }
});

// PUT /api/contas/:id - Atualizar conta
app.put('/api/contas/:id', verificarAutenticacao, async (req, res) => {
    try {
        console.log(`✏️ Atualizando conta ID: ${req.params.id}`);
        
        const contaData = { ...req.body, updated_at: new Date().toISOString() };

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

        console.log('✅ Conta atualizada!');
        res.json(data);
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao atualizar conta',
            message: error.message
        });
    }
});

// DELETE /api/contas/:id - Deletar conta
app.delete('/api/contas/:id', verificarAutenticacao, async (req, res) => {
    try {
        console.log(`🗑️ Deletando conta ID: ${req.params.id}`);
        const { error } = await supabase
            .from('contas_receber')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        console.log('✅ Conta deletada!');
        res.json({ success: true, message: 'Conta removida com sucesso' });
    } catch (error) {
        console.error('❌ Erro:', error.message);
        res.status(500).json({ 
            success: false, 
            error: 'Erro ao deletar conta',
            message: error.message
        });
    }
});

// ============================================
// ROTAS ESPECIAIS
// ============================================

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        cors: 'WIDE OPEN'
    });
});

// Index
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ============================================
// ERROR HANDLER
// ============================================
app.use((err, req, res, next) => {
    console.error('❌ Erro global:', err);
    res.status(500).json({
        success: false,
        error: 'Erro interno do servidor',
        message: err.message
    });
});

// ============================================
// START SERVER
// ============================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('===============================================');
    console.log('🚀 CONTAS A RECEBER - ULTRA PERMISSIVE MODE');
    console.log('===============================================');
    console.log(`✅ Porta: ${PORT}`);
    console.log(`✅ Supabase: ${supabaseUrl}`);
    console.log(`✅ Portal: ${PORTAL_URL}`);
    console.log('⚠️  MODO DESENVOLVIMENTO ATIVO');
    console.log('⚠️  CORS TOTALMENTE ABERTO (*)');
    console.log('⚠️  SEM AUTENTICAÇÃO');
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
