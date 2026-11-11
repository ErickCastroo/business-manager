import { createBrowserRouter, RouterProvider } from 'react-router';

import { AppProviders } from '@/app/providers';
import { appRoutes } from '@/app/router';

const router = createBrowserRouter(appRoutes);

export function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
}
