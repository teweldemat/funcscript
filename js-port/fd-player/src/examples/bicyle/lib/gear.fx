// gear([0, 0], 4, 12, 0)
(center, radius, teeth, angleAdvance) => {
  n: teeth;
  toothSize: 0.7;
  teethLines: range(0, n) map (i) => {
    angle: (i * 2 * math.pi/n)+angleAdvance;
    halfStep: math.pi / n;
    base1: [center[0] + math.sin(angle - halfStep) * radius,
           center[1] + math.cos(angle - halfStep) * radius];
    base2: [center[0] + math.sin(angle + halfStep) * radius,
           center[1] + math.cos(angle + halfStep) * radius];
    apex: [center[0] + math.sin(angle) * (radius + toothSize),
          center[1] + math.cos(angle) * (radius + toothSize)];
    return [
      { type: 'line', data: { from: base1, to: base2, stroke: '#38bdf8', width: 0.3 } },
      { type: 'line', data: { from: base2, to: apex, stroke: '#38bdf8', width: 0.3 } },
      { type: 'line', data: { from: apex, to: base1, stroke: '#38bdf8', width: 0.3 } }
    ];
  };
  return [
    teethLines,
    {
      type: 'circle',
      data: {
        center: center,
        radius: radius,
        stroke: '#334155',
        width: 1,
        fill: '#334155'
      }
    }
  ];
};
