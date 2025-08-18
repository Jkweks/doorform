function num(n) {
  if (n === undefined || n === null) return 0;
  const v = typeof n === 'number' ? n : parseFloat(n);
  return isNaN(v) ? 0 : v;
}

function computeDoorCutList(entryData = {}, parts = {}) {
  const top = parts.topRail || {};
  const bottom = parts.bottomRail || {};
  const hinge = parts.hingeRail || {};
  const lock = parts.lockRail || {};

  const openingHeight = num(entryData.openingHeight);
  const openingWidth = num(entryData.openingWidth);
  const hingeGap = num(entryData.hingeGap);
  const lockGap = num(entryData.strikeGap || entryData.lockGap);

  const vertical = openingHeight - num(top.part_ly) - num(bottom.part_ly);
  const horizontal = openingWidth - hingeGap - lockGap - num(hinge.part_ly) - num(lock.part_ly);

  const cutList = {};
  if (hinge.part_ly !== undefined) cutList.hingeRail = { length: vertical };
  if (lock.part_ly !== undefined) cutList.lockRail = { length: vertical };
  if (top.part_ly !== undefined) cutList.topRail = { length: horizontal };
  if (bottom.part_ly !== undefined) cutList.bottomRail = { length: horizontal };
  return cutList;
}

module.exports = { computeDoorCutList };
