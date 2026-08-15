import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { config } from './lib/config';
import { ConfigErrorScreen } from './components/ConfigErrorScreen';

const missingRequired = config.getMissingRequiredConfigs();
const root = createRoot(document.getElementById('root')!);

if (missingRequired.length > 0) {
  root.render(
    <StrictMode>
      <ConfigErrorScreen missing={missingRequired} />
    </StrictMode>
  );
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
