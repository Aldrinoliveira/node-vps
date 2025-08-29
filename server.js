const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage em memória
const dnsRecords = new Map();

// MIDDLEWARE PARA BASIC AUTH (CRUCIAL!)
function parseBasicAuth(req) {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
        return null;
    }
    
    try {
        const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
        const [username, password] = credentials.split(':');
        return { username, password };
    } catch (error) {
        return null;
    }
}

// Logs detalhados
app.use((req, res, next) => {
    console.log('\n🔥 ===== NOVA REQUISIÇÃO =====');
    console.log(`📅 ${new Date().toISOString()}`);
    console.log(`🌐 ${req.method} ${req.url}`);
    console.log(`📍 IP: ${req.ip || req.connection.remoteAddress || req.socket.remoteAddress}`);
    console.log(`🔧 Headers:`);
    Object.entries(req.headers).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
    });
    console.log(`📝 Query Params:`);
    Object.entries(req.query).forEach(([key, value]) => {
        console.log(`   ${key}: ${value}`);
    });
    
    // Parse Basic Auth
    const auth = parseBasicAuth(req);
    if (auth) {
        console.log(`🔐 Basic Auth: ${auth.username} / ${auth.password}`);
    } else {
        console.log(`❌ No Basic Auth found`);
    }
    
    console.log('🔥 ========================\n');
    next();
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'dyndns',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        records: dnsRecords.size
    });
});

// HIKVISION COMPATIBILITY: /v3/update -> /nic/update
app.all('/v3/update', (req, res) => {
    console.log('🔄 Redirecionando /v3/update para /nic/update');
    req.url = '/nic/update';
    req.originalUrl = '/nic/update';
    
    // Chama o handler do /nic/update
    handleNicUpdate(req, res);
});

// FUNÇÃO PRINCIPAL DYNDNS UPDATE
function handleNicUpdate(req, res) {
    console.log('🎯 PROCESSANDO /nic/update');
    
    // 1. Basic Auth (OBRIGATÓRIO)
    const auth = parseBasicAuth(req);
    if (!auth) {
        console.log('❌ Sem Basic Auth');
        res.status(401).send('badauth');
        return;
    }
    
    const { username, password } = auth;
    console.log(`👤 Credenciais: ${username} / ${password}`);
    
    // 2. Validar credenciais
    if (username !== 'admin' || password !== 'senha123') {
        console.log('❌ Credenciais inválidas');
        res.status(401).send('badauth');
        return;
    }
    
    // 3. Parâmetros obrigatórios
    const hostname = req.query.hostname;
    const myip = req.query.myip || req.ip || req.connection.remoteAddress;
    
    console.log(`🏠 Hostname: ${hostname}`);
    console.log(`🌐 IP: ${myip}`);
    
    if (!hostname) {
        console.log('❌ Hostname faltando');
        res.send('notfqdn');
        return;
    }
    
    // Validar hostname
    if (!hostname.includes('.')) {
        console.log('❌ Hostname inválido (sem domínio)');
        res.send('notfqdn');
        return;
    }
    
    // 4. Verificar se IP mudou (nochg)
    const existingRecord = dnsRecords.get(hostname);
    if (existingRecord && existingRecord.ip === myip) {
        console.log(`✅ IP não mudou: ${hostname} já está ${myip}`);
        res.send(`nochg ${myip}`);
        return;
    }
    
    // 5. Atualizar registro
    dnsRecords.set(hostname, {
        ip: myip,
        lastUpdate: new Date().toISOString(),
        userAgent: req.get('User-Agent') || 'unknown',
        method: req.method,
        username: username
    });
    
    console.log(`✅ DynDNS Update SUCCESS: ${hostname} -> ${myip}`);
    
    // 6. Resposta DynDNS padrão
    res.send(`good ${myip}`);
}

// ROTA PRINCIPAL /nic/update
app.all('/nic/update', handleNicUpdate);

// COMPATIBILIDADE ADICIONAL
app.all('/dyndns/update', handleNicUpdate);
app.all('/ddns/update', handleNicUpdate);
app.all('/update', handleNicUpdate);

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

// Status do servidor (nginx-style)
app.get('/nginx-status', (req, res) => {
    res.send('ok');
});

// Rota genérica para capturar outras tentativas
app.all('*', (req, res) => {
    console.log(`⚠️  Rota desconhecida: ${req.method} ${req.path}`);
    console.log(`🔍 Query:`, req.query);
    console.log(`🔍 Headers:`, req.headers);
    
    // Resposta genérica
    res.status(200).send('ok');
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DynDNS Server running on port ${PORT}`);
    console.log(`✅ Compatível com Hikvision DVR/NVR`);
    console.log(`🔧 Rotas disponíveis:`);
    console.log(`   GET  /health`);
    console.log(`   ALL  /nic/update`);
    console.log(`   ALL  /v3/update (redireciona para /nic/update)`);
    console.log(`   GET  /admin/records`);
    console.log(`🔍 Logs detalhados ativados`);
});
