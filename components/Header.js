export default function Header({ subtitle }) {
  return (
    <header className="page-header">
      <div className="shield">SF</div>
      <p className="eyebrow">Fixing SF's Biking Infrastructure</p>
      <h1>Issue Report</h1>
      {subtitle && <p className="sub">{subtitle}</p>}
    </header>
  );
}
