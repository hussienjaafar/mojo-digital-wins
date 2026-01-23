import React, { useState, useCallback } from "react";
import { Plus, X, ChevronDown } from "lucide-react";
import { V3Card, V3CardContent, V3CardHeader, V3CardTitle, V3Button } from "@/components/v3";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { FilterCondition, FilterField, FilterOperator } from "@/types/donorSegment";
import { SEGMENT_FILTER_FIELDS, OPERATOR_LABELS } from "@/types/donorSegment";

interface DonorSegmentFiltersProps {
  filters: FilterCondition[];
  onFiltersChange: (filters: FilterCondition[]) => void;
  isLoading?: boolean;
}

// Group fields by category
const FILTER_CATEGORIES = Array.from(
  new Set(SEGMENT_FILTER_FIELDS.map(f => f.category))
);

export function DonorSegmentFilters({
  filters,
  onFiltersChange,
  isLoading,
}: DonorSegmentFiltersProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Giving Behavior', 'RFM Analysis'])
  );

  const toggleCategory = useCallback((category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  }, []);

  const addFilter = useCallback((field: FilterField) => {
    const defaultOperator = field.operators[0];
    let defaultValue: any = null;

    switch (field.type) {
      case 'number':
      case 'currency':
        defaultValue = 0;
        break;
      case 'boolean':
        defaultValue = true;
        break;
      case 'string':
        defaultValue = '';
        break;
      case 'date':
        defaultValue = new Date().toISOString().split('T')[0];
        break;
      case 'select':
      case 'multi-select':
        defaultValue = field.options?.[0]?.value ? [field.options[0].value] : [];
        break;
    }

    const newFilter: FilterCondition = {
      id: crypto.randomUUID(),
      field: field.key,
      operator: defaultOperator,
      value: defaultValue,
    };

    onFiltersChange([...filters, newFilter]);
  }, [filters, onFiltersChange]);

  const updateFilter = useCallback((id: string, updates: Partial<FilterCondition>) => {
    onFiltersChange(
      filters.map(f => (f.id === id ? { ...f, ...updates } : f))
    );
  }, [filters, onFiltersChange]);

  const removeFilter = useCallback((id: string) => {
    onFiltersChange(filters.filter(f => f.id !== id));
  }, [filters, onFiltersChange]);

  const getFieldDef = (key: string) => SEGMENT_FILTER_FIELDS.find(f => f.key === key);

  return (
    <V3Card className="sticky top-4">
      <V3CardHeader className="pb-3">
        <V3CardTitle className="text-base">Filters</V3CardTitle>
        <p className="text-xs text-[hsl(var(--portal-text-muted))] mt-1">
          {filters.length === 0 
            ? 'Add filters to segment donors' 
            : `${filters.length} filter${filters.length !== 1 ? 's' : ''} active`}
        </p>
      </V3CardHeader>
      <V3CardContent className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
        {/* Active Filters */}
        {filters.length > 0 && (
          <div className="space-y-2 pb-4 border-b border-[hsl(var(--portal-border))]">
            {filters.map(filter => {
              const fieldDef = getFieldDef(filter.field);
              if (!fieldDef) return null;

              return (
                <ActiveFilterCard
                  key={filter.id}
                  filter={filter}
                  fieldDef={fieldDef}
                  onUpdate={(updates) => updateFilter(filter.id, updates)}
                  onRemove={() => removeFilter(filter.id)}
                  disabled={isLoading}
                />
              );
            })}
          </div>
        )}

        {/* Add Filters by Category */}
        {FILTER_CATEGORIES.map(category => {
          const categoryFields = SEGMENT_FILTER_FIELDS.filter(f => f.category === category);
          const isExpanded = expandedCategories.has(category);

          return (
            <Collapsible key={category} open={isExpanded}>
              <CollapsibleTrigger
                onClick={() => toggleCategory(category)}
                className="flex items-center justify-between w-full py-2 text-sm font-medium text-[hsl(var(--portal-text-primary))] hover:text-[hsl(var(--portal-accent-blue))] transition-colors"
              >
                <span>{category}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isExpanded && "rotate-180"
                  )}
                />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                {categoryFields.map(field => {
                  const isActive = filters.some(f => f.field === field.key);
                  return (
                    <button
                      key={field.key}
                      onClick={() => addFilter(field)}
                      disabled={isLoading}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors text-left",
                        isActive
                          ? "bg-[hsl(var(--portal-accent-blue)/0.1)] text-[hsl(var(--portal-accent-blue))]"
                          : "hover:bg-[hsl(var(--portal-bg-hover))] text-[hsl(var(--portal-text-muted))]",
                        isLoading && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <Plus className="h-3.5 w-3.5 flex-shrink-0" />
                      <span className="truncate">{field.label}</span>
                    </button>
                  );
                })}
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </V3CardContent>
    </V3Card>
  );
}

// Active filter card component
interface ActiveFilterCardProps {
  filter: FilterCondition;
  fieldDef: FilterField;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  onRemove: () => void;
  disabled?: boolean;
}

function ActiveFilterCard({
  filter,
  fieldDef,
  onUpdate,
  onRemove,
  disabled,
}: ActiveFilterCardProps) {
  return (
    <div className="p-3 rounded-lg bg-[hsl(var(--portal-bg-elevated))] border border-[hsl(var(--portal-border))] space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[hsl(var(--portal-text-primary))]">
          {fieldDef.label}
        </span>
        <button
          onClick={onRemove}
          disabled={disabled}
          className="p-1 rounded hover:bg-[hsl(var(--portal-bg-hover))] text-[hsl(var(--portal-text-muted))] hover:text-[hsl(var(--portal-error))] transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Operator Selection */}
      <Select
        value={filter.operator}
        onValueChange={(value) => onUpdate({ operator: value as FilterOperator })}
        disabled={disabled}
      >
        <SelectTrigger className="h-8 text-xs bg-[hsl(var(--portal-bg-secondary))]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {fieldDef.operators.map(op => (
            <SelectItem key={op} value={op} className="text-xs">
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value Input */}
      <FilterValueInput
        filter={filter}
        fieldDef={fieldDef}
        onUpdate={onUpdate}
        disabled={disabled}
      />
    </div>
  );
}

