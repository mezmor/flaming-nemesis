// config.js
var path = require("path");

var config = {};

// Optional log file.  Uncomment to use.
config.outfile = path.resolve(__dirname, "log.log").toString();

config.datafile = path.resolve(__dirname, "data/mtgoxRUB.csv").toString();

// backtest mode
var backtest = {
    data : "historical",
    advisor : "durin",
    trader : "dummyTrader"
};

// live monitor mode
// reads live data but does not do real trades
var liveMonitor = {
    data : "live",
    advisor : "durin",
    trader : "dummyTrader"
};

// live trade mode
// reads live data, makes real trades
var liveTrade = {
    data : "live",
    advisor : "durin",
    trader : "realTrader"
};

// Set what mode we're using, needs to be after backtest declaration
config.mode = backtest;

// backtest-specific supplemental config options
config.backtest = {
    pullNew : false
};

// dummy trader options
config.dummyTrader = {
    initialMoney : 0,
    initialAssets : 3,
    tradePercentages : {
        "1m"  : 0.01,
        "15m" : 0.05,
        "1h"  : 0.10,
        "4h"  : 0.20,
        "24h" : 0.30
    },
    assetReservePercentage : 0.20,
    fee : 0.02,
    inefficiency : 0.01
};

module.exports = config;
