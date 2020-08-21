'use strict'

const fs = require('fs');
const fsp = fs.promises;

class Atm {
    /* ==================== 
     * Constructing the ATM
     * ====================
     */
    constructor(accounts, history, cash) {
        this.accountsFileName = accounts;
        this.historyFileName = history;
        this.cashFileName = cash;

        this.timerLengthMs = 2 * 60 * 1000;
        this.accounts = null;
        this.authorizedAccount = null;
        this.cash = null;
    }

    async initializeAtm() {
        /* Accounts preprocessing
         *  0. Read file
         *  1. Convert file buffer to string
         *  2. Split string by line
         *  3. Reduce to one map
         *      3.1. Get accountId, pin, and balance from line
         *      3.2. Store account info in map for easier use
         *      3.3. Keep this map in `this.accounts`
         */

        let accountsFile;
        try {
            accountsFile = await fsp.readFile(this.accountsFileName);
            this.accounts = accountsFile.toString()
                .split('\n')
                .reduce((acc, line, i) => {
                    if (i > 0 && line.length > 0) {
                        let [accountId, pin, balance] = line.split(',');
                        acc[accountId] = {
                            pin: parseInt(pin, 10),
                            balance: parseFloat(balance)
                        }
                    }
                    return acc;
                }, {});
        } catch (error) {
            console.log({message:'Error processing accounts', error });
            process.exit();
            return;
        }

        let cashFile;
        try {
            cashFile = await fsp.readFile(this.cashFileName);
            this.cash = parseFloat(cashFile.toString());
        } catch (error) {
            this.cash = 10000;
        }
    }


    /* ========================
     * Commands in the document
     * ========================
     */
    authorize([accountId, pin]) {
        if (!this.checkAccountId(accountId) || !this.checkPin(pin)) {
            return;
        }

        if (this.authorizedAccount) {
            console.log('Please log out first.');
            return;
        }

        if (this.accounts[accountId].pin !== parseInt(pin, 10)) {
            console.log('Authorization Failed');
            return;
        }

        console.log(accountId, 'successfully authorized.');
        this.authorizedAccount = accountId;
        this.setAuthTimer();

    }

    withdraw([value]) {
        if (!this.checkWithdrawValue(value)) {
            return;
        }

        value = parseInt(value);
        if (this.cash - value < 0) {
            console.log('Unable to dispense full amount requested at this time');
            return;
        }

        if (this.accounts[this.authorizedAccount].balance < 0) {
            console.log('Your account is overdrawn! You may not make withdrawals at this time.');
            return;
        }

        this.accounts[this.authorizedAccount].balance -= value
        this.postTransaction(-value);
        console.log('Amount dispensed: $', value);

        if (this.accounts[this.authorizedAccount].balance < 0) {
            this.accounts[this.authorizedAccount].balance -= 5;
            console.log(
                'You have been charged an overdraft fee of $5. Current balance: $',
                this.accounts[this.authorizedAccount].balance
            );
            return;
        }

        console.log(
            'Current balance: $', 
            this.accounts[this.authorizedAccount].balance
        );
    }

    deposit([value]) {
        if (!this.checkDepositValue(value)) {
            return;
        }

        value = parseFloat(value);
        this.cash += value;
        this.accounts[this.authorizedAccount].balance += value;
        this.postTransaction(value);
        console.log(
            'Current balance: $',
            this.accounts[this.authorizedAccount].balance
        );
    }

    balance() {
        console.log(
            'Current balance:',
            this.accounts[this.authorizedAccount].balance.toString()
        );
        return;
    }

    history() {
        this.myHistory = this.historyRead();
        this.historyPrint(); 
    }

    logout() {
        if (!this.authorizedAccount && this.authorizedAccount !== 0) {
            console.log('No account is currently authorized');
            return;
        }

        console.log('Account', this.authorizedAccount, 'logged out.');
        this.authorizedAccount = null;
        process.stdout.write('JRom Bank> ');
    }

