const chalk = require('chalk');
const PubSub = require('./pubsub').PubSub;

class Logger extends PubSub {
    constructor() {
        super()
        this.logs = [];
        this.errors = [];
    }

    l(log) {
        this.logs.push(log);
        super.publish('log', log);
    }

    e(log) {
        this.errors.push(chalk.red(log));
        super.publish('error', log);
    }
}

const l = new Logger();

module.exports = {
    logger: l
}