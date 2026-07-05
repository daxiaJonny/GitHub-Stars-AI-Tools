/**
 * Settings Context Provider
 * 全局设置状态共享
 */

import { createContext, useContext, ReactNode } from 'react';
import { useSettings } from '@/hooks/use-settings';

type SettingsContextValue = ReturnType<typeof useSettings>;

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const settings = useSettings();
  return <SettingsContext.Provider value={settings}>{children}</SettingsContext.Provider>;
}

export function useAppSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useAppSettings 必须在 <SettingsProvider> 内部使用');
  }
  return context;
}
