require('dotenv').config();

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');
const emoji = require('node-emoji-new')
const cliProgress = require('cli-progress');
const vorpal = require('vorpal')();


const runDashboard = require('./ui/dashboard').run;
const runOvenCheck = require('./routines/ovenBake').run;
const ovenState = require('./routines/ovenBake').ovenState;
const getPlotData = require('./routines/ovenBake').getPlotData;

const { TokenSupplyCheck } = require('./checks/tokenSupply');
const { Scheduler, Every } = require('./cronjobs');
const l = require('./classes/logger').logger;
const gasService = require('./classes/gasprice').gasService;


/**
* Config
*/
let isReady = false;
let repo = [];
const scheduler = new Scheduler();
const pies = [
  '0xe4f726adc8e89c6a6017f01eada77865db22da14',
  '0x78f225869c08d478c34e5f645d07a87d3fe8eb78'
]

/**
* CLI Commands definition
*/

vorpal
.command('oven-chart', 'Outputs state of the ovens.')
.action(function(args, callback) {
  setupOvenChecks();
  const screen = blessed.screen();
  const line = contrib.line(
    { 
      left: 0, 
      top: 0, 
      xPadding: 5, 
      label: 'Ovens Balances',
      showLegend: true, 
      legend: {width: 12}
    });

    screen.append(line) //must append before setting data
    
    setInterval(() => {
      const data = getPlotData();
      //console.log('data', data);
      line.setData(data)
      screen.render()
    }, 2000)
    
    screen.render()
});



vorpal
.command('dashboard', 'Open dashboard.')
.action(function(args, callback) {
  runDashboard();
  setupOvenChecks()
  callback();
});


vorpal
.command('oven-state', 'Outputs state of the ovens.')
.action(function(args, callback) {
  ovenState();
  scheduler.status('RUN_OVEN_CHECKS')
  callback();
});


vorpal
.command('oven-stop-checks', 'Stops checking the oven.')
.action(function(args, callback) {
  scheduler.stop('RUN_OVEN_CHECKS')
  callback();
});

vorpal
.command('oven-start-checks', 'Start checking the oven.')
.action(function(args, callback) {
  if(!scheduler.jobs['RUN_OVEN_CHECKS']) {
    setupOvenChecks();
  }
  scheduler.start('RUN_OVEN_CHECKS')
  callback();
});

vorpal
.command('oven-run-checks', 'Runs checks on the oven now.')
.option('-no, --notx', 'Runs checks on the oven without exectuting the tx')
.action(function(args, callback) {
  runOvenCheck(args.options.notx ? false : true);
  callback();
});

vorpal
.delimiter('KitchenBot$\n')
.show();


/**
* Setup function
*/
async function setup() {
  console.log(`${chalk.white.bgMagenta(emoji.get('robot') + ' Welcome to the Kitchen Bot ' + emoji.get('robot'))} \n\n`);

  setupGasChecks();
  
  if(process.env.RUN_SUPPLY_CHECKS === "true") {
    await setupSupplyChecks();
  }
  
  if(process.env.RUN_OVEN_CHECKS  === "true") {
    setupOvenChecks();
  }
  
  isReady = true;    
  console.log(`${chalk.green(emoji.get('check_mark_button') + ' All gucci, bot is ready')}`);
  console.log('Type `help` to see command list \n\n')
  
}

function setupOvenChecks() {
  console.log(chalk.magenta("Setting up OvenChecks..."))
  scheduler.add(Every.minute, () => runOvenCheck(true), 'RUN_OVEN_CHECKS');
  console.log(chalk.white(`OvenChecks cronjob at: ${Every.minutes15} \n`));
}

function setupGasChecks() {
  console.log(chalk.magenta("Setting up Gas price Checks..."))
  scheduler.add(Every.minute, () => gasService.check(), 'RUN_GAS_CHECKS');
  console.log(chalk.white(`GasChecks cronjob at: ${Every.minute} \n`));
}



async function setupSupplyChecks() {
  console.log(chalk.magenta("Setting up TokenSupplyCheck..."))
  const bar1 = new cliProgress.SingleBar({
    format: '|' + chalk.yellow('{bar}') + '| {percentage}% || {value}/{total} Pies',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  });
  bar1.start(pies.length, 0);
  
  for (const [i, p] of pies.entries()) {
    let instance = new TokenSupplyCheck(p);
    await instance.init();
    bar1.update(i+1);
    repo.push(instance);
  };
  
  scheduler.add(Every.minute, () => repo.forEach( check => check.run() ));
  bar1.stop();
  
  console.log(chalk.white(`TokenSupplyCheck cronjob at: ${Every.minute} \n`));
}

setup();