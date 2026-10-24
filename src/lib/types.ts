export type {
  CompanyProfile,
  ProfileFields,
  DraftRequest,
  DraftResult,
} from "./schemas";
export type AIProvider = "gemini" | "openai";
export interface ConnectionStatus {
  provider: AIProvider;
  model: string;
  aiConfigured: boolean;
  upworkConnected: boolean;
  csrf: string;
}
export interface SessionCounts {
  prepared: number;
  copied: number;
  submitted: number;
  skipped: number;
}
