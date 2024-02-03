import path from 'path'
import { app, ipcMain } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
const axios = require('axios');

const isProd = process.env.NODE_ENV === 'production'

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

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

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})
