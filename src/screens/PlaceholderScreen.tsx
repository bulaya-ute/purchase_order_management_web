interface PlaceholderScreenProps {
  title: string;
  description?: string;
}

/** Simple titled stub used for screens not yet built in this slice. */
export function PlaceholderScreen({ title, description }: PlaceholderScreenProps) {
  return (
    <section className="placeholder-card">
      <h2>{title}</h2>
      <p>{description ?? 'This screen will be built in a later slice.'}</p>
    </section>
  );
}
