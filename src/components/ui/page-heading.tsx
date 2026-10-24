import type { ReactNode } from "react";
export function PageHeading({
  title,
  subtitle,
  action,
  eyebrow = "A THOUGHTFUL START TO EVERY PROPOSAL",
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
