const ethers = require('ethers');
const provider = new ethers.providers.JsonRpcProvider("http://127.0.0.1:8545/");
//const provider = new ethers.providers.InfuraProvider("homestead", process.env.INFURA_KEY);


let wallet = new ethers.Wallet(process.env.PRIVATE_KEY);
wallet = wallet.connect(provider);

console.log('wallet', wallet)
module.exports = {
    wallet,
    provider
}

