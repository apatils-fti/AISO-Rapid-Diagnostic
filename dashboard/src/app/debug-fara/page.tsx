'use client';

import { FARA_CONFIG } from '@/lib/fara-config';

export default function DebugFara() {
  return (
    <div className="p-8 bg-[#0F1117] text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-4">Fara Debug Info</h1>

      <div className="space-y-4">
        <div className="bg-[#1A1D27] p-4 rounded">
          <h2 className="font-semibold mb-2">Environment Variables</h2>
          <div className="font-mono text-sm space-y-1">
            <p>NEXT_PUBLIC_FARA_ENABLED: {process.env.NEXT_PUBLIC_FARA_ENABLED || 'undefined'}</p>
            <p>NEXT_PUBLIC_OLLAMA_ENDPOINT: {process.env.NEXT_PUBLIC_OLLAMA_ENDPOINT || 'undefined'}</p>
          </div>
        </div>

        <div className="bg-[#1A1D27] p-4 rounded">
          <h2 className="font-semibold mb-2">FARA_CONFIG Values</h2>
          <div className="font-mono text-sm space-y-1">
            <p>ENABLED: {String(FARA_CONFIG.ENABLED)}</p>
            <p>OLLAMA_ENDPOINT: {FARA_CONFIG.OLLAMA_ENDPOINT}</p>
            <p>MODEL: {FARA_CONFIG.MODEL}</p>
            <p>MAX_QUERIES_PER_SESSION: {FARA_CONFIG.MAX_QUERIES_PER_SESSION}</p>
          </div>
        </div>

        <div className="bg-[#1A1D27] p-4 rounded">
          <h2 className="font-semibold mb-2">Condition Check</h2>
          <div className="font-mono text-sm space-y-1">
            <p>FARA_CONFIG.ENABLED === true: {String(FARA_CONFIG.ENABLED === true)}</p>
            <p>Should show Fara components: {FARA_CONFIG.ENABLED ? '✅ YES' : '❌ NO'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
