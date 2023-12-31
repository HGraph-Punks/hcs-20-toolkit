import React, { useState, useContext, Fragment } from 'react';
import Head from 'next/head';
import { Button,List, ListItem, ListItemText, Accordion, AccordionSummary, AccordionDetails, Typography, TextField, Container, Paper, TableContainer, Table, TableBody,TableRow,TableHead,TableCell } from '@mui/material';
import axios from 'axios';
import { WalletContext } from '../components/WalletContext';  // Import WalletContext
import Link from 'next/link';

export default function Ledger() {
  const { walletInfo } = useContext(WalletContext);  // Use WalletContext
  const [topicId, setTopicId] = useState(walletInfo.topicId);
  const [balances, setBalances] = useState(null);

  const displayBalances = async () => {
    if (!topicId) {
      alert('Please enter a topic ID.');
      return;
    }
    const fetchedBalances = await getHcs20DataFromTopic(topicId);
    setBalances(fetchedBalances);
  };

  async function getHcs20DataFromTopic(topicId, allMessages = [], invalidMessages = []) {
    const baseUrl = walletInfo.network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    const url = `${baseUrl}/api/v1/topics/${topicId}/messages`;

    try {
      const response = await axios.get(url);
      const { messages, links } = response.data;
    
      messages.forEach(msg => {
        try {
          const parsedMessage = JSON.parse(atob(msg.message));
          allMessages.push(parsedMessage);
        } catch (error) {
          console.error('Error parsing message:', error);
          invalidMessages.push(msg.consensusTimestamp); // Tracking invalid message
        }
      });

      if (links && links.next) {
        return await getHcs20DataFromTopic(topicId, allMessages);
      }

      return { balances: calculateBalances(allMessages), invalidMessages };

    } catch (error) {
      console.error('Error fetching topic data:', error);
    }
  }

  function calculateBalances(messages) {
    const balances = {};
    const transactionsByAccount = {};
  
    messages.forEach(({ op, tick, amt, from, to }) => {
      if (!balances[tick]) {
        balances[tick] = {};
      }
      if (!transactionsByAccount[tick]) {
        transactionsByAccount[tick] = {};
      }
  
      switch (op) {
        case 'mint':
          balances[tick][to] = (balances[tick][to] || 0) + parseInt(amt);
          break;
        case 'burn':
          balances[tick][from] -= parseInt(amt);
          break;
        case 'transfer':
          balances[tick][from] -= parseInt(amt);
          balances[tick][to] = (balances[tick][to] || 0) + parseInt(amt);
          break;
      }
  
      // Record the transaction
      if (!transactionsByAccount[tick][from]) {
        transactionsByAccount[tick][from] = [];
      }
      if (!transactionsByAccount[tick][to]) {
        transactionsByAccount[tick][to] = [];
      }
      transactionsByAccount[tick][from].push({ op, amt, to, from });
      transactionsByAccount[tick][to].push({ op, amt, to, from });
    });
    console.log(balances)
    return { balances, transactionsByAccount };
  }
  


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
        <Button variant="contained" color="primary" onClick={displayBalances}>
          Get Balances
        </Button>
        {balances && (
        <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Account ID</TableCell>
              <TableCell align="right">Balance</TableCell>
              <TableCell align="right">Transactions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
        {Object.entries(balances.balances.balances).map(([token, accounts]) => (
          <Fragment key={token}>
            {Object.entries(accounts).map(([accountId, balance]) => (
              <TableRow key={accountId}>
                <TableCell>{accountId}</TableCell>
                <TableCell align="right">{balance}</TableCell>
                <TableCell align="right">
                  <Accordion>
                    <AccordionSummary>
                      <Typography>View Transactions</Typography>
                    </AccordionSummary>
                    <AccordionDetails style={{backgroundColor:"#010101"}}>
                    {balances.balances.transactionsByAccount && balances.balances.transactionsByAccount[token] && balances.balances.transactionsByAccount[token][accountId] ? (
                      balances.balances.transactionsByAccount[token][accountId].map((tx, index) => (
                        <div key={index} style={{ marginBottom: '10px', textAlign: 'left' }}>
                          <div style={{
                            maxWidth: '100%',
                          }}>
                            <Typography variant="body1" color="textPrimary">
                              {tx.op} {tx.amt && tx.amt + ' ' +token || 'N/A'} {tx.from && 'from '+tx.from } {tx.to && ' to '+tx.to || 'N/A'}
                            </Typography>
                          </div>
                        </div>
                      ))
                    ) : (
                      <Typography>No transactions</Typography>
                    )}
                    </AccordionDetails>
                  </Accordion>
                </TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
        </Table>
      </TableContainer>
      )}
        {balances && (
          <Typography variant="body1" gutterBottom>
            <pre>{JSON.stringify(balances, null, 2)}</pre>
          </Typography>
        )}
      </Container>
    </React.Fragment>
  );
}
