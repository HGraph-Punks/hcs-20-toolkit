import React, { useState, useContext } from 'react';
import { Button, Container, Typography, CircularProgress, Box, Paper, Grid, Snackbar, LinearProgress } from '@mui/material';
import { WalletContext } from '../components/WalletContext';
import { Client, TopicCreateTransaction, PrivateKey, TopicMessageSubmitTransaction, Hbar, TransferTransaction } from '@hashgraph/sdk';
import { z } from 'zod';
import axios from 'axios'
import chunk from 'lodash/chunk'; // Ensure you have lodash installed


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
  const [submitKey, setSubmitKey] = useState('');
  const { walletInfo } = useContext(WalletContext);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [imageData, setImageData] = useState(null);
  const [totalCost, setTotalCost] = useState(0);
  const hashinalsRegistry = '0.0.2658237'

  async function getUsdToHbarRate() {
    try {
      // Fetch the current exchange rate from CoinGecko API
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd');
      const rate = response.data['hedera-hashgraph'].usd; // Adjust according to the actual response structure
      return rate;
    } catch (error) {
      console.error('Failed to fetch USD to HBAR rate:', error);
      return null; // Return null or appropriate error response
    }
  }
  const chargeForUpload = async () => {
    const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    client.setOperator(walletInfo.accountId, walletInfo.privateKey);

    // TODO: update hard coding of account to be 
    const receivingAccount =  walletInfo.network === 'mainnet' ? '0.0.999000' : '0.0.1594'
    new TransferTransaction()
      .addHbarTransfer(walletInfo.accountId, Hbar.fromTinybars(-20000000000)) // sending account
      .addHbarTransfer(receivingAccount, Hbar.fromTinybars(20000000000)) // receiving account
      .execute(client);
  };

  const registerUploadToRegistry = async (topicId) => {
    const messageJson = {
      p: "hashinals",
      op: "deploy",
      t_id: topicId,
      to: walletInfo.accountId
    };

    const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    client.setOperator(walletInfo.accountId, walletInfo.privateKey);

    const transaction = new TopicMessageSubmitTransaction()
      .setTopicId(hashinalsRegistry)
      .setMessage(JSON.stringify(messageJson));

    const response = await transaction.execute(client);
    const receipt = await response.getReceipt(client);
    console.log(`Message submitted successfully to topic 0.0.2658160, sequence number: ${receipt.topicSequenceNumber}`);
  };

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
      setSubmitKey(newSubmitKey.toString());

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      const newTopicId = receipt.topicId.toString();
      setCreatedTopicId(newTopicId);

      if (newTopicId && selectedFile) {
        await registerUploadToRegistry(newTopicId);
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
  };
  

  
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setUploadProgress(0)
    setCreatedTopicId(null)
    setSelectedFile(file);
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    if (file && validTypes.includes(file.type)) {
      setSelectedFile(file);
      //@ts-ignore
      if (window.electronAPI) {
        //@ts-ignore
        window.electronAPI.invoke('read-file', file.path).then(async(base64Image:string) => {
          console.log(base64Image); // Log the base64 image string for debugging
          setImageData(base64Image); // Set image data
  
          const baseFeeHbar = 50; // 200 Hbar base fee
          const feePerByteUsd = 0.0001; // Fee per byte in USD
          const usdToHbarRate = await getUsdToHbarRate(); // Get the current USD to HBAR exchange rate
        
          if (!usdToHbarRate) {
            setSnackbarMessage('Failed to fetch the current HBAR rate.');
            return;
          }
          const imageSizeBytes = base64Image.length; // Size of the image in bytes
          const totalCostUsd = baseFeeHbar * usdToHbarRate + feePerByteUsd * (imageSizeBytes / 1024); // Total cost in USD
          const totalCostHbar = totalCostUsd / usdToHbarRate; // Convert the total cost to HBAR
          //@ts-ignore
          setTotalCost(totalCostHbar.toFixed(6));
        });
      } else {
        console.error('electronAPI is not available');
        // Handle the case where ipcRenderer is not available
      }
    } else {
      setSnackbarMessage('Invalid file type. Please select a PNG, JPG, or JPEG image.');
    }
  };
  


  return (
    <Container>
      <br />
      <Typography variant="h4" gutterBottom>Hashinals</Typography>
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
    </Container>
  );
}
