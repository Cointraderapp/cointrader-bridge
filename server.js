const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

// Healthcheck Endpoint für Keep-Alive Pings
app.get('/', (req, res) => res.send('OK - Cointrader 24/7 Cloud Engine Aktiv'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

// ==========================================
// ZENTRALER 24/7 CLOUD STATE & BOT ENGINE
// ==========================================
let globalState = {
    agentActive: true,      // Bot läuft standardmäßig 24/7
    leverage: 50,
    margin: 5000,
    tp: 0.75,
    sl: 1.25,
    balance: 20000,
    totalProfit: 0,
    tradesCount: 0,
    winCount: 0,
    inPosition: false,
    position: null,         // Speichert aktive Position
    transactions: []
};

const prices = { BTCEUR: 72200, ETHEUR: 2280, SOLEUR: 95, XRPEUR: 1.30, DOGEEUR: 0.082 };
const cvd = { BTCEUR: 0, ETHEUR: 0, SOLEUR: 0, XRPEUR: 0, DOGEEUR: 0 };

function broadcastState() {
    const payload = JSON.stringify({ type: 'STATE_UPDATE', state: globalState });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

function broadcastTick(data) {
    const payload = JSON.stringify({ type: 'TICK', data });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

// 24/7 SERVER-SEITIGE TRADING LOGIK
function processCloudTradingEngine(symbol, price, tradeDelta) {
    prices[symbol] = price;
    cvd[symbol] = Math.round((cvd[symbol] || 0) + tradeDelta * 10) * 0.985;

    if (!globalState.agentActive) return;

    // 1. Position überwachen & schließen (Stop-Loss / Take-Profit)
    if (globalState.inPosition && globalState.position) {
        const pos = globalState.position;
        let priceChangePct = ((price - pos.buyPrice) / pos.buyPrice) * 100;
        if (pos.type === 'SHORT') priceChangePct = -priceChangePct;

        const totalVol = globalState.margin * globalState.leverage;
        const grossProfit = totalVol * (priceChangePct / 100);
        const fee = totalVol * 0.0015; // 0.15% Gebühren
        const netProfit = grossProfit - fee;

        // Take Profit Trigger
        if (priceChangePct >= globalState.tp || priceChangePct <= -globalState.sl) {
            globalState.inPosition = false;
            globalState.position = null;
            globalState.totalProfit += netProfit;
            globalState.balance += netProfit;
            globalState.tradesCount++;
            if (netProfit > 0) globalState.winCount++;

            const newTx = {
                id: Date.now(),
                type: netProfit >= 0 ? 'PROFIT' : 'LOSS',
                eur: Math.abs(netProfit),
                timestamp: Date.now(),
                entryPrice: price,
                note: `☁️ 24/7 Cloud Bot ${symbol} ${pos.type} (${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} € Netto)`
            };
            globalState.transactions.push(newTx);
            console.log(`[Cloud Engine] Position geschlossen: ${netProfit.toFixed(2)} €`);
            broadcastState();
        }
    } 
    // 2. Neue Position in der Cloud eröffnen
    else if (!globalState.inPosition && globalState.balance >= globalState.margin) {
        const currentCvd = cvd[symbol] || 0;
        if (Math.abs(currentCvd) > 1200) {
            const posType = currentCvd > 0 ? 'LONG' : 'SHORT';
            globalState.inPosition = true;
            globalState.position = {
                symbol: symbol,
                type: posType,
                buyPrice: price,
                buyTime: Date.now()
            };
            console.log(`[Cloud Engine] Neue 24/7 Position eröffnet: ${posType} auf ${symbol} @ ${price} €`);
            broadcastState();
        }
    }
}

// WEBSOCKET VERBINDUNGS-HANDLER
wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[Bridge] Client verbunden. Aktive Verbindungen: ${clients.size}`);

    // Sendet dem neu geöffneten Handy/PC sofort den aktuellen Cloud-Zustand
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: globalState }));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);

            // Parameteränderung vom PC/Handy auf dem Server speichern
            if (parsed.type === 'PARAM_UPDATE' && parsed.data) {
                if (parsed.data.leverage !== undefined) globalState.leverage = parsed.data.leverage;
                if (parsed.data.margin !== undefined) globalState.margin = parsed.data.margin;
                if (parsed.data.tp !== undefined) globalState.tp = parsed.data.tp;
                if (parsed.data.sl !== undefined) globalState.sl = parsed.data.sl;
                if (parsed.data.agentActive !== undefined) globalState.agentActive = parsed.data.agentActive;
                broadcastState();
            }
        } catch (e) {}
    });

    ws.on('close', () => clients.delete(ws));
});

// BINANCE WEBSOCKET STREAM
function connectBinanceStream() {
    const binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade');

    binanceWs.on('message', (data) => {
        try {
            const tick = JSON.parse(data);
            const symbolMap = { 'BTCUSDT': 'BTCEUR', 'ETHUSDT': 'ETHEUR', 'SOLUSDT': 'SOLEUR' };
            const symbol = symbolMap[tick.s];
            if (symbol) {
                const price = parseFloat(tick.p) * 0.92;
                const delta = tick.m ? -parseFloat(tick.q) : parseFloat(tick.q);
                
                // Bot Engine läuft serverseitig weiter
                processCloudTradingEngine(symbol, price, delta);
                broadcastTick(tick);
            }
        } catch (e) {}
    });

    binanceWs.on('close', () => setTimeout(connectBinanceStream, 3000));
    binanceWs.on('error', () => binanceWs.close());
}

connectBinanceStream();
server.listen(port, () => console.log(`[Server] 24/7 Cloud Bridge läuft auf Port ${port}`));
