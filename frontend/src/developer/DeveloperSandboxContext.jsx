import { createContext, useContext } from 'react';

export const DeveloperSandboxContext = createContext(null);

export const useDeveloperSandbox = () => useContext(DeveloperSandboxContext);
