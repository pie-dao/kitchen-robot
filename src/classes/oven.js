// This class only supports Oven V2.

const ethers = require('ethers');
const ovenABI = require('../abis/oven2.json');
const erc20ABI = require('../abis/erc20.json');
const recipeABI = require('../abis/recipeV4.json');
const wallet = require('../wallet').wallet;
const provider = require('../wallet').provider;
const discord = require('../apis/discord');

class Oven {
    constructor(_address, _minimum = 10, _lastBakedRound = 0, _recipeAddress = '0x7811ec9801AA72EA3f3E4bb5AeceDBC134c44Af1') {
        this.address = _address;
        this.ready = false;
        this.instance = new ethers.Contract(_address, ovenABI, wallet);
        this.recipe = new ethers.Contract(_recipeAddress, recipeABI, provider);
        this.minimum = ethers.utils.parseEther(_minimum.toString());
        this.lastBakedRound = 0;
        this.currentBakeSession = {
            amount: ethers.BigNumber.from(0),
            tx: null,
            rounds:[],
            shouldBake: false
        }
    }

    async initialize() {
        this.roundSizeInputAmount = await this.instance.roundSizeInputAmount();
        this.inputToken = await this.instance.inputToken();
        this.outputToken = await this.instance.outputToken();
        this.ready = true;
    }

    clearSession() {
        this.currentBakeSession = {
            amount: ethers.BigNumber.from(0),
            tx: null,
            rounds:[],
            shouldBake: false
        }
    }

    async sync() {
        await this.searchRoundsToBaked();
    }

    async checkAndBake() {
        await this.searchRoundsToBaked();

        if( !this.currentBakeSession.shouldBake ) 
            return;
        
        console.log('We have enough WETH: ', this.currentBakeSession.amount/1e18);
        await this.dobake();
    }

    async dobake() {
        console.log('dobake this.currentBakeSession.shouldBake', this.currentBakeSession.shouldBake)
        if( !this.currentBakeSession.shouldBake ) 
            return;
        
        console.log('We have enough WETH: ', this.currentBakeSession.amount/1e18);
        
        const res = await this.calcRecipe();

        console.log('res', res);
        await this.bake(res);
    }

    async notifyDiscord(amount, hash) {
        let message = `:pie:  **Baking in process** :pie:
        
                The Oven is baking \`${amount/1e18} PLAY\`
                https://etherscan.io/tx/${hash}`;

        console.log(message);
        //await discord.notify(message)
    }

    async calcRecipe() {
        console.log('calcRecipe')
        // Calculate price for 1
        let price = await this.recipe.callStatic.getPrice(this.inputToken, this.outputToken, ethers.utils.parseEther("1"));

        //Calculate price + slippage
        let pricePlusSlippage = price.mul(105).div(100)
        console.log('price', (pricePlusSlippage/1e18).toString())
        console.log('price', (pricePlusSlippage).toString())

        const roundsIds = this.currentBakeSession.rounds.map(v => v.id);
        console.log('Rounds ids:', roundsIds);

        let amountToUse = this.currentBakeSession.amount.gt(this.roundSizeInputAmount) ? this.roundSizeInputAmount : this.currentBakeSession.amount;

        let amountOfPie = amountToUse.div(pricePlusSlippage);
        let weiAdjusted = amountOfPie.mul( ethers.utils.parseEther("1") );

        console.log("We are baking ETH: ", amountToUse / 1e18)
        console.log('We are expecting amountOfPie', weiAdjusted/1e18);
        
        
        console.log('weiAdjusted', weiAdjusted.toString());

        const data = await this.recipe.encodeData(weiAdjusted);
        return {
            data,
            roundsIds,
            weiAdjusted
        }
    }

    async bake(args) {
        const {data, roundsIds, weiAdjusted} = args;
        console.log('bake', {data, roundsIds, weiAdjusted});
        if(this.txInProgress()) {
            return false;
        }
        console.log('tx is not in progress biatch');

        let staticCall = await this.instance.callStatic.bake(data, roundsIds, {
            gasLimit: "9500000"
        });

        console.log('static call ok');

        let tx = await this.instance.bake(data, roundsIds, {
            gasLimit: "9500000"
        });

        this.currentBakeSession.tx = tx;
        this.notifyDiscord(weiAdjusted, tx.hash)

        let receipt = await tx.wait();
        if(receipt.status === 1) {
            this.clearSession();
            let pie = new ethers.Contract(this.outputToken, erc20ABI, wallet);
            let WETH = new ethers.Contract(this.inputToken, erc20ABI, wallet);
            let pieBalanceAfter = await pie.balanceOf(this.address)
            let wethBalanceAfter = await WETH.balanceOf(this.address)
            
            console.log('pieBalanceAfter', pieBalanceAfter/1e18);
            console.log('wethBalanceAfter', wethBalanceAfter/1e18);
        } else {
            console.log(`${emoji.get('cross_mark')} ${baketx.hash} failed`);
        }
    }

    async getRounds() {
        this.rounds = await this.instance.getRounds();
    }

    txInProgress() {
        if( this.currentBakeSession.tx !== null) {
            console.log('Tx in progress', this.currentBakeSession.tx);
            return true;
        }
        return false;
    }

    async searchRoundsToBaked() {
        if(this.txInProgress()) {
            return false;
        }

        this.clearSession();

        await this.getRounds();
        let roundsToBeBaked = [];
        this.rounds.forEach( (round, index) => {
            if (round.totalDeposited.gt(0) && round.totalBakedInput.lt(round.totalDeposited) ) {
                roundsToBeBaked.push({
                    ...round,
                    id: index
                });
                console.log(`\n Round ${index} needs bakig ser\n`)

                console.log('round.totalDeposited', round.totalDeposited/1e18)
                console.log('round.totalBakedInput', round.totalBakedInput/1e18)
                let amountToBake = round.totalDeposited.sub( round.totalBakedInput );
                
                console.log('amountToBake', amountToBake/1e18)

                this.currentBakeSession.amount = this.currentBakeSession.amount.add( amountToBake );
            }

            if (round.totalBakedInput.eq(round.totalDeposited) ) {
                this.lastBakedRound = index;
                console.log('last baked round was', index)
            }
        });

        if( this.currentBakeSession.amount.gte(this.minimum) )  {
            this.currentBakeSession.shouldBake = true;
            console.log('yes we should')
        }
            
            
        this.currentBakeSession.rounds = roundsToBeBaked;
        console.log( 'Rounds to be baked: ', roundsToBeBaked.length )
    }

}

module.exports = {
    Oven
}