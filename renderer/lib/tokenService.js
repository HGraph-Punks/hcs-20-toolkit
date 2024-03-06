import {hederaClient} from './scripts/utils'
import {createIPFSMetaData, createSingleIPFSMetaData} from './fileService'

import fs from 'fs';

import {
  CustomFixedFee,
  CustomRoyaltyFee,
  Hbar,
  NftId,
  PrivateKey,
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
} from "@hashgraph/sdk";

export const singleImageMint = async (hederaMainnetEnv, token, user, setLoading) => {
  const image = document.getElementById("single-image").files[0];
  const client = hederaClient(hederaMainnetEnv, user)
  
  let attributes =[]

  const tokenMetaData = {
    name: token?.name,
    description: token?.description,
    creator: token?.creator,
    maxSupply: parseInt(token?.maxSupply),
    attributes: attributes,
  }

  if (parseInt(token?.numOfAttributes) > 0) {
    for (let index = 0; index < parseInt(token.numOfAttributes); index++) {
      let trait_type = token['trait_type'+index];
      let value = token['value'+index];
      let attribute = {
        trait_type: trait_type,
        value: value
      }
      attributes.push(attribute);
    }
  }
  tokenMetaData.attributes = attributes

  const metadataCIDs = await createSingleIPFSMetaData(image, tokenMetaData, user?.nftStorageAPI);
  let finalCIDS = []
  for (let j = 0; j < tokenMetaData?.maxSupply; j++) {
    finalCIDS[j] = metadataCIDs.url
  }

  token.treasuryAccountId = user.accountId
  token.renewAccountId = user.accountId
  createNFTs(client, token, finalCIDS, user.pk, hederaMainnetEnv, setLoading);
}

class HederaImageManager {
  constructor(operatorId, operatorKey, topicId, network, setImageData, setUploadProgress) {
      this.client = network === 'mainnet' ? Client.forMainnet() : Client.forTestnet() ;
      this.client.setOperator(operatorId, operatorKey);
      this.topicId = topicId;
      this.setImageData = setImageData
      this.setUploadProgress = setUploadProgress
  }
  client = null
  topicId = ""
  setUploadProgress = (value) =>{}
  setImageData = (data)=>{}
  async uploadToHederaTopic(message, submitKey) {
      const transaction = new TopicMessageSubmitTransaction()
          .setTopicId(this.topicId)
          .setMessage(message);

          transaction.freezeWith(this.client);
          transaction.sign(submitKey);

      const transactionResponse = await transaction.execute(this.client);
      const receipt = await transactionResponse.getReceipt(this.client);
      const sequenceNumber = receipt.topicSequenceNumber;

      console.log('Sequence number:', sequenceNumber);
  }

  chunkMessage(message, chunkSize) {
    const numChunks = Math.ceil(message.length / chunkSize);
    let messageArray = [];

    for (let i = 0, offset = 0; i < numChunks; i++, offset += chunkSize) {
      messageArray.push({
        o: i,
        c: message.slice(offset, offset + chunkSize),
      });
    }

    return messageArray;
  }

