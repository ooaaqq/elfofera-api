import { ChevronDown } from "@carbon/icons-react";
import { Link } from "@carbon/react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { formatLocation } from "./navigation.js";
import { PageHeader } from "./page-header.jsx";

function scrollToSection(id, smooth) {
  const heading = document.getElementById(`${id}-title`);
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  heading?.scrollIntoView({
    block: "start",
    behavior: smooth && !reduceMotion ? "smooth" : "instant",
  });
  heading?.focus({ preventScroll: true });
  return Boolean(heading && smooth && !reduceMotion);
}

export function DocumentationPage({
  title,
  intro,
  sections,
  route,
  navigate,
  children,
}) {
  const clickedSection = useRef("");
  const pendingSection = useRef("");
  const toc = useRef(null);
  const tocButton = useRef(null);
  const tocList = useRef(null);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeSection, setActiveSection] = useState(
    route.section || sections[0].id,
  );

  const showSection = useCallback((id, smooth) => {
    setActiveSection(id);
    pendingSection.current = scrollToSection(id, smooth) ? id : "";
  }, []);

  useLayoutEffect(() => {
    const list = tocList.current;
    const active =
      list.children[
        sections.findIndex(({ id }) => id === activeSection)
      ]?.querySelector("a");
    const update = () => {
      if (!active) return;
      list.style.setProperty("--toc-active-top", `${active.offsetTop}px`);
      list.style.setProperty("--toc-active-height", `${active.offsetHeight}px`);
      if (tocOpen) {
        const padding = Number.parseFloat(getComputedStyle(list).paddingTop);
        if (active.offsetTop < list.scrollTop + padding) {
          list.scrollTop = active.offsetTop - padding;
        } else if (
          active.offsetTop + active.offsetHeight >
          list.scrollTop + list.clientHeight - padding
        ) {
          list.scrollTop =
            active.offsetTop +
            active.offsetHeight -
            list.clientHeight +
            padding;
        }
      }
    };
    const observer = new ResizeObserver(update);
    for (const link of list.querySelectorAll("a")) observer.observe(link);
    observer.observe(list);
    update();
    return () => observer.disconnect();
  }, [activeSection, sections, tocOpen]);

  useEffect(() => {
    const headings = sections.map(({ id }) =>
      document.getElementById(`${id}-title`),
    );
    let frame;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (pendingSection.current) return;
        const scrollPadding = Number.parseFloat(
          getComputedStyle(document.documentElement).scrollPaddingTop,
        );
        const passed = headings.filter(
          (heading) =>
            heading &&
            heading.getBoundingClientRect().top <=
              scrollPadding +
                Number.parseFloat(getComputedStyle(heading).scrollMarginTop) +
                16,
        );
        setActiveSection(
          passed.at(-1)?.id.replace(/-title$/, "") || sections[0].id,
        );
      });
    };
    const release = () => {
      pendingSection.current = "";
      update();
    };
    const interrupt = (event) => {
      if (
        event.type !== "keydown" ||
        [
          "ArrowUp",
          "ArrowDown",
          "PageUp",
          "PageDown",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      )
        release();
    };
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("scrollend", release);
    window.addEventListener("wheel", interrupt, { passive: true });
    window.addEventListener("touchstart", interrupt, { passive: true });
    window.addEventListener("keydown", interrupt);
    update();
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scrollend", release);
      window.removeEventListener("wheel", interrupt);
      window.removeEventListener("touchstart", interrupt);
      window.removeEventListener("keydown", interrupt);
      cancelAnimationFrame(frame);
    };
  }, [sections]);

  useEffect(() => {
    if (!tocOpen) return;
    const closeOutside = (event) => {
      if (!toc.current?.contains(event.target)) setTocOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setTocOpen(false);
      tocButton.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [tocOpen]);

  useEffect(() => {
    if (!route.section) {
      const frame = requestAnimationFrame(() => {
        window.scrollTo({ top: 0 });
        if (document.activeElement?.closest(".documentation-section")) {
          document
            .getElementById("documentation-title")
            ?.focus({ preventScroll: true });
        }
      });
      return () => cancelAnimationFrame(frame);
    }
    if (!sections.some(({ id }) => id === route.section)) return;
    let cancelled = false;
    let frame;
    document.fonts.ready.then(() => {
      if (cancelled) return;
      frame = requestAnimationFrame(() => {
        showSection(route.section, clickedSection.current === route.section);
        clickedSection.current = "";
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [route.section, sections, showSection]);

  return (
    <article
      className="documentation-page"
      aria-labelledby="documentation-title"
    >
      <PageHeader
        title={title}
        intro={intro}
        document
        id="documentation-title"
      />
      <div className="documentation-layout">
        <nav
          ref={toc}
          className="documentation-toc"
          aria-label="本页目录"
          data-expanded={tocOpen}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              setTocOpen(false);
          }}
        >
          <button
            ref={tocButton}
            type="button"
            className="documentation-toc-trigger"
            aria-expanded={tocOpen}
            aria-controls="documentation-toc-list"
            onClick={() => setTocOpen(!tocOpen)}
          >
            本页内容 <ChevronDown size={16} aria-hidden="true" />
          </button>
          <ul ref={tocList} id="documentation-toc-list">
            {sections.map(({ id, title: label }) => (
              <li key={id}>
                <Link
                  href={formatLocation({ ...route, section: id })}
                  aria-current={activeSection === id ? "location" : undefined}
                  onClick={(event) => {
                    if (
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    setTocOpen(false);
                    clickedSection.current = id;
                    navigate({ section: id });
                    if (route.section === id) showSection(id, true);
                  }}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="documentation-content">{children}</div>
      </div>
    </article>
  );
}

export function DocumentationSection({ id, title, children }) {
  return (
    <section className="documentation-section" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} tabIndex={-1}>
        {title}
      </h2>
      {children}
    </section>
  );
}
