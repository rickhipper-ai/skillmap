import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createAppRouter } from './app/router';
import './styles/tokens.css';
import './styles/global.css';

const rootElement = document.querySelector('#root');

if (!(rootElement instanceof HTMLElement)) {
  throw new Error('Elemento raiz da aplicacao nao encontrado.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App router={createAppRouter()} />
  </StrictMode>,
);
