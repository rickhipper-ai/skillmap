import { RouterProvider } from 'react-router-dom';

import { AppProviders } from './providers';
import type { AppRouter } from './router';

interface AppProps {
  router: AppRouter;
}

export function App({ router }: AppProps) {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
