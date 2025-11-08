// tree([0, 0], trunkHeight)
(position, sizeParam) => {
  base: position ?? [0, 0];
  baseTrunkHeight: 4;
  targetTrunkHeight: sizeParam ?? baseTrunkHeight;
  scale: targetTrunkHeight / baseTrunkHeight;
  trunkWidth: 0.9 * scale;
  trunkHeight: targetTrunkHeight;
  canopyWidth: 5 * scale;
  canopyHeight: 4 * scale;

  trunkBottomLeft: [base[0] - trunkWidth / 2, base[1]];
  canopyBaseY: base[1] + trunkHeight;
  canopyApexY: canopyBaseY + canopyHeight;

  return [
    {
      type: 'rect',
      data: {
        position: [trunkBottomLeft[0], trunkBottomLeft[1]],
        size: [trunkWidth, trunkHeight],
        fill: '#92400e',
        stroke: '#713f12',
        width: 0.25
      }
    },
    {
      type: 'polygon',
      data: {
        points: [
          [base[0] - canopyWidth / 2, canopyBaseY],
          [base[0], canopyApexY],
          [base[0] + canopyWidth / 2, canopyBaseY]
        ],
        fill: '#22c55e',
        stroke: '#15803d',
        width: 0.35
      }
    },
    {
      type: 'circle',
      data: {
        center: [base[0], canopyBaseY + canopyHeight * 0.6],
        radius: canopyWidth / 2.8,
        fill: 'rgba(34,197,94,0.8)',
        stroke: '#16a34a',
        width: 0.25
      }
    }
  ];
};
