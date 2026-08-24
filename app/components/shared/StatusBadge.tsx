import { CircleCheck, Clock3, MapPinOff, PackageCheck, RotateCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { HouseStatus, TerritoryStatus } from '@/app/types';

const territoryStatus = {
  'in-stock': { label: 'Available', Icon: PackageCheck, className: 'border-emerald-700/25 bg-emerald-700/10 text-emerald-800 dark:text-emerald-300' },
  out: { label: 'Assigned', Icon: MapPinOff, className: 'border-blue-700/25 bg-blue-700/10 text-blue-800 dark:text-blue-300' },
  pending: { label: 'Needs review', Icon: Clock3, className: 'border-amber-700/25 bg-amber-700/10 text-amber-800 dark:text-amber-300' },
} satisfies Record<TerritoryStatus, { label: string; Icon: typeof CircleCheck; className: string }>;

const houseStatus = {
  'not-visited': { label: 'Not visited', Icon: MapPinOff },
  nah: { label: 'Not at home', Icon: Clock3 },
  interest: { label: 'Interest', Icon: CircleCheck },
  'return-visit': { label: 'Return visit', Icon: RotateCcw },
  dnc: { label: 'Do not call', Icon: MapPinOff },
} satisfies Record<HouseStatus, { label: string; Icon: typeof CircleCheck }>;

export function TerritoryStatusBadge({ status }: { status: TerritoryStatus }) {
  const item = territoryStatus[status];
  return (
    <Badge variant="outline" className={item.className}>
      <item.Icon aria-hidden="true" /> {item.label}
    </Badge>
  );
}

export function HouseStatusBadge({ status }: { status: HouseStatus }) {
  const item = houseStatus[status];
  return (
    <Badge variant="secondary">
      <item.Icon aria-hidden="true" /> {item.label}
    </Badge>
  );
}
