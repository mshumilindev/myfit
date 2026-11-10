/** Loads `AtlasOutboxHost` on demand: App renders this only while the Atlas add-on is installed. */
import { lazy, Suspense, type ComponentProps } from 'react';

const Host = lazy(() =>
  import('./AtlasOutboxHost').then((module) => ({ default: module.AtlasOutboxHost })),
);

export function AtlasOutboxLazy(props: ComponentProps<typeof Host>) {
  return (
    <Suspense fallback={null}>
      <Host {...props} />
    </Suspense>
  );
}
