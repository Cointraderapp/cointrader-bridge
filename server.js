const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK - Cointrader 24/7 Engine (Multi-Profile + Trailing Stop)'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

const PROFILES = {
    SAVE: { id: 'SAVE', name: 'Top5-Save 🛡️', cvdThreshold: 80000, minRangePct: 0.40, leverage: 10, margin: 2000, tp: 0.50, sl: 0.60, timeoutSec: 75, cooldownSec: 30 },
    MEDIUM: { id: 'MEDIUM', name: 'Top5-Medium ⚖️', cvdThreshold: 40000, minRangePct: 0.20, leverage: 20, margin: 2000, tp: 0.60, sl: 0.80, timeoutSec: 90, cooldownSec: 20 },
    RISK: { id: 'RISK', name: 'Top5-Risk ⚡', cvdThreshold: 15000, minRangePct: 0.10, leverage: 50, margin: 2000, tp: 0.30, sl: 0.40, timeoutSec: 45, cooldownSec: 10 }
};

function getInitialState() {
    const defaultProfile = PROFILES.MEDIUM;
    return {
        profileId: 'MEDIUM',
        agentActive: true,
        leverage: defaultProfile.leverage,
        margin: defaultProfile.margin,
        tp: defaultProfile.tp,
        sl: defaultProfile.sl,
        balance: 20000,
        totalProfit: 0,
        tradesCount: 0,
        winCount: 0,
        inPosition: false,
        position: null,
        logs: [],
        transactions: [{
            id: Date.now(),
            type: 'DEPOSIT',
            eur: 20000,
            timestamp: Date.now(),
            entryPrice: 72700,
            note: 'Startkapital System'
        }],
        circuitBreakerActive: false,
        circuitBreakerUntil: 0
    };
}

let globalState = getInitialState();
let tradeCooldownUntil = 0;

const prices = { BTCEUR: 72700, ETHEUR: 2290, SOLEUR: 95.4, XRPEUR: 0.58, DOGEEUR: 0.12 };
const cvdEuro = { BTCEUR: 0, ETHEUR: 0, SOLEUR: 0, XRPEUR: 0, DOGEEUR: 0 };
const priceHistory = { BTCEUR: [], ETHEUR: [], SOLEUR: [], XRPEUR: [], DOGEEUR: [] };

