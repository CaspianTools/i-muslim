/**
 * Mosques list loading skeleton. Shown during navigation into /mosques while
 * the server fetches the mosque list. Matches the rendered grid shape so the
 * page doesn't jump on data arrival.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
      <header className="space-y-2">
        <span className="skeleton skeleton-line h-8 w-1/3" />
        <span className="skeleton skeleton-line w-1/2" />
      </header>
      <span className="skeleton skeleton-line mt-6 w-32" />
      <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i}>
            <span className="skeleton skeleton-card h-64" />
          </li>
        ))}
      </ul>
    </div>
  );
}
