(locationParam, widthParam, heightParam) => {
  origin: locationParam ?? [0, 0];
  areaWidth: widthParam ?? 60;
  areaHeight: heightParam ?? 32;

  skyPlane: {
    type: 'rect';
    data: {
      position: [origin[0], origin[1]];
      size: [areaWidth, areaHeight];
      fill: '#bae6fd';
      stroke: '#93c5fd';
      width: 0.18;
    };
  };

  spanMetric: math.min(areaWidth, areaHeight);

  makeWorldPoint: (ux, uy) => [
    origin[0] + areaWidth * ux,
    origin[1] + areaHeight * uy
  ];

  sunCenter: makeWorldPoint(0.75, 0.8);
  sunRadius: spanMetric * 0.12;
  sunElement: lib.sun({
    center: sunCenter;
    radius: sunRadius;
  });

  cloudLayouts: [
    { ux: 0.18; uy: 0.72; widthRatio: 0.06 },
    { ux: 0.38; uy: 0.68; widthRatio: 0.08 },
    { ux: 0.62; uy: 0.74; widthRatio: 0.07 },
    { ux: 0.82; uy: 0.69; widthRatio: 0.09 }
  ];

  cloudElements: cloudLayouts map (layout) => {
    center: makeWorldPoint(layout.ux, layout.uy);
    width: areaWidth * layout.widthRatio;
    return lib.cloud({
      center;
      width;
    });
  };

  return [skyPlane, sunElement, cloudElements];
};
