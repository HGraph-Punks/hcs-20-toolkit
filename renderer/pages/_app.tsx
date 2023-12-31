import React , {useState, useContext} from 'react'
import Head from 'next/head'
import type { AppProps } from 'next/app'
import { CssBaseline, ThemeProvider } from '@mui/material'
import theme from '../lib/theme'
import type { EmotionCache } from '@emotion/cache'
import createEmotionCache from '../lib/create-emotion-cache'
import { CacheProvider } from '@emotion/react'
import { WalletProvider, WalletContext } from '../components/WalletContext';
import WalletDialog from '../components/WalletDialog';
import Header from '../components/Header';
import { AppBar, Toolbar, Typography, Button } from '@mui/material';

const clientSideEmotionCache = createEmotionCache()

type MyAppProps = AppProps & {
  emotionCache?: EmotionCache
}

export default function MyApp(props: MyAppProps) {
  const { Component, pageProps, emotionCache = clientSideEmotionCache } = props
  const [dialogOpen, setDialogOpen] = useState(false);

  const walletContext = useContext(WalletContext);

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };
  return (

    <WalletProvider>
    <CacheProvider value={emotionCache}>
      <Head>
        <title>Turtle Moon HCS Toolkit</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
      </Head>
      
      <ThemeProvider theme={theme}>
       <Header/>
        <CssBaseline />
        <Component {...pageProps} />
       
        <WalletDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
      
      </ThemeProvider>
    </CacheProvider>
    </WalletProvider>
  )
}
