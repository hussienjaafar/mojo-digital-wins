import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Mobile-optimized table component that converts to stacked cards on small screens
 * while maintaining traditional table layout on larger screens.
 */

interface MobileTableProps extends React.HTMLAttributes<HTMLDivElement> {
  headers: string[];
  data: React.ReactNode[][];
  mobileCardRender?: (row: React.ReactNode[], index: number) => React.ReactNode;
}

export function MobileTable({ 
  headers, 
  data, 
  mobileCardRender,
  className,
  ...props 
}: MobileTableProps) {
  return (
    <>
      {/* Desktop Table View */}
      <div className={cn("hidden md:block relative w-full overflow-auto", className)} {...props}>
        <table className="w-full caption-bottom text-sm">
          <thead className="[&_tr]:border-b">
            <tr className="border-b transition-colors hover:bg-muted/50">
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-0">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="border-b transition-colors hover:bg-muted/50"
              >
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="p-4 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {data.map((row, index) => (
          <Card key={index} className="overflow-hidden">
            <CardContent className="p-4">
              {mobileCardRender ? (
                mobileCardRender(row, index)
              ) : (
                <div className="space-y-2">
                  {row.map((cell, cellIndex) => (
                    <div key={cellIndex} className="flex justify-between items-start gap-3">
                      <span className="text-sm font-medium text-muted-foreground min-w-[100px]">
                        {headers[cellIndex]}:
                      </span>
                      <div className="text-sm text-right flex-1">{cell}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

export { MobileTable as ResponsiveTable };
