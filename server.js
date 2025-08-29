import express from 'express';
import basicAuth from 'express-basic-auth';
import fs from 'fs';
import path from 'path';

const app = express();

// Middleware de logging
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const ip = req.query.myip || req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    const hostname = req.query.hostname || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    const auth = req.headers.authorization ? 'authenticated' : 'no-auth';
    
    const logData = {
        timestamp,
        method: req.method,
        url: req.url,
        path: req.path,
        hostname,
        ip,
        userAgent,
        auth,
        query: req.query,
        headers: {
            'x-real-ip': req.headers['x-real-ip'],
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-forwarded-proto': req.headers['x-forwarded-proto'],
            'user-agent': req.headers['user-agent'],
            'host': req.headers['host'],
            'authorization': req.headers.authorization ? 'present' : 'missing'
        }
    };
    
    console.log(`[${timestamp}] ${req.method} ${req.path} - Host: ${hostname}, IP: ${ip}`);
    console.log(`Headers:`, JSON.stringify(logData.headers, null, 2));
    
    next();
});

// Autenticação básica para endpoints DynDNS
app.use(['/nic/update', '/v3/update'], basicAuth({
    users: { 'admin': 'senha123' },
    challenge: true,
    realm: 'DynDNS Server',
    unauthorizedResponse: (req) => {
        console.log('❌ Unauthorized access attempt:', req.headers);
        return 'badauth';
    }
}));

// Endpoint principal DynDNS
app.get(['/nic/update', '/v3/update'], (req, res) => {
    const ip = req.query.myip || req.headers['x-real-ip'] || req.headers['x-forwarded-for']?.split(',')[0] || req.connection.remoteAddress;
    const hostname = req.query.hostname || 'unknown';
    const system = req.query.system || 'dyndns';
    const timestamp = new Date().toISOString();
    
    // Headers DynDNS padrão
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Server', 'DynDNS-CheckIP/1.0');
    
    console.log(`🎉 HIKVISION SUCCESS: ${hostname} -> ${ip}`);
    console.log(`🤖 User-Agent: ${req.headers['user-agent']}`);
    console.log(`🔒 Protocol: ${req.headers['x-forwarded-proto'] || 'http'}`);
    console.log(`📊 Query params:`, req.query);
    
    // Log de sucesso
    const successLog = {
        timestamp,
        hostname,
        ip,
        route: req.path,
        system,
        userAgent: req.headers['user-agent'],
        protocol: req.headers['x-forwarded-proto'] || 'http',
        allParams: req.query
    };
    
    console.log('✅ Update Success:', JSON.stringify(successLog, null, 2));
    
    // Resposta padrão DynDNS
    res.send(`good ${ip}`);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok',
        service: 'dyndns-app',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        env: process.env.NODE_ENV || 'development'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        service: 'DynDNS App Server',
        version: '1.0.0',
        endpoints: [
            'GET /health - Health check',
            'GET /nic/update - DynDNS update (Basic Auth required)',
            'GET /v3/update - DynDNS update v3 (Basic Auth required)'
        ],
        auth: {
            type: 'Basic Auth',
            username: 'admin',
            realm: 'DynDNS Server'
        },
        timestamp: new Date().toISOString()
    });
});

// Middleware de erro
app.use((err, req, res, next) => {
    console.error('❌ Error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
    console.log('🚀 DynDNS App Server started!');
    console.log(`📡 Listening on port ${PORT}`);
    console.log(`🔑 Auth: admin:senha123`);
    console.log('✅ Ready for Hikvision cameras!');
});
