import React, { useContext, useState, FC } from 'react';
import { AppBar, Toolbar, Typography, Button, Drawer, List, ListItem, ListItemText } from '@mui/material';
import { WalletContext } from './WalletContext';
import WalletDialog from './WalletDialog';
import Link from 'next/link';

const Header: FC = () => {
  const walletContext = useContext(WalletContext);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggleDrawer = (open: boolean) => (event: React.KeyboardEvent | React.MouseEvent) => {
    if (event.type === 'keydown' && ((event as React.KeyboardEvent).key === 'Tab' || (event as React.KeyboardEvent).key === 'Shift')) {
      return;
    }
    setDrawerOpen(open);
  };

  const list = () => (
    <div
      role="presentation"
      onClick={toggleDrawer(false)}
      onKeyDown={toggleDrawer(false)}
      style={{position: 'relative',top:'60px'}}
    >
      <List>
        {['Home','HCS-20 Creator', 'HCS-20 Ledger', 'HCS-20 Registry','Create Topic'].map((text, index) => (
          <Link href={`/${text.replace(/\s+/g, '').toLowerCase()}`} key={text}>
            <ListItem button>
              <ListItemText primary={text} />
            </ListItem>
          </Link>
        ))}
        <a style={{color:'white', textDecoration: 'none'}} href={`https://patches-1.gitbook.io/hcs-20-auditable-points`} target="_blank">
            <ListItem>
              <ListItemText primary={"Docs"} />
            </ListItem>
          </a>
          <ListItem>
            <ListItemText primary={"Hashinals: Coming Soon"} />
          </ListItem>
      </List>

    </div>
  );

  const handleOpenDialog = () => {
    setDialogOpen(true);
  };

  return (
    <>
      <AppBar  position="static" >
        <Toolbar >
          <Button style={{color:"black", fontSize:30, padding:0, margin:0}} onClick={toggleDrawer(true)}>
          ☰
          </Button>
          <Drawer  anchor="left" open={drawerOpen} onClose={toggleDrawer(false)}>
            {list()}
          </Drawer>
          <Typography variant="h6" style={{ flexGrow: 1 }}>
            Turtle Moon HCS Toolkit (0.0.7)
          </Typography>
          {walletContext && walletContext.walletInfo.accountId ? (
            <>
              <Button color="inherit" onClick={handleOpenDialog}>
                Account: {walletContext.walletInfo.accountId}
              </Button>
            </>
          ) : (
            <Button color="inherit" onClick={handleOpenDialog}>
              Enter Wallet Info
            </Button>
          )}
        </Toolbar>
      </AppBar>
      <WalletDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
};

export default Header;
