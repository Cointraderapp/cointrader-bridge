const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK - Cointrader 24/7 Smart Engine Aktiv'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

// ==========================================
// ZENTRALER 24/7 CLOUD STATE
// ==========================================
let globalState = {
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
    transactions: [],
    circuitBreakerActive: false,
    circuitBreakerUntil: 0
};

const prices = { BTCEUR: 72200, ETHEUR: 2280, SOLEUR: 95, XRPEUR: 1.30, DOGEEUR: 0.082 };
const cvd = { BTCEUR: 0, ETHEUR: 0, SOLEUR: 0, XRPEUR: 0, DOGEEUR: 0 };
const priceHistory = { BTCEUR: [], ETHEUR: [], SOLEUR: [], XRPEUR: [], DOGEEUR: [] };

// Variablen für den dynamischen Zyklus-Messer
let lastSpikeTime = Date.now();
let spikeIntervals = [120000]; // Startwert: 120 Sekunden

function broadcastState() {
    const payload = JSON.stringify({ type: 'STATE_UPDATE', state: globalState });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

function broadcastTick(data) {
    const payload = JSON.stringify({ type: 'TICK', data });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

// 24/7 SERVER-SEITIGE TRADING LOGIK (SMART BREAKER & DYNAMIC TIMEOUT)
function processCloudTradingEngine(symbol, price, tradeDelta) {
    prices[symbol] = price;
    cvd[symbol] = Math.round((cvd[symbol] || 0) + tradeDelta * 10) * 0.985;
    const now = Date.now();

    if (!priceHistory[symbol]) priceHistory[symbol] = [];
    priceHistory[symbol].push(price);
    if (priceHistory[symbol].length > 10) priceHistory[symbol].shift();

    let emergencyCloseTriggered = false;

    // MARKT-ZYKLUS & CIRCUIT BREAKER LOGIK
    if (priceHistory[symbol].length >= 5) {
        const firstPrice = priceHistory[symbol][0];
        const moveDirectionPct = ((price - firstPrice) / firstPrice) * 100; 
        const moveAbsPct = Math.abs(moveDirectionPct);

        // 1. Messung der Markt-Atemzüge (für das dynamische Timeout)
        if (moveAbsPct >= 0.20) {
            const timeSinceLastSpike = now - lastSpikeTime;
            if (timeSinceLastSpike > 15000) { // Spikes müssen mind. 15s auseinander liegen
                spikeIntervals.push(timeSinceLastSpike);
                if (spikeIntervals.length > 5) spikeIntervals.shift(); // Letzte 5 Zyklen merken
                lastSpikeTime = now;
            }
        }

        // 2. Harter Circuit Breaker (Flash Crash)
        if (moveAbsPct >= 0.80) {
            globalState.circuitBreakerActive = true;
            globalState.circuitBreakerUntil = now + (120 * 1000); 

            if (globalState.inPosition && globalState.position && globalState.position.symbol === symbol) {
                const pos = globalState.position;
                const isAgainstLong = pos.type === 'LONG' && moveDirectionPct <= -0.80; 
                const isAgainstShort = pos.type === 'SHORT' && moveDirectionPct >= 0.80; 

                if (isAgainstLong || isAgainstShort) {
                    emergencyCloseTriggered = true;
                }
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
        let priceChangePct = ((price - pos.buyPrice) / pos.buyPrice) * 100;
        if (pos.type === 'SHORT') priceChangePct = -priceChangePct;

        const totalVol = globalState.margin * globalState.leverage;
        const grossProfit = totalVol * (priceChangePct / 100);
        const fee = totalVol * 0.0015; // 0.15% Taker-Fee Simulation (beide Richtungen)
        const netProfit = grossProfit - fee;

        // Dynamisches Timeout berechnen
        const avgSpikeIntervalMs = spikeIntervals.reduce((a, b) => a + b, 0) / spikeIntervals.length;
        // Faktor 1.25 = Wir geben dem Markt 25% mehr Zeit als sein aktueller Rhythmus vorgibt
        const dynamicTimeoutSec = Math.max(90, Math.round((avgSpikeIntervalMs / 1000) * 1.25)); 
        
        const timeInTradeSec = Math.floor((now - pos.buyTime) / 1000);
        const currentCvd = cvd[symbol] || 0;
        const hasMomentum = (pos.type === 'LONG' && currentCvd >= 300) || (pos.type === 'SHORT' && currentCvd <= -300);

        let timeoutTriggered = false;
        // Wenn die Zeit abgelaufen ist und der Markt keinen Druck (CVD) in unsere Richtung aufbaut
        if (!hasMomentum && timeInTradeSec >= dynamicTimeoutSec) {
            timeoutTriggered = true;
            console.log(`[Smart Timeout] Markt-Zyklus betrug zuletzt ${Math.round(avgSpikeIntervalMs/1000)}s. Timeout ausgelöst bei ${dynamicTimeoutSec}s.`);
        }

        // Schließen bei TP, SL, Circuit Breaker Notausstieg oder dynamischem Timeout
        if (priceChangePct >= globalState.tp || priceChangePct <= -globalState.sl || emergencyCloseTriggered || timeoutTriggered) {
            globalState.inPosition = false;
            globalState.position = null;
            globalState.totalProfit += netProfit;
            globalState.balance += netProfit;
            globalState.tradesCount++;
            if (netProfit > 0) globalState.winCount++;

            let exitReason = `☁️ 24/7 Cloud Bot ${symbol} ${pos.type}`;
            if (emergencyCloseTriggered) exitReason = `🚨 Flash-Crash Guard`;
            if (timeoutTriggered) exitReason = `⏱️ Dyn. Timeout (${dynamicTimeoutSec}s)`;

            const newTx = {
                id: Date.now(),
                type: netProfit >= 0 ? 'PROFIT' : 'LOSS',
                eur: Math.abs(netProfit),
                timestamp: Date.now(),
                entryPrice: price,
                note: `${exitReason} (${netProfit >= 0 ? '+' : ''}${netProfit.toFixed(2)} € Netto)`
            };
            globalState.transactions.push(newTx);
            console.log(`[Cloud Engine] Trade beendet: ${netProfit.toFixed(2)} € | Grund: ${exitReason}`);
            broadcastState();
        }
    } 
    // 2. Neue Position eröffnen
    else if (!globalState.inPosition && !globalState.circuitBreakerActive && globalState.balance >= globalState.margin) {
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
            console.log(`[Cloud Engine] Neue Position: ${posType} auf ${symbol} @ ${price} €`);
            broadcastState();
        }
    }
}

// WEBSOCKET VERBINDUNGS-HANDLER
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: globalState }));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
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
server.listen(port, () => console.log(`[Server] 24/7 Cloud Bridge mit dynamischem Timeout läuft auf Port ${port}`));
