import { useEffect, useState } from 'react';
import { socket } from '../lib/Socket';
import type { ExecutionResult } from '../lib/executeApi';

/**
 * Listens for 'execution:result', which the server broadcasts to the whole
 * room (see executeController.js) whenever ANYONE runs code — not just
 * whoever clicked Run. Doesn't own the socket connection itself: this hook
 * is only ever used alongside useRoomPresence/useYjsDoc, which already keep
 * the shared socket connected for as long as the room page is mounted.
 */
export function useExecutionResult(roomId: string | undefined): ExecutionResult | null {
  const [result, setResult] = useState<ExecutionResult | null>(null);

  useEffect(() => {
    if (!roomId) {
      setResult(null);
      return;
    }

    function onResult(payload: ExecutionResult) {
      setResult(payload);
    }

    socket.on('execution:result', onResult);
    return () => {
      socket.off('execution:result', onResult);
    };
  }, [roomId]);

  return result;
}