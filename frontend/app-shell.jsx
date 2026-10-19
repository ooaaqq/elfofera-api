import { Calendar, Code, Music } from "@carbon/icons-react";
import {
  Header,
  HeaderMenuButton,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Theme,
} from "@carbon/react";
import { useEffect, useState } from "react";

export function AppShell({ view, onChangeView, children }) {
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 1056px)").matches,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const expanded = desktop || mobileOpen;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1056px)");
    const update = () => {
      setDesktop(media.matches);
      setMobileOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <Theme theme="g10">
      <Theme theme="white">
        <Header aria-label="EOE 档案">
          <SkipToContent href="#main-content">跳转到主要内容</SkipToContent>
          <HeaderMenuButton
            id="nav-trigger"
            aria-controls="primary-navigation"
            aria-expanded={expanded}
            aria-label={mobileOpen ? "关闭导航" : "打开导航"}
            isActive={mobileOpen}
            isCollapsible
            onClick={() => setMobileOpen((open) => !open)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && mobileOpen) {
                setMobileOpen(false);
              }
            }}
          />
          <HeaderName
            href="#archive"
            prefix="EOE"
            onClick={(event) => {
              event.preventDefault();
              onChangeView("archive");
              setMobileOpen(false);
            }}
          >
            档案
          </HeaderName>
        </Header>
        <SideNav
          id="primary-navigation"
          aria-label="主导航"
          expanded={expanded}
          onToggle={(event, open) => {
            setMobileOpen(open);
            if (event?.key === "Escape")
              document.getElementById("nav-trigger")?.focus();
          }}
          onOverlayClick={() => {
            setMobileOpen(false);
            document.getElementById("nav-trigger")?.focus();
          }}
        >
          <SideNavItems>
            {[
              { id: "archive", label: "直播档案", icon: Calendar },
              { id: "songs", label: "歌曲档案", icon: Music },
              { id: "api", label: "API 使用说明", icon: Code },
            ].map(({ id, label, icon }) => (
              <SideNavLink
                key={id}
                href={`#${id}`}
                isActive={view === id}
                aria-current={view === id ? "page" : undefined}
                renderIcon={icon}
                onClick={(event) => {
                  event.preventDefault();
                  onChangeView(id);
                  setMobileOpen(false);
                }}
              >
                {label}
              </SideNavLink>
            ))}
          </SideNavItems>
        </SideNav>
      </Theme>
      <main id="main-content" className="app-content" tabIndex={-1}>
        <div className="workspace">{children}</div>
      </main>
    </Theme>
  );
}
