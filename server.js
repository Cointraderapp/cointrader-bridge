const http = require('http');
const WebSocket = require('ws');
const PORT = process.env.PORT || 3000;

// HTTP-Server für Keep-Alive & Uptime-Pings
const httpServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK - Cointrader Bridge Active');
});

const server = new WebSocket.Server({ server: httpServer });

let globalState = {
    depotValue: 20000,
    botProfit: 0,
    tradesCount: 0,
    winCount: 0,
    history: []
};

let binanceWs = null;

function connectBinance() {
    binanceWs = new WebSocket('wss://fstream.binance.com/ws');

    binanceWs.on('open', () => {
        binanceWs.send(JSON.stringify({
            method: 'SUBSCRIBE',
            params: ['btcusdt@aggTrade', 'ethusdt@aggTrade', 'solusdt@aggTrade', 'xrpusdt@aggTrade', 'dogeusdt@aggTrade'],
            id: 1
        }));
    });

    binanceWs.on('message', (raw) => {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.e === 'aggTrade') {
                broadcast(JSON.stringify({ type: 'TICK', data: parsed, state: globalState }));
            }
        } catch(e) {}
    });

    binanceWs.on('close', () => setTimeout(connectBinance, 3000));
    binanceWs.on('error', () => {});
}

function broadcast(data) {
    server.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(data);
    });
}

server.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'SYNC_STATE', state: globalState }));

    socket.on('message', (msg) => {
        try {
            const action = JSON.parse(msg);
            if (action.type === 'EXECUTE_TRADE') {
                globalState.tradesCount++;
                if (action.profit > 0) globalState.winCount++;
                globalState.botProfit += action.profit;
                globalState.depotValue += action.profit;
                if (action.tx) globalState.history.push(action.tx);

                broadcast(JSON.stringify({ type: 'STATE_UPDATE', state: globalState }));
            }
        } catch(e) {}
    });
});

httpServer.listen(PORT, () => {
    connectBinance();
});
