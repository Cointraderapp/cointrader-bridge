const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

// Healthcheck / Cron-Job Ping Endpoint
app.get('/', (req, res) => {
    res.send('OK - Cointrader Bridge aktiv');
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Set aller verbundenen Clients (PC, Smartphone, etc.)
const clients = new Set();

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[Bridge] Neuer Client verbunden. Aktive Clients: ${clients.size}`);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            // Synchronisiere Trades & Signale zwischen allen Geräten
            broadcast(JSON.stringify(data), ws);
        } catch (e) {
            console.error('[Bridge] Fehler beim Verarbeiten der Client-Nachricht:', e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[Bridge] Client getrennt. Aktive Clients: ${clients.size}`);
    });

    ws.on('error', (err) => {
        console.error('[Bridge] Client-Fehler:', err.message);
    });
});

// Broadcast-Funktion an alle verbundenen Frontends
function broadcast(data, excludeWs = null) {
    clients.forEach((client) => {
        if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

// BINANCE LIVE STREAM VERBINDUNG (Top 5 Coins)
const binanceStreams = 'btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade/xrpusdt@aggTrade/dogeusdt@aggTrade';
const binanceWsUrl = `wss://stream.binance.com:9443/stream?streams=${binanceStreams}`;

let binanceWs = null;

function connectBinanceStream() {
    console.log('[Binance] Verbinde mit Live-Stream...');
    binanceWs = new WebSocket(binanceWsUrl);

    binanceWs.on('open', () => {
        console.log('[Binance] Live Trade-Stream erfolgreich verbunden.');
    });

    binanceWs.on('message', (data) => {
        try {
            const payload = JSON.parse(data);
            if (payload && payload.data) {
                const tickMessage = JSON.stringify({
                    type: 'TICK',
                    data: payload.data
                });
                // Sende Live-Tick an alle verbundenen Dashboards
                broadcast(tickMessage);
            }
        } catch (e) {
            console.error('[Binance] Fehler beim Parsen des Ticks:', e);
        }
    });

    binanceWs.on('error', (err) => {
        console.error('[Binance] Stream Fehler:', err.message);
    });

    binanceWs.on('close', () => {
        console.log('[Binance] Verbindung getrennt. Reconnect in 3 Sekunden...');
        setTimeout(connectBinanceStream, 3000);
    });
}

// Binance Stream starten
connectBinanceStream();

server.listen(port, () => {
    console.log(`[Server] Cointrader Bridge läuft auf Port ${port}`);
});
