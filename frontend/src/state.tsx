import { createContext, useContext, useEffect, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { TrainingPresenter } from './presenter/TrainingPresenter.js';
import { HttpTrainingService } from './service/TrainingService.js';
const presenter = new TrainingPresenter(new HttpTrainingService());
const Context = createContext(presenter);
export function TrainingProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void presenter.load();
  }, []);
  return <Context.Provider value={presenter}>{children}</Context.Provider>;
}
export function useTraining() {
  const presenter = useContext(Context);
  const state = useSyncExternalStore(presenter.subscribe, () => presenter.state);
  return { ...state, presenter };
}
