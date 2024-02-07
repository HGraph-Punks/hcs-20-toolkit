import React, { useState, useEffect, useContext} from 'react';
import {
  CircularProgress, Container, Paper, TableContainer, Table,
  TableBody, TableRow, TableHead, TableCell, Typography, Button, Link
} from '@mui/material';
import axios from 'axios';
import { WalletContext } from '../components/WalletContext';

export default function Registry() {
  const { walletInfo } = useContext(WalletContext);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);
  
  // Function to fetch data
  const fetchData = async (topicId = walletInfo.registry, allMessages = [], nextLink = null) => {
    setIsLoading(true);
    const baseUrl = walletInfo.network === 'mainnet'
      ? 'https://mainnet-public.mirrornode.hedera.com'
      : 'https://testnet.mirrornode.hedera.com';
    const url = nextLink ? `${baseUrl}${nextLink}` : `${baseUrl}/api/v1/topics/${topicId}/messages?limit=1000`;
  
    try {
      const response = await axios.get(url);
      const { messages, links } = response.data;
      const parsedMessages = messages.map(msg => {
        try {
          return JSON.parse(atob(msg.message));
        } catch (error) {
          console.error('Error parsing message:', error);
          return null;
        }
      }).filter(msg => msg !== null);
  
      const combinedMessages = allMessages.concat(parsedMessages);
  
      if (links && links.next) {
        await fetchData(topicId, combinedMessages, links.next);
      } else {
        setData(combinedMessages);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error fetching topic data:', error);
      setIsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchData();
  }, []);

  // Refresh function
  const handleRefresh = () => {
    fetchData();
  };

  if (isLoading) {
    return (
      <Container>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container>
      <br/>
        <Link href="/home">
          <Button variant="text">Home</Button>
        </Link>
      <br/>
      <br/>
      <Typography variant="h4" gutterBottom>
        HCS-20 Registry
      </Typography>
      <br/>
      <Button 
        variant="contained" 
        color="primary" 
        onClick={handleRefresh} 
        disabled={isLoading}
      >
        Refresh
      </Button>
      <br/>
      <br/>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>p</TableCell>
              <TableCell>op</TableCell>
              <TableCell>name</TableCell>
              <TableCell>metadata</TableCell>
              <TableCell>private</TableCell>
              <TableCell>t_id</TableCell>
              <TableCell>m</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, index) => (
              <TableRow key={index}>
                <TableCell>{row.p}</TableCell>
                <TableCell>{row.op}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>{row.metadata}</TableCell>
                <TableCell>{row.private ? 'Yes' : 'No'}</TableCell>
                <TableCell>{row.t_id}</TableCell>
                <TableCell>{row.m}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Container>
  );
};
