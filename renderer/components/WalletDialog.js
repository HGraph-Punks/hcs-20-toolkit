// WalletDialog.js
import React, { useContext, useState } from 'react';
import { WalletContext } from './WalletContext';
import { Dialog, DialogContent, DialogActions, Button, TextField, Switch, FormControlLabel } from '@mui/material';

export default function WalletDialog({ open, onClose }) {
    const { walletInfo, setWalletInfo } = useContext(WalletContext);
    const [localPrivateKey, setLocalPrivateKey] = useState(walletInfo.privateKey);
    const [localTopicId, setLocalTopicId] = useState(walletInfo.topicId);
    const [localAccountId, setLocalAccountId] = useState(walletInfo.accountId);
    const [localSubmitKey, setLocalSubmitKey] = useState(walletInfo.submitKey);
    const [isMainnet, setIsMainnet] = useState(walletInfo.network === 'mainnet');
  
    const handleNetworkChange = (event) => {
      setIsMainnet(event.target.checked);
    };
  
    const handleSubmit = () => {
      setWalletInfo({
        privateKey: localPrivateKey,
        accountId: localAccountId,
        network: isMainnet ? 'mainnet' : 'testnet',
        topicId: localTopicId,
        submitKey: localSubmitKey,
      });
      onClose();
    };
  

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogContent> 
        <TextField
          label="Account ID"
          fullWidth
          margin="normal"
          value={localAccountId}
          onChange={(e) => setLocalAccountId(e.target.value)}
        />
        <TextField
          label="Private Key"
          fullWidth
          type="password"
          margin="normal"
          value={localPrivateKey}
          onChange={(e) => setLocalPrivateKey(e.target.value)}
        />
        <TextField
          label="Topic Id"
          fullWidth
          margin="normal"
          value={localTopicId}
          onChange={(e) => setLocalTopicId(e.target.value)}
        />
        <TextField
          label="Submit Key (Optional)"
          fullWidth
          margin="normal"
          value={localSubmitKey}
          onChange={(e) => setLocalSubmitKey(e.target.value)}
        />
       
      <FormControlLabel
        control={<Switch checked={isMainnet} onChange={handleNetworkChange} />}
        label={isMainnet ? 'Mainnet' : 'Testnet'}
      />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleSubmit}>Use Account</Button>
      </DialogActions>
    </Dialog>
  );
}
