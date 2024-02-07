import React, { useState, useContext } from 'react';
import {
  TextField, Button, Typography, Container, CircularProgress, Snackbar, FormControl, InputLabel, Select, MenuItem, FormControlLabel, Checkbox
} from '@mui/material';
import { WalletContext } from '../components/WalletContext';
import { Client, TopicMessageSubmitTransaction, PrivateKey } from '@hashgraph/sdk';
import Link from 'next/link';
import { z } from 'zod';
import { ChangeEvent } from 'react';

interface FormData {
  [key: string]: string;
}

const baseMessageSchema = z.object({
  p: z.string().toLowerCase().refine((val) => ['hcs-20'].includes(val)),
  op: z.string().toLowerCase().refine((val) => ['deploy', 'mint', 'burn', 'transfer', 'register'].includes(val)),
  memo: z.string().optional(),
  toAddress: z.string().optional(),
});

const numberFieldSchema = z.string()
  .refine(val => !isNaN(parseInt(val)) && val.length <= 18) // validate the string as a number
  .transform(val => parseInt(val) || 0); // transform the string to a number


const accountRegex = /^(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))\.(0|(?:[1-9]\d*))(?:-([a-z]{5}))?$/;
const accountFieldSchema = z.string().regex(accountRegex).transform(val => val.includes('-') ? val.split('-')[0] : val);

const registerSchema = baseMessageSchema.extend({
  name: z.string().min(1).max(100),
  topicId: accountFieldSchema,
  metadata: z.string().optional(),
  privateTopic: z.boolean() 
});

const burnSchema = baseMessageSchema.extend({
  tick: z.string().toLowerCase().trim(),
  amount: numberFieldSchema,
  fromAddress: accountFieldSchema,
});

const deploySchema = baseMessageSchema.extend({
  tick: z.string().transform((str) => str.toLowerCase().trim()),
  maxSupply: z.string()
    .optional()
    .transform((str) => (!str || isNaN(Number(str)) ? Infinity : Number(str)))
    .refine((val) => val === Infinity || val.toString().length <= 18, {
      message: "Max must be a number with less than or equal to 18 digits",
    }),
  mintLimit: z.string()
    .optional()
    .transform((str) => (!str || isNaN(Number(str)) ? Infinity : Number(str)))
    .refine((val) => val === Infinity || val.toString().length <= 18, {
      message: "Lim must be a number with less than or equal to 18 digits",
    }),
  metadata: z.string().optional(),
});


const mintSchema = baseMessageSchema.extend({
  tick: z.string().toLowerCase().trim(),
  amount: numberFieldSchema,
});

const transferSchema = baseMessageSchema.extend({
  tick: z.string().toLowerCase().trim(),
  amount: numberFieldSchema,
  fromAddress: accountFieldSchema,
});


