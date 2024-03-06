import {useEffect, useState, useContext} from 'react'
import { Client, TopicCreateTransaction, PrivateKey, TopicMessageSubmitTransaction, Hbar, TransferTransaction } from '@hashgraph/sdk';
import { Paper, Stepper, Step, List, ListItem, ListItemText,StepLabel, Button, Typography, Box, Grid, TextField, Checkbox, Snackbar, LinearProgress, CircularProgress } from '@mui/material';

import OpenInNewIcon from '@mui/icons-material/OpenInNew';


// TODO

// [x] Create upload of images
// [x] Create progress bar for image upload
// [x] Chunk data into HCS-1 compliant syntax
// [x] Create an array of all chunked image data with hashs and index
// [x] Create route to create a topic id with correct HCS-5 formatting
// [x] Organize images by file name to gaurentee linear upload 
// [x] Upload images to newly created topic ids with submit keys and hashes
// [x] Create array of all the topic ids of the uploaded files
// [x] Create mapping of metadata.json to topic ids / hcs:// for image files in each JSON object
// [] Create new token ID or use exisiting token id
// [] Mint onto token with the new protocol hcs:// for the images
// [] Display mints and save in local storage 



// import {
//   singleImageMint,
//   mintHashlips,
// } from '../lib/tokenService'
   
import {uploadFile} from '../lib/fileService'
import TMTContext from '../context/tmtContext'
import { WalletContext } from '../components/WalletContext';
import axios from 'axios'



