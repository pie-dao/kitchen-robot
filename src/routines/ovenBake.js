const ethers = require('ethers');
const chalk = require('chalk');
const emoji = require('node-emoji-new');
const cliProgress = require('cli-progress');
const Table = require('cli-table2');
const ovenABI = require('../abis/oven.json');
const recipeABI = require('../abis/recipe.json');
const gasNow = require('../apis/gasnow');  
const discord = require('../apis/discord');

const wallet = require('../wallet').wallet;
const provider = require('../wallet').provider;
const l = require('../classes/logger').logger;

const MaxETHTranche = ethers.utils.parseEther("10");
const ovens = [
    {
        addressOven: '0x0c4Ff8982C66cD29eA7eA96d985f36aE60b85B1C',
        deprecated: false,
        name: 'PLAY Oven',
        description: 'Bakes PLAY at Zero cost',
        minimum: 10,
        maxETHtranch: ethers.utils.parseEther("30"),
        data: {
            ethBalance: 0,
            pieBalance: 0
        },
        baking: {
            symbol: "PLAY",
            address: '0x33e18a092a93ff21ad04746c7da12e35d34dc7c4',
        },
        highlight: true,
        enabled: true,
        historicData: {
                style: {line: 'red'},
                x: [],
                y: []
            }
    },
    {
      addressOven: '0x1d616dad84dd0b3ce83e5fe518e90617c7ae3915',
      deprecated: false,
      name: 'DEFI++ Oven',
      maxETHtranch: ethers.utils.parseEther("10"),
      description: 'Bakes DEFI++ at Zero cost',
      minimum: 10,
      data: {
        ethBalance: 0,
        pieBalance: 0
      },
      baking: {
          symbol: "DEFI++",
          address: "0x8d1ce361eb68e9e05573443c407d4a3bed23b033",
      },
      highlight: true,
      enabled: true,
      historicData: {
            style: {line: 'red'},
            x: [],
            y: []
        }
    },
    {
      addressOven: '0xE3d74Df89163A8fA1cBa540FF6B339d13D322F61',
      deprecated: false,
      minimum: 10,
      name: 'BCP Oven',
      maxETHtranch: ethers.utils.parseEther("30"),
      description: 'Bakes BCP at Zero cost',
      data: {
        ethBalance: 0,
        pieBalance: 0
      },
      baking: {
          symbol: "BCP",
          address: "0xe4f726adc8e89c6a6017f01eada77865db22da14",
      },
      highlight: true,
      enabled: true,
      historicData: {
        style: {line: 'yellow'},
        x: [],
        y: []
        }
    },
    {
        addressOven: '0xAedec86DeDe3DEd9562FB00AdA623c0e9bEEb951',
        deprecated: false,
        minimum: 10,
        name: 'YPIE Oven',
        maxETHtranch: ethers.utils.parseEther("30"),
        description: 'Bakes YPIE at Zero cost',
        data: {
          ethBalance: 0,
          pieBalance: 0
        },
        baking: {
            symbol: "YPIE",
            address: "0x17525e4f4af59fbc29551bc4ece6ab60ed49ce31"
        },
        highlight: true,
        enabled: true,
        historicData: {
            style: {line: 'blue'},
            x: [],
            y: []
        }
      }
  ]

const getTime = () => {
    const now = new Date();
    return `${now.getHours()}:${now.getMinutes()}`;
}

let txInProgress  = {};
let txs  = {
};

ovens.forEach(ov => {
    txInProgress[ov.addressOven] = false;
});

const MAX_GAS = 100000000000;

