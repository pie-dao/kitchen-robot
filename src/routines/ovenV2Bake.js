const Table = require('cli-table2');
const gasNow = require('../apis/gasnow');  
const l = require('../classes/logger').logger;

const MAX_GAS = 110000000000;

async function checkOven(ov) {    
    try {

        if( ov.currentBakeSession.shouldBake && !ov.txInProgress()) {
            let gasPrices = await gasNow.fetchGasPrice();
            const table1 = new Table({ style: { head: [], border: [] } });
            table1.push(['Rapid', 'Fast', 'Standard', 'Timestamp']);
            table1.push([gasPrices.rapid, gasPrices.fast, gasPrices.standard, gasPrices.timestamp]);
            console.log(table1.toString())

            if(gasPrices.fast < MAX_GAS) {
                let baketx = await ov.dobake();
            } else {
                console.log('\n Gas price too high, checking again in a bit.\n');
            }
        }

    } catch (e) {
        console.log(e.message);
    }
}

async function run(ovens) {
    try {
        for (const ov of ovens) {
            await checkOven(ov)
        }
    } catch(e) {
        l.e(e.message);
    }
}

module.exports = {
    run
}