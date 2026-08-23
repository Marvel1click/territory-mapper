import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PageHeader } from '@/app/components/shared/PageHeader';
import { HouseStatusBadge, TerritoryStatusBadge } from '@/app/components/shared/StatusBadge';

describe('accessible status components', () => {
  it('renders a single clear page heading and description', () => {
    render(<PageHeader title="Territories" description="Review current field areas." />);
    expect(screen.getByRole('heading', { level: 1, name: 'Territories' })).toBeInTheDocument();
    expect(screen.getByText('Review current field areas.')).toBeInTheDocument();
  });

  it('labels statuses in text rather than relying on color', () => {
    render(<><TerritoryStatusBadge status="out" /><HouseStatusBadge status="return-visit" /></>);
    expect(screen.getByText('Assigned')).toBeVisible();
    expect(screen.getByText('Return visit')).toBeVisible();
  });
});
