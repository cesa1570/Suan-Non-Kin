import React, { createContext, useContext } from 'react';

export interface AppContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  openKeySelection: () => void;
  resetKeyStatus: () => void;
  hasSelectedKey: boolean;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};