async function checkOven(ov, execute=true) {    
    try {
        const balance = await provider.getBalance(ov.addressOven) / 1e18;
        ov.historicData.x.push(getTime());
        ov.historicData.y.push(balance);

        if(balance >= ov.minimum) {
            

            let gasPrices = await gasNow.fetchGasPrice();
            l.l(`Balance ${ov.name}: ${balance} ETH - ${gasPrices.fast} gas`);
            const table1 = new Table({ style: { head: [], border: [] } });
            table1.push(['Rapid', 'Fast', 'Standard', 'Timestamp']);
            table1.push([gasPrices.rapid, gasPrices.fast, gasPrices.standard, gasPrices.timestamp]);
            //console.log(table1.toString())

            if(txInProgress[ov.addressOven]) {
                //l.e(`Tx still in progress: ${txInProgress[ov.addressOven]} \n`);
                return;
            }

            if(gasPrices.fast < MAX_GAS && !ov.deprecated && txInProgress) {
                await bake(
                    ov.addressOven,
                    3604155,
                    3, //Slippage
                    100, //max_addresses
                    1, //min_addresses
                    ethers.utils.parseEther("0.1"), // minAmount
                    execute, //execute
                    ov.baking.symbol,
                    false,
                    ov.maxETHtranch
                );
            } else {
                l.l('\n Gas price too high, checking again in a bit.\n')
            }
        } else {
            l.l(`${getTime()} ${ov.name}: ${balance} ETH`)
        }
    } catch (e) {
        l.e(e.message);
    }
}

function getPlotData() {
    return ovens.map(ov => {
        return {
            title: ov.baking.symbol,
            x: ov.historicData.x,
            y: ov.historicData.y,
            style: ov.historicData.style
        }
    })
}

function getTxsData() {

    let emojis = {
        'Broadcasted': emoji.get('timer_clock'),
        'Mined': emoji.get('check_mark_button'),
        'Revert': emoji.get('cross_mark'),
    }

    return Object.keys(txs).map( hash => {
        return [
            txs[hash].time,
            hash,
            emojis[ txs[hash].status ]
        ]
    })
}

