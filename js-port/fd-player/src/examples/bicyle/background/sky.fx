(skyBounds) => {
  startX: skyBounds.minX;
  startY: skyBounds.minY;
  skyWidth: skyBounds.maxX - skyBounds.minX;
  skyHeight: skyBounds.maxY - skyBounds.minY;

  skyLayer: {
    type: 'rect';
    data: {
      position: [startX, startY];
      size: [skyWidth, skyHeight];
      fill: '#bae6fd';
      stroke: '#93c5fd';
      width: 0.2;
    };
  };

  sunRadius: skyWidth * 0.05;
  sunLayer: lib.sun({
    center: [startX + skyWidth * 0.75, startY + skyHeight * 0.82];
    radius: sunRadius;
  });

  cloudSpecs: [
    { x: 0.54; y: 0.82; width: 0.035 },
    { x: 0.64; y: 0.78; width: 0.03 },
    { x: 0.72; y: 0.80; width: 0.08 },
    { x: 0.80; y: 0.76; width: 0.033 },
    { x: 0.86; y: 0.84; width: 0.078 }
  ];

  cloudLayer: cloudSpecs map (spec) => {
    return lib.cloud({
      center: [startX + skyWidth * spec.x, startY + skyHeight * spec.y];
      width: skyWidth * spec.width;
    });
  };

  return [skyLayer, sunLayer, cloudLayer];
};
