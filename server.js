const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000; // Mantenha a porta 3000, pois o Easypanel faz o proxy

// Middleware para parsear JSON e URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ** CRÍTICO: CAPTURA DO CORPO BRUTO DA REQUISIÇÃO PARA DEBUG **
// Este middleware captura o corpo bruto da requisição ANTES de outros parsers.
// É essencial para ver se a câmera envia algo inesperado no corpo.
app.use((req, res, next) => {
    let rawBody = '';
    req.on('data', chunk => {
        // Usamos 'latin1' ou 'binary' para evitar problemas de encoding
        // e capturar os bytes exatos que a câmera envia.
        rawBody += chunk.toString('latin1'); 
    });
    req.on('end', () => {
        req.rawBody = rawBody; // Armazena o corpo bruto para inspeção posterior
        next();
    });
});

// MIDDLEWARE DE LOGS EXTREMAMENTE VERBOSOS
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    
    console.log(`\n======================================================`);
    console.log(`🚨 [${timestamp}] REQUISIÇÃO DA CÂMERA DETECTADA 🚨`);
    console.log(`======================================================`);
    console.log(`🌐 MÉTODO: ${req.method}`);
    console.log(`🔗 URL: ${req.originalUrl}`);
    console.log(`📍 IP DO CLIENTE: ${ip}`);
    console.log(`--- CABEÇALHOS (HEADERS) ---`);
    Object.entries(req.headers).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
    });
    console.log(`--- PARÂMETROS DE CONSULTA (QUERY PARAMS) ---`);
    if (Object.keys(req.query).length === 0) {
        console.log(`  (nenhum parâmetro de consulta)`);
    } else {
        Object.entries(req.query).forEach(([key, value]) => {
            console.log(`  ${key}: ${value}`);
        });
    }
    console.log(`--- CORPO BRUTO (RAW BODY) ---`);
    console.log(`"${req.rawBody}"`); // Loga o corpo bruto capturado
    console.log(`--- CORPO PARSEADO (PARSED BODY - se houver) ---`);
    // Tenta logar o corpo parseado (JSON ou URL-encoded)
    try {
        console.log(JSON.stringify(req.body, null, 2)); 
    } catch (e) {
        console.log(`  (não é JSON ou URL-encoded válido)`);
    }
    console.log(`======================================================\n`);
    next();
});

// Middleware de Autenticação Básica (mais robusto)
const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
        console.log('❌ Autenticação: Cabeçalho Basic ausente ou inválido.');
        res.set('WWW-Authenticate', 'Basic realm="Hikvision DynDNS"');
        return res.status(401).send('Unauthorized');
    }

    try {
        const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf8');
        const [username, password] = credentials.split(':');

        if (username === 'admin' && password === 'senha123') {
            req.user = { username, password }; // Anexa info do user à requisição
            console.log(`✅ Autenticação: Usuário '${username}' autenticado.`);
            next();
        } else {
            console.log(`❌ Autenticação: Credenciais inválidas para '${username}'.`);
            res.set('WWW-Authenticate', 'Basic realm="Hikvision DynDNS"');
            res.status(401).send('Unauthorized');
        }
    } catch (error) {
        console.log(`❌ Erro de Autenticação: ${error.message}`);
        res.set('WWW-Authenticate', 'Basic realm="Hikvision DynDNS"');
        res.status(401).send('Unauthorized');
    }
};

// Rota de Health Check (para testar acessibilidade do servidor)
app.get('/health', (req, res) => {
    res.json({ status: 'OK', server: 'DynDNS Debug Server', timestamp: new Date().toISOString() });
});

// ENDPOINTS DDNS DA HIKVISION
// Aplica autenticação às rotas de atualização DDNS
app.all('/nic/update', authenticate, (req, res) => {
    const hostname = req.query.hostname || req.body.hostname;
    let myip = req.query.myip || req.body.myip || req.ip; // Padrão para IP do cliente se não fornecido

    if (myip === 'auto') {
        myip = req.ip || req.connection.remoteAddress;
    }

    if (!hostname) {
        console.log('⚠️  Atualização DDNS: Hostname ausente.');
        return res.status(400).send('badparam');
    }

    console.log(`✅ Requisição de Atualização DDNS para Hostname: ${hostname}, IP: ${myip}`);
    // Aqui você normalmente salvaria o IP em um banco de dados
    // Por enquanto, apenas responde com 'good'
    res.send(`good ${myip}`);
});

app.all('/v3/update', authenticate, (req, res) => {
    const hostname = req.query.hostname || req.body.hostname;
    let myip = req.query.myip || req.body.myip || req.ip;

    if (myip === 'auto') {
        myip = req.ip || req.connection.remoteAddress;
    }

    if (!hostname) {
        console.log('⚠️  Atualização DDNS V3: Hostname ausente.');
        return res.status(400).send('badparam');
    }
    
    console.log(`✅ Requisição de Atualização DDNS V3 para Hostname: ${hostname}, IP: ${myip}`);
    res.send(`good ${myip}`);
});

// Catch-all para quaisquer outras requisições (útil para depurar caminhos inesperados)
app.all('*', (req, res) => {
    console.log(`⚠️  ROTA NÃO MAPEADA: ${req.method} ${req.originalUrl}`);
    res.status(404).send('Not Found or Unhandled Route');
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DynDNS Debug Server rodando na porta ${PORT}`);
    console.log(`📡 Acesso via http://api.portalhikvision.com.br/health`);
    console.log(`🔍 Aguardando conexão da câmera...`);
});
