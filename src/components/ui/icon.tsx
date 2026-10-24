import {
  PanelsTopLeft,
  Layers,
  ChartNoAxesCombined,
  Settings2,
  ShieldCheck,
  ChevronsUpDown,
  CircleHelp,
  LockKeyhole,
  Plus,
  ArrowRight,
  Link2,
  FileText,
  Check,
  Clock3,
  Copy,
  ArrowLeft,
  RotateCcw,
  ExternalLink,
  House,
  BookOpen,
  LogOut,
} from "lucide-react";
const icons = {
  desk: PanelsTopLeft,
  layers: Layers,
  chart: ChartNoAxesCombined,
  settings: Settings2,
  shield: ShieldCheck,
  chevrons: ChevronsUpDown,
  help: CircleHelp,
  lock: LockKeyhole,
  plus: Plus,
  arrow: ArrowRight,
  link: Link2,
  file: FileText,
  check: Check,
  clock: Clock3,
  copy: Copy,
  back: ArrowLeft,
  reset: RotateCcw,
  external: ExternalLink,
  home: House,
  book: BookOpen,
  logout: LogOut,
};
export type IconName = keyof typeof icons;
export function Icon({ name }: { name: IconName }) {
  const Component = icons[name];
  return (
    <i data-icon={name} aria-hidden="true">
      <Component strokeWidth={1.5} />
    </i>
  );
}
