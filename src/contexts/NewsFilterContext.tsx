import { createContext, useContext, useState, ReactNode } from 'react';

export interface FilterState {
  search: string;
  category: string;
  sourceId: string;
  dateRange: string;
  tags: string[];
  geographicScope?: string;
  affectedGroup?: string;
  relevanceCategory?: string;
}

interface NewsContextType {
  activeFilters: FilterState | null;
  setFilters: (filters: FilterState | null) => void;
  searchTerm: string | null;
  setSearchTerm: (term: string | null) => void;
  navigateToTab: ((tab: 'feed' | 'analytics') => void) | null;
  setNavigateToTab: (fn: ((tab: 'feed' | 'analytics') => void) | null) => void;
}

const NewsContext = createContext<NewsContextType | undefined>(undefined);

export function NewsFilterProvider({ children }: { children: ReactNode }) {
  const [activeFilters, setFilters] = useState<FilterState | null>(null);
  const [searchTerm, setSearchTerm] = useState<string | null>(null);
  const [navigateToTab, setNavigateToTab] = useState<((tab: 'feed' | 'analytics') => void) | null>(null);

  return (
    <NewsContext.Provider value={{
      activeFilters,
      setFilters,
      searchTerm,
      setSearchTerm,
      navigateToTab,
      setNavigateToTab
    }}>
      {children}
    </NewsContext.Provider>
  );
}

export function useNewsFilters() {
  const context = useContext(NewsContext);
  if (!context) {
    throw new Error('useNewsFilters must be used within NewsFilterProvider');
  }
  return context;
}
