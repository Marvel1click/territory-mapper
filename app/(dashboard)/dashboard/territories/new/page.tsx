import { PageHeader } from '@/app/components/shared/PageHeader';
import { TerritoryEditorForm } from '@/app/components/territory/TerritoryEditorForm';

export default function NewTerritoryPage() {
  return <div className="space-y-7"><PageHeader eyebrow="New territory" title="Define a clear field boundary." description="Name the territory and draw its working area. Houses can be added or imported after creation." /><TerritoryEditorForm /></div>;
}
