import path from 'path'
import { app, ipcMain, protocol } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
const axios = require('axios');
import crypto from 'crypto';
import { compress } from '@mongodb-js/zstd';


const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}


;(async () => {
  await app.whenReady()
  // setupLocalFilesNormalizerProxy()

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }
})()

app.on('window-all-closed', () => {
  app.quit()
})


ipcMain.handle('fetch-topic-data', async (event, topic_id, pk) => { 

  let allMessages = [];
  const getTopicIdData = async (topic_id, pk) => {
    // Get farming url endpoint
    const endpoint = "https://beta.api.hgraph.io/v1/graphql"
    const headers = {
      "content-type": "application/json",
      "x-api-key": pk
    };
  
    let offset = 0;
    const limit = 100000;
    let hasMore = true;
  
    while (hasMore) {
      const topicIdQuery = {
        "operationName": "GetTopicIdData",
        "query": `query GetTopicIdData($topic_id: bigint, $limit: Int, $offset: Int) {
          topic_message(where: {topic_id: {_eq: $topic_id}}, order_by: {consensus_timestamp: asc}, limit: $limit, offset: $offset) {
            message
            sequence_number
            consensus_timestamp
          }
        }`,
        "variables": {
          "topic_id": topic_id,
          "limit": limit,
          "offset": offset
        }
      };
  
      const response = await axios({
        url: endpoint,
        method: 'post',
        headers: headers,
        data: topicIdQuery
      });
  
      const topicMessages = response.data?.data?.topic_message;

      const hex2a = (hexx) => {
        let hex = hexx.toString();//force conversion
        hex = hex.split('\\x')[1]
        let str = '';
        for (let i = 0; i < hex.length; i += 2)
            str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
        return str;
      }

      if (topicMessages && topicMessages.length > 0) {
        // Process and add the messages to allMessages
        const decodedMessages = topicMessages.map(topicMessage => {
          const messageString = hex2a(topicMessage.message);
          const decodeMessage = (decodedMessage) => JSON.parse('{"' + decodeURI(decodedMessage).replace(/"/g, '\\"').replace(/&/g, '","').replace(/=/g,'":"') + '"}')
            
          const isJsonString = str => {
            try {
              JSON.parse(str);
              return true;
            } catch (e) {
              return false;
            }
          };
          return isJsonString(messageString) ? JSON.parse(messageString) : decodeMessage(messageString);
        });
  
        allMessages.push(...decodedMessages);
        // Check if more messages are available
        hasMore = topicMessages.length < 8000000;
        offset += limit;
      } else {
        hasMore = false;
      }
    }
  
    return allMessages;
  };

  const finalMesages = await getTopicIdData(topic_id, pk)
  return finalMesages
});

ipcMain.handle('perform-request', async (event, url) => {
  try {
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error('Error performing request:', error);
    throw error;
  }
});
const fs = require('fs');
const mime = require('mime-types');

ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    const mimeType = mime.lookup(filePath) || 'application/octet-stream'; // Fallback to binary stream if MIME type is not found
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch (error) {
    console.error('Failed to read file:', error);
    return null; // Return null or appropriate error response
  }
});

ipcMain.handle('b64EncodeFiles', async (event, filePath, mimeType) => {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];

  if (validTypes.includes(mimeType)) {
      try {
          const fileData = fs.readFileSync(filePath, { encoding: 'base64' });
          const fileHash = generateFileHash(Buffer.from(fileData, 'base64')); // ensure this function exists and is correct
          const imageSizeBytes = Buffer.byteLength(fileData, 'base64');

          // Assuming getUsdToHbarRate is an asynchronous function you've defined to get the current rate
          const usdToHbarRate = await getUsdToHbarRate();
          if (!usdToHbarRate) throw new Error('Failed to fetch the current HBAR rate.');

          const feePerKByteUsd = 0.0001;
          const feePerByteHBAR = 0.5;
          const costOfNewTopicId = 0.01;
          const costOfNewTokenId = 1;

          const totalCostUsd = (imageSizeBytes / 1024) * feePerKByteUsd + costOfNewTopicId + costOfNewTokenId;
          const totalCostHbar = (imageSizeBytes / 1024) * feePerByteHBAR;

          return {
              success: true,
              chunks: fileData,
              fileHash: fileHash,
              totalCostHbar: Math.ceil(totalCostHbar + totalCostUsd * usdToHbarRate)
          };
      } catch (error) {
          console.error('Error processing file:', error);
          return { success: false, error: 'Error processing file' };
      }
  } else {
      return { success: false, error: 'Invalid file type.' };
  }
});



ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})


async function getUsdToHbarRate() {
  try {
      const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd');
      return response.data['hedera-hashgraph'].usd;
  } catch (error) {
      console.error('Failed to fetch USD to HBAR rate:', error);
      return null;
  }
}


function generateFileHash (file) {
  const hash = crypto.createHash('sha256');
  hash.update(file);
  return hash.digest('hex');
}


function chunkMessage(message, chunkSize, prefix) {
  let messageArray = [];
  // Calculate the adjusted chunk size for the first chunk, considering the prefix length
  const firstChunkSize = chunkSize - prefix.length;
  
  // Loop through the message to create chunks
  for (let o = 0, offset = 0; offset < message.length; o++) {
      // Determine the size of the current chunk
      let currentChunkSize = o === 0 ? firstChunkSize : chunkSize;
      
      // Slice the current chunk from the message
      const chunkContent = o === 0 
          ? prefix + message.slice(offset, offset + currentChunkSize) 
          : message.slice(offset, offset + currentChunkSize);
      
      // Add the current chunk to the array
      messageArray.push({ o, c: chunkContent });
      
      // Move the offset forward by the size of the current chunk
      offset += currentChunkSize;
  }
  return messageArray;
}

ipcMain.handle('compressAndChunkSingleMetadata', async (event, metadataBlob) => {
  try {
      // Assuming metadataBlob is already the base64 string representation
      const fileData = Buffer.from(metadataBlob, 'base64'); // Convert base64 back to binary
      const fileHash = generateFileHash(fileData); // Generate hash from the actual file data
      const compressedData = await compress(fileData); // Compress the actual file data
      const base64Data = compressedData.toString('base64'); // Convert compressed data to Base64
      
      // Further chunk and prepare data as needed, then return]

      // Determine the maximum data size per message
      const constantPart = JSON.stringify({ c: '', o: 0 });
      const constantPartLength = constantPart.length;
      const estimatedMaxChunks = Math.ceil(base64Data.length / 1024);
      const maxOSize = estimatedMaxChunks.toString().length;
      const maxDataSizePerMessage = 1024 - constantPartLength - maxOSize;

      // Adjust chunk size as needed
      const mimeType = "application/json";
      const chunkSize = maxDataSizePerMessage;
      const dataPrefix = `data:${mimeType};base64,`;
      const chunks = chunkMessage(base64Data, chunkSize, dataPrefix);

      return { success: true, chunkedData: { index: 0, chunks, fileHash } }; // Send back the processed data
  } catch (error) {
      console.error('Error processing metadata:', error);
      return { success: false, error: error.message };
  }
});