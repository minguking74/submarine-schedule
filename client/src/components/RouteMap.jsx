import { LAND } from './routeMapLand.js';

// 랜딩 포인트 좌표와 SJC2/E2A 실제 케이블 경로(LINES)는 TeleGeography submarinecablemap.com의
// 공개 API(api/v3/cable/cable-geo.json, api/v3/landing-point/landing-point-geo.json)에서 가져온
// 위경도 데이터입니다. 해안선은 Natural Earth 50m(퍼블릭 도메인) 데이터를 지도 범위로 잘라
// 단순화했습니다. PAE는 위 사이트에 아직 등록되지 않아 랜딩 포인트만 실좌표를 쓰고 구간은 추정입니다.

const OCEAN = '#2b4a6d';
const LAND_FILL = '#7d95b3';
const LAND_STROKE = '#5f7898';
const ROUTE = '#f5a623';

const WIDTH = 780;
const HEIGHT = 460;

// submarinecablemap.com 제공 실제 케이블 경로 (lon,lat), MultiLineString(트렁크+지선) 그대로 사용
const SJC2_LINES = [[[103.987, 1.3895], [104.1921, 1.2765], [104.2879, 1.3279], [104.4566, 1.4684], [104.85, 2.8175], [105.75, 4.0527], [107.1, 4.8378], [108, 5.5101], [110.7, 7.7449], [111.9375, 9.9679], [112.95, 12.6154], [114.525, 17.1085], [114.75, 18.2518], [117, 19.5291], [120.15, 20.2695], [121.05, 20.375], [122.85, 20.9014], [124.875, 22.053], [125.775, 24.1226], [126.225, 25.5519], [126.675, 26.1593], [128.25, 28.3592], [129.6, 28.7545], [131.4, 29.0499], [135, 30.126], [136.8, 30.9014], [138.6, 32.0527], [139.05, 32.4333], [139.725, 33.9396], [140.2312, 34.405], [140.2031, 34.6907], [140.0344, 34.8524], [139.9547, 34.9767]], [[114.75, 18.2518], [114.3, 20.7963], [114.2031, 22.2221]], [[120.15, 20.2695], [120.4875, 21.6353], [120.6621, 22.2492]], [[112.95, 12.6154], [111.6, 13.2732], [110.025, 13.7108], [109.2196, 13.7829]], [[100.5951, 7.1988], [101.7, 7.4103], [103.0488, 7.5631], [105.3, 6.1816], [107.1, 4.8378]], [[138.6, 32.0527], [137.7, 33.0955], [136.874, 34.3368]], [[129.6, 28.7545], [129.375, 30.9014], [129.15, 31.6705], [129.2625, 32.8123], [129.375, 34.3122], [128.9995, 35.1703]], [[128.25, 28.3592], [127.125, 29.5405], [125.775, 30.3205], [124.65, 30.9014], [122.85, 31.2867], [122.175, 31.1424], [121.8961, 30.9357]], [[126.225, 25.5519], [123.75, 25.6533], [122.85, 25.7547], [121.95, 25.6533], [121.4877, 25.1816]]];
// 미국행 구간은 날짜변경선을 지나가는 실좌표라 경도를 +360 해 동쪽으로 이어지게 펼침
const E2A_LINES = [[[121.8014, 24.8635], [122.8783, 25.9255], [129.4464, 28.3812], [135.0547, 28.8184], [137.7945, 29.4872], [143.55, 32.8158], [149.3774, 35.0975], [172.7371, 41.9306], [179.9999, 41.9306]], [[180.0002, 41.9306], [208.8229, 41.9306], [221.1155, 39.4584], [230.3893, 35.7319], [237.1502, 34.6307], [239.1484, 35.3442]], [[139.9755, 35.0054], [140.5354, 34.7352], [142.4634, 32.8828], [142.8307, 32.4062]], [[130.14, 33.5942], [129.9275, 34.2344], [128.9995, 35.1704], [127.2276, 31.0456], [129.4464, 28.3812]], [[141.6032, 42.6503], [142.4699, 41.2388], [144.5591, 40.0464], [149.3774, 35.0975]]];

