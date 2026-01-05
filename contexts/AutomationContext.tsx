import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getQueue, YoutubeQueueItem } from '../services/projectService';

interface AutomationContextType {
  isPassiveMode: boolean;
  togglePassiveMode: () => void;
  logs: string[];
  addLog: (msg: string) => void;
  queue: YoutubeQueueItem[];
  refreshQueue: () => void;
  currentAction: string;
  setCurrentAction: (action: string) => void;
  isQuotaLimited: boolean;
  setQuotaLimited: (limited: boolean) => void;
  apiKey: string;
}

const AutomationContext = createContext<AutomationContextType | undefined>(undefined);

// [แก้ไข 1] เพิ่ม apiKey ใน Props Type Definition
export const AutomationProvider: React.FC<{ children: React.ReactNode; apiKey: string }> = ({ children, apiKey }) => {
  const [isPassiveMode, setIsPassiveMode] = useState(false);
  const [logs, setLogs] = useState<string[]>(["[System] Autonomous core initialized.", "[System] Awaiting instructions..."]);
  const [queue, setQueue] = useState<YoutubeQueueItem[]>([]);
  const [currentAction, setCurrentAction] = useState("STANDBY");
  const [isQuotaLimited, setIsQuotaLimited] = useState(false);

  const addLog = (msg: string) => {
    setLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));
  };

  const refreshQueue = useCallback(async () => {
    try {
      const q = await getQueue();
      setQueue(q);
    } catch (e) {
      console.error("Failed to refresh queue", e);
    }
  }, []);

  useEffect(() => {
    refreshQueue();
    const interval = setInterval(refreshQueue, 5000);
    return () => clearInterval(interval);
  }, [refreshQueue]);

  const togglePassiveMode = () => {
    setIsPassiveMode(prev => {
      const next = !prev;
      addLog(next ? "Autonomous mode ENGAGED." : "Autonomous mode DISENGAGED.");
      if (!next) setCurrentAction("STANDBY");
      return next;
    });
  };

  return (
    <AutomationContext.Provider value={{ 
      isPassiveMode, 
      togglePassiveMode, 
      logs, 
      addLog,
      queue, 
      refreshQueue, 
      currentAction,
      setCurrentAction,
      isQuotaLimited,
      setQuotaLimited: setIsQuotaLimited,
      apiKey // [แก้ไข 2] ส่ง apiKey เข้าไปใน Context Value
    }}>
      {children} {/* [แก้ไข 3] ต้อง Render children (ตัวแอป) ไม่ใช่ Render apiKey */}
    </AutomationContext.Provider>
  );
};

export const useAutomation = () => {
  const context = useContext(AutomationContext);
  if (!context) throw new Error("useAutomation must be used within AutomationProvider");
  return context;
};