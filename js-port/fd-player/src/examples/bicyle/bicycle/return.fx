(rearWheelCenterParam, wheelRadiusParam, wheelTurnAngleParam) => {
  rearWheelCenter: rearWheelCenterParam ?? [0, 0];
  wheelRadius: wheelRadiusParam ?? 9;
  wheelTurnAngle: wheelTurnAngleParam ?? 0;

  innerRadius: 1;
  wheelToWheel: 25;
  gearRadius: 2;
  gearTeeth: 12;
  gearRatio: 0.6;

  wheelAngle: wheelTurnAngle;
  pedalAngle: wheelAngle * gearRatio;

  leftWheelCenter: rearWheelCenter;
  rightWheelCenter: [rearWheelCenter[0] + wheelToWheel, rearWheelCenter[1]];
  frontGearCenter: [rearWheelCenter[0] + wheelToWheel / 2, rearWheelCenter[1]];

  frameHeight: wheelRadius * 1.6;

  leftWheel: lib.wheel(
    leftWheelCenter,
    wheelRadius,
    innerRadius,
    wheelAngle
  );

  rightWheel: lib.wheel(
    rightWheelCenter,
    wheelRadius,
    innerRadius,
    wheelAngle
  );

  drivetrain: drive(
    frontGearCenter,
    leftWheelCenter,
    gearRadius,
    gearTeeth,
    gearRatio,
    pedalAngle
  );

  bikeFrame: frame(
    leftWheelCenter,
    rightWheelCenter,
    frontGearCenter,
    frameHeight
  );

  graphics: [
    drivetrain.pedal1,
    leftWheel,
    rightWheel,
    drivetrain.gear2,
    drivetrain.gear1,
    drivetrain.chain1,
    drivetrain.chain2,
    bikeFrame,
    drivetrain.pedal2
  ];

  return {
    graphics,
    pedalAngle,
    wheelAngle,
    leftWheelCenter,
    rightWheelCenter,
    frontGearCenter,
    frameHeight,
    wheelRadius,
    wheelBase: wheelToWheel
  };
};
