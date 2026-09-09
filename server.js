const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK - Cointrader 24/7 Multi-Factor Engine Aktiv'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

function getInitialState() {
    return {
        agentActive: true,
        leverage: 50,
        margin: 5000,
        tp: 0.75,
        sl: 1.25,
        balance: 20000,
        totalProfit: 0,
        tradesCount: 0,
        winCount: 0,
        inPosition: false,
        position: null,
        transactions: [{
            id: Date.now(),
            type: 'DEPOSIT',
            eur: 20000,
            timestamp: Date.now(),
            entryPrice: 73000,
            note: 'Startkapital Reset'
        }],
        circuitBreakerActive: false,
        circuitBreakerUntil: 0
    };
}

let globalState = getInitialState();
let tradeCooldownUntil = 0;

const prices = { BTCEUR: 73000, ETHEUR: 2300, SOLEUR: 96, XRPEUR: 0.58, DOGEEUR: 0.12 };
const cvd = { BTCEUR: 0, ETHEUR: 0, SOLEUR: 0, XRPEUR: 0, DOGEEUR: 0 };
const priceHistory = { BTCEUR: [], ETHEUR: [], SOLEUR: [], XRPEUR: [], DOGEEUR: [] };

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
    const now = Date.now();

    if (!priceHistory[symbol]) priceHistory[symbol] = [];
    priceHistory[symbol].push(price);
    if (priceHistory[symbol].length > 10) priceHistory[symbol].shift();

    let emergencyCloseTriggered = false;

    // CIRCUIT BREAKER LOGIK
    if (priceHistory[symbol].length >= 5) {
        const firstPrice = priceHistory[symbol][0];
        const moveDirectionPct = ((price - firstPrice) / firstPrice) * 100; 
        const moveAbsPct = Math.abs(moveDirectionPct);

        if (moveAbsPct >= 0.80) {
            globalState.circuitBreakerActive = true;
            globalState.circuitBreakerUntil = now + (120 * 1000); 

            if (globalState.inPosition && globalState.position && globalState.position.symbol === symbol) {
                const pos = globalState.position;
                const isAgainstLong = pos.type === 'LONG' && moveDirectionPct <= -0.80; 
                const isAgainstShort = pos.type === 'SHORT' && moveDirectionPct >= 0.80; 

                if (isAgainstLong || isAgainstShort) emergencyCloseTriggered = true;
            }
            broadcastState();
        }
    }

    if (globalState.circuitBreakerActive && now > globalState.circuitBreakerUntil) {
        globalState.circuitBreakerActive = false;
        broadcastState();
    }

    if (!globalState.agentActive) return;

    // 1. Position überwachen & schließen
    if (globalState.inPosition && globalState.position) {
        const pos = globalState.position;

        // CRITICAL BUGFIX: Nur Ticks verarbeiten, die exakt zum investierten Coin gehören!
        if (symbol !== pos.symbol) return;

        let priceChangePct = ((price - pos.buyPrice) / pos.buyPrice) * 100;
        if (pos.type === 'SHORT') priceChangePct = -priceChangePct;

        const totalVol = globalState.margin * globalState.leverage;
        const grossProfit = totalVol * (priceChangePct / 100);
        const fee = totalVol * 0.0015;
        const netProfit = grossProfit - fee;

        if (priceChangePct >= globalState.tp || priceChangePct <= -globalState.sl || emergencyCloseTriggered) {
            globalState.inPosition = false;
            globalState.position = null;
            globalState.totalProfit += netProfit;
            globalState.balance += netProfit;
            globalState.tradesCount++;
            if (netProfit > 0) globalState.winCount++;

            tradeCooldownUntil = now + 15000; // 15 Sekunden Cooldown nach jedem Trade

            const newTx = {
                id: Date.now(),
                type: netProfit >= 0 ? 'PROFIT' : 'LOSS',
                eur: Math.abs(netProfit),
                timestamp: Date.now(),
                entryPrice: price,
                note: `☁️ 24/7 Cloud Bot ${symbol} ${pos.type} (${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} € Netto)`
            };
            globalState.transactions.push(newTx);
            console.log(`[Cloud Engine] Trade beendet: ${netProfit.toFixed(2)} € auf ${symbol}`);
            broadcastState();
        }
    } 
    // 2. Neue Position eröffnen
    else if (!globalState.inPosition && !globalState.circuitBreakerActive && now > tradeCooldownUntil && globalState.balance >= globalState.margin) {
        const currentCvd = cvd[symbol] || 0;

        if (Math.abs(currentCvd) >= 1500) {
            const posType = currentCvd > 0 ? 'LONG' : 'SHORT';
            globalState.inPosition = true;
            globalState.position = {
                symbol: symbol,
                type: posType,
                buyPrice: price,
                buyTime: Date.now()
            };
            console.log(`[Cloud Engine] Neue Position eröffnet: ${posType} auf ${symbol} @ ${price} €`);
            broadcastState();
        }
    }
}

// WEBSOCKET HANDLER
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: globalState }));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            
            // SYNCHRONER RESET-BEFEHL
            if (parsed.type === 'RESET_STATE') {
                globalState = getInitialState();
                console.log(`[Server] Depot erfolgreich zurückgesetzt.`);
                broadcastState();
                return;
            }

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
                
                processCloudTradingEngine(symbol, price, delta);
                broadcastTick(tick);
            }
        } catch (e) {}
    });

    binanceWs.on('close', () => setTimeout(connectBinanceStream, 3000));
    binanceWs.on('error', () => binanceWs.close());
}

connectBinanceStream();
server.listen(port, () => console.log(`[Server] 24/7 Cloud Bridge mit Symbol-Sperre läuft auf Port ${port}`));
