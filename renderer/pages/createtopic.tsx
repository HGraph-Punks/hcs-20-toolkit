import React, { useState, useContext } from 'react';
import { Button, Container, Typography, CircularProgress, Checkbox, FormControlLabel } from '@mui/material';
import { WalletContext } from '../components/WalletContext';
import { Client, TopicCreateTransaction, PrivateKey } from '@hashgraph/sdk';

export default function CreateTopic() {
  const [isLoading, setIsLoading] = useState(false);
  const [createSubmitKey, setCreateSubmitKey] = useState(false);
  const [createdTopicId, setCreatedTopicId] = useState('');
  const [submitKey, setSubmitKey] = useState('');
  const { walletInfo } = useContext(WalletContext);

  const createTopic = async () => {
    setIsLoading(true);
    if(!walletInfo.accountId) {

      alert('Must Enter Wallet Info first');
      setIsLoading(false);
      return 
    }
    try {
      const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
      client.setOperator(walletInfo.accountId, walletInfo.privateKey);

      let transaction = new TopicCreateTransaction();
      if (createSubmitKey) {
        const newSubmitKey = PrivateKey.generate();
        transaction.setSubmitKey(newSubmitKey);
        setSubmitKey(newSubmitKey.toString());
      }
      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);

      setCreatedTopicId(receipt.topicId.toString());
      setIsLoading(false);
    } catch (error) {
      console.error('Error creating topic:', error);
      setIsLoading(false);
    }
  };

  return (
    <Container>
      <br />
      <Typography variant="h4" gutterBottom>Create a new HCS Topic</Typography>
      <FormControlLabel
        control={<Checkbox checked={createSubmitKey} onChange={(e) => setCreateSubmitKey(e.target.checked)} />}
        label="Create Submit Key"
      />
      <br />
      <br />
      <Button variant="contained" color="primary" onClick={createTopic} disabled={isLoading}>
        {isLoading ? <CircularProgress size={24} /> : 'Create Topic'}
      </Button>
      <br />
      <br />
      {createdTopicId && <Typography>Created Topic ID: <br/>{createdTopicId}</Typography>}
      <br/>
      {submitKey && <Typography>Submit Key: <br/> {submitKey}</Typography>}
    </Container>
  );
}