export default function HomePage() {
  const [action, setAction] = useState('deploy');
  const [formData, setFormData] = useState({});
  const [transactionJson, setTransactionJson] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const fields = {
    register: ['name', 'metadata', 'topicId', 'memo', 'privateTopic'],
    deploy: ['name', 'tick', 'mintLimit', 'maxSupply', 'metadata', 'memo'],
    mint: ['tick', 'amount', 'toAddress', 'memo'],
    burn: ['tick', 'amount', 'fromAddress', 'memo'],
    transfer: ['tick', 'amount', 'fromAddress', 'toAddress', 'memo'],
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleActionChange = (e) => {
    setFormData({});
    setAction(e.target.value);
  };

  const generateJson = () => {
    console.log(formData)
    let schema;
    switch (action) {
      case 'register': schema = registerSchema; break;
      case 'burn': schema = burnSchema; break;
      case 'deploy': schema = deploySchema; break;
      case 'mint': schema = mintSchema; break;
      case 'transfer': schema = transferSchema; break;
      default: throw new Error('Invalid action type');
    }
  
    const validationResult = schema.safeParse({ ...formData, p: "hcs-20", op: action });
  
    if (!validationResult.success) {
      const readableErrors = validationResult.error.issues.map(issue => {
        let fieldName = issue.path.join(' ').replace('_', ' ');
        fieldName = fieldName.charAt(0).toUpperCase() + fieldName.slice(1); // Capitalize the first letter
        return `${fieldName} is required`;
      }).join(', ');
  
      setSnackbarMessage(`Please correct the following: ${readableErrors}`);
      return;
    }
  
  
    const jsonResult = createTransactionJson(validationResult.data);
    setTransactionJson(JSON.stringify(jsonResult, null, 2));
  };
  

  const createTransactionJson = (transactionParams) => {
    const {  tick, amount, fromAddress, toAddress, name, mintLimit, maxSupply, metadata, memo, privateTopic, topicId } = transactionParams;
    if (!tick && action !== 'register') return "tick required"
    switch (action) {
      case 'register':
        return { p:"hcs-20", op:action, name:name, t_id: topicId, private:privateTopic, metadata, m:memo };
      case 'deploy':
        return { p:"hcs-20", op:action, name:name, tick:tick.toLowerCase(), lim:mintLimit, max:maxSupply, metadata, m:memo };
      case 'mint':
        return { p:"hcs-20", op:action, tick:tick.toLowerCase(), amt:amount, to:toAddress, m:memo };
      case 'burn':
        return { p:"hcs-20", op:action, tick:tick.toLowerCase(), amt:amount, from:fromAddress, m:memo};
      case 'transfer':
        return { p:"hcs-20", op:action, tick:tick.toLowerCase(), amt:amount, from:fromAddress, to:toAddress, m:memo };
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
    const topicId = action != 'register' ? walletInfo.topicId : walletInfo.registry
    try {
      const transaction = new TopicMessageSubmitTransaction()
        .setTopicId(topicId)
        .setMessage(transactionJson);

      if (walletInfo.submitKey) {
        const submitKey = PrivateKey.fromString(walletInfo.submitKey);
        transaction.freezeWith(client).sign(submitKey);
      }

      const response = await transaction.execute(client);
      const receipt = await response.getReceipt(client);
      setSnackbarMessage(`Message submitted successfully to topic ${topicId}, sequence number: ${receipt.topicSequenceNumber}`);
    } catch (error) {
      console.error('Error submitting to HCS:', error);
      setSnackbarMessage('Error submitting to HCS');
    }
    setIsLoading(false);
  };

  const inputTypes = {
    amount: 'number',
    maxSupply: 'number',
    mintLimit: 'number',
    memo: 'text',
    name: 'text',
    metadata: 'text',
    topicId: 'text',
    toAddress: 'text',
    fromAddress: 'text',
    tick: 'text',
    privateTopic: 'checkbox',
  };

  
const renderInputField = (field: string) => {
  const inputType = inputTypes[field];
  const maxLength = inputType === 'text' ? 100 : null;

  const maxValues: { [key: string]: number } = {
    amount: 9007199254740991, //  max for amount
    maxSupply: 9007199254740991, //  max for maxSupply
    mintLimit: 9007199254740991, //  max for mintLimit
  };

  switch (inputType) {
    case 'number':
      return (
        <TextField
          key={field}
          type="number"
          label={field.charAt(0).toUpperCase() + field.slice(1)}
          name={field}
          value={formData[field] || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            // Restrict the value to be within the range if it's a number field
            const value = e.target.value;
            if (!isNaN(Number(value))) {
              const numericalValue = Math.min(Math.max(Number(value), 0), maxValues[field] || 9007199254740991);
              setFormData({ ...formData, [field]: numericalValue.toString() });
            }
          }}
          inputProps={{
            min: 0,
            max: maxValues[field] || 9007199254740991
          }}
          fullWidth
          margin="normal"
        />
      );
      case 'checkbox':
        return (
          <FormControlLabel
            key={field}
            control={
              <Checkbox
                checked={formData[field] || false}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.checked })}
                name={field}
              />
            }
            label={field.charAt(0).toUpperCase() + field.slice(1)}
          />
        );
      case 'text':
      default:
        return (
          <TextField
            key={field}
            type="text"
            label={field.charAt(0).toUpperCase() + field.slice(1)}
            name={field}
            value={formData[field] || ''}
            onChange={handleChange}
            inputProps={{ maxLength }}
            fullWidth
            margin="normal"
          />
        );
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
      <FormControl fullWidth margin="normal">
        <InputLabel>Action</InputLabel>
        <Select
          value={action}
          onChange={handleActionChange}
          label="Action"
        >
          {Object.keys(fields).map((key) => (
            <MenuItem key={key} value={key}>
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {fields[action].map((field) => renderInputField(field))}

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
      <Button variant="contained" disabled={!transactionJson} color="primary" onClick={submitToHedera}>
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
