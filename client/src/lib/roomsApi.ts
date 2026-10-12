import axios from 'axios';
import api from './api';

// This REPLACES lib/Roomsapi.ts — delete that file (the casing mismatch is a
// real risk: Windows/macOS treat 'Roomsapi.ts' and 'roomsApi.ts' as the same
// file, but Linux and git don't, which causes exactly the "it works on my
// machine" bugs that are painful to track down later).

export type LanguageId = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'go';

export interface LanguageOption {
  id: LanguageId;
  label: string;
}

export const LANGUAGES: LanguageOption[] = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'go', label: 'Go' },
];

export function languageLabel(id: string): string {
  return LANGUAGES.find((l) => l.id === id)?.label ?? id;
}

// Matches roomController.toRoomJSON() on the backend exactly.
export interface Room {
  roomId: string;
  name: string;
  language: LanguageId;
  ownerId: string;
  createdAt: string;
  lastActiveAt: string;
  activeUsers?: number; // only present on GET /rooms/:roomId
}

export interface CreateRoomInput {
  name: string;
  language: LanguageId;
}

export class RoomNotFoundError extends Error {
  constructor() {
    super('Room not found');
    this.name = 'RoomNotFoundError';
  }
}

/** Pulls the { success:false, error } message your backend sends on 4xx/5xx. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err) && typeof err.response?.data?.error === 'string') {
    return err.response.data.error;
  }
  return fallback;
}

// api's baseURL already includes /api (see lib/api.ts), so paths here start
// at /rooms, not /api/rooms.

export async function listRooms(): Promise<Room[]> {
  const res = await api.get<{ success: true; data: Room[] }>('/rooms');
  return res.data.data;
}

export async function createRoom(input: CreateRoomInput): Promise<Room> {
  const res = await api.post<{ success: true; data: Room }>('/rooms', input);
  return res.data.data;
}

export async function getRoom(roomId: string): Promise<Room> {
  try {
    const res = await api.get<{ success: true; data: Room }>(`/rooms/${roomId}`);
    return res.data.data;
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 404) {
      throw new RoomNotFoundError();
    }
    throw err;
  }
}