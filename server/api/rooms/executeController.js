const axios = require('axios');
const Room = require('../../models/Room');
const { getIO } = require('../../realtime/ioRegistry');

// RapidAPI's hosted Judge0 CE. Swapping to a self-hosted Judge0 later is just
// changing JUDGE0_API_HOST (and dropping the X-RapidAPI-* headers) — nothing
// else here needs to change.
const JUDGE0_HOST = process.env.JUDGE0_API_HOST || 'judge0-ce.p.rapidapi.com';
const JUDGE0_URL = `https://${JUDGE0_HOST}/submissions`;

// Judge0 CE's language ids. Keep this in sync with LANGUAGES in the client's
// lib/roomsApi.ts — same six ids, same set.
const LANGUAGE_IDS = {
  javascript: 63, // Node.js (18.15.0)
  typescript: 74, // TypeScript (5.0.3)
  python: 71, // Python (3.8.1)
  java: 62, // Java (OpenJDK 13.0.1)
  cpp: 54, // C++ (GCC 9.2.0)
  go: 60, // Go (1.13.5)
};

function toBase64(str) {
  return Buffer.from(str ?? '', 'utf-8').toString('base64');
}

function fromBase64(str) {
  return str ? Buffer.from(str, 'base64').toString('utf-8') : '';
}

async function runOnJudge0({ code, stdin, languageId }) {
  const { data } = await axios.post(
    JUDGE0_URL,
    {
      source_code: toBase64(code),
      stdin: toBase64(stdin || ''),
      language_id: languageId,
    },
    {
      // wait=true: Judge0 runs it synchronously and hands back the result in
      // this same response, instead of us polling a submission token. Simpler
      // for a single run; if runs start queuing under load, switch to
      // wait=false + a callback_url and drop the polling onto a queue.
      params: { base64_encoded: 'true', wait: 'true', fields: '*' },
      headers: {
        'content-type': 'application/json',
        'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
        'X-RapidAPI-Host': JUDGE0_HOST,
      },
      timeout: 15000,
    },
  );
  return data;
}

// POST /api/rooms/:roomId/execute
async function executeCode(req, res) {
  try {
    const room = await Room.findOne({ roomId: req.params.roomId });
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found' });
    }

    const language = req.body.language || room.language;
    const languageId = LANGUAGE_IDS[language];
    if (!languageId) {
      return res.status(400).json({ success: false, error: `Unsupported language: ${language}` });
    }

    if (!process.env.JUDGE0_API_KEY) {
      return res
        .status(500)
        .json({ success: false, error: 'Code execution is not configured (missing JUDGE0_API_KEY)' });
    }

    const judge0Result = await runOnJudge0({
      code: req.body.code,
      stdin: req.body.stdin,
      languageId,
    });

    const result = {
      status: judge0Result.status ? judge0Result.status.description : 'Unknown',
      statusId: judge0Result.status ? judge0Result.status.id : null,
      stdout: fromBase64(judge0Result.stdout),
      stderr: fromBase64(judge0Result.stderr),
      compileOutput: fromBase64(judge0Result.compile_output),
      time: judge0Result.time,
      memory: judge0Result.memory,
      language,
      ranAt: new Date().toISOString(),
    };

    // Broadcast to the whole room, not just the caller — everyone watching
    // the same room should see the same run land in their console, the same
    // way presence and Yjs edits already do.
    getIO().to(room.roomId).emit('execution:result', result);

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    if (err.response) {
      console.error('Judge0 error:', err.response.status, err.response.data);
      return res.status(502).json({ success: false, error: 'Code execution service failed' });
    }
    console.error('Execute code error:', err);
    return res.status(500).json({ success: false, error: 'Could not run the code' });
  }
}

module.exports = { executeCode, LANGUAGE_IDS };