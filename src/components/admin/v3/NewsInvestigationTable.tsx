import { useState, useRef, useMemo, useCallback } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  useReactTable,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow, parseISO } from "date-fns";
import { 
  ChevronUp, ChevronDown, Filter, Columns, Download, 
  ExternalLink, Search, RefreshCw, X, AlertTriangle,
  Newspaper, Clock, Globe
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { DataFreshnessIndicator } from "./DataFreshnessIndicator";

interface Article {
  id: string;
  title: string;
  description: string | null;
  source_name: string;
  source_url: string;
  published_date: string;
  sentiment_label: string | null;
  sentiment_score: number | null;
  threat_level: string | null;
  tags: string[] | null;
  category: string | null;
  processing_status: string | null;
  ai_summary: string | null;
  created_at: string | null;
  source_type?: string; // 'rss' or 'google' - from the view
}

const PAGE_SIZE = 50;

const threatLevelColors: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/30" },
  high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30" },
  medium: { bg: "bg-yellow-500/10", text: "text-yellow-400", border: "border-yellow-500/30" },
  low: { bg: "bg-green-500/10", text: "text-green-400", border: "border-green-500/30" },
};

const sentimentColors: Record<string, { bg: string; text: string }> = {
  positive: { bg: "bg-emerald-500/10", text: "text-emerald-400" },
  negative: { bg: "bg-rose-500/10", text: "text-rose-400" },
  neutral: { bg: "bg-slate-500/10", text: "text-slate-400" },
};

const columnHelper = createColumnHelper<Article>();