export default function Dashboard () {
    /* Create State for Tabs */
    const [tab, setTab] = useState('1');
    const [hashLipsImages, setHashLipsImages] = useState([]);
     
    // Read context of signed in Xact wallet creds
    const {
      user,
      accountId,
      hederaMainnetEnv,
      hashlipsToken,
      setHashlipsToken,
      token,
      setToken
    } = useContext(TMTContext)

  const { walletInfo } = useContext(WalletContext);

  const steps = ['Inscribe Images and Metadata', 'Mint Inscriptions', 'View Created Hashinals'];

  const [alreadyMintedToken, setAlreadyMintedToken] = useState(false);
  const [alreadyCreatedCIDs, setAlreadyCreatedCIDs] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [totalCost, setTotalCost] = useState(0);
  const [totalMetadataFiles, setTotalMetadataFiles] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [topicIds, setTopicIds] = useState([]);
  const [metadataTopicIds, setMetadataTopicIds] = useState([]);
  const [updatedMetadata, setUpdatedMetadata] = useState([]);
  const [processedMetadata, setProcessedMetadata] = useState([]);


  const [activeStep, setActiveStep] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [mintedTokens, setMintedTokens] = useState([]);

  // Function to move to the next step
  const handleNext = () => {
      setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  // Function to move to the previous step
  const handleBack = () => {
      setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  // Function to reset the stepper
  const handleReset = () => {
      setActiveStep(0);
      setUploadedFiles([]);
      setMintedTokens([]);
  };

    const handleUpdateMetadata = async () => {
      const newMetadata = [];
      const metadata = document.getElementById("hl-json").files[0];
     
          const formData = new FormData();
          console.log(topicIds)
          formData.append('metadata', metadata); 
          formData.append('topicIds', JSON.stringify(topicIds)); 

          let finalJson 
          try {
              const response = await axios.post('/api/compressAndChunkMetadata', formData, { 
                  headers: {
                      'Content-Type': 'multipart/form-data',
                  },
                  onUploadProgress: progressEvent => {
                      const percentCompleted = Math.round((progressEvent.loaded * 100) / metadata.length);
                      setUploadProgress(percentCompleted);
                  },
              });
              if (response.data.success) {
                  finalJson = response.data.finalJson
                  setProcessedMetadata(prev => [...prev, response.data.finalJson]);
                  setSnackbarMessage(`metadata processed and chunked successfully!`);
              } else {
                  setSnackbarMessage(`Failed to process metadata.`);
              }

          } catch (error) {
              console.error(`Error during image processing: metadata`, error);
              setSnackbarMessage(`Error during image processing: metadata.`);
          }
      
      setTotalMetadataFiles(finalJson.length);
          console.log(processedMetadata)
      for (let index = 0; index < finalJson.length; index++) {
        const file = finalJson[index];
        console.log(file);
        const newTopicId = await createTopicAndUploadChunks(file)
        console.log("topic id:", index+" "+newTopicId)
        // Update uploaded file count
        setFilesUploaded(prev => prev + 1);
        setMetadataTopicIds(prevMetadataTopicIds => [...prevMetadataTopicIds, {newTopicId, index}]);
      }

      setLoading(false);
      setUpdatedMetadata(newMetadata);
      // Optionally, save the updated metadata to local storage or upload it somewhere
  };
  
    const handleAMTChange = (event) => {
      setAlreadyMintedToken(event.target.checked);
    };
    const handleCIDChange = (event) => {
      setAlreadyCreatedCIDs(event.target.checked);
    };

    const [uploadProgress, setUploadProgress] = useState(0);
    const [processedFiles, setProcessedFiles] = useState([]);
    
    // Function to convert FileList to an array and sort it numerically based on file names.
    const sortFilesNumerically = (fileList) => {
      return Array.from(fileList).sort((a, b) => {
          // Extracting numerical parts from filenames
          const numA = parseInt(a.name.match(/\d+/), 10);
          const numB = parseInt(b.name.match(/\d+/), 10);
          return numA - numB; // Sort by numerical part
      });
    };

    // Event handler for file selection
    const handleFileSelect = (event) => {
      const files = event.target.files;
      const sortedFiles = sortFilesNumerically(files);
      console.log("Sorted files:", sortedFiles.map(file => file.name)); // Debugging: Log sorted filenames
      setHashLipsImages(sortedFiles);
    };


    const initMintingHashlips = async () => {
        setLoading(true);
        setProcessedFiles([]);
        setUploadProgress(0);

        // Update for single file processing, remove the loop if processing multiple files one by one
        for (let i = 0; i < hashLipsImages.length; i++) {
            const formData = new FormData();
            formData.append('image', hashLipsImages[i]); 

            try {
                const response = await axios.post('/api/compressAndChunkFiles', formData, { 
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                    onUploadProgress: progressEvent => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / hashLipsImages.length);
                        setUploadProgress(percentCompleted);
                    },
                });

                if (response.data.success) {
                    setProcessedFiles(prev => [...prev, response.data.chunkedImage]);
                    setSnackbarMessage(`${hashLipsImages[i].name} processed and chunked successfully!`);
                } else {
                    setSnackbarMessage(`Failed to process ${hashLipsImages[i].name}.`);
                }

            } catch (error) {
                console.error(`Error during image processing: ${hashLipsImages[i].name}`, error);
                setSnackbarMessage(`Error during image processing: ${hashLipsImages[i].name}.`);
            }
        }
        setTotalFiles(processedFiles.length);
        for (let index = 0; index < processedFiles.length; index++) {
          const file = processedFiles[index];
          const newTopicId = await createTopicAndUploadChunks(file)
          console.log("topic id:", index+" "+newTopicId)
          // Update uploaded file count
          setFilesUploaded(prev => prev + 1);
          setTopicIds(prevTopicIds => [...prevTopicIds, {newTopicId, index}]);
        }

        setLoading(false);
    };
  
    
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

    const downloadLogs = () => {
      const tokens = tab === "7" ? localStorage.getItem('hashlipsMintData') : localStorage.getItem('tmt_tokens');
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(tokens);
      const dlAnchorElem = document.getElementById('downloadAnchorElem');
      dlAnchorElem.setAttribute("href", dataStr);
      if (tab === "1") {
        dlAnchorElem.setAttribute("download", "hashlipsMintData_logs.json")
      } else {
        dlAnchorElem.setAttribute("download", "tmt_token_logs.json")
      }
      dlAnchorElem.click();
    }


    const [previousTokenId, setPreviousTokenId] = useState('');
    const [name, setName] = useState('');
    const [creator, setCreator] = useState('');
    const [description, setDescription] = useState('');
    const [maxSupply, setMaxSupply] = useState(0);
    const [symbol, setSymbol] = useState('');
    const [fallbackFee, setFallbackFee] = useState('');
    const [numOfRoyaltyFees, setNumOfRoyaltyFees] = useState('');
    const [numOfAttributes, setNumOfAttributes] = useState('');
    const [treasuryAccountId, setTreasuryAccountId] = useState('');
    const [renewAccountId, setRenewAccountId] = useState('');
    const [addAdminKey, setAddAdminKey] = useState(false);
    const [addFreezeKey, setAddFreezeKey] = useState(false);
    const [loading, setLoading] = useState(false);
        
    // New state for progress tracking
    const [totalFiles, setTotalFiles] = useState(0);
    const [filesUploaded, setFilesUploaded] = useState(0);
    const [currentFileProgress, setCurrentFileProgress] = useState({});


    const handleAdminKeyChange = (event) => {
      setAddAdminKey(event.target.checked);
    };
    const handleFreezeKeyChange = (event) => {
      setAddFreezeKey(event.target.checked);
    };

    const createTopicAndUploadChunks = async (chunkedData) => {
      setIsLoading(true);
      if (!walletInfo.accountId) {
          alert('Must Enter Wallet Info first');
          setIsLoading(false);
          return;
      }

      try {

          const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
          client.setOperator(walletInfo.accountId, walletInfo.privateKey);

          // Creating new topic
          let transaction = new TopicCreateTransaction();
          const newSubmitKey = PrivateKey.generate();
          transaction.setSubmitKey(newSubmitKey);
          const topicMemo = chunkedData.fileHash+':zstd:base64'; // Generate hash from chunked data
          transaction.setTopicMemo(topicMemo);
          console.log(topicMemo)

          const response = await transaction.execute(client);
          const receipt = await response.getReceipt(client);
          const newTopicId = receipt.topicId.toString();
                 
          if (newTopicId) {
              // Uploading chunks to the newly created topic in batches of 20
              const chunkSize = 50; // Number of chunks per batch
              const chunkedDataChunks = chunkedData.chunks; // Assuming chunkedData.chunks is an array of your data chunks
              
              // Update current file's progress
              setCurrentFileProgress(prevProgress => ({ ...prevProgress, [filesUploaded]: { loaded: 0, total: chunkedDataChunks.length } }));
          
              for (let i = 0; i < chunkedDataChunks.length; i += chunkSize) {
                  const batch = chunkedDataChunks.slice(i, i + chunkSize);

                  // Process each chunk in the current batch
                  for (const chunk of batch) {
                      let messageTransaction = new TopicMessageSubmitTransaction()
                          .setTopicId(newTopicId)
                          .setMessage(Buffer.from(JSON.stringify(chunk), 'utf-8'));

                      messageTransaction.freezeWith(client);
                      messageTransaction.sign(newSubmitKey);
                      messageTransaction.execute(client);
                  }
                  // Update current file's progress
                  setCurrentFileProgress(prevProgress => ({ ...prevProgress, [filesUploaded]: { loaded: i + chunkSize, total: chunkedDataChunks.length } }));
          
                  // Optional: Wait a bit between batches to not overwhelm the network/client
                  // Remove the delay if not needed or adjust as per rate limits
                  await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
              }

              setSnackbarMessage('Data inscribed and deploy successful!');
              
          }
          
          setIsLoading(false);
          return newTopicId
      } catch (error) {
          console.error('Error creating topic or uploading chunks:', error);
          setSnackbarMessage('Error during the process');
          setIsLoading(false);
      }
    };


    const downloadTopicIds = () => {
      const fileName = "topicIds.json"; // Name of the file to be downloaded
      const json = JSON.stringify(topicIds, null, 2); // Convert topicIds array to JSON string, formatted for readability
      const blob = new Blob([json], {type: "application/json"}); // Create a new Blob object using the JSON data
      const href = URL.createObjectURL(blob); // Create a URL for the blob object
  
      // Create a temporary anchor element and trigger the download
      const link = document.createElement("a");
      link.href = href;
      link.download = fileName;
      document.body.appendChild(link); // Temporarily add the link to the document
      link.click(); // Trigger the download
  
      document.body.removeChild(link); // Remove the link from the document
      URL.revokeObjectURL(href); // Clean up the blob URL
  };
  

    const royaltyFields = []
    for (let index = 0; index < numOfRoyaltyFees; index++) {
      royaltyFields.push(
      <>
        <TextField          
            style={{width:'100%'}}
            type="number"
            placeholder={"Royalty % "+index}
            label={"Royalty % "+index}
            value={hashlipsToken['royalty'+index] }
            disabled={alreadyMintedToken}
            onInput={ e=>setHashlipsToken({...hashlipsToken, ['royalty'+index]: e.target.value})}
        /> 
        <br />
        <br />
        <TextField          
            style={{width:'100%'}}
            type="text"
            placeholder={"Royalty Account ID"+index}
            label={"Royalty Account ID"+index}
            value={hashlipsToken['royaltyAccountId'+index]}
            disabled={alreadyMintedToken}
            onInput={ e=>setHashlipsToken({...hashlipsToken, ['royaltyAccountId'+index]: e.target.value})}
        /> 
        <br />
        <br />
      </>)
    }

    const attributeFields = []
    for (let index = 0; index < numOfAttributes; index++) {
      attributeFields.push(
      <>
        <TextField          
            style={{width:'100%'}}
            type="text"
            placeholder={"trait_type "+index}
            label={"trait_type "+index}
            value={token['trait_type'+index] }
            disabled={alreadyMintedToken}
            onInput={ e=>setToken({...token, ['trait_type'+index]: e.target.value})}
        /> 
        <br />
        <br />
        <TextField          
            style={{width:'100%'}}
            type="text"
            placeholder={"value "+index}
            label={"value "+index}
            value={token['value'+index]}
            onInput={ e=>setToken({...token, ['value'+index]: e.target.value})}
        />
        <br />
        <br />
      </>)
    }
    
    const singleMintRoyaltyFields = []
    for (let index = 0; index < numOfRoyaltyFees; index++) {
      singleMintRoyaltyFields.push(
      <>
        <TextField          
            style={{width:'100%'}}
            type="number"
            placeholder={"Royalty % "+index}
            label={"Royalty % "+index}
            value={token['royalty'+index] }
            disabled={alreadyMintedToken}
            onInput={ e=>setToken({...token, ['royalty'+index]: e.target.value})}
        /> 
        <br />
        <br />
        <TextField          
            style={{width:'100%'}}
            type="text"
            placeholder={"Royalty Account ID"+index}
            label={"Royalty Account ID"+index}
            value={token['royaltyAccountId'+index]}
            disabled={alreadyMintedToken}
            onInput={ e=>setToken({...token, ['royaltyAccountId'+index]: e.target.value})}
        /> 
        <br />
        <br />
      </>)
  }
    return (
    <div>
        <Box sx={{ width: '100%', maxWidth:'1000px', margin: '0 auto', padding: '50px 15px'}}>
            <Stepper activeStep={activeStep} sx={{ mb: 5 }}>
                {steps.map((label, index) => (
                    <Step key={label}>
                        <StepLabel>{label}</StepLabel>
                    </Step>
                ))}
            </Stepper>
            <div>
            {activeStep === 0 && (
                  <Box sx={{ p: 3 }}>
                      <Typography variant="h5" gutterBottom component="div" sx={{ mb: 4 }}>
                          Inscribe your Hashlips Images and Metadata
                      </Typography>

                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 4 }}>
                          <Button 
                              variant="outlined" 
                              component="label" 
                              disabled={alreadyCreatedCIDs}
                              sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                          >
                              Select Images Directory
                              <input
                                  type="file"
                                  hidden
                                  multiple
                                  onChange={handleFileSelect}  // Add this line
                                  webkitdirectory="true"
                                  id="hl-images"
                                  disabled={alreadyCreatedCIDs}
                              />
                          </Button>

                          <Button 
                              variant="outlined" 
                              component="label" 
                              disabled={alreadyCreatedCIDs}
                              sx={{ textTransform: 'none', justifyContent: 'flex-start' }}
                          >
                              Select Metadata File
                              <input
                                  type="file"
                                  hidden
                                  id="hl-json"
                                  disabled={alreadyCreatedCIDs}
                              />
                          </Button>
                      </Box>

                      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                          {`Files Inscribed: ${filesUploaded}/${totalFiles}`}
                      </Typography>
                      <LinearProgress variant="determinate" value={(filesUploaded / totalFiles) * 100} sx={{ mb: 3 }} />

                      {Object.entries(currentFileProgress).map(([index, progress]) => (
                          <Box key={index} sx={{ mb: 1 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                  {`File ${parseInt(filesUploaded)} Inscription Progress: ${Math.floor((progress.loaded / progress.total) * 100)}%`}
                              </Typography>
                              <LinearProgress variant="determinate" value={(progress.loaded / progress.total) * 100} />
                          </Box>
                      ))}

                      {activeStep === 0 && (
                          <Box sx={{ mt: 4 }}>
                              <Button
                                  variant="contained"
                                  // disabled={topicIds.length !== processedFiles.length} // Enable button only after all topics are created
                                  onClick={handleUpdateMetadata}
                                  sx={{ mb: 2 }}
                              >
                                  Update Metadata
                              </Button>
                              {updatedMetadata.map((meta, index) => (
                                  <Box key={index} sx={{ my: 2 }}>
                                      <Typography variant="body2">{`File ${index + 1} updated image: ${meta.image}`}</Typography>
                                  </Box>
                              ))}
                          </Box>
                      )}
                      <Box sx={{ mt: 4 }}>
                          <Typography variant="h6" gutterBottom component="div">
                              Inscribed Metadata
                          </Typography>
                          <List>
                              {metadataTopicIds.map((item, index) => (
                                  <ListItem key={index} sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: '5px', boxShadow: 1 }}>
                                      <ListItemText primary={`Topic ID: ${item.newTopicId}`} secondary={`File Index: ${item.index}`} />
                                      <Button
                                          variant="outlined"
                                          endIcon={<OpenInNewIcon />}
                                          onClick={() => window.open(`https://tier.bot/api/inscription-cdn/${item.newTopicId}?network=testnet`, '_blank')}
                                          sx={{ textTransform: 'none' }}
                                      >
                                          View on CDN
                                      </Button>
                                  </ListItem>
                              ))}
                          </List>
                      </Box>
                       <Box sx={{ mt: 4 }}>
                          <Typography variant="h6" gutterBottom component="div">
                              Inscribed Data
                          </Typography>
                          <List>
                              {topicIds.map((item, index) => (
                                  <ListItem key={index} sx={{ mb: 2, bgcolor: 'background.paper', borderRadius: '5px', boxShadow: 1 }}>
                                      <ListItemText primary={`Topic ID: ${item.newTopicId}`} secondary={`File Index: ${item.index}`} />
                                      <Button
                                          variant="outlined"
                                          endIcon={<OpenInNewIcon />}
                                          onClick={() => window.open(`https://tier.bot/api/inscription-cdn/${item.newTopicId}?network=mainnet`, '_blank')}
                                          sx={{ textTransform: 'none' }}
                                      >
                                          View on CDN
                                      </Button>
                                  </ListItem>
                              ))}
                          </List>
                      </Box>
                       
                      
                      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
                          <Button
                              variant="contained"
                              disabled={loading || (filesUploaded / totalFiles === 1)}
                              onClick={() => {
                                  initMintingHashlips();
                              }}
                              sx={{ width: '50%', textTransform: 'none' }}
                          >
                              {loading ? <CircularProgress sx={{color:"orange"}} size={24} /> : "Inscribe Collection"}
                          </Button>
                      </Box>
                      <Button variant="contained" onClick={downloadTopicIds} sx={{ mt: 2 }}>
                          Download Topic IDs
                      </Button>
                  </Box>
              )}

                {activeStep === 1 && (
                    // Step 2: Minting Token
                    <div>
                        <Typography variant="h6" gutterBottom>
                            Mint Your Token
                        </Typography>
                        <Grid container rowSpacing={1} columnSpacing={{ xs: 1, sm: 1, md: 3 }}>
                          <Grid item style={{margin: '40px auto'}} md={8}>
                            <Grid item xs={12}>
                              <br/>
                              <br/>
                              <div>{totalCost}</div>
                              <br/>
                              <br/>
                              <TextField          
                                  style={{width:'100%'}}
                                  placeholder={"Previous Token Id"}
                                  label={"Previous Token Id"}
                                  value={previousTokenId}
                                  disabled={!alreadyMintedToken}
                                  onInput={ e=>setPreviousTokenId(e.target.value)}
                              /> 

                              <Checkbox
                                checked={alreadyMintedToken}
                                onChange={handleAMTChange}
                                inputProps={{ 'aria-label': 'controlled' }}
                              /> I am minting more on a tokenID already created
                              <br />
                              <br />
                              <TextField          
                                  style={{width:'100%'}}
                                  placeholder={"Token Name"}
                                  label={"Token Name"}
                                  value={name}
                                  disabled={alreadyMintedToken}
                                  onInput={ e=>setName(e.target.value)}
                              /> 
                              <br />
                              <br />
                              <TextField          
                                  style={{width:'100%'}}
                                  placeholder={"Token Symbol"}
                                  label={"Token Symbol"}
                                  value={symbol}
                                  disabled={alreadyMintedToken}
                                  onInput={ e=>setSymbol(e.target.value)}
                              /> 
                              <br />
                              <br />
                              <TextField          
                                  style={{width:'100%'}}
                                  placeholder={"Max Supply"}
                                  label={"Max Supply"}
                                  type="number"
                                  value={maxSupply}
                                  disabled={alreadyMintedToken}
                                  onInput={ e=>setMaxSupply(e.target.value)}
                              /> 
                              <br />
                              <br />
                              <TextField          
                                  style={{width:'100%'}}
                                  type="number"
                                  placeholder={"Number of Royalty Accounts"}
                                  label={"Number of Royalty Accounts"}
                                  value={numOfRoyaltyFees}
                                  disabled={alreadyMintedToken}
                                  onInput={ e=>setNumOfRoyaltyFees(e.target.value)}
                              /> 
                              <br />
                              <br />
                              {royaltyFields}
                              <TextField          
                                  style={{width:'100%'}}
                                  placeholder={"Treasury Account ID"}
                                  label={"Treasury Account ID"}
                                  value={treasuryAccountId}
                                  disabled={alreadyMintedToken}
                                  onInput={ e=>setTreasuryAccountId(e.target.value)}
                              /> 
                              <br />
                              <br />
                              <TextField          
                                  style={{width:'100%'}}
                                  placeholder={"Auto Renew"}
                                  label={"Auto Renew Account ID"}
                                  value={renewAccountId}
                                  disabled={alreadyMintedToken}
                                  onInput={ e=>setRenewAccountId(e.target.value)}
                              /> 
                              <br />
                              <br />
                              <TextField          
                                  style={{width:'100%'}}
                                  placeholder={"Fallback Fee"}
                                  label={"Fallback Fee"}
                                  value={fallbackFee}
                                  disabled={alreadyMintedToken}
                                  onInput={ e=>setFallbackFee(e.target.value)}
                              /> 
                              <br />
                              <br />
                              <Checkbox
                                checked={addAdminKey}
                                onChange={handleAdminKeyChange}
                                disabled={alreadyMintedToken}
                                inputProps={{ 'aria-label': 'controlled' }}
                              /> Add a ADMIN key 
                              <br />
                              <Checkbox
                                checked={addFreezeKey}
                                onChange={handleFreezeKeyChange}
                                disabled={alreadyMintedToken}
                                inputProps={{ 'aria-label': 'controlled' }}
                              /> Add a FREEZE key
                              <br />
                              <br />
                              <br />
                              <Button
                                  style={{width:'50%'}}
                                  variant="contained"
                                  component="label"
                                  onClick={() => {
                                    initMintingHashlips(hashlipsToken, user, hederaMainnetEnv)
                                  }}
                              >
                                  Mint Inscriptions
                              </Button>
                            </Grid>
                          </Grid>
                        </Grid>
                    </div>
                )}
                {activeStep === 2 && (
                    // Step 3: View Created Tokens
                    <div>
                        <Typography variant="h6" gutterBottom>
                            View Created Tokens
                        </Typography>
                        <pre>{JSON.stringify(topicIds, null, 2)}</pre>
                    </div>
                )}
                <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2 }}>
                    <Button
                        color="inherit"
                        disabled={activeStep === 0}
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                    >
                        Back
                    </Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button onClick={handleNext}
                      disabled={(filesUploaded / totalFiles !== 1)}
                    >
                        {activeStep === steps.length - 1 ? 'Finish' : 'Next'}
                    </Button>
                </Box>
            </div>
        </Box>
        <Snackbar
            open={!!snackbarMessage}
            autoHideDuration={6000}
            onClose={() => setSnackbarMessage('')}
            message={snackbarMessage}
        />
    </div>
);

}