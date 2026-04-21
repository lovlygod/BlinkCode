import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useEditor } from '../../store/EditorContext';
import './BrowserPreview.css';

function normalizeBrowserUrl(rawUrl: string): string | null {
  const value = rawUrl.trim();
  if (!value) return null;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `http://${value}`;

  try {
    const parsed = new URL(withProtocol);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export default function BrowserPreview() {
  const {
    state,
    closeBrowserPreview,
    openBrowserPreview,
    setBrowserUrl,
    setBrowserLoading,
    setBrowserNavState,
    setBrowserError,
  } = useEditor();

  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [addressValue, setAddressValue] = useState(state.browserUrl || '');

  useEffect(() => {
    setAddressValue(state.browserUrl || '');
  }, [state.browserUrl]);

  const validatedUrl = useMemo(() => normalizeBrowserUrl(state.browserUrl || ''), [state.browserUrl]);
  const isSupportedUrl = Boolean(validatedUrl);

  useEffect(() => {
    setBrowserNavState(false, false);
  }, [validatedUrl, setBrowserNavState]);

  const submitAddress = (event: FormEvent) => {
    event.preventDefault();
    const nextUrl = normalizeBrowserUrl(addressValue);
    if (!nextUrl) {
      setBrowserError('Only valid http:// or https:// URLs are allowed in preview.');
      return;
    }

    setBrowserError(null);
    openBrowserPreview(nextUrl);
  };

  const openExternal = () => {
    if (!validatedUrl) return;
    const electronApi = (window as any).electronAPI;
    if (electronApi?.openExternal) {
      electronApi.openExternal(validatedUrl).catch(() => {});
      return;
    }
    window.open(validatedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleReload = () => {
    setBrowserLoading(true);
    setBrowserError(null);
    if (iframeRef.current && validatedUrl) {
      iframeRef.current.src = validatedUrl;
    }
  };

  const handleBack = () => undefined;

  const handleForward = () => undefined;

  const handleIframeLoad = () => {
    setBrowserLoading(false);
    setBrowserError(null);
    if (validatedUrl) setBrowserUrl(validatedUrl);
  };

  const handleIframeError = () => {
    setBrowserLoading(false);
    setBrowserError('Failed to load the requested page in iframe preview.');
  };

  return (
    <section className="browser-preview">
      <header className="browser-preview-toolbar">
        <div className="browser-preview-toolbar-group">
          <button type="button" className="browser-preview-button" onClick={handleBack} disabled={!state.browserCanGoBack} title="Back">
            <ArrowLeft size={16} />
          </button>
          <button type="button" className="browser-preview-button" onClick={handleForward} disabled={!state.browserCanGoForward} title="Forward">
            <ArrowRight size={16} />
          </button>
          <button type="button" className="browser-preview-button" onClick={handleReload} disabled={!isSupportedUrl} title="Reload">
            <RefreshCw size={16} className={state.browserLoading ? 'browser-preview-spin' : ''} />
          </button>
        </div>

        <form className="browser-preview-address" onSubmit={submitAddress}>
          <Globe size={15} className="browser-preview-address-icon" />
          <input
            type="text"
            value={addressValue}
            onChange={(event) => setAddressValue(event.target.value)}
            placeholder="Enter URL (http:// or https://)"
            spellCheck={false}
          />
        </form>

        <div className="browser-preview-toolbar-group">
          <button type="button" className="browser-preview-button" onClick={openExternal} disabled={!isSupportedUrl} title="Open in external browser">
            <ExternalLink size={16} />
          </button>
          <button type="button" className="browser-preview-button browser-preview-button-danger" onClick={closeBrowserPreview} title="Close preview">
            <X size={16} />
          </button>
        </div>
      </header>

      <div className="browser-preview-body">
        {!state.browserUrl && (
          <div className="browser-preview-empty-state">
            <Globe size={32} />
            <h2>Browser preview</h2>
            <p>Open a link from the terminal or paste a local dev-server URL into the address bar.</p>
          </div>
        )}

        {state.browserUrl && !isSupportedUrl && (
          <div className="browser-preview-empty-state browser-preview-empty-state-error">
            <ShieldAlert size={32} />
            <h2>Blocked URL</h2>
            <p>Embedded preview only allows safe http:// and https:// addresses.</p>
          </div>
        )}

        {state.browserUrl && isSupportedUrl && (
          <>
            {state.browserError && (
              <div className="browser-preview-overlay browser-preview-overlay-error">
                <ShieldAlert size={22} />
                <div>
                  <strong>Unable to load page</strong>
                  <p>{state.browserError}</p>
                </div>
              </div>
            )}

            <iframe
              ref={iframeRef}
              className="browser-preview-frame"
              src={validatedUrl || undefined}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin"
              referrerPolicy="no-referrer"
              title="BlinkCode Browser Preview"
            />
          </>
        )}
      </div>
    </section>
  );
}
