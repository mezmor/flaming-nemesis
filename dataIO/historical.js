// historical.js
// Driver responsible for reading historical transaction data and building variable length candles
var EventEmitter = require("events").EventEmitter;
var fs = require("fs");
var config = require("../config");
var winston = require("winston");
var url = require('url');
var http = require('http');
var zlib = require('zlib');
var path = require("path");

// Constructor, we call EventEmitter's constructor because we subclass it
var Historical = function(opts, demon) {
    this.demon = demon;
    this.data = path.resolve("data/" + opts.datafile + ".csv").toString();
    this.pullNew = opts.pullNew;
    this.dateStr = opts.startDate;
    EventEmitter.call(this);
};

// Inherit EventEmitter's prototype
Historical.prototype.__proto__ = EventEmitter.prototype;

Historical.prototype.start = function() {
    // Begin reading data
    this.emit("start"); // Test emit
    
    // Calculate starting date
    var d = this.dateStr.split("-");
    var startDate = new Date(d.shift(), parseInt(d.shift())-1, d.shift());
    
    // Pull new data file if we need to
    if (this.pullNew || !fs.existsSync(this.data)) {
        var dataURL = "http://api.bitcoincharts.com/v1/csv/" + 
            this.data.split("\\").pop().split("/").pop() + ".gz";
        this.downloadData(dataURL, startDate, this.read.bind(this));
    } else {
        this.read(startDate);
    }
};

// Assumes the data to be structured as: (time, price, volume)
Historical.prototype.read = function(startDate) {
    winston.info("Using data file " + this.data);
    var array = fs.readFileSync(this.data).toString().split('\n');

    // Candles are: (1m [60s], 15m [900s], 1h [3600s], 4h [14400s], 24h
    // [86400s])
    // Candle: start, open, low, high, close
    candles = {
        "1m" : {},
        "15m" : {},
        "1h" : {},
        "4h" : {},
        "24h" : {}
    };
    
    for (var i = 0; i < array.length; i++) {
        var line = array[i].split(",");
        var currentTransaction = {
            "time" : parseInt(line[0]),
            "price" : parseFloat(line[1]),
            "volume" : parseFloat(line[2])
        };
        
        if (currentTransaction.time * 1000 < startDate.getTime()) {
            continue;
        }
        
        // Update each candle
        for ( var candleType in candles) {
            var candle = candles[candleType];
            
            if (!candle.start) {
                // This is a new candle!
                initData(candle, currentTransaction);
            } else {
                // If we complete a candle, we emit the current candle.
                // We don't add the currentTransaction to the current candle
                // Otherwise we add the current transaction data to the candle
                var timeDelta = currentTransaction.time - candle.start;
                if ((timeDelta > 86400) & (candleType === "24h")) {
                    this.emit("candle", candle, "24h");
                    candle = candles[candleType] = {};
                    initData(candle, currentTransaction);
                } else if ((timeDelta > 14400) & (candleType === "4h")) {
                    this.emit("candle", candle, "4h");
                    candle = candles[candleType] = {};
                    initData(candle, currentTransaction);
                } else if ((timeDelta > 3600) & (candleType === "1h")) {
                    this.emit("candle", candle, "1h");
                    candle = candles[candleType] = {};
                    initData(candle, currentTransaction);
                } else if ((timeDelta > 900) & (candleType === "15m")) {
                    this.emit("candle", candle, "15m");
                    candle = candles[candleType] = {};
                    initData(candle, currentTransaction);
                } else if ((timeDelta > 60) & (candleType == "1m")) {
                    this.emit("candle", candle, "1m");
                    candle = candles[candleType] = {};
                    initData(candle, currentTransaction);
                } else {
                    candle.close = currentTransaction.price;
                    candle.volume += currentTransaction.volume;
                    // Add transaction data to candle
                    if (currentTransaction.price > candle.high) {
                        // This is a new high
                        candle.high = currentTransaction.price;
                    } else if (currentTransaction.price < candle.low) {
                        // This is a new low
                        candle.low = currentTransaction.price;
                    }
                }
            }
        }
        this.emit("new-data", currentTransaction);
    }
    this.emit("done");
};

// Initialize a candle with the currentTransaction
function initData(candle, currentTransaction) {
    candle.start = currentTransaction.time;
    candle.open = candle.close = currentTransaction.price;
    candle.high = candle.low = currentTransaction.price;
    candle.volume = currentTransaction.volume;
};

// Download data file from URL
// code from http://www.hacksparrow.com/using-node-js-to-download-files.html
Historical.prototype.downloadData = function(file_url, startDate, cb) {
    winston.info("Downloading data file " + file_url);
    console.log("Downloading data file " + file_url);
    var downloadDir = 'data/';

    // We will be downloading the files to a directory, so make sure it's there
    // This step is not required if you have manually created the directory
    fs.mkdir(downloadDir, function(err) {
        if (err && err.code != 'EEXIST') throw err;
        else download_file_httpget(file_url);
    });

    // Function to download file using HTTP.get
    var download_file_httpget = function(file_url) {
    var options = {
        host: url.parse(file_url).host,
        port: 80,
        path: url.parse(file_url).pathname
    };

    var file_name = url.parse(file_url).pathname.split('/').pop();
    var file = fs.createWriteStream(downloadDir + file_name);

    http.get(options, function(res) {
        res.on('data', function(data) {
                file.write(data);
        }).on('end', function() {
            file.end();
            winston.info(file_name + ' downloaded to ' + downloadDir);
            console.log(file_name + ' downloaded to ' + downloadDir);
            console.log(downloadDir + file_name.split(".").slice(0,-1).join('.'));

            zlib.unzip(fs.readFileSync(downloadDir + file_name), function(err, buffer) {
                if (err) {
                    console.log(err);
                } else {
                    fs.writeFileSync(downloadDir + file_name.split(".").slice(0,-1).join('.'), buffer);
                }
                cb(startDate);
            });       
        });
    });
    };
};

// Set Historical's prototype functions:
// convert trade data into candlestick data at different ranges
// emit the "candle-found" event, listeners will act appropriately 

//Expose the constructor
module.exports = Historical;

