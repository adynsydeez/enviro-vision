// Full vegetation type registry keyed by numeric id.
// IDs 1–15 match MockWebSocket output; 16–24 reserved for real backend data.
export const VEGETATION_TYPES = {
  // Forest — Tall trees (>30 m)
  1:  { name: 'Tall woodland',       color: '#798D5B', group: 'forest'    },
  2:  { name: 'Tall open forest',    color: '#215426', group: 'forest'    },
  3:  { name: 'Tall closed forest',  color: '#5D0000', group: 'forest'    },
  // Forest — Med trees (10–30 m)
  4:  { name: 'Woodland',            color: '#92BC6A', group: 'forest'    },
  5:  { name: 'Open forest',         color: '#228032', group: 'forest'    },
  6:  { name: 'Closed forest',       color: '#BB0002', group: 'forest'    },
  // Forest — Low trees (<10 m)
  7:  { name: 'Low woodland',        color: '#CCDF9F', group: 'forest'    },
  8:  { name: 'Low open forest',     color: '#3BB143', group: 'forest'    },
  // Shrubland
  9:  { name: 'Tall shrubland',      color: '#B5845C', group: 'shrubland' },
  10: { name: 'Open shrubland',      color: '#F0C9B0', group: 'shrubland' },
  11: { name: 'Shrubland',           color: '#F1AB71', group: 'shrubland' },
  // Grassland
  12: { name: 'Grassland',           color: '#A9AC70', group: 'grassland' },
  13: { name: 'Hummock grassland',   color: '#FFF6B5', group: 'grassland' },
  14: { name: 'Sparse grassland',    color: '#FFFAE6', group: 'grassland' },
  15: { name: 'Open grassland',      color: '#E0E3B6', group: 'grassland' },
  16: { name: 'Croplands',           color: '#F5E56B', group: 'grassland' },
  // Other
  17: { name: 'Sedgeland',           color: '#EEA9CB', group: 'other'     },
  18: { name: 'Bare',                color: '#FFFFFF', group: 'other'     },
  19: { name: 'Wetland',             color: '#9EC0E6', group: 'other'     },
  20: { name: 'Built-up',            color: '#000000', group: 'other'     },
  21: { name: 'Plantation',          color: '#6C5580', group: 'other'     },
  22: { name: 'Horticulture',        color: '#EFA600', group: 'other'     },
  23: { name: 'Permanent water',     color: '#02388E', group: 'other'     },
  24: { name: 'Intermittent water',  color: '#5578CE', group: 'other'     },
};

// Classification groups — add new groups here to extend the foliage panel
export const VEGETATION_GROUPS = {
  forest:    { label: 'Forest',    accent: '#3BB143', ids: [1,2,3,4,5,6,7,8]          },
  shrubland: { label: 'Shrubland', accent: '#C07840', ids: [9,10,11]                  },
  grassland: { label: 'Grassland', accent: '#A9AC70', ids: [12,13,14,15,16]           },
  other:     { label: 'Other',     accent: '#9EC0E6', ids: [17,18,19,20,21,22,23,24]  },
};

// Backward-compat shim — existing code that imports VEGETATION_COLORS still works
export const VEGETATION_COLORS = Object.fromEntries(
  Object.entries(VEGETATION_TYPES).map(([k, v]) => [k, v.color])
);
