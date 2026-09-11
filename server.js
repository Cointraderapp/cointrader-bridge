const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('OK - Cointrader 24/7 Engine v6.3 Institutional Telemetry & Quantum AI Edition'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const clients = new Set();
const AI_MEMORY_FILE = './ai_memory.json';

// 1. STRATEGIE-PROFILE
const PROFILES = {
    AUTO_KI: { id: 'AUTO_KI', name: 'Quantum-KI 🤖', isDynamic: true },
    SAVE: { id: 'SAVE', name: 'Top5-Save 🛡️', cvdThreshold: 80000, minRangePct: 0.40, leverage: 10, margin: 2000, tp: 0.50, sl: 0.60, timeoutSec: 75, cooldownSec: 30, use5MinTrend: true },
    MEDIUM: { id: 'MEDIUM', name: 'Top5-Medium ⚖️', cvdThreshold: 40000, minRangePct: 0.20, leverage: 20, margin: 2000, tp: 0.60, sl: 0.80, timeoutSec: 90, cooldownSec: 20, use5MinTrend: true },
    RISK: { id: 'RISK', name: 'Top5-Risk ⚡', cvdThreshold: 15000, minRangePct: 0.10, leverage: 50, margin: 2000, tp: 0.30, sl: 0.40, timeoutSec: 45, cooldownSec: 10, use5MinTrend: false }
};

// 2. LIVE TELEMETRIE, SQUEEZE & MAKRO MATRIX STATE
let telemetryState = {
    mempoolGwei: 32,
    ethNetflow: -1814,
    orderbookImbalancePct: 14.92,
    fearAndGreed: 28,
    openInterestChangePct: 2.1,
    socialVelocitySpike: 1.3,
    solarGeomagneticKp: 2.8,
    tideGravitationalVector: 0.82,
    fundingRatePct: 0.015,         // Squeeze-Radar
    simulatedSpreadPct: 0.012      // Spread-Expansion Guard
};

let macroMatrixState = {
    dxyIndex: 104.20,
    dxyChangePct: -0.06,
    nasdaq100ChangePct: 0.84,
    sp500ChangePct: 0.28,
    goldChangePct: 0.15
};

// 3. KI-GEDÄCHTNIS (REINFORCEMENT LEARNING & MAE/MFE ANALYTICS)
let aiState = {
    confidence: 50,
    consecutiveLosses: 0,
    consecutiveWins: 0,
    marketAggressiveness: 1.0,
    maeHistory: [],                // Maximum Adverse Excursion Historie
    avgWinMae: 0.42                // Durschnittlicher Maximalrücksetzer erfolgreicher Trades
};

// GLOBAL STATE REFERENZ VORAB DECLARIEREN (STARTUP-CRASH-PROTECTION)
let globalState = null;

function calculateHolisticPrognosisScore() {
    let score = 50;

    if (macroMatrixState.dxyChangePct < 0) score += 10;
    if (macroMatrixState.nasdaq100ChangePct > 0) score += 15;
    if (macroMatrixState.sp500ChangePct > 0) score += 10;
    if (macroMatrixState.goldChangePct > 0) score += 5;

    if (telemetryState.ethNetflow < 0) score += 5;
    if (telemetryState.orderbookImbalancePct > 0) score += 5;

    let aiFactor = (aiState.confidence - 50) * 0.3;
    score += aiFactor;

    return Math.min(98, Math.max(2, Math.round(score)));
}

function loadAiMemory() {
    try {
        if (fs.existsSync(AI_MEMORY_FILE)) {
            const data = fs.readFileSync(AI_MEMORY_FILE, 'utf8');
            const savedState = JSON.parse(data);
            if (savedState.aiState) {
                aiState = Object.assign(aiState, savedState.aiState);
                console.log(`[KI-Gedächtnis] Geladen. Conf: ${aiState.confidence}%, MAE-Avg: ${aiState.avgWinMae}%`);
            }
        }
    } catch (e) {
        console.error('⚠️ [KI-Gedächtnis] Fehler beim Laden:', e);
    }
}

function saveAiMemory() {
    try {
        fs.writeFileSync(AI_MEMORY_FILE, JSON.stringify({ aiState, updatedAt: Date.now() }, null, 2));
    } catch (e) {
        console.error('⚠️ [KI-Gedächtnis] Fehler beim Speichern:', e);
    }
}

// INSTITUTIONELLES KELLY-KRITERIUM FÜR DYNAMISCHE POSITIONSGRÖSSEN (BIS ZU 25% DER EINLAGEN)
function calculateKellyMargin() {
    const currentBalance = (globalState && globalState.balance) ? globalState.balance : 20000;
    const tradesCount = (globalState && globalState.tradesCount) ? globalState.tradesCount : 0;
    const winCount = (globalState && globalState.winCount) ? globalState.winCount : 0;
    
    // Obergrenze = exakt 25% des aktuellen Depotguthabens
    const maxAllowedMargin = Math.round(currentBalance * 0.25); 

    let p = tradesCount >= 3 ? (winCount / tradesCount) : 0.60;
    p = Math.max(0.25, Math.min(0.90, p));

    const tpRatio = (aiState.confidence / 100) * 0.30 + 0.50;
    const slRatio = Math.max(0.2, aiState.avgWinMae * 1.2);
    const b = tpRatio / slRatio; // Risk/Reward Ratio

    let kellyFraction = (p * b - (1 - p)) / b;

    let dynamicMaxFraction = Math.max(0.025, (aiState.confidence / 100) * 0.25);
    let targetFraction = Math.max(0.025, Math.min(dynamicMaxFraction, kellyFraction));

    if (aiState.confidence >= 80 && aiState.consecutiveWins >= 1) {
        targetFraction = Math.min(0.25, targetFraction * 1.4);
    }

    const calculatedMargin = Math.round(currentBalance * targetFraction);
    return Math.max(500, Math.min(maxAllowedMargin, calculatedMargin));
}

function trainAgentAfterTrade(netProfit, tradeMae) {
    if (netProfit > 0) {
        aiState.consecutiveWins++;
        aiState.consecutiveLosses = 0;
        aiState.confidence = Math.min(100, aiState.confidence + 6);
        aiState.marketAggressiveness = Math.max(0.6, aiState.marketAggressiveness - 0.1);
        
        if (tradeMae !== undefined && tradeMae < 0) {
            const winMae = Math.abs(tradeMae);
            aiState.maeHistory.push(winMae);
            if (aiState.maeHistory.length > 25) aiState.maeHistory.shift();
            aiState.avgWinMae = parseFloat((aiState.maeHistory.reduce((a, b) => a + b, 0) / aiState.maeHistory.length).toFixed(2));
        }

        broadcastLog(`🧠 <span class="text-emerald-400 font-bold">KI-BELOHNUNG (+6%):</span> Win-Streak ${aiState.consecutiveWins}x | Conf: ${aiState.confidence}% | MAE-Avg: ${aiState.avgWinMae}%`);
    } else {
        aiState.consecutiveLosses++;
        aiState.consecutiveWins = 0;
        aiState.confidence = Math.max(15, aiState.confidence - 8);
        aiState.marketAggressiveness = Math.min(1.8, aiState.marketAggressiveness + 0.25);
        broadcastLog(`🚨 <span class="text-rose-400 font-bold">KI-BESTRAFUNG (-8%):</span> Korrektur-Modus | Conf: ${aiState.confidence}%`);
    }
    saveAiMemory();
}

function generateDynamicAiProfile() {
    let dynamicLeverage = Math.max(5, Math.floor((aiState.confidence / 100) * 50));
    let baseCvd = 35000;
    let dynamicCvd = Math.round(baseCvd * aiState.marketAggressiveness);
    let kellyMargin = calculateKellyMargin();

    let adaptiveSl = Math.max(0.35, Math.min(1.10, aiState.avgWinMae * 1.25));
    // DYNAMISCH ERHÖHTE MIN-RANGE UM EINSCHLAF-MÄRKTE UND TIMEOUT-FEHLER ZU FILTERN
    let adaptiveMinRange = parseFloat(Math.max(0.18, 0.12 * aiState.marketAggressiveness).toFixed(2));

    return {
        id: 'AUTO_KI',
        name: `Quantum-KI (${aiState.confidence}% Conf)`,
        cvdThreshold: dynamicCvd,
        minRangePct: adaptiveMinRange,
        leverage: dynamicLeverage,
        margin: kellyMargin,
        tp: parseFloat((0.50 + (aiState.confidence / 100) * 0.30).toFixed(2)),
        sl: parseFloat(adaptiveSl.toFixed(2)),
        timeoutSec: 90,
        cooldownSec: Math.round(10 * aiState.marketAggressiveness),
        use5MinTrend: true,
        isDynamic: true
    };
}

function getActiveProfile() {
    if (globalState && globalState.profileId === 'AUTO_KI') {
        return generateDynamicAiProfile();
    }
    return PROFILES[(globalState && globalState.profileId) ? globalState.profileId : 'AUTO_KI'] || PROFILES.MEDIUM;
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
        dailyStartBalance: 20000,
        dailyPnL: 0,
        dailyHardLockActive: false,
        dailyLossLimitPct: 0.10,
        tradesCount: 0,
        winCount: 0,
        inPosition: false,
        position: null,
        logs: [],
        aiState: aiState,
        telemetry: telemetryState,
        macroMatrix: macroMatrixState,
        prognosisScore: calculateHolisticPrognosisScore(),
        transactions: [{
            id: Date.now(),
            type: 'DEPOSIT',
            eur: 20000,
            timestamp: Date.now(),
            entryPrice: 72700,
            note: 'Startkapital System'
        }]
    };
}

