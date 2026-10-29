import {
  Header,
  HeaderMenuButton,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Theme,
  usePrefersDarkScheme,
} from "@carbon/react";
import { useEffect, useRef, useState } from "react";

const navigation = [
  {
    label: "档案",
    links: [
      { id: "archive", label: "直播档案" },
      { id: "songs", label: "歌曲档案" },
    ],
  },
  {
    label: "项目",
    links: [
      { id: "api", label: "API 使用说明" },
      { id: "thanks", label: "致谢" },
    ],
  },
];
const titles = { archive: "直播档案", songs: "歌曲档案" };

export function AppShell({ view, onChangeView, children, invalid }) {
  const dark = usePrefersDarkScheme();
  const [desktop, setDesktop] = useState(
    () => window.matchMedia("(min-width: 1056px)").matches,
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef(null);
  const contentRef = useRef(null);
  const expanded = desktop || mobileOpen;
  const dataView = Boolean(titles[view]) && !invalid;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1056px)");
    const update = () => {
      setDesktop(media.matches);
      setMobileOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (desktop || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const previousFocus = document.activeElement;
    contentRef.current.inert = true;
    navRef.current.querySelector('[aria-current="page"]')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      contentRef.current.inert = false;
      if (navRef.current.contains(document.activeElement)) {
        previousFocus?.focus({ preventScroll: true });
      }
    };
  }, [desktop, mobileOpen]);

  function closeNavigation() {
    setMobileOpen(false);
    document.getElementById("nav-trigger")?.focus();
  }

  function handleNavigationKeys(event) {
    if (desktop || !mobileOpen) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeNavigation();
    }
    if (event.key !== "Tab") return;
    // Keep Carbon's window-level Tab handler from moving focus outside this loop.
    event.stopPropagation();
    const controls = [
      document.getElementById("nav-trigger"),
      ...navRef.current.querySelectorAll("a[href]"),
    ];
    const index = controls.indexOf(event.target.closest("a, button"));
    const direction = event.shiftKey ? -1 : 1;
    event.preventDefault();
    controls[(index + direction + controls.length) % controls.length]?.focus();
  }

  return (
    <Theme className="app-shell" theme={dark ? "g100" : "g10"}>
      <Theme theme={dark ? "g100" : "white"}>
        <Header aria-label="EOE 档案">
          <SkipToContent
            href="#main-content"
            onClick={(event) => {
              event.preventDefault();
              contentRef.current.focus({ preventScroll: true });
              window.scrollTo({ top: 0, behavior: "instant" });
            }}
          >
            跳转到主要内容
          </SkipToContent>
          <HeaderMenuButton
            id="nav-trigger"
            aria-controls="primary-navigation"
            aria-expanded={expanded}
            aria-label={mobileOpen ? "关闭导航" : "打开导航"}
            isActive={mobileOpen}
            isCollapsible
            onClick={() => setMobileOpen((open) => !open)}
            onKeyDown={handleNavigationKeys}
          />
          <HeaderName
            href="#archive"
            prefix=""
            onClick={(event) => {
              if (
                event.metaKey ||
                event.ctrlKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              onChangeView("archive");
              setMobileOpen(false);
            }}
          >
            EOE 档案
          </HeaderName>
        </Header>
        <SideNav
          ref={navRef}
          id="primary-navigation"
          className="site-navigation"
          aria-label="主导航"
          expanded={expanded}
          isFixedNav={desktop}
          addFocusListeners={false}
          addMouseListeners={false}
          onKeyDown={handleNavigationKeys}
          onOverlayClick={closeNavigation}
        >
          <SideNavItems>
            {navigation.map((group) => (
              <li key={group.label} className="navigation-group">
                <h2 className="navigation-group-title">{group.label}</h2>
                <ul>
                  {group.links.map(({ id, label }) => (
                    <SideNavLink
                      key={id}
                      href={`#${id}`}
                      isActive={view === id}
                      aria-current={view === id ? "page" : undefined}
                      onClick={(event) => {
                        if (
                          event.metaKey ||
                          event.ctrlKey ||
                          event.shiftKey ||
                          event.altKey
                        )
                          return;
                        event.preventDefault();
                        onChangeView(id);
                        setMobileOpen(false);
                      }}
                    >
                      {label}
                    </SideNavLink>
                  ))}
                </ul>
              </li>
            ))}
          </SideNavItems>
        </SideNav>
      </Theme>
      <main
        id="main-content"
        className="app-content"
        tabIndex={-1}
        ref={contentRef}
      >
        <div className="workspace">
          {dataView && <h1 className="visually-hidden">{titles[view]}</h1>}
          <div
            key={view}
            className={`view-content${dataView ? " data-workspace" : ""}`}
          >
            {children}
          </div>
        </div>
      </main>
    </Theme>
  );
}
