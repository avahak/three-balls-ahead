import { createContext, useContext, useRef, type ReactNode } from 'react';
import { AssetLoader } from '../rendering/assetLoader';

const AssetLoaderContext = createContext<AssetLoader | null>(null);

const AssetLoaderProvider = ({ children }: { children: ReactNode }) => {
    const assetLoader = useRef(new AssetLoader()).current;
    return (
        <AssetLoaderContext.Provider value={assetLoader}>
            {children}
        </AssetLoaderContext.Provider>
    );
};

const useAssetLoader = () => {
    const context = useContext(AssetLoaderContext);
    if (!context) {
        throw new Error('useAssetLoader must be used within AssetLoaderProvider');
    }
    return context;
};

export { AssetLoaderProvider, useAssetLoader };