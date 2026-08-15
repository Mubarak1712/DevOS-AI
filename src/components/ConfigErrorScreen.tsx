import { AlertTriangle } from 'lucide-react';
import type { ConfigStatus } from '@/lib/config';

interface ConfigErrorScreenProps {
  missing: ConfigStatus[];
}

export function ConfigErrorScreen({ missing }: ConfigErrorScreenProps) {
  return (
    <div className="min-h-screen mesh-bg flex items-center justify-center p-6">
      <div className="glass-card max-w-lg w-full p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-coral-100 flex items-center justify-center mx-auto mb-5">
          <AlertTriangle className="w-7 h-7 text-coral-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">Configuration Required</h1>
        <p className="text-surface-500 mb-6">
          DevOS AI cannot start until required environment variables are set in your <code className="text-violet-600">.env</code> file.
        </p>
        <ul className="text-left space-y-2 mb-6">
          {missing.map((item) => (
            <li key={item.key} className="p-3 rounded-xl bg-surface-50 border border-surface-200">
              <p className="font-medium text-neutral-900">{item.name}</p>
              <p className="text-sm text-surface-500">{item.key} — {item.description}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm text-surface-400">
          Restart the dev server after updating <code className="text-violet-600">.env</code>.
        </p>
      </div>
    </div>
  );
}
