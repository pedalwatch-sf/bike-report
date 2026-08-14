export default function Header({ subtitle }) {
  return (
    <header className="page-header">
      <div className="shield">RT</div>
      <p className="eyebrow">Community infrastructure survey</p>
      <h1>Route Report</h1>
      {subtitle && <p className="sub">{subtitle}</p>}
    </header>
  );
}
