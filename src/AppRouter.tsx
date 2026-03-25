import { HashRouter, Routes, Route } from 'react-router-dom';
import { FrontPage } from './FrontPage.tsx';
import { App } from './App.tsx';
import { AssetLoaderProvider } from './contexts/AssetLoaderContext.tsx';

const AppRouter = () => {
    return (<>
        <HashRouter>
            <AssetLoaderProvider>
                <Routes>
                    <Route path="/test" element={<App />} />
                    <Route path="/" element={<FrontPage />} />
                </Routes>
            </AssetLoaderProvider>
        </HashRouter>
    </>);
}

export { AppRouter };