const fetch = require('node-fetch');

const fetchGasPrice = async () => {
    const query = `https://www.gasnow.org/api/v3/gas/price?utm_source=:pokebot`;
    try {
        const response = await fetch(query, {
            headers: {
            Accept: "application/json",
            "Content-Type": "application/json"
            }
        });
    
        const gas = await response.json();
    
        return gas.data;
    } catch (e){
        //console.log('error', e);
    }
    
};

exports.fetchGasPrice = fetchGasPrice;