const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK - Cointrader 24/7 Engine v6.3 Institutional Quantum AI Edition'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();

// 1. STRATEGIE-PROFILE INKL. 4. MODUS "QUANTUM-KI (AUTO_KI)"
const PROFILES = {
    AUTO_KI: { id: 'AUTO_KI', name: 'Quantum-KI 🤖', isDynamic: true },
    SAVE: { id: 'SAVE', name: 'Top5-Save 🛡️', cvdThreshold: 80000, minRangePct: 0.40, leverage: 10, margin: 2000, tp: 0.50, sl: 0.60, timeoutSec: 75, cooldownSec: 30, use5MinTrend: true },
    MEDIUM: { id: 'MEDIUM', name: 'Top5-Medium ⚖️', cvdThreshold: 40000, minRangePct: 0.20, leverage: 20, margin: 2000, tp: 0.60, sl: 0.80, timeoutSec: 90, cooldownSec: 20, use5MinTrend: true },
    RISK: { id: 'RISK', name: 'Top5-Risk ⚡', cvdThreshold: 15000, minRangePct: 0.10, leverage: 50, margin: 2000, tp: 0.30, sl: 0.40, timeoutSec: 45, cooldownSec: 10, use5MinTrend: false }
};

// 2. KI-GEDÄCHTNIS & LERN-STATE (REINFORCEMENT LEARNING AGENT)
let aiState = {
    confidence: 50,            // 0% bis 100% Score
    consecutiveLosses: 0,
    consecutiveWins: 0,
    marketAggressiveness: 1.0  // Multiplikator für Schwellen/Pausen
};

// FEEDBACK-LOOP LERNFUNKTION (TRAINING NACH JEDEM TRADE)
function trainAgentAfterTrade(netProfit) {
    if (netProfit > 0) {
        // BELOHNUNG (REWARD)
        aiState.consecutiveWins++;
        aiState.consecutiveLosses = 0;
        aiState.confidence = Math.min(100, aiState.confidence + 5);
        aiState.marketAggressiveness = Math.max(0.5, aiState.marketAggressiveness - 0.1);
        broadcastLog(`🧠 <span class="text-emerald-400 font-bold">KI-BELOHNUNG (+5%):</span> Win-Streak ${aiState.consecutiveWins}x | confidence: ${aiState.confidence}%`);
    } else {
        // BESTRAFUNG (PAIN)
        aiState.consecutiveLosses++;
        aiState.consecutiveWins = 0;
        aiState.confidence = Math.max(0, aiState.confidence - 15);
        aiState.marketAggressiveness = Math.min(3.0, aiState.marketAggressiveness + 0.5);
        broadcastLog(`🚨 <span class="text-rose-400 font-bold">KI-BESTRAFUNG (-15%):</span> Defensive Haltung aktiviert | confidence: ${aiState.confidence}%`);
    }
}

// DYNAMISCHE PARAMETER-GENERIERUNG FÜR DAS KI-PROFIL
function generateDynamicAiProfile() {
    // Dynamic Leverage (5x bei Mutlosigkeit, bis zu 50x bei Hoher Confidence)
    let dynamicLeverage = Math.max(5, Math.floor((aiState.confidence / 100) * 50));
    
    // CVD-Hürde: Je höher die Aggressivität/Angst, desto höher die Schwelle
    let baseCvd = 60000; 
    let dynamicCvd = Math.round(baseCvd * aiState.marketAggressiveness);

    return {
        id: 'AUTO_KI',
        name: `Quantum-KI (${aiState.confidence}% Conf)`,
        cvdThreshold: dynamicCvd,
        minRangePct: 0.15,
        leverage: dynamicLeverage,
        margin: 2000,
        tp: parseFloat((0.50 + (aiState.confidence / 100) * 0.30).toFixed(2)), // TP weiter weg bei hohem Confidence
        sl: parseFloat((0.80 - (aiState.confidence / 100) * 0.40).toFixed(2)), // SL enger bei hohem Confidence
        timeoutSec: 90,
        cooldownSec: Math.round(15 * aiState.marketAggressiveness),
        use5MinTrend: true,
        isDynamic: true
    };
}

function getActiveProfile() {
    if (globalState.profileId === 'AUTO_KI') {
        return generateDynamicAiProfile();
    }
    return PROFILES[globalState.profileId] || PROFILES.MEDIUM;
}

