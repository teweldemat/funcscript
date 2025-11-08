(rear, front, gear, height) => {
  // geometry parameters
  slant: 0.28 * height;
  rearSlant: 0.3 * height; // rear column leans slightly forward
  steerRise: 0.2 * height;  // shortened steering column
  barGap: 2.2;

  // front slant projection helper
  xAtY:(y)=> front[0] - slant * ((y - front[1]) / height);

  // rear slant projection helper
  rearXAtY:(y)=> rear[0] + rearSlant * ((y - rear[1]) / height);

  // top coordinates
  rTopY: rear[1] + height;
  rTop: [rearXAtY(rTopY), rTopY];
  rTopLower: [rearXAtY(rTopY - barGap), rTopY - barGap];

  fTopY: front[1] + height + steerRise;
  fTop: [xAtY(fTopY), fTopY];

  fJoin: [xAtY(rTopY), rTopY];
  fJoinLower: [xAtY(rTopY - barGap), rTopY - barGap];

  // seat
  seatLen: 4.0;
  seatHalf: seatLen / 2;
  seatLeft: [rTop[0] - seatHalf, rTop[1]];
  seatRight: [rTop[0] + seatHalf, rTop[1]];

  // steering handle
  handleLen: 2.6;
  handleRise: 0.8;
  handleEnd: [fTop[0] + handleLen, fTop[1] + handleRise];

  return [
    // slanted rear column
    { type: 'line', data: { from: rear, to: rTop, stroke: '#9ca3af', width: 0.6 } },

    // front slanted steering column
    { type: 'line', data: { from: front, to: fTop, stroke: '#9ca3af', width: 0.6 } },

    // top horizontal bar
    { type: 'line', data: { from: rTopLower, to: fJoinLower, stroke: '#9ca3af', width: 0.6 } },

    // lower triangle (gear to both ends of lower bar)
    { type: 'line', data: { from: gear, to: rTopLower, stroke: '#9ca3af', width: 0.6 } },
    { type: 'line', data: { from: gear, to: fJoinLower, stroke: '#9ca3af', width: 0.6 } },

    // lower horizontal bar
    { type: 'line', data: { from: gear, to: rear, stroke: '#9ca3af', width: 0.6 } },

    // seat
    { type: 'line', data: { from: seatLeft, to: seatRight, stroke: '#6b7280', width: 0.5 } },

    // steering handle
    { type: 'line', data: { from: fTop, to: handleEnd, stroke: '#6b7280', width: 0.5 } }
  ];
}