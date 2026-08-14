export default function Header({ subtitle }) {
  return (
    <header className="page-header">
      <div className="shield">RT</div>
      <p className="eyebrow">Fixing SF's Biking Infrastructure</p>
      <h1>Route Report</h1>
      {subtitle && <p className="sub">{subtitle}</p>}
    </header>
  );
}
