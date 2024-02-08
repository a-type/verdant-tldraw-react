import { Tldraw } from '@tldraw/tldraw';
import { TldrawPresence, useVerdantStore } from '../src/index.js';
import { createHooks } from './client/react.js';
import { ClientDescriptor } from './client/index.js';
import { createRoot } from 'react-dom/client';
import '@tldraw/tldraw/tldraw.css';
import './main.css';

let userId = localStorage.getItem('userId');
if (!userId) {
  userId = Math.random().toString(36).substring(7);
  localStorage.setItem('userId', userId);
}

const desc = new ClientDescriptor<TldrawPresence, { id: string }>({
  namespace: 'tldraw',
  sync: {
    authEndpoint: `http://localhost:3242/auth/tldraw?userId=${userId}`,
    defaultProfile: { id: userId },
    initialPresence: {
      tlDraw: undefined,
    },
    autoStart: true,
  },
});

const hooks = createHooks<TldrawPresence, { id: string }>();

function DrawingCanvas() {
  const client = hooks.useClient();
  const drawing = hooks.useDrawing('default');
  hooks.useWatch(drawing);
  const store = useVerdantStore({
    client,
    drawing: drawing?.get('drawing') ?? null,
  });

  return <Tldraw autoFocus store={store} />;
}

function App() {
  return (
    <hooks.Provider value={desc}>
      <DrawingCanvas />
    </hooks.Provider>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
