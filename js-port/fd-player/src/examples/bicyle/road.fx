(groundLineY, bounds) => {
  roadPadding: 120;
  roadWidth: 1.8;
  roadOffsetBelowGround: 0.4;
  roadLength: bounds.maxX - bounds.minX + roadPadding * 2;
  roadStartX: bounds.minX - roadPadding;
  roadY: groundLineY - roadOffsetBelowGround - roadWidth;

  asphalt: {
    type: 'rect';
    data: {
      position: [roadStartX, roadY];
      size: [roadLength, roadWidth];
      fill: '#111827';
      stroke: '#0f172a';
      width: 0.4;
    };
  };

  markerLength: 8;
  markerGap: 6;
  markerHeight: 0.2;
  markerStep: markerLength + markerGap;
  markerVisibleWidth: bounds.maxX - bounds.minX + roadPadding * 2;
  markerCount: math.ceil(markerVisibleWidth / markerStep) + 2;
  markerFirstX: math.floor((bounds.minX - roadPadding) / markerStep) * markerStep;
  laneMarkers: range(0, markerCount) map (index) => {
    startX: markerFirstX + index * markerStep;
    return {
      type: 'rect';
      data: {
        position: [startX, roadY + roadWidth / 2 - markerHeight / 2];
        size: [markerLength, markerHeight];
        fill: '#fef08a';
        stroke: '#fde047';
        width: 0.15;
      };
    };
  };

  return [asphalt, laneMarkers];
};
