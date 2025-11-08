(locationParam, widthParam, heightParam, shiftParam) => {
  origin: locationParam ?? [0, 0];
  rawShift: shiftParam ?? 0;
  coverageWidth: widthParam ?? 120;
  groundHeight: heightParam ?? 20;
  tileWidth: groundHeight * 3;

  normalizeShift: (value, span) => {
    normalized: value - math.floor(value / span) * span;
    return normalized;
  };

  shift: normalizeShift(rawShift, tileWidth);
  totalWidth: coverageWidth + tileWidth * 2;
  repeatCount: math.ceil(totalWidth / tileWidth) + 1;
  startX: origin[0] + shift - tileWidth;
  tilePositions: range(0, repeatCount) map (index) => startX + index * tileWidth;

  buildGroundRect: (baseX) => {
    return {
      type: 'rect';
      data: {
        position: [baseX, origin[1]];
        size: [tileWidth, groundHeight];
        fill: '#15803d';
        stroke: '#0f5132';
        width: 0.2;
      };
    };
  };

  roadHeight: groundHeight * 0.35;
  roadY: origin[1] + groundHeight * 0.35;

  buildRoadRect: (baseX) => {
    return {
      type: 'rect';
      data: {
        position: [baseX, roadY];
        size: [tileWidth, roadHeight];
        fill: '#1f2937';
        stroke: '#0f172a';
        width: 0.2;
      };
    };
  };

  laneCenterY: roadY + roadHeight / 2;
  dashCount: 8;
  dashGapRatio: 0.5;
  dashWidth: tileWidth / (dashCount * (1 + dashGapRatio));
  dashGap: dashWidth * dashGapRatio;
  buildLaneDashes: (baseX) => {
    return range(0, dashCount) map (index) => {
      dashX: baseX + index * (dashWidth + dashGap);
      return {
        type: 'rect';
        data: {
          position: [dashX, laneCenterY - 0.25];
          size: [dashWidth, 0.5];
          fill: '#f8fafc';
          stroke: '#f8fafc';
          width: 0.1;
        };
      };
    };
  };

  groundRects: tilePositions map buildGroundRect;
  roadRects: tilePositions map buildRoadRect;
  laneSegments: tilePositions map buildLaneDashes;
  flattenedLaneSegments: laneSegments reduce (acc, segment) => acc + segment ~ [];

  return groundRects + roadRects + flattenedLaneSegments;
};
