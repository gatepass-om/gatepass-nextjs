import { Button } from "@/components/ui/button";

interface PaginationControlsProps {
  noun: string;
  page: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
  onPageChange: (page: number) => void;
}

export function PaginationControls({
  noun,
  page,
  totalPages,
  hasPreviousPage,
  hasNextPage,
  onPageChange,
}: PaginationControlsProps) {
  const visibleTotalPages = Math.max(totalPages, 1);

  return (
    <nav className="flex items-center justify-between gap-3" aria-label={`${noun} pagination`}>
      <p className="text-sm text-muted-foreground">
        Page {page} of {visibleTotalPages}
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Previous ${noun} page`}
          disabled={!hasPreviousPage}
          onClick={() => onPageChange(page - 1)}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Next ${noun} page`}
          disabled={!hasNextPage}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