  getMimeType(filePath) {
      const extension = filePath.split('.').pop().toLowerCase();
      const mimeTypeMap = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          // Add other file types if necessary
      };
      return mimeTypeMap[extension] || 'application/octet-stream';
  }
  
  async convertImageToBase64(image) {
    // Compress the image data using ZstdSimple
    // const compressedImage = await compress(image, 10);
    // Return the compressed data as a base64 string
    return Buffer.from(compressedImage).toString('base64');
  }

  async uploadImage(base64Image, submitKey = null) {
    const messageChunks = this.chunkMessage(base64Image, 1000);
    const totalChunks = messageChunks.length;
    let uploadedChunks = 0; // To keep track of the number of uploaded chunks
  
    // upload chunks in groups
    const chunks = chunk(messageChunks, 50);
  
    for (let i = 0; i < chunks.length; i++) {
        let uploadSuccess = false;
        let retries = 3; // Number of retries for uploading a chunk
  
        while (!uploadSuccess && retries > 0) {
            try {
                await Promise.all(
                  chunks[i].map(async (chunk) => {
                    const buffer = Buffer.from(chunk.c, 'base64');
                    // const compressedImage = await compress(buffer, 10);
                    // Synchronous compression for simplicity
                    // Convert compressed buffer back to base64 for transport
                    const compressedBase64 = buffer.toString('base64');
                    const compressedChunk = { ...chunk, c: compressedBase64 };
                    return this.uploadToHederaTopic(JSON.stringify(compressedChunk), submitKey)
                      .then(() => {
                        uploadedChunks++; // Increment the number of uploaded chunks
                        const progress = (uploadedChunks / totalChunks) * 100;
                        this.setUploadProgress(progress); // Set the progress
                        console.log(`Upload progress: ${progress}%`); // Debug: Log the progress
                      });
                  })
                );
                uploadSuccess = true; // Set to true when upload is successful
            } catch (error) {
                console.error(`Error uploading chunk ${i}:`, error);
                retries--;
                await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for 2 seconds before retrying
            }
        }
  
        if (!uploadSuccess) {
            throw new Error(`Failed to upload chunk ${i} after retries.`);
        }
    }
  }
  



  async getMessagesFromTopic(allMessages = [], lastConsensusTimestamp = null) {
      try {
          let url = `https://mainnet-public.mirrornode.hedera.com/api/v1/topics/${this.topicId}/messages`;
          if (lastConsensusTimestamp) {
              url += `?timestamp=gte:${lastConsensusTimestamp}`;
          }

          const response = await axios.get(url);
          const { messages, links } = response.data;

          allMessages = allMessages.concat(messages.map(msg => Buffer.from(msg.message, 'base64').toString()));

          if (links && links.next) {
              const nextTimestamp = messages[messages.length - 1].consensus_timestamp;
              return await this.getMessagesFromTopic(allMessages, nextTimestamp);
          }

          return allMessages;

      } catch (error) {
          console.error('Error fetching messages:', error);
      }
  }
}
export const mintHashlips = async (hashlipsToken, user, hederaMainnetEnv, setLoading, fileData) => {
  const client = hederaClient(hederaMainnetEnv, user)
  let uploadedCIDsMetadata
  let hashLipsImages
  let hashlipsMetaData

  hashLipsImages = document.getElementById("hl-images").files;
  let hashLipsJSON = document.getElementById("hl-json").files;
  const metaDataPath = hashLipsJSON[0].path;
  console.log(metaDataPath)
  
  hashlipsMetaData = fileData
  const imgUploader = new HederaImageManager(user.accountId, user.pk, '0.0.3580702', hederaMainnetEnv, (t)=>{console.log(t)}, (t)=>{console.log(t)})
  
  for (let hashLipsImages = 0; hashLipsImages < array.length; hashLipsImages++) {
    const element = array[hashLipsImages];
    // 
  }
  const metadataCIDs = hashlipsToken.alreadyCreatedCIDs ? uploadedCIDsMetadata : await imgUploader(hashLipsImages, hashlipsMetaData, user.nftStorageAPI);
  console.log(hashlipsToken);
  console.log(metadataCIDs);

  createNFTs(client, hashlipsToken, metadataCIDs, user.pk, hederaMainnetEnv, setLoading);
}


