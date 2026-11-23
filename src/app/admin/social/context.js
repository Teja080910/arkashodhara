'use client';

import { createContext, useContext } from 'react';

export const SocialContext = createContext(null);

export function useSocial() {
  const value = useContext(SocialContext);
  if (!value) throw new Error('useSocial must be used inside the social layout');
  return value;
}
