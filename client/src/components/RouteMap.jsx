import { LAND } from './routeMapLand.js';

// 랜딩 포인트는 위경도(lon,lat) 실좌표 기준. 해안선은 Natural Earth 50m(퍼블릭 도메인) 데이터를
// 해당 지도 범위로 잘라 단순화한 것으로, 실제 뉴스에 나오는 해저케이블 노선도 스타일을 참고했습니다.

const OCEAN = '#2b4a6d';
const LAND_FILL = '#7d95b3';
const LAND_STROKE = '#5f7898';
const ROUTE = '#f5a623';

const WIDTH = 780;
const HEIGHT = 460;

const CABLE_MAPS = {
  sjc2: {
    subtitle: 'Singapore ↔ Japan · 10,500km · RFS 2025.07',
    bounds: { lonMin: 94, lonMax: 150, latMin: -6, latMax: 47 },
    dashed: false,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      changi: { lon: 103.98, lat: 1.35, city: '창이', country: '싱가포르', pos: 'b' },
      songkhla: { lon: 100.60, lat: 7.20, city: '송클라', country: '태국', pos: 'l' },
      quynhon: { lon: 109.23, lat: 13.78, city: '꾸이년', country: '베트남' },
      chunghomkok: { lon: 114.25, lat: 22.19, city: '청함콕', country: '홍콩', pos: 'l' },
      fangshan: { lon: 120.68, lat: 21.97, city: '팡산', country: '대만' },
      tanshui: { lon: 121.44, lat: 25.17, city: '단수이', country: '대만', pos: 'l' },
      lingang: { lon: 121.90, lat: 30.90, city: '린강', country: '중국' },
      busan: { lon: 129.04, lat: 35.18, city: '부산', country: '한국', pos: 'b' },
      shima: { lon: 136.82, lat: 34.47, city: '시마', country: '일본', pos: 't' },
      chikura: { lon: 139.96, lat: 34.93, city: '치쿠라', country: '일본', pos: 'b' },
    },
    edges: [
      ['changi', 'songkhla'], ['songkhla', 'quynhon'], ['quynhon', 'fangshan'],
      ['fangshan', 'chunghomkok'], ['fangshan', 'tanshui'], ['tanshui', 'lingang'],
      ['tanshui', 'busan'], ['tanshui', 'shima'], ['shima', 'chikura'],
    ],
  },
  e2a: {
    subtitle: 'Asia ↔ US West Coast · 12,500km · RFS 2028~2029(예정)',
    bounds: { lonMin: 114, lonMax: 246, latMin: 12, latMax: 53 },
    dashed: true,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      toucheng: { lon: 121.8, lat: 24.9, city: '터우청', country: '대만' },
      itoshima: { lon: 130.4, lat: 33.6, city: '이토시마', country: '일본', pos: 'b' },
      busan: { lon: 129.0, lat: 35.1, city: '부산', country: '한국', pos: 't' },
      maruyama: { lon: 140.1, lat: 35.6, city: '마루야마', country: '일본' },
      morrobay: { lon: 239.2, lat: 35.4, city: '모로베이', country: '미국', pos: 'l' },
    },
    edges: [
      ['toucheng', 'itoshima'], ['itoshima', 'busan'],
      ['busan', 'maruyama'], ['maruyama', 'morrobay'],
    ],
  },
  pae: {
    subtitle: 'Southeast Asia ↔ Japan · RFS 2031(예정)',
    bounds: { lonMin: 94, lonMax: 153, latMin: -6, latMax: 49 },
    dashed: true,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      tuas: { lon: 103.6, lat: 1.3, city: '투아스', country: '싱가포르', pos: 'b' },
      quynhon: { lon: 109.2, lat: 13.8, city: '꾸이년', country: '베트남' },
      hongkong: { lon: 114.1, lat: 22.3, city: '홍콩', country: '', pos: 'l' },
      shantou: { lon: 116.7, lat: 23.4, city: '산터우', country: '중국' },
      lingang: { lon: 121.9, lat: 30.9, city: '린강', country: '중국' },
      qingdao: { lon: 120.3, lat: 36.1, city: '칭다오', country: '중국' },
      busan: { lon: 129.0, lat: 35.1, city: '부산', country: '한국' },
      minamiboso: { lon: 139.9, lat: 35.0, city: '미나미보소', country: '일본' },
    },
    edges: [
      ['tuas', 'quynhon'], ['quynhon', 'hongkong'], ['hongkong', 'shantou'],
      ['shantou', 'lingang'], ['lingang', 'qingdao'], ['qingdao', 'busan'], ['busan', 'minamiboso'],
    ],
  },
};

function makeProjector(bounds) {
  const { lonMin, lonMax, latMin, latMax } = bounds;
  const sx = WIDTH / (lonMax - lonMin);
  const sy = HEIGHT / (latMax - latMin);
  return (lon, lat) => [(lon - lonMin) * sx, (latMax - lat) * sy];
}

function landPathD(rings, project) {
  return rings.map((ring) => ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z').join(' ');
}

const LABEL_OFFSET = {
  r: { dx: 11, dy: -2, anchor: 'start' },
  l: { dx: -11, dy: -2, anchor: 'end' },
  t: { dx: 0, dy: -14, anchor: 'middle' },
  b: { dx: 0, dy: 22, anchor: 'middle' },
};

export default function RouteMap({ cableKey }) {
  const map = CABLE_MAPS[cableKey];
  if (!map) return null;
  const { points, edges, bounds, subtitle, dashed, legendPos } = map;
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
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ maxHeight: 460, borderRadius: 8, overflow: 'hidden' }}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={OCEAN} />
        <path d={landPathD(LAND[cableKey], project)} fill={LAND_FILL} stroke={LAND_STROKE} strokeWidth={1} />
        {edges.map(([a, b]) => {
          const pa = projPoints[a];
          const pb = projPoints[b];
          return (
            <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke={ROUTE} strokeWidth={3} strokeLinecap="round"
              strokeDasharray={dashed ? '2 6' : undefined} />
          );
        })}
        {Object.entries(projPoints).map(([id, p]) => {
          const off = LABEL_OFFSET[p.pos || 'r'];
          const lx = p.x + off.dx;
          const ly = p.y + off.dy;
          return (
            <g key={id}>
              <circle cx={p.x} cy={p.y} r={6} fill={ROUTE} stroke="#fff" strokeWidth={1.5} />
              <text x={lx} y={ly} textAnchor={off.anchor} fontSize="13" fontWeight="700" fill="#fff">
                {p.city}
              </text>
              {p.country && (
                <text x={lx} y={ly + 14} textAnchor={off.anchor} fontSize="11" fill="#d7e0ec">
                  ({p.country})
                </text>
              )}
            </g>
          );
        })}
        <g transform={`translate(${legendPos.x},${legendPos.y})`}>
          <rect x={0} y={0} width={170} height={46} rx={4} fill="#ffffff" />
          <text x={10} y={20} fontSize="17" fontWeight="800" fill="#1a2436">{cableKey.toUpperCase()}</text>
          <text x={60} y={16} fontSize="10" fill="#6b7280">Submarine</text>
          <text x={60} y={28} fontSize="10" fill="#6b7280">Cable Map</text>
        </g>
      </svg>
      <div className="page-sub" style={{ marginTop: 8 }}>
        ※ 실제 랜딩 포인트 기준 개략도이며 해안선은 단순화되어 정확한 축척 지도가 아닙니다.
      </div>
    </div>
  );
}