export const createNFTs = async (client, hashlipsToken, metadataCIDs, userPk, hederaMainnetEnv, setLoading) => {
  // Init value for token ID to mint metadata
  let tokenId; 
  let adminKey;
  let supplyKey;
  let freezeKey;

  // If minting on a token ID that's already created, skip creatining initial token
  if (hashlipsToken.previousTokenId) {
    mintExisitngToken(client, hashlipsToken.previousTokenId, metadataCIDs, hederaMainnetEnv, setLoading)
    return
  }
  if (hashlipsToken.alreadyCreatedCIDs) {
    metadataCIDs = metadataCIDs.reverse()
  }
    /* Create a royalty fee */
  const customRoyaltyFee = [];
  for (let index = 0; index < parseInt(hashlipsToken.numOfRoyaltyFees); index++) {
    let numerator = parseFloat(hashlipsToken['royalty'+index]) *100;
    const fee = new CustomRoyaltyFee()
    .setNumerator(numerator) // The numerator of the fraction
    .setDenominator(10000) // The denominator of the fraction
    // .setFallbackFee(
    //   new CustomFixedFee().setHbarAmount(new Hbar(hashlipsToken.fallbackFee))
    // ) // The fallback fee
    .setFeeCollectorAccountId(hashlipsToken['royaltyAccountId'+index]); // The account that will receive the royalty fee
    customRoyaltyFee.push(fee);
  }
  const privateKey = PrivateKey.fromString(userPk);

  adminKey = privateKey;
  
  supplyKey = PrivateKey.generate();
  
  freezeKey = PrivateKey.generate();
  
  const tx = await new TokenCreateTransaction()
    .setTokenType(TokenType.NonFungibleUnique)
    .setTokenName(hashlipsToken.name)
    .setTokenSymbol(hashlipsToken.symbol)
    // .setDecimals(0)
    .setInitialSupply(0)
    .setMaxSupply(hashlipsToken.maxSupply)
    .setCustomFees(customRoyaltyFee)
    .setSupplyType(TokenSupplyType.Finite)
    .setTreasuryAccountId(hashlipsToken.treasuryAccountId)
    .setAutoRenewAccountId(hashlipsToken.renewAccountId)
    .setSupplyKey(supplyKey)
    .setMaxTransactionFee(new Hbar(1000))
    if (hashlipsToken.addAdminKey){
      tx.setAdminKey(adminKey)
    }
    if (hashlipsToken.addFreezeKey){
      tx.setFreezeKey(freezeKey) 
    }
    tx.freezeWith(client);
    
  // const transaction = await tx.signWithOperator(client);
  const transaction = await tx.sign(privateKey);

  /*  submit to the Hedera network */
  const response = await transaction.execute(client);

  /* Get the receipt of the transaction */
  const receipt = await response.getReceipt(client).catch((e) => console.log(e));

  /* Get the token ID from the receipt */
  tokenId = receipt.tokenId;

  let saveSupplyKey = supplyKey.toString()
  console.log('token Id',tokenId);
  console.log('suppplyKey (KEEP SECRET)',saveSupplyKey);
  localStorage.setItem('supplyKey_'+tokenId.toString(), saveSupplyKey)

  /* Mint the token */
  let nftIds = [];
  let urls = [];
  let limit_chunk = 5;
  // metadataCIDs = metadataCIDs.reverse()
  const nbOfChunk = Math.ceil(metadataCIDs.length / limit_chunk);
  let supplyClone = metadataCIDs.length-1;
  let resp;

  for (let i = 0; i < nbOfChunk; i++) {
    const mintTransaction = new TokenMintTransaction().setTokenId(tokenId);

    for (let j = 0; j < limit_chunk; j++) {

      if ((supplyClone - j) < 0) {
        break
      }
      mintTransaction.addMetadata(
        // Buffer.from(finalMetadataLink)
        Buffer.from(metadataCIDs[supplyClone-j])
      );
      urls.push(metadataCIDs[supplyClone-j])
    }
    supplyClone = supplyClone - limit_chunk;
 
    /* Sign with the supply private key of the token */
    const signTx = await mintTransaction
      .setMaxTransactionFee(new Hbar(1000))
      .freezeWith(client)
      .sign(supplyKey);

    /* Submit the transaction to a Hedera network */
    resp = await signTx.execute(client);
    const receiptMint = await resp.getReceipt(client);
    /* Get the Serial Number */
    const serialNumber = receiptMint.serials;

    /* Get the NftId */
    for (const nftSerial of serialNumber.values()) {
      nftIds.push(new NftId(tokenId, nftSerial).toString());
    }
  }

  const mintData = JSON.stringify({
    urls: urls,
    txId: resp.transactionId.toString(),
    tokenId: tokenId.toString(),
    nftIds,
    mainnet: hederaMainnetEnv
  });
  console.log(mintData)



  let saveAdminKey = adminKey.toString()
  let saveFreezeKey = freezeKey.toString()
  // fs.appendFile(`../supplyKey.json`, saveSupplyKey, (err) => {
  //   if (err) throw err;
  //   console.log('supply key written to file');
  // });
  localStorage.setItem('supplyKey_'+tokenId.toString(), saveSupplyKey)
  localStorage.setItem('adminKey_'+tokenId.toString(), saveAdminKey)
  localStorage.setItem('freezeKey_'+tokenId.toString(), saveFreezeKey)
  setLoading(false)
  alert(`Minting Success!\n\nNewly minted token data:\n\nToken ID: ${tokenId.toString()}\n\nSupply Key: ${saveSupplyKey}\n\nSupply key has also been saved into local storage.`);
  // console.log(saveSupplyKey)
  // console.log(saveAdminKey)
  // console.log(saveFreezeKey)
  localStorage.setItem('hashlipsMintData_' + tokenId.toString() , mintData)
}
