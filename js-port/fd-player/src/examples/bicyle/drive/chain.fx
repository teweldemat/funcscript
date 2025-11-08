(start, end, segments, displacement) => {
dx: (end[0] - start[0]) / segments;
dy: (end[1] - start[1]) / segments;
length: math.sqrt((end[0] - start[0]) * (end[0] - start[0]) + (end[1] - start[1]) * (end[1] - start[1]));
unitsPerLength: segments / length;
dispUnits: displacement * unitsPerLength;
segmentFraction: 0.2;

wrap:(t)=>((t % segments) + segments) % segments;
point:(t)=>[
start[0] + dx * wrap(t),
start[1] + dy * wrap(t)
];

raw: range(0, segments) map (i) => {
  a: i + dispUnits;
  b: a + segmentFraction;
  aw: wrap(a);
  bw: wrap(b);
  crossed: bw < aw;
  return (if (crossed) then [] else
   {
    type: 'line';
    data: {
      from: point(a),
      to: point(b),
      stroke: '#fbbf24',
      width: 0.3
    };
  })
};

lines: raw filter (x)=> x != null;
return lines;
};