// 실제 랜딩 포인트 순서를 바탕으로 한 개략도(축척 아님)
const CABLE_MAPS = {
  sjc2: {
    subtitle: 'Singapore ↔ Japan · 10,500km · RFS 2025.07',
    viewBox: '0 0 700 380',
    regions: [
      { x: 55, y: 205, w: 185, h: 145, label: '동남아시아' },
      { x: 260, y: 70, w: 150, h: 105, label: '중화권' },
    ],
    points: {
      sg: { x: 128, y: 330, label: '싱가포르', pos: 'b' },
      th: { x: 72, y: 275, label: '송클라(태국)', pos: 'l' },
      kh: { x: 160, y: 292, label: '시아누크빌(캄보디아)', pos: 'r' },
      vn: { x: 148, y: 228, label: '붕따우(베트남)', pos: 't' },
      hk: { x: 280, y: 155, label: '홍콩' },
      tw: { x: 390, y: 136, label: '터우청(대만)' },
      cn: { x: 386, y: 90, label: '상하이(중국)' },
      kr: { x: 487, y: 63, label: '거제(한국)' },
      jp: { x: 605, y: 66, label: '시마(일본)' },
    },
    edges: [
      ['sg', 'th'], ['th', 'vn'], ['vn', 'kh'], ['kh', 'hk'],
      ['hk', 'tw'], ['tw', 'jp'], ['hk', 'cn'], ['tw', 'kr'],
    ],
  },
  e2a: {
    subtitle: 'Asia ↔ US West Coast · 12,500km · RFS 2028~2029(예정)',
    viewBox: '0 0 700 380',
    regions: [
      { x: 48, y: 143, w: 129, h: 132, label: '동아시아' },
    ],
    points: {
      tw: { x: 68, y: 255, label: '터우청(대만)' },
      fk: { x: 110, y: 200, label: '후쿠오카(일본)', pos: 'b' },
      bs: { x: 95, y: 150, label: '부산(한국)', pos: 't' },
      cb: { x: 170, y: 170, label: '마루야마·이토시마(일본)' },
      us: { x: 637, y: 165, label: '모로베이(미국)' },
    },
    edges: [['tw', 'fk'], ['fk', 'bs'], ['bs', 'cb'], ['cb', 'us']],
  },
  pae: {
    subtitle: 'Southeast Asia ↔ Japan · RFS 2031(예정)',
    viewBox: '0 0 700 380',
    regions: [
      { x: 103, y: 203, w: 113, h: 127, label: '동남아시아' },
      { x: 240, y: 47, w: 142, h: 137, label: '중국·홍콩' },
    ],
    points: {
      sg: { x: 123, y: 310, label: '투아스(싱가포르)' },
      vn: { x: 196, y: 223, label: '꾸이년(베트남)' },
      hk: { x: 260, y: 164, label: '홍콩' },
      st: { x: 294, y: 156, label: '산터우(중국)' },
      lg: { x: 362, y: 104, label: '린강(중국)' },
      qd: { x: 341, y: 67, label: '칭다오(중국)' },
      bs: { x: 454, y: 74, label: '부산(한국)' },
      jp: { x: 597, y: 75, label: '미나미보소(일본)' },
    },
    edges: [
      ['sg', 'vn'], ['vn', 'hk'], ['hk', 'st'],
      ['st', 'lg'], ['lg', 'qd'], ['qd', 'bs'], ['bs', 'jp'],
    ],
  },
};

const LABEL_OFFSET = {
  r: { dx: 10, dy: 4, anchor: 'start' },
  l: { dx: -10, dy: 4, anchor: 'end' },
  t: { dx: 0, dy: -10, anchor: 'middle' },
  b: { dx: 0, dy: 19, anchor: 'middle' },
};

export default function RouteMap({ cableKey }) {
  const map = CABLE_MAPS[cableKey];
  if (!map) return null;
  const { points, edges, regions, viewBox, subtitle } = map;

  return (
    <div className="card">
      <h3 className="card-title">🗺️ Route Map</h3>
      <div className="page-sub" style={{ marginBottom: 10 }}>{subtitle}</div>
      <svg viewBox={viewBox} width="100%" style={{ maxHeight: 380 }}>
        {regions.map((r) => (
          <g key={r.label}>
            <rect x={r.x} y={r.y} width={r.w} height={r.h} rx={16}
              fill="var(--panel-2)" fillOpacity={0.55} stroke="var(--border)" />
            <text x={r.x + 12} y={r.y + 22} fontSize="12" fontWeight="700" fill="var(--text-dim)">
              {r.label}
            </text>
          </g>
        ))}
        {edges.map(([a, b]) => {
          const pa = points[a];
          const pb = points[b];
          return (
            <line key={`${a}-${b}`} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
              stroke="var(--accent-2)" strokeWidth={2.5} strokeLinecap="round" />
          );
        })}
        {Object.entries(points).map(([id, p]) => {
          const off = LABEL_OFFSET[p.pos || 'r'];
          return (
            <g key={id}>
              <circle cx={p.x} cy={p.y} r={5.5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
              <text x={p.x + off.dx} y={p.y + off.dy} textAnchor={off.anchor} fontSize="12" fill="var(--text)">
                {p.label}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="page-sub">※ 실제 랜딩 포인트 기준 개략도이며 정확한 축척 지도가 아닙니다.</div>
    </div>
  );
}
