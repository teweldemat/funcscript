// House where sizeParam controls the main wall height (absolute units)
(position, sizeParam, kindParam) => {
  base: position ?? [0, 0];
  kind: kindParam ?? 'house';
  isBuilding: kind = 'building';
  isTower: kind = 'tower';

  scaleBoost: 1.8;
  kindScale:
    if (isBuilding) then 1.15
    else if (isTower) then 1.05
    else 1;

  baseBodyHeight:
    if (isBuilding) then 12
    else if (isTower) then 16
    else 7;

  baseBodyWidth:
    if (isBuilding) then 12
    else if (isTower) then 6
    else 9;

  defaultBodyHeight: baseBodyHeight * scaleBoost * kindScale;
  targetBodyHeight: sizeParam ?? defaultBodyHeight;
  scale: targetBodyHeight / baseBodyHeight;

  bodyWidth: baseBodyWidth * scale;
  bodyHeight: targetBodyHeight;

  bodyLeft: base[0] - bodyWidth / 2;
  bodyBottom: base[1];
  bodyTop: base[1] + bodyHeight;

  bodyColor:
    if (isBuilding) then '#475569'
    else if (isTower) then '#94a3b8'
    else '#f97316';
  accentColor:
    if (isBuilding) then '#cbd5f5'
    else if (isTower) then '#1e293b'
    else '#fed7aa';

  body: {
    type: 'rect';
    data: {
      position: [bodyLeft, bodyBottom];
      size: [bodyWidth, bodyHeight];
      fill: bodyColor;
      stroke: '#0f172a';
      width: 0.35;
    };
  };

  roof:
    if (isBuilding) then {
      type: 'rect';
    data: {
      position: [bodyLeft - 0.4 * scale, bodyTop];
      size: [bodyWidth + 0.8 * scale, 1.3 * scale];
        fill: '#1f2937';
        stroke: '#0f172a';
        width: 0.35;
      };
    }
    else if (isTower) then {
      type: 'polygon';
      data: {
        points: [
          [base[0], bodyTop + 3 * scale],
          [bodyLeft - 1.2 * scale, bodyTop],
          [bodyLeft + bodyWidth + 1.2 * scale, bodyTop]
        ];
        fill: '#334155';
        stroke: '#0f172a';
        width: 0.35;
      };
    }
    else {
      type: 'polygon';
      data: {
        points: [
          [bodyLeft - 0.5 * scale, bodyTop],
          [bodyLeft + bodyWidth / 2, bodyTop + 3 * scale],
          [bodyLeft + bodyWidth + 0.5 * scale, bodyTop]
        ];
        fill: '#7c2d12';
        stroke: '#0f172a';
        width: 0.35;
      };
    };

  doorway: {
    doorWidth: 2.3 * scale;
    doorHeight: 3.2 * scale;
    type: 'rect';
    data: {
      position: [base[0] - doorWidth / 2, bodyBottom];
      size: [doorWidth, doorHeight];
      fill: accentColor;
      stroke: '#0f172a';
      width: 0.25;
    };
  };

  windowRect: (centerX, bottomY) => {
    width: 2 * scale;
    height: 2 * scale;
    return {
      type: 'rect';
      data: {
        position: [centerX - width / 2, bottomY];
        size: [width, height];
        fill: accentColor;
        stroke: '#0f172a';
        width: 0.2;
      };
    };
  };

  windows:
    if (isBuilding) then [
      windowRect(bodyLeft + 1.6 * scale, bodyBottom + 2.2 * scale),
      windowRect(bodyLeft + bodyWidth - 1.6 * scale, bodyBottom + 2.2 * scale),
      windowRect(bodyLeft + 1.6 * scale, bodyBottom + 6 * scale),
      windowRect(bodyLeft + bodyWidth - 1.6 * scale, bodyBottom + 6 * scale)
    ]
    else if (isTower) then [
      {
        type: 'circle';
        data: {
          center: [base[0], bodyBottom + bodyHeight / 2];
          radius: 1.6 * scale;
          fill: accentColor;
          stroke: '#0f172a';
          width: 0.2;
        };
      }
    ]
    else [
      windowRect(bodyLeft + 2.4 * scale, bodyBottom + 2.4 * scale),
      windowRect(bodyLeft + bodyWidth - 2.4 * scale, bodyBottom + 2.4 * scale)
    ];

  return [body, roof, doorway, windows];
};
