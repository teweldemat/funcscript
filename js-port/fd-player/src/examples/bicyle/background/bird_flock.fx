(bounds, groundLineY, flapT) => {
  birdOffsets: [0, 0.35, 0.62];
  cycleSeconds: 12;
  timeValue: flapT ?? 0;
  minX: bounds.minX - 40;
  maxX: bounds.maxX + 40;
  width: maxX - minX;

  return birdOffsets map (offset) => {
    progress: (timeValue / cycleSeconds + offset) % 1;
    centerX: minX + width * progress;
    arcY: math.sin(progress * math.pi) * 8;
    centerY: groundLineY + 16 + arcY;
    size: 0.7 + offset * 0.4;
    return lib.bird([centerX, centerY], size, timeValue + offset * cycleSeconds);
  };
};
