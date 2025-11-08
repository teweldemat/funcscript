(treeBaseY, groundLineY, bounds) => {
  spacing: 10;
  chunkSize: 4;
  minSlot: math.floor(bounds.minX / spacing) - 1;
  maxSlot: math.ceil(bounds.maxX / spacing) + 1;
  treeCount: maxSlot - minSlot + 1;

  deterministicRandom: (seed) => {
    value: math.abs(math.sin(seed * 12.9898 + 78.233)) * 43758.5453;
    return value - math.floor(value);
  };

  trees: range(0, treeCount) map (i) => {
    slot: minSlot + i;
    chunkIndex: math.floor(slot / chunkSize);
    slotOffset: slot - chunkIndex * chunkSize;
    randomSeed: chunkIndex * 100 + slotOffset;
    baseX: slot * spacing;
    includeTree: (baseX >= bounds.minX - spacing) and (baseX <= bounds.maxX + spacing);
    baseScale: 2.4;
    scaleVariation: deterministicRandom(randomSeed) * 0.8;
    scale: baseScale + scaleVariation;
    sway: deterministicRandom(randomSeed + 1) - 0.5;
    offsetX: sway * 1.5;
    lift: deterministicRandom(randomSeed + 2) * 0.6;
    offsetY: 0.2 + lift;
    return if (includeTree) then tree([baseX + offsetX, treeBaseY + offsetY], scale) else [];
  };

  ground: {
    type: 'rect',
    data: {
      position: [bounds.minX - spacing, groundLineY - 0.6],
      size: [bounds.maxX - bounds.minX + spacing * 2, 0.6],
      fill: '#1e293b',
      stroke: '#475569',
      width: 0.25
    }
  };

  return [ground, trees];
};
