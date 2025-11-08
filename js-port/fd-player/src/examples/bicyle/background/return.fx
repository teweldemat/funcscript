(treeBaseY, groundLineY, bounds, flapT) => {
  viewWidth: bounds.maxX - bounds.minX;
  viewHeight: bounds.maxY - bounds.minY;
  skyBounds: {
    minX: bounds.minX - viewWidth * 0.1;
    maxX: bounds.maxX + viewWidth * 0.1;
    minY: bounds.minY - viewHeight * 0.1;
    maxY: bounds.maxY + viewHeight * 0.1;
  };

  skyElements: sky(bounds);
  groundElements: ground(groundLineY, bounds);
  skyLineElements: sky_line(treeBaseY, bounds);
  birdFlockElements: bird_flock(bounds, groundLineY, flapT);

  return {
    sky: skyElements;
    ground: groundElements;
    sky_line: skyLineElements;
    bird_flock: birdFlockElements
  };
};
