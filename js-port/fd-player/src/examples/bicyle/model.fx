{
  outerRadius: 9.0;
  speed: 1;
  baseHalfViewWidth: 30;
  baseViewHeight: 40;
  groundOffsetFromBottom: 11;
  baseViewMinX: -baseHalfViewWidth;

  pedalAngle: speed * t;
  traveledDistance: pedalAngle * outerRadius;

  startZoomTime: 5.0;
  endZoomTime: 10.0;
  zoomRaw: (t - startZoomTime) / (endZoomTime - startZoomTime);
  zoomProgress: if (zoomRaw < 0) then 0 else if (zoomRaw > 1) then 1 else zoomRaw;
  zoomFactor: 1 + zoomProgress * 9;
  halfViewWidth: baseHalfViewWidth * zoomFactor;
  viewHeight: baseViewHeight * zoomFactor;
  viewWidth: halfViewWidth * 2;
  bikeTravelPadding: outerRadius * 4;
  travelSpan: viewWidth + bikeTravelPadding * 2;
  wrapCount: math.floor(traveledDistance / travelSpan);
  offsetDistance: traveledDistance - wrapCount * travelSpan;
  leftWheelX: baseViewMinX - bikeTravelPadding + offsetDistance;
  groundY: 0;
  groundLineY: groundY - outerRadius;

  wheelTurnAngle: traveledDistance / outerRadius;

  rearWheelCenter: [leftWheelX, groundY];
  bicycleResult: bicycle(
    rearWheelCenter,
    outerRadius,
    wheelTurnAngle
  );

  leftWheelCenter: bicycleResult.leftWheelCenter;
  rightWheelCenter: bicycleResult.rightWheelCenter;
  frontGearCenter: bicycleResult.frontGearCenter;
  frameHeight: bicycleResult.frameHeight;
  wheelAngle: bicycleResult.wheelAngle;

  viewCenterX: (leftWheelCenter[0] + rightWheelCenter[0]) / 2;
  viewMinX: viewCenterX - halfViewWidth;
  viewMaxX: viewCenterX + halfViewWidth;
  viewMinY: groundLineY - groundOffsetFromBottom;
  viewMaxY: viewMinY + viewHeight;
  viewBounds: {
    minX: viewMinX;
    maxX: viewMaxX;
    minY: viewMinY;
    maxY: viewMaxY;
  };

  bicycleGraphics: bicycleResult.graphics;

  treeBaseY: groundLineY;
  backgroundElements: background(treeBaseY, groundLineY, viewBounds, t);

  roadElements: road(groundLineY, viewBounds);

  graphics: [
    backgroundElements.sky,
    backgroundElements.ground,
    roadElements,
    backgroundElements.sky_line,
    backgroundElements.bird_flock,
    bicycleGraphics
  ];

  return {
    graphics,
    frameHeight,
    wheelAngle,
    pedalAngle,
    leftWheelCenter,
    rightWheelCenter,
    frontGearCenter,
    groundLineY,
    viewBounds
  };
}
