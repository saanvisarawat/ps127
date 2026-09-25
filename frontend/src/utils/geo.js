// Builds points along a quadratic bezier curve between two [lat, lon] pairs,
// offset perpendicular to the line so overlapping OD pairs are visually distinguishable.
export function arcPoints([lat1, lon1], [lat2, lon2], curvature = 0.18, segments = 24) {
  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;

  const dx = lat2 - lat1;
  const dy = lon2 - lon1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;

  // perpendicular unit vector
  const perpX = -dy / dist;
  const perpY = dx / dist;

  const controlLat = midLat + perpX * dist * curvature;
  const controlLon = midLon + perpY * dist * curvature;

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const oneMinusT = 1 - t;
    const lat =
      oneMinusT * oneMinusT * lat1 + 2 * oneMinusT * t * controlLat + t * t * lat2;
    const lon =
      oneMinusT * oneMinusT * lon1 + 2 * oneMinusT * t * controlLon + t * t * lon2;
    points.push([lat, lon]);
  }
  return points;
}
