import { clerkSetup } from '@clerk/testing/playwright';

export default async function globalSetup() {
  await clerkSetup({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY ?? process.env.VITE_CLERK_PUBLISHABLE_KEY,
  });
}