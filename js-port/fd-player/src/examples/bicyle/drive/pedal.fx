(center, angle, length, isLeft) => {
  // parameters
  baseRadius: 1.0;
  baseWidth: 1.2;
  tipWidth: 0.6;
  footWidth: 3.0;
  footThickness: 0.6;
  jointRadius: 0.4; // small circle at leg rest attachment

  // direction and perpendicular
  dx: math.sin(angle);
  dy: math.cos(angle);
  px: math.cos(angle);
  py: -math.sin(angle);

  // key points
  baseCenter: [center[0] + dx * baseRadius, center[1] + dy * baseRadius];
  tipCenter: [center[0] + dx * (length - footThickness / 2), center[1] + dy * (length - footThickness / 2)];
  footCenter: tipCenter; // aligned centers

  // half widths
  bw: baseWidth / 2;
  tw: tipWidth / 2;

  // arm polygon corners
  baseLeft: [baseCenter[0] + px * bw, baseCenter[1] + py * bw];
  baseRight: [baseCenter[0] - px * bw, baseCenter[1] - py * bw];
  tipLeft: [tipCenter[0] + px * tw, tipCenter[1] + py * tw];
  tipRight: [tipCenter[0] - px * tw, tipCenter[1] - py * tw];

  // foot rest (always horizontal)
  fw: footWidth / 2;
  fh: footThickness / 2;
  footTL: [footCenter[0] - fw, footCenter[1] - fh];
  footTR: [footCenter[0] + fw, footCenter[1] - fh];
  footBR: [footCenter[0] + fw, footCenter[1] + fh];
  footBL: [footCenter[0] - fw, footCenter[1] + fh];

  // components
  baseCircle: {
    type: 'circle',
    data: {
      center: center,
      radius: baseRadius,
      stroke: '#60a5fa',
      width: 0.4,
      fill: '#60a5fa'
    }
  };

  armPolygon: {
    type: 'polygon',
    data: {
      points: [baseLeft, baseRight, tipRight, tipLeft],
      stroke: '#60a5fa',
      width: 0.0,
      fill: '#60a5fa'
    }
  };

  armOutline: {
    type: 'polygon',
    data: {
      points: [baseLeft, baseRight, tipRight, tipLeft, baseLeft],
      stroke: '#3b82f6',
      width: 0.2
    }
  };

  footRest: {
    type: 'polygon',
    data: {
      points: [footTL, footTR, footBR, footBL],
      stroke: '#60a5fa',
      width: 0.0,
      fill: '#60a5fa'
    }
  };

  footOutline: {
    type: 'polygon',
    data: {
      points: [footTL, footTR, footBR, footBL, footTL],
      stroke: '#3b82f6',
      width: 0.2
    }
  };

  jointCircle: {
    type: 'circle',
    data: {
      center: tipCenter,
      radius: jointRadius,
      stroke: '#3b82f6',
      width: 0.3,
      fill: '#93c5fd'
    }
  };

  // drawing order depending on isRight
  return (if isLeft then 
     [baseCircle, jointCircle, footRest, footOutline, armPolygon, armOutline]
   else 
     [ baseCircle, armPolygon, armOutline, footRest, footOutline,jointCircle]);
  
}
