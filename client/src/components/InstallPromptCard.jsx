import { useState, useEffect } from "react";
import { Smartphone, Download, Share, PlusSquare, X, Check } from "lucide-react";

export default function InstallPromptCard({ inModal = false }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIosInstructions, setShowIosInstructions] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // 1. Detect standalone mode (already installed and running as PWA)
    const checkStandalone = () => {
      const isMediaStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
      const isNavigatorStandalone = window.navigator.standalone === true;
      return Boolean(isMediaStandalone || isNavigatorStandalone);
    };

    setIsStandalone(checkStandalone());

    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handleDisplayChange = (e) => {
      setIsStandalone(e.matches);
    };
    if (mediaQuery?.addEventListener) {
      mediaQuery.addEventListener("change", handleDisplayChange);
    }

    // 2. Detect iOS environment
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleMobile = /iphone|ipad|ipod/.test(ua) && !window.MSStream;
    setIsIOS(isAppleMobile);

    // 3. Android / Chrome beforeinstallprompt event capture
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 4. Listen for app installed event
    const handleAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (mediaQuery?.removeEventListener) {
        mediaQuery.removeEventListener("change", handleDisplayChange);
      }
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIosInstructions(true);
    } else {
      // Fallback instruction toggle for other browsers
      setShowIosInstructions((prev) => !prev);
    }
  }

  // Hide the banner if the application is already running in standalone mode
  if (isStandalone || installed) {
    return null;
  }

  return (
    <div className="hw-pwa-install-card" role="region" aria-label="Install HerWell">
      <div className="hw-pwa-install-icon-wrapper">
        <Smartphone size={24} className="text-[#0E7C7B]" />
      </div>

      <div className="hw-pwa-install-content">
        <h3 className="hw-pwa-install-title">Install HerWell on Your Phone</h3>
        <p className="hw-pwa-install-desc">
          Add HerWell to your home screen for quick access and a full-screen app experience.
        </p>

        <div className="hw-pwa-install-actions">
          <button
            type="button"
            className="hw-pwa-install-btn"
            onClick={handleInstallClick}
          >
            <Download size={16} />
            <span>Install HerWell</span>
          </button>
        </div>

        {/* iPhone / Safari or Fallback Manual Instructions */}
        {showIosInstructions && (
          <div className="hw-pwa-ios-instructions">
            <div className="hw-pwa-ios-header">
              <span>Follow these steps in Safari:</span>
              <button
                type="button"
                className="hw-pwa-close-btn"
                onClick={() => setShowIosInstructions(false)}
                aria-label="Close instructions"
              >
                <X size={14} />
              </button>
            </div>
            <ol className="hw-pwa-steps-list">
              <li>1. Open HerWell in Safari.</li>
              <li>
                2. Tap the <strong>Share</strong> button <Share size={13} className="inline ml-1 text-[#0E7C7B]" /> at the bottom.
              </li>
              <li>
                3. Select <strong>Add to Home Screen</strong> <PlusSquare size={13} className="inline ml-1 text-[#0E7C7B]" />.
              </li>
              <li>4. Tap <strong>Add</strong> in the top-right corner.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

