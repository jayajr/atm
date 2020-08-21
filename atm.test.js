'use strict'

const { Atm } = require('./atm');
const fs = require('fs');

let atm;
let consoleLogSpy;

jest.useFakeTimers();

describe('ATM Testing', () => {
    beforeEach(() => {
        /* Setting up atm test env
         */
        atm = new Atm('test-account', 'test-history', 'test-cash');
        atm.accounts = {
            '0': {
                pin: 0,
                balance: 20,
            },
            '1': {
                pin: 1,
                balance: 40,
            }
        };
        atm.cash = 100;

        consoleLogSpy = jest.spyOn(console, 'log');
    });

    afterEach(() => {
        jest.clearAllMocks();

        // Stop logout timer
        clearTimeout(atm.inactivityTimer);

        // Will delete history if withdraw/deposit were called
        try {
            fs.unlinkSync(atm.accountsFileName);
            fs.unlinkSync(atm.historyFileName);
            fs.unlinkSync(atm.cashFileName);
        } catch (error) {
            // pass
        }
    });


    describe('AUTHORIZE', () => {
        it('should deny access when wrong pin', () => {
            atm.processCommand('authorize', [0, 1]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Authorization Failed');
        });

        it('should deny access when account doesnt exist', () => {
            atm.processCommand('authorize', [2, 2]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Please verify your account id.');
        });

        it('should login when credentials are correct', () => {
            atm.processCommand('authorize', [0, 0]);
            expect(consoleLogSpy).toHaveBeenCalledWith(0, 'successfully authorized.');
        });

        it('should timeout after a period of inactivity', () => {
            let timeoutSpy = jest.spyOn(atm, 'logout');
            atm.processCommand('authorize', [0, 0]);
            jest.advanceTimersByTime(2 * 60 * 1000);
            expect(setTimeout).toHaveBeenCalled();
            expect(timeoutSpy).toHaveBeenCalled();
        });
    });

    describe('WITHDRAW', () => {
        it('should deny access when unauthorized', () => {
            atm.processCommand('withdraw', [1000]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Authorization required.');
        });

        it('should not allow withdrawals that are not multiples of 20', () => {
            atm.processCommand('authorize', [0, 0]);
            atm.processCommand('withdraw', [10]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Please enter a valid number.');
        });

        it('should not allow negative withdrawals', () => {
            atm.processCommand('authorize', [0, 0]);
            atm.processCommand('withdraw', [-10]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Please enter a valid number.');
        });


        it('should not allow withdrawals > cash on hand', () => {
            atm.processCommand('authorize', [0, 0]);
            atm.processCommand('withdraw', [120]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Unable to dispense full amount requested at this time');
        });

        it('should add a $5 penalty if you overdraft and not allow you to withdraw afterwards', () => {
            atm.processCommand('authorize', [0, 0]);
            let startingBalance = atm.accounts['0'].balance;
            atm.processCommand('withdraw', [40]);
            expect(atm.accounts['0'].balance).toBe(startingBalance - 40 - 5);
            atm.processCommand('withdraw', [20]);
            expect(consoleLogSpy)
                .toHaveBeenCalledWith('Your account is overdrawn! You may not make withdrawals at this time.');
        });
    });

    describe('DEPOSIT', () => {
        it('should deny access when unauthorized', () => {
            atm.processCommand('deposit', [1000]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Authorization required.');
        });

        it('should not allow negative deposits', () => {
            atm.processCommand('authorize', [0, 0]);
            atm.processCommand('deposit', [-10]);
            expect(consoleLogSpy).toHaveBeenCalledWith('Please enter a valid number.');
        });

        it('should allow any positive value for deposits', () => {
            atm.processCommand('authorize', [0, 0]);
            let startingBalance = atm.accounts['0'].balance;
            atm.processCommand('deposit', [10.30]);
            expect(atm.accounts['0'].balance).toBe(startingBalance + 10.30);
        });

    });

    describe('BALANCE', () => {
        it('should deny access when unauthorized', () => {
            atm.processCommand('balance');
            expect(consoleLogSpy).toHaveBeenCalledWith('Authorization required.');
        });

        it('should be equal to 20', () => {
            atm.processCommand('authorize', [0, 0]);
            atm.processCommand('balance');
            expect(consoleLogSpy).toHaveBeenCalledWith('Current balance:', '20');
        });

        it('should be equal to 40', () => {
            atm.processCommand('authorize', [1, 1]);
            atm.processCommand('balance');
            expect(consoleLogSpy).toHaveBeenCalledWith('Current balance:', '40');
        });
    });

    describe('HISTORY', () => {
        it('should deny access when unauthorized', () => {
            atm.processCommand('history');
            expect(consoleLogSpy).toHaveBeenCalledWith('Authorization required.');
        });

        it('should return with no history if there is none', () => {
            atm.processCommand('authorize', [0, 0]);
            atm.processCommand('history');
            expect(consoleLogSpy).toHaveBeenCalledWith('No history found.');
        });

        it('should return reverse history of only the authorized account', () => {
            atm.historyRead = () => ([
                '1 2020-08-21T16:16:13.460Z 1 41',
                '1 2020-08-21T16:25:36.318Z 10 51',
                '0 2020-08-21T16:25:38.471Z 30 50',
                '0 2020-08-21T16:25:41.748Z -40 10',
                '0 2020-08-21T16:25:44.492Z -40 -35',
                '0 2020-08-21T16:25:48.934Z 35 0',
            ]);

            atm.processCommand('authorize', [0,0]);
            atm.processCommand('history');
            expect(consoleLogSpy).toHaveBeenCalledTimes(5);
            expect(consoleLogSpy.mock.calls[1][0]).toBe('2020-08-21T16:25:48.934Z 35 0');

        });

    });
});
