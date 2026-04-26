import React, { useEffect, useRef } from 'react';
import { Box, Container, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { Link as MUILink } from '@mui/material';
import { Scene } from './scene';
import { useAssetLoader } from '../contexts/AssetLoaderContext';
import { InputListener } from '../inputListener';

const SceneComponent: React.FC = () => {
	const assetLoader = useAssetLoader();
	const containerRef = useRef<HTMLDivElement>(null);

	// - Left mouse / single touch drag orbits
	// - Right mouse / two finger touch drag / arrow keys moves focus point
	// - scroll wheel / two finger pinch zooms
	useEffect(() => {
		console.log("useEffect: ", containerRef.current);
		const scene = new Scene(containerRef.current!, assetLoader);
		scene.init();

		const handler = new InputListener(containerRef.current!, {
			mouse: {
				drag: (args) => {
					if ((args.buttons & 1) !== 0) {
						if (args.ctrlKey)
							scene.overheadCamera.moveFocus(args.x, args.y, args.dx, args.dy);
						else
							scene.overheadCamera.changeOrbit(1, args.dy, args.dx);
					}
					if ((args.buttons & 4) !== 0 || (args.buttons & 2) !== 0)
						scene.overheadCamera.moveFocus(args.x, args.y, args.dx, args.dy);
				},
				// down: (args) => (args.button === 2) && scene.inputAction(args.x, args.y),
				// move: (args) => scene.inputMove(args.x, args.y),
			},
			wheel: {
				zoom: (args) => {
					scene.overheadCamera.changeOrbit(Math.exp(-0.001 * args.delta), 0, 0);
				},
				// pan: (args) => {
				// 	console.log(args);
				// 	scene.inputTransform(args.x, args.y, 0, 0, 1, 0);
				// },
			},
			touch: {
				dragSingle: (args) => {
					scene.overheadCamera.changeOrbit(1, args.dy, args.dx);
					if (args.ctrlKey)
						scene.overheadCamera.moveFocus(args.x, args.y, args.dx, args.dy);
				},
				dragPair: (args) => {
					scene.overheadCamera.changeOrbit(args.scale, 0, 0);
					scene.overheadCamera.moveFocus(args.x, args.y, args.dx, args.dy);
				}
			},
			keyboard: {
				keydown: (args) => {
					// console.log('key', args);
					if (args.key === "-")
						scene.overheadCamera.changeOrbit(10 / 9, 0, 0);
					if (args.key === "+")
						scene.overheadCamera.changeOrbit(9 / 10, 0, 0);
					if (args.key == "ArrowLeft")
						scene.overheadCamera.moveFocus(0, 0, -0.1, 0);
					if (args.key == "ArrowRight")
						scene.overheadCamera.moveFocus(0, 0, 0.1, 0);
					if (args.key == "ArrowUp")
						scene.overheadCamera.moveFocus(0, 0, 0, -0.1);
					if (args.key == "ArrowDown")
						scene.overheadCamera.moveFocus(0, 0, 0, 0.1);
				},
			},
			safariGesture: {
				change: (args) => {
					scene.overheadCamera.changeOrbit(args.scale, 0, 0);
				}
			},
		});

		return () => {
			scene.dispose();
			handler.cleanup();
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