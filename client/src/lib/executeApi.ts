import api from './api';
import type { LanguageId } from './roomsApi';

// Matches executeController.js's `result` shape exactly.
export interface ExecutionResult {
  status: string;
  statusId: number | null;
  stdout: string;
  stderr: string;
  compileOutput: string;
  time: string | null;
  memory: number | null;
  language: LanguageId;
  ranAt: string;
}

export interface ExecuteInput {
  code: string;
  stdin?: string;
}

// api's baseURL already includes /api — see lib/api.ts.
export async function executeCode(roomId: string, input: ExecuteInput): Promise<ExecutionResult> {
  const res = await api.post<{ success: true; data: ExecutionResult }>(`/rooms/${roomId}/execute`, input);
  return res.data.data;
}