import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// Locale-aware Link, useRouter, redirect, etc. Drop-in replacement for the
// equivalents from next/link and next/navigation.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
