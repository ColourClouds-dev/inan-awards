'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavSubItem {
  href: string;
  label: string;
}

export interface NavItem {
  href: string;
  label: string;
  show: boolean;
  icon: React.ReactNode;
  children?: NavSubItem[];
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navigationItems: NavItem[];
  displayName: string;
  role: string;
  isSigningOut: boolean;
  onSignOut: () => void;
  logoUrl?: string;
  tenantName?: string;
}

const Sidebar = ({
  isOpen,
  onClose,
  navigationItems,
  displayName,
  role,
  isSigningOut,
  onSignOut,
  logoUrl,
  tenantName,
}: SidebarProps) => {
  const pathname = usePathname();

  const visibleItems = navigationItems.filter(item => item.show);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* ── Top: Logo / Brand ─────────────────────────────────────────── */}
      <div className="flex items-center h-16 px-5 border-b border-gray-100 shrink-0">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={tenantName}
            className="h-8 w-auto max-w-[160px] object-contain"
          />
        ) : (
          <span className="text-lg font-bold text-gray-800 truncate">
            {tenantName ?? 'Feedback System'}
          </span>
        )}
      </div>

      {/* ── Middle: Nav items ─────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map(({ href, label, icon, children }) => {
          // A parent is "active" if the pathname exactly matches it
          // It is "expanded" if the pathname starts with its href (covers sub-routes)
          const isActive   = pathname === href;
          const isExpanded = pathname.startsWith(href + '/') || pathname === href;

          return (
            <div key={href}>
              {/* Parent item */}
              <Link
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-white'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                style={isActive ? { backgroundColor: 'var(--brand)', color: '#fff' } : undefined}
              >
                <span
                  className="w-5 h-5 shrink-0"
                  style={isActive ? { color: '#fff' } : { color: '#9CA3AF' }}
                >
                  {icon}
                </span>
                <span className="flex-1">{label}</span>
                {/* Chevron when item has children */}
                {children && children.length > 0 && (
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    style={isActive ? { color: '#fff' } : { color: '#9CA3AF' }}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </Link>

              {/* Sub-items — auto-expand when parent route is active */}
              {children && children.length > 0 && isExpanded && (
                <div className="ml-4 mt-0.5 mb-1 pl-4 border-l border-gray-100 space-y-0.5">
                  {children.map(sub => {
                    const subActive = pathname === sub.href;
                    return (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                          subActive
                            ? 'font-medium text-white'
                            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                        }`}
                        style={subActive ? { backgroundColor: 'var(--brand)', color: '#fff' } : undefined}
                      >
                        {/* Dot indicator */}
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: subActive ? '#fff' : '#D1D5DB' }}
                        />
                        {sub.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── Bottom: User profile ──────────────────────────────────────── */}
      <div className="shrink-0 border-t border-gray-100 px-3 py-4 space-y-1">
        {/* User info row */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0"
            style={{ backgroundColor: 'var(--brand)' }}
          >
            {displayName ? displayName.charAt(0).toUpperCase() : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{displayName}</p>
            <p className="text-xs text-gray-400 truncate">{role}</p>
          </div>
        </div>

        {/* Settings link */}
        <Link
          href="/dashboard/settings"
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Settings
        </Link>

        {/* Sign out button */}
        <button
          onClick={onSignOut}
          disabled={isSigningOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          {isSigningOut ? 'Signing Out…' : 'Sign Out'}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Desktop sidebar (md+): fixed, full height ─────────────────── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-60 z-30">
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer ─────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 md:hidden ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 transform transition-transform duration-300 ease-in-out md:hidden ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close menu"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <SidebarContent />
      </aside>
    </>
  );
};

export default Sidebar;
