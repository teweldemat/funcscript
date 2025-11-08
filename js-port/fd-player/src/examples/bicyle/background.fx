(treeBaseY, groundLineY, bounds) => {
  segmentLength: 200;

  chunkMin: math.floor(bounds.minX / segmentLength) - 1;
  chunkMax: math.ceil(bounds.maxX / segmentLength) + 1;
  chunkCount: chunkMax - chunkMin + 1;

  structures: range(0, chunkCount) map (chunkOffset) => {
    chunkIndex: chunkMin + chunkOffset;
    chunkStart: chunkIndex * segmentLength;

    world1: chunkStart - 80;
    visible1: if (world1 < bounds.minX - 80) then false else (if (world1 > bounds.maxX + 80) then false else true);
    structure1: if (visible1) then [
      tree([world1 - 7.2, treeBaseY + 0.4], 2.3),
      house([world1, treeBaseY], 1.2, 'house'),
      tree([world1 + 3.4, treeBaseY - 0.1], 1.6)
    ] else [];

    world2: chunkStart - 40;
    visible2: if (world2 < bounds.minX - 80) then false else (if (world2 > bounds.maxX + 80) then false else true);
    structure2: if (visible2) then [
      tree([world2 - 8, treeBaseY + 0.5], 2.4),
      house([world2, treeBaseY], 1.4, 'building'),
      tree([world2 + 5, treeBaseY - 0.2], 1.7)
    ] else [];

    world3: chunkStart;
    visible3: if (world3 < bounds.minX - 80) then false else (if (world3 > bounds.maxX + 80) then false else true);
    structure3: if (visible3) then [
      tree([world3 - 5.5, treeBaseY + 0.3], 2.1),
      house([world3, treeBaseY], 1, 'house'),
      tree([world3 + 4.2, treeBaseY - 0.1], 1.5)
    ] else [];

    world4: chunkStart + 46;
    visible4: if (world4 < bounds.minX - 80) then false else (if (world4 > bounds.maxX + 80) then false else true);
    structure4: if (visible4) then [
      tree([world4 - 4.8, treeBaseY + 0.6], 2.6),
      house([world4, treeBaseY], 1.3, 'tower'),
      tree([world4 + 6.2, treeBaseY - 0.2], 1.8)
    ] else [];

    world5: chunkStart + 90;
    visible5: if (world5 < bounds.minX - 80) then false else (if (world5 > bounds.maxX + 80) then false else true);
    structure5: if (visible5) then [
      tree([world5 - 5.8, treeBaseY + 0.4], 2.2),
      house([world5, treeBaseY], 1.1, 'house'),
      tree([world5 + 3.9, treeBaseY - 0.1], 1.6)
    ] else [];

    return [structure1, structure2, structure3, structure4, structure5];
  };

  fillerTrees: [];

  ground: {
    type: 'rect';
    data: {
      position: [bounds.minX - 100, groundLineY - 0.6];
      size: [bounds.maxX - bounds.minX + 200, 0.6];
      fill: '#1e293b';
      stroke: '#475569';
      width: 0.25;
    };
  };

  return [ground, fillerTrees, structures];
};
