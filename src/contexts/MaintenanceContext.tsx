import React, { createContext, useContext, useState, useEffect } from 'react';

interface MaintenanceContextType {
  isMaintenanceMode: boolean;
  setMaintenanceMode: (value: boolean) => void;
  maintenanceMessage: string;
}

const MaintenanceContext = createContext<MaintenanceContextType>({
  isMaintenanceMode: false,
  setMaintenanceMode: () => {},
  maintenanceMessage: '',
});

export const useMaintenanceMode = () => useContext(MaintenanceContext);

export const MaintenanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMaintenanceMode, setMaintenanceMode] = useState(() => {
    const stored = localStorage.getItem('maintenanceMode');
    return stored === 'true'; // Default to false (maintenance off)
  });

  const maintenanceMessage = 'Database maintenance in progress. Some features may be temporarily unavailable.';

  useEffect(() => {
    localStorage.setItem('maintenanceMode', String(isMaintenanceMode));
  }, [isMaintenanceMode]);

  return (
    <MaintenanceContext.Provider value={{ isMaintenanceMode, setMaintenanceMode, maintenanceMessage }}>
      {children}
    </MaintenanceContext.Provider>
  );
};
