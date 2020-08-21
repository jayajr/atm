'use strict'

const readline = require('readline');

const { Atm } = require('./atm');

async function main() {
    const accountFileName = 'accounts.csv';
    const historyFileName = 'history.log';
    const cashFileName = 'cash.data';

    const atm = new Atm(accountFileName, historyFileName, cashFileName);
    await atm.initializeAtm();

    /* Sets up interface and events for reading user input
     */
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.setPrompt('JRom Bank> ');
    rl.prompt();
    rl.on('line', (line) => {
        /* On user input parse the line and handle exit
         */
        const [command, ...options] = line.split(' ');
        switch(command.toUpperCase()) {
            case 'EXIT':
                rl.close();
                rl.removeAllListeners();
                process.exit();
                break;
            default:
                atm.processCommand(command, options);
                rl.prompt();
                break;
        }
    })
}

main();
