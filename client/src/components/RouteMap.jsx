import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { LAND } from './routeMapLand.js';
import { SJC2_SEGMENTS, findCablePath, pathLengthKm } from './routeMapSegments.js';

// 랜딩 포인트 좌표와 SJC2/E2A 실제 케이블 경로(LINES)는 TeleGeography submarinecablemap.com의
// 공개 API(api/v3/cable/cable-geo.json, api/v3/landing-point/landing-point-geo.json)에서 가져온
// 위경도 데이터입니다. 해안선은 Natural Earth 50m(퍼블릭 도메인) 데이터를 지도 범위로 잘라
// 단순화했습니다. PAE는 위 사이트에 아직 등록되지 않아 랜딩 포인트만 실좌표를 쓰고 구간은 추정입니다.

const OCEAN = '#2b4a6d';
const LAND_FILL = '#7d95b3';
const LAND_STROKE = '#5f7898';
const ROUTE = '#f5a623';
const ROUTE_DIM = '#b98a3c';
const HIGHLIGHT = '#ffe45c';

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
    segments: SJC2_SEGMENTS,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      changi: { lon: 103.987, lat: 1.389, city: 'Changi', country: 'Singapore', pos: 'b' },
      songkhla: { lon: 100.5951, lat: 7.1988, city: 'Songkhla', country: 'Thailand', pos: 'l' },
      quynhon: { lon: 109.2197, lat: 13.7830, city: 'Quy Nhon', country: 'Vietnam' },
      chunghomkok: { lon: 114.2030, lat: 22.2220, city: 'Chung Hom Kok', country: 'Hong Kong', pos: 'l' },
      fangshan: { lon: 120.6621, lat: 22.2493, city: 'Fangshan', country: 'Taiwan' },
      tanshui: { lon: 121.4626, lat: 25.1814, city: 'Tanshui', country: 'Taiwan', pos: 'l' },
      lingang: { lon: 121.8961, lat: 30.9357, city: 'Lingang', country: 'China' },
      busan: { lon: 128.9993, lat: 35.1701, city: 'Busan', country: 'Korea', pos: 'b' },
      shima: { lon: 136.8744, lat: 34.3368, city: 'Shima', country: 'Japan', pos: 't' },
      chikura: { lon: 139.9547, lat: 34.9767, city: 'Chikura', country: 'Japan', pos: 'b' },
    },
  },
  e2a: {
    subtitle: 'Asia ↔ US West Coast · 12,500km · RFS 2029 (Planned)',
    bounds: { lonMin: 114, lonMax: 246, latMin: 12, latMax: 53 },
    dashed: true,
    lines: E2A_LINES,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      toucheng: { lon: 121.8015, lat: 24.8636, city: 'Toucheng', country: 'Taiwan' },
      itoshima: { lon: 130.1505, lat: 33.5975, city: 'Itoshima', country: 'Japan', pos: 'b' },
      busan: { lon: 128.9993, lat: 35.1701, city: 'Busan', country: 'Korea', pos: 't' },
      maruyama: { lon: 139.9755, lat: 35.0054, city: 'Maruyama', country: 'Japan' },
      tomakomai: { lon: 141.6032, lat: 42.6361, city: 'Tomakomai', country: 'Japan' },
      morrobay: { lon: 239.1528, lat: 35.3667, city: 'Morro Bay', country: 'USA', pos: 'l' },
    },
  },
  pae: {
    subtitle: 'Southeast Asia ↔ Japan · RFS: To be confirmed',
    bounds: { lonMin: 94, lonMax: 153, latMin: -6, latMax: 49 },
    dashed: true,
    legendPos: { x: WIDTH - 190, y: 20 },
    points: {
      tuas: { lon: 103.6471, lat: 1.3382, city: 'Tuas', country: 'Singapore', pos: 'b' },
      quynhon: { lon: 109.2197, lat: 13.7830, city: 'Quy Nhon', country: 'Vietnam' },
      hongkong: { lon: 114.2030, lat: 22.2220, city: 'Hong Kong', country: '', pos: 'l' },
      shantou: { lon: 116.6755, lat: 23.3546, city: 'Shantou', country: 'China' },
      lingang: { lon: 121.8961, lat: 30.9357, city: 'Lingang', country: 'China' },
      qingdao: { lon: 120.3426, lat: 36.0871, city: 'Qingdao', country: 'China' },
      busan: { lon: 128.9993, lat: 35.1701, city: 'Busan', country: 'Korea' },
      minamiboso: { lon: 139.9610, lat: 34.9741, city: 'Minamiboso', country: 'Japan' },
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

const fmtNum = (v, digits = 0) => (v == null || Number.isNaN(v) ? '-' : Number(v).toLocaleString(undefined, { maximumFractionDigits: digits }));

function SegmentInfo({ segment, points, km, stats, contracts, loadError }) {
  const a = points[segment.a];
  const z = points[segment.z];
  const mine = contracts ? contracts.filter((c) => c.segment_s === segment.id) : null;
  const active = mine ? mine.filter((c) => c.status === 'Active') : [];
  const monthlyUsd = active.reduce((s, c) => s + (c.monthly_total_usd || 0), 0);
  const lit = stats ? stats.equip100 + stats.equip400 : null;
  const utilPct = stats && lit > 0 ? (stats.sold_total / lit) * 100 : null;

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 17, fontWeight: 700 }}>{segment.label}</span>
        <span className="badge badge-blue">{segment.id}</span>
        <span className="page-sub" style={{ marginTop: 0 }}>
          {a.city} ({a.country}) ↔ {z.city} ({z.country}) · 지도 경로 기준 약 {fmtNum(Math.round(km / 10) * 10)}km
        </span>
      </div>

      {loadError && <div className="error-box" style={{ padding: 10 }}>{loadError}</div>}

      <div className="kpi-grid">
        <div className="kpi-tile">
          <div className="kpi-label">Design Capacity</div>
          <div className="kpi-value">{fmtNum(stats?.design)}<span className="kpi-unit">Gbps</span></div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">점등 (설치완료) / 구축중</div>
          <div className="kpi-value">
            {fmtNum(lit)}<span className="kpi-unit">/ {fmtNum(stats ? stats.construct100 + stats.construct400 : null)} Gbps</span>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">판매 (Sold) · 점등 대비</div>
          <div className="kpi-value">
            {fmtNum(stats?.sold_total)}<span className="kpi-unit">Gbps · {utilPct == null ? '-' : `${fmtNum(utilPct, 1)}%`}</span>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">판매 가능 (Avail)</div>
          <div className="kpi-value" style={stats?.avail_total < 0 ? { color: 'var(--danger)' } : undefined}>
            {fmtNum(stats?.avail_total)}<span className="kpi-unit">Gbps</span>
          </div>
        </div>
        <div className="kpi-tile">
          <div className="kpi-label">Active 계약 월 매출</div>
          <div className="kpi-value">${fmtNum(monthlyUsd)}<span className="kpi-unit">USD · {active.length}건</span></div>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>고객사</th>
              <th>유형</th>
              <th>A End</th>
              <th>Z End</th>
              <th>Bandwidth (Gbps)</th>
              <th>기간</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {!mine && <tr><td colSpan={7} className="empty-row">불러오는 중...</td></tr>}
            {mine && mine.length === 0 && <tr><td colSpan={7} className="empty-row">이 구간의 계약이 없습니다</td></tr>}
            {mine && mine.map((c) => (
              <tr key={c.id}>
                <td>{c.customer}</td>
                <td>{c.contract_type}</td>
                <td>{c.a_end}</td>
                <td>{c.z_end}</td>
                <td>{fmtNum(c.bandwidth)}</td>
                <td>{c.start_date ? `${c.start_date} ~ ${c.end_date || ''}` : '-'}</td>
                <td>
                  <span className={`badge ${c.status === 'Active' ? 'badge-green' : 'badge-gray'}`}>{c.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function RouteMap({ cableKey }) {
  const map = CABLE_MAPS[cableKey];
  const [selectedId, setSelectedId] = useState(null);
  const [pendingPoint, setPendingPoint] = useState(null);
  const [segData, setSegData] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { setSelectedId(null); setPendingPoint(null); }, [cableKey]);

  // 구간을 처음 선택할 때 한 번만 용량·계약 데이터를 불러옴
  useEffect(() => {
    if (!selectedId || segData) return;
    Promise.all([api.get('/dashboard'), api.get('/contracts')])
      .then(([dash, contracts]) => setSegData({ rows: dash.segment_s.rows, contracts }))
      .catch((e) => {
        setLoadError(e.serverMessage || '구간 데이터를 불러오지 못했습니다');
        setSegData({ rows: [], contracts: [] });
      });
  }, [selectedId, segData]);

  const segments = map?.segments;
  const selected = segments?.find((s) => s.id === selectedId) || null;
  const selectedPath = useMemo(
    () => (selected ? findCablePath(map.lines, map.points[selected.a], map.points[selected.z]) : []),
    [map, selected],
  );

  if (!map) return null;
  const { points, edges, lines, bounds, subtitle, dashed, legendPos } = map;
  const project = makeProjector(bounds);
  const projPoints = Object.fromEntries(
    Object.entries(points).map(([id, p]) => {
      const [x, y] = project(p.lon, p.lat);
      return [id, { ...p, x, y }];
    }),
  );
  const endpointIds = new Set(segments ? segments.flatMap((s) => [s.a, s.z]) : []);

  function selectSegment(id) {
    setPendingPoint(null);
    setSelectedId((cur) => (cur === id ? null : id));
  }

  // 랜딩 포인트 두 곳을 차례로 누르면 그 사이 구간을 선택
  function clickPoint(id) {
    if (!endpointIds.has(id)) return;
    if (!pendingPoint || pendingPoint === id) {
      setPendingPoint(pendingPoint === id ? null : id);
      return;
    }
    const seg = segments.find((s) => (s.a === pendingPoint && s.z === id) || (s.a === id && s.z === pendingPoint));
    if (seg) {
      setSelectedId(seg.id);
      setPendingPoint(null);
    } else {
      setPendingPoint(id);
    }
  }

  const routeColor = selected ? ROUTE_DIM : ROUTE;

  return (
    <div className="card">
      <h3 className="card-title">🗺️ Route Map</h3>
      <div className="page-sub" style={{ marginBottom: 10 }}>{subtitle}</div>
      {segments && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
          <span className="page-sub" style={{ marginTop: 0, marginRight: 4 }}>서비스 구간</span>
          {segments.map((s) => (
            <button key={s.id} type="button"
              className={`cable-pill${s.id === selectedId ? ' active' : ''}`}
              style={{ flex: 'none', padding: '5px 12px' }}
              onClick={() => selectSegment(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width="100%" style={{ maxHeight: 460, borderRadius: 8, overflow: 'hidden' }}>
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} fill={OCEAN}
          onClick={() => setPendingPoint(null)} />
        <path d={ringsPathD(LAND[cableKey], project)} fill={LAND_FILL} stroke={LAND_STROKE} strokeWidth={1}
          onClick={() => setPendingPoint(null)} />
        {lines
          ? lines.map((line, i) => (
            <path key={i} d={linePathD(line, project)} fill="none"
              stroke={routeColor} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
              strokeOpacity={selected ? 0.55 : 1}
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
        {selectedPath.length > 1 && (
          <g pointerEvents="none">
            <path d={linePathD(selectedPath, project)} fill="none" stroke={HIGHLIGHT} strokeOpacity={0.3}
              strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
            <path d={linePathD(selectedPath, project)} fill="none" stroke={HIGHLIGHT}
              strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
        {Object.entries(projPoints).map(([id, p]) => {
          const off = LABEL_OFFSET[p.pos || 'r'];
          const lx = p.x + off.dx;
          const ly = p.y + off.dy;
          const clickable = endpointIds.has(id);
          const isEnd = selected && (selected.a === id || selected.z === id);
          return (
            <g key={id} onClick={() => clickPoint(id)} style={clickable ? { cursor: 'pointer' } : undefined}>
              {clickable && <circle cx={p.x} cy={p.y} r={16} fill="transparent" />}
              {pendingPoint === id && (
                <circle cx={p.x} cy={p.y} r={11} fill="none" stroke={HIGHLIGHT} strokeWidth={2} strokeDasharray="3 3" />
              )}
              <circle cx={p.x} cy={p.y} r={isEnd ? 8 : 6} fill={isEnd ? HIGHLIGHT : ROUTE} stroke="#fff" strokeWidth={1.5} />
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
        <g transform={`translate(${legendPos.x},${legendPos.y})`} pointerEvents="none">
          <rect x={0} y={0} width={170} height={46} rx={4} fill="#ffffff" />
          <text x={10} y={20} fontSize="17" fontWeight="800" fill="#1a2436">{cableKey.toUpperCase()}</text>
          <text x={60} y={16} fontSize="10" fill="#6b7280">Submarine</text>
          <text x={60} y={28} fontSize="10" fill="#6b7280">Cable Map</text>
        </g>
      </svg>
      <div className="page-sub" style={{ marginTop: 8 }}>
        {segments && !selected && (
          <>
            {pendingPoint
              ? `${points[pendingPoint].city}에서 이어질 반대편 랜딩 포인트를 누르세요.`
              : '구간 버튼을 누르거나, 지도에서 랜딩 포인트 두 곳을 차례로 누르면 그 구간 정보를 볼 수 있습니다.'}
            <br />
          </>
        )}
        {lines
          ? '출처: TeleGeography submarinecablemap.com (랜딩 포인트·노선 좌표). 해안선은 Natural Earth 데이터를 단순화했습니다.'
          : 'Route: To be confirmed — PAE is not yet listed on submarinecablemap.com. Landing points are approximate.'}
      </div>
      {selected && (
        <SegmentInfo
          segment={selected}
          points={points}
          km={pathLengthKm(selectedPath)}
          stats={segData?.rows.find((r) => r.segment_id === selected.id)}
          contracts={segData?.contracts}
          loadError={loadError}
        />
      )}
    </div>
  );
}