async function bake(
    oven_address = '0x1d616dad84dd0b3ce83e5fe518e90617c7ae3915',
    start_block = 3604155,
    slippage = 3,
    max_addresses = 6, 
    min_addresses = 1,
    minAmount = ethers.utils.parseEther("0.1"), // Min amount to be considered for baking
    execute = false,
    symbol,
    verbose = false,
    maxETHtranch = ethers.utils.parseEther("10")
) {
    try {
        txInProgress[oven_address] = 'Calculating';

        let addresses = []
        let { utils } = ethers;
        let inputAmount = ethers.BigNumber.from("0")

        let oven = new ethers.Contract(oven_address, ovenABI, wallet);
        const pie_address = await oven.pie();
        const recipe_address = await oven.recipe();

        console.log('recipe_address', recipe_address)
        const recipe = new ethers.Contract(recipe_address, recipeABI, wallet);

        let calculateFor = utils.parseEther("1");
        let etherJoinAmount = await recipe.calcToPie(pie_address, calculateFor);
        console.log('etherJoinAmount', etherJoinAmount.toString() );
        
        
        l.l("\tUsing pie @ " + pie_address);
        l.l("\n~Getting addresses~")
        const deposits = await oven.queryFilter(oven.filters.Deposit(), start_block, "latest")

        const bar1 = new cliProgress.SingleBar({
            format: '|' + chalk.yellow('{bar}') + '| {percentage}% || {value}/{total} Deposits',
            barCompleteChar: '\u2588',
            barIncompleteChar: '\u2591',
            hideCursor: false
        });
        bar1.start(deposits.length, 0);

        for( const [i, deposit] of deposits.entries()) {
            const user = deposit.args.user;
            const balance = await oven.ethBalanceOf(user);
            if (addresses.includes(user)) {
                bar1.update(i+1);
                continue
            }

            if (balance.lt(minAmount)) {

                if(verbose)
                    l.l("Skipping", user,"(", balance.toString(), ")...")
                
                bar1.update(i+1);
                continue
            }

            if(verbose)
                l.l("\nAdding", user, "(", balance.toString(), ")...")

            addresses.push(user)

            inputAmount = inputAmount.add(ethers.BigNumber.from(balance))

            if (inputAmount.gt(maxETHtranch)) {
                console.log('maxETHtranch reached', maxETHtranch);
                inputAmount = maxETHtranch;
                bar1.update(deposits.length);
                break;
            }

            if (addresses.length >= max_addresses) {
                l.l("\nMax addressess reached, continuing..\n")
                console.log('Max addressess reached, continuing..');
                bar1.update(deposits.length);
                break
            }

            bar1.update(i+1);
        }

        if (addresses.length < min_addresses) {
            l.l(`\nAddressess is less than min_addresses\n`);
            console.log(`\nAddressess is less than min_addresses\n`);
            return;
        }

        l.l("\n~Done getting addresses~\n")
        l.l("Calculating output amount...")

        
        console.log('calculateFor', calculateFor.toString() );

        etherJoinAmount = await recipe.calcToPie(pie_address, calculateFor);
        console.log('etherJoinAmount', etherJoinAmount.toString() );

        const outputAmount =  inputAmount.mul(calculateFor).div(etherJoinAmount).div(100).mul(100-slippage);
        console.log('outputAmount', outputAmount.toString() );

        let realPrice = await recipe.calcToPie(pie_address, outputAmount);
        console.log('realPrice', realPrice.toString() );

        
        l.l("Swapping", inputAmount.toString(), "for", outputAmount.toString())
        l.l("Start baking...")

        const call = oven.interface.encodeFunctionData("bake", [addresses, outputAmount, inputAmount])
        //if(verbose)
            //console.log("\n\nCalldata:\n\n", call)

        let gasPrices = await gasNow.fetchGasPrice();

        let overrides = {
            gasLimit: 9000000
        };

        if( (inputAmount / 1e18) < 10 ) {
            l.e(`Wrong Minimum: ${inputAmount / 1e18} ETH\n`);
            return;
        }

        if(gasPrices.fast) {
            overrides.gasPrice = gasPrices.fast;
        }

        if(gasPrices.fast > MAX_GAS) {
            overrides.gasPrice = MAX_GAS;
        }

        const gas = await oven.estimateGas["bake(address[],uint256,uint256)"](
            addresses,
            outputAmount,
            inputAmount,
            overrides
        );

        const dryrun = await oven.callStatic["bake(address[],uint256,uint256)"](
            addresses,
            outputAmount,
            inputAmount,
            overrides
        );

        l.l(`Estimated Gas: ${gas.toString()}`)
        l.l(`Dry Run: ${dryrun.toString()}`)

        if(execute === true) {

            if(txInProgress[oven_address] !== false && txInProgress[oven_address] !== 'Calculating') {
                l.e(`Tx still in progress: ${txInProgress[oven_address]} \n`);
                return;
            }
            
            const baketx = await oven["bake(address[],uint256,uint256)"](
                addresses,
                outputAmount,
                inputAmount,
                overrides
            );

            //if(verbose)
                //console.log('baketx', baketx);

            let message = `:pie:  **Baking in process** :pie:
        
    The Oven is baking \`${outputAmount/1e18} ${symbol}\`
    https://etherscan.io/tx/${baketx.hash}`;

            await discord.notify(message)
            
            //if(verbose)
                //console.log(message)

            txInProgress[oven_address] = `https://etherscan.io/tx/${baketx.hash}`;
            
            txs[baketx.hash] = {status: 'Broadcasted', time: getTime()};

            l.l('Tx Broadcasted: ' + txInProgress[oven_address]);
            
            let receipt = await baketx.wait();
            if(receipt.status === 1) {
                txs[baketx.hash] = {...txs[baketx.hash], status: 'Mined'};
                l.l(`${emoji.get('check_mark_button')} ${baketx.hash} mined successully`);
            } else {
                l.e(`${emoji.get('cross_mark')} ${baketx.hash} failed`);
                txs[baketx.hash] = {...txs[baketx.hash], status: 'Revert'};
            }
            txInProgress[oven_address] = false;
           
        }

    } catch (e) {
        txInProgress[oven_address] = false;
        l.e(e.message);
    }
    
}

async function run(execute=true) {
    ovenState();    
    try {
        for (const ov of ovens) {
            await checkOven(ov, execute)
        }
    } catch(e) {
        l.e(e.message);
    }
    //console.log('\n\n')
}

function ovenState() {
    // l.l(chalk.yellow(`Baking State of Ovens`));
    const table1 = new Table({ style: { head: [], border: [] } });
    table1.push(ovens.map(o => o.name));
    table1.push(ovens.map(o => txInProgress[o.addressOven]));
    // l.l(table1.toString());
};


module.exports = {
    run,
    ovenState,
    getPlotData,
    getTxsData
}