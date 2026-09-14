// 랜딩 포인트는 위경도(lon,lat) 실좌표 기준, 해안선은 참고용으로 단순화해 직접 그린 것으로
// 정밀 지도가 아닌 뉴스 기사류 해저케이블 노선도 스타일의 개략도입니다.

// 대륙/섬 윤곽 (위경도, 시계방향 폐곡선). 각 지도의 bounds로 투영해 재사용합니다.
const LANDMASS = {
  asia: [
    [100.3, 1.3], [103.8, 3.0], [104.0, 6.5], [101.0, 6.9], [100.6, 7.2],
    [99.5, 10.5], [100.9, 13.0], [102.6, 12.6], [103.5, 10.6], [104.9, 10.4],
    [106.7, 10.2], [108.9, 11.6], [109.2, 13.8], [108.2, 16.0], [106.5, 20.8],
    [108.5, 21.3], [110.3, 21.0], [113.5, 22.2], [116.7, 23.4], [118.0, 24.5],
    [119.3, 25.9], [120.5, 27.9], [121.9, 30.9], [120.3, 32.2], [119.5, 34.5],
    [120.3, 36.1], [119.0, 37.5], [117.7, 38.8], [121.5, 39.6], [124.0, 40.0],
    [122, 44], [105, 44], [92, 30], [97, 14],
  ],
  korea: [
    [124.3, 39.7], [125.7, 39.0], [127.5, 39.7], [129.4, 41.3], [129.5, 37.5],
    [129.6, 35.9], [129.0, 35.1], [128.6, 34.9], [126.5, 34.5], [126.0, 36.5],
    [125.5, 37.8],
  ],
  kyushu: [
    [129.5, 33.9], [130.0, 34.0], [131.0, 33.3], [131.6, 31.8], [130.6, 31.0],
    [129.8, 32.0], [129.3, 33.2],
  ],
  honshu: [
    [131.5, 34.2], [133.5, 34.2], [135.0, 34.6], [136.8, 34.6], [137.5, 35.0],
    [138.5, 34.7], [139.0, 35.2], [139.9, 35.3], [140.3, 35.7], [140.9, 36.5],
    [141.0, 38.5], [140.0, 40.5], [139.5, 41.5], [138.0, 40.0], [136.5, 37.5],
    [135.5, 35.9], [133.5, 35.5], [132.0, 35.7], [131.0, 34.6],
  ],
  hokkaido: [
    [139.8, 41.5], [140.5, 43.0], [141.5, 43.5], [143.5, 44.5], [145.0, 43.3],
    [144.0, 42.3], [142.0, 41.8], [140.5, 41.6],
  ],
  taiwan: [
    [121.5, 25.3], [122.0, 24.8], [121.8, 23.0], [120.8, 21.9], [120.2, 23.0],
    [120.1, 24.5], [120.9, 25.2],
  ],
  // 미국 서해안은 E2A 지도에서만 사용 (경도를 동쪽으로 연속되게 +360 처리한 값)
  namerica: [
    [235.3, 48.4], [236.0, 44.0], [235.9, 40.4], [237.5, 37.8], [238.1, 36.6],
    [239.2, 35.4], [240.3, 34.4], [241.8, 33.7], [242.8, 32.7], [243.4, 31.8],
    [244.5, 29.0], [250, 32], [245, 45],
  ],
};

const CABLE_MAPS = {
  sjc2: {
    subtitle: 'Singapore ↔ Japan · 10,500km · RFS 2025.07',
    bounds: { lonMin: 98, lonMax: 145, latMin: -3, latMax: 38 },
    landmasses: ['asia', 'korea', 'kyushu', 'honshu', 'taiwan'],
    dashed: false,
    points: {
      sg: { lon: 103.8, lat: 1.3, label: '싱가포르', pos: 'b' },
      th: { lon: 100.6, lat: 7.2, label: '송클라(태국)', dx: -15, dy: -28, anchor: 'end', leader: true },
      kh: { lon: 103.5, lat: 10.6, label: '시아누크빌(캄보디아)', dx: 0, dy: -38, anchor: 'middle', leader: true },
      vn: { lon: 107.1, lat: 10.3, label: '붕따우(베트남)', dx: 35, dy: 15, anchor: 'start', leader: true },
      hk: { lon: 114.1, lat: 22.3, label: '홍콩', pos: 'b' },
      tw: { lon: 121.8, lat: 24.9, label: '터우청(대만)' },
      cn: { lon: 121.5, lat: 31.2, label: '상하이(중국)' },
      kr: { lon: 128.6, lat: 34.9, label: '거제(한국)' },
      jp: { lon: 136.8, lat: 34.5, label: '시마(일본)' },
    },
    edges: [
      ['sg', 'th'], ['th', 'vn'], ['vn', 'kh'], ['kh', 'hk'],
      ['hk', 'tw'], ['tw', 'jp'], ['hk', 'cn'], ['tw', 'kr'],
    ],
  },
  e2a: {
    subtitle: 'Asia ↔ US West Coast · 12,500km · RFS 2028~2029(예정)',
    bounds: { lonMin: 118, lonMax: 242, latMin: 15, latMax: 50 },
    landmasses: ['asia', 'korea', 'kyushu', 'honshu', 'hokkaido', 'taiwan', 'namerica'],
    dashed: true,
    points: {
      tw: { lon: 121.8, lat: 24.9, label: '터우청(대만)' },
      fk: { lon: 130.4, lat: 33.6, label: '이토시마·후쿠오카(일본)', pos: 'b' },
      bs: { lon: 129.0, lat: 35.1, label: '부산(한국)', pos: 't' },
      cb: { lon: 140.1, lat: 35.6, label: '마루야마(일본)' },
      us: { lon: 239.2, lat: 35.4, label: '모로베이(미국)', pos: 'l' },
    },
    edges: [['tw', 'fk'], ['fk', 'bs'], ['bs', 'cb'], ['cb', 'us']],
  },
  pae: {
    subtitle: 'Southeast Asia ↔ Japan · RFS 2031(예정)',
    bounds: { lonMin: 98, lonMax: 148, latMin: -3, latMax: 40 },
    landmasses: ['asia', 'korea', 'kyushu', 'honshu', 'taiwan'],
    dashed: true,
    points: {
      sg: { lon: 103.6, lat: 1.3, label: '투아스(싱가포르)', pos: 'b' },
      vn: { lon: 109.2, lat: 13.8, label: '꾸이년(베트남)' },
      hk: { lon: 114.1, lat: 22.3, label: '홍콩', pos: 'b' },
      st: { lon: 116.7, lat: 23.4, label: '산터우(중국)' },
      lg: { lon: 121.9, lat: 30.9, label: '린강(중국)' },
      qd: { lon: 120.3, lat: 36.1, label: '칭다오(중국)' },
      bs: { lon: 129.0, lat: 35.1, label: '부산(한국)' },
      jp: { lon: 139.9, lat: 35.0, label: '미나미보소(일본)' },
    },
    edges: [
      ['sg', 'vn'], ['vn', 'hk'], ['hk', 'st'],
      ['st', 'lg'], ['lg', 'qd'], ['qd', 'bs'], ['bs', 'jp'],
    ],
  },
};

