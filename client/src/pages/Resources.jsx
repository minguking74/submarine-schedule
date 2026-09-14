const LINKS = [
  {
    icon: '🗺️',
    title: 'Submarine Cable Map',
    url: 'https://www.submarinecablemap.com/',
    desc: '전세계 해저케이블 노선과 랜딩 포인트를 지도 형태로 보여주는 TeleGeography의 무료 참고 사이트입니다. 신규/경쟁 케이블의 구간과 준공 시기를 확인할 때 참고하세요.',
  },
  {
    icon: '📰',
    title: 'Sub Telecom Forum (subtelforum.com)',
    url: 'https://subtelforum.com/',
    desc: '해저케이블 업계 뉴스, 시장 리포트, 컨퍼런스 정보를 제공하는 산업 전문 매체입니다. 업계 동향과 신규 프로젝트 발표를 확인할 때 참고하세요.',
  },
];

export default function Resources() {
  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">🔗 외부 참고 자료</h1>
          <div className="page-sub">해저케이블 업계 정보를 제공하는 외부 사이트 모음입니다</div>
        </div>
      </div>

      <div className="grid-3">
        {LINKS.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="card resource-card">
            <h3 className="card-title">{l.icon} {l.title}</h3>
            <p className="page-sub" style={{ lineHeight: 1.6 }}>{l.desc}</p>
            <div className="resource-link">{l.url} ↗</div>
          </a>
        ))}
      </div>
    </div>
  );
}
