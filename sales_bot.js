// library for interacting with Solana nodes on-chain (fetching transactions, account info, signatures, etc.,)
const solanaWeb3 = require('@solana/web3.js');
// It is a set of tools/contracts/standards to interact with Solana NFTs
const { Connection, programs } = require('@metaplex/js');
// Library for making HTTP requests
const axios = require('axios'); 

require('dotenv').config();

if (!process.env.PROJECT_ADDRESS || !process.env.DISCORD_URL || !process.env.SOLANA_ENV) {
    console.log("please set your environment variables!");
    return;
}

const projectPubKey = new solanaWeb3.PublicKey(process.env.PROJECT_ADDRESS);
const url = solanaWeb3.clusterApiUrl(process.env.SOLANA_ENV);
const solanaConnection = new solanaWeb3.Connection(url, 'confirmed');
const metaplexConnection = new Connection(process.env.SOLANA_ENV);
const { metadata: { Metadata } } = programs;
const pollingInterval = 10000; // ms

var currentDate = new Date();

console.log("******Settings******");
console.log("Creators address: " + process.env.PROJECT_ADDRESS);
console.log("Discord url: " + process.env.DISCORD_URL);
console.log("Solana env: " + process.env.SOLANA_ENV);
console.log("Project Public Key: " + projectPubKey);
console.log("Cluster Url: " + url);
console.log("Metaplex Connection: " + metaplexConnection);
console.log("*******************");

//Whenever an NFT sale occurs on a marketplace, the marketplace’s program address 
//obviously has to be involved and you can observe this on-chain
const marketplaceMap = {
    "M2mx93ekt1fmXSVkTrUL9xVFHkmME8HTUi5Cyc5aF7K": "Magic Eden",
    "HZaWndaNWHFDd9Dhk5pqUUtsmoBCqzb1MLu3NAh1VX6B": "Alpha Art",
    "617jbWo616ggkDxvW1Le8pV38XLbVSyWY8ae6QUmGBAU": "Solsea",
    "CJsLwbP1iu5DuUikHEJnLfANgKy6stB2uFgvBBHoyxwz": "Solanart",
    "A7p8451ktDCHq5yYaHczeLMYsjRsAkzc3hCXcSrwYHU7": "Digital Eyes",
    "AmK5g2XcyptVLCFESBCJqoSfwV3znGoVYQnqEnaAZKWn": "Exchange Art",
 //   "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" : "Candy Machine v2 Devnet",
    "cndy3Z4yapfJBmL3ShUp5exZKqR3z33thTzeNMm2gRZ" : "CM Mainnet",
};

const runSalesBot = async () => {
    console.log("starting sales bot...");

    let signatures;
    let lastKnownSignature;
    const options = {};
    while (true) {
        try {
            //getSignaturesForAddress returns transactions in order of descending time
            //getSignaturesForAddress by default returns the last 1000 signatures
            signatures = await solanaConnection.getSignaturesForAddress(projectPubKey, options);
            if (!signatures.length) {
                console.log("polling...")
                await timer(pollingInterval);
                continue;
            }
            //console.log(signatures);

        } catch (err) {
            console.log("error fetching signatures: ", err);
            continue;
        }

        for (let i = signatures.length - 1; i >= 0; i--) {
            try {
                let { signature } = signatures[i];
                const txn = await solanaConnection.getTransaction(signature);
               //console.log("#Tran: " + signature);
                //console.log(txn);
                if (txn.meta && txn.meta.err != null) { continue; }

                var nftDate = new Date(txn.blockTime * 1000);
                const dateString = new Date(txn.blockTime * 1000).toLocaleString();
                const price = Math.abs((txn.meta.preBalances[0] - txn.meta.postBalances[0])) / solanaWeb3.LAMPORTS_PER_SOL;
                const accounts = txn.transaction.message.accountKeys;
                const marketplaceAccount = accounts[accounts.length - 1].toString();

               // for (let k = accounts.length - 1; k >= 0; k--){
               //     console.log("account: " + accounts[k].toString());
               // }
                

                console.log("marketplaceAccount: " + marketplaceAccount);

                if (marketplaceMap[marketplaceAccount]) {
                    //console.log("Supported marketplace sale");
                    const metadata = await getMetadata(txn.meta.postTokenBalances[0].mint);
                    if (!metadata) {
                        console.log("couldn't get metadata");
                        continue;
                    }
                    
                    /*
                    if(currentDate.valueOf() <= nftDate.valueOf() ) {
                        console.log("Supported marketplace sale");
                        console.log("Current Date " + currentDate.getDate());
                        console.log("NFT Date" + nftDate.getDate());
                        printSalesInfo(dateString, price, signature, metadata.name, marketplaceMap[marketplaceAccount], metadata.image);
                        await postSaleToDiscord(metadata.name, price, dateString, signature, metadata.image)
                    }*/

                    printSalesInfo(dateString, price, signature, metadata.name, marketplaceMap[marketplaceAccount], metadata.image);
                    await postSaleToDiscord(metadata.name, price, dateString, signature, metadata.image)
                } else {
                    console.log("not a supported marketplace sale");
                }
            } catch (err) {
                console.log("error while going through signatures: ", err);
                continue;
            }
        }

        lastKnownSignature = signatures[0].signature;
        if (lastKnownSignature) {
            options.until = lastKnownSignature;
        }
    }
}
runSalesBot();

const printSalesInfo = (date, price, signature, title, marketplace, imageURL) => {
    console.log("-------------------------------------------")
    console.log(`Sale at ${date} ---> ${price} SOL`)
    console.log("Signature: ", signature)
    console.log("Name: ", title)
    console.log("Image: ", imageURL)
    console.log("Marketplace: ", marketplace)
    console.log("-------------------------------------------")
}

const timer = ms => new Promise(res => setTimeout(res, ms))

const getMetadata = async (tokenPubKey) => {
    try {
        const addr = await Metadata.getPDA(tokenPubKey)
        const resp = await Metadata.load(metaplexConnection, addr);
        const { data } = await axios.get(resp.data.data.uri);

        return data;
    } catch (error) {
        console.log("error fetching metadata: ", error)
    }
}

const postSaleToDiscord = (title, price, date, signature, imageURL) => {
    axios.post(process.env.DISCORD_URL,
        {
            "embeds": [
                {
                    "title": `SALE`,
                    "description": `${title}`,
                    "fields": [
                        {
                            "name": "Price",
                            "value": `${price} SOL`,
                            "inline": true
                        },
                        {
                            "name": "Date",
                            "value": `${date}`,
                            "inline": true
                        },
                        {
                            "name": "Explorer",
                            "value": `https://explorer.solana.com/tx/${signature}`
                        }
                    ],
                    "image": {
                        "url": `${imageURL}`,
                    }
                }
            ]
        }
    )
}
