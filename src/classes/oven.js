// This class only supports Oven V2.

const ethers = require('ethers');
const ovenABI = require('../abis/oven2.json');
const erc20ABI = require('../abis/erc20.json');
const recipeABI = require('../abis/recipeV4.json');
const wallet = require('../wallet').wallet;
const provider = require('../wallet').provider;

class Oven {
    constructor(_address, _minimum = 10, _lastBakedRound = 0, _recipeAddress = '0x7811ec9801AA72EA3f3E4bb5AeceDBC134c44Af1') {
        this.address = _address;
        this.ready = false;
        this.instance = new ethers.Contract(_address, ovenABI, wallet);
        this.recipe = new ethers.Contract(_recipeAddress, recipeABI, provider);
        this.minimum = _minimum;
        this.lastBakedRound = 0;
        this.currentBakeSession = {
            amount: ethers.BigNumber.from(0),
            tx: null,
            rounds:[]
        }
    }

    async initialize() {
        this.minimum = await this.instance.roundSizeInputAmount();
        this.roundSizeInputAmount = await this.instance.roundSizeInputAmount();
        this.inputToken = await this.instance.inputToken();
        this.outputToken = await this.instance.outputToken();
        this.ready = true;

        console.log({
            inputToken: this.inputToken,
            outputToken: this.outputToken,
            maxRound: this.minimum,
        })
    }

    async sync() {
        await this.searchRoundsToBaked();
        await this.calcRecipe();
    }

    async calcRecipe() {
        // Calculate price for 1
        let price = await this.recipe.callStatic.getPrice(this.inputToken, this.outputToken, ethers.utils.parseEther("1"));

        //Calculate price + slippage
        let pricePlusSlippage = price.mul(102).div(100)


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
        
        //bake(calldata,uint256[])
        // const gas = await this.instance.estimateGas["bake(bytes,uint256[])"](data, roundsIds);
        // console.log('gas', gas)
    
        let res = await this.instance.bake(data, roundsIds, {
            gasLimit: "9500000"
        });

        console.log('res', res)

        let pie = new ethers.Contract(this.outputToken, erc20ABI, wallet);
        let WETH = new ethers.Contract(this.inputToken, erc20ABI, wallet);
        let pieBalanceAfter = await pie.balanceOf(this.address)
        let wethBalanceAfter = await WETH.balanceOf(this.address)
        
        console.log('pieBalanceAfter', pieBalanceAfter/1e18);
        console.log('wethBalanceAfter', wethBalanceAfter/1e18);

        // const bakeCallData = await this.recipe.callStatic.bake(WETH, PLAY, , price.mul(105).div(100));
        
        //console.log('bakeCallData', data)
    }

    async bake() {
        //const tx = await recipe.bake(DAI, YPIE, price.mul(105).div(100), data);)
    }

    async getRounds() {
        this.rounds = await this.instance.getRounds();
        console.log("rounds", this.rounds)
    }

    async searchRoundsToBaked() {
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

        console.log( this.currentBakeSession.amount.toString() )
        if( this.currentBakeSession.amount.gte(this.minimum) ) {
            console.log('we are ready to bake ser')
        }

        this.currentBakeSession.rounds = roundsToBeBaked;
        console.log( roundsToBeBaked.length )
        
    }

}

module.exports = {
    Oven
}