// Value input component based on field type
interface FilterValueInputProps {
  filter: FilterCondition;
  fieldDef: FilterField;
  onUpdate: (updates: Partial<FilterCondition>) => void;
  disabled?: boolean;
}

function FilterValueInput({ filter, fieldDef, onUpdate, disabled }: FilterValueInputProps) {
  // No value needed for null operators
  if (filter.operator === 'is_null' || filter.operator === 'is_not_null') {
    return null;
  }

  // Between operator needs two values
  if (filter.operator === 'between') {
    const rangeValue = Array.isArray(filter.value) ? filter.value : [0, 0];
    const min = typeof rangeValue[0] === 'number' ? rangeValue[0] : 0;
    const max = typeof rangeValue[1] === 'number' ? rangeValue[1] : 0;
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={min}
          onChange={(e) => onUpdate({ value: [Number(e.target.value), max] as [number, number] })}
          className="h-8 text-xs"
          placeholder="Min"
          disabled={disabled}
        />
        <span className="text-xs text-[hsl(var(--portal-text-muted))]">to</span>
        <Input
          type="number"
          value={max}
          onChange={(e) => onUpdate({ value: [min, Number(e.target.value)] as [number, number] })}
          className="h-8 text-xs"
          placeholder="Max"
          disabled={disabled}
        />
      </div>
    );
  }

  switch (fieldDef.type) {
    case 'number':
    case 'currency':
      return (
        <div className="relative">
          {fieldDef.type === 'currency' && (
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[hsl(var(--portal-text-muted))]">
              $
            </span>
          )}
          <Input
            type="number"
            value={filter.value as number}
            onChange={(e) => onUpdate({ value: Number(e.target.value) })}
            className={cn("h-8 text-xs", fieldDef.type === 'currency' && "pl-6")}
            disabled={disabled}
          />
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`filter-${filter.id}`}
            checked={filter.value as boolean}
            onCheckedChange={(checked) => onUpdate({ value: checked })}
            disabled={disabled}
          />
          <Label htmlFor={`filter-${filter.id}`} className="text-xs">
            {filter.value ? 'Yes' : 'No'}
          </Label>
        </div>
      );

    case 'string':
      return (
        <Input
          type="text"
          value={filter.value as string}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="h-8 text-xs"
          placeholder="Enter value..."
          disabled={disabled}
        />
      );

    case 'date':
      return (
        <Input
          type="date"
          value={filter.value as string}
          onChange={(e) => onUpdate({ value: e.target.value })}
          className="h-8 text-xs"
          disabled={disabled}
        />
      );

    case 'select':
    case 'multi-select':
      const selectedValues = Array.isArray(filter.value) ? filter.value : [];
      return (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {fieldDef.options?.map(option => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-[hsl(var(--portal-bg-hover))] cursor-pointer"
            >
              <Checkbox
                checked={selectedValues.includes(option.value)}
                onCheckedChange={(checked) => {
                  const newValues: string[] = checked
                    ? [...selectedValues, option.value]
                    : selectedValues.filter((v: string) => v !== option.value);
                  onUpdate({ value: newValues });
                }}
                disabled={disabled}
              />
              <span className="text-xs text-[hsl(var(--portal-text-primary))]">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      );

    default:
      return null;
  }
}
