'use client';

import { createContext, useContext } from 'react';

/** True when a Reveal/FadeIn is rendered inside a Stagger, so it should defer
 *  its initial/animate to the parent's orchestration instead of self-triggering. */
export const StaggerContext = createContext(false);

export const useInStagger = () => useContext(StaggerContext);
