export default function Header({ subtitle }) {
  return (
    <header className="page-header">
      <img src="/logo.png" alt="Project PedalWatch" className="shield" />
      <p className="eyebrow">Project PedalWatch – Fixing SF's Biking Infrastructure</p>
      <h1>Issue Report</h1>
      {subtitle && <p className="sub">{subtitle}</p>}
    </header>
  );
}
