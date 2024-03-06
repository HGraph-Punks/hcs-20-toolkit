import React, { useState, createContext } from 'react';

export const TMTContext = createContext({});

export const TMTProvider = ({ children }) => {
  // Initialize state variables with useState
  const [hederaMainnetEnv, setHederaMainnetEnv] = useState(false); // Assuming boolean, adjust based on actual usage
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState('');
  const [user, setUser] = React.useState({
    accountId: '',
    pk: '',
    nftStorageAPI: '',
  });

  /* Init Hashlips Token  State */
  const [hashlipsToken, setHashlipsToken] = React.useState(
    {
      name: '',
      symbol: '',
      maxSupply: '',
      numOfRoyaltyFees: 1,
      royalty0: '',
      royaltyAccountId0: '',
      treasuryAccountId: '',
      renewAccountId: '',
      fallbackFee: 5,
      previousTokenId: ''
    }
  );

  /* Init Tokeen State */
  const [token, setToken] = React.useState(
    {
      name: '',
      tokenId: '',
      description: '',
      creator: '',
      supply: '',
      category: 'Collectible',
      royalty: '',
      numOfRoyaltyFees: 0,
      numOfAttributes: 0,
      imageUrl: '',
      imageData: undefined,
      imageType: 'image/jpg',
      photoSize: 1,
      treasuryAccountId: '',
      renewAccountId: '',
    }
  );


  // Context value including state variables and their setters
  const contextValue = {
    user,
    setUser,
    accountId, // This is derived from user, no setter required
    hederaMainnetEnv,
    setHederaMainnetEnv,
    setLoading,
    hashlipsToken,
    setHashlipsToken,
    token,
    setToken,
  };

  return (
    <TMTContext.Provider value={contextValue}>
      {children}
    </TMTContext.Provider>
  );
};

export default TMTContext;