function getInitialState() {
    const defaultProfile = generateDynamicAiProfile();
    return {
        profileId: 'AUTO_KI',
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
        aiState: aiState,
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
let consecutiveLosses = 0;

const prices = { BTCEUR: 72700, ETHEUR: 2290, SOLEUR: 95.4, XRPEUR: 0.58, DOGEEUR: 0.12 };
const cvdEuro = { BTCEUR: 0, ETHEUR: 0, SOLEUR: 0, XRPEUR: 0, DOGEEUR: 0 };
const priceHistory = { BTCEUR: [], ETHEUR: [], SOLEUR: [], XRPEUR: [], DOGEEUR: [] };
const whaleSpikes = { BTCEUR: 0, ETHEUR: 0, SOLEUR: 0, XRPEUR: 0, DOGEEUR: 0 };

const vwapData = {
    BTCEUR: { sumVP: 0, sumVol: 0 },
    ETHEUR: { sumVP: 0, sumVol: 0 },
    SOLEUR: { sumVP: 0, sumVol: 0 },
    XRPEUR: { sumVP: 0, sumVol: 0 },
    DOGEEUR: { sumVP: 0, sumVol: 0 }
};

function getVWAP(symbol, price, euroVolume) {
    const data = vwapData[symbol] || { sumVP: 0, sumVol: 0 };
    data.sumVP = (data.sumVP * 0.99) + (price * euroVolume);
    data.sumVol = (data.sumVol * 0.99) + euroVolume;
    vwapData[symbol] = data;
    return data.sumVol > 0 ? (data.sumVP / data.sumVol) : price;
}

function check5MinTrend(symbol, currentPrice, type, profile) {
    if (!profile.use5MinTrend) return true;

    const history = priceHistory[symbol];
    if (!history || history.length < 30) return true;

    const sampleSize = Math.min(20, Math.floor(history.length / 3));
    const oldPriceAvg = history.slice(0, sampleSize).reduce((a, b) => a + b, 0) / sampleSize;

    if (type === 'LONG') return currentPrice > oldPriceAvg;
    if (type === 'SHORT') return currentPrice < oldPriceAvg;
    return true;
}

function getSessionMultiplier() {
    const utcHour = new Date().getUTCHours();
    const isLondon = utcHour >= 7 && utcHour < 16;
    const isNY = utcHour >= 12 && utcHour < 21;

    if (isLondon && isNY) return { name: "LONDON+NY OVERLAP 🔥", multiplier: 0.85 };
    if (isLondon || isNY) return { name: "MAIN SESSION 📈", multiplier: 1.0 };
    return { name: "OFF-HOURS / ASIEN 🌙", multiplier: 1.3 };
}

function broadcastState() {
    globalState.aiState = aiState;
    if (globalState.profileId === 'AUTO_KI') {
        const dynProf = generateDynamicAiProfile();
        globalState.leverage = dynProf.leverage;
        globalState.tp = dynProf.tp;
        globalState.sl = dynProf.sl;
    }
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

// 3. TRADING ENGINE KERN MIT DYNAMISCHER KI-STEUERUNG
function processCloudTradingEngine(symbol, price, euroVolumeDelta, euroVolume) {
    prices[symbol] = price;
    cvdEuro[symbol] = Math.round(((cvdEuro[symbol] || 0) + euroVolumeDelta) * 0.985);
    const now = Date.now();

    if (!priceHistory[symbol]) priceHistory[symbol] = [];
    priceHistory[symbol].push(price);
    if (priceHistory[symbol].length > 180) priceHistory[symbol].shift();

    if (!globalState.agentActive) return;

    // ABRUFEN DES AKTIVEN PROFILO (STATISCH ODER DYNAMISCH ERRECHNET)
    const currentProfile = getActiveProfile();

    let isChopMarket = true;
    let isBreakoutLong = false;
    let isBreakoutShort = false;

    if (priceHistory[symbol].length >= 20) {
        const maxP = Math.max(...priceHistory[symbol].slice(-60));
        const minP = Math.min(...priceHistory[symbol].slice(-60));
        const rangePct = ((maxP - minP) / price) * 100;
        
        if (rangePct >= currentProfile.minRangePct) {
            isChopMarket = false;
            if (price >= maxP * 0.9996) isBreakoutLong = true;
            if (price <= minP * 1.0004) isBreakoutShort = true;
        }
    }

    // POSITION ÜBERWACHEN & OPEN-END TRAILING STOP
    if (globalState.inPosition && globalState.position) {
        const pos = globalState.position;
        if (symbol !== pos.symbol) return;

        let priceChangePct = ((price - pos.buyPrice) / pos.buyPrice) * 100;
        if (pos.type === 'SHORT') priceChangePct = -priceChangePct;

        if (priceChangePct > pos.peakProfitPct) {
            pos.peakProfitPct = priceChangePct;
        }

        // Break-Even Trigger
        if (pos.peakProfitPct >= 0.25 && !pos.breakEvenTriggered) {
            pos.breakEvenTriggered = true;
            pos.dynamicSLPct = -0.15;
            broadcastLog(`🛡️ <span class="text-indigo-400 font-bold">BREAK-EVEN:</span> SL auf +0.15% gesichert.`);
            broadcastState();
        }

        // Dynamisches Trailing
        if (pos.breakEvenTriggered) {
            let targetSL = null;
            if (priceChangePct >= currentProfile.tp) {
                targetSL = priceChangePct - 0.15;
            } else if (priceChangePct >= 0.40) {
                targetSL = priceChangePct - 0.20;
            }

            if (targetSL !== null && targetSL > -pos.dynamicSLPct + 0.05) {
                pos.dynamicSLPct = -targetSL;
                broadcastLog(`🚀 <span class="text-emerald-400 font-bold">TRAILING STOP:</span> SL auf +${targetSL.toFixed(2)}% nachgezogen.`);
                broadcastState();
            }
        }

        const totalVol = currentProfile.margin * currentProfile.leverage;
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

        if (priceChangePct <= -pos.dynamicSLPct || timeoutTriggered) {
            globalState.inPosition = false;
            globalState.position = null;
            globalState.totalProfit += netProfit;
            globalState.balance += netProfit;
            globalState.tradesCount++;
            
            const isWin = netProfit >= 0;
            if (isWin) {
                globalState.winCount++;
                consecutiveLosses = 0;
            } else {
                consecutiveLosses++;
                if (consecutiveLosses >= 2) {
                    broadcastLog(`⚠️ <span class="text-amber-400 font-bold">ANTI-WHIPSAW:</span> ${consecutiveLosses} Verluste in Folge.`);
                }
            }

            // KI-LERNLOGIK TRITT BEI AUTO_KI EIN
            if (globalState.profileId === 'AUTO_KI') {
                trainAgentAfterTrade(netProfit);
            }

            tradeCooldownUntil = now + (currentProfile.cooldownSec * 1000 * (consecutiveLosses >= 2 ? 2 : 1));

            let exitReason = `🤖 ${currentProfile.name} ${symbol} ${pos.type}`;
            if (timeoutTriggered) exitReason = `⏱️ Momentum-Timeout (${currentProfile.timeoutSec}s)`;
            else if (pos.breakEvenTriggered) exitReason = `🛡️ Trailing/Break-Even Ausstieg`;

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
            
            broadcastLog(`🤖 <span class="${statusColor} font-bold">${isWin ? '🎯 TAKE-PROFIT' : '🛑 STOP-LOSS / TIMEOUT'} (${symbol}):</span> Closed @ ${price.toFixed(4)} € | Netto: <span class="${statusColor}">${isWin ? '+' : ''}${netProfit.toFixed(2)} €</span>`);
            broadcastState();
        }
    } 
    // NEUE POSITION ERÖFFNEN
    else if (!globalState.inPosition && !isChopMarket && now > tradeCooldownUntil && globalState.balance >= currentProfile.margin) {
        const sessionInfo = getSessionMultiplier();
        const currentCvd = cvdEuro[symbol] || 0;

        let requiredEuroCvd = currentProfile.cvdThreshold * sessionInfo.multiplier;
        
        // Whale Sweep Boost (-30% Schwelle bei Wal-Aktivität)
        if (now < whaleSpikes[symbol]) {
            requiredEuroCvd *= 0.70;
        }

        // Anti-Whipsaw Strafe (+80% Schwelle bei Pechsträhne)
        if (consecutiveLosses >= 2) {
            requiredEuroCvd *= 1.80;
        }

        let posType = currentCvd > 0 ? 'LONG' : 'SHORT';

        const isValidLong = posType === 'LONG' && isBreakoutLong;
        const isValidShort = posType === 'SHORT' && isBreakoutShort;
        
        const isTrendAligned = check5MinTrend(symbol, price, posType, currentProfile);

        const currentVWAP = getVWAP(symbol, price, euroVolume);
        const vwapDiffPct = ((price - currentVWAP) / currentVWAP) * 100;
        const isOverextendedLong = posType === 'LONG' && vwapDiffPct > 0.80;
        const isOverextendedShort = posType === 'SHORT' && vwapDiffPct < -0.80;

        if (Math.abs(currentCvd) >= requiredEuroCvd && (isValidLong || isValidShort) && isTrendAligned && !isOverextendedLong && !isOverextendedShort) {
            globalState.inPosition = true;
            globalState.position = {
                symbol: symbol,
                type: posType,
                buyPrice: price,
                buyTime: Date.now(),
                peakProfitPct: 0,
                dynamicSLPct: currentProfile.sl,
                breakEvenTriggered: false
            };
            const icon = posType === 'LONG' ? '📈' : '📉';
            const color = posType === 'LONG' ? 'text-emerald-400' : 'text-rose-400';

            broadcastLog(`🤖 ${icon} <span class="${color} font-bold">${currentProfile.name} ORDER (${symbol} ${currentProfile.leverage}x):</span> ${posType} Einsatz ${currentProfile.margin}€ @ ${price.toFixed(4)} €`);
            broadcastState();
        }
    }
}

// 4. WEBSOCKET CLIENT HANDLER
wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'STATE_UPDATE', state: globalState }));

    ws.on('message', (message) => {
        try {
            const parsed = JSON.parse(message);
            if (parsed.type === 'SET_PROFILE' && parsed.profileId && PROFILES[parsed.profileId]) {
                globalState.profileId = parsed.profileId;
                const activeProf = getActiveProfile();
                globalState.leverage = activeProf.leverage;
                globalState.margin = activeProf.margin;
                globalState.tp = activeProf.tp;
                globalState.sl = activeProf.sl;
                broadcastLog(`⚙️ <span class="text-indigo-400 font-bold">PROFIL GEWECHSELT:</span> ${activeProf.name}`);
                broadcastState();
                return;
            }
            if (parsed.type === 'RESET_STATE') {
                const currentActive = globalState.agentActive;
                const currentProfile = globalState.profileId;
                globalState = getInitialState();
                globalState.agentActive = currentActive;
                globalState.profileId = currentProfile;
                consecutiveLosses = 0;
                broadcastLog(`🔄 <span class="text-indigo-400 font-bold">SYSTEM RESET:</span> Depot zurückgesetzt.`);
                broadcastState();
                return;
            }
            if (parsed.type === 'PARAM_UPDATE' && parsed.data) {
                if (parsed.data.leverage !== undefined && globalState.profileId !== 'AUTO_KI') globalState.leverage = parsed.data.leverage;
                if (parsed.data.margin !== undefined) globalState.margin = parsed.data.margin;
                if (parsed.data.tp !== undefined && globalState.profileId !== 'AUTO_KI') globalState.tp = parsed.data.tp;
                if (parsed.data.sl !== undefined && globalState.profileId !== 'AUTO_KI') globalState.sl = parsed.data.sl;
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

// 5. BINANCE STREAM INTEGRATION
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

                if (euroVolume >= 100000) {
                    whaleSpikes[symbol] = Date.now() + 5000;
                    broadcastLog(`🐳 <span class="text-cyan-400 font-bold">WHALE SWEEP (${symbol}):</span> Einzelorder über ${Math.round(euroVolume).toLocaleString('de-DE')} € registriert!`);
                }

                processCloudTradingEngine(symbol, price, euroDelta, euroVolume);
                broadcastTick(tick);
            }
        } catch (e) {}
    });
    binanceWs.on('close', () => setTimeout(connectBinanceStream, 3000));
    binanceWs.on('error', () => binanceWs.close());
}

// 6. SHUTDOWN HANDLER
function handleShutdown(signal) {
    console.log(`[Server] ${signal} empfangen: Status bleibt erhalten.`);
    const payload = JSON.stringify({ 
        type: 'LOG_EVENT', 
        log: { time: new Date().toLocaleTimeString('de-DE'), message: '🔄 <span class="text-amber-400 font-bold">CLOUD NEUSTART:</span> Render führt Server-Sync durch.' } 
    });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
    setTimeout(() => { process.exit(0); }, 1000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

connectBinanceStream();
server.listen(port, () => console.log(`[Server] Multi-Profile Quantum AI Engine v6.3 aktiv auf Port ${port}`));
