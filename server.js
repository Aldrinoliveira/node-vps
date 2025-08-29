const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage
const dnsRecords = new Map();

// BASIC AUTH MELHORADO
function parseBasicAuth(req) {
    const auth = req.headers.authorization;
    console.log(`🔐 Authorization header: ${auth}`);
    
    if (!auth) {
        console.log('❌ No authorization header');
        return null;
    }
    
    if (!auth.startsWith('Basic ')) {
        console.log('❌ Not Basic auth');
        return null;
    }
    
    try {
        const base64Credentials = auth.split(' ')[1];
        console.log(`🔧 Base64 credentials: ${base64Credentials}`);
        
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
        console.log(`🔧 Decoded credentials: ${credentials}`);
        
        const [username, password] = credentials.split(':');
        console.log(`👤 Username: ${username}`);
        console.log(`🔑 Password: ${password}`);
        
        return { username, password };
    } catch (error) {
        console.log(`❌ Error parsing Basic Auth: ${error.message}`);
        return null;
    }
}

// Logs detalhados
app.use((req, res, next) => {
    console.log('\n🔥 ===== NOVA REQUISIÇÃO =====');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`🌐 ${req.method} ${req.originalUrl}`);
    console.log(`📍 IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`🔧 All Headers:`);
    Object.entries(req.headers).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
    });
    console.log(`📝 Query Params:`);
    Object.entries(req.query).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
    });
    console.log('🔥 ========================\n');
    next();
});

// Health check
app.get('/health', (req, res) => {
    console.log('✅ Health check chamado');
    res.json({
        status: 'ok',
        service: 'dyndns',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        records: dnsRecords.size
    });
});

// HANDLER PRINCIPAL
function handleDynDNSUpdate(req, res) {
    console.log('🎯 INICIANDO PROCESSAMENTO DYNDNS');
    
    // 1. Parse Basic Auth
    const auth = parseBasicAuth(req);
    if (!auth) {
        console.log('❌ Basic Auth faltando ou inválido');
        res.status(401).send('badauth');
        return;
    }
    
    const { username, password } = auth;
    
    // 2. Validar credenciais
    if (username !== 'admin' || password !== 'senha123') {
        console.log(`❌ Credenciais inválidas: ${username}/${password}`);
        res.status(401).send('badauth');
        return;
    }
    
    console.log('✅ Autenticação OK');
    
    // 3. Parâmetros
    const hostname = req.query.hostname;
    const myip = req.query.myip || req.ip || req.connection.remoteAddress;
    
    console.log(`🏠 Hostname: ${hostname}`);
    console.log(`🌐 IP: ${myip}`);
    
    if (!hostname) {
        console.log('❌ Hostname faltando');
        res.send('notfqdn');
        return;
    }
    
    // 4. Verificar mudança
    const existing = dnsRecords.get(hostname);
    if (existing && existing.ip === myip) {
        console.log(`✅ IP não mudou: nochg ${myip}`);
        res.send(`nochg ${myip}`);
        return;
    }
    
    // 5. Salvar registro
    dnsRecords.set(hostname, {
        ip: myip,
        lastUpdate: new Date().toISOString(),
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method
    });
    
    console.log(`✅ Registro atualizado: ${hostname} -> ${myip}`);
    res.send(`good ${myip}`);
}

// ROTAS DYNDNS
app.all('/nic/update', handleDynDNSUpdate);
app.all('/v3/update', handleDynDNSUpdate);
app.all('/ddns/update', handleDynDNSUpdate);
app.all('/update', handleDynDNSUpdate);

// Admin records
app.get('/admin/records', (req, res) => {
    const auth = parseBasicAuth(req);
    if (!auth || auth.username !== 'admin' || auth.password !== 'senha123') {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const records = {};
    for (let [hostname, data] of dnsRecords.entries()) {
        records[hostname] = data;
    }

    res.json({
        totalRecords: dnsRecords.size,
        records: records,
        lastUpdate: new Date().toISOString()
    });
});

// Capturar tudo mais
app.all('*', (req, res) => {
    console.log(`⚠️  Rota não encontrada: ${req.method} ${req.originalUrl}`);
    res.status(404).send('not found');
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DynDNS Server running on port ${PORT}`);
    console.log(`🔧 Test with: curl -u admin:senha123 "http://localhost:${PORT}/nic/update?hostname=test.example.com&myip=1.2.3.4"`);
});