const WIDTH = 700;
const HEIGHT = 380;
const PAD_X = 40;
const PAD_Y = 30;

function makeProjector(bounds) {
  const { lonMin, lonMax, latMin, latMax } = bounds;
  const sx = (WIDTH - 2 * PAD_X) / (lonMax - lonMin);
  const sy = (HEIGHT - 2 * PAD_Y) / (latMax - latMin);
  return (lon, lat) => [PAD_X + (lon - lonMin) * sx, PAD_Y + (latMax - lat) * sy];
}

function landPathD(coords, project) {
  return coords.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z';
}

function gridLines(bounds, project) {
  const lines = [];
  const lonStart = Math.ceil(bounds.lonMin / 10) * 10;
  for (let lon = lonStart; lon <= bounds.lonMax; lon += 10) {
    const [x1, y1] = project(lon, bounds.latMin);
    const [x2, y2] = project(lon, bounds.latMax);
    lines.push({ key: `lon${lon}`, x1, y1, x2, y2 });
  }
  const latStart = Math.ceil(bounds.latMin / 10) * 10;
  for (let lat = latStart; lat <= bounds.latMax; lat += 10) {
    const [x1, y1] = project(bounds.lonMin, lat);
    const [x2, y2] = project(bounds.lonMax, lat);
    lines.push({ key: `lat${lat}`, x1, y1, x2, y2 });
  }
  return lines;
}

const LABEL_OFFSET = {
  r: { dx: 10, dy: 4, anchor: 'start' },
  l: { dx: -10, dy: 4, anchor: 'end' },
  t: { dx: 0, dy: -10, anchor: 'middle' },
  b: { dx: 0, dy: 19, anchor: 'middle' },
};

export default function RouteMap({ cableKey }) {
  const map = CABLE_MAPS[cableKey];
  if (!map) return null;
  const { points, edges, bounds, landmasses, subtitle, dashed } = map;
  const project = makeProjector(bounds);
  const projPoints = Object.fromEntries(
    Object.entries(points).map(([id, p]) => {
      const [x, y] = project(p.lon, p.lat);
      return [id, { ...p, x, y }];
    }),
  );

  return (
    <div className="card">
      <h3 className="card-title">🗺️ Route Map</h3>
      <div className="page-sub" style={{ marginBottom: 10 }}>{subtitle}</div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ maxHeight: 380 }}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill="var(--bg)" />
        {gridLines(bounds, project).map((l) => (
          <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
            stroke="var(--border)" strokeWidth={1} strokeOpacity={0.4} />
        ))}
        {landmasses.map((key) => (
          <path key={key} d={landPathD(LANDMASS[key], project)}
            fill="var(--panel-2)" stroke="var(--border)" strokeWidth={1} />
        ))}
        {edges.map(([a, b]) => {
          const pa = projPoints[a];
          const pb = projPoints[b];
          return (
            <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke="var(--accent-2)" strokeWidth={2.5} strokeLinecap="round"
              strokeDasharray={dashed ? '2 5' : undefined} />
          );
        })}
        {Object.entries(projPoints).map(([id, p]) => {
          const off = p.dx !== undefined
            ? { dx: p.dx, dy: p.dy, anchor: p.anchor }
            : LABEL_OFFSET[p.pos || 'r'];
          const lx = p.x + off.dx;
          const ly = p.y + off.dy;
          return (
            <g key={id}>
              {p.leader && (
                <line x1={p.x} y1={p.y} x2={lx} y2={ly - 8}
                  stroke="var(--text-dim)" strokeWidth={0.75} strokeOpacity={0.6} />
              )}
              <circle cx={p.x} cy={p.y} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
              <text x={lx} y={ly} textAnchor={off.anchor} fontSize="12" fill="var(--text)">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="page-sub">※ 실제 랜딩 포인트 기준 개략도이며 해안선은 단순화되어 정확한 축척 지도가 아닙니다.</div>
    </div>
  );
}
