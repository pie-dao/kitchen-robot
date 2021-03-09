const PubSub = require('./pubsub').PubSub;
const gasNow = require('../apis/gasnow');  
const l = require('../classes/logger').logger;

class Gasprice extends PubSub {
    constructor() {
        super()

        this.data = {
            fast: {x: [], y: []},
            rapid: {x: [], y: []},
            standard: {x: [], y: []},
        };

        this.last = {

        }
    }

    async check() {
        const now = new Date();
        let time = `${now.getHours()}:${now.getMinutes()}`;
        try {
            let gasPrices = await gasNow.fetchGasPrice();
            this.last = gasPrices;
            
            this.data.fast.x.push(time)
            this.data.rapid.x.push(time)
            this.data.standard.x.push(time)
    
            this.data.fast.y.push(gasPrices.fast / 1e9)
            this.data.rapid.y.push(gasPrices.rapid / 1e9)
            this.data.standard.y.push(gasPrices.standard / 1e9)
    
            super.publish('gas-update', this.data);
        } catch (e){
            l.e(`${time} ${e.message}`)
        }
        
    }
}

const g = new Gasprice();

module.exports = {
    gasService: g
}