export function NewsInvestigationTable() {
  const [sorting, setSorting] = useState<SortingState>([
    { id: "published_date", desc: true }
  ]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [globalFilter, setGlobalFilter] = useState("");
  const [threatFilter, setThreatFilter] = useState<string>("all");
  const [sentimentFilter, setSentimentFilter] = useState<string>("all");
  const [includeGoogleNews, setIncludeGoogleNews] = useState<boolean>(true);
  
  const parentRef = useRef<HTMLDivElement>(null);

  // Fetch articles with infinite scroll
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    dataUpdatedAt,
  } = useInfiniteQuery({
    queryKey: ["articles-investigation", threatFilter, sentimentFilter, globalFilter, includeGoogleNews],
    queryFn: async ({ pageParam = 0 }): Promise<{ articles: Article[]; nextPage: number | undefined }> => {
      const selectColumns = "id, title, description, source_name, source_url, published_date, sentiment_label, sentiment_score, threat_level, tags, category, processing_status, ai_summary, created_at, source_type";
      
      // Use the unified view when Google News is included, otherwise just articles
      if (includeGoogleNews) {
        // Query the unified view that includes both RSS articles and Google News
        const { data, error } = await supabase
          .from("news_investigation_view")
          .select(selectColumns)
          .order("published_date", { ascending: false })
          .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1)
          .then(result => {
            // Apply filters in memory since view doesn't support all filter types
            if (!result.error && result.data) {
              let filtered = result.data;
              if (threatFilter !== "all") {
                filtered = filtered.filter(a => a.threat_level === threatFilter);
              }
              if (sentimentFilter !== "all") {
                filtered = filtered.filter(a => a.sentiment_label === sentimentFilter);
              }
              if (globalFilter) {
                const lowerFilter = globalFilter.toLowerCase();
                filtered = filtered.filter(a => a.title?.toLowerCase().includes(lowerFilter));
              }
              return { data: filtered, error: null };
            }
            return result;
          });
        
        if (error) throw error;
        
        return {
          articles: (data || []) as Article[],
          nextPage: data?.length === PAGE_SIZE ? pageParam + 1 : undefined,
        };
      } else {
        // Query only the articles table (RSS sources)
        let query = supabase
          .from("articles")
          .select("id, title, description, source_name, source_url, published_date, sentiment_label, sentiment_score, threat_level, tags, category, processing_status, ai_summary, created_at")
          .order("published_date", { ascending: false })
          .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);
        
        if (threatFilter !== "all") {
          query = query.eq("threat_level", threatFilter);
        }
        if (sentimentFilter !== "all") {
          query = query.eq("sentiment_label", sentimentFilter);
        }
        if (globalFilter) {
          query = query.ilike("title", `%${globalFilter}%`);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        return {
          articles: (data || []).map(a => ({ ...a, source_type: 'rss' })) as Article[],
          nextPage: data?.length === PAGE_SIZE ? pageParam + 1 : undefined,
        };
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    staleTime: 60000,
  });

  const allArticles = useMemo(
    () => data?.pages.flatMap((p) => p.articles) ?? [],
    [data]
  );

  const columns = useMemo(() => [
    columnHelper.accessor("published_date", {
      header: "Published",
      cell: (info) => (
        <div className="flex items-center gap-1 text-muted-foreground text-sm whitespace-nowrap">
          <Clock className="h-3 w-3" />
          {formatDistanceToNow(parseISO(info.getValue()), { addSuffix: true })}
        </div>
      ),
      size: 140,
    }),
    columnHelper.accessor("title", {
      header: "Headline",
      cell: (info) => (
        <div className="space-y-1">
          <a
            href={info.row.original.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground hover:text-primary line-clamp-2 transition-colors"
          >
            {info.getValue()}
          </a>
          {info.row.original.ai_summary && (
            <p className="text-xs text-muted-foreground line-clamp-1">
              {info.row.original.ai_summary}
            </p>
          )}
        </div>
      ),
      size: 400,
    }),
    columnHelper.accessor("source_name", {
      header: "Source",
      cell: (info) => (
        <Badge variant="outline" className="font-normal">
          {info.getValue()}
        </Badge>
      ),
      size: 140,
    }),
    columnHelper.accessor("threat_level", {
      header: "Threat",
      cell: (info) => {
        const level = info.getValue();
        if (!level) return <span className="text-muted-foreground">—</span>;
        const colors = threatLevelColors[level] || threatLevelColors.low;
        return (
          <Badge 
            variant="outline" 
            className={cn("capitalize", colors.bg, colors.text, colors.border)}
          >
            {level === "critical" && <AlertTriangle className="h-3 w-3 mr-1" />}
            {level}
          </Badge>
        );
      },
      size: 100,
    }),
    columnHelper.accessor("sentiment_label", {
      header: "Sentiment",
      cell: (info) => {
        const sentiment = info.getValue();
        if (!sentiment) return <span className="text-muted-foreground">—</span>;
        const colors = sentimentColors[sentiment] || sentimentColors.neutral;
        return (
          <Badge 
            variant="outline" 
            className={cn("capitalize", colors.bg, colors.text)}
          >
            {sentiment}
          </Badge>
        );
      },
      size: 100,
    }),
    columnHelper.accessor("tags", {
      header: "Topics",
      cell: (info) => {
        const tags = info.getValue();
        if (!tags || tags.length === 0) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex gap-1 flex-wrap max-w-[200px]">
            {tags.slice(0, 3).map((tag) => (
              <Badge 
                key={tag} 
                variant="secondary" 
                className="text-xs font-normal"
              >
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="secondary" className="text-xs font-normal">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        );
      },
      size: 200,
    }),
    columnHelper.accessor("category", {
      header: "Category",
      cell: (info) => {
        const category = info.getValue();
        if (!category) return <span className="text-muted-foreground">—</span>;
        return <span className="text-sm capitalize">{category}</span>;
      },
      size: 120,
    }),
    columnHelper.display({
      id: "actions",
      header: "",
      cell: (info) => (
        <a
          href={info.row.original.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ),
      size: 40,
    }),
  ], []);

  const table = useReactTable({
    data: allArticles,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();

  // Infinite scroll trigger
  const handleScroll = useCallback(() => {
    if (!parentRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = parentRef.current;
    if (scrollHeight - scrollTop - clientHeight < 500 && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleExport = () => {
    const csvContent = [
      ["Title", "Source", "Published", "Threat Level", "Sentiment", "Tags", "URL"].join(","),
      ...allArticles.map((a) =>
        [
          `"${a.title?.replace(/"/g, '""') || ''}"`,
          `"${a.source_name || ''}"`,
          a.published_date,
          a.threat_level || '',
          a.sentiment_label || '',
          `"${(a.tags || []).join('; ')}"`,
          a.source_url,
        ].join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `news-export-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search headlines..."
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              className="pl-9 w-[250px] bg-card border-border"
            />
            {globalFilter && (
              <button
                onClick={() => setGlobalFilter("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          <Select value={threatFilter} onValueChange={setThreatFilter}>
            <SelectTrigger className="w-[130px] bg-card border-border">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Threat" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Threats</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
            <SelectTrigger className="w-[140px] bg-card border-border">
              <SelectValue placeholder="Sentiment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sentiment</SelectItem>
              <SelectItem value="positive">Positive</SelectItem>
              <SelectItem value="neutral">Neutral</SelectItem>
              <SelectItem value="negative">Negative</SelectItem>
            </SelectContent>
          </Select>

          {/* Google News Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="google-news-toggle" className="text-sm cursor-pointer">
              Google News
            </Label>
            <Switch
              id="google-news-toggle"
              checked={includeGoogleNews}
              onCheckedChange={setIncludeGoogleNews}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <DataFreshnessIndicator 
            lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt).toISOString() : null}
            expectedMaxAgeMinutes={60}
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="bg-card">
                <Columns className="h-4 w-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table.getAllLeafColumns().filter(col => col.id !== 'actions').map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={column.getIsVisible()}
                  onCheckedChange={(value) => column.toggleVisibility(!!value)}
                >
                  {column.id === 'published_date' ? 'Published' : 
                   column.id === 'source_name' ? 'Source' :
                   column.id === 'threat_level' ? 'Threat' :
                   column.id === 'sentiment_label' ? 'Sentiment' :
                   column.id.charAt(0).toUpperCase() + column.id.slice(1)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" size="sm" onClick={handleExport} className="bg-card">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isLoading}
            className="bg-card"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Newspaper className="h-4 w-4" />
          {allArticles.length} articles loaded
        </span>
        {hasNextPage && (
          <span className="text-xs">Scroll for more...</span>
        )}
      </div>

      {/* Table */}
      <div 
        ref={parentRef}
        onScroll={handleScroll}
        className="relative rounded-lg border border-border bg-card overflow-auto"
        style={{ height: "calc(100vh - 380px)", minHeight: "400px" }}
      >
        <table className="w-full">
          <thead className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground border-b border-border"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <div
                        className={cn(
                          "flex items-center gap-1",
                          header.column.getCanSort() && "cursor-pointer select-none hover:text-foreground"
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="ml-1">
                            {header.column.getIsSorted() === "asc" ? (
                              <ChevronUp className="h-4 w-4" />
                            ) : header.column.getIsSorted() === "desc" ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <div className="h-4 w-4" />
                            )}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody
            style={{
              height: `${totalSize}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {virtualRows.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  style={{
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    display: "table",
                    tableLayout: "fixed",
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 py-3"
                      style={{ width: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {isFetchingNextPage && (
          <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center py-4 bg-gradient-to-t from-background to-transparent">
            <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
