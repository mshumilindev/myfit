/**
 * ThemeFrame — draws its children as they look in ANOTHER theme. Every theme is a set of rules on
 * `html[data-theme=<id>]`, so the only way to show a theme the page is not wearing is a second
 * document: an iframe that carries a copy of the app's stylesheets and `data-theme=<id>` on its own
 * <html>. The children are React-portalled into it (so they stay live: Apply still works and the
 * i18n context is shared) and the frame grows to its content. The frame declares the app's `color-scheme: dark`
 * like index.html does: a frame whose scheme differs from the page's gets an opaque white canvas, which turns
 * glass surfaces milky.
 */
import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Room around the card inside the frame (its shadow); themes.css pulls the frame out by the same amount. */
const PAD = 6;

/** Phases of the app / theme / route transitions on `<html>`: they belong to the page, never to a frame. */
const TRANSITION_ATTRS = ['data-glitch', 'data-route'];

/** Copies the page's `<link rel=stylesheet>` and `<style>` nodes into the frame's head. */
function copyStyles(from: Document, to: Document): void {
  from.querySelectorAll('link[rel="stylesheet"], style').forEach((n) => {
    to.head.appendChild(to.importNode(n, true));
  });
}

export function ThemeFrame({
  themeId,
  title,
  children,
}: {
  themeId: string;
  title: string;
  children: ReactNode;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);

  // The frame's document only exists for good once its srcdoc has loaded (before that it is a throwaway
  // about:blank), so everything starts from the load event.
  const setup = useCallback(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    // the other look axes (mode / accent / density) follow the page; only the theme differs
    // (not the transition phases: a frame born while a theme change is playing would keep the veil for good)
    for (const a of Array.from(document.documentElement.attributes)) {
      if (a.name.startsWith('data-') && !TRANSITION_ATTRS.includes(a.name)) {
        doc.documentElement.setAttribute(a.name, a.value);
      }
    }
    doc.documentElement.setAttribute('data-theme', themeId);
    doc.body.style.margin = '0';
    doc.body.style.padding = `${PAD}px`;
    // the frame is a window onto the page: the card, not a box of the theme's page colour (or photo), is what
    // changes theme
    doc.documentElement.style.background = 'transparent';
    doc.body.style.background = 'transparent';
    const style = doc.createElement('style');
    // the app's body says `overscroll-behavior: none`, which would stop the wheel from reaching the page
    // when the pointer is over a frame
    style.textContent =
      'body::after{display:none!important}html,body{overscroll-behavior:auto!important}';
    doc.head.appendChild(style);
    copyStyles(document, doc);
    // the content gets its own host node: if the frame is torn down first, React still finds its children
    // under their own parent when it cleans up
    const host = doc.createElement('div');
    doc.body.appendChild(host);
    setBody(host);
  }, [themeId]);

  // the frame is exactly as tall as its content
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || !body || typeof ResizeObserver === 'undefined') return;
    const fit = () => {
      frame.style.height = `${body.getBoundingClientRect().height + 2 * PAD}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(body);
    return () => ro.disconnect();
  }, [body]);

  return (
    <>
      <iframe
        ref={frameRef}
        onLoad={setup}
        className="thm-frame"
        title={title}
        srcDoc="<!doctype html><html><head><meta charset='utf-8'><meta name='color-scheme' content='dark'></head><body></body></html>"
      />
      {body ? createPortal(children, body) : null}
    </>
  );
}