loadAiMemory();
globalState = getInitialState();

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

// 4. INSTITUTIONELLE SCHUTZ-GATEKEEPER & SENSORDETEKTOREN

function detectIcebergAbsorption(symbol, currentPrice) {
    const history = priceHistory[symbol];
    if (!history || history.length < 15) return false;

    const absCvd = Math.abs(cvdEuro[symbol] || 0);
    const priceRangePct = (Math.abs(currentPrice - history[history.length - 15]) / currentPrice) * 100;

    if (absCvd > 28000 && priceRangePct < 0.025) {
        broadcastLog(`🧊 <span class="text-cyan-300 font-bold">ICEBERG-RADAR (${symbol}):</span> Limit-Wand absorbiert CVD (${absCvd.toLocaleString('de-DE')} €). Trade blockiert.`);
        return true;
    }
    return false;
}

function isNewsBlackoutActive() {
    const now = new Date();
    const utcMin = now.getUTCMinutes();
    const utcHour = now.getUTCHours();
    
    const isEventHour = [13, 14, 18, 19].includes(utcHour);
    if (isEventHour && (utcMin >= 27 && utcMin <= 33)) {
        return true;
    }
    return false;
}

function evaluateStrictTelemetryGates(symbol, posType) {
    if (isNewsBlackoutActive()) {
        broadcastLog(`📰 <span class="text-amber-400 font-bold">NEWS-LOCKOUT:</span> Makro-Event Fenster aktiv. Keine Ordereingabe.`);
        return false;
    }

    if (detectIcebergAbsorption(symbol, prices[symbol] || 100)) {
        return false;
    }

    // VOLATILITÄTS- & TOTMANN-FILTER (Sperrt Einstiege in leblosen Seitwärtsphasen)
    const history = priceHistory[symbol];
    if (history && history.length >= 24) {
        const recentSlice = history.slice(-24); // Letzte 2 Min (bei 5s Ticks)
        const maxP = Math.max(...recentSlice);
        const minP = Math.min(...recentSlice);
        const currentP = prices[symbol] || maxP;
        const twoMinVolaPct = ((maxP - minP) / currentP) * 100;

        if (twoMinVolaPct < 0.12) {
            broadcastLog(`💤 <span class="text-slate-400 font-bold">VOLATILITÄTS-BLOCK (${symbol}):</span> Markt zu träge (Range: ${twoMinVolaPct.toFixed(2)}%). Timeout-Gefahr.`);
            return false;
        }
    }

    if (telemetryState.simulatedSpreadPct > 0.045) {
        broadcastLog(`⚡ <span class="text-rose-400 font-bold">SPREAD GUARD (${symbol}):</span> Liquidität dünn (Spread ${telemetryState.simulatedSpreadPct.toFixed(3)}%). Trade abgebrochen.`);
        return false;
    }

    if (posType === 'LONG' && telemetryState.fundingRatePct > 0.05) {
        broadcastLog(`🔥 <span class="text-rose-400 font-bold">SQUEEZE-RADAR (${symbol}):</span> Longs überhitzt (Funding Rate ${telemetryState.fundingRatePct}%). Long geblockt.`);
        return false;
    }

    if (telemetryState.mempoolGwei > 85) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Mempool Gas zu hoch (${telemetryState.mempoolGwei} Gwei).`);
        return false;
    }
    if (posType === 'LONG' && telemetryState.ethNetflow > 1200) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Inflow-Spike (+${telemetryState.ethNetflow} ETH).`);
        return false;
    }
    if (posType === 'SHORT' && telemetryState.ethNetflow < -3000) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Starke Akkumulation (-${Math.abs(telemetryState.ethNetflow)} ETH).`);
        return false;
    }
    if (posType === 'LONG' && telemetryState.orderbookImbalancePct < -12.0) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Starke Asks-Übermacht im Buch (${telemetryState.orderbookImbalancePct}%).`);
        return false;
    }
    if (posType === 'SHORT' && telemetryState.orderbookImbalancePct > 12.0) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Starke Bids-Übermacht im Buch (${telemetryState.orderbookImbalancePct}%).`);
        return false;
    }
    if (posType === 'LONG' && telemetryState.fearAndGreed > 85) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Extreme Gier (${telemetryState.fearAndGreed}). Top-Schutz.`);
        return false;
    }
    if (posType === 'SHORT' && telemetryState.fearAndGreed < 15) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Extreme Angst (${telemetryState.fearAndGreed}). Boden-Schutz.`);
        return false;
    }
    if (telemetryState.solarGeomagneticKp >= 6.5) {
        broadcastLog(`🛰️ <span class="text-rose-400 font-bold">TELEMETRIE-BLOCK (${symbol}):</span> Solarer Sturm (Kp ${telemetryState.solarGeomagneticKp}).`);
        return false;
    }
    return true;
}

function checkDailyReset() {
    const now = new Date();
    if (now.getUTCHours() === 0 && now.getUTCMinutes() === 0 && now.getUTCSeconds() < 5) {
        if (globalState.dailyHardLockActive || globalState.dailyPnL !== 0) {
            globalState.dailyStartBalance = globalState.balance;
            globalState.dailyPnL = 0;
            globalState.dailyHardLockActive = false;
            broadcastLog(`🌅 <span class="text-cyan-400 font-bold">TAGES-RESET (00:00 UTC):</span> Daily Limit erneuert. Startkapital: ${globalState.balance.toFixed(2)} €`);
            broadcastState();
        }
    }
}
setInterval(checkDailyReset, 4000);

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
    return { name: "OFF-HOURS / ASIEN 🌙", multiplier: 1.2 };
}

function broadcastState() {
    globalState.aiState = aiState;
    globalState.telemetry = telemetryState;
    globalState.macroMatrix = macroMatrixState;
    globalState.prognosisScore = calculateHolisticPrognosisScore();

    if (globalState.profileId === 'AUTO_KI') {
        const dynProf = generateDynamicAiProfile();
        globalState.leverage = dynProf.leverage;
        globalState.margin = dynProf.margin;
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

// 5. TRADING ENGINE KERN WITH ANTI-STOP-HUNT & PARABOLIC TRAILING ENGINE
function processCloudTradingEngine(symbol, price, euroVolumeDelta, euroVolume) {
    prices[symbol] = price;
    cvdEuro[symbol] = Math.round(((cvdEuro[symbol] || 0) + euroVolumeDelta) * 0.985);
    const now = Date.now();

    if (!priceHistory[symbol]) priceHistory[symbol] = [];
    priceHistory[symbol].push(price);
    if (priceHistory[symbol].length > 180) priceHistory[symbol].shift();

    if (!globalState.agentActive) return;

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

    if (globalState.inPosition && globalState.position) {
        const pos = globalState.position;
        if (symbol !== pos.symbol) return;

        let priceChangePct = ((price - pos.buyPrice) / pos.buyPrice) * 100;
        if (pos.type === 'SHORT') priceChangePct = -priceChangePct;

        if (priceChangePct > pos.peakProfitPct) {
            pos.peakProfitPct = priceChangePct;
        }

        if (priceChangePct < (pos.mae || 0)) {
            pos.mae = priceChangePct;
        }

        const currentCvd = cvdEuro[symbol] || 0;

        // Break-Even Trigger bei +0.25%
        if (pos.peakProfitPct >= 0.25 && !pos.breakEvenTriggered) {
            pos.breakEvenTriggered = true;
            pos.dynamicSLPct = -0.15;
            broadcastLog(`🛡️ <span class="text-indigo-400 font-bold">BREAK-EVEN:</span> SL auf +0.15% gesichert.`);
            broadcastState();
        }

        // Parabolisches Trailing & Blow-Off Top Lock im Plus
        if (pos.breakEvenTriggered) {
            let trailingDistance = 0.15;
            if (priceChangePct >= 2.00) trailingDistance = 0.45;
            else if (priceChangePct >= 1.00) trailingDistance = 0.30;
            else if (priceChangePct >= 0.50) trailingDistance = 0.20;

            const isCvdReversing = (pos.type === 'LONG' && currentCvd < 0) || (pos.type === 'SHORT' && currentCvd > 0);
            if (priceChangePct >= 0.70 && isCvdReversing) trailingDistance = 0.08;

            let targetSL = priceChangePct - trailingDistance;

            if (targetSL > -pos.dynamicSLPct + 0.03) {
                pos.dynamicSLPct = -targetSL;
                broadcastLog(`🚀 <span class="text-emerald-400 font-bold">PARABOLIC TRAILING:</span> Peak +${priceChangePct.toFixed(2)}% | SL +${targetSL.toFixed(2)}% (Abstand: ${trailingDistance.toFixed(2)}%)`);
                broadcastState();
            }
        }

        // V-SHAPE ERHOLUNGS-DETEKTOR (Anti-Stop-Hunt Logik)
        const history = priceHistory[symbol] || [];
        const lastPrice = history.length >= 2 ? history[history.length - 2] : price;
        const isActivelyRebounding = (pos.type === 'LONG' && price > lastPrice) || (pos.type === 'SHORT' && price < lastPrice);

        // ERKENNUNG VON ABREISSENDEM VERKAUFSDRUCK (Liquidation Sweep Rejection)
        const isSellingDriedUp = Math.abs(euroVolumeDelta) < 1500; 
        const isTrendStillValid = check5MinTrend(symbol, price, pos.type, currentProfile);

        const timeInTradeSec = Math.floor((now - pos.buyTime) / 1000);

        // TIMEOUT-FREEZE BEI ERHOLUNG ZUR V-FORM
        let timeoutTriggered = false;
        if (timeInTradeSec >= currentProfile.timeoutSec) {
            if (isActivelyRebounding || (isSellingDriedUp && isTrendStillValid)) {
                if (timeInTradeSec >= 360) {
                    timeoutTriggered = true;
                }
            } else {
                timeoutTriggered = true;
            }
        }

        // SL PUFFER BEI ERHOLUNGSKERZEN (Verhindert Ausstiege an reinen Nadelstichen)
        let effectiveSL = pos.dynamicSLPct;
        if (priceChangePct < 0 && !pos.breakEvenTriggered) {
            if (isActivelyRebounding || isSellingDriedUp) {
                effectiveSL = Math.min(1.40, currentProfile.sl * 1.75);
            }
        }

        const emergencyHardSL = 1.80; // Notbremse bei echten Flash-Crashes
        let stopLossTriggered = (priceChangePct <= -effectiveSL) || (priceChangePct <= -emergencyHardSL);

        if (stopLossTriggered || timeoutTriggered) {
            globalState.inPosition = false;
            globalState.position = null;

            const totalVol = currentProfile.margin * currentProfile.leverage;
            const grossProfit = totalVol * (priceChangePct / 100);
            const fee = totalVol * 0.0012;
            const netProfit = grossProfit - fee;

            globalState.totalProfit += netProfit;
            globalState.balance += netProfit;
            globalState.dailyPnL += netProfit;
            globalState.tradesCount++;

            const maxAllowedLoss = globalState.dailyStartBalance * globalState.dailyLossLimitPct;
            if (globalState.dailyPnL <= -maxAllowedLoss && !globalState.dailyHardLockActive) {
                globalState.dailyHardLockActive = true;
                broadcastLog(`🚨 <span class="text-rose-500 font-bold">HARD DAILY DRAWDOWN LIMIT:</span> Tagesverlust von ${Math.abs(globalState.dailyPnL).toFixed(2)} € (≥10%) erreicht! Trades bis 00:00 UTC gesperrt.`);
            }
            
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

            if (globalState.profileId === 'AUTO_KI') {
                trainAgentAfterTrade(netProfit, pos.mae);
            }

            tradeCooldownUntil = now + (currentProfile.cooldownSec * 1000 * (consecutiveLosses >= 2 ? 1.5 : 1));

            let exitReason = `🤖 ${currentProfile.name} ${symbol} ${pos.type}`;
            if (timeoutTriggered) exitReason = `⏱️ Momentum-Timeout (${timeInTradeSec}s)`;
            else if (pos.breakEvenTriggered) exitReason = `🛡️ Trailing/Break-Even Ausstieg`;

            const statusColor = isWin ? 'text-emerald-400' : 'text-rose-400';

            const newTx = {
                id: Date.now(),
                type: isWin ? 'PROFIT' : 'LOSS',
                eur: Math.abs(netProfit),
                timestamp: Date.now(),
                entryPrice: price,
                note: `${exitReason} (${isWin ? '+' : ''}${netProfit.toFixed(2)} € Netto | MAE: ${(pos.mae||0).toFixed(2)}%)`
            };
            globalState.transactions.push(newTx);
            
            broadcastLog(`🤖 <span class="${statusColor} font-bold">${isWin ? '🎯 TAKE-PROFIT' : '🛑 STOP-LOSS / TIMEOUT'} (${symbol}):</span> Closed @ ${price.toFixed(4)} € | Netto: <span class="${statusColor}">${isWin ? '+' : ''}${netProfit.toFixed(2)} €</span>`);
            broadcastState();
        }
    } 
    else if (!globalState.inPosition && !isChopMarket && now > tradeCooldownUntil && globalState.balance >= currentProfile.margin) {
        
        if (globalState.dailyHardLockActive) return;

        const sessionInfo = getSessionMultiplier();
        const currentCvd = cvdEuro[symbol] || 0;

        let requiredEuroCvd = currentProfile.cvdThreshold * sessionInfo.multiplier;
        
        if (now < whaleSpikes[symbol]) {
            requiredEuroCvd *= 0.70;
        }

        if (consecutiveLosses >= 2) {
            requiredEuroCvd *= 1.40;
        }

        let posType = currentCvd > 0 ? 'LONG' : 'SHORT';

        const isValidLong = posType === 'LONG' && isBreakoutLong;
        const isValidShort = posType === 'SHORT' && isBreakoutShort;
        
        const isTrendAligned = check5MinTrend(symbol, price, posType, currentProfile);

        const currentVWAP = getVWAP(symbol, price, euroVolume);
        const vwapDiffPct = ((price - currentVWAP) / currentVWAP) * 100;
        const isOverextendedLong = posType === 'LONG' && vwapDiffPct > 0.80;
        const isOverextendedShort = posType === 'SHORT' && vwapDiffPct < -0.80;

        const isTelemetryPermitted = evaluateStrictTelemetryGates(symbol, posType);

        if (Math.abs(currentCvd) >= requiredEuroCvd && (isValidLong || isValidShort) && isTrendAligned && !isOverextendedLong && !isOverextendedShort && isTelemetryPermitted) {
            globalState.inPosition = true;
            globalState.position = {
                symbol: symbol,
                type: posType,
                buyPrice: price,
                buyTime: Date.now(),
                peakProfitPct: 0,
                dynamicSLPct: currentProfile.sl,
                breakEvenTriggered: false,
                mae: 0
            };
            const icon = posType === 'LONG' ? '📈' : '📉';
            const color = posType === 'LONG' ? 'text-emerald-400' : 'text-rose-400';

            const pctOfBalance = ((currentProfile.margin / globalState.balance) * 100).toFixed(1);
            broadcastLog(`🤖 ${icon} <span class="${color} font-bold">${currentProfile.name} ORDER (${symbol} ${currentProfile.leverage}x):</span> ${posType} Einsatz ${currentProfile.margin}€ (${pctOfBalance}% des Depots) @ ${price.toFixed(4)} €`);
            broadcastState();
        }
    }
}

// 6. WEBSOCKET CLIENT HANDLER
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
                if (parsed.data.margin !== undefined && globalState.profileId !== 'AUTO_KI') globalState.margin = parsed.data.margin;
                if (parsed.data.tp !== undefined && globalState.profileId !== 'AUTO_KI') globalState.tp = parsed.data.tp;
                if (parsed.data.sl !== undefined && globalState.profileId !== 'AUTO_KI') globalState.sl = parsed.data.sl;
                if (parsed.data.agentActive !== undefined) globalState.agentActive = parsed.data.agentActive;
                broadcastState();
                return;
            }
            if (parsed.type === 'TX_UPDATE' && parsed.tx) {
                globalState.transactions.push(parsed.tx);
                if (parsed.tx.type === 'DEPOSIT') {
                    globalState.balance += parsed.tx.eur;
                    globalState.dailyStartBalance += parsed.tx.eur;
                } else if (parsed.tx.type === 'WITHDRAW') {
                    globalState.balance -= parsed.tx.eur;
                    globalState.dailyStartBalance -= parsed.tx.eur;
                }
                broadcastLog(`💶 <span class="text-emerald-400 font-bold">DEPOSIT/WITHDRAW:</span> ${parsed.tx.type} über ${parsed.tx.eur} €.`);
                broadcastState();
                return;
            }
        } catch (e) {}
    });
    ws.on('close', () => clients.delete(ws));
});

// 7. BINANCE STREAM INTEGRATION
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

// 8. SHUTDOWN HANDLER
function handleShutdown(signal) {
    console.log(`[Server] ${signal} empfangen: Sicherung des KI-Gedächtnisses...`);
    saveAiMemory();
    const payload = JSON.stringify({ 
        type: 'LOG_EVENT', 
        log: { time: new Date().toLocaleTimeString('de-DE'), message: '🔄 <span class="text-amber-400 font-bold">CLOUD NEUSTART:</span> Render Sync. Status gesichert.' } 
    });
    clients.forEach(c => { if (c.readyState === WebSocket.OPEN) c.send(payload); });
    setTimeout(() => { process.exit(0); }, 1000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

connectBinanceStream();
server.listen(port, () => console.log(`[Server] Multi-Profile Quantum AI Engine v6.3 aktiv auf Port ${port}`));
