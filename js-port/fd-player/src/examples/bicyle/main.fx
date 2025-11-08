{
  outerRadius: 9.0;
  innerRadius: 1.0;
  wheelToWheel: 25.0;
  gearRadius: 2.0;
  gearTeeth: 12.0;
  gearRatio: 0.6;
  speed: 1;

  pedalAngle: speed * t;
  rearWheelToGear: wheelToWheel / 2;
  wheelAngle: pedalAngle / gearRatio;

  leftWheel: wheel(
    [-wheelToWheel / 2, 0],
    outerRadius,
    innerRadius,
    wheelAngle
  );

  rightWheel: wheel(
    [wheelToWheel / 2, 0],
    outerRadius,
    innerRadius,
    wheelAngle
  );
  frontGearCenter:[-wheelToWheel / 2 + rearWheelToGear, 0];
  theDrive: drive(
    frontGearCenter,
    [-wheelToWheel / 2, 0],
    gearRadius,
    gearTeeth,
    gearRatio,
    pedalAngle
  );

  frameHeight: outerRadius * 1.6;
  theFrame: frame(
    [-wheelToWheel / 2, 0],
    [wheelToWheel / 2, 0],
    frontGearCenter,
    frameHeight
  );

  return [
    
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
}