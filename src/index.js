require('dotenv').config();
const sound = require('sound-play')
const ethers = require('ethers');
const pieABI = require('./abis/pie.json');
const ovenABI = require('./abis/oven.json');
const recipeABI = require('./abis/recipe.json');
const gasNow = require('./apis/gasnow');  
const discord = require('./apis/discord');

// const provider = ethers.getDefaultProvider('mainnet', {
//     infura: process.env.INFURA_KEY,
// });

const provider = new ethers.providers.InfuraProvider("homestead", process.env.INFURA_KEY);

let wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    wallet = wallet.connect(provider);

const pie = process.env.PIE.toLowerCase();
const pieName = process.env.PIENAME;

async function run() {
    checkOven();
}

async function checkOven() {
    let ovenAddress = `0x1d616dad84dd0b3ce83e5fe518e90617c7ae3915`;
    
    const balance = await provider.getBalance(ovenAddress) / 1e18;

    if(balance > 10) {
        console.log(`Balance ${ovenAddress}: ${balance}`);
        sound.play('src/hello.mp3');
        await bake();
        
    } else {
        console.log(`${new Date()} Balance: ${balance} ETH`)
    }


}

async function bake(
    oven_address = '0x1d616dad84dd0b3ce83e5fe518e90617c7ae3915',
    start_block = 3604155,
    slippage = 1,
    max_addresses = 6, 
    min_addresses = 1,
    minAmount = ethers.utils.parseEther("0.1"), // Min amount to be considered for baking
    execute = false
) {
    let addresses = []
    let { utils } = ethers;
    let inputAmount = ethers.BigNumber.from("0")

    //const oven = await ethers.getContractAt("Oven", oven_address);
    let oven = new ethers.Contract(oven_address, ovenABI, wallet);
    const pie_address = await oven.pie();
    const recipe_address = await oven.recipe();
    const recipe = new ethers.Contract(recipe_address, recipeABI, wallet);

    console.log("\tUsing pie @", pie_address);
    console.log("\n~Getting addresses~")
    const deposits = await oven.queryFilter(oven.filters.Deposit(), start_block, "latest")
    for(const deposit of deposits) {
        const user = deposit.args.user;
        const balance = await oven.ethBalanceOf(user);
        if (addresses.includes(user)) {
            continue
        }

        if (balance.lt(minAmount)) {
            console.log("Skipping", user,"(", balance.toString(), ")...")
            continue
        }
        console.log("Adding", user, "(", balance.toString(), ")...")
        addresses.push(user)
        inputAmount = inputAmount.add(ethers.BigNumber.from(balance))

        if (addresses.length >= max_addresses) {
            console.log("Max addressess reached, continuing..")
            break
        }
    }
    if (addresses.length < min_addresses) {
        console.log(`Addressess is less than min_addresses`);
        return;
        //throw new Error("Addressess is less than min_addresses")
    }
    console.log("~Done getting addresses~\n")
    console.log("Calculating output amount...")
    const etherJoinAmount = await recipe.calcToPie(pie_address, utils.parseEther("1"));
    const outputAmount =  inputAmount.mul(utils.parseEther("1")).div(etherJoinAmount).div(100).mul(100-slippage);
    console.log("Swapping", inputAmount.toString(), "for", outputAmount.toString())

    console.log("Start baking...")

    const call = oven.interface.encodeFunctionData("bake", [addresses, outputAmount, inputAmount])

    console.log("\n\nCalldata:\n\n", call)

    let gasPrices = await gasNow.fetchGasPrice();

    if(execute) {
        const baketx = await oven.bake(
            addresses,
            outputAmount,
            inputAmount,
        {
            gasLimit: 5000000,
            gasPrice: gasPrices.rapid
        })
         ` @ `;
         let message = `:pie:  **Baking in process** :pie:
    
        The Oven is baking \`${outputAmount.toString()} DEFI++\`
        https://etherscan.io/tx/${baketx.hash}`;

        await discord.notify(message)
        console.log(message)
    }
    
}

async function poke() {
    console.log('Running');
    let wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
    wallet = wallet.connect(provider);
    let pool = new ethers.Contract(pie, pieABI, wallet);

    // Get Gas Now
    let gasPrices = {rapid: 95000000000}; //await gasNow.fetchGasPrice();

    console.log('Rapid Gas is:', gasPrices.rapid);
    let hash = await pool.pokeWeights({gasLimit: '100000000000', gasPrice: gasPrices.rapid});
    //await discord.notify(`Poking weights of ${pieName} at ${Date.now()}, next pokeing in ${process.env.INTERVAL} seconds.`)
    console.log('Poke tx hash:', hash);
}

setInterval(function(){ run()}, process.env.INTERVAL || 60000)
run();