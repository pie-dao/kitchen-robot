require('dotenv').config();

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');
const emoji = require('node-emoji-new')
const cliProgress = require('cli-progress');
const vorpal = require('vorpal')();


const runDashboard = require('./ui/dashboard').run;
const runOvenCheck = require('./routines/ovenBake').run;
const runOvenV2Check = require('./routines/ovenV2Bake').run;
const ovenState = require('./routines/ovenBake').ovenState;
const getPlotData = require('./routines/ovenBake').getPlotData;
const ethers = require('ethers');

const { TokenSupplyCheck } = require('./checks/tokenSupply');
const { Scheduler, Every } = require('./cronjobs');
const l = require('./classes/logger').logger;

const Oven = require('./classes/oven').Oven;
const gasService = require('./classes/gasprice').gasService;

const wallet = require('./wallet').wallet;

const votingABI = require('./abis/votingDAO.json');

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
.command('votes', 'Outputs state of the ovens.')
.action(async function(args, callback) {
  
  let voting = new ethers.Contract('0x109b588A4f2a234e302c722f91fe42c5ab828A32', votingABI, wallet);
  let voting2 = new ethers.Contract('0x5246A163803A97d1fa046D85B722F5c51C728408', votingABI, wallet);
  
  const votes = await voting.queryFilter(voting.filters.CastVote(), 9593680, "latest")
  const votes2 = await voting.queryFilter(voting2.filters.CastVote(), 11086737, "latest")

  let addresses = [];
  for( const [i, vote] of votes.entries()) {
      const user = vote.args.voter;
      console.log('user', user)
      addresses.push(user)
  }

  for( const [i, vote] of votes2.entries()) {
    const user = vote.args.voter;
    console.log('user', user)
    addresses.push(user)
}

  let uniqueItems = [...new Set(addresses)];
  console.log(uniqueItems);

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
  let execute = args.options.notx ? false : true;
  console.log('execute', execute);
  runOvenCheck(execute);
  l.subscribe('log', (log) => {
    console.log(log)
  }, this);

  l.subscribe('error', (log) => {
    console.log(log)
  }, this);
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

  if(process.env.RUN_OVEN_V2_CHECKS  === "true") {
    await setupOvenV2Checks();
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

async function setupOvenV2Checks() {
  console.log(chalk.magenta("Setting up Oven V2 Checks..."))

  let o = new Oven("0x90Cc6F4ec7Aa0468D2eDb3F627AcD988B14A78b4");
  await o.initialize();
  
  scheduler.add(Every.minute, () => runOvenV2Check([o]), 'RUN_OVEN_V2_CHECKS');
  console.log(chalk.white(`Oven V2 cronjob at: ${Every.minute} \n`));

  runOvenV2Check([o])
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

async function test() {
  console.log('test');
  let o = new Oven("0x90Cc6F4ec7Aa0468D2eDb3F627AcD988B14A78b4");
  await o.initialize();
  await o.checkAndBake();
}

//test();