const CABLE_MAPS = {
  sjc2: {
    subtitle: 'Singapore ↔ Japan · 10,500km · RFS 2025.07',
    bounds: { lonMin: 94, lonMax: 150, latMin: -6, latMax: 47 },
    dashed: false,
    lines: SJC2_LINES,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      changi: { lon: 103.987, lat: 1.389, city: '창이', country: '싱가포르', pos: 'b' },
      songkhla: { lon: 100.5951, lat: 7.1988, city: '송클라', country: '태국', pos: 'l' },
      quynhon: { lon: 109.2197, lat: 13.7830, city: '꾸이년', country: '베트남' },
      chunghomkok: { lon: 114.2030, lat: 22.2220, city: '청함콕', country: '홍콩', pos: 'l' },
      fangshan: { lon: 120.6621, lat: 22.2493, city: '팡산', country: '대만' },
      tanshui: { lon: 121.4626, lat: 25.1814, city: '단수이', country: '대만', pos: 'l' },
      lingang: { lon: 121.8961, lat: 30.9357, city: '린강', country: '중국' },
      busan: { lon: 128.9993, lat: 35.1701, city: '부산', country: '한국', pos: 'b' },
      shima: { lon: 136.8744, lat: 34.3368, city: '시마', country: '일본', pos: 't' },
      chikura: { lon: 139.9547, lat: 34.9767, city: '치쿠라', country: '일본', pos: 'b' },
    },
  },
  e2a: {
    subtitle: 'Asia ↔ US West Coast · 12,500km · RFS 2029(예정)',
    bounds: { lonMin: 114, lonMax: 246, latMin: 12, latMax: 53 },
    dashed: true,
    lines: E2A_LINES,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      toucheng: { lon: 121.8015, lat: 24.8636, city: '터우청', country: '대만' },
      itoshima: { lon: 130.1505, lat: 33.5975, city: '이토시마', country: '일본', pos: 'b' },
      busan: { lon: 128.9993, lat: 35.1701, city: '부산', country: '한국', pos: 't' },
      maruyama: { lon: 139.9755, lat: 35.0054, city: '마루야마', country: '일본' },
      tomakomai: { lon: 141.6032, lat: 42.6361, city: '토마코마이', country: '일본' },
      morrobay: { lon: 239.1528, lat: 35.3667, city: '모로베이', country: '미국', pos: 'l' },
    },
  },
  pae: {
    subtitle: 'Southeast Asia ↔ Japan · RFS 2031(예정)',
    bounds: { lonMin: 94, lonMax: 153, latMin: -6, latMax: 49 },
    dashed: true,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      tuas: { lon: 103.6471, lat: 1.3382, city: '투아스', country: '싱가포르', pos: 'b' },
      quynhon: { lon: 109.2197, lat: 13.7830, city: '꾸이년', country: '베트남' },
      hongkong: { lon: 114.2030, lat: 22.2220, city: '홍콩', country: '', pos: 'l' },
      shantou: { lon: 116.6755, lat: 23.3546, city: '산터우', country: '중국' },
      lingang: { lon: 121.8961, lat: 30.9357, city: '린강', country: '중국' },
      qingdao: { lon: 120.3426, lat: 36.0871, city: '칭다오', country: '중국' },
      busan: { lon: 128.9993, lat: 35.1701, city: '부산', country: '한국' },
      minamiboso: { lon: 139.9610, lat: 34.9741, city: '미나미보소', country: '일본' },
    },
    // 실제 노선 데이터가 아직 공개되지 않아 랜딩 포인트를 순서대로 잇는 추정 구간
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

function ringsPathD(rings, project) {
  return rings.map((ring) => ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + ' Z').join(' ');
}

function linePathD(line, project) {
  return line.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
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
  const { points, edges, lines, bounds, subtitle, dashed, legendPos } = map;
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
        <path d={ringsPathD(LAND[cableKey], project)} fill={LAND_FILL} stroke={LAND_STROKE} strokeWidth={1} />
        {lines
          ? lines.map((line, i) => (
            <path key={i} d={linePathD(line, project)} fill="none"
              stroke={ROUTE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
              strokeDasharray={dashed ? '2 6' : undefined} />
          ))
          : edges.map(([a, b]) => {
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
        {lines
          ? '출처: TeleGeography submarinecablemap.com (랜딩 포인트·노선 좌표). 해안선은 Natural Earth 데이터를 단순화했습니다.'
          : '※ PAE는 submarinecablemap.com에 아직 등록되지 않아, 랜딩 포인트(실좌표)를 순서대로 이은 추정 노선입니다.'}
      </div>
    </div>
  );
}
