import React, { useState, useEffect, useContext } from 'react';
import { Button, TextField, Typography, CircularProgress, Box, Paper, Grid, Stepper, Step, StepLabel, Snackbar, LinearProgress, FormControlLabel, Checkbox, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { WalletContext } from '../components/WalletContext';
import { Client, TopicCreateTransaction, PrivateKey,CustomRoyaltyFee, TopicMessageSubmitTransaction, Hbar, TransferTransaction, TokenMintTransaction, TokenCreateTransaction, AccountId, TokenType, TokenSupplyType} from '@hashgraph/sdk';
import { z } from 'zod';
import axios from 'axios'
import chunk from 'lodash/chunk'; // Ensure you have lodash installed
import { MenuItem, Select, IconButton } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';



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
  
  async uploadMetadata(chunks, submitKey = null) {
    const parsedChunks = JSON.parse(chunks);
    const totalChunks = parsedChunks.length;
    let uploadedChunks = 0; // To keep track of the number of uploaded chunks
    
    for (let i = 0; i < totalChunks; i++) {
        let uploadSuccess = false;
        let retries = 3; // Number of retries for uploading a chunk
  
        while (!uploadSuccess && retries > 0) {
            try {
                await Promise.all(
                  parsedChunks.map((chunk) => {
                    return this.uploadToHederaTopic(JSON.stringify(chunk), submitKey)
                      .then(() => {
                        uploadedChunks++; // Increment the number of uploaded chunks
                        const progress = (uploadedChunks / totalChunks) * 100;
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
                  chunks[i].map((chunk) => {
                    return this.uploadToHederaTopic(JSON.stringify(chunk), submitKey)
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


const baseMessageSchema = z.object({
  p: z.string().toLowerCase().refine((val) => ['hcs-20'].includes(val)),
  op: z.string().toLowerCase().refine((val) => ['deploy', 'mint', 'burn', 'transfer', 'register'].includes(val)),
  memo: z.string().optional(),
});

const accountRegex = /^(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))(?:-([a-z]{5}))?$/;
const accountFieldSchema = z.string().regex(accountRegex).transform(val => val.includes('-') ? val.split('-')[0] : val);

const registerSchema = baseMessageSchema.extend({
  name: z.string().min(1).max(100),
  topicId: accountFieldSchema,
  metadata: z.string().optional(),
  privateTopic: z.boolean() 
});

export default function CreateTopic() {
  const [isLoading, setIsLoading] = useState(false);
  const [createdTopicId, setCreatedTopicId] = useState('');
  const [createdMetadataTopicId, setCreatedMetadataTopicId] = useState('');
  const [submitKey, setSubmitKey] = useState('');
  const { walletInfo } = useContext(WalletContext);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mintingProgress, setMintingProgress] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [totalCost, setTotalCost] = useState(0);
  const [imageTopicMemo, setImageTopicMemo] = useState('');
  const [metadataTopicMemo, setMetadataTopicMemo] = useState('');
  const [attributes, setAttributes] = useState([{ trait_type: '', value: '' }]);
  const [isMintingOnOldToken, setIsMintingOnOldToken] = useState(false);
  const [hasRoyalty, setHasRoyalty] = useState(false);
  const [tokenId, setTokenId] = useState('');
  const [supplyKey, setSupplyKey] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [royaltyAmount, setRoyaltyAmount] = useState(0);
  const [royaltyAccount, setRoyaltyAccount] = useState('');
  const [maxSupply, setMaxSupply] = useState(1);
  const [newTokenId, setNewTokenId] = useState('');
  const [numberOfMints, setNumberOfMints] = useState(1);
  const [metadataUploadProgress, setMetadataUploadProgress] = useState(0);
  const [isMintingOptionsEnabled, setIsMintingOptionsEnabled] = useState(false);
  const [selectedDataKey, setSelectedDataKey] = useState('');
  const [selectedData, setSelectedData] = useState('');

  const handleDownload = (dataKey) => {
    const data = localStorage.getItem(dataKey);
    const blob = new Blob([data], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${dataKey}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const resetStates = () => {
    setIsLoading(false);
    setCreatedTopicId('');
    setCreatedMetadataTopicId('');
    setSubmitKey('');
    setSnackbarMessage('');
    setSelectedFile(null);
    setUploadProgress(0);
    setMintingProgress(0);
    setImageData(null);
    setTotalCost(0);
    setImageTopicMemo('');
    setMetadataTopicMemo('');
    setAttributes([{ trait_type: '', value: '' }]);
    setIsMintingOnOldToken(false);
    setHasRoyalty(false);
    setTokenId('');
    setSupplyKey('');
    setTokenName('');
    setTokenSymbol('');
    setRoyaltyAmount(0);
    setRoyaltyAccount('');
    setMaxSupply(1);
    setNewTokenId('');
    setNumberOfMints(1);
    setMetadataUploadProgress(0);
    setIsMintingOptionsEnabled(false);
    setSelectedDataKey('');
    setSelectedData('');
    setActiveStep(0)
};


  const [activeStep, setActiveStep] = useState(0);
    const steps = ['Upload Image', 'Create Metadata', 'Minting Options'];

    const handleNext = () => {
        setActiveStep((prevActiveStep) => prevActiveStep + 1);
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleReset = () => {
        setActiveStep(0);
    };

  const [metadata, setMetadata] = useState({
      name: '',
      creator: '',
      description: '',
  });
  const [isMetadataFormEnabled, setIsMetadataFormEnabled] = useState(false);


  const chargeForUpload = async () => {
    const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    client.setOperator(walletInfo.accountId, walletInfo.privateKey);

    const receivingAccount =  walletInfo.network === 'mainnet' ? '0.0.999000' : '0.0.1594'

    let cost =  walletInfo.network === 'mainnet' ? totalCost : 1
    new TransferTransaction()
      .addHbarTransfer(walletInfo.accountId, new Hbar(-cost)) // sending account
      .addHbarTransfer(receivingAccount, new Hbar(cost)) // receiving account
      .execute(client);
  };

  const handleAddAttribute = () => {
      setAttributes([...attributes, { trait_type: '', value: '' }]);
  };

  const handleRemoveAttribute = (index) => {
      setAttributes(attributes.filter((_, i) => i !== index));
  };

  const handleAttributeChange = (index, field, value) => {
      const newAttributes = attributes.map((attribute, i) => {
          if (i === index) {
              return { ...attribute, [field]: value };
          }
          return attribute;
      });
      setAttributes(newAttributes);
  };

    const [localStorageData, setLocalStorageData] = useState([]);
    useEffect(() => {
      if (selectedDataKey) {
          const storedData = localStorage.getItem(selectedDataKey);
          if (storedData) {
              const data = JSON.parse(storedData);
              // Assuming data structure is { supplyKey: '...', tokenId: '...' }
              setTokenId(data.tokenId || '');
              setSupplyKey(data.supplyKey || '');
              // Ensure that minting options are enabled if data is relevant
              setIsMintingOptionsEnabled(true);
          }
      }
  }, [selectedDataKey]); // This effect should run whenever selectedDataKey changes.
  
    useEffect(() => {
      const data = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('tokenData_') || key.startsWith('mintData_')) {
          const value = JSON.parse(localStorage.getItem(key));
          data.push({ key, value });
        }
      }
      setLocalStorageData(data);
    }, [activeStep]); // Re-run when activeStep changes to update the table when user reaches the last step.

const handleMetadataSubmit = async () => {
  setIsLoading(true)
      const metadataObj = {
          name: metadata.name,
          creator: metadata.creator,
          description: metadata.description,
          attributes: attributes,
          type: selectedFile.split('data:')[1].split(';')[0], // Ensure this is correct
          format: "412@2.0.0",
      };
  
      const metadataString = JSON.stringify(metadataObj);
      const metadataBase64 = btoa(metadataString); // Convert JSON string to base64
      //@ts-ignore
      if (window.electronAPI) {
          try {
              //@ts-ignore
              const response = await window.electronAPI.invoke('compressAndChunkSingleMetadata', metadataBase64);
              if (response.success) {
                  const { chunkedData, fileHash } = response;
                  console.log(chunkedData);
                  setMetadataTopicMemo(`${fileHash}:zstd:base64`);
                  setMetadataUploadProgress(10);
                  
                  const { topicId, submitKey } = await createNewHederaTopic();
                  setCreatedMetadataTopicId(topicId);
                  setMetadataUploadProgress(30);
  
                  await uploadMetadataToHedera(chunkedData, topicId, submitKey);
                  setMetadataUploadProgress(100);
                  setSnackbarMessage('Metadata processed and uploaded successfully!');
              } else {
                  console.error('Failed to process the metadata:', response.error);
                  setSnackbarMessage('Failed to process the metadata');
              }
          } catch (error) {
              console.error('Error uploading metadata:', error);
              setSnackbarMessage('Error uploading metadata');
              setIsLoading(false)
          }
      } else {
          console.error("Electron's IPC API is not available.");
      }
      setIsLoading(false)
  };
  

const createNewHederaTopic = async () => {
  if (!walletInfo.accountId) {
      throw new Error('Must enter wallet info first');
  }
  const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(walletInfo.accountId, walletInfo.privateKey);

  let transaction = new TopicCreateTransaction();
  const newSubmitKey = PrivateKey.generate();
  transaction.setTopicMemo(metadataTopicMemo);
  transaction.setSubmitKey(newSubmitKey);
  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);
  return {topicId: receipt.topicId.toString(), submitKey:newSubmitKey}; // Return the new topic ID
};

const uploadMetadataToHedera = async (chunkedData, topicId, submitKey) => {
  const imageManager = new HederaImageManager(walletInfo.accountId, walletInfo.privateKey, topicId, walletInfo.network, setImageData, setUploadProgress);
  await imageManager.uploadMetadata(JSON.stringify(chunkedData.chunks), submitKey); // Assuming your chunkedData is in the correct format
};

const mintInscription = async () => {
  setIsLoading(true); // Start loading
  setMintingProgress(0); // Initialize minting progress

  // Initialize Hedera client
  const client = walletInfo.network ==='mainnet' ? Client.forMainnet() : Client.forTestnet(); // or , depending on your environment
  client.setOperator(walletInfo.accountId, walletInfo.privateKey);

  let response; // This will store the response from the Hedera network
  let tokenSupplyKey
  let mintingTokenId
  if (isMintingOnOldToken) {
    tokenSupplyKey = PrivateKey.fromString(supplyKey)
    console.log(JSON.stringify(tokenId))
    mintingTokenId = tokenId
    setNewTokenId(tokenId)
    setMintingProgress(10); // Update progress
  } else  {
      const customRoyaltyFees = [];
      console.log('setting custom fee')

      if (hasRoyalty && royaltyAmount && royaltyAccount) {
        // Royalties on the token level
        const fee = new CustomRoyaltyFee()
            .setNumerator(royaltyAmount*100) // The numerator of the fraction
            .setDenominator(10000) // The denominator of the fraction
            .setFeeCollectorAccountId(royaltyAccount); // The account that will receive the royalty fee
            customRoyaltyFees.push(fee);
            setMintingProgress(20); // Update progress
      }

      console.log('4. generate supply key to ')
      let newSupplyKey = PrivateKey.generate();
      tokenSupplyKey = newSupplyKey
      // Convert PK string
      const privateKey = PrivateKey.fromString(walletInfo.privateKey)

      // Create a new token
      const tokenCreateTransaction = new TokenCreateTransaction()
          .setTreasuryAccountId(walletInfo.accountId)
          .setTokenType(TokenType.NonFungibleUnique)
          .setTokenName(tokenName)
          .setTokenSymbol(tokenSymbol)
          .setInitialSupply(0)
          .setMaxSupply(maxSupply)
          .setCustomFees(customRoyaltyFees)
          .setSupplyType(TokenSupplyType.Finite)
          .setTreasuryAccountId(walletInfo.accountId)
          .setAutoRenewAccountId(walletInfo.accountId)
          .setSupplyKey(newSupplyKey)
          .setMaxTransactionFee(new Hbar(1000))
          .freezeWith(client);

      
      console.log('6. sign transaction')
      const transaction = await tokenCreateTransaction.sign(privateKey);
      setMintingProgress(30); // Update progress

      /*  submit to the Hedera network */
      console.log('7. execute token create call')
      const response = await transaction.execute(client);
    
      /* Get the receipt of the transaction */
      console.log('8. get receipt')
      const receipt = await response.getReceipt(client).catch((e) => console.log(e));
      
      /* Get the token ID from the receipt */
      console.log(receipt)
      //@ts-ignore
      let tokenId = receipt.tokenId;
    
      let saveSupplyKey = newSupplyKey.toString()
      const saveData = {
          supplyKey: saveSupplyKey,
          tokenId: tokenId.toString(), 
      }
      
      console.log('9. write token data to save keys')
      localStorage.setItem(`tokenData_${tokenId}`, JSON.stringify(saveData));
      setNewTokenId(tokenId.toString())
      setTokenId(tokenId.toString())
      setSupplyKey(saveSupplyKey)
      setIsMintingOnOldToken(true)
      setMintingProgress(50); // Update progress
      mintingTokenId = tokenId.toString()
  }

  let limit_chunk = 1;
  const nbOfChunk = Math.ceil(numberOfMints / limit_chunk);
  let offset = 0;
  //TODO Update
  for (let i = 0; i < 1; i++) {
      const mintTransaction = new TokenMintTransaction().setTokenId(mintingTokenId);
      const itemsInThisChunk = limit_chunk;

      for (let j = 0; j < itemsInThisChunk; j++) {
          mintTransaction.addMetadata(
              Buffer.from(`hcs://1/${createdMetadataTopicId}`)
          );
      }
      offset = offset + itemsInThisChunk

      console.log(tokenSupplyKey)
      const signTx = await mintTransaction
          .setMaxTransactionFee(new Hbar(1000))
          .freezeWith(client)
          .sign(tokenSupplyKey);

      // Breaking here
      const resp = await signTx.execute(client);
      const receiptMint = await resp.getReceipt(client);

      const serialNumber = receiptMint.serials;
      console.log(serialNumber);
      setMintingProgress(50 + (50 * (i + 1) / numberOfMints)); // Update progress dynamically
      const mintData = JSON.stringify({
          txId: resp.transactionId.toString(),
          tokenId: newTokenId.toString(),
      });
      console.log(mintData);

      localStorage.setItem(`mintData_${tokenId}_${i}`, JSON.stringify(mintData));
    }
    setSnackbarMessage(`${numberOfMints} Hashinals Created Successfully!`);
    setMintingProgress(100); // Minting completed
    alert("Hashinal Inscribed!")
    setIsLoading(false); // Stop loading
}

  const createTopic = async () => {
    setIsLoading(true);
    if (!walletInfo.accountId) {
      alert('Must Enter Wallet Info first');
      setIsLoading(false);
      return;
    }
    try {
      const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
      client.setOperator(walletInfo.accountId, walletInfo.privateKey);

      let transaction = new TopicCreateTransaction();
      const newSubmitKey = PrivateKey.generate();
      transaction.setSubmitKey(newSubmitKey);
      const topicMemo = imageTopicMemo; // Generate hash from chunked data
      transaction.setTopicMemo(topicMemo);

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      const newTopicId = receipt.topicId.toString();

      if (newTopicId && selectedFile) {
          setCreatedTopicId(newTopicId); 
          await uploadImageToHedera(newTopicId, newSubmitKey);
          await chargeForUpload();
          setSnackbarMessage('Hashinal Inscribed and deploy successful!');
      }
     

      setIsLoading(false);
    } catch (error) {
      console.error('Error creating topic:', error);
      setSnackbarMessage('Error creating topic');
      setIsLoading(false);
    }
  };

  
  const uploadImageToHedera = async (topicId, submitKey) => {
    if (!imageData) {
      console.error('No image data found');
      setSnackbarMessage('No image data to upload');
      return;
    }
  
    const imageManager = new HederaImageManager(walletInfo.accountId, walletInfo.privateKey, topicId, walletInfo.network, setImageData, setUploadProgress);
    await imageManager.uploadImage(imageData, submitKey);
    setIsMetadataFormEnabled(true); // Enable the metadata form after successful upload

  };

  function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // The result attribute contains the data as a base64-encoded string.
            resolve(reader.result);
        };
        reader.onerror = error => reject(error);
        
        // Read the file (the result will be a data URL; a base64-encoded string)
        reader.readAsDataURL(file);
    });
}

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) {
        console.error('No file selected');
        return;
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (!validTypes.includes(file.type)) {
        setSnackbarMessage('Invalid file type. Please select a PNG, JPG, or JPEG image.');
        return;
    }
    //@ts-ignore
    if (window.electronAPI) {
        try {
            // Convert file to base64 in renderer process and send it to main process
            const base64 = await convertFileToBase64(file); // Implement this function or use FileReader

            //@ts-ignore
            const response = await window.electronAPI.invoke('b64EncodeFiles', file.path, file.type);
            if (response && response.success) {
                const base64Image = response.chunks;
                setImageTopicMemo(`${response.fileHash}:zstd:base64`);
                setImageData(`data:${file.type};base64,${base64Image}`);
                setSelectedFile(`data:${file.type};base64,${base64Image}`);
                setTotalCost(response.totalCostHbar);
                setSnackbarMessage('Image processed successfully!');
            } else {
                throw new Error(response.error);
            }
        } catch (error) {
            console.error('Error processing file:', error.message);
            setSnackbarMessage('Error processing file');
        }
    } else {
        console.error("Electron's IPC API is not available.");
    }
};



  return (
    <Box style={{ width: '100%', marginTop:"40px" }}>
      
      {activeStep === steps.length - 1 ?  
              <Box sx={{ display: 'flex', flexDirection:"column", maxWidth: '400px', margin: '20px auto' }}>
                
                <br />
                <Button
                color="inherit"
                disabled={activeStep === 0}
                onClick={handleBack}
                >
                  Back
                </Button>
              </Box>
            :
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, maxWidth: '400px', margin: '0 auto' }}>
              <Button
                color="inherit"
                disabled={activeStep === 0}
                onClick={handleBack}
              >
                Back
              </Button>
              <Button onClick={handleNext} disabled={activeStep === steps.length - 1|| !imageData}>
                {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
              </Button>
            </Box>
            }
            <Stepper activeStep={activeStep} alternativeLabel  style={{ width: '100%', marginTop:"40px" }}>
                {steps.map((label) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
            <div>
                {activeStep === steps.length ? (
                    <div>
                        <Typography sx={{ mt: 2, mb: 1 }}>
                            All steps completed - you&apos;re finished
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                            <Box sx={{ flex: '1 1 auto' }} />
                            <Button onClick={handleReset}>Reset</Button>
                        </Box>
                    </div>
                ) : (
                    <div>
                        <center><h2 style={{margin: "40px auto 0", position:"relative"}}></h2></center>
                        <Box sx={{ mb: 2 }} style={{background: "linear-gradient(135deg, #040404, #080808)"}}>
                            <div>
                                <Grid container spacing={2}>
                                  {activeStep === 0 && (
                                    <Grid item xs={12}   marginTop={4}>
                                    <Paper elevation={3} style={{ padding: '20px',  maxWidth: '400px',margin: '20px auto', marginTop: '20px' }}>
                                      <div style={{ width: '100%', maxWidth: '400px', margin: '0 auto' }}>
                                        {
                                          imageData ? 
                                            <img style={{ width: '100%', maxWidth: '400px', objectFit: 'cover', margin:"0 auto", position:"relative" }} src={imageData} alt="Uploaded" /> : 
                                            <Box height="300px" bgcolor="#1C1C1C" display="flex" alignItems="center" justifyContent="center">
                                              <Typography color="textSecondary">No Image Uploaded</Typography>
                                            </Box>
                                        }
                                      </div>
                                      <Button
                                        style={{ float: "left", width: "100%", margin: "15px 0" }}
                                        variant="contained"
                                        disabled={isLoading}
                                        component="label"
                                      >
                                        Upload File
                                        <input
                                          type="file" 
                                          accept="image/png, image/jpeg, image/jpg, image/gif" 
                                          onChange={handleFileChange}
                                          hidden
                                        />
                                      </Button>
                                      
                                      <br />
                                      <Button 
                                        style={{ float: "left", width: "100%", margin: "15px 0" }}
                                        variant="contained" 
                                        color="primary" 
                                        onClick={createTopic} 
                                        disabled={isLoading || !imageData}
                                      >
                                        {isLoading ? <CircularProgress size={24} /> : 'Inscribe'}
                                      </Button>
                                      <br />
                                      
                                      <Box padding={2} bgcolor="black" boxShadow={4} borderRadius={2} marginTop={12}>
                                        {uploadProgress > 0 && (
                                          <Box display="flex" alignItems="center" width="100%">
                                            <Box width="100%" mr={1}>
                                            <Typography variant="subtitle1" gutterBottom>
                                              <Typography variant="h6" color="white">Inscription Progress:  {`${Math.round(uploadProgress)}%`}</Typography>
                                              
                                            </Typography>
                                              <LinearProgress variant="determinate" value={uploadProgress} />
                                            
                                            </Box>
                                          </Box>
                                        )}
                                        {createdTopicId && (
                                          <Box paddingY={1} marginTop={2}>
                                            <Typography variant="subtitle1" gutterBottom>
                                              Hashinal Inscribing to:
                                            </Typography>
                                            <Typography variant="h6" color="violet">
                                              {createdTopicId}
                                            </Typography>
                                          </Box>
                                        )}
                                        <Accordion sx={{ bgcolor: 'background.default', my: 2 }}>
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                            aria-controls="panel1a-content"
                                            id="panel1a-header"
                                        >
                                            <Typography sx={{ fontWeight: 'bold' }}>How to Inscribe</Typography>
                                        </AccordionSummary>
                                        <AccordionDetails>
                                            <Typography paragraph>
                                                Please follow the instructions below to ensure your images and metadata are correctly inscribed:
                                            </Typography>
                                            <Typography paragraph>
                                                * Upload image: Click 'Upload File' and choose your image file. Allowed formats are PNG, JPEG, and GIF. Inscribe then click 'Next'
                                            </Typography>
                                            <Typography paragraph>
                                                * Create metadata file: Dynamically add attributes, description, then inscribe the metadata. The tool will make it HIP-412 compliant.
                                            </Typography>
                                            <Typography paragraph>
                                                * Inscription fee: The inscription fee is derived based on the total size of the image and metadata files. Additional network fees may apply, calculations can be wrong.
                                            </Typography>
                                        </AccordionDetails>
                                    </Accordion>
                                        
                                        <Box paddingY={1}>
                                          <Grid container spacing={2}>
                                            <Grid item xs={12}>
                                              <Typography variant="subtitle1" gutterBottom>
                                                Inscribing Fee:
                                              </Typography>
                                              <Typography variant="h6" color="violet">
                                                {totalCost}ℏ
                                              </Typography>
                                            
                                            </Grid>
                                          </Grid>
                                        </Box>
                                      </Box>
                                    </Paper>
                                    

                                    <Snackbar
                                      open={!!snackbarMessage}
                                      autoHideDuration={6000}
                                      onClose={() => setSnackbarMessage('')}
                                      message={snackbarMessage}
                                    />
                                    </Grid>
                                  )}
                                  {activeStep === 1 && (
                                    <Grid item xs={12}  marginTop={4}>
                                    <Paper elevation={5} style={{ padding: '20px', maxWidth: '400px',margin: '20px auto', marginTop: '20px' }}>
                                        <Typography variant="h6" gutterBottom>
                                            Create Metadata
                                        </Typography>
                                        <TextField
                                            fullWidth
                                            label="Name"
                                            variant="outlined"
                                            value={metadata.name}
                                            onChange={(e) => setMetadata({ ...metadata, name: e.target.value })}
                                            margin="normal"
                                            disabled={!isMetadataFormEnabled}
                                        />
                                        <TextField
                                            fullWidth
                                            label="Creator"
                                            variant="outlined"
                                            value={metadata.creator}
                                            onChange={(e) => setMetadata({ ...metadata, creator: e.target.value })}
                                            margin="normal"
                                            disabled={!isMetadataFormEnabled}
                                        />
                                        <div  style={{ padding: '20px 0', marginTop: '20px'}}>
                                            <Typography variant="h6" gutterBottom>
                                                Attributes
                                            </Typography>
                                            {attributes.map((attribute, index) => (
                                                <Box key={index} style={{marginTop: '20px'}} display="flex" alignItems="center" marginBottom={2}>
                                                    <TextField
                                                        label="Trait Type"
                                                        variant="outlined"
                                                        value={attribute.trait_type}
                                                        onChange={(e) => handleAttributeChange(index, 'trait_type', e.target.value)}
                                                        style={{ marginRight: '8px' }}
                                                        disabled={!isMetadataFormEnabled}
                                                    />
                                                    <TextField
                                                        label="Value"
                                                        variant="outlined"
                                                        value={attribute.value}
                                                        onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                                                        style={{ marginRight: '8px' }}
                                                        disabled={!isMetadataFormEnabled}
                                                    />
                                                    <Button
                                                        variant="outlined"
                                                        color="error"
                                                        onClick={() => handleRemoveAttribute(index)}
                                                        disabled={!isMetadataFormEnabled || attributes.length === 1}
                                                    >
                                                        Remove
                                                    </Button>
                                                </Box>
                                            ))}
                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                onClick={handleAddAttribute}
                                                disabled={!isMetadataFormEnabled}
                                            >
                                                Add Attribute
                                            </Button>
                                        </div>

                                        <TextField
                                            fullWidth
                                            label="Description"
                                            variant="outlined"
                                            value={metadata.description}
                                            multiline
                                            rows={4}
                                            onChange={(e) => setMetadata({ ...metadata, description: e.target.value })}
                                            margin="normal"
                                            disabled={!isMetadataFormEnabled}
                                        />
                                        {/* <TextField
                                            fullWidth
                                            label="Number of Hashinals"
                                            variant="outlined"
                                            type="number"
                                            InputProps={{ inputProps: { min: 1 } }}
                                            value={metadata.numberOfMints}
                                            onChange={(e) => setMetadata({ ...metadata, numberOfMints: parseInt(e.target.value, 10) })}
                                            margin="normal"
                                            disabled={!isMetadataFormEnabled}
                                        /> */}
                                        <Button 
                                              style={{ float: "left", width: "100%", margin: "15px 0" }}
                                              variant="contained" 
                                              color="primary" 
                                              onClick={handleMetadataSubmit} 
                                              disabled={!isMetadataFormEnabled || isLoading}
                                          >
                                              {isLoading ? <CircularProgress size={24} /> : 'Inscribe Metadata'}
                                          </Button>

                                          <br />

                                          <Box padding={2} bgcolor="black" boxShadow={4} borderRadius={2} marginTop={12}>
                                              {metadataUploadProgress > 0 && (
                                                  <Box display="flex" alignItems="center" width="100%">
                                                      <Box width="100%" mr={1}>
                                                          <Typography variant="subtitle1" gutterBottom>
                                                              <Typography variant="h6" color="white">Metadata Upload Progress: {`${Math.round(metadataUploadProgress)}%`}</Typography>
                                                          </Typography>
                                                          <LinearProgress variant="determinate" value={metadataUploadProgress} />
                                                      </Box>
                                                  </Box>
                                              )}
                                              {createdMetadataTopicId && (
                                                  <Box paddingY={1} marginTop={2}>
                                                      <Typography variant="subtitle1" gutterBottom>Metadata Inscribing to:</Typography>
                                                      <Typography variant="h6" color="violet">{createdMetadataTopicId}</Typography>
                                                  </Box>
                                              )}

                                              {/* <Box paddingY={1}>
                                                  <Grid container spacing={2}>
                                                      <Grid item xs={12}>
                                                          <Typography variant="subtitle1" gutterBottom>Inscribing Fee:</Typography>
                                                          <Typography variant="h6" color="violet">{totalCost}ℏ</Typography>
                                                      </Grid>
                                                  </Grid>
                                              </Box> */}
                                          </Box>
                                    </Paper>
                                    </Grid>
                                  )}
                                  {activeStep === 2 && (
                                    <Grid item xs={12}>

                                    <Paper elevation={3} style={{ padding: '20px', maxWidth: '400px',margin: '20px auto', marginTop: '20px' }}>
                                        <Typography variant="h6">Minting Options</Typography>
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={isMintingOnOldToken}
                                                    onChange={(e) => setIsMintingOnOldToken(e.target.checked)}
                                                />
                                            }
                                            label="I am going to mint on a old Token Id"
                                        />
                                        {/* <TextField
                                            label="Number of Mints"
                                            variant="outlined"
                                            value={numberOfMints}
                                            type="number"
                                            onChange={(e) => setNumberOfMints(e.target.value)}
                                            fullWidth
                                            margin="normal"
                                        /> */}
                                        {isMintingOnOldToken ? (
                                            <Box>
                                                <TextField
                                                    label="Token Id"
                                                    variant="outlined"
                                                    value={tokenId}
                                                    onChange={(e) => setTokenId(e.target.value)}
                                                    fullWidth
                                                    margin="normal"
                                                />
                                                <TextField
                                                    label="Supply Key"
                                                    variant="outlined"
                                                    value={supplyKey}
                                                    onChange={(e) => setSupplyKey(e.target.value)}
                                                    fullWidth
                                                    margin="normal"
                                                />
                                            </Box>
                                        ) : (
                                            <Box>
                                                <FormControlLabel
                                                    control={
                                                        <Checkbox
                                                            checked={hasRoyalty}
                                                            onChange={(e) => setHasRoyalty(e.target.checked)}
                                                        />
                                                    }
                                                    label="Add a Royalty"
                                                />
                                                <TextField
                                                    label="Token Name"
                                                    variant="outlined"
                                                    value={tokenName}
                                                    onChange={(e) => setTokenName(e.target.value)}
                                                    fullWidth
                                                    margin="normal"
                                                />
                                                <TextField
                                                    label="Token Symbol"
                                                    variant="outlined"
                                                    value={tokenSymbol}
                                                    onChange={(e) => setTokenSymbol(e.target.value)}
                                                    fullWidth
                                                    margin="normal"
                                                />
                                                
                                                <TextField
                                                    label="Max Supply"
                                                    variant="outlined"
                                                    value={maxSupply}
                                                    type="number"
                                                    onChange={(e) => setMaxSupply(parseInt(e.target.value))}
                                                    fullWidth
                                                    margin="normal"
                                                />
                                                {hasRoyalty && (
                                                  <>
                                                    <TextField
                                                        label="Royalty Amount (in %)"
                                                        type="number"
                                                        variant="outlined"
                                                        value={royaltyAmount}
                                                        onChange={(e) => setRoyaltyAmount(parseInt(e.target.value))}
                                                        fullWidth
                                                        margin="normal"
                                                    />
                                                    <TextField
                                                        label="Royalty Account"
                                                        variant="outlined"
                                                        value={royaltyAccount}
                                                        onChange={(e) => setRoyaltyAccount(e.target.value)}
                                                        fullWidth
                                                        margin="normal"
                                                    />
                                                  </>
                                                )}
                                            </Box>
                                        )}
                                         {activeStep === steps.length - 1 &&
                                            <Box sx={{ display: 'flex', flexDirection:"column", maxWidth: '400px', margin: '20px auto' }}>
                                              <Button
                                                color="primary"
                                                variant='contained'
                                                disabled={(((hasRoyalty && (!royaltyAccount || !royaltyAmount)) || !tokenSymbol || !tokenName)  && !isMintingOnOldToken) || ((!supplyKey || !tokenId )&& isMintingOnOldToken)|| isLoading}
                                                onClick={mintInscription}
                                              >
                                                {isLoading ? <CircularProgress size={24} /> : 'Create Hashinal'}
                                              </Button>
                                              </Box>
                                          }

                                          <Box padding={2} bgcolor="black" boxShadow={4} borderRadius={2}>
                                              {/* You might display minting status or progress here */}
                                              {/* Replace {mintingProgress} with your state tracking mint progress */}
                                              <Typography variant="h6" color="white">Minting Progress: {`${Math.round(mintingProgress)}%`}</Typography>
                                              <LinearProgress variant="determinate" value={mintingProgress} />

                                              {/* Display newly created token information if available */}
                                              {newTokenId && (
                                                  <Box paddingY={1} marginTop={2}>
                                                      <Typography variant="subtitle1" gutterBottom>New Token ID:</Typography>
                                                      <a target="_blank" style={{textDecoration:'none'}} href={`https://hashscan.io/${walletInfo.network}/token/${newTokenId}`}><Typography variant="h6" color="violet">{newTokenId}</Typography></a>
                                                  </Box>
                                              )}

                                             
                                          </Box>
                                        </Paper>
                                    </Grid>
                                  )}
                                  
                                  
                                </Grid>

                                
                                  {activeStep === steps.length - 1 && (
                                      <div style={{ background:"#090909",width: "800px", padding:"20px", margin: "0 auto" }}>
                                        <Grid item style={{ width: 800 }} xs={12}>
                                          <Typography variant="h6" gutterBottom style={{ marginTop: '20px' }}>
                                            Select to Mint, View and Download
                                          </Typography>
                                          <Select
                                            fullWidth
                                            value={selectedDataKey}
                                            label="Select Data"
                                            onChange={(e) => {
                                              const key = e.target.value;
                                              setSelectedDataKey(key);
                                              const data = localStorage.getItem(key);
                                              setSelectedData(data ? JSON.parse(data) : ''); // Parse JSON string to object
                                            }}
                                          >
                                            {Object.keys(localStorage).map((key) => (
                                              <MenuItem key={key} value={key}>
                                                {key}
                                              </MenuItem>
                                            ))}
                                          </Select>
                                        </Grid>
                                        <Grid item xs={12} style={{ marginTop: '20px' }}>
                                          <Typography variant="h6" gutterBottom>
                                            Data Details
                                          </Typography>
                                          <Paper style={{ padding: '20px', overflowX: 'auto' }}> {/* Ensure the content is scrollable if it overflows */}
                                              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                                                  {JSON.stringify(selectedData, null, 2)}
                                              </pre> {/* Format the JSON data with indentation for readability */}
                                              <IconButton onClick={() => handleDownload(selectedDataKey)} color="primary" aria-label="download">
                                                  <DownloadIcon /> 
                                              </IconButton>
                                              Download Data
                                          </Paper>
                                        </Grid>
                                      </div>
                                    )}
                                  {activeStep === steps.length - 1 ?  
                                    <Box sx={{ display: 'flex', flexDirection:"column", maxWidth: '400px', margin: '20px auto' }}>
                                      
                                      <br />
                                      <Button
                                      color="inherit"
                                      disabled={activeStep === 0}
                                      onClick={handleBack}
                                      >
                                        Back
                                      </Button>
                                    </Box>
                                  :
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, maxWidth: '400px', margin: '0 auto' }}>
                                    <Button
                                      color="inherit"
                                      disabled={activeStep === 0}
                                      onClick={handleBack}
                                    >
                                      Back
                                    </Button>
                                    <Button onClick={handleNext} disabled={activeStep === steps.length - 1|| !imageData}>
                                      {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                                    </Button>
                                  </Box>
                                  }
                              <center> <Button
                                  color="inherit"
                                  disabled={isLoading}
                                  onClick={()=>resetStates()}
                                >
                                  Reset
                                </Button></center>
                                  <br />
                                  
                              </div>
                              
                        </Box>
                    </div>
                  )}
                </div>
            </Box>
  );
}
