// The sizes a glyph is drawn at (docs/visual-style/ui-type.md §7.1, docs/ui/components-and-constants.md §7): px at
// scale 1, which each host multiplies by its own scale. The glyph's drawing constants are render/constants'; these
// are the layout's, in a neutral home, so the HUD and the encyclopedia both read them without importing each other.

/** A glyph beside one `body` line (the menu's trait list, the encyclopedia list): drawn at the `list` LOD. */
export const TRAIT_GLYPH_LIST_PX = 20;
/** A glyph medallion on a picker card or an encyclopedia tile: drawn at the `card` LOD. */
export const TRAIT_GLYPH_CARD_PX = 56;
