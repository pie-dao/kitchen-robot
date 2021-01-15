const blessed = require('blessed')
const emoji = require('node-emoji-new')
const contrib = require('blessed-contrib');

const widgets = {};
let screen;
let grid;
//create layout and widgets

function main() {
  screen = blessed.screen()
  grid = new contrib.grid({rows: 12, cols: 12, screen: screen})
  setupOvenState()
  setupLCDs()
  setupEvents()
  setupTransactions()
  setupDivergencePeg()
  setupDoughPrice()
  setupGasPrice()
  simulateData()
  setupLogs()
  setupErrorLogs()

  screen.key(['escape', 'q', 'C-c'], function(ch, key) {
    return process.exit(0);
  });

  // fixes https://github.com/yaronn/blessed-contrib/issues/10
  //TODO
  screen.on('resize', function() {
    sparkline.emit('attach');
    bar.emit('attach');
    table.emit('attach');
    errorsLine.emit('attach');
    transactionsLine.emit('attach');
    log.emit('attach');
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
  
  widgets.lcd2.setDisplay(1275);
  widgets.lcd.setDisplay(5.67);
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

  widgets.transactions.setData({headers: ['Time', 'hash', 'Mined'], data: [
    ['12:50', '0x58040fe1d5624874757b14fb00ca1f6ceae43eeae8df18508e7c996cda1a0fac', emoji.get('check_mark_button')]
  ]})
}    

function setupGasPrice() {
  widgets.gasPrice = grid.set(0, 3, 6, 3, contrib.line, { 
    style: { 
      line: "red",
      text: "white",
      baseline: "black"
    },
    label: 'Gas Price',
    maxY: 60,
    showLegend: true
  })
}

function setupDivergencePeg() {
  widgets.peg = grid.set(6, 0, 6, 6, contrib.line, { 
    showNthLabel: 5,
    maxY: 100,
    label: 'Peg Deviation',
    showLegend: true,
    legend: {width: 10}
  })
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
}

function setupErrorLogs() {
  widgets.logs = grid.set(4, 8, 4, 2, contrib.log, { 
    fg: "red", 
    selectedFg: "green", 
    label: 'Error Log'
  })
}

//set line charts dummy data
function simulateData() {
  function setLineData(mockData, line) {
    for (var i=0; i<mockData.length; i++) {
      var last = mockData[i].y[mockData[i].y.length-1]
      mockData[i].y.shift()
      var num = Math.max(last + Math.round(Math.random()*10) - 5, 10)    
      mockData[i].y.push(num)  
    }
  
    line.setData(mockData)
  }

  var transactionsData = {
    title: 'BCP',
    style: {line: 'red'},
    x: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:30', '00:40', '00:50', '01:00', '01:10', '01:20', '01:30', '01:40', '01:50', '02:00', '02:10', '02:20', '02:30', '02:40', '02:50', '03:00', '03:10', '03:20', '03:30', '03:40', '03:50', '04:00', '04:10', '04:20', '04:30'],
    y: [0, 20, 40, 45, 45, 50, 55, 70, 65, 58, 50, 55, 60, 65, 70, 80, 70, 50, 40, 50, 60, 70, 82, 88, 89, 89, 89, 80, 72, 70]
 }
 
 var transactionsData1 = {
    title: 'DOUGH',
    style: {line: 'yellow'},
    x: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:30', '00:40', '00:50', '01:00', '01:10', '01:20', '01:30', '01:40', '01:50', '02:00', '02:10', '02:20', '02:30', '02:40', '02:50', '03:00', '03:10', '03:20', '03:30', '03:40', '03:50', '04:00', '04:10', '04:20', '04:30'],
    y: [0, 5, 5, 10, 10, 15, 20, 30, 25, 30, 30, 20, 20, 30, 30, 20, 15, 15, 19, 25, 30, 25, 25, 20, 25, 30, 35, 35, 30, 30]
 }
 
 var errorsData = {
    title: 'Fast',
    x: ['00:00', '00:05', '00:10', '00:15', '00:20', '00:25'],
    y: [30, 50, 70, 40, 50, 20]
 }
 
 setInterval(function() {
    setLineData([transactionsData, transactionsData1], widgets.peg)
    setLineData([transactionsData, transactionsData1], widgets.price)
    screen.render()
 }, 500)
 
 setInterval(function() {   
     setLineData([errorsData], widgets.gasPrice)
 }, 1500)
}



module.exports = {
    run: main
}