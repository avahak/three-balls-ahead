import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { AppRouter } from './AppRouter';

const darkTheme = createTheme({
	palette: {
		mode: 'dark',
	},
	typography: {
		fontSize: 14,
	}
});

createRoot(document.getElementById('root')!).render(
	<ThemeProvider theme={darkTheme}>
		<StrictMode>
			<CssBaseline />
			<AppRouter />
		</StrictMode>
	</ThemeProvider>
);