    /* ================
     * Helper Functions
     * ================
     */
    processCommand(command, options) {
        /* Commands ignore positional arguments after required ones.
         *  Eg: `deposit 100 101` (Ignores 101 input. Deposits 100)
         *      `history abc1234` (Ignores abc1234. Gives history of auth'd acct)
         */
        let cmd = command.toUpperCase()
        switch (cmd) {
            /* Non-auth commands
             */
            case 'AUTHORIZE':
                this.authorize(options);
                break;
            case 'LOGOUT':
                clearTimeout(this.inactivityTimer);
                this.logout();
                break;

            /* Auth-required commands
             */
            default:
                if (!this.authorizedAccount && this.authorizedAccount !== 0) {
                    console.log('Authorization required.');
                    return;
                };

                switch(cmd) {
                    case 'WITHDRAW':
                        this.withdraw(options);
                        break;
                    case 'DEPOSIT':
                        this.deposit(options);
                        break;
                    case 'BALANCE':
                        this.balance();
                        break;
                    case 'HISTORY':
                        this.history();
                        break;
                    default:
                        console.log('Not a valid command.');
                        break;
                }
                this.resetAuthTimer();
                break;
        }
    }

    /* =====================
     * Auth Timing Functions
     * =====================
     */
    setAuthTimer() {
        this.inactivityTimer = setTimeout(() => {
            this.logout();
        }, this.timerLengthMs);
    };


    resetAuthTimer() {
        clearTimeout(this.inactivityTimer);
        this.setAuthTimer();
    }


    /* =======================
     * Input Validity Checkers
     * =======================
     */
    checkAccountId(accountId) {
        let check = true;

        if (!accountId && accountId !== 0) {
            check = false;
        }

        if (!this.accounts[accountId]) {
            check = false;
        }

        if (!check) {
            console.log('Please verify your account id.');
        }

        return check;
    }

    checkPin(pin) {
        let check = true;
        if (!pin && pin !== 0) {
            check = false;
        }

        check = check && !isNaN(pin);

        if (!check) {
            console.log('Please verify your PIN.');
        }

        return check;
    }

    checkWithdrawValue(value) {
        let check = true;
        if (!value) {
            check = false;
        }

        check = check && !isNaN(value)
            && parseFloat(value) % 20 === 0
            && value >= 20;


        if (!check) {
            console.log('Please enter a valid number.');
        }

        return check;
    }

    checkDepositValue(value) {
        let check = true;
        if (!value) {
            check = false;
        }

        check = check && !isNaN(parseFloat(value))
            && parseFloat(value) >= 0;

        if (!check) {
            console.log('Please enter a valid number.');
        }

        return check;
    }

    /* ===============
     * Posttransaction
     * ===============
     */
    async postTransaction(diff) {
        const date = new Date();
        const balance = this.accounts[this.authorizedAccount].balance;
        fs.appendFileSync(
            this.historyFileName,
            `${this.authorizedAccount} ${date.toISOString()} ${diff} ${balance}\n`
        );

        let accountData = ["ACCOUNT_ID,PIN,BALANCE"];
        Object.entries(this.accounts)
            .forEach((entry) => {
                const [account, details] = entry;
                const {pin, balance} = details;
                accountData.push(`${account.toString()},${pin},${balance}`);
            });
        fs.writeFileSync(this.accountsFileName, accountData.join('\n'));

        fs.writeFileSync(this.cashFileName, this.cash.toString());
    }

    /* =======
     * History
     * =======
     */
    historyRead() {
        try {
            const historyFile = fs.readFileSync(this.historyFileName);    
            return historyFile.toString()
                .split('\n')
        } catch (error) {
            // No history file
            return []
        }
    }

    historyPrint() {
        if (this.myHistory.length > 0) {
            this.myHistory.reverse().forEach((line) => {
                const [account, ...etc] = line.split(' ');;
                if (parseInt(account) === this.authorizedAccount) {
                    console.log(etc.join(' '));
                }
            });
        } else {
            console.log('No history found.');
        }
    }
}

module.exports = {
    Atm
}
