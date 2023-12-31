import React, { useState, useContext } from 'react';
import { TextField, Button, Typography, Container, CircularProgress, Snackbar } from '@mui/material';
import { WalletContext } from '../components/WalletContext';
import { Client, TopicMessageSubmitTransaction, PrivateKey } from '@hashgraph/sdk';
import Link from 'next/link';


export default function HomePage() {
  const [action, setAction] = useState('deploy');
  const [formData, setFormData] = useState({});
  const [transactionJson, setTransactionJson] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fields = {
    deploy: ['tokenName', 'tick', 'mintLimit', 'maxSupply', 'metadata'],
    mint: ['tick', 'amount', 'toAddress'],
    burn: ['tick', 'amount', 'fromAddress'],
    transfer: ['tick', 'amount', 'fromAddress', 'toAddress'],
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleActionChange = (e) => {
    setFormData({});
    setAction(e.target.value);
  };

  const generateJson = () => {
    const jsonResult = createTransactionJson(formData);
    setTransactionJson(JSON.stringify(jsonResult, null, 2));
  };

  const createTransactionJson = (transactionParams) => {
    const {  tick, amount, fromAddress, toAddress, tokenName, mintLimit, maxSupply, metadata } = transactionParams;
    if (!tick) return "tick required"
    switch (action) {
      case 'deploy':
        return { p:"hcs-20", op:action, name:tokenName, tick:tick.toLowerCase(), lim:mintLimit, max:maxSupply, metadata };
      case 'mint':
        return { p:"hcs-20", op:action, tick:tick.toLowerCase(), amt:amount, to:toAddress };
      case 'burn':
        return { p:"hcs-20", op:action, tick:tick.toLowerCase(), amt:amount, from:fromAddress };
      case 'transfer':
        return { p:"hcs-20", op:action, tick:tick.toLowerCase(), amt:amount, from:fromAddress, to:toAddress };
      default:
        throw new Error('Invalid action type');
    }
  };

  const { walletInfo } = useContext(WalletContext);

  const submitToHedera = async () => {
    setIsLoading(true);

    if (!walletInfo.topicId || !transactionJson) {
      setSnackbarMessage('Topic ID or transaction JSON is missing');
      setIsLoading(false);
      return;
    }

    const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
    client.setOperator(walletInfo.accountId, walletInfo.privateKey);

    try {
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(walletInfo.topicId)
        .setMessage(transactionJson);

      if (walletInfo.submitKey) {
        const submitKey = PrivateKey.fromString(walletInfo.submitKey);
        transaction.freezeWith(client).sign(submitKey);
      }

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      setSnackbarMessage(`Message submitted successfully to topic ${walletInfo.topicId}, sequence number: ${receipt.topicSequenceNumber}`);
    } catch (error) {
      console.error('Error submitting to HCS:', error);
      setSnackbarMessage('Error submitting to HCS');
    }
    setIsLoading(false);
  };



  return (
    <Container>
      <br />
      <Link href="/ledger">
        <Button variant="text">Go to Ledger</Button>
      </Link>
      <TextField
        select
        label="Action"
        value={action}
        onChange={handleActionChange}
        SelectProps={{ native: true }}
        fullWidth
        margin="normal"
      >
        {Object.keys(fields).map((key) => (
          <option key={key} value={key}>{key.charAt(0).toUpperCase() + key.slice(1)}</option>
        ))}
      </TextField>

      {fields[action].map((field) => (
        <TextField
          key={field}
          label={field.charAt(0).toUpperCase() + field.slice(1)}
          name={field}
          value={formData[field] || ''}
          onChange={handleChange}
          fullWidth
          margin="normal"
        />
      ))}

      <br />
      <br />

      <Button variant="contained" color="primary" onClick={generateJson}>
        Generate JSON
      </Button>
      <br />
      <Typography variant="body1" gutterBottom>
        <pre>{transactionJson}</pre>
      </Typography>
      <br />
      <Button variant="contained" disabled={transactionJson == null} color="primary" onClick={submitToHedera}>
        Submit to HCS
      </Button>{isLoading && <CircularProgress />}
      <br />
      <br />

      
      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={6000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Container>
  );
}
