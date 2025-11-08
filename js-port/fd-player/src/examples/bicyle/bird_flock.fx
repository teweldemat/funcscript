(locationParam, boundsParam, flapParam) => {
  base: locationParam ?? [0, 0];
  bounds: boundsParam ?? { width: 20; height: 10 };
  width: bounds.width ?? 20;
  height: bounds.height ?? 10;
  timeSeconds: flapParam ?? (t ?? 0);

  birdConfigs: [
    { offset: [0, 0]; size: height * 0.08; flap: 0.0 },
    { offset: [width * 0.25, height * 0.2]; size: height * 0.06; flap: 0.2 },
    { offset: [width * 0.6, -height * 0.15]; size: height * 0.07; flap: 0.4 }
  ];

  birds:
    birdConfigs map (config) => {
      center: [base[0] + config.offset[0], base[1] + config.offset[1]];
      return lib.bird(center, config.size, timeSeconds + config.flap);
    };

  return birds;
};
