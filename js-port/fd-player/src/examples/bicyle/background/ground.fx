(groundLineY, bounds) => {
  backgroundPadding: 200;
  sceneWidth: bounds.maxX - bounds.minX + backgroundPadding * 2;
  sceneStartX: bounds.minX - backgroundPadding;

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

  return meadow;
};
