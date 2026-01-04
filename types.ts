
export interface Scene {
  id: number;
  visual_prompt: string;
  voiceover: string;
  duration_est: number; // in seconds
  imageUrl?: string;
  videoUrl?: string; // URL for the generated moving video
  audioBuffer?: AudioBuffer;
  audioBase64?: string;
  status?: 'pending' | 'generating' | 'completed' | 'failed' | 'skipped';
  assetStage?: 'audio' | 'visual' | 'script';
  statusDetail?: string; // Detailed status like "Polling frame 48..." or "ETA: 12s"
  processingProgress?: number;
  error?: string;
  transition?: 'none' | 'fade' | 'zoom_in' | 'zoom_out' | 'slide_left' | 'slide_right' | 'crossfade';
  isMuted?: boolean;
  videoVolume?: number; // 0 to 1
  stageLabel?: string; // e.g. "HOOK", "INTRO", etc.
}

export interface SubtitleStyle {
  fontSize: number;
  textColor: string;
  backgroundColor: string; // Hex color
  backgroundOpacity: number; // 0 to 1
  verticalOffset: number; // Percentage from bottom (5 to 90)
  fontFamily: 'Kanit' | 'Inter' | 'sans-serif';
  outlineColor?: string;
  outlineWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  fontWeight?: string | number;
}

export interface ScriptData {
  title: string;
  seoTitle: string;
  description: string;
  longDescription: string;
  hashtags: string[];
  seoKeywords: string;
  scenes: Scene[];
  thumbnailUrl?: string;
}

export interface ProjectState {
  id?: string;
  status: 'idle' | 'generating_script' | 'generating_assets' | 'ready' | 'error';
  topic: string;
  script: ScriptData | null;
  currentStep: string;
  error?: string;
}

export enum GeneratorMode {
  FACTS = 'Knowledge/Facts',
  MYSTERY = 'Mystery/Horror',
  CRIME = 'True Crime',
  NEWS = 'Trending News',
  HISTORY = 'History/Biography',
  PHYSICS = 'Physics/Science',
  CRETACEOUS = 'Prehistoric/Dinosaurs',
  LONG_VIDEO = 'Cinematic Long Video',
  PODCAST = 'AI Podcast/Dialogue',
  SPACE = 'Space/Astronomy',
  FINANCE = 'Wealth/Money',
  ASMR = 'ASMR/Chill Facts',
  DOCUMENTARY = 'Documentary/Special'
}

export type PolishStyle = 'Viral' | 'Funny' | 'Simple' | 'Dramatic' | 'Professional' | 'Translate';

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  category: string;
  popularity?: string;
  virality_score?: number;
  momentum?: string;
  velocity?: string;
  est_reach?: string;
  source?: string;
  date?: string;
  url?: string;
}

export interface SocialPostData {
  caption: string;
  hashtags: string[];
  image_prompt: string;
}
