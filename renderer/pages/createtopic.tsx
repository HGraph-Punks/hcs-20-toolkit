import React, { useState, useContext } from 'react';
import { Button, Container, Typography, CircularProgress, Checkbox, FormControlLabel, TextField, Snackbar, Link } from '@mui/material';
import { WalletContext } from '../components/WalletContext';
import { Client, TopicCreateTransaction, PrivateKey, TopicMessageSubmitTransaction } from '@hashgraph/sdk';
import { z } from 'zod';

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
  const [createSubmitKey, setCreateSubmitKey] = useState(false);
  const [registerTopic, setRegisterTopic] = useState(false);
  const [createdTopicId, setCreatedTopicId] = useState('');
  const [submitKey, setSubmitKey] = useState('');
  const [registerTopicName, setRegisterTopicName] = useState('');
  const [registerMetadata, setRegisterMetadata] = useState('');
  const [registerMemo, setRegisterMemo] = useState('');
  const [privateTopic, setPrivateTopic] = useState(false);
  const { walletInfo } = useContext(WalletContext);
  const [snackbarMessage, setSnackbarMessage] = useState('');

// Function to validate data against the Zod schema
const validateData = (data, schema) => {
  const result = schema.safeParse(data);
  if (result.success) {
    return result.data;
  } else {
    // Handle validation errors, e.g., log them or display an error
    const errorMessages = result.error.issues.map(issue => `${issue.path.join('.')} - ${issue.message}`).join(', ');
    setSnackbarMessage(`Validation error: ${errorMessages}`);
    return null;
  }
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
      if (createSubmitKey) {
        const newSubmitKey = PrivateKey.generate();
        transaction.setSubmitKey(newSubmitKey);
        setSubmitKey(newSubmitKey.toString());
        setPrivateTopic(createSubmitKey)
      }
      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      const newTopicId = receipt.topicId.toString();
      setCreatedTopicId(newTopicId);

      if (registerTopic && registerTopicName) {
        const registerData = {
          p: "hcs-20",
          op: "register",
          name: registerTopicName,
          topicId: newTopicId,
          privateTopic: privateTopic,
          metadata: registerMetadata,
          m: registerMemo
        };
        const validatedData = validateData(registerData, registerSchema);
        if (validatedData) {
          await registerNewTopic(newTopicId);
        }
      }
     

      setIsLoading(false);
    } catch (error) {
      console.error('Error creating topic:', error);
      setSnackbarMessage('Error creating topic');
      setIsLoading(false);
    }
  };

  const registerNewTopic = async (newTopicId) => {
    const messageJson = {
      p: "hcs-20", 
      op: "register", 
      name: registerTopicName, 
      t_id: newTopicId, 
      private: createSubmitKey, 
      metadata: registerMetadata, 
      m: registerMemo
    };

    try {
      const client = walletInfo.network === 'mainnet' ? Client.forMainnet() : Client.forTestnet();
      client.setOperator(walletInfo.accountId, walletInfo.privateKey);

      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId('0.0.324646')
        .setMessage(JSON.stringify(messageJson));

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      console.log(`Message submitted successfully to topic ${newTopicId}, sequence number: ${receipt.topicSequenceNumber}`);
    } catch (error) {
      console.error('Error registering new topic:', error);
    }
  };

  return (
    <Container>
      <br />
      <Link href="/home">
        <Button variant="text">Home</Button>
      </Link>
      <br />
      <br />

      <Typography variant="h4" gutterBottom>Create new HCS Topic</Typography>
      <FormControlLabel
        control={<Checkbox checked={createSubmitKey} onChange={(e) => setCreateSubmitKey(e.target.checked)} />}
        label="Private Topic"
      />
      <br/>
      <FormControlLabel
        control={<Checkbox checked={registerTopic} onChange={(e) => setRegisterTopic(e.target.checked)} />}
        label="Register Topic After Creation"
      />
      {registerTopic && (
        <>
          <TextField label="Topic Name" inputProps={{ maxLength:100 }} value={registerTopicName} onChange={(e) => setRegisterTopicName(e.target.value)} fullWidth margin="normal" />
          <TextField label="Metadata" inputProps={{ maxLength:100 }} value={registerMetadata} onChange={(e) => setRegisterMetadata(e.target.value)} fullWidth margin="normal" />
          <TextField label="Memo" inputProps={{ maxLength:500 }} value={registerMemo} onChange={(e) => setRegisterMemo(e.target.value)} fullWidth margin="normal" />
        </>
      )}
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

      <Snackbar
        open={!!snackbarMessage}
        autoHideDuration={6000}
        onClose={() => setSnackbarMessage('')}
        message={snackbarMessage}
      />
    </Container>
  );
}
