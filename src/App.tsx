import React, { useEffect, useRef } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Link as MUILink } from '@mui/material';
import { Scene } from './scene';
import { useAssetLoader } from './contexts/AssetLoaderContext';

const SceneComponent: React.FC = () => {
	const assetLoader = useAssetLoader();
	const containerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		console.log("useEffect: ", containerRef.current);
		const scene = new Scene(containerRef.current!, assetLoader);
		return () => {
			scene.dispose();
		};
	}, []);

	return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
};

const App: React.FC = () => {
	return (
		<Container maxWidth="xl">
			<Box display="flex" justifyContent="center" sx={{ py: 2 }}>
				<Typography variant="h2">
					Template (class)
				</Typography>
			</Box>
			<Box style={{ width: "100%", height: "600px" }}>
				<SceneComponent />
			</Box>
			<MUILink component={RouterLink} to="/" variant="body1" color="primary">
				Back
			</MUILink>
		</Container>
	);
};

export { App };