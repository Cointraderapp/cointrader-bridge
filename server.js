<!DOCTYPE html>
<html lang="de" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; connect-src * 'self' wss: https: data: blob:;">
    <title>Cointrader.app - Quantum AI Engine (v6.3 Dark Pool Edition)</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.17.0/dist/tf.min.js"></script>
    <script>
        tailwind.config = {
            darkMode: 'class',
            theme: {
                screens: {
                    'xs': '400px',
                    'sm': '640px',
                    'md': '768px',
                    'lg': '1024px',
                    'xl': '1280px',
                },
                extend: {
                    colors: {
                        btc: '#F7931A',
                        eth: '#627EEA',
                        sol: '#14F195',
                        darkbg: '#0F172A',
                        cardbg: '#1E293B',
                    }
                }
            }
        }
    </script>
</head>
<body class="bg-darkbg text-slate-100 font-sans min-h-screen flex flex-col justify-between selection:bg-indigo-500 selection:text-white antialiased overflow-x-hidden">

    <!-- PASSWORT OVERLAY -->
    <div id="login-modal" class="fixed inset-0 bg-darkbg/95 backdrop-blur-md z-[100] flex items-center justify-center p-3 sm:p-4">
        <div class="bg-cardbg border border-indigo-500/40 p-5 sm:p-8 rounded-2xl max-w-sm w-full space-y-4 sm:space-y-5 shadow-2xl text-center relative overflow-hidden">
            <div class="w-12 h-12 sm:w-14 sm:h-14 bg-indigo-600 rounded-2xl flex items-center justify-center font-bold text-white text-xl sm:text-2xl mx-auto shadow-lg shadow-indigo-500/30">🌐</div>
            <div>
                <h2 class="text-xl sm:text-2xl font-black text-white tracking-wide">Cointrader.app</h2>
                <p class="text-[11px] sm:text-xs text-slate-400 mt-1">v6.3 Institutional Dark Pool Edition</p>
            </div>
            <div class="space-y-3">
                <input type="password" id="login-password" onkeydown="if(event.key==='Enter') checkPassword()" placeholder="Passwort eingeben" class="w-full bg-slate-900 border border-slate-700 p-2.5 sm:p-3 rounded-xl text-xs sm:text-sm text-white text-center focus:outline-none focus:border-indigo-500 font-mono tracking-widest">
                <p id="login-error" class="text-[11px] text-rose-400 hidden font-semibold">⚠️ Falsches Passwort!</p>
                <button onclick="checkPassword()" class="w-full py-2.5 sm:py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition duration-200 cursor-pointer">
                    🔓 Entsperren
                </button>
            </div>
        </div>
    </div>

    <!-- EINZAHLUNGS POPUP MODAL -->
    <div id="deposit-modal" class="hidden fixed inset-0 bg-darkbg/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
        <div class="bg-cardbg border border-emerald-500/40 p-5 sm:p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl relative">
            <h4 class="text-sm sm:text-base font-bold text-emerald-400 flex items-center gap-2">➕ Neue Einzahlung tätigen</h4>
            <p class="text-xs text-slate-400">Guthaben direkt in Ihr Cash-Depot aufladen.</p>
            <div class="space-y-3">
                <div>
                    <label class="block text-[11px] text-slate-400 mb-1 font-medium">Betrag in Euro (€)</label>
                    <input type="number" id="deposit-amount" onkeydown="if(event.key==='Enter') executeDeposit()" placeholder="z.B. 20000" class="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500 font-mono font-bold">
                </div>
                <div>
                    <label class="block text-[11px] text-slate-400 mb-1 font-medium">Notiz (Optional)</label>
                    <input type="text" id="deposit-note" onkeydown="if(event.key==='Enter') executeDeposit()" placeholder="z.B. Demo Startkapital" class="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500">
                </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
                <button onclick="toggleDepositModal()" class="px-3.5 py-2 bg-slate-700 text-xs rounded-xl text-slate-300 font-semibold hover:bg-slate-600 transition cursor-pointer">Abbrechen</button>
                <button onclick="executeDeposit()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded-xl text-white shadow-lg shadow-emerald-600/30 transition cursor-pointer">Einzahlen</button>
            </div>
        </div>
    </div>

    <!-- AUSZAHLUNGS POPUP MODAL -->
    <div id="withdraw-modal" class="hidden fixed inset-0 bg-darkbg/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
        <div class="bg-cardbg border border-rose-500/40 p-5 sm:p-6 rounded-2xl max-w-sm w-full space-y-4 shadow-2xl relative">
            <h4 class="text-sm sm:text-base font-bold text-rose-400 flex items-center gap-2">➖ Auszahlung tätigen</h4>
            <p class="text-xs text-slate-400">Guthaben aus dem Cash-Depot entnehmen.</p>
            <div class="space-y-3">
                <div>
                    <label class="block text-[11px] text-slate-400 mb-1 font-medium">Betrag in Euro (€)</label>
                    <input type="number" id="withdraw-amount" onkeydown="if(event.key==='Enter') executeWithdraw()" placeholder="z.B. 5000" class="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500 font-mono font-bold">
                </div>
                <div>
                    <label class="block text-[11px] text-slate-400 mb-1 font-medium">Notiz (Optional)</label>
                    <input type="text" id="withdraw-note" onkeydown="if(event.key==='Enter') executeWithdraw()" placeholder="z.B. Gewinn-Entnahme" class="w-full bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-rose-500">
                </div>
            </div>
            <div class="flex justify-end gap-2 pt-2">
                <button onclick="toggleWithdrawModal()" class="px-3.5 py-2 bg-slate-700 text-xs rounded-xl text-slate-300 font-semibold hover:bg-slate-600 transition cursor-pointer">Abbrechen</button>
                <button onclick="executeWithdraw()" class="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-xs font-bold rounded-xl text-white shadow-lg shadow-rose-600/30 transition cursor-pointer">Auszahlen</button>
            </div>
        </div>
    </div>

    <!-- ELEGANTER HEADER -->
    <header class="border-b border-slate-800 bg-cardbg/50 backdrop-blur sticky top-0 z-50 p-2.5 sm:p-4">
        <div class="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-4">
            <div class="flex items-center justify-between sm:justify-start space-x-3">
                <div class="flex items-center space-x-2.5 sm:space-x-3">
                    <div id="asset-logo" class="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-white text-base sm:text-xl shadow-lg shadow-indigo-500/20">🌐</div>
                    <div>
                        <h1 class="text-base sm:text-xl font-bold tracking-wide leading-none text-white flex items-center gap-1.5">
                            Cointrader.app <span class="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 font-mono">v6.3 HFT PRO</span>
                        </h1>
                        <span class="text-[10px] sm:text-xs text-slate-400 mt-0.5 block">Anti-Spoofing • Render Cloud Sync</span>
                    </div>
                </div>
            </div>

            <div class="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <select id="asset-select" onchange="switchAsset(this.value)" class="flex-1 sm:flex-initial bg-slate-900 text-indigo-300 border border-indigo-500/40 font-bold text-[11px] sm:text-xs py-2 px-2 sm:px-3 rounded-xl focus:outline-none cursor-pointer truncate">
                    <option value="REAL_TEST" selected>🎯 Real-Test (Top 5 Binance Futures)</option>
                    <option value="AUTO">🤖 Auto-Scan (Top 50 Coins Paper Trading)</option>
                </select>

                <button id="toggle-agent-btn" onclick="toggleAgent()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer">
                    ▶️ KI-Agent Starten
                </button>

                <span id="status-badge" class="text-[10px] sm:text-xs px-2.5 sm:px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl flex items-center gap-1.5 sm:gap-2 font-medium whitespace-nowrap transition-colors duration-300">
                    <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-500 animate-pulse"></span> Verbinde...
                </span>
            </div>
        </div>
    </header>

    <main class="max-w-6xl mx-auto p-2.5 sm:p-4 w-full my-1 sm:my-4 space-y-3.5 sm:space-y-6">

        <!-- EXECUTIVE SUMMARY -->
        <section class="bg-gradient-to-br from-slate-900 via-cardbg to-slate-900 border border-indigo-500/30 p-3.5 sm:p-6 rounded-2xl shadow-2xl space-y-3.5">
            <div class="flex flex-row justify-between items-center border-b border-slate-800 pb-3">
                <div class="flex items-center gap-2">
                    <span class="text-lg sm:text-xl">💼</span>
                    <h2 class="text-sm sm:text-lg font-bold text-white">HFT Paper-Trading Depot</h2>
                </div>
                <span id="agent-active-pill" class="text-[10px] sm:text-xs px-2.5 py-1 rounded-xl font-bold bg-slate-800 text-slate-400 border border-slate-700/80 whitespace-nowrap">
                    ⏹️ AGENT GESTOPPT
                </span>
            </div>

            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <div class="bg-darkbg/90 p-3 sm:p-4 rounded-xl border border-indigo-500/20 min-w-0">
                    <p class="text-slate-400 text-[10px] sm:text-xs font-medium">Portfolio-Wert</p>
                    <h3 id="depot-value" class="text-xl sm:text-2xl font-black mt-0.5 sm:mt-1 text-white truncate block">20.000,00 €</h3>
                    <p id="depot-asset-amount" class="text-[9px] sm:text-xs text-slate-400 mt-0.5 truncate block">20.000,00 € Verfügbares Cash</p>
                </div>

                <div class="bg-darkbg/90 p-3 sm:p-4 rounded-xl border border-indigo-500/20 min-w-0">
                    <p class="text-slate-400 text-[10px] sm:text-xs font-medium">Bot Reingewinn</p>
                    <h3 id="bot-profit-euro" class="text-xl sm:text-2xl font-black mt-0.5 sm:mt-1 text-indigo-400 truncate block">0,00 €</h3>
                    <p id="depot-profit-percent" class="text-[9px] sm:text-xs font-semibold text-emerald-400 mt-0.5 truncate block">0.00% Gesamtrendite</p>
                </div>

                <div class="bg-darkbg/80 p-3 sm:p-4 rounded-xl border border-slate-800">
                    <p class="text-slate-400 text-[10px] sm:text-xs font-medium">Win-Rate / Trades</p>
                    <h3 id="bot-winrate" class="text-lg sm:text-2xl font-black mt-0.5 text-emerald-400">0 %</h3>
                    <p class="text-[9px] sm:text-xs text-slate-400 mt-0.5"><span id="bot-trades-count" class="font-bold text-white">0</span> Trades ausgeführt</p>
                </div>

                <div class="bg-darkbg/80 p-3 sm:p-4 rounded-xl border border-slate-800">
                    <p class="text-slate-400 text-[10px] sm:text-xs font-medium">Fokus Asset (<span class="active-asset-label">BTC</span>)</p>
                    <h3 id="depot-current-price" class="text-lg sm:text-2xl font-bold mt-0.5 text-indigo-300 truncate">68.150,00 €</h3>
                    <p id="depot-24h-change" class="text-[9px] sm:text-xs mt-0.5 text-emerald-400">▲ System Bereit</p>
                </div>
            </div>
        </section>

        <!-- DASHBOARD MATRIX -->
        <section class="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
            <div class="bg-cardbg/90 border border-indigo-500/30 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2">
                <div class="flex justify-between items-center">
                    <h4 class="text-xs font-bold text-indigo-300 uppercase tracking-wider">🧠 TF.js Confidence</h4>
                    <span id="ml-status-pill" class="text-[9px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-mono font-bold">Inferenz Aktiv</span>
                </div>
                <div class="flex items-end justify-between">
                    <h3 id="ml-confidence-val" class="text-2xl font-black text-emerald-400">84 %</h3>
                    <span class="text-[10px] text-slate-400 font-mono">Schwelle: &ge; 84%</span>
                </div>
                <div class="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                    <div id="ml-confidence-bar" class="bg-emerald-400 h-full transition-all duration-300" style="width: 84%"></div>
                </div>
            </div>

            <div class="bg-cardbg/90 border border-indigo-500/30 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2">
                <div class="flex justify-between items-center">
                    <h4 class="text-xs font-bold text-indigo-300 uppercase tracking-wider">📊 Volume Delta</h4>
                    <span id="cvd-status-pill" class="text-[9px] px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-mono font-bold">CVD Delta</span>
                </div>
                <div class="flex items-end justify-between">
                    <h3 id="cvd-val" class="text-2xl font-black text-emerald-400">+0 Δ</h3>
                    <span id="cvd-dyn-threshold" class="text-[10px] text-slate-400 font-mono">Real Market CVD</span>
                </div>
                <p class="text-[10px] text-slate-400">Akkumulierter Netto-Kaufdruck im Buch.</p>
            </div>

            <div class="bg-cardbg/90 border border-indigo-500/30 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2">
                <div class="flex justify-between items-center">
                    <h4 class="text-xs font-bold text-indigo-300 uppercase tracking-wider">🔗 Pairs Korrelation</h4>
                    <span id="corr-status-pill" class="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">BTC+ETH+SOL</span>
                </div>
                <div class="flex items-end justify-between">
                    <h3 id="corr-val" class="text-2xl font-black text-cyan-400">SYNC OK</h3>
                    <span class="text-[10px] text-slate-400 font-mono">Triple-Check</span>
                </div>
                <p class="text-[10px] text-slate-400">Verhindert isolierte Manipulationen an einzelnen Coins.</p>
            </div>

            <div class="bg-cardbg/90 border border-indigo-500/30 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2">
                <div class="flex justify-between items-center">
                    <h4 class="text-xs font-bold text-indigo-300 uppercase tracking-wider">⚡ Markt-Regime</h4>
                    <span id="sweep-status-pill" class="text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold">Regime-Check</span>
                </div>
                <div class="flex items-end justify-between">
                    <h3 id="regime-val" class="text-lg font-black text-white truncate">NORMAL TREND</h3>
                    <span id="atr-val" class="text-[10px] text-slate-400 font-mono">0.42% ATR</span>
                </div>
                <p id="atr-desc" class="text-[10px] text-slate-400">Dynamische Schwellenwert-Anpassung aktiv.</p>
            </div>
        </section>

        <!-- STEUERUNG, PARAMETER & LOG TERMINAL -->
        <section class="bg-cardbg/90 border border-slate-800 p-3.5 sm:p-5 rounded-2xl shadow-xl space-y-3.5">
            <div class="bg-darkbg/90 p-3 sm:p-4 rounded-xl border border-indigo-500/20 space-y-2.5 sm:space-y-3">
                <div class="flex justify-between items-center">
                    <h3 class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-2">
                        ⚙️ High-Profit High-Risk Positionsparameter
                    </h3>
                    <span id="agent-target-asset" class="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase">
                        HFT FUTURES PAPER
                    </span>
                </div>
                
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                    <div>
                        <label class="block text-slate-400 text-[10px] sm:text-[11px] font-medium mb-1">Hebel (Leverage)</label>
                        <select id="leverage-select" onchange="updateRiskSettings()" class="w-full bg-cardbg text-indigo-300 font-bold text-xs py-1.5 sm:py-2 px-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500 cursor-pointer">
                            <option value="1">1x (Spot)</option>
                            <option value="2">2x</option>
                            <option value="5">5x</option>
                            <option value="10">10x</option>
                            <option value="20">20x</option>
                            <option value="50" selected>50x (Ultra High-Risk)</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-slate-400 text-[10px] sm:text-[11px] font-medium mb-1">Einsatz pro Trade (€)</label>
                        <input type="number" id="margin-input" value="5000" min="5" max="50000" step="100" oninput="updateRiskSettings()" onchange="updateRiskSettings()" class="w-full bg-cardbg text-white font-bold text-xs py-1.5 sm:py-2 px-2 rounded-lg border border-slate-700 focus:outline-none focus:border-indigo-500">
                    </div>

                    <div>
                        <label class="block text-[11px] text-slate-400 mb-1 font-medium">Ziel Basis Netto (%)</label>
                        <input type="number" id="tp-input" value="0.75" min="0.2" max="10" step="0.05" oninput="updateRiskSettings()" onchange="updateRiskSettings()" class="w-full bg-cardbg text-emerald-400 font-bold text-xs py-1.5 sm:py-2 px-2 rounded-lg border border-slate-700 focus:outline-none focus:border-emerald-500">
                    </div>

                    <div>
                        <label class="block text-[11px] text-slate-400 mb-1 font-medium">Stop-Loss Basis (%)</label>
                        <input type="number" id="sl-input" value="1.25" min="0.1" max="10" step="0.05" oninput="updateRiskSettings()" onchange="updateRiskSettings()" class="w-full bg-cardbg text-rose-400 font-bold text-xs py-1.5 sm:py-2 px-2 rounded-lg border border-slate-700 focus:outline-none focus:border-rose-500">
                    </div>
                </div>
            </div>

            <!-- TOP MOVERS RADAR GRID -->
            <div class="space-y-1.5">
                <span class="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400 block">🔥 Hot Top 6 Scanner Radar</span>
                <div id="top-movers-grid" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1.5 sm:gap-2 text-xs font-mono">
                </div>
            </div>

            <div class="bg-slate-950 p-2.5 sm:p-3.5 rounded-xl border border-slate-800/90 font-mono text-xs shadow-inner">
                <div class="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-1 mb-2 pb-1.5 border-b border-slate-900 text-slate-500 text-[10px] sm:text-[11px]">
                    <span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span> TERMINAL</span>
                    <span id="leverage-display-tag" class="text-indigo-400 font-bold truncate">50x | 5000€ | HFT Pro Mode</span>
                </div>
                <div id="agent-log" class="h-28 sm:h-32 overflow-y-auto space-y-1.5 text-slate-400 text-[11px] sm:text-xs scrollbar-thin">
                    <p class="text-slate-500">[System] v6.3 Dark Pool Engine geladen: Render Cloud Sync Bridge aktiv.</p>
                </div>
            </div>
        </section>

        <!-- CANVAS KERZEN CHART -->
        <section class="bg-cardbg p-3.5 sm:p-6 rounded-2xl border border-slate-800 shadow-xl space-y-2.5 sm:space-y-3">
            <div class="flex justify-between items-center flex-wrap gap-2">
                <div>
                    <h3 class="text-sm sm:text-lg font-bold text-white flex items-center gap-2">
                        🕯️ Live Sekunden-Kerzenchart (<span class="active-asset-label">BTC</span> / 5s)
                    </h3>
                    <p class="text-[10px] sm:text-xs text-slate-400">Echtzeit Trailing SL & Break-Even Visualisierung.</p>
                </div>
                <span class="text-[10px] sm:text-xs font-mono px-2.5 py-1 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-xl flex items-center gap-1.5 font-medium">
                    <span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-indigo-400 animate-pulse"></span> Canvas Stream
                </span>
            </div>

            <div class="relative h-60 sm:h-72 w-full rounded-xl overflow-hidden bg-slate-950 p-1.5 sm:p-2 border border-slate-800">
                <canvas id="candleCanvas" class="w-full h-full block"></canvas>
            </div>

            <div class="flex items-center gap-2 sm:gap-3 bg-darkbg p-2 sm:p-2.5 rounded-xl border border-slate-800">
                <span class="text-[10px] sm:text-[11px] text-slate-400 font-mono whitespace-nowrap flex items-center gap-1">
                    ◀ Ältere
                </span>
                <input type="range" id="chart-slider" min="0" max="100" value="100" oninput="drawCandleCanvas()" class="w-full accent-indigo-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none">
                <span class="text-[10px] sm:text-[11px] text-indigo-400 font-mono font-bold whitespace-nowrap flex items-center gap-1">
                    Live ▶
                </span>
            </div>
        </section>

        <!-- ASTRO & SESSION RADAR -->
        <section class="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <div class="bg-cardbg/90 border border-indigo-500/30 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2.5 sm:space-y-3 relative overflow-hidden">
                <div class="flex flex-row justify-between items-center gap-2">
                    <h3 class="text-[11px] sm:text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        🌕 Synodische Mondphasen-Engine
                    </h3>
                    <span id="lunar-phase-badge" class="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono font-bold whitespace-nowrap">
                        Akkumulation
                    </span>
                </div>
                <div class="flex items-center gap-3 sm:gap-4 bg-darkbg p-2.5 sm:p-3 rounded-xl border border-slate-800">
                    <div id="lunar-icon" class="text-2xl sm:text-3xl flex-shrink-0">🌔</div>
                    <div class="min-w-0 flex-1">
                        <h4 id="lunar-name" class="text-xs font-bold text-white truncate">Mondphase wird berechnet...</h4>
                        <p id="lunar-desc" class="text-[10px] sm:text-[11px] text-slate-400 mt-0.5 truncate">Einfluss auf Krypto-Akkumulation und Volatilität.</p>
                        <span id="lunar-bias-tag" class="inline-block text-[9px] sm:text-[10px] font-mono font-bold mt-1 text-emerald-400">Bias: +10% Bullish Correlation</span>
                    </div>
                </div>
            </div>

            <div class="bg-cardbg/90 border border-indigo-500/30 p-3.5 sm:p-4 rounded-2xl shadow-xl space-y-2.5 sm:space-y-3 relative overflow-hidden">
                <div class="flex flex-row justify-between items-center gap-2">
                    <h3 class="text-[11px] sm:text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                        🕒 Zirkadianer Session-Timer
                    </h3>
                    <span id="session-overlap-badge" class="text-[10px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-mono font-bold whitespace-nowrap">
                        NORMAL-VOLUMEN
                    </span>
                </div>
                <div class="grid grid-cols-4 gap-1.5 sm:gap-2 text-center text-xs font-mono">
                    <div id="session-sydney" class="bg-darkbg p-1.5 sm:p-2 rounded-lg border border-slate-800">
                        <span class="block text-[8px] sm:text-[10px] text-slate-500">SYDNEY</span>
                        <span class="font-bold text-slate-400 text-[11px] sm:text-xs">ZU</span>
                    </div>
                    <div id="session-tokyo" class="bg-darkbg p-1.5 sm:p-2 rounded-lg border border-slate-800">
                        <span class="block text-[8px] sm:text-[10px] text-slate-500">TOKYO</span>
                        <span class="font-bold text-slate-400 text-[11px] sm:text-xs">ZU</span>
                    </div>
                    <div id="session-london" class="bg-darkbg p-1.5 sm:p-2 rounded-lg border border-slate-800">
                        <span class="block text-[8px] sm:text-[10px] text-slate-500">LONDON</span>
                        <span class="font-bold text-emerald-400 text-[11px] sm:text-xs">OFFEN</span>
                    </div>
                    <div id="session-ny" class="bg-darkbg p-1.5 sm:p-2 rounded-lg border border-slate-800">
                        <span class="block text-[8px] sm:text-[10px] text-slate-500">NEW YORK</span>
                        <span class="font-bold text-emerald-400 text-[11px] sm:text-xs">OFFEN</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- TRANSAKTIONS HISTORIE -->
        <section class="bg-cardbg/80 border border-slate-800 p-3.5 sm:p-6 rounded-2xl shadow-xl space-y-4">
            <div class="flex justify-between items-center">
                <h4 class="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-400">Transaktions-Historie</h4>
                <button onclick="resetTransactions()" class="text-[9px] sm:text-[10px] text-slate-500 hover:text-rose-400 underline cursor-pointer">Depot zurücksetzen</button>
            </div>
            
            <div class="overflow-x-auto max-h-48 rounded-lg border border-slate-800/60">
                <table class="w-full text-left text-[11px] sm:text-xs text-slate-300 min-w-[500px]">
                    <thead class="bg-darkbg/80 text-slate-400 border-b border-slate-800 sticky top-0 backdrop-blur">
                        <tr>
                            <th class="p-2 sm:p-2.5">Typ</th>
                            <th class="p-2 sm:p-2.5">Zeitstempel</th>
                            <th class="p-2 sm:p-2.5">Betrag (€)</th>
                            <th class="p-2 sm:p-2.5">Ausführungskurs</th>
                            <th class="p-2 sm:p-2.5">Notiz</th>
                        </tr>
                    </thead>
                    <tbody id="tx-history-body"></tbody>
                </table>
            </div>

            <div class="grid grid-cols-2 gap-3 pt-2">
                <button onclick="toggleDepositModal()" class="w-full py-3 bg-emerald-600/90 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 cursor-pointer">
                    ➕ Einzahlung tätigen
                </button>
                <button onclick="toggleWithdrawModal()" class="w-full py-3 bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs rounded-xl transition shadow-lg shadow-rose-600/20 flex items-center justify-center gap-2 cursor-pointer">
                    ➖ Auszahlung tätigen
                </button>
            </div>
        </section>
    </main>

    <footer class="border-t border-slate-800 py-3 sm:py-4 text-center text-[10px] sm:text-xs text-slate-500">
        © Cointrader.app • Top 50 Multi-Asset Quantum AI Engine v6.3 Institutional Dark Pool Edition
    </footer>

    <script>
        function toggleDepositModal() { document.getElementById('deposit-modal').classList.toggle('hidden'); }
        function toggleWithdrawModal() { document.getElementById('withdraw-modal').classList.toggle('hidden'); }

        function checkPassword() {
            const pwd = document.getElementById('login-password').value;
            if (pwd === 'user') {
                document.getElementById('login-modal').classList.add('hidden');
                sessionStorage.setItem('cointrader_auth', 'true');
            } else {
                document.getElementById('login-error').classList.remove('hidden');
            }
        }

        function checkAuthOnLoad() {
            if (sessionStorage.getItem('cointrader_auth') === 'true') {
                document.getElementById('login-modal').classList.add('hidden');
            }
        }

        const TOP_50_ASSETS = [
            'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX', 'DOT', 'LINK', 'SHIB',
            'NEAR', 'SUI', 'LTC', 'BCH', 'PEPE', 'UNI', 'ICP', 'APT', 'FET', 'RENDER',
            'POL', 'STX', 'FIL', 'ARB', 'OP', 'TIA', 'INJ', 'LDO', 'KAS', 'ETC',
            'ATOM', 'XMR', 'TRX', 'AAVE', 'MKR', 'GRT', 'THETA', 'RUNE', 'FTM', 'ALGO',
            'FLOW', 'GALA', 'SAND', 'MANA', 'EGLD', 'XTZ', 'EOS', 'NEO', 'QNT', 'SNX'
        ];

        const LIQUID_REAL_TEST_ASSETS = ['BTCEUR', 'ETHEUR', 'SOLEUR', 'XRPEUR', 'DOGEEUR'];

        const assetPrices = {};
        const assetChanges = {};
        const assetTickBuffers = {};
        const assetCVD = {};
        const assetCVDHistory = {}; 
        let currentMtfStatus = "OK"; 
        let isBinanceConnected = false;

        TOP_50_ASSETS.forEach(sym => {
            const baseMap = { BTC: 68150, ETH: 2450, SOL: 135, XRP: 0.58, ADA: 0.38, DOGE: 0.12, AVAX: 24.5, SUI: 1.15, PEPE: 0.0000085 };
            assetPrices[sym + 'EUR'] = baseMap[sym] || 100;
            assetChanges[sym + 'EUR'] = 0;
            assetTickBuffers[sym + 'EUR'] = [];
            assetCVD[sym + 'EUR'] = 0;
            assetCVDHistory[sym + 'EUR'] = [];
        });

        // ==========================================
        // HFT ENGINE OPTIMIERUNGS-MODULE
        // ==========================================

        const SpoofGuard = {
            cancellationTracker: [],
            isSpoofDetected: function() {
                if (this.cancellationTracker.length < 5) return false;
                const rapidDrops = this.cancellationTracker.filter((v, i, arr) => i > 0 && (arr[i-1] - v) > 2000);
                return rapidDrops.length >= 2; 
            },
            recordDelta: function(val) {
                this.cancellationTracker.push(val);
                if (this.cancellationTracker.length > 10) this.cancellationTracker.shift();
            }
        };

        function checkCrossAssetCorrelation(type) {
            const btcCvd = assetCVD['BTCEUR'] || 0;
            const ethCvd = assetCVD['ETHEUR'] || 0;
            const solCvd = assetCVD['SOLEUR'] || 0;

            const corrVal = document.getElementById('corr-val');

            let positiveCount = 0;
            let negativeCount = 0;

            if (btcCvd > 0) positiveCount++; else if (btcCvd < 0) negativeCount++;
            if (ethCvd > 0) positiveCount++; else if (ethCvd < 0) negativeCount++;
            if (solCvd > 0) positiveCount++; else if (solCvd < 0) negativeCount++;

            if (type === 'LONG') {
                const isSynced = positiveCount >= 2; 
                if (corrVal) {
                    corrVal.innerText = isSynced ? "SYNC OK" : "DIVERGENZ";
                    corrVal.className = `text-2xl font-black ${isSynced ? 'text-cyan-400' : 'text-amber-400'}`;
                }
                return isSynced;
            } else if (type === 'SHORT') {
                const isSynced = negativeCount >= 2;
                if (corrVal) {
                    corrVal.innerText = isSynced ? "SYNC OK" : "DIVERGENZ";
                    corrVal.className = `text-2xl font-black ${isSynced ? 'text-cyan-400' : 'text-amber-400'}`;
                }
                return isSynced;
            }
            return true;
        }

        function detectMarketRegime() {
            const atrPct = computeATRPercent();
            const regimeVal = document.getElementById('regime-val');

            if (atrPct < 0.18) {
                if (regimeVal) { regimeVal.innerText = "CHOP / LOW VOL"; regimeVal.className = "text-base sm:text-lg font-black text-rose-400 truncate"; }
                return "REGIME_CHOP";
            } else if (atrPct > 0.55) {
                if (regimeVal) { regimeVal.innerText = "EXPANSION / HIGH VOL"; regimeVal.className = "text-base sm:text-lg font-black text-emerald-400 truncate animate-pulse"; }
                return "REGIME_EXPANSION";
            } else {
                if (regimeVal) { regimeVal.innerText = "NORMAL TREND"; regimeVal.className = "text-base sm:text-lg font-black text-white truncate"; }
                return "REGIME_NORMAL";
            }
        }

        function checkLiquidationCascadeTarget(type) {
            if (!candles || candles.length < 20) return false;
            const recent20 = candles.slice(-20);
            const highestHigh = Math.max(...recent20.map(c => c.high));
            const lowestLow = Math.min(...recent20.map(c => c.low));
            const currentClose = candles[candles.length - 1].close;

            if (type === 'LONG' && (highestHigh - currentClose) / currentClose * 100 < 0.08) {
                return true; 
            } else if (type === 'SHORT' && (currentClose - lowestLow) / currentClose * 100 < 0.08) {
                return true; 
            }
            return false;
        }

        function calculateMoonPhase(date = new Date()) {
            let year = date.getUTCFullYear();
            let month = date.getUTCMonth() + 1;
            let day = date.getUTCDate();
            if (month < 3) { year--; month += 12; }
            let a = Math.floor(year / 100);
            let b = Math.floor(a / 4);
            let c = 2 - a + b;
            let e = Math.floor(365.25 * (year + 4716));
            let f = Math.floor(30.6001 * (month + 1));
            let jd = c + day + e + f - 1524.5;
            let daysSinceNew = (jd - 2451549.5) % 29.53058867;
            if (daysSinceNew < 0) daysSinceNew += 29.53058867;

            if (daysSinceNew < 1.84) return { name: "Neumond 🌑", icon: "🌑", bias: +15, desc: "Akkumulation (+15% Bullish)" };
            if (daysSinceNew < 5.53) return { name: "Zunehmend 🌒", icon: "🌒", bias: +10, desc: "Bullish Momentum (+10%)" };
            if (daysSinceNew < 9.22) return { name: "Erstes Viertel 🌓", icon: "🌓", bias: +5, desc: "Aufwärtsmoment (+5%)" };
            if (daysSinceNew < 12.91) return { name: "Zunehmender Mond 🌔", icon: "🌔", bias: 0, desc: "Erhöhte Volatilität (Neutral)" };
            if (daysSinceNew < 16.61) return { name: "Vollmond 🌕", icon: "🌕", bias: -15, desc: "Umkehr-Risiko (-15%)" };
            if (daysSinceNew < 20.30) return { name: "Abnehmender Mond 🌖", icon: "🌖", bias: -10, desc: "Bearish Momentum (-10%)" };
            if (daysSinceNew < 23.99) return { name: "Letztes Viertel 🌗", icon: "🌗", bias: -5, desc: "Slight Short Bias (-5%)" };
            return { name: "Abnehmend 🌘", icon: "🌘", bias: 0, desc: "Konsolidierung (Neutral)" };
        }

        function updateTradingSessions() {
            const now = new Date();
            const utcHour = now.getUTCHours();

            const isSydney = utcHour >= 22 || utcHour < 7;
            const isTokyo = utcHour >= 0 && utcHour < 9;
            const isLondon = utcHour >= 7 && utcHour < 16;
            const isNY = utcHour >= 12 && utcHour < 21;

            const updatePill = (id, active) => {
                const el = document.getElementById(id);
                if (!el) return;
                const span = el.querySelector('span:last-child');
                if (active) {
                    el.className = "bg-emerald-500/10 p-1.5 sm:p-2 rounded-lg border border-emerald-500/30";
                    span.className = "font-bold text-emerald-400 text-[11px] sm:text-xs";
                    span.innerText = "OFFEN";
                } else {
                    el.className = "bg-darkbg p-1.5 sm:p-2 rounded-lg border border-slate-800";
                    span.className = "font-bold text-slate-500 text-[11px] sm:text-xs";
                    span.innerText = "ZU";
                }
            };

            updatePill('session-sydney', isSydney);
            updatePill('session-tokyo', isTokyo);
            updatePill('session-london', isLondon);
            updatePill('session-ny', isNY);
        }

        let selectedMode = "REAL_TEST"; 
        let focusSymbol = "BTCEUR";
        let activeWs = null;
        let chartInstance = null;
        
        let candles = [];
        const CANDLE_SEC = 5;
        const MAX_HISTORICAL_CANDLES = 150;

        const MAX_ALLOWED_LOSS_EUR = 5000; 
        
        let agentActive = JSON.parse(localStorage.getItem('btc_agent_active_v4')) ?? false;
        let agentLeverage = JSON.parse(localStorage.getItem('btc_agent_leverage_v4')) || 50;
        let agentMargin = JSON.parse(localStorage.getItem('btc_agent_margin_v4')) || 5000;
        let agentTakeProfitPct = JSON.parse(localStorage.getItem('btc_agent_tp_v4')) || 0.75;
        let agentStopLossPct = JSON.parse(localStorage.getItem('btc_agent_sl_v4')) || 1.25;
        
        let agentState = {
            inPosition: false,
            activeSymbol: null,
            positionType: null,
            buyPrice: 0,
            buyTime: 0,
            peakProfitPct: 0,
            dynamicSLPct: 0,
            breakEvenTriggered: false,
            tradesCount: JSON.parse(localStorage.getItem('btc_agent_trades_v4')) || 0,
            winCount: JSON.parse(localStorage.getItem('btc_agent_wins_v4')) || 0,
            totalProfit: JSON.parse(localStorage.getItem('btc_agent_profit_v4')) || 0,
            totalFees: JSON.parse(localStorage.getItem('btc_agent_fees_v4')) || 0
        };

        const BASE_FEE_RATE = 0.00075;

        let transactions = JSON.parse(localStorage.getItem('btc_trader_txs_v4')) || [
            {
                id: Date.now(),
                type: 'DEPOSIT',
                eur: 20000,
                timestamp: Date.now(),
                entryPrice: 68150,
                note: 'Startkapital HFT Paper Trading'
            }
        ];

        function populateAssetSelectOptions() {
            const sel = document.getElementById('asset-select');
            if (!sel) return;
            sel.innerHTML = `
                <option value="REAL_TEST" selected>🎯 Real-Test (Top 5 Binance Futures)</option>
                <option value="AUTO">🤖 Auto-Scan (Top 50 Coins Paper Trading)</option>
            `;
            TOP_50_ASSETS.forEach(sym => {
                const opt = document.createElement('option');
                opt.value = sym + 'EUR';
                opt.innerText = `${sym} (${sym}/EUR)`;
                sel.appendChild(opt);
            });
        }

        function renderTopMoversGrid() {
            try {
                const grid = document.getElementById('top-movers-grid');
                if (!grid) return;
                grid.innerHTML = '';

                const listToRender = selectedMode === "REAL_TEST" 
                    ? LIQUID_REAL_TEST_ASSETS.map(pair => pair.replace("EUR",""))
                    : TOP_50_ASSETS.slice(0, 6);

                listToRender.forEach(sym => {
                    const pair = sym + 'EUR';
                    const price = assetPrices[pair] || 0;
                    const change = assetChanges[pair] || 0;
                    const isPos = change >= 0;

                    const card = document.createElement('div');
                    card.className = "bg-darkbg p-2 rounded-xl border border-slate-800 cursor-pointer hover:border-indigo-500/50 transition";
                    card.onclick = () => switchAsset(pair);
                    card.innerHTML = `
                        <div class="flex justify-between items-center">
                            <span class="font-bold text-white text-[11px] sm:text-xs">${sym}</span>
                            <span class="text-[9px] sm:text-[10px] ${isPos ? 'text-emerald-400' : 'text-rose-400'}">${isPos ? '+' : ''}${change.toFixed(2)}%</span>
                        </div>
                        <div class="text-[10px] sm:text-[11px] text-slate-300 mt-0.5 truncate">${price < 1 ? price.toFixed(4) : price.toFixed(2)} €</div>
                    `;
                    grid.appendChild(card);
                });
            } catch(e) { console.error("Grid Render Error", e); }
        }

        function computeATRPercent() {
            if (!candles || candles.length < 12) return 0.45;
            const windowCandles = candles.slice(-12);
            const maxP = Math.max(...windowCandles.map(c => c.high));
            const minP = Math.min(...windowCandles.map(c => c.low));
            const currentClose = windowCandles[windowCandles.length - 1].close;
            if (!minP || minP === 0) return 0.45;
            return parseFloat((((maxP - minP) / currentClose) * 100).toFixed(2));
        }

        function checkMultiTimeframeTrend(type) {
            if (!candles || candles.length < 30) {
                currentMtfStatus = "OK";
                return true;
            }
            
            const recent12 = candles.slice(-12);
            const sma12 = recent12.reduce((sum, c) => sum + c.close, 0) / 12;
            const currentClose = candles[candles.length - 1].close;

            const recent60 = candles.slice(-60);
            const sma60 = recent60.reduce((sum, c) => sum + c.close, 0) / 60;

            const diffPct = (Math.abs(sma12 - sma60) / sma60) * 100;

            if (diffPct < 0.03) {
                currentMtfStatus = "CHOP";
                return false;
            }
            currentMtfStatus = "OK";

            if (type === 'LONG') {
                return currentClose > sma12 && sma12 > sma60; 
            } else if (type === 'SHORT') {
                return currentClose < sma12 && sma12 < sma60; 
            }
            return false;
        }

        function isVolatilitySqueeze() {
            if (!candles || candles.length < 20) return false;
            
            const recent20 = candles.slice(-20);
            const recent5 = candles.slice(-5);
            
            const max20 = Math.max(...recent20.map(c => c.high));
            const min20 = Math.min(...recent20.map(c => c.low));
            const band20 = max20 - min20;
            
            const currentClose = candles[candles.length - 1].close;
            const band20Pct = (band20 / currentClose) * 100;
            
            if (band20Pct < 0.15) return true;
            
            const currentRange = recent5[recent5.length - 1].high - recent5[recent5.length - 1].low;
            const avgRange = recent20.reduce((sum, c) => sum + (c.high - c.low), 0) / 20;
            if (currentRange <= avgRange * 1.2) return true; 
            
            return false;
        }

        function computeAdaptiveCvdThreshold(symbol) {
            const atrPct = computeATRPercent();
            const dynamicMin = Math.round(1500 * Math.max(1.0, atrPct / 0.35));
            const cvdDynEl = document.getElementById('cvd-dyn-threshold');
            if (cvdDynEl && symbol === focusSymbol) {
                cvdDynEl.innerText = `Min. ${dynamicMin.toLocaleString('de-DE')} Δ`;
            }
            return dynamicMin;
        }

        function seedHistoricalCandles(price) {
            price = parseFloat(price) || 68150;
            const now = Math.floor(Date.now() / 1000);
            let currentP = price;
            let generated = [];

            for (let i = MAX_HISTORICAL_CANDLES - 1; i >= 0; i--) {
                const t = Math.floor((now - i * CANDLE_SEC) / CANDLE_SEC) * CANDLE_SEC;
                const changePct = (Math.random() - 0.495) * 0.0012;
                const openP = currentP;
                const closeP = currentP * (1 + changePct);
                const highP = Math.max(openP, closeP) * (1 + Math.random() * 0.0004);
                const lowP = Math.min(openP, closeP) * (1 - Math.random() * 0.0004);

                generated.push({ time: t, open: openP, high: highP, low: lowP, close: closeP });
                currentP = closeP;
            }
            candles = generated;
            drawCandleCanvas();
        }

        function updateCandleData(price) {
            const now = Math.floor(Date.now() / 1000);
            const candleTime = Math.floor(now / CANDLE_SEC) * CANDLE_SEC;

            if (candles && candles.length > 0 && (now - candles[candles.length - 1].time) > 20) {
                seedHistoricalCandles(price);
                return;
            }

            if (!candles || candles.length === 0) {
                seedHistoricalCandles(price);
                return;
            }

            if (candles[candles.length - 1].time !== candleTime) {
                const openPrice = candles[candles.length - 1].close;
                candles.push({
                    time: candleTime,
                    open: openPrice,
                    high: Math.max(openPrice, price),
                    low: Math.min(openPrice, price),
                    close: price
                });
                if (candles.length > MAX_HISTORICAL_CANDLES) candles.shift();
            } else {
                let last = candles[candles.length - 1];
                last.high = Math.max(last.high, price);
                last.low = Math.min(last.low, price);
                last.close = price;
            }

            drawCandleCanvas();
        }

        function drawCandleCanvas() {
            try {
                const cvs = document.getElementById('candleCanvas');
                if (!cvs) return;
                const ctx = cvs.getContext('2d');
                
                const rect = cvs.parentElement.getBoundingClientRect();
                let w = rect.width || cvs.parentElement.clientWidth || 300;
                let h = rect.height || cvs.parentElement.clientHeight || 240;
                cvs.width = w;
                cvs.height = h;

                ctx.clearRect(0, 0, w, h);

                if (!candles || candles.length === 0) return;

                const slider = document.getElementById('chart-slider');
                const sliderVal = slider ? parseInt(slider.value) : 100;
                const visibleCount = 35;

                let startIndex = 0;
                if (candles.length > visibleCount) {
                    const maxStart = candles.length - visibleCount;
                    startIndex = Math.round((sliderVal / 100) * maxStart);
                }

                const visibleCandles = candles.slice(startIndex, startIndex + visibleCount);
                if (visibleCandles.length === 0) return;

                let minP = Math.min(...visibleCandles.map(c => c.low));
                let maxP = Math.max(...visibleCandles.map(c => c.high));

                let buyP = null, tpP = null, slP = null;
                if (agentState.inPosition && agentState.activeSymbol === focusSymbol && agentState.buyPrice > 0) {
                    buyP = agentState.buyPrice;
                    const activeSLPct = agentState.dynamicSLPct || agentStopLossPct;
                    if (agentState.positionType === 'LONG') {
                        tpP = buyP * (1 + agentTakeProfitPct / 100);
                        slP = buyP * (1 - activeSLPct / 100);
                    } else {
                        tpP = buyP * (1 - agentTakeProfitPct / 100);
                        slP = buyP * (1 + activeSLPct / 100);
                    }
                    minP = Math.min(minP, buyP, tpP, slP);
                    maxP = Math.max(maxP, buyP, tpP, slP);
                }

                const pad = (maxP - minP) * 0.12;
                minP -= pad;
                maxP += pad;

                const paddingRight = 55;
                const chartWidth = Math.max(10, w - paddingRight);
                const chartHeight = Math.max(10, h - 18);

                function priceToY(p) { return chartHeight - ((p - minP) / (maxP - minP)) * chartHeight; }

                ctx.strokeStyle = '#1E293B';
                ctx.fillStyle = '#64748B';
                ctx.font = '9px monospace';
                ctx.lineWidth = 1;

                const steps = 4;
                for (let i = 0; i <= steps; i++) {
                    const priceVal = minP + (maxP - minP) * (i / steps);
                    const y = priceToY(priceVal);

                    ctx.beginPath();
                    ctx.setLineDash([]);
                    ctx.moveTo(0, y);
                    ctx.lineTo(chartWidth, y);
                    ctx.stroke();

                    ctx.fillText(priceVal < 1 ? priceVal.toFixed(4) + ' €' : priceVal.toFixed(1) + ' €', chartWidth + 4, y + 3);
                }

                const count = visibleCandles.length;
                const slotWidth = chartWidth / count;
                const candleWidth = Math.max(2, slotWidth * 0.68);

                visibleCandles.forEach((c, idx) => {
                    const xCenter = idx * slotWidth + slotWidth / 2;
                    const yOpen = priceToY(c.open);
                    const yClose = priceToY(c.close);
                    const yHigh = priceToY(c.high);
                    const yLow = priceToY(c.low);

                    const isGreen = c.close >= c.open;
                    const color = isGreen ? '#10B981' : '#EF4444';

                    ctx.strokeStyle = color;
                    ctx.fillStyle = color;
                    ctx.setLineDash([]);

                    ctx.beginPath();
                    ctx.moveTo(xCenter, yHigh);
                    ctx.lineTo(xCenter, yLow);
                    ctx.stroke();

                    const topY = Math.min(yOpen, yClose);
                    const bodyH = Math.max(2, Math.abs(yOpen - yClose));
                    ctx.fillRect(xCenter - candleWidth / 2, topY, candleWidth, bodyH);
                });

                if (agentState.inPosition && agentState.activeSymbol === focusSymbol && buyP) {
                    ctx.font = '9px sans-serif';

                    const ySL = priceToY(slP);
                    ctx.strokeStyle = agentState.breakEvenTriggered ? '#3B82F6' : '#F43F5E';
                    ctx.fillStyle = agentState.breakEvenTriggered ? '#3B82F6' : '#F43F5E';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(0, ySL);
                    ctx.lineTo(chartWidth, ySL);
                    ctx.stroke();
                    ctx.fillText(`${agentState.breakEvenTriggered ? '🛡️ BREAK-EVEN / TRAILING' : '🛑 SL (-25% Guard)'} (${slP.toFixed(2)} €)`, 6, ySL - 3);

                    const yTP = priceToY(tpP);
                    ctx.strokeStyle = '#10B981';
                    ctx.fillStyle = '#10B981';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(0, yTP);
                    ctx.lineTo(chartWidth, yTP);
                    ctx.stroke();
                    ctx.fillText(`🎯 TP TRIGGER (${tpP.toFixed(2)} €)`, 6, yTP - 3);

                    const yBuy = priceToY(buyP);
                    ctx.strokeStyle = '#818CF8';
                    ctx.fillStyle = '#818CF8';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([2, 2]);
                    ctx.beginPath();
                    ctx.moveTo(0, yBuy);
                    ctx.lineTo(chartWidth, yBuy);
                    ctx.stroke();
                    ctx.fillText(`ENTRY (${agentState.positionType} @ ${buyP.toFixed(2)} €)`, 6, yBuy - 3);
                }
            } catch(e) {}
        }

        // ==========================================
        // RENDER CLOUD SYNC & HYPER-RESILIENT ENGINE
        // ==========================================

        function startMultiStreamWebSocket() {
            if (activeWs) { try { activeWs.close(); } catch(e){} }
            try {
                activeWs = new WebSocket('wss://cointrader-bridge.onrender.com');

                activeWs.onopen = () => {
                    isBinanceConnected = true;
                    updateStatusBadge(true);
                    logAgentMessage(`🟢 <span class="text-emerald-400 font-bold">RENDER CLOUD BRIDE:</span> Stream & Depot-Sync live verbunden.`);
                };

                activeWs.onmessage = (event) => {
                    try {
                        const msg = JSON.parse(event.data);
                        
                        // NEU: EMPFÄNGT ECHTZEIT-LOGS VOM RENDER SERVER
                        if (msg.type === 'LOG_EVENT' && msg.message) {
                            logAgentMessage(msg.message);
                            return;
                        }

                        // MASTER STATE-SYNC VOM RENDER SERVER
                        if (msg.type === 'STATE_UPDATE' && msg.state) {
                            transactions = msg.state.transactions || transactions;
                            agentState.totalProfit = msg.state.totalProfit || 0;
                            agentState.tradesCount = msg.state.tradesCount || 0;
                            agentState.winCount = msg.state.winCount || 0;
                            
                            // SERVER ZWINGT DEN AKTUELLES STATUS AUF
                            if (msg.state.agentActive !== undefined) {
                                agentActive = msg.state.agentActive;
                            }
                            
                            if (msg.state.leverage !== undefined) {
                                agentLeverage = msg.state.leverage;
                                const levEl = document.getElementById('leverage-select');
                                if (levEl) levEl.value = agentLeverage.toString();
                            }
                            if (msg.state.margin !== undefined) {
                                agentMargin = msg.state.margin;
                                const marEl = document.getElementById('margin-input');
                                if (marEl) marEl.value = agentMargin;
                            }
                            if (msg.state.tp !== undefined) {
                                agentTakeProfitPct = msg.state.tp;
                                const tpEl = document.getElementById('tp-input');
                                if (tpEl) tpEl.value = agentTakeProfitPct;
                            }
                            if (msg.state.sl !== undefined) {
                                agentStopLossPct = msg.state.sl;
                                const slEl = document.getElementById('sl-input');
                                if (slEl) slEl.value = agentStopLossPct;
                            }
                            
                            saveState();
                            updateAgentStatsUI();
                            recalculatePortfolio(assetPrices[focusSymbol] || 68150, 0);
                            return;
                        }

                        // Ticks verarbeiten
                        const data = (msg.type === 'TICK') ? msg.data : msg;

                        if (data && data.e === 'aggTrade' && data.s) {
                            const symbolMap = { 
                                'BTCUSDT': 'BTCEUR', 'ETHUSDT': 'ETHEUR', 'SOLUSDT': 'SOLEUR', 'XRPUSDT': 'XRPEUR', 'DOGEUSDT': 'DOGEEUR'
                            };
                            const symbol = symbolMap[data.s];
                            if (symbol) {
                                const eurPrice = parseFloat(data.p) * 0.92;
                                const tradeDelta = data.m ? -parseFloat(data.q) : parseFloat(data.q);
                                handleMarketTick(symbol, eurPrice, tradeDelta);
                            }
                        }
                    } catch(err){}
                };

                activeWs.onerror = () => {
                    isBinanceConnected = false;
                    updateStatusBadge(false);
                    logAgentMessage(`⚠️ <span class="text-amber-400 font-bold">Cloud Stream blockiert.</span> Hochpräziser HFT-Fallback-Modus greift ein...`);
                };

                activeWs.onclose = () => {
                    isBinanceConnected = false;
                    updateStatusBadge(false);
                    setTimeout(startMultiStreamWebSocket, 5000); 
                };
            } catch (e) { console.error(e); }
        }

        function updateStatusBadge(isConnected) {
            const badge = document.getElementById('status-badge');
            if (!badge) return;
            if (isConnected) {
                badge.className = "text-[10px] sm:text-xs px-2.5 sm:px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl flex items-center gap-1.5 sm:gap-2 font-medium whitespace-nowrap transition-colors duration-300";
                badge.innerHTML = `<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse"></span> Render Sync`;
            } else {
                badge.className = "text-[10px] sm:text-xs px-2.5 sm:px-3 py-1.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-xl flex items-center gap-1.5 sm:gap-2 font-medium whitespace-nowrap transition-colors duration-300";
                badge.innerHTML = `<span class="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-500 animate-pulse"></span> Sim-Fallback`;
            }
        }

        window.simTrend = {};

        function startSystemEngines() {
            setInterval(() => {
                try {
                    updateTradingSessions();
                    
                    const moon = calculateMoonPhase();
                    const badge = document.getElementById('lunar-phase-badge');
                    if (badge && badge.innerText !== moon.name) {
                        badge.innerText = moon.name;
                        const iconEl = document.getElementById('lunar-icon');
                        if (iconEl) iconEl.innerText = moon.icon;
                        const nameEl = document.getElementById('lunar-name');
                        if (nameEl) nameEl.innerText = moon.name;
                        const biasEl = document.getElementById('lunar-bias-tag');
                        if (biasEl) biasEl.innerText = `Bias: ${moon.bias >= 0 ? '+' : ''}${moon.bias}% Score Correlation`;
                    }

                    if (!isBinanceConnected) {
                        TOP_50_ASSETS.forEach(sym => {
                            try {
                                const pair = sym + 'EUR';
                                const curr = assetPrices[pair] || 10;
                                
                                if (!window.simTrend[pair]) window.simTrend[pair] = 0;
                                window.simTrend[pair] += (Math.random() - 0.5) * 0.002;
                                window.simTrend[pair] *= 0.92; 
                                
                                const deltaPct = (Math.random() - 0.5) * 0.0018 + window.simTrend[pair]; 
                                const nextPrice = curr * (1 + deltaPct);
                                
                                assetChanges[pair] = (assetChanges[pair] || 0) + (deltaPct * 5); 
                                
                                const fakeDelta = (Math.random() - 0.45 + Math.sign(deltaPct) * 0.25) * 200; 
                                handleMarketTick(pair, nextPrice, fakeDelta);
                            } catch(innerE) {}
                        });
                    }
                    
                    renderTopMoversGrid();

                } catch(e) { console.error("Engine Loop Exception", e); }
            }, 1000); 
        }

        function handleMarketTick(symbol, livePrice, tradeDelta) {
            if (!livePrice || isNaN(livePrice)) return;

            assetPrices[symbol] = livePrice;

            if (!assetTickBuffers[symbol]) assetTickBuffers[symbol] = [];
            assetTickBuffers[symbol].push(livePrice);
            if (assetTickBuffers[symbol].length > 20) assetTickBuffers[symbol].shift();

            if (!assetCVD[symbol]) assetCVD[symbol] = 0;
            assetCVD[symbol] += Math.round(tradeDelta * 10);
            assetCVD[symbol] = Math.round(assetCVD[symbol] * 0.985); 

            if (!assetCVDHistory[symbol]) assetCVDHistory[symbol] = [];
            assetCVDHistory[symbol].push(assetCVD[symbol]);
            if (assetCVDHistory[symbol].length > 5) assetCVDHistory[symbol].shift();

            if (symbol === focusSymbol) {
                SpoofGuard.recordDelta(assetCVD[symbol]);
                
                const depotPriceEl = document.getElementById('depot-current-price');
                if (depotPriceEl) depotPriceEl.innerText = livePrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
                
                const cvdEl = document.getElementById('cvd-val');
                if (cvdEl) {
                    const cvdVal = Math.round(assetCVD[symbol]);
                    cvdEl.innerText = `${cvdVal >= 0 ? '+' : ''}${cvdVal} Δ`;
                    cvdEl.className = `text-2xl font-black ${cvdVal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`;
                }

                const atrVal = computeATRPercent();
                const atrEl = document.getElementById('atr-val');
                if (atrEl) atrEl.innerText = `${atrVal.toFixed(2)} %`;

                updateCandleData(livePrice);
                recalculatePortfolio(livePrice, 0);
            }

            if (agentActive && !isBinanceConnected) {
                processAgentAutoScannerLogic();
            }
        }

        function getAvailablePortfolioCapital() {
            let userDeposits = 0, userWithdrawals = 0;
            transactions.forEach(tx => {
                if (tx.type === 'DEPOSIT') userDeposits += tx.eur;
                else if (tx.type === 'WITHDRAW') userWithdrawals += tx.eur;
            });
            return (userDeposits - userWithdrawals) + agentState.totalProfit;
        }

        // ==========================================
        // HFT LOGIK & AGENT AUSFÜHRUNG
        // ==========================================

        function processAgentAutoScannerLogic() {
            const availableCap = getAvailablePortfolioCapital();
            if (availableCap < agentMargin && !agentState.inPosition) return;

            const sweepPill = document.getElementById('sweep-status-pill');
            const isSqueezed = isVolatilitySqueeze();
            const regime = detectMarketRegime(); 
            
            checkMultiTimeframeTrend('LONG'); 

            if (isSqueezed) {
                if (sweepPill) {
                    sweepPill.innerText = "🗜️ Squeeze (Warte...)";
                    sweepPill.className = "text-[9px] px-2 py-0.5 bg-amber-500/20 text-amber-300 rounded font-mono font-bold";
                }
            } else if (regime === "REGIME_CHOP" || currentMtfStatus === "CHOP") {
                if (sweepPill) {
                    sweepPill.innerText = "Chop / Flach (Sperre)";
                    sweepPill.className = "text-[9px] px-2 py-0.5 bg-rose-500/20 text-rose-300 rounded font-mono font-bold";
                }
            } else {
                if (sweepPill) {
                    sweepPill.innerText = "Regime & Squeeze OK";
                    sweepPill.className = "text-[9px] px-2 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-mono font-bold";
                }
            }

            let scanSymbols = selectedMode === "REAL_TEST" ? LIQUID_REAL_TEST_ASSETS : [focusSymbol];

            if (!agentState.inPosition) {
                if (regime === "REGIME_CHOP" || isSqueezed || currentMtfStatus === "CHOP") return;

                if (SpoofGuard.isSpoofDetected()) {
                    logAgentMessage(`⚠️ <span class="text-rose-400 font-bold">SPOOFING GEBLOCKT:</span> Fake-Orders im Orderbuch erkannt.`);
                    return;
                }

                let bestSymbol = null;
                let bestType = null;

                for (let sym of scanSymbols) {
                    const cvdVal = assetCVD[sym] || 0;
                    if (Math.abs(cvdVal) > 1000) {
                        bestSymbol = sym;
                        bestType = cvdVal >= 0 ? 'LONG' : 'SHORT';
                        break;
                    }
                }

                if (!bestSymbol) return; 

                if (!checkCrossAssetCorrelation(bestType)) return; 

                const targetPrice = assetPrices[bestSymbol];
                const cvdVal = assetCVD[bestSymbol] || 0;
                let minCvdRequired = computeAdaptiveCvdThreshold(bestSymbol);

                if (regime === "REGIME_EXPANSION") minCvdRequired = Math.round(minCvdRequired * 0.8); 

                if (!checkMultiTimeframeTrend(bestType)) return;

                const isLiquidationTarget = checkLiquidationCascadeTarget(bestType);

                if (bestSymbol && Math.abs(cvdVal) >= minCvdRequired) {
                    if (focusSymbol !== bestSymbol) {
                        focusSymbol = bestSymbol;
                        seedHistoricalCandles(assetPrices[focusSymbol]);
                        updateUIAssetLabels();
                    }
                    
                    const noteStr = isLiquidationTarget ? " (🎯 Liquidation-Target)" : "";
                    executeAgentOpen(bestSymbol, targetPrice, bestType, 92, noteStr);
                }
            } 
            else if (agentState.inPosition) {
                const sym = agentState.activeSymbol;
                const currentPrice = assetPrices[sym];
                if (!currentPrice) return;

                let rawPriceChangePct = ((currentPrice - agentState.buyPrice) / agentState.buyPrice) * 100;
                if (agentState.positionType === 'SHORT') rawPriceChangePct = -rawPriceChangePct;

                const totalPositionVol = agentMargin * agentLeverage;
                const grossProfitEuro = totalPositionVol * (rawPriceChangePct / 100);
                const totalTradeFees = totalPositionVol * (BASE_FEE_RATE * 2);
                const currentNetEuro = grossProfitEuro - totalTradeFees;

                if (currentNetEuro <= -MAX_ALLOWED_LOSS_EUR) {
                    logAgentMessage(`🚨 <span class="text-rose-400 font-bold">HARD-RISK TRIGGER (25% MAX):</span> Position wegen 5.000 € Verlustgrenze geschlossen.`);
                    executeAgentClose(currentPrice, rawPriceChangePct);
                    return;
                }

                const nowSec = Math.floor(Date.now() / 1000);
                const timeInTradeSec = agentState.buyTime ? (nowSec - agentState.buyTime) : 0;
                
                if (!agentState.breakEvenTriggered) {
                    const cvdVal = assetCVD[sym] || 0;
                    const hasMomentumSupport = (agentState.positionType === 'LONG' && cvdVal >= 500) || (agentState.positionType === 'SHORT' && cvdVal <= -500);

                    if ((timeInTradeSec >= 90 && !hasMomentumSupport) || timeInTradeSec >= 120) {
                        logAgentMessage(`⏱️ <span class="text-amber-400 font-bold">SMART TIMEOUT (${timeInTradeSec}s):</span> Seitwärtsfalle beendet. Position geschlossen.`);
                        executeAgentClose(currentPrice, rawPriceChangePct);
                        return;
                    }
                }

                if (rawPriceChangePct > agentState.peakProfitPct) {
                    agentState.peakProfitPct = rawPriceChangePct;
                }

                if (agentState.peakProfitPct >= 0.30 && !agentState.breakEvenTriggered) {
                    agentState.breakEvenTriggered = true;
                    agentState.dynamicSLPct = -0.18; 
                    logAgentMessage(`🛡️ <span class="text-indigo-400 font-bold">NETTO BREAK-EVEN:</span> Stop-Loss inkl. Gebühren (+0.18%) abgesichert.`);
                }

                let targetSL = null;
                
                if (rawPriceChangePct >= agentTakeProfitPct) {
                    const minLockedSL = agentTakeProfitPct - 0.15; 
                    const trailedSL = rawPriceChangePct - 0.15;     
                    targetSL = Math.max(minLockedSL, trailedSL);
                } else if (rawPriceChangePct >= 0.50) {
                    targetSL = rawPriceChangePct - 0.25;
                }

                if (targetSL !== null) {
                    const currentSL = -(agentState.dynamicSLPct || -agentStopLossPct);

                    if (targetSL > currentSL + 0.04) {
                        agentState.dynamicSLPct = -targetSL;
                        agentState.breakEvenTriggered = true;
                        
                        logAgentMessage(`🚀 <span class="text-emerald-400 font-bold">PROFIT TRAIL:</span> Stop-Loss angehoben auf <span class="text-white font-bold">+${targetSL.toFixed(2)}%</span>.`);
                    }
                }

                const currentEffectiveSL = agentState.breakEvenTriggered ? agentState.dynamicSLPct : agentStopLossPct;

                if (rawPriceChangePct <= -currentEffectiveSL) {
                    executeAgentClose(currentPrice, rawPriceChangePct);
                }
            }
        }

        function executeAgentOpen(symbol, price, type, confidence, extraNote = "") {
            const availableCap = getAvailablePortfolioCapital();
            if (availableCap < agentMargin) {
                logAgentMessage(`⚠️ <span class="text-rose-400 font-bold">FEHLER:</span> Unzureichendes Guthaben (${availableCap.toFixed(2)} €). Bitte einzahlen!`);
                toggleAgent();
                return;
            }

            const nowCandleTime = Math.floor(Date.now() / 1000);
            agentState.inPosition = true;
            agentState.activeSymbol = symbol;
            agentState.positionType = type;
            agentState.buyPrice = price;
            agentState.buyTime = nowCandleTime;
            agentState.peakProfitPct = 0;
            agentState.dynamicSLPct = agentStopLossPct;
            agentState.breakEvenTriggered = false;

            const fee = (agentMargin * agentLeverage) * BASE_FEE_RATE;
            agentState.totalFees += fee;

            const icon = type === 'LONG' ? '📈' : '📉';
            const color = type === 'LONG' ? 'text-emerald-400' : 'text-rose-400';

            logAgentMessage(`🤖 ${icon} <span class="${color} font-bold">${type} ORDER (${symbol} ${agentLeverage}x):</span> Einsatz ${agentMargin}€ @ ${price < 1 ? price.toFixed(4) : price.toFixed(2)} €${extraNote}`);
            updateAgentStatsUI();
            saveState();
            drawCandleCanvas();
        }

        function executeAgentClose(price, rawPriceChangePct) {
            const symbol = agentState.activeSymbol;
            agentState.inPosition = false;
            agentState.buyTime = 0;
            agentState.tradesCount++;

            const marginAmount = agentMargin;
            const totalPositionVol = marginAmount * agentLeverage;
            
            const grossProfitEuro = totalPositionVol * (rawPriceChangePct / 100);
            const totalTradeFees = totalPositionVol * (BASE_FEE_RATE * 2);
            const netProfitEuro = grossProfitEuro - totalTradeFees;

            agentState.totalProfit += netProfitEuro;
            agentState.totalFees += (totalPositionVol * BASE_FEE_RATE);

            const isWin = netProfitEuro > 0;
            if (isWin) agentState.winCount++;

            const newTx = {
                id: Date.now(),
                type: netProfitEuro >= 0 ? 'PROFIT' : 'LOSS',
                eur: Math.abs(netProfitEuro),
                timestamp: Date.now(),
                entryPrice: price,
                note: `🤖 ${symbol} ${agentState.positionType} ${agentLeverage}x (${netProfitEuro >= 0 ? '+' : ''}${netProfitEuro.toFixed(2)} € Netto)`
            };

            transactions.push(newTx);

            if (activeWs && activeWs.readyState === WebSocket.OPEN) {
                try {
                    activeWs.send(JSON.stringify({
                        type: 'TX_UPDATE',
                        tx: newTx
                    }));
                } catch(e) {}
            }

            saveState();

            const statusColor = isWin ? 'text-emerald-400' : 'text-rose-400';
            const closeReason = agentState.breakEvenTriggered && netProfitEuro >= 0 ? '🛡️ TRAILING/BREAK-EVEN' : (isWin ? '🎯 TAKE-PROFIT' : '🛑 STOP-LOSS / TIMEOUT');
            logAgentMessage(`🤖 <span class="${statusColor} font-bold">${closeReason} (${symbol}):</span> Closed @ ${price < 1 ? price.toFixed(4) : price.toFixed(2)} € | Netto: <span class="${statusColor}">${netProfitEuro >= 0 ? '+' : ''}${netProfitEuro.toFixed(2)} €</span>`);
            updateAgentStatsUI();
            drawCandleCanvas();
        }

        function toggleAgent() {
            agentActive = !agentActive;
            saveState();
            updateAgentStatsUI();
            
            if (agentActive) {
                logAgentMessage(`🚀 KI-Auto-Scanner gestartet.`);
            } else {
                logAgentMessage("⏸️ KI-Agent pausiert.");
            }

            updateRiskSettings(); 
        }

        function logAgentMessage(msg) {
            const logBox = document.getElementById('agent-log');
            if (!logBox) return;
            const timeStr = new Date().toLocaleTimeString('de-DE');
            const p = document.createElement('p');
            p.innerHTML = `<span class="text-slate-600">[${timeStr}]</span> ${msg}`;
            logBox.prepend(p);
            logBox.scrollTop = 0;
        }

        function updateAgentStatsUI() {
            const tradesEl = document.getElementById('bot-trades-count');
            if (tradesEl) tradesEl.innerText = agentState.tradesCount;

            const winRate = agentState.tradesCount > 0 ? ((agentState.winCount / agentState.tradesCount) * 100).toFixed(0) : 0;
            const winrateEl = document.getElementById('bot-winrate');
            if (winrateEl) winrateEl.innerText = `${winRate} %`;
            
            const botProfitEl = document.getElementById('bot-profit-euro');
            if (botProfitEl) {
                const isProfit = agentState.totalProfit >= 0;
                botProfitEl.innerText = `${isProfit ? '+' : ''}${agentState.totalProfit.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
                botProfitEl.className = `text-lg sm:text-3xl font-black mt-0.5 sm:mt-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'} truncate block`;
            }

            const btn = document.getElementById('toggle-agent-btn');
            const pill = document.getElementById('agent-active-pill');
            if (agentActive) {
                if (btn) {
                    btn.className = "px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/30 transition duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer animate-pulse";
                    btn.innerText = "⏹️ KI-Agent Stoppen";
                }
                if (pill) {
                    pill.className = "text-[10px] sm:text-xs px-2.5 py-1 rounded-xl font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap";
                    pill.innerText = `⚡ HFT ENGINE AKTIV (${agentLeverage}x)`;
                }
            } else {
                if (btn) {
                    btn.className = "px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30 transition duration-200 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer";
                    btn.innerText = "▶️ KI-Agent Starten";
                }
                if (pill) {
                    pill.className = "text-[10px] sm:text-xs px-2.5 py-1 rounded-xl font-bold bg-slate-800 text-slate-400 border border-slate-700/80 whitespace-nowrap";
                    pill.innerText = "⏹️ GESTOPPT";
                }
            }
        }

        function recalculatePortfolio(currentPrice, change24h) {
            let userDeposits = 0, userWithdrawals = 0;

            transactions.forEach(tx => {
                if (tx.type === 'DEPOSIT') userDeposits += tx.eur;
                else if (tx.type === 'WITHDRAW') userWithdrawals += tx.eur;
            });

            const netInvestedEur = userDeposits - userWithdrawals;
            const currentPortfolioValue = Math.max(0, netInvestedEur + agentState.totalProfit);
            
            const valEl = document.getElementById('depot-value');
            if (valEl) {
                valEl.innerText = currentPortfolioValue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
                valEl.classList.add('truncate', 'block');
            }

            const assetAmtEl = document.getElementById('depot-asset-amount');
            if (assetAmtEl) assetAmtEl.innerText = `${getAvailablePortfolioCapital().toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })} Verfügbares Cash`;

            renderHistoryTable();
        }

        function renderHistoryTable() {
            const tbody = document.getElementById('tx-history-body');
            if (!tbody) return;
            tbody.innerHTML = '';

            transactions.slice().reverse().forEach(tx => {
                const tr = document.createElement('tr');
                tr.className = "border-b border-slate-800/50 hover:bg-slate-800/30";
                const dateStr = new Date(tx.timestamp).toLocaleString('de-DE');

                let typeLabel = tx.type === 'DEPOSIT' ? '➕ Einzahlung' : (tx.type === 'WITHDRAW' ? '➖ Auszahlung' : (tx.type === 'PROFIT' ? '📈 Bot-Gewinn' : '📉 Bot-Verlust'));
                let typeClass = tx.type === 'DEPOSIT' || tx.type === 'PROFIT' ? 'text-emerald-400' : 'text-rose-400';

                tr.innerHTML = `
                    <td class="p-2 sm:p-2.5 font-bold ${typeClass}">${typeLabel}</td>
                    <td class="p-2 sm:p-2.5 text-slate-300">${dateStr}</td>
                    <td class="p-2 sm:p-2.5 font-semibold ${typeClass}">${tx.eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                    <td class="p-2 sm:p-2.5 text-slate-400">${tx.entryPrice ? tx.entryPrice.toFixed(2) + ' €' : '-'}</td>
                    <td class="p-2 sm:p-2.5 text-slate-400 italic">${tx.note || '-'}</td>
                `;
                tbody.appendChild(tr);
            });
        }

        function executeDeposit() {
            const amountInput = document.getElementById('deposit-amount');
            const noteInput = document.getElementById('deposit-note');
            if (!amountInput) return;

            const amount = parseFloat(amountInput.value);
            if (!amount || amount <= 0 || isNaN(amount)) return;

            const newTx = { id: Date.now(), type: 'DEPOSIT', eur: amount, timestamp: Date.now(), entryPrice: assetPrices[focusSymbol] || 68150, note: (noteInput && noteInput.value) ? noteInput.value : 'Manuell' };
            transactions.push(newTx);
            amountInput.value = '';
            if (noteInput) noteInput.value = '';

            const modal = document.getElementById('deposit-modal');
            if (modal) modal.classList.add('hidden');
            saveState();

            if (activeWs && activeWs.readyState === WebSocket.OPEN) {
                try {
                    activeWs.send(JSON.stringify({ type: 'TX_UPDATE', tx: newTx }));
                } catch(e){}
            }

            recalculatePortfolio(assetPrices[focusSymbol] || 68150, 0);
        }

        function executeWithdraw() {
            const amountInput = document.getElementById('withdraw-amount');
            const noteInput = document.getElementById('withdraw-note');
            if (!amountInput) return;

            const amount = parseFloat(amountInput.value);
            if (!amount || amount <= 0 || isNaN(amount)) return;

            const newTx = { id: Date.now(), type: 'WITHDRAW', eur: amount, timestamp: Date.now(), entryPrice: assetPrices[focusSymbol] || 68150, note: (noteInput && noteInput.value) ? noteInput.value : 'Manuell' };
            transactions.push(newTx);
            amountInput.value = '';
            if (noteInput) noteInput.value = '';

            const modal = document.getElementById('withdraw-modal');
            if (modal) modal.classList.add('hidden');
            saveState();

            if (activeWs && activeWs.readyState === WebSocket.OPEN) {
                try {
                    activeWs.send(JSON.stringify({ type: 'TX_UPDATE', tx: newTx }));
                } catch(e){}
            }

            recalculatePortfolio(assetPrices[focusSymbol] || 68150, 0);
        }

        function resetTransactions() {
            if (confirm("Depot und KI-Agent-Statistiken zurücksetzen?")) {
                localStorage.clear();
                
                if (activeWs && activeWs.readyState === WebSocket.OPEN) {
                    try { activeWs.send(JSON.stringify({ type: 'RESET_STATE' })); } catch(e){}
                }
                
                location.reload();
            }
        }

        function updateRiskSettings(isFromRemote = false) {
            const levIn = document.getElementById('leverage-select');
            if (levIn) agentLeverage = parseInt(levIn.value);
            
            const marIn = document.getElementById('margin-input');
            if (marIn) agentMargin = parseFloat(marIn.value) || 5000;

            const tpIn = document.getElementById('tp-input');
            if (tpIn) agentTakeProfitPct = parseFloat(tpIn.value) || 0.75;

            const slIn = document.getElementById('sl-input');
            if (slIn) agentStopLossPct = parseFloat(slIn.value) || 1.25;

            const tag = document.getElementById('leverage-display-tag');
            if (tag) tag.innerText = `${agentLeverage}x | ${agentMargin}€ | HFT Pro Mode`;

            saveState();

            if (!isFromRemote && activeWs && activeWs.readyState === WebSocket.OPEN) {
                try {
                    activeWs.send(JSON.stringify({
                        type: 'PARAM_UPDATE',
                        data: {
                            leverage: agentLeverage,
                            margin: agentMargin,
                            tp: agentTakeProfitPct,
                            sl: agentStopLossPct,
                            agentActive: agentActive 
                        }
                    }));
                } catch(e){}
            }
        }

        function switchAsset(mode) {
            selectedMode = mode;
            if (mode !== "AUTO" && mode !== "REAL_TEST") {
                focusSymbol = mode;
            } else if (mode === "REAL_TEST") {
                focusSymbol = "BTCEUR";
            }
            seedHistoricalCandles(assetPrices[focusSymbol] || 68150);
            updateUIAssetLabels();
            renderTopMoversGrid();
        }

        function updateUIAssetLabels() {
            const assetBase = focusSymbol.replace("EUR", "");
            document.querySelectorAll('.active-asset-label').forEach(el => el.innerText = assetBase);
        }

        function saveState() {
            localStorage.setItem('btc_trader_txs_v4', JSON.stringify(transactions));
            localStorage.setItem('btc_agent_active_v4', JSON.stringify(agentActive));
            localStorage.setItem('btc_agent_leverage_v4', JSON.stringify(agentLeverage));
            localStorage.setItem('btc_agent_margin_v4', JSON.stringify(agentMargin));
            localStorage.setItem('btc_agent_tp_v4', JSON.stringify(agentTakeProfitPct));
            localStorage.setItem('btc_agent_sl_v4', JSON.stringify(agentStopLossPct));
            localStorage.setItem('btc_agent_trades_v4', JSON.stringify(agentState.tradesCount));
            localStorage.setItem('btc_agent_wins_v4', JSON.stringify(agentState.winCount));
            localStorage.setItem('btc_agent_profit_v4', JSON.stringify(agentState.totalProfit));
        }

        function initDashboard() {
            checkAuthOnLoad();
            populateAssetSelectOptions();
            updateUIAssetLabels();
            updateAgentStatsUI();
            updateRiskSettings(true);
            renderTopMoversGrid();
            seedHistoricalCandles(68150);
            startSystemEngines();

            setTimeout(() => { startMultiStreamWebSocket(); }, 200);
        }

        window.onload = initDashboard;
    </script>
</body>
</html>
