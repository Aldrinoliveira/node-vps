const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Storage em memória
const dnsRecords = new Map();

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

// DynDNS update
app.get('/nic/update', (req, res) => {
    // Autenticação básica
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
        res.status(401).send('badauth');
        return;
    }

    const credentials = Buffer.from(auth.split(' ')[1], 'base64').toString();
    const [username, password] = credentials.split(':');

    if (username !== 'admin' || password !== 'senha123') {
        res.status(401).send('badauth');
        return;
    }

    const { hostname, myip } = req.query;
    
    if (!hostname) {
        res.send('notfqdn');
        return;
    }

    const ip = myip || req.ip || req.connection.remoteAddress;
    
    // Armazenar registro
    dnsRecords.set(hostname, {
        ip: ip,
        lastUpdate: new Date().toISOString(),
        userAgent: req.get('User-Agent') || 'unknown'
    });

    console.log(`📝 DynDNS Update: ${hostname} -> ${ip}`);
    res.send(`good ${ip}`);
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 DynDNS Server running on port ${PORT}`);
    console.log(`✅ In-memory storage initialized`);
});
