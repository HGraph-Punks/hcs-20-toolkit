import React, { useState, useContext, useEffect, Fragment } from 'react';
import {
  Button, Accordion,CircularProgress, Typography, TextField, Container, Paper, TableContainer, Table,
  TableBody, TableRow, TableHead, TableCell, FormControlLabel, Switch
} from '@mui/material';
import axios from 'axios';
import { WalletContext } from '../components/WalletContext';
import Link from 'next/link';
import { promisify } from 'util';

let ipcRenderer = null;
if (typeof window !== 'undefined' && window.process && window.process.type === 'renderer') {
  ipcRenderer = window.require('electron').ipcRenderer;
}

export default function Ledger() {
  const [isLoading, setIsLoading] = useState(false);
  const { walletInfo } = useContext(WalletContext);
  const [topicId, setTopicId] = walletInfo.topicId === '0.0.4350190' ? useState('0.0.4354800') : useState(walletInfo.topicId);
  const [balances, setBalances] = useState(null);
  const [hasSubmitKey, setHasSubmitKey] = useState(false);
  const [filter, setFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = Object.entries(balances?.balances || {}).slice(indexOfFirstRow, indexOfLastRow);

  const totalPages = Math.ceil(Object.keys(balances?.balances || {}).length / rowsPerPage);

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };


  const displayBalances = async () => {
    setIsLoading(true);
    try {
      const fetchedData = await getHcs20DataFromTopic(topicId);
      setBalances(fetchedData); // Populate balances with fetched data
      setIsLoading(false);
      // updateDatabase(fetchedData); // Update the database in the background
    } catch (error) {
      console.error('Error while fetching and processing data:', error);
    } finally {

    }
  };

  // const updateDatabase = async (fetchedData) => {
  //   try {
  //     const { transactions, tokenDetails, failedTransactions } = fetchedData;
      
  //     // Perform database operations
  //     for (const detail of tokenDetails) {
  //       await updateAsync({ _id: `tokenDetail_${detail.tick}` }, detail, { upsert: true });
  //     }
      
  //     for (const transaction of transactions) {
  //       await insertAsync(transaction);
  //     }
      
  //     for (const failedTransaction of failedTransactions) {
  //       await insertAsync(failedTransaction);
  //     }

  //     console.log('Database updated successfully.');
  //   } catch (error) {
  //     console.error('Error updating the database:', error);
  //   }
  // };

  // const handleGraphQLToggle = () => {
  //   setUseGraphQL(!useGraphQL);
  // };
  
  async function getHcs20DataFromTopic(
    topicId: string, 
    allMessages: any[] = [], 
    invalidMessages: string[] = [], 
    nextLink?: string
  ) {


    const baseUrl = walletInfo.network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    const url = nextLink ?  `${baseUrl}${nextLink}` : `${baseUrl}/api/v1/topics/${topicId}/messages?limit=1000`;

    try {
      const response = await axios.get(url);
      const { messages, links } = response.data;
    
      messages.forEach(msg => {
        try {
          const parsedMessage = JSON.parse(atob(msg.message));
          parsedMessage.payer_account_id = msg.payer_account_id
          allMessages.push(parsedMessage);
        } catch (error) {
          console.error('Error parsing message:', error);
          invalidMessages.push(msg.consensusTimestamp); // Tracking invalid message
        }
      });

      if (links && links.next) {
        return await getHcs20DataFromTopic(topicId, allMessages, invalidMessages, links.next);
      }

      return { balances: await calculateBalances(allMessages), invalidMessages };

    } catch (error) {
      console.error('Error fetching topic data:', error);
    }
  }
  
  const getTopicIdData = async (topic_id, hgraphApiKey) => {
    if (ipcRenderer) {
      // Execute outside electron instance for cors
      // fetch-topic-data resides in main/background.ts
      return ipcRenderer.invoke('fetch-topic-data', topic_id, hgraphApiKey);
    } else {
      // Handle the case where ipcRenderer is not available
      console.error('ipcRenderer is not available');
    }
  };

  async function calculateBalances(messages) {
    const balances = {};
    const transactionsByAccount = {};
    const failedTransactions = [];
    const tokenConstraints = {}; // Store max and lim constraints for each token
    const tokenDetails = {};

    const requiresMatchingPayer = !hasSubmitKey;

    for (const message of messages) {
        const { op, tick, amt, from, to, payer_account_id, max, lim, metadata, m } = message;

        // Initialize token constraints and balances
        if (!balances[tick]) {
            balances[tick] = {};
            tokenConstraints[tick] = { max: Infinity, lim: Infinity, totalMinted: 0 };
            transactionsByAccount[tick] = {}; // Initialize transactions for this tick
        }

        // Ensure that transactionsByAccount entries exist for 'from' and 'to' accounts
        if (!transactionsByAccount[tick][from]) {
          transactionsByAccount[tick][from] = []; // Initialize transactions for 'from' account
        }
        if (to && !transactionsByAccount[tick][to]) {
            transactionsByAccount[tick][to] = []; // Initialize transactions for 'to' account
        }

        const amount = parseInt(amt);
        let failureReason = '';

      switch (op) {
        case 'deploy':
          // Set max and lim constraints for the token
          tokenConstraints[tick].max = max ? parseInt(max) : Infinity;
          tokenConstraints[tick].lim = lim ? parseInt(lim) : Infinity;

          tokenDetails[tick] = {
            maxSupply: parseInt(max) || 'Not Set',
            currentSupply: 0, // Initialize current supply
            lim: parseInt(lim) || 'Not Set',
            metadata: metadata || 'No Metadata',
            memo: m || '',
          };
          break;
        case 'mint':

          if (tokenDetails[tick]) {
            tokenDetails[tick].currentSupply += parseInt(amt);
          } else  {
            failureReason = 'No Deploy transaction for this Mint tick';
            failedTransactions.push({ op, tick, amt, to, payer_account_id, failureReason });
          }

          if (amount > tokenConstraints[tick].lim) {
            failureReason = 'Mint amount exceeds limit per transaction.';
            failedTransactions.push({ op, tick, amt, to, payer_account_id, failureReason });
            return;
          }
          if (tokenConstraints[tick].totalMinted + amount > tokenConstraints[tick].max) {
            failureReason = 'Mint amount exceeds maximum supply.';
            failedTransactions.push({ op, tick, amt, to, payer_account_id, failureReason });
            return;
          }
          tokenConstraints[tick].totalMinted += amount;
          balances[tick][to] = (balances[tick][to] || 0) + amount;
          break;
        case 'burn':
          if (balances[tick][from] >= amount && (!requiresMatchingPayer || payer_account_id === from)) {
            balances[tick][from] -= amount;
          } else {
            failureReason = balances[tick][from] < amount 
              ? 'Insufficient balance for burn operation.'
              : 'Payer account ID does not match the account from which points are being burned.';
            failedTransactions.push({ op, tick, amt, from, to, payer_account_id, failureReason });
            return;
          }
          break;
        case 'transfer':
          if (balances[tick][from] >= amount && (!requiresMatchingPayer || payer_account_id === from)) {
            balances[tick][from] -= amount;
            balances[tick][to] = (balances[tick][to] || 0) + amount;
          } else {
            failureReason = balances[tick][from] < amount 
              ? 'Insufficient balance for transfer operation.'
              : 'Payer account ID does not match the sender\'s account.';
            failedTransactions.push({ op, tick, amt, from, to, payer_account_id, failureReason });
            return;
          }
          break;
      }

      // Ensure transactions are recorded for each involved account
      if (op === 'mint' || op === 'burn' || op === 'transfer') {
          if (op !== 'mint') { // 'mint' doesn't have a 'from' field
              transactionsByAccount[tick][from].push({
                  op, amt: amount, from, to, timestamp: message.consensus_timestamp,
              });
          }
          if (to) { // For 'mint' and 'transfer'
              transactionsByAccount[tick][to].push({
                  op, amt: amount, from, to, timestamp: message.consensus_timestamp,
              });
          }
      }

    }
    
    return { balances, transactionsByAccount, failedTransactions, tokenDetails };
  }

  const renderBalances = () => (
    <Fragment>
      <TextField
        label="Filter by Account ID"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        fullWidth
        margin="normal"
      />
      {/* Pagination Controls */}
      {/* <div style={{ display: 'flex', justifyContent: 'space-between', margin: '20px' }}>
        <Button onClick={handlePreviousPage} disabled={currentPage === 1}>
          Previous
        </Button>
        <Typography>Page {currentPage} of {totalPages}</Typography>
        <Button onClick={handleNextPage} disabled={currentPage === totalPages}>
          Next
        </Button>
      </div> */}

      <Typography variant="h4" gutterBottom style={{ marginTop: '20px' }}>
        Point Details
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tick</TableCell>
              <TableCell>Max Supply</TableCell>
              <TableCell>Current Supply</TableCell>
              <TableCell>Limit per Mint Transaction</TableCell>
              <TableCell>Metadata</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {balances && balances.balances && Object.entries(balances.balances.tokenDetails).map(([token, details]:[any, any]) => (
              <TableRow key={token}>
                <TableCell>{token}</TableCell>
                <TableCell>{details && details.maxSupply}</TableCell>
                <TableCell>{details && details.currentSupply}</TableCell>
                <TableCell>{details && details.lim}</TableCell>
                <TableCell>{details && details.metadata}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Fragment>
  );

  return (
    <React.Fragment>
      <Container>
        <br /> 
        <Link href="/home">
          <Button variant="text">Go to Creator</Button>
        </Link>
        <br />
        <br />
        <Typography variant="h4" gutterBottom>
          HCS-20 Balances Viewer
        </Typography>
        <TextField
          label="Enter Topic ID"
          value={topicId}
          onChange={(e) => setTopicId(e.target.value)}
          fullWidth
          margin="normal"
        />
        <br />
        <br />
        <FormControlLabel
          sx={{ display: 'block' }}
          control={
            <Switch
              checked={hasSubmitKey}
              onChange={() => setHasSubmitKey(!hasSubmitKey)}
              name="loading"
              color="primary"
            />
          }
          label="Submit Key"
        />
        <br />
        <br />
        {isLoading ? (
          <>
            <Button variant="contained" color="primary" disabled>
              <CircularProgress size={24} />
            </Button>
            <br />
            <br />
            Indexing...
          </>
        ) : (
          <Button variant="contained" color="primary" onClick={displayBalances}>
            Get Balances
          </Button>
        )}
        <br />
        <br />
        {isLoading ? (
          <></>
        ) : (
          <Fragment>
            {renderBalances()}
          </Fragment>
        )}
        <br />
        <br />
        <Typography variant="h4" gutterBottom style={{ marginTop: '20px' }}>
            Balances
          </Typography>
          {balances && (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Account ID</TableCell>
                    <TableCell>Tick</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {balances.balances && Object.entries(balances.balances.balances).map(([token, accounts]) => (
                    <Fragment key={token}>
                      {Object.entries(accounts)
                        .filter(([accountId]) => !filter || accountId.includes(filter)) // Apply filter here
                        .map(([accountId, balance]) => (
                          <TableRow key={accountId}>
                            <TableCell>{accountId}</TableCell>
                            <TableCell>{token}</TableCell>
                            <TableCell align="right">{balance}</TableCell>
                            
                          </TableRow>
                        ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}


      {balances && balances.balances && balances.balances.failedTransactions && balances.balances.failedTransactions.length > 0 && (
        <Fragment>
        <br />
        <br />
          <Typography variant="h4" gutterBottom style={{ marginTop: '20px' }}>
            Failed Transactions
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Operation</TableCell>
                  <TableCell>Tick</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>From</TableCell>
                  <TableCell>To</TableCell>
                  <TableCell>Payer Account ID</TableCell>
                  <TableCell>Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {balances.balances.failedTransactions.map((tx, index) => (
                  <TableRow key={index}>
                    <TableCell>{tx.op}</TableCell>
                    <TableCell>{tx.tick}</TableCell>
                    <TableCell>{tx.amt}</TableCell>
                    <TableCell>{tx.from}</TableCell>
                    <TableCell>{tx.to}</TableCell>
                    <TableCell>{tx.payer_account_id}</TableCell>
                    <TableCell>{tx.failureReason}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Fragment>
      )}
      <br/>
      <br/>
      <br/>
      
        {/* {balances && (
          <Typography variant="body1" gutterBottom>
            <pre>{JSON.stringify(balances, null, 2)}</pre>
          </Typography>
        )} */}
      </Container>
    </React.Fragment>
  );
}

