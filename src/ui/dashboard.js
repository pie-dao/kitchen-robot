const blessed = require('blessed')
const contrib = require('blessed-contrib');
const runOvenCheck = require('../routines/ovenBake').run;
const getPlotData = require('../routines/ovenBake').getPlotData;
const getTxsData = require('../routines/ovenBake').getTxsData;
const l = require('../classes/logger').logger;
const gasService = require('../classes/gasprice').gasService;
const wallet = require('../wallet').wallet;

const widgets = {};
let screen;
let grid;
//create layout and widgets

function main() {
  screen = blessed.screen()
  screen.insertLine(0,0,0,0)
  grid = new contrib.grid({rows: 12, cols: 12, screen: screen})
  setupOvenState()
  setupLCDs()
  setupEvents()
  setupTransactions()
  setupDivergencePeg()
  setupDoughPrice()
  setupGasPrice()
  setupLogs()
  setupErrorLogs()

  runOvenCheck(true);

  screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    screen.destroy();
  });

  // fixes https://github.com/yaronn/blessed-contrib/issues/10
  screen.on('resize', function() {
    for (const w of Object.keys(widgets)) {
      widgets[w].emit('attach');  
    }
  });
}

function setupOvenState() {
  widgets.donuts = grid.set(0, 6, 4, 6, contrib.donut, 
    {
    label: 'Oven State',
    radius: 16,
    arcWidth: 4,
    yPadding: 2,
    data: [{label: 'DEFI++', percent: 87}, {label: 'BCP', percent: 87, color: 'red'}, {label: 'YPIE', percent: 87, color: 'blue'}]
  })
}

function setupLCDs() {
  widgets.lcd = grid.set(4, 10, 2, 2, contrib.lcd, { 
    segmentWidth: 0.06, // how wide are the segments in % so 50% = 0.5
    segmentInterval: 0.11, // spacing between the segments in % so 50% = 0.550% = 0.5
    strokeWidth: 0.11, // spacing between the segments in % so 50% = 0.5
    elements: 4, // how many elements in the display. or how many characters can be displayed.
    display: 321, // what should be displayed before first call to setDisplay
    elementSpacing: 4, // spacing between each element
    elementPadding: 2, // how far away from the edges to put the elements
    color: 'white', // color for the segments
    label: 'ETH Remaining'
  });
  
  
  widgets.lcd2 = grid.set(6, 10, 2, 2, contrib.lcd, { 
    segmentWidth: 0.06, // how wide are the segments in % so 50% = 0.5
    segmentInterval: 0.11, // spacing between the segments in % so 50% = 0.550% = 0.5
    strokeWidth: 0.11, // spacing between the segments in % so 50% = 0.5
    elements: 4, // how many elements in the display. or how many characters can be displayed.
    display: 321, // what should be displayed before first call to setDisplay
    elementSpacing: 4, // spacing between each element
    elementPadding: 2, // how far away from the edges to put the elements
    color: 'white', // color for the segments
    label: 'ETH Price ($)'
  });
  
  widgets.lcd2.setDisplay('----');
  widgets.lcd.setDisplay('----');

  setInterval( async () => {
    try {
      let balance = await wallet.getBalance() / 1e18;
      widgets.lcd.setDisplay( balance.toFixed(2) );
    } catch (e) {
      l.e(e.message)
    }
    
  }, 10000)

}

function setupEvents() {
  widgets.logs = grid.set(8, 6, 4, 2, contrib.table, { 
    keys: true,
    fg: 'green',
    label: 'Events',
    columnSpacing: 1,
    columnWidth: [10, 10, 24]
  });

  widgets.logs.setData({headers: ['Oven', 'Event', 'Amount'], data: [
    ['DEFI++', 'Deposit', '23,2'],
    ['DEFI++', 'Deposit', '23,2']
  ]})

  widgets.logs.focus()
}

function setupTransactions() {
  widgets.transactions = grid.set(8, 8, 4, 4, contrib.table, { 
    keys: true,
    fg: 'green',
    label: 'Transactions',
    columnSpacing: 1,
    columnWidth: [10, 70, 10]
  })

  setInterval( () => {
    widgets.transactions.setData({headers: ['Time', 'hash', 'Mined'], data: getTxsData()})
  }, 500)
}    

function setupGasPrice() {
  widgets.gasPrice = grid.set(0, 3, 6, 3, contrib.line, { 
    style: { 
      line: "red",
      text: "white",
      baseline: "black"
    },
    label: 'Gas Price',
    maxY: 400,
    showLegend: true
  })

  gasService.subscribe('gas-update', data => {
    widgets.gasPrice.setData({
      ...data.fast,
      title: 'Fast: ' + gasService.last.fast/1e9,
    })
   }, this)
}

function setupDivergencePeg() {
  widgets.peg = grid.set(6, 0, 6, 6, contrib.line, { 
    showNthLabel: 1,
    maxY: 20,
    label: 'Oven State',
    showLegend: true,
    legend: {width: 10}
  })

  setInterval(function() {
    let data = getPlotData();
    widgets.peg.setData(data)
    screen.render()
  }, 500)
}

function setupDoughPrice() {
  widgets.price = grid.set(0, 0, 6, 3, contrib.line, { 
    showNthLabel: 5,
    maxY: 100,
    label: 'DOUGH Price',
    showLegend: true,
    legend: {width: 10}
  })
}

function setupLogs() {
  widgets.logs = grid.set(4, 6, 4, 2, contrib.log, { 
    fg: "green", 
    selectedFg: "green", 
    label: 'Bot Log'
  })

  l.subscribe('log', (log) => {
    widgets.logs.log(log);
    screen.render()
  }, this);
}

function setupErrorLogs() {
  widgets.err = grid.set(4, 8, 4, 2, contrib.log, { 
    fg: "red", 
    selectedFg: "green", 
    label: 'Error Log'
  })

  l.subscribe('error', (log) => {
    widgets.err.log(log);
    screen.render()
  }, this);
}



module.exports = {
    run: main
}