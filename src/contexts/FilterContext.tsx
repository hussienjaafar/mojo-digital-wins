import React, { createContext, useContext, useState, ReactNode } from 'react';
import { subDays, format } from 'date-fns';

type FilterContextType = {
  organizationId: string;
  setOrganizationId: (id: string) => void;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  updateDateRange: (start: string, end: string) => void;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const FilterProvider = ({ children }: { children: ReactNode }) => {
  const [organizationId, setOrganizationId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(
    format(subDays(new Date(), 30), 'yyyy-MM-dd')
  );
  const [endDate, setEndDate] = useState<string>(
    format(new Date(), 'yyyy-MM-dd')
  );

  const updateDateRange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
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
