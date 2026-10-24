import { Icon } from "./icon";
export function CardHeader({
  title,
  subtitle,
  label,
}: {
  title: string;
  subtitle: string;
  label?: string;
}) {
  return (
    <div className="card-head">
      <span className="section-icon">
        <Icon name="file" />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
      {label && <span className="small-label">{label}</span>}
    </div>
  );
}
