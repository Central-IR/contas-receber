const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

// ============================================
// MIDDLEWARE CORS - MÁXIMA PERMISSIVIDADE
// ============================================

// CORS TOTALMENTE ABERTO para aceitar de QUALQUER origem
app.use(cors({
    origin: function (origin, callback) {
        // Aceita requisições sem origin (como de apps mobile) ou de qualquer origem
        callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'Accept', 'Cache-Control', 'X-Requested-With'],
    exposedHeaders: ['Content-Range', 'X-Content-Range', 'X-Total-Count'],
    maxAge: 86400, // 24 horas
    optionsSuccessStatus: 200
}));

// Headers adicionais de segurança CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    next();
});

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'sem origin'}`);
    next();
});

// Body parser
app.use(express.json());

// Servir arquivos estáticos ANTES das rotas da API
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// CONFIGURAÇÃO SUPABASE
// ============================================
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Variáveis Supabase não configuradas!');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ============================================
// MODO DESENVOLVIMENTO
// ============================================
const DEV_MODE = process.env.DEV_MODE === 'true';

// ============================================
// ROTAS
// ============================================

// Health - público
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        timestamp: new Date().toISOString(),
        cors: 'enabled',
        dev_mode: DEV_MODE
    });
});

// API Health - público
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok',
        supabase: 'connected',
        dev_mode: DEV_MODE
    });
});

// GET /api/contas
app.get('/api/contas', async (req, res) => {
    console.log('🔥 GET /api/contas requisitado');
    console.log('   Headers:', req.headers);
    console.log('   DEV_MODE:', DEV_MODE);
    
    // Em modo dev, permitir sem autenticação
    if (!DEV_MODE) {
        const token = req.headers['x-session-token'];
        if (!token) {
            console.log('❌ Token não fornecido');
            return res.status(401).json({ error: 'Token necessário' });
        }
        // TODO: validar token
    }
    
    try {
        console.log('🔍 Buscando dados no Supabase...');
        
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Erro Supabase:', error);
            throw error;
        }
        
        console.log(`✅ Dados retornados: ${data ? data.length : 0} registros`);
        
        if (data && data.length > 0) {
            console.log('   Primeiro registro:', data[0].numero_nf);
        }
        
        res.json(data || []);
    } catch (error) {
        console.error('❌ Erro ao buscar contas:', error.message);
        res.status(500).json({ 
            error: error.message,
            details: error.details || 'Sem detalhes adicionais'
        });
    }
});

// POST /api/contas
app.post('/api/contas', async (req, res) => {
    if (!DEV_MODE) {
        const token = req.headers['x-session-token'];
        if (!token) {
            return res.status(401).json({ error: 'Token necessário' });
        }
    }
    
    try {
        const { data, error } = await supabase
            .from('contas_receber')
            .insert([req.body])
            .select()
            .single();
        
        if (error) throw error;
        
        res.status(201).json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/contas/:id
app.put('/api/contas/:id', async (req, res) => {
    if (!DEV_MODE) {
        const token = req.headers['x-session-token'];
        if (!token) {
            return res.status(401).json({ error: 'Token necessário' });
        }
    }
    
    try {
        const { data, error } = await supabase
            .from('contas_receber')
            .update({ ...req.body, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PATCH /api/contas/:id
app.patch('/api/contas/:id', async (req, res) => {
    if (!DEV_MODE) {
        const token = req.headers['x-session-token'];
        if (!token) {
            return res.status(401).json({ error: 'Token necessário' });
        }
    }
    
    try {
        const { data, error } = await supabase
            .from('contas_receber')
            .update({ ...req.body, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();
        
        if (error) throw error;
        
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/contas/:id
app.delete('/api/contas/:id', async (req, res) => {
    if (!DEV_MODE) {
        const token = req.headers['x-session-token'];
        if (!token) {
            return res.status(401).json({ error: 'Token necessário' });
        }
    }
    
    try {
        const { error } = await supabase
            .from('contas_receber')
            .delete()
            .eq('id', req.params.id);
        
        if (error) throw error;
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ROTAS RAIZ - SERVIR FRONTEND
// ============================================

// Rota raiz - servir index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Fallback para SPA - qualquer rota não-API serve o index.html
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

// ============================================
// INICIAR
// ============================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🚀 SERVIDOR CONTAS A RECEBER INICIADO');
    console.log('='.repeat(50));
    console.log(`Porta: ${PORT}`);
    console.log(`Modo Dev: ${DEV_MODE ? 'SIM ✅' : 'NÃO ❌'}`);
    console.log(`CORS: TOTALMENTE ABERTO - ACEITA QUALQUER ORIGEM`);
    console.log(`Frontend: Servido da pasta /public`);
    console.log('='.repeat(50));
    console.log('');
});
