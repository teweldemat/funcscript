(center, scale) => {
  sizeScale: scale ?? 1;
  radius: 6 * sizeScale;
  strokeWidth: 0.35 * sizeScale;
  glowRadius: radius * 1.35;
  rayCount: 12;
  rayInnerRadius: radius + 0.8 * sizeScale;
  rayOuterRadius: radius + 4 * sizeScale;

  glow: {
    type: 'circle';
    data: {
      center;
      radius: glowRadius;
      fill: 'rgba(253,224,71,0.25)';
      stroke: 'rgba(250,204,21,0.35)';
      width: strokeWidth * 0.5;
    };
  };

  rays: range(0, rayCount) map (index) => {
    angleProgress: (index * 1.0) / rayCount;
    angle: angleProgress * math.pi * 2;
    variant: index % 2;
    rayWidth: strokeWidth * (if (variant = 0) then 0.7 else 0.45);
    rayLength: if (variant = 0) then rayOuterRadius else (rayOuterRadius * 0.75);
    start: [
      center[0] + math.cos(angle) * rayInnerRadius,
      center[1] + math.sin(angle) * rayInnerRadius
    ];
    end: [
      center[0] + math.cos(angle) * rayLength,
      center[1] + math.sin(angle) * rayLength
    ];
    color: if (variant = 0) then '#fde047' else '#fef9c3';
    return {
      type: 'line';
      data: {
        from: start;
        to: end;
        stroke: color;
        width: rayWidth;
      };
    };
  };

  core: {
    type: 'circle';
    data: {
      center;
      radius;
      fill: '#fde047';
      stroke: '#facc15';
      width: strokeWidth;
    };
  };

  return [glow, rays, core];
};
