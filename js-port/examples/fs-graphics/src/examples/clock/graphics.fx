{
  baseColor: '#38bdf8';
  accent: '#f97316';
  background: '#0f172a';
  hand: (len, w, c, speed) => ({
    type: 'polygon',
    data: {
      points: [
        [0, len],
        [w / 2, -1],
        [-w / 2, -1]
      ],
      fill: c
    },
    transform: {
      rotate: -t * speed
    }
  });
  
  ticks:series(0,12) map (i) => ({
    type: 'circle',
    data: {
      center: [0, 7.5],
      radius: 0.15,
      fill: baseColor
    },
    transform: {
      rotate: i * (360 / 12)
    }
  });
  
  frame: [{
    type: 'circle',
    data: {
      center: [0, 0],
      radius: 8,
      stroke: baseColor,
      width: 0.3,
      fill: 'rgba(15, 23, 42, 0.3)'
    }
  },ticks];

  return [
    frame,
    hand(4, 0.6, accent, 0.008333),
    hand(6, 0.4, baseColor, 0.1),
    hand(7, 0.2, accent, 6)
  ];
}