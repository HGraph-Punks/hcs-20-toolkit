import React, { createContext, useState } from 'react';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [walletInfo, setWalletInfo] = useState({
    privateKey: '',
    accountId: '',
    network: 'testnet',
    topicId: '0.0.2673661',
    registry: '0.0.2673665',
    submitKey:''
  });
  return (
    <WalletContext.Provider value={{ walletInfo, setWalletInfo }}>
      {children}
    </WalletContext.Provider>
  );
}