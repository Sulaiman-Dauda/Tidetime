/**
 * Wraps every dashboard route in a gentle enter transition. Next.js re-mounts a
 * `template` on each navigation, so pages rise/fade in smoothly as you move
 * around — a silky, premium feel with no client JS or animation library.
 */
export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return <div className="tt-page-enter">{children}</div>;
}
