const chalk = require('chalk');
const PubSub = require('./pubsub').PubSub;

class Logger extends PubSub {
    constructor() {
        super()
        this.logs = [];
        this.errors = [];
    }

    l(log='', log2='', log3='', log4='') {
        let l = `${log} ${log2} ${log3} ${log4}`;
        this.logs.push(l);
        //console.log(l);
        super.publish('log', l);
    }

    e(log) {
        this.errors.push(chalk.red(log));
        //console.log(log);
        super.publish('error', log);
    }
}

const l = new Logger();

module.exports = {
    logger: l
}