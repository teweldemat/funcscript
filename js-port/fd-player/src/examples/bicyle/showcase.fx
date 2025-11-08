{
  // Basic bounds large enough to frame all samples
  viewBounds: {
    minX: -60;
    maxX: 60;
    minY: -45;
    maxY: 45;
  };

  // Neutral background to make components stand out
  backgroundPanel: {
    type: 'rect';
    data: {
      position: [viewBounds.minX, viewBounds.minY];
      size: [viewBounds.maxX - viewBounds.minX, viewBounds.maxY - viewBounds.minY];
      fill: '#f1f5f9';
      stroke: '#cbd5f5';
      width: 0.2;
    };
  };

  groundLine: {
    type: 'line';
    data: {
      from: [viewBounds.minX, -12];
      to: [viewBounds.maxX, -12];
      stroke: '#94a3b8';
      width: 0.3;
    };
  };

  // Sky-layer components
  skySample: sky([-55, 15], 45, 24);
  skylineSample: sky_line([-55, 12], 45, 8, 0);
  groundSample: ground([-55, -30], 45, 18, 0);

  birdSample: lib.bird([30, 26], 4.2, 0.25);

  // Grounded components
  treeSample: lib.tree([-35, -12], 7.2);

  houseSample: lib.house([-5, -12], 6.93, 'cabin');

  wheelSample: lib.wheel([32, -12], 7, 2.6, 0.4);

  gearSample: lib.gear([5, -32], 6, 16, 0.8);

  bicycleSample: bicycle([-15, -12], 9, 0.35);

  scaleBar: {
    type: 'rect';
    data: {
      position: [-10, 0];
      size: [20, 1.2];
      fill: '#475569';
      stroke: '#0f172a';
      width: 0.2;
    };
  };

  verticalScaleBar: {
    type: 'rect';
    data: {
      position: [-0.6, -10];
      size: [1.2, 20];
      fill: '#475569';
      stroke: '#0f172a';
      width: 0.2;
    };
  };

  return {
    graphics: [
      backgroundPanel,
      skySample,
      skylineSample,
      groundSample,
      groundLine,
      birdSample,
      treeSample,
      houseSample,
      bicycleSample.graphics,
      wheelSample,
      gearSample,
      scaleBar,
      verticalScaleBar
    ];
    viewBounds;
  };
}
