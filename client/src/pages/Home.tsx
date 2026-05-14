/**
 * FORTRESS V2 — Home redirect
 * The main entry is DashboardPage via App.tsx routing.
 */
import { Redirect } from 'wouter';

export default function Home() {
  return <Redirect to="/" />;
}
