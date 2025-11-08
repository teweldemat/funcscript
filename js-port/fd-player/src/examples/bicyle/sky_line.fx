(locationParam, widthParam, heightParam, shiftParam) => {
  base: locationParam ?? [0, 0];
  width: widthParam ?? 60;
  height: heightParam ?? 12;
  rawShift: shiftParam ?? 0;

  layout: [
    { kind: 'tree'; offset: 0.0; sizeRatio: 0.85 },
    { kind: 'house'; houseKind: 'house'; offset: 1.0; sizeRatio: 1.05 },
    { kind: 'house'; houseKind: 'building'; offset: 2.1; sizeRatio: 1.45 },
    { kind: 'house'; houseKind: 'tower'; offset: 3.25; sizeRatio: 1.6 },
    { kind: 'tree'; offset: 4.3; sizeRatio: 1.0 }
  ];

  layoutCount: 5;
  layoutEndOffset: 4.3;
  layoutSpan: (layoutEndOffset + 1) * height;
  tileSpan: if (layoutSpan > 0) then layoutSpan else height * 5;

  normalizeShift: (value, span) => {
    wrapped: value - math.floor(value / span) * span;
    return wrapped;
  };

  shift: normalizeShift(rawShift, tileSpan);
  totalWidth: width + tileSpan * 2;
  repeatCount: math.ceil(totalWidth / tileSpan) + 1;

  buildElement: (tileX, entryIndex) => {
    entry: layout[entryIndex];
    anchorX: tileX + height * entry.offset;
    anchor: [anchorX, base[1]];
    size: height * entry.sizeRatio;
    preferredHouseKind: entry.houseKind;
    houseKind:
      if (preferredHouseKind = null)
        then 'house'
        else preferredHouseKind;
    element:
      if (entry.kind = 'tree')
        then lib.tree(anchor, size)
        else lib.house(anchor, size, houseKind);
    return element;
  };

  skylineElements:
    range(0, repeatCount) reduce (acc, tileIndex) => {
      tileX: base[0] + shift - tileSpan + tileIndex * tileSpan;
      tileShapes:
        range(0, layoutCount) map (entryIndex) => buildElement(tileX, entryIndex);
      return acc + tileShapes;
    } ~ [];

  return skylineElements;
};
