{
  outerRadius: 9.0;
  innerRadius: 1.0;
  wheelToWheel: 25.0;
  gearRadius: 2.0;
  gearTeeth: 12.0;
  gearRatio: 0.6;
  speed: 1;
  halfViewWidth: 30;
  viewHeight: 40;
  groundOffsetFromBottom: 11;
  baseViewMinX: -halfViewWidth;

  pedalAngle: speed * t;
  rearWheelToGear: wheelToWheel / 2;
  wheelAngle: pedalAngle / gearRatio;

  viewWidth: halfViewWidth * 2;
  travelSpan: viewWidth + wheelToWheel * 2;
  traveledDistance: wheelAngle * outerRadius;
  wrapCount: math.floor(traveledDistance / travelSpan);
  offsetDistance: traveledDistance - wrapCount * travelSpan;
  leftWheelX: baseViewMinX - wheelToWheel + offsetDistance;
  groundY: 0;
  groundLineY: groundY - outerRadius;

  leftWheelCenter: [leftWheelX, groundY];
  rightWheelCenter: [leftWheelCenter[0] + wheelToWheel, groundY];
  frontGearCenter:[leftWheelCenter[0] + rearWheelToGear, groundY];

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

  leftWheel: wheel(
    leftWheelCenter,
    outerRadius,
    innerRadius,
    wheelAngle
  );

  rightWheel: wheel(
    rightWheelCenter,
    outerRadius,
    innerRadius,
    wheelAngle
  );
  theDrive: drive(
    frontGearCenter,
    leftWheelCenter,
    gearRadius,
    gearTeeth,
    gearRatio,
    pedalAngle
  );

  frameHeight: outerRadius * 1.6;
  theFrame: frame(
    leftWheelCenter,
    rightWheelCenter,
    frontGearCenter,
    frameHeight
  );

  treeBaseY: groundLineY;
  backgroundElements: background(treeBaseY, groundLineY, viewBounds);

  graphics: [
    backgroundElements,
    theDrive.pedal1,
    leftWheel,
    rightWheel,
    theDrive.gear2,
    theDrive.gear1,
    theDrive.chain1,
    theDrive.chain2,
    theFrame,
    theDrive.pedal2,
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
