import Link from "next/link";
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="NordStone home">
      <span className="brand-mark nordstone-mark">N</span>
      <span>
        Nord<span className="brand-light">Stone</span>
        <small>PROPOSAL ASSISTANT</small>
      </span>
    </Link>
  );
}
