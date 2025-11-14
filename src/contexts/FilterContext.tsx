import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { subDays, format } from 'date-fns';

type FilterContextType = {
  organizationId: string;
  setOrganizationId: (id: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  updateDateRange: (start: string, end: string) => void;
  resetFilters: () => void;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  // Try to load saved organization from localStorage
  const [organizationId, setOrganizationIdState] = useState<string>(
    () => localStorage.getItem('selectedOrganizationId') || ''
  );
  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  // Save organization ID to localStorage when it changes
  const setOrganizationId = (id: string) => {
    setOrganizationIdState(id);
    if (id) {
      localStorage.setItem('selectedOrganizationId', id);
    } else {
      localStorage.removeItem('selectedOrganizationId');
    }
  };

  const updateDateRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  const resetFilters = () => {
    setStartDate(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  return (
    <FilterContext.Provider
      value={{
        organizationId,
        setOrganizationId,
        startDate,
        setStartDate,
        endDate,
        setEndDate,
        updateDateRange,
        resetFilters,
      }}
    >
      {children}
    </FilterContext.Provider>
  );
};

export const useFilters = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilters must be used within FilterProvider');
  }
  return context;
};
