/** Whether a nav href should show as the current page for the given pathname. */
export const isNavActive = (pathname: string, href: string): boolean => {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
};
