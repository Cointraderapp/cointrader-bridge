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

let lastSpikeTime = Date.now();
let spikeIntervals = [120000];

function getSessionMultiplier() {
    const utcHour = new Date().getUTCHours();
    const isLondon = utcHour >= 7 && utcHour < 16;
    const isNY = utcHour >= 12 && utcHour < 21;

    if (isLondon && isNY) {
        return { name: "LONDON+NY OVERLAP 🔥", multiplier: 0.75 };
    } else if (isLondon || isNY) {
        return { name: "MAIN SESSION 📈", multiplier: 1.0 };
    } else {
        return { name: "OFF-HOURS / ASIEN 🌙", multiplier: 1.4 };
    }
}

function getLunarBias() {
    const date = new Date();
    let year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate();
    if (month < 3) { year--; month += 12; }
    let a = Math.floor(year / 100), b = Math.floor(a / 4), c = 2 - a + b;
    let e = Math.floor(365.25 * (year + 4716)), f = Math.floor(30.6001 * (month + 1));
    let jd = c + day + e + f - 1524.5;
    let daysSinceNew = (jd - 2451549.5) % 29.53058867;
    if (daysSinceNew < 0) daysSinceNew += 29.53058867;

    if (daysSinceNew < 5.53) return { name: "Neumond 🌑", favoredType: "LONG" };
    if (daysSinceNew >= 12.91 && daysSinceNew < 20.30) return { name: "Vollmond 🌕", favoredType: "SHORT" };
    return { name: "Mond Neutral 🌓", favoredType: "NONE" };
}

function broadcastState() {
    const payload = JSON.stringify({ type: 'STATE_UPDATE', state: globalState });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

function broadcastTick(data) {
    const payload = JSON.stringify({ type: 'TICK', data });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

function processCloudTradingEngine(symbol, price, tradeDelta) {
    prices[symbol] = price;
    cvd[symbol] = Math.round((cvd[symbol] || 0) + tradeDelta * 10) * 0.985;
    const now = Date.now();

    if (!priceHistory[symbol]) priceHistory[symbol] = [];
    priceHistory[symbol].push(price);
    if (priceHistory[symbol].length > 10) priceHistory[symbol].shift();

    let emergencyCloseTriggered = false;

    if (priceHistory[symbol].length >= 5) {
        const firstPrice = priceHistory[symbol][0];
        const moveDirectionPct = ((price - firstPrice) / firstPrice) * 100; 
        const moveAbsPct = Math.abs(moveDirectionPct);

        if (moveAbsPct >= 0.20) {
            const timeSinceLastSpike = now - lastSpikeTime;
            if (timeSinceLastSpike > 15000) {
                spikeIntervals.push(timeSinceLastSpike);
                if (spikeIntervals.length > 5) spikeIntervals.shift();
                lastSpikeTime = now;
            }
        }

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

    if (globalState.inPosition && globalState.position) {
        const pos = globalState.position;
        if (symbol !== pos.symbol) return;

        let priceChangePct = ((price - pos.buyPrice) / pos.buyPrice) * 100;
        if (pos.type === 'SHORT') priceChangePct = -priceChangePct;

        const totalVol = globalState.margin * globalState.leverage;
        const grossProfit = totalVol * (priceChangePct / 100);
        const fee = totalVol * 0.0015;
        const netProfit = grossProfit - fee;

        const avgSpikeIntervalMs = spikeIntervals.reduce((a, b) => a + b, 0) / spikeIntervals.length;
        const dynamicTimeoutSec = Math.max(90, Math.round((avgSpikeIntervalMs / 1000) * 1.25)); 
        
        const timeInTradeSec = Math.floor((now - pos.buyTime) / 1000);
        const currentCvd = cvd[symbol] || 0;
        const hasMomentum = (pos.type === 'LONG' && currentCvd >= 300) || (pos.type === 'SHORT' && currentCvd <= -300);

        let timeoutTriggered = false;
        if (!hasMomentum && timeInTradeSec >= dynamicTimeoutSec) {
            timeoutTriggered = true;
        }

        if (priceChangePct >= globalState.tp || priceChangePct <= -globalState.sl || emergencyCloseTriggered || timeoutTriggered) {
            globalState.inPosition = false;
            globalState.position = null;
            globalState.totalProfit += netProfit;
            globalState.balance += netProfit;
            globalState.tradesCount++;
            if (netProfit > 0) globalState.winCount++;

            tradeCooldownUntil = now + 15000;

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
    else if (!globalState.inPosition && !globalState.circuitBreakerActive && now > tradeCooldownUntil && globalState.balance >= globalState.margin) {
        const currentCvd = cvd[symbol] || 0;
        const sessionInfo = getSessionMultiplier();
        const lunarInfo = getLunarBias();

        let requiredCvd = 1500 * sessionInfo.multiplier;
        let posType = currentCvd > 0 ? 'LONG' : 'SHORT';

        if (posType === lunarInfo.favoredType) {
            requiredCvd *= 0.80;
        }

        if (Math.abs(currentCvd) >= requiredCvd) {
            globalState.inPosition = true;
            globalState.position = {
                symbol: symbol,
                type: posType,
                buyPrice: price,
                buyTime: Date.now()
            };
            console.log(`[Cloud Engine] ${posType} auf ${symbol} @ ${price}€ | Session: ${sessionInfo.name} | Mond: ${lunarInfo.name}`);
            broadcastState();
        }
    }
}

wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: globalState }));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            
            // NEU: Beim Reset bleiben deine Bot-Einstellungen (Start/Stop, Hebel etc.) erhalten!
            if (parsed.type === 'RESET_STATE') {
                const currentActive = globalState.agentActive;
                const currentLev = globalState.leverage;
                const currentMar = globalState.margin;
                const currentTp = globalState.tp;
                const currentSl = globalState.sl;
                
                globalState = getInitialState();
                
                globalState.agentActive = currentActive;
                globalState.leverage = currentLev;
                globalState.margin = currentMar;
                globalState.tp = currentTp;
                globalState.sl = currentSl;

                console.log(`[Server] Depot erfolgreich zurückgesetzt (Einstellungen beibehalten).`);
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
                return;
            }

            if (parsed.type === 'TX_UPDATE' && parsed.tx) {
                globalState.transactions.push(parsed.tx);
                if (parsed.tx.type === 'DEPOSIT') {
                    globalState.balance += parsed.tx.eur;
                } else if (parsed.tx.type === 'WITHDRAW') {
                    globalState.balance -= parsed.tx.eur;
                }
                console.log(`[Server] Manuelle Transaktion erfasst: ${parsed.tx.type} über ${parsed.tx.eur} €`);
                broadcastState();
                return;
            }
        } catch (e) {}
    });

    ws.on('close', () => clients.delete(ws));
});

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
server.listen(port, () => console.log(`[Server] 24/7 Cloud Bridge mit Setting-Memory läuft auf Port ${port}`));
