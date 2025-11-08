(treeBaseY, groundLineY, bounds, zoomFactor) => {
  segmentLength: 300;

  chunkMin: math.floor(bounds.minX / segmentLength) - 1;
  chunkMax: math.ceil(bounds.maxX / segmentLength) + 1;
  chunkCount: chunkMax - chunkMin + 1;
  viewPadding: 80;

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
      visible: if (worldX < bounds.minX - viewPadding) then false else (if (worldX > bounds.maxX + viewPadding) then false else true);

      baseHouse: [worldX, treeBaseY];
      houseElement:
        if (visible) then house(baseHouse, slot.houseScale, slot.houseKind) else [];

      treeElements:
        if (visible) then slot.trees map (treeConfig) => {
          treePosition: [worldX + treeConfig.dx, treeBaseY + treeConfig.dy];
          return tree(treePosition, treeConfig.scale);
        } else [];

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

  backgroundPadding: 200;
  sceneWidth: bounds.maxX - bounds.minX + backgroundPadding * 2;
  sceneStartX: bounds.minX - backgroundPadding;
  viewWidth: bounds.maxX - bounds.minX;
  viewHeight: bounds.maxY - bounds.minY;
  skyHeight: bounds.maxY - groundLineY;

  sky: {
    type: 'rect';
    data: {
      position: [sceneStartX, groundLineY];
      size: [sceneWidth, bounds.maxY - groundLineY];
      fill: '#bae6fd';
      stroke: '#93c5fd';
      width: 0.2;
    };
  };

  meadow: {
    type: 'rect';
    data: {
      position: [sceneStartX, bounds.minY];
      size: [sceneWidth, groundLineY - bounds.minY];
      fill: '#15803d';
      stroke: '#166534';
      width: 0.2;
    };
  };

  infiniteScale: zoomFactor ?? 1;

  sunCenter: [
    bounds.minX + viewWidth * 0.15,
    groundLineY + skyHeight * 0.85
  ];
  sunLayer: sun(sunCenter, infiniteScale);

  cloudCount: 6;
  horizontalPadding: 0.12;
  cloudRows: [0.68, 0.78, 0.88];
  rowCount: cloudRows.length;
  cloudLayer: range(0, cloudCount) map (index) => {
    fraction: if (cloudCount = 1) then 0.5 else index / (cloudCount - 1);
    usableWidth: 1 - horizontalPadding * 2;
    centerX: bounds.minX + viewWidth * (horizontalPadding + usableWidth * fraction);
    rowIndex: index % rowCount;
    baseFactor: cloudRows[rowIndex];
    sinusOffset: math.sin(index * 1.1) * 0.03;
    minCloudHeight: 0.4;
    maxCloudHeight: 0.95;
    heightFactorRaw: baseFactor + sinusOffset;
    heightFactor: if (heightFactorRaw < minCloudHeight) then minCloudHeight else (if (heightFactorRaw > maxCloudHeight) then maxCloudHeight else heightFactorRaw);
    baseY: groundLineY + skyHeight * heightFactor;
    return cloud(centerX, baseY, infiniteScale);
  };

  birdOffsets: [0, 0.38, 0.71];
  birdLayer: birdOffsets map (offset) => bird(offset, bounds, groundLineY);

  roadPadding: 120;
  roadWidth: 1.8;
  roadOffsetBelowGround: 0.4;
  roadLength: bounds.maxX - bounds.minX + roadPadding * 2;
  roadStartX: bounds.minX - roadPadding;
  roadY: groundLineY - roadOffsetBelowGround - roadWidth;

  asphalt: {
    type: 'rect';
    data: {
      position: [roadStartX, roadY];
      size: [roadLength, roadWidth];
      fill: '#111827';
      stroke: '#0f172a';
      width: 0.4;
    };
  };

  markerLength: 8;
  markerGap: 6;
  markerHeight: 0.2;
  markerStep: markerLength + markerGap;
  markerVisibleWidth: bounds.maxX - bounds.minX + roadPadding * 2;
  markerCount: math.ceil(markerVisibleWidth / markerStep) + 2;
  markerFirstX: math.floor((bounds.minX - roadPadding) / markerStep) * markerStep;
  laneMarkers: range(0, markerCount) map (index) => {
    startX: markerFirstX + index * markerStep;
    return {
      type: 'rect';
      data: {
        position: [startX, roadY + roadWidth / 2 - markerHeight / 2];
        size: [markerLength, markerHeight];
        fill: '#fef08a';
        stroke: '#fde047';
        width: 0.15;
      };
    };
  };

  roadElements: [asphalt, laneMarkers];

  return [sky, meadow, sunLayer, cloudLayer, birdLayer, roadElements, treeLayer, houseLayer];
};
