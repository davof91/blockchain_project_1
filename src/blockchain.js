/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.userValidateRequests = [];
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to
     * create the `block hash` and push the block into the chain array. Don't for get
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention
     * that this method is a private method.
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
          try {
            let chainHeight = await self.getChainHeight()

            // Ading the height of the chain to the block.
            block.height = chainHeight+1;

            // Adding the timeStamp
            block.time = new Date().getTime().toString().slice(0,-3);

            // Checking if the block being added is the Genesis block
            if (chainHeight !=  -1) {
              // previous block hash
              block.previousBlockHash = self.chain[chainHeight].hash;
            }

            // Adding the hash of the block to the block
            block.hash = SHA256(JSON.stringify(block)).toString();

            // Updating new height
            self.height = block.height;

            // Adding new block to chain
            self.chain.push(block);

            // Resolving with the newly created block
            resolve(block)
          }
          catch(err) {
            reject("Error, oh nooo!!! "+err);
          }
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address
     */
    requestMessageOwnershipVerification(address) {
        let self = this;
        return new Promise((resolve) => {
          let temp = address+":"+new Date().getTime().toString().slice(0,-3)+":starRegistry"
          self.userValidateRequests.push(temp);
          resolve(temp);
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address
     * @param {*} message
     * @param {*} signature
     * @param {*} star
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
          // Generating the current time first to make sure we are as close as
          // possible to the time of submittion
          let current_time = parseInt(new Date().getTime().toString().slice(0, -3));

          // Split message and get timeout
          let message_time = parseInt(message.split(":")[1])

          // Check time in seconds
          var diff = current_time - message_time;

          // Chechsum signing check. Wrap in try catch since it crashes when checksum is wrong.
          try{
            var verify_message = await bitcoinMessage.verify(message, address, signature);
          }
          catch(e){
            var verify_message = false;
            var crashed = e.message;
          }
          
          // Over five minutes (300 seconds) reject the offer.
          if(diff/60 > 5){
            reject("Over 5 minutes")
          }
          else if (!self.userValidateRequests.includes(message)){
            reject("User message not validated. Please request user validation first");
          }
          else if(verify_message){
            let block = new BlockClass.Block({owner:address, star:star});

            await self._addBlock(block)

            resolve(block);
          }
          else{
            reject(crashed);
          }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
          resolve(self.chain.filter(x=>x.hash == hash)[0]);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object
     * with the height equal to the parameter `height`
     * @param {*} height
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address
     */
    getStarsByWalletAddress (address) {
      let self = this;
      let stars = [];
      
      return new Promise((resolve, reject) => {
        let temp = []
        self.chain.forEach((item, i) => {
          if(i != 0){
            temp.push(item.getBData());
          }
        });

        Promise.all(temp).then((data) => {
          data.forEach((item, i)=> {
            if(item.owner == address){
              stars.push(item);
            }
          })
          
          resolve(stars);
        })
      });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
          let promises = []
          self.chain.forEach((item, i) => {
            if(i!=0){
              promises.push(item.validate());
            }
          });

          Promise.all(promises).then((data)=>{
            data.forEach((item, i) => {
              if(!item){
                errorLog.push("Different Hash on block height "+(i+1));
              }
              if(self.chain[i+1].height != 0 && self.chain[i+1].previousBlockHash != self.chain[i].hash){
                errorLog.push("previousBlockHash not matching on block height "+(i+1));
              }
            });

            resolve(errorLog);
          })

        });
    }

    /**
     * EXTRA TESTING FUCNTIONS!!!!!!!!!
     */

     /**
     * Adding a random block to not have to go through all the checks. Creates a user with  name of 
     * `test[0-2]`
     */
    addRandomBlock(){
      let self = this;
      return new Promise(async (resolve, reject) => {
        let block = new BlockClass.Block({owner:"test"+this.height%3, star:Math.random()});
        block = await self._addBlock(block);

        resolve(block);
      });

    }

    changePreviousHash(height){
      let self = this;
      return new Promise((resolve, reject) => {
        if(height != 0){
          let block = self.chain[height];
          if(block){
            block.previousBlockHash = SHA256(JSON.stringify(block)).toString();
            self.chain[height] = block
            
            resolve(self.chain);
          } else {
            resolve(null);
          }
        }
        else{
          resolve("Not a block")
        }
        
      });
    }

    changeHash(height){
      let self = this;
      return new Promise((resolve, reject) => {
        if(height != 0){
          let block = self.chain[height];
          if(block){
            block.hash = SHA256(JSON.stringify(block)).toString();
            self.chain[height] = block
            
            resolve(self.chain);
          } else {
            resolve(null);
          }
        }
        else{
          resolve("Not a block")
        }
        
      });
    }
}

module.exports.Blockchain = Blockchain;
