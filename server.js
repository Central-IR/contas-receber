const express = require('express');
const cors = require('cors');
const app = express();

// ============================================
// MIDDLEWARE CORS - CONFIGURAÇÃO PROFISSIONAL
// ============================================

// Configuração CORS permissiva para aceitar qualquer origem
app.use(cors({
    origin: true, // Aceita qualquer origem
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Token', 'Accept', 'Cache-Control'],
    exposedHeaders: ['Content-Range', 'X-Content-Range'],
    maxAge: 600,
    optionsSuccessStatus: 200
}));

// Middleware de logging
app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - Origin: ${req.headers.origin || 'sem origin'}`);
    next();
});

// Body parser
app.use(express.json());

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
    // Em modo dev, permitir sem autenticação
    if (!DEV_MODE) {
        const token = req.headers['x-session-token'];
        if (!token) {
            return res.status(401).json({ error: 'Token necessário' });
        }
        // TODO: validar token
    }
    
    try {
        const { data, error } = await supabase
            .from('contas_receber')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        res.json(data || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
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

// Servir arquivos estáticos
app.use(express.static('public'));

// Rota raiz
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// ============================================
// INICIAR
// ============================================
const PORT = process.env.PORT || 10000;

app.listen(PORT, '0.0.0.0', () => {
    console.log('');
    console.log('='.repeat(50));
    console.log('🚀 SERVIDOR INICIADO');
    console.log('='.repeat(50));
    console.log(`Porta: ${PORT}`);
    console.log(`Modo Dev: ${DEV_MODE ? 'SIM ✅' : 'NÃO ❌'}`);
    console.log(`CORS: TOTALMENTE ABERTO`);
    console.log('='.repeat(50));
    console.log('');
});
