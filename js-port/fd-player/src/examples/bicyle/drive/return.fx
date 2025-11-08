(frontCenter, rearCenter, frontRadius, frontTeeth, ratio, pedalAngle) => {
  pedalLength:frontRadius*2.5;
  gear1: gear(frontCenter, frontRadius, frontTeeth,pedalAngle);
  gear2: gear(rearCenter, frontRadius * ratio, frontTeeth * ratio,pedalAngle/ratio);
  chain1: chain([
    frontCenter[0], frontCenter[1] + frontRadius + 0.8
  ], [
    rearCenter[0], rearCenter[1] + (frontRadius * ratio) + 0.8
  ], 10,-pedalAngle*frontRadius);
  chain2: chain([
    frontCenter[0], frontCenter[1] - (frontRadius + 0.8)
  ], [
    rearCenter[0], rearCenter[1] - ((frontRadius * ratio) + 0.8)
  ], 10,pedalAngle*frontRadius);
  
  pedal1: pedal(frontCenter, pedalAngle, pedalLength,true);
  pedal2: pedal(frontCenter, pedalAngle + math.pi, pedalLength,false);
  
  return {
    chain1,
    chain2,
    pedal1,
    gear1,
    pedal2,
    gear2,
  };
};