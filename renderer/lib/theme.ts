import { createTheme } from '@mui/material/styles';
import { red } from '@mui/material/colors';

// Define a dark dusty blue color
const main = '#00a67d';

// Create a theme instance with a dark color scheme
const theme = createTheme({
  palette: {
    primary: {
      main: main,
    },
    secondary: {
      main: '#19857b',
    },
    error: {
      main: red.A400,
    },
    background: {
      default: '#222', // Dark background
      paper: '#1E1E1E',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B0BEC5',
    },
  },
});

export default theme;
