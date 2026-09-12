// The one home of every client render-only number and colour (docs/CODE-STANDARDS.md §2): the
// files under render/constants/ are its pages, re-exported here so every import reads
// `render/constants`. A literal in those files IS the constant; nowhere else in render/ holds one.
export * from './constants/colours';
export * from './constants/cell-shape';
export * from './constants/organelles';
export * from './constants/vent';
export * from './constants/world-render';
export * from './constants/bench';
