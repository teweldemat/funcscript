// bird([x, y], bodyWidth, flapTime)
(locationParam, sizeParam, flapTParam) => {
  location: locationParam ?? [0, 0];
  baseBodyWidth: 4.9; // width produced when legacy scale = 1
  targetBodyWidth: sizeParam ?? baseBodyWidth;
  scale: targetBodyWidth / baseBodyWidth;
  timeValue: flapTParam ?? 0;

  lerp: (a, b, u) => a + (b - a) * u;
  easeInCubic: (u) => u * u * u;
  easeOutCubic: (u) => 1 - math.pow(1 - u, 3);
  rotate: (v, a) => {
    c: math.cos(a);
    s: math.sin(a);
    return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
  };

  flapHz: 2.1;
  flapPhase: timeValue * flapHz;
  flapU: flapPhase - math.floor(flapPhase);
  downFrac: 0.36;
  flapState: if (flapU < downFrac)
    then easeOutCubic(flapU / downFrac)
    else 1 - easeInCubic((flapU - downFrac) / (1 - downFrac));

  wingspan: 9.2 * scale;
  wingAngle: lerp(-0.95, 0.60, flapState);
  wingLift: (flapState - 0.5) * 5.2 * scale;
  bodyPitch: lerp(0.12, -0.06, flapState);
  tailFan: lerp(0.5, 1.0, 1.0 - flapState);

  hoverOffset: math.sin(timeValue * 0.6) * scale * 0.8;
  bodyLength: 4.4 * scale;
  bodyCenter: [location[0], location[1] + hoverOffset];
  nose: [
    bodyCenter[0] + (bodyLength / 2) * math.cos(bodyPitch),
    bodyCenter[1] + (bodyLength / 2) * math.sin(bodyPitch)
  ];
  tailRoot: [
    bodyCenter[0] - (bodyLength / 2) * math.cos(bodyPitch),
    bodyCenter[1] - (bodyLength / 2) * math.sin(bodyPitch)
  ];

  bodyRadius: targetBodyWidth / 2;
  body: { type: 'circle'; data: { center: bodyCenter; radius: bodyRadius; fill: '#e2e8f0'; stroke: '#0f172a'; width: 0.3; }; };
  belly:{ type:'circle'; data:{ center:[bodyCenter[0]-0.35*scale, bodyCenter[1]+0.65*scale]; radius: bodyRadius*0.7; fill:'#f8fafc'; stroke:'transparent'; width:0; }; };
  head: { type:'circle'; data:{ center:[nose[0]+0.15*scale, nose[1]-0.12*scale]; radius:1.08*scale; fill:'#f8fafc'; stroke:'#0f172a'; width:0.3; }; };

  blinkHz: 0.25;
  blinkPhase: timeValue * blinkHz;
  blinkU: blinkPhase - math.floor(blinkPhase);
  eyeOpen: if (blinkU < 0.02) then 0.2 else 1.0;
  eye:{ type:'circle'; data:{ center:[(nose[0]+0.15*scale)-0.35*scale,(nose[1]-0.12*scale)-0.2*scale]; radius:0.2*eyeOpen*scale; fill:'#0f172a'; stroke:'#0f172a'; width:0.1; }; };
  beak:{ type:'polygon'; data:{ points:[[nose[0],nose[1]],[nose[0]+0.85*scale,nose[1]+0.2*scale],[nose[0]+0.6*scale,nose[1]-0.1*scale]]; fill:'#fbbf24'; stroke:'#92400e'; width:0.2; }; };

  wingFill: '#cbd5f5';
  wingTipFill: '#e6ecff';
  wingStroke: '#1e293b';

  buildWing:(anchor, direction)=>{
    dirAngle: wingAngle * direction + (if (direction = -1) then 0.22 else -0.22);
    baseHalf: 1.0 * scale;
    spanVec: rotate([direction * wingspan, wingLift * direction + 1.3 * scale], dirAngle);
    baseUp:  rotate([0,  baseHalf], dirAngle);
    baseDn:  rotate([0, -baseHalf], dirAngle);
    tip: [anchor[0] + spanVec[0], anchor[1] + spanVec[1]];

    mainTri:{
      type:'polygon';
      data:{
        points:[
          [anchor[0] + baseUp[0], anchor[1] + baseUp[1]],
          [anchor[0] + baseDn[0], anchor[1] + baseDn[1]],
          tip
        ];
        fill: wingFill;
        stroke: wingStroke;
        width: 0.25;
      };
    };

    tipLen: wingspan * 0.35;
    tipBaseHalf: baseHalf * 0.6;
    tipSpan: rotate([direction * tipLen, wingLift * direction + 0.2 * scale], dirAngle);
    tipUp:  rotate([0,  tipBaseHalf], dirAngle);
    tipDn:  rotate([0, -tipBaseHalf], dirAngle);
    tipPoint: [tip[0] + tipSpan[0], tip[1] + tipSpan[1]];

    tipTri:{
      type:'polygon';
      data:{
        points:[
          [tip[0] + tipUp[0], tip[1] + tipUp[1]],
          [tip[0] + tipDn[0], tip[1] + tipDn[1]],
          tipPoint
        ];
        fill: wingTipFill;
        stroke: wingStroke;
        width: 0.22;
      };
    };

    return { mainTri; tipTri };
  };

  leftWingAnchor:  [bodyCenter[0] - 0.55 * scale, bodyCenter[1] + 0.22 * scale];
  rightWingAnchor: [bodyCenter[0] + 0.55 * scale, bodyCenter[1] - 0.22 * scale];
  leftWing:  buildWing(leftWingAnchor, -1);
  rightWing: buildWing(rightWingAnchor, 1);

  tailSpread: 0.6 * tailFan * scale;
  tail:{
    type:'polygon';
    data:{
      points:[
        [tailRoot[0]-0.35*scale,               tailRoot[1]+0.28*scale],
        [tailRoot[0]-(1.2*scale+tailSpread),   tailRoot[1]+(1.4*scale+0.2*tailFan*scale)],
        [tailRoot[0]-0.65*scale,               tailRoot[1]+0.45*scale],
        [tailRoot[0]-(1.1*scale+tailSpread),   tailRoot[1]-(0.2*scale+0.15*tailFan*scale)]
      ];
      fill:'#94a3b8';
      stroke:'#0f172a';
      width:0.25;
    };
  };

  return [
    rightWing.tipTri,
    rightWing.mainTri,
    tail,
    body, belly, head,
    beak, eye,
    leftWing.mainTri,
    leftWing.tipTri
  ];
};
