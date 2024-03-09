import React from 'react';
import { Container, Typography, Card, CardContent, CardActions, Button, Grid } from '@mui/material';
import Link from 'next/link';

export default function Home() {
  // List of pages and their descriptions
  const pages = [
    { name: 'Hashinals Minting', description: 'Mint Hashinals', link: '/hashinals' },
    { name: 'HCS-20 Creator', description: 'Deploy, Mint, Transfer, or Burn HCS-20 points', link: '/hcs-20creator' },
    { name: 'HCS-20 Ledger', description: 'Read HCS-20 data from topic ids (will not show main public id ledger)', link: '/hcs-20ledger' },
    { name: 'HCS-20 Registry', description: 'View all HCS-20 topic ids that have been registered', link: '/hcs-20registry' },
    { name: 'Create Topic', description: 'Create a new topic id on HCS to write data', link: '/createtopic' },
  ];

  return (
    <Container>
      <br />
      <Typography variant="h4" gutterBottom>Home</Typography>
      <Typography variant="body1" gutterBottom>
        Explore the toolkit by clicking on the links below:
      </Typography>
      <br/>
      <Grid container spacing={3}>
        {pages.map((page, index) => (
          <Grid item key={index} xs={12} sm={6} md={4} lg={3}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h5" component="h2" margin="10px 0">
                  {page.name}
                </Typography>
                <Typography variant="body2" component="p">
                  {page.description}
                </Typography>
              </CardContent>
              <CardActions>
                <Link href={page.link} passHref>
                  <Button size="small">Explore</Button>
                </Link>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Container>
  );
}
