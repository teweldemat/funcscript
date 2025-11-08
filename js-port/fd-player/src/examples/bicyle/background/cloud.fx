(centerX, baseY, scale) => {
  sizeScale: scale ?? 1;
  baseRadius: 3.8 * sizeScale;
  strokeWidth: 0.22 * sizeScale;

  puffPalette: ['#f8fafc', '#f1f5f9', '#e2e8f0', '#cbd5f5'];
  puffLayout: [
    { dx: -6.2; dy: 0.3; radiusScale: 1.05; shadeIndex: 2 },
    { dx: -3.4; dy: 1.3; radiusScale: 1.35; shadeIndex: 0 },
    { dx: -0.6; dy: 0.5; radiusScale: 1.55; shadeIndex: 1 },
    { dx: 2.8; dy: 1.1; radiusScale: 1.3; shadeIndex: 0 },
    { dx: 5.6; dy: 0.2; radiusScale: 1.0; shadeIndex: 3 }
  ];

  shadow: {
    type: 'circle';
    data: {
      center: [centerX + 2 * sizeScale, baseY - 2.2 * sizeScale];
      radius: baseRadius * 1.5;
      fill: 'rgba(148,163,184,0.25)';
      stroke: 'transparent';
      width: 0;
    };
  };

  softGlow: {
    type: 'circle';
    data: {
      center: [centerX + 0.5 * sizeScale, baseY + 0.4 * sizeScale];
      radius: baseRadius * 1.8;
      fill: 'rgba(241,245,249,0.3)';
      stroke: 'transparent';
      width: 0;
    };
  };

  puffs: puffLayout map (puff) => {
    safeIndex:
      if (puff.shadeIndex < puffPalette.length) then puff.shadeIndex else (puffPalette.length - 1);
    shade: puffPalette[safeIndex];
    return {
      type: 'circle';
      data: {
        center: [centerX + puff.dx * sizeScale, baseY + puff.dy * sizeScale];
        radius: baseRadius * puff.radiusScale;
        fill: shade;
        stroke: 'transparent';
        width: 0;
      };
    };
  };

  highlight: {
    type: 'circle';
    data: {
      center: [centerX - 1.8 * sizeScale, baseY + 1.4 * sizeScale];
      radius: baseRadius * 0.8;
      fill: 'rgba(248,250,252,0.6)';
      stroke: 'transparent';
      width: 0;
    };
  };

  return [shadow, softGlow, puffs, highlight];
};
