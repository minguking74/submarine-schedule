// SJC2 서비스 구간(Segment S). id는 capacity_design.segment_id / contracts.segment_s와 같은 값이고,
// a/z는 RouteMap의 SJC2 랜딩 포인트 키입니다.
export const SJC2_SEGMENTS = [
  { id: 'KR-TY', label: '한-일 (TY)', a: 'busan', z: 'chikura' },
  { id: 'KR-OS', label: '한-일 (OS)', a: 'busan', z: 'shima' },
  { id: 'KR-HK', label: '한-홍', a: 'busan', z: 'chunghomkok' },
  { id: 'KR-SG', label: '한-싱', a: 'busan', z: 'changi' },
  { id: 'JP-HK', label: '일(TY)-홍', a: 'chikura', z: 'chunghomkok' },
  { id: 'JP-SG', label: '일(TY)-싱', a: 'chikura', z: 'changi' },
  { id: 'HK-SG', label: '홍-싱', a: 'chunghomkok', z: 'changi' },
];

const keyOf = ([lon, lat]) => `${lon},${lat}`;

/** 케이블 MultiLineString을 꼭짓점 그래프로 보고(트렁크·지선이 같은 좌표로 만남) 두 지점 사이 경로를 찾습니다. */
export function findCablePath(lines, from, to) {
  const coords = new Map();
  const adj = new Map();
  for (const line of lines) {
    line.forEach((c, i) => {
      const k = keyOf(c);
      coords.set(k, c);
      if (!adj.has(k)) adj.set(k, new Set());
      if (i > 0) {
        const prev = keyOf(line[i - 1]);
        adj.get(k).add(prev);
        adj.get(prev).add(k);
      }
    });
  }

  const nearest = ({ lon, lat }) => {
    let best = null;
    let bestD = Infinity;
    for (const [k, [x, y]] of coords) {
      const d = (x - lon) ** 2 + (y - lat) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    }
    return best;
  };

  const start = nearest(from);
  const goal = nearest(to);
  const prev = new Map([[start, null]]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === goal) break;
    for (const next of adj.get(cur)) {
      if (!prev.has(next)) { prev.set(next, cur); queue.push(next); }
    }
  }
  if (!prev.has(goal)) return [];

  const path = [];
  for (let k = goal; k !== null; k = prev.get(k)) path.unshift(coords.get(k));
  return path;
}

/** 경로 좌표를 따라 잰 대원 거리(km). 지도용 단순화 좌표라 실제 케이블 길이보다 짧게 나옵니다. */
export function pathLengthKm(path) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  let km = 0;
  for (let i = 1; i < path.length; i++) {
    const [lon1, lat1] = path[i - 1];
    const [lon2, lat2] = path[i];
    const h = Math.sin(rad(lat2 - lat1) / 2) ** 2
      + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
    km += 2 * R * Math.asin(Math.sqrt(h));
  }
  return km;
}
