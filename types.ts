export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3' | '3:4' | '21:9';
export type Resolution = '1080p' | '720p' | '4k';
export type VeoModel = 'veo-3.1-generate-preview' | 'veo-3.1-fast-generate-preview';

/**
 * MASTER STYLE DIRECTIVE
 * This is the default aesthetic prompt for all projects.
 */
export const DEFAULT_STYLE = "Monochromatic charcoal with a \"boiling\" grain. Use curvilinear perspective and multiple vanishing points to create an animated zoom with parallax shifting. Charcoal lines flicker and boil as buildings distort and flow, transitioning from glowing night windows into distant daylight in a sweeping, memory-driven fly-over.";

export interface DraftingSlot {
  id: string;
  source: string | null;
  target: string | null;
  status: 'idle' | 'processing' | 'completed' | 'error';
}

export interface Shot {
  id: string;
  sequenceOrder: number;
  topic: string;
  actionPrompt: string; 
  visualAnalysis: string;
  sourceImage?: string; 
  targetImage?: string; 
  model: VeoModel;
  aspectRatio: AspectRatio;
  resolution: Resolution;
}

export interface Project {
  id: string;
  title: string;
  lastModified: number;
  shots: Shot[];
  draftingSlots: DraftingSlot[];
  startingSequenceNumber?: number;
  styleDirective?: string;
}