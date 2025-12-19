import { redirect } from 'next/navigation';

// This is the home page that redirects to login if not authenticated
export default function HomePage() {
  // In a real app, you would check for authentication here
  // For now, we'll redirect to login page
  redirect('/login');
}