{
  baseViewBounds: {
    minX: -60;
    maxX: 60;
    minY: -40;
    maxY: 40;
  };

  baseViewWidth: baseViewBounds.maxX - baseViewBounds.minX;
  baseViewHeight: baseViewBounds.maxY - baseViewBounds.minY;
  baseCenterX: (baseViewBounds.minX + baseViewBounds.maxX) / 2;
  baseCenterY: (baseViewBounds.minY + baseViewBounds.maxY) / 2;
  baseSkyHeight: baseViewHeight / 2;

  viewZoomStrength: 1.6;

  timeSeconds: t ?? 0;
  skylineSpeed: 4;
  groundSpeed: 8;

  zoomStart: 5;
  zoomEnd: 10;
  zoomRange: zoomEnd - zoomStart;
  zoomRaw: (timeSeconds - zoomStart) / zoomRange;
  zoomProgress: if (zoomRaw < 0) then 0 else if (zoomRaw > 1) then 1 else zoomRaw;
  viewZoomFactor: 1 + zoomProgress * viewZoomStrength;
  skylineZoomStrength: 0.8;
  skylineScaleFactor: 1 + zoomProgress * skylineZoomStrength;
  birdZoomStrength: 1.2;

  viewWidth: baseViewWidth * viewZoomFactor;
  viewHeight: baseViewHeight * viewZoomFactor;
  viewBounds: {
    minX: baseCenterX - viewWidth / 2;
    maxX: baseCenterX + viewWidth / 2;
    minY: baseCenterY - viewHeight / 2;
    maxY: baseCenterY + viewHeight / 2;
  };

  skyHeight: viewHeight / 2;
  skyOrigin: [viewBounds.minX, viewBounds.minY + skyHeight];

  wrapShift: (value, span) => {
    wrapped: value - math.floor(value / span) * span;
    return wrapped;
  };

  skylineShift: -wrapShift(timeSeconds * skylineSpeed, skyHeight * 2);
  groundShift: -wrapShift(timeSeconds * groundSpeed, viewWidth);
  birdDriftSpeed: skylineSpeed * 0.5;
  birdDriftShift: -wrapShift(timeSeconds * birdDriftSpeed, viewWidth);

  skyLayer: sky(skyOrigin, viewWidth, skyHeight);

  skylineHeightBase: baseSkyHeight * 0.35;
  skylineHeight: skylineHeightBase * skylineScaleFactor;
  skylineOriginY: skyOrigin[1];
  skylineOrigin: [viewBounds.minX, skylineOriginY];
  skylineLayer: sky_line(skylineOrigin, viewWidth, skylineHeight, skylineShift);

  groundHeight: baseSkyHeight;
  groundOrigin: [viewBounds.minX, skylineOriginY - groundHeight];
  groundLayer: ground(groundOrigin, viewWidth, groundHeight, groundShift);

  birdBoundsBaseWidth: baseViewWidth * 0.4;
  birdBoundsBaseHeight: baseSkyHeight * 0.25;
  birdBoundsWidth: birdBoundsBaseWidth * (1 + zoomProgress * birdZoomStrength);
  birdBoundsHeight: birdBoundsBaseHeight * (1 + zoomProgress * (birdZoomStrength * 0.6));
  birdZoomShift: viewWidth * 0.1 * zoomProgress;
  birdOriginX: viewBounds.minX + (viewWidth - birdBoundsWidth) * 0.55 - birdZoomShift + birdDriftShift;
  birdOriginY: skyOrigin[1] + skyHeight * 0.6;
  flockBounds: { width: birdBoundsWidth; height: birdBoundsHeight };
  flockOrigin: [birdOriginX, birdOriginY];
  birdFlockLayer: bird_flock(flockOrigin, flockBounds, timeSeconds);

  roadHeight: groundHeight * 0.35;
  roadY: groundOrigin[1] + groundHeight * 0.35;
  laneDividerY: roadY + roadHeight / 2;
  leftLaneMidY: laneDividerY + roadHeight / 4;

  wheelBase: 25;
  wheelRadius: 9;
  viewCenterX: (viewBounds.minX + viewBounds.maxX) / 2;
  rearWheelX: viewCenterX - wheelBase / 2;
  wheelCenterY: leftLaneMidY + wheelRadius;
  wheelAngle: -(groundShift / wheelRadius);
  bicycleResult: bicycle([rearWheelX, wheelCenterY], wheelRadius, wheelAngle);
  bicycleLayer: bicycleResult.graphics;

  graphics: skyLayer + birdFlockLayer + skylineLayer + groundLayer + bicycleLayer;

  return {
    graphics,
    viewBounds
  };
}
