// This class only supports Oven V2.

const ethers = require('ethers');
const ovenABI = require('../abis/oven2.json');
const wallet = require('../wallet').wallet;

class Oven {
    constructor(_address, _minimum = 10, _lastBakedRound = 0) {
        this.address = _address;
        this.instance = new ethers.Contract(_address, ovenABI, wallet);
        this.minimum = _minimum;
        this.lastBakedRound = 0;
        this.currentBakeSession = {
            amount: ethers.BigNumber.from(0),
            tx: null,
        }
    }

    async sync() {
        this.minimum = await this.instance.roundSizeInputAmount();
        await this.searchRoundsToBaked();
    }

    async getRounds() {
        this.rounds = await this.instance.getRounds();
        console.log("rounds", this.rounds)
    }

    async searchRoundsToBaked() {
        await this.getRounds();
        let roundsToBeBaked = [];
        this.rounds.forEach( (round, index) => {
            if (round.totalDeposited.gt(0) > 0 && round.totalBakedInput.lt(round.totalDeposited) ) {
                console.log('this round needs bakig ser')
                roundsToBeBaked.push(round);
                console.log(this.currentBakeSession.amount.toString())
                let amountToBake = round.totalDeposited.sub( round.totalBakedInput );
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
        
    }

}

module.exports = {
    Oven
}