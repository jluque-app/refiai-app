"use client";

import { useCallback } from "react";

/**
 * ContentGuard — copy/scrape deterrent for lesson content.
 *
 * What it does:
 *  - blocks the right-click context menu on course text
 *  - lets students select/copy SMALL passages (fair use, note-taking) but
 *    replaces large copies (> 400 chars) with a copyright notice
 *  - suppresses printing of the guarded area via CSS (print rules in globals)
 *
 * What it can't do (be honest): nothing client-side stops screenshots, OCR,
 * or a determined scraper. Real protection = copyright + terms of use + keeping
 * premium content behind accounts, plus the AI-crawler blocks in robots.ts.
 */

const NOTICE =
  "© ReFiAI — Prof. Jaime Luque. This course material is copyrighted and may not be reproduced or used to train AI systems. https://refiai.allretech.org";

export default function ContentGuard({ children }: { children: React.ReactNode }) {
  const onCopy = useCallback((e: React.ClipboardEvent) => {
    const selection = window.getSelection()?.toString() ?? "";
    if (selection.length > 400) {
      e.preventDefault();
      e.clipboardData.setData("text/plain", NOTICE);
    } else if (selection.length > 0) {
      // small quotes are fine — but they carry attribution with them
      e.preventDefault();
      e.clipboardData.setData("text/plain", `${selection}\n\n— ${NOTICE}`);
    }
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div onCopy={onCopy} onContextMenu={onContextMenu} className="content-guard">
      {children}
    </div>
  );
}
