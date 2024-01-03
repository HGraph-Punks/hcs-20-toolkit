import React, { createContext, useState } from 'react';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletInfo, setWalletInfo] = useState({
    privateKey: '',
    accountId: '',
    network: 'mainnet',
    topicId: '0.0.4350190',
    submitKey:''
  });
  return (
    <WalletContext.Provider value={{ walletInfo, setWalletInfo }}>
      {children}
    </WalletContext.Provider>
  );
}