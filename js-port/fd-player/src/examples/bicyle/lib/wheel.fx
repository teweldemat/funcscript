// wheel([0, 0], 10, 2, 0)
(center, outerRadius, innerRadius, angle) => {
  n: 12;
  lines: range(0, n) map (i) => {
    theta: (angle ?? 0) + i * (2 * math.pi / n);
    return {
      type: 'line',
      data: {
        from: [
          center[0] + math.sin(theta) * innerRadius,
          center[1] + math.cos(theta) * innerRadius
        ],
        to: [
          center[0] + math.sin(theta) * outerRadius,
          center[1] + math.cos(theta) * outerRadius
        ],
        stroke: '#38bdf8',
        width: 0.3
      }
    };
  };
  return [
    lines,
    {
      type: 'circle',
      data: {
        center: center,
        radius: outerRadius,
        stroke: '#334155',
        width: 1,
        fill: null
      }
    },
    {
      type: 'circle',
      data: {
        center: center,
        radius: innerRadius,
        stroke: '#38bdf8',
        width: 1,
        fill: null
      }
    }
  ];
};
