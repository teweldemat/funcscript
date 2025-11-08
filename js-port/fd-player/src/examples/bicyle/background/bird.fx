(timeOffset, bounds, groundLineY) => {
  cycleSeconds: 12;
  normalizedTime: (t / cycleSeconds) + (timeOffset ?? 0);
  progress: normalizedTime - math.floor(normalizedTime);

  safeBounds: bounds ?? { minX: -40; maxX: 40; minY: -20; maxY: 20 };
  minX: safeBounds.minX;
  maxX: safeBounds.maxX;
  flightStartX: minX - 60;
  flightEndX: maxX + 60;
  flightWidth: flightEndX - flightStartX;
  flightX: flightStartX + flightWidth * progress;

  safeGround: groundLineY ?? 0;
  baseAltitude: safeGround + 18;
  arcOffset: math.sin(progress * math.pi);
  altitude: baseAltitude + arcOffset * 10;

  flap: math.sin(progress * math.pi * 6);
  wingspan: 9;
  wingLift: flap * 3;
  wingAngle: flap * 0.85;

  rotate: (vector, angle) => {
    cosA: math.cos(angle);
    sinA: math.sin(angle);
    return [
      vector[0] * cosA - vector[1] * sinA,
      vector[0] * sinA + vector[1] * cosA
    ];
  };

  bodyLength: 4.2;
  nose: [flightX + bodyLength / 2, altitude];
  tail: [flightX - bodyLength / 2, altitude + 0.4];

  bodyCenter: [flightX - 0.4, altitude];
  bodyRadius: 2.4;
  body: {
    type: 'circle';
    data: {
      center: bodyCenter;
      radius: bodyRadius;
      fill: '#e2e8f0';
      stroke: '#0f172a';
      width: 0.3;
    };
  };

  belly: {
    type: 'circle';
    data: {
      center: [bodyCenter[0] - 0.3, bodyCenter[1] + 0.6];
      radius: bodyRadius * 0.7;
      fill: '#f8fafc';
      stroke: 'transparent';
      width: 0;
    };
  };

  headCenter: [nose[0] + 0.2, nose[1] - 0.1];
  head: {
    type: 'circle';
    data: {
      center: headCenter;
      radius: 1.1;
      fill: '#f8fafc';
      stroke: '#0f172a';
      width: 0.3;
    };
  };

  eye: {
    type: 'circle';
    data: {
      center: [headCenter[0] - 0.35, headCenter[1] - 0.2];
      radius: 0.2;
      fill: '#0f172a';
      stroke: '#0f172a';
      width: 0.1;
    };
  };

  beak: {
    type: 'polygon';
    data: {
      points: [
        [nose[0], nose[1]],
        [nose[0] + 0.8, nose[1] + 0.2],
        [nose[0] + 0.6, nose[1] - 0.1]
      ];
      fill: '#fbbf24';
      stroke: '#92400e';
      width: 0.2;
    };
  };

  wingFill: '#cbd5f5';
  wingStroke: '#1e293b';

  buildWing: (anchor, direction) => {
    dirAngle: wingAngle * direction + (if (direction = -1) then 0.2 else -0.2);
    tipVec: rotate([direction * wingspan, wingLift * direction + 1.6], dirAngle);
    midVec: rotate([direction * (wingspan * 0.55), wingLift * direction + 2.2], dirAngle);
    trailingVec: rotate([direction * (wingspan * 0.65), wingLift * direction - 0.5], dirAngle);
    rearVec: rotate([direction * 2.2, -1.0], dirAngle);
    primary: {
      type: 'polygon';
      data: {
        points: [
          anchor,
          [anchor[0] + rearVec[0], anchor[1] + rearVec[1]],
          [anchor[0] + tipVec[0], anchor[1] + tipVec[1]],
          [anchor[0] + midVec[0], anchor[1] + midVec[1]],
          [anchor[0] + trailingVec[0], anchor[1] + trailingVec[1]]
        ];
        fill: wingFill;
        stroke: wingStroke;
        width: 0.25;
      };
    };

    highlightVec: rotate([direction * wingspan * 0.45, wingLift * direction + 1.4], dirAngle);
    highlight: {
      type: 'polygon';
      data: {
        points: [
          anchor,
          [anchor[0] + highlightVec[0], anchor[1] + highlightVec[1]],
          [anchor[0] + midVec[0], anchor[1] + midVec[1]]
        ];
        fill: 'rgba(248,250,252,0.85)';
        stroke: 'transparent';
        width: 0;
      };
    };

    return [primary, highlight];
  };

  leftWingAnchor: [flightX - 0.5, altitude + 0.2];
  rightWingAnchor: [flightX + 0.5, altitude - 0.2];
  wings: [
    buildWing(leftWingAnchor, -1),
    buildWing(rightWingAnchor, 1)
  ];

  tailFeathers: {
    type: 'polygon';
    data: {
      points: [
        [tail[0] - 0.4, tail[1] + 0.3],
        [tail[0] - 1.4, tail[1] + 1.5],
        [tail[0] - 0.7, tail[1] + 0.5],
        [tail[0] - 1.3, tail[1] - 0.1]
      ];
      fill: '#94a3b8';
      stroke: '#0f172a';
      width: 0.25;
    };
  };

  return [body, belly, head, wings, tailFeathers, beak, eye];
};
