import type * as React from 'react';

export {};

declare global {
  interface Window {
    electronAPI?: {
      openFolder?: () => Promise<string | null>;
      openExternal?: (url: string) => Promise<boolean>;
      minimizeWindow?: () => Promise<void>;
      maximizeWindow?: () => Promise<boolean>;
      closeWindow?: () => Promise<void>;
      isWindowMaximized?: () => Promise<boolean>;
    };
  }

  namespace JSX {
    interface IntrinsicElements {
      webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        src?: string;
        allowpopups?: string;
        webpreferences?: string;
        preload?: string;
        partition?: string;
      };
    }
  }
}
