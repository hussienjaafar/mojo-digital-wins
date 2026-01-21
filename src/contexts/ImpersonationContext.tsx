import React, { createContext, useContext, useState, useEffect } from 'react';

interface ImpersonationContextType {
  impersonatedUserId: string | null;
  impersonatedUserName: string | null;
  impersonatedOrgId: string | null;
  impersonatedOrgName: string | null;
  setImpersonation: (userId: string, userName: string, orgId: string, orgName: string) => void;
  clearImpersonation: () => void;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const STORAGE_KEY = 'admin_impersonation';

export const ImpersonationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [impersonatedUserId, setImpersonatedUserId] = useState<string | null>(null);
  const [impersonatedUserName, setImpersonatedUserName] = useState<string | null>(null);
  const [impersonatedOrgId, setImpersonatedOrgId] = useState<string | null>(null);
  const [impersonatedOrgName, setImpersonatedOrgName] = useState<string | null>(null);

  // Load from sessionStorage on mount
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const data = JSON.parse(stored);
        setImpersonatedUserId(data.userId);
        setImpersonatedUserName(data.userName);
        setImpersonatedOrgId(data.orgId);
        setImpersonatedOrgName(data.orgName);
      } catch (error) {
        console.error('Failed to parse impersonation data:', error);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const setImpersonation = (userId: string, userName: string, orgId: string, orgName: string) => {
    const data = { userId, userName, orgId, orgName };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setImpersonatedUserId(userId);
    setImpersonatedUserName(userName);
    setImpersonatedOrgId(orgId);
    setImpersonatedOrgName(orgName);
  };

  const clearImpersonation = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setImpersonatedUserId(null);
    setImpersonatedUserName(null);
    setImpersonatedOrgId(null);
    setImpersonatedOrgName(null);
  };

  const isImpersonating = impersonatedUserId !== null;

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUserId,
        impersonatedUserName,
        impersonatedOrgId,
        impersonatedOrgName,
        setImpersonation,
        clearImpersonation,
        isImpersonating,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
};

export const useImpersonation = () => {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
};

// Safe version that returns defaults instead of throwing when outside provider
export const useImpersonationSafe = () => {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    return {
      impersonatedUserId: null,
      impersonatedUserName: null,
      impersonatedOrgId: null,
      impersonatedOrgName: null,
      setImpersonation: () => {},
      clearImpersonation: () => {},
      isImpersonating: false,
    };
  }
  return context;
};