function getSessionMultiplier() {
    const utcHour = new Date().getUTCHours();
    const isLondon = utcHour >= 7 && utcHour < 16;
    const isNY = utcHour >= 12 && utcHour < 21;

    if (isLondon && isNY) return { name: "LONDON+NY OVERLAP 🔥", multiplier: 0.85 };
    if (isLondon || isNY) return { name: "MAIN SESSION 📈", multiplier: 1.0 };
    return { name: "OFF-HOURS / ASIEN 🌙", multiplier: 1.3 };
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

function broadcastLog(message) {
    const timeStr = new Date().toLocaleTimeString('de-DE');
    const logItem = { time: timeStr, message: message };
    if (!globalState.logs) globalState.logs = [];
    globalState.logs.unshift(logItem);
    if (globalState.logs.length > 50) globalState.logs.pop();

    const payload = JSON.stringify({ type: 'LOG_EVENT', log: logItem });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
}

function processCloudTradingEngine(symbol, price, euroVolumeDelta) {
    prices[symbol] = price;
    cvdEuro[symbol] = Math.round(((cvdEuro[symbol] || 0) + euroVolumeDelta) * 0.985);
    const now = Date.now();

    if (!priceHistory[symbol]) priceHistory[symbol] = [];
    priceHistory[symbol].push(price);
    if (priceHistory[symbol].length > 60) priceHistory[symbol].shift();

    if (!globalState.agentActive) return;

    const currentProfile = PROFILES[globalState.profileId] || PROFILES.MEDIUM;

    let isChopMarket = true;
    let isBreakoutLong = false;
    let isBreakoutShort = false;

    if (priceHistory[symbol].length >= 20) {
        const maxP = Math.max(...priceHistory[symbol]);
        const minP = Math.min(...priceHistory[symbol]);
        const rangePct = ((maxP - minP) / price) * 100;
        
        if (rangePct >= currentProfile.minRangePct) {
            isChopMarket = false;
            if (price >= maxP * 0.9996) isBreakoutLong = true;
            if (price <= minP * 1.0004) isBreakoutShort = true;
        }
    }

    // 1. POSITION ÜBERWACHEN & TRAILING STOP
    if (globalState.inPosition && globalState.position) {
        const pos = globalState.position;
        if (symbol !== pos.symbol) return;

        let priceChangePct = ((price - pos.buyPrice) / pos.buyPrice) * 100;
        if (pos.type === 'SHORT') priceChangePct = -priceChangePct;

        // Trailing & Break-Even Berechnungen
        if (priceChangePct > pos.peakProfitPct) {
            pos.peakProfitPct = priceChangePct;
        }

        // Break-Even Trigger (+0.25% Profit erreicht -> Sichert +0.15%)
        if (pos.peakProfitPct >= 0.25 && !pos.breakEvenTriggered) {
            pos.breakEvenTriggered = true;
            pos.dynamicSLPct = -0.15; // Setzt SL ins Plus (Blau Linie)
            broadcastLog(`🛡️ <span class="text-indigo-400 font-bold">BREAK-EVEN:</span> SL auf +0.15% gesichert.`);
            broadcastState();
        }

        // Gleitender Trailing Stop (zieht nach oben mit)
        if (pos.breakEvenTriggered) {
            let targetSL = null;
            if (priceChangePct >= globalState.tp) {
                targetSL = priceChangePct - 0.15; // Wenn Ziel erreicht: SL extrem eng ranholen!
            } else if (priceChangePct >= 0.40) {
                targetSL = priceChangePct - 0.20; // Etwas Spielraum
            }

            // Updatet den SL nur, wenn der neue SL mind. 0.05% höher ist (verhindert Spam)
            if (targetSL !== null && targetSL > -pos.dynamicSLPct + 0.05) {
                pos.dynamicSLPct = -targetSL;
                broadcastLog(`🚀 <span class="text-emerald-400 font-bold">TRAILING STOP:</span> SL auf +${targetSL.toFixed(2)}% nachgezogen.`);
                broadcastState();
            }
        }

        const totalVol = globalState.margin * globalState.leverage;
        const grossProfit = totalVol * (priceChangePct / 100);
        const fee = totalVol * 0.0012;
        const netProfit = grossProfit - fee;

        const timeInTradeSec = Math.floor((now - pos.buyTime) / 1000);
        const currentCvd = cvdEuro[symbol] || 0;
        const hasMomentum = (pos.type === 'LONG' && currentCvd >= 10000) || (pos.type === 'SHORT' && currentCvd <= -10000);

        let timeoutTriggered = false;
        if (!hasMomentum && timeInTradeSec >= currentProfile.timeoutSec) {
            timeoutTriggered = true;
        }

        // EXIT CONDITION: Wir schließen NUR noch, wenn der Trailing SL getroffen wird oder Timeout!
        // Der harte "Take-Profit" ist entfernt. Der Trade läuft endlos nach oben weiter, bis er dreht!
        if (priceChangePct <= -pos.dynamicSLPct || timeoutTriggered) {
            globalState.inPosition = false;
            globalState.position = null;
            globalState.totalProfit += netProfit;
            globalState.balance += netProfit;
            globalState.tradesCount++;
            if (netProfit > 0) globalState.winCount++;

            tradeCooldownUntil = now + (currentProfile.cooldownSec * 1000);

            let exitReason = `☁️ ${currentProfile.name} ${symbol} ${pos.type}`;
            if (timeoutTriggered) exitReason = `⏱️ Momentum-Timeout (${currentProfile.timeoutSec}s)`;
            else if (pos.breakEvenTriggered) exitReason = `🛡️ Trailing/Break-Even Ausstieg`;

            const isWin = netProfit >= 0;
            const statusColor = isWin ? 'text-emerald-400' : 'text-rose-400';

            const newTx = {
                id: Date.now(),
                type: isWin ? 'PROFIT' : 'LOSS',
                eur: Math.abs(netProfit),
                timestamp: Date.now(),
                entryPrice: price,
                note: `${exitReason} (${isWin ? '+' : ''}${netProfit.toFixed(2)} € Netto)`
            };
            globalState.transactions.push(newTx);
            
            broadcastLog(`☁️ <span class="${statusColor} font-bold">${isWin ? '🎯 TAKE-PROFIT' : '🛑 STOP-LOSS / TIMEOUT'} (${symbol}):</span> Closed @ ${price.toFixed(4)} € | Netto: <span class="${statusColor}">${isWin ? '+' : ''}${netProfit.toFixed(2)} €</span>`);
            broadcastState();
        }
    } 
    // 2. NEUE POSITION ERÖFFNEN
    else if (!globalState.inPosition && !isChopMarket && now > tradeCooldownUntil && globalState.balance >= globalState.margin) {
        const sessionInfo = getSessionMultiplier();
        const currentCvd = cvdEuro[symbol] || 0;

        let requiredEuroCvd = currentProfile.cvdThreshold * sessionInfo.multiplier;
        let posType = currentCvd > 0 ? 'LONG' : 'SHORT';

        const isValidLong = posType === 'LONG' && isBreakoutLong;
        const isValidShort = posType === 'SHORT' && isBreakoutShort;

        if (Math.abs(currentCvd) >= requiredEuroCvd && (isValidLong || isValidShort)) {
            globalState.inPosition = true;
            globalState.position = {
                symbol: symbol,
                type: posType,
                buyPrice: price,
                buyTime: Date.now(),
                peakProfitPct: 0,
                dynamicSLPct: globalState.sl, // Startet mit dem roten, negativen SL aus dem Profil
                breakEvenTriggered: false
            };
            const icon = posType === 'LONG' ? '📈' : '📉';
            const color = posType === 'LONG' ? 'text-emerald-400' : 'text-rose-400';

            broadcastLog(`☁️ ${icon} <span class="${color} font-bold">${currentProfile.name} ORDER (${symbol} ${globalState.leverage}x):</span> ${posType} Einsatz ${globalState.margin}€ @ ${price.toFixed(4)} €`);
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
            if (parsed.type === 'SET_PROFILE' && parsed.profileId && PROFILES[parsed.profileId]) {
                const prof = PROFILES[parsed.profileId];
                globalState.profileId = parsed.profileId;
                globalState.leverage = prof.leverage;
                globalState.margin = prof.margin;
                globalState.tp = prof.tp;
                globalState.sl = prof.sl;
                broadcastLog(`⚙️ <span class="text-indigo-400 font-bold">PROFIL GEWECHSELT:</span> Aktiviert: ${prof.name} (${prof.leverage}x | CVD > ${prof.cvdThreshold.toLocaleString('de-DE')} €)`);
                broadcastState();
                return;
            }
            if (parsed.type === 'RESET_STATE') {
                const currentActive = globalState.agentActive;
                const currentProfile = globalState.profileId;
                globalState = getInitialState();
                globalState.agentActive = currentActive;
                globalState.profileId = currentProfile;
                broadcastLog(`🔄 <span class="text-indigo-400 font-bold">SYSTEM RESET:</span> Depot zurückgesetzt.`);
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
                if (parsed.tx.type === 'DEPOSIT') globalState.balance += parsed.tx.eur;
                else if (parsed.tx.type === 'WITHDRAW') globalState.balance -= parsed.tx.eur;
                broadcastLog(`💶 <span class="text-emerald-400 font-bold">DEPOSIT/WITHDRAW:</span> ${parsed.tx.type} über ${parsed.tx.eur} €.`);
                broadcastState();
                return;
            }
        } catch (e) {}
    });
    ws.on('close', () => clients.delete(ws));
});

function connectBinanceStream() {
    const binanceWs = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade/ethusdt@aggTrade/solusdt@aggTrade/xrpusdt@aggTrade/dogeusdt@aggTrade');
    binanceWs.on('message', (data) => {
        try {
            const tick = JSON.parse(data);
            const symbolMap = { 'BTCUSDT': 'BTCEUR', 'ETHUSDT': 'ETHEUR', 'SOLUSDT': 'SOLEUR', 'XRPUSDT': 'XRPEUR', 'DOGEUSDT': 'DOGEEUR' };
            const symbol = symbolMap[tick.s];
            if (symbol) {
                const price = parseFloat(tick.p) * 0.92;
                const quantity = parseFloat(tick.q);
                const euroVolume = quantity * price;
                const euroDelta = tick.m ? -euroVolume : euroVolume;
                processCloudTradingEngine(symbol, price, euroDelta);
                broadcastTick(tick);
            }
        } catch (e) {}
    });
    binanceWs.on('close', () => setTimeout(connectBinanceStream, 3000));
    binanceWs.on('error', () => binanceWs.close());
}

connectBinanceStream();
server.listen(port, () => console.log(`[Server] Multi-Profile Engine aktiv auf Port ${port}`));
