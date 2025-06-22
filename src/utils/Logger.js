// Implementation of logging utility

const fs = require('fs');
const path = require('path');

const logsDir = path.join(__dirname, '../../logs');

if(!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, {recursive: true});
}

const cacheLogFile = path.join(logsDir, 'cache.log');

class Logger {
    static logCache(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;
        
        fs.appendFileSync(cacheLogFile, logEntry);
    }

    //log important info to both console and log file
    static logImportant(message) {
        console.log(message);
        this.logCache(message);
    }
}

module.exports = Logger;