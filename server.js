const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK - Cointrader Bridge aktiv'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

// Zentraler Speicherstand auf dem Render-Server
let globalState = {
    leverage: 50,
    margin: 5000,
    tp: 0.75,
    sl: 1.25,
    transactions: []
};

function broadcast(data, senderWs = null) {
    clients.forEach(client => {
        if (client !== senderWs && client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}

wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[Bridge] Client verbunden. Aktive Verbindungen: ${clients.size}`);

    // 1. Sendet sofort den aktuellsten Status an jedes neu verbundene Gerät (z.B. Handy)
    ws.send(JSON.stringify({
        type: 'PARAM_UPDATE',
        data: {
            leverage: globalState.leverage,
            margin: globalState.margin,
            tp: globalState.tp,
            sl: globalState.sl
        }
    }));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);

            // 2. Aktualisiert den globalen Server-Speicher bei Änderungen
            if (parsed.type === 'PARAM_UPDATE' && parsed.data) {
                if (parsed.data.leverage !== undefined) globalState.leverage = parsed.data.leverage;
                if (parsed.data.margin !== undefined) globalState.margin = parsed.data.margin;
                if (parsed.data.tp !== undefined) globalState.tp = parsed.data.tp;
                if (parsed.data.sl !== undefined) globalState.sl = parsed.data.sl;
            } else if (parsed.type === 'TX_UPDATE' && parsed.tx) {
                globalState.transactions.push(parsed.tx);
            }

            // 3. Verteilt das Update sofort an alle anderen verbundenen Bildschirme
            broadcast(JSON.stringify(parsed), ws);
        } catch (e) {
            console.error('[Bridge] Fehler beim Verarbeiten:', e);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        console.log(`[Bridge] Client getrennt. Verbleibend: ${clients.size}`);
    });
});

// BINANCE LIVE STREAM & FALLBACK ENGINE
let lastBinanceTick = Date.now();
const prices = { BTCEUR: 68150, ETHEUR: 2450, SOLEUR: 135, XRPEUR: 0.58, DOGEEUR: 0.12 };

function connectBinanceStream() {
    const binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade/xrpusdt@aggTrade/dogeusdt@aggTrade');

    binanceWs.on('message', (data) => {
        lastBinanceTick = Date.now();
        try {
            const tick = JSON.parse(data);
            broadcast(JSON.stringify({ type: 'TICK', data: tick }));
        } catch (e) {}
    });

    binanceWs.on('close', () => setTimeout(connectBinanceStream, 3000));
    binanceWs.on('error', () => binanceWs.close());
}

connectBinanceStream();

setInterval(() => {
    if (Date.now() - lastBinanceTick > 1200 && clients.size > 0) {
        Object.keys(prices).forEach(symbol => {
            const deltaPct = (Math.random() - 0.495) * 0.0006;
            prices[symbol] = prices[symbol] * (1 + deltaPct);
            const tickData = {
                e: 'aggTrade',
                s: symbol.replace('EUR', 'USDT'),
                p: prices[symbol].toFixed(2),
                q: (Math.random() * 0.3 + 0.01).toFixed(4),
                m: Math.random() > 0.5
            };
            broadcast(JSON.stringify({ type: 'TICK', data: tickData }));
        });
    }
}, 800);

server.listen(port, () => console.log(`[Server] Bridge läuft auf Port ${port}`));
