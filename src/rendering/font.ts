import * as THREE from 'three';

/**
 * Stores data for multi-channel signed distance field font atlas. Each font is loaded
 * from two files - the atlas image and a JSON file containing font metadata.
 * 
 * The fonts files are generated using https://github.com/Chlumsky/msdf-atlas-gen
 * NOTE We manually process the atlas after generating it to clean up the padding area,
 * because without this cleaning mipmapping (and antialiasing) causes artifacts.
 */
class MCSDFFont {
    id: string | null;
    layoutData: any;
    glyphLookup!: Record<number, any>;
    kerningLookup!: Record<number, Record<number, number>>;
    atlas: THREE.Texture | null;

    constructor(id: string, layoutData: any, atlas: THREE.Texture) {
        this.id = id;
        this.atlas = atlas;
        this.layoutData = layoutData;
        this.createLookups();
    }

    /**
     * Computes glyphLookup and kerningLookup.
     */
    private createLookups() {
        this.glyphLookup = {};
        this.layoutData.glyphs.forEach((glyph: any) => {
            this.glyphLookup[glyph.unicode] = glyph;
        });

        this.kerningLookup = {};
        this.layoutData.kerning.forEach((entry: any) => {
            this.kerningLookup[entry.unicode1] ??= {};
            this.kerningLookup[entry.unicode1][entry.unicode2] = entry.advance;
        });
    }

    dispose() {
        // this.atlas?.dispose();
    }
}

export { MCSDFFont };