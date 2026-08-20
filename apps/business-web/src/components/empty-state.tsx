export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <article className="emptyState">
      <h3>{title}</h3>
      {description ? <p className="mutedText">{description}</p> : null}
    </article>
  );
}
