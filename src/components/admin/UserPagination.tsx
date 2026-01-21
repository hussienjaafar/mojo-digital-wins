import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { V3Button } from "@/components/v3/V3Button";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface UserPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100];

export function UserPagination({
  currentPage,
  totalPages,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
}: UserPaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
      {/* Items info and page size selector */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Showing {startItem}-{endItem} of {totalCount}
        </span>
        <div className="flex items-center gap-2">
          <span>Per page:</span>
          <Select value={pageSize.toString()} onValueChange={(v) => onPageSizeChange(parseInt(v))}>
            <SelectTrigger className="w-[70px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center gap-1">
        <V3Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </V3Button>
        <V3Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </V3Button>
        
        <div className="flex items-center gap-1 px-2">
          {generatePageNumbers(currentPage, totalPages).map((page, i) => (
            page === "..." ? (
              <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">...</span>
            ) : (
              <V3Button
                key={page}
                variant={currentPage === page ? "primary" : "outline"}
                size="sm"
                onClick={() => onPageChange(page as number)}
                className="min-w-[32px]"
              >
                {page}
              </V3Button>
            )
          ))}
        </div>

        <V3Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </V3Button>
        <V3Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </V3Button>
      </div>
    </div>
  );
}

function generatePageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  if (current <= 3) {
    return [1, 2, 3, 4, 5, "...", total];
  }

  if (current >= total - 2) {
    return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  }

  return [1, "...", current - 1, current, current + 1, "...", total];
}
