(treeBaseY, bounds) => {
  segmentLength: 300;
  chunkMin: -2;
  chunkMax: 2;
  chunkCount: chunkMax - chunkMin + 1;

  structureSlots: [
    {
      offset: -120;
      houseScale: 1.2;
      houseKind: 'house';
      trees: [
        { dx: -12; dy: 0.4; scale: 2.3 },
        { dx: 12; dy: -0.1; scale: 1.6 }
      ];
    },
    {
      offset: -60;
      houseScale: 1.4;
      houseKind: 'building';
      trees: [
        { dx: -14; dy: 0.5; scale: 2.4 },
        { dx: 14; dy: -0.2; scale: 1.7 }
      ];
    },
    {
      offset: 0;
      houseScale: 1;
      houseKind: 'house';
      trees: [
        { dx: -10; dy: 0.3; scale: 2.1 },
        { dx: 10; dy: -0.1; scale: 1.5 }
      ];
    },
    {
      offset: 60;
      houseScale: 1.3;
      houseKind: 'tower';
      trees: [
        { dx: -12; dy: 0.6; scale: 2.6 },
        { dx: 12; dy: -0.2; scale: 1.8 }
      ];
    },
    {
      offset: 120;
      houseScale: 1.1;
      houseKind: 'house';
      trees: [
        { dx: -12; dy: 0.4; scale: 2.2 },
        { dx: 12; dy: -0.1; scale: 1.6 }
      ];
    }
  ];

  structureChunks: range(0, chunkCount) map (chunkOffset) => {
    chunkIndex: chunkMin + chunkOffset;
    chunkStart: chunkIndex * segmentLength;

    return structureSlots map (slot) => {
      worldX: chunkStart + slot.offset;
      baseHouse: [worldX, treeBaseY];
      houseElement: lib.house(baseHouse, slot.houseScale, slot.houseKind);

      treeElements: slot.trees map (treeConfig) => {
        treePosition: [worldX + treeConfig.dx, treeBaseY + treeConfig.dy];
        return lib.tree(treePosition, treeConfig.scale);
      };

      return {
        house: houseElement;
        trees: treeElements;
      };
    };
  };

  treeLayer: structureChunks map (group) =>
    group map (entry) => entry.trees;

  houseLayer: structureChunks map (group) =>
    group map (entry) => entry.house;

  return [treeLayer, houseLayer];
};
