import { useState, useEffect } from "react";
import { Smartphone, Download, Share, PlusSquare, X, Check, Heart } from "lucide-react";

export default function InstallAppModal({ isOpen, onClose }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed in standalone mode
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    setIsStandalone(!!standalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Capture Android / Chrome beforeinstallprompt event
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setDeferredPrompt(null);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="hw-sheet-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="hw-install-modal" role="dialog" aria-modal="true" aria-labelledby="install-title">
        <header className="hw-install-header">
          <div className="hw-install-badge">
            <Smartphone size={24} className="text-[#0E7C7B]" />
          </div>
          <button className="hw-icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </header>

        <div className="hw-install-body">
          <h2 id="install-title" className="hw-install-title">
            Install HerWell on Her Phone
          </h2>
          <p className="hw-install-desc">
            Install HerWell as a dedicated, private home-screen app. It opens instantly, works full-screen without address bars, and provides gentle notifications.
          </p>

          {isStandalone || installed ? (
            <div className="hw-install-success-banner">
              <Check size={20} className="text-[#1E8E5A]" />
              <span>HerWell is installed on this device!</span>
            </div>
          ) : isIOS ? (
            /* iOS / iPhone Instructions */
            <div className="hw-install-steps">
              <p className="hw-install-steps-title">Follow these 2 quick steps in Safari on her iPhone:</p>
              <div className="hw-install-step-row">
                <span className="hw-install-step-num">1</span>
                <div className="hw-install-step-content">
                  <p>Tap the <strong>Share</strong> button at the bottom of Safari.</p>
                  <span className="hw-install-hint"><Share size={15} /> Look for the square with the arrow pointing up.</span>
                </div>
              </div>
              <div className="hw-install-step-row">
                <span className="hw-install-step-num">2</span>
                <div className="hw-install-step-content">
                  <p>Scroll down and tap <strong>"Add to Home Screen"</strong>.</p>
                  <span className="hw-install-hint"><PlusSquare size={15} /> It adds the HerWell icon right alongside her other apps.</span>
                </div>
              </div>
            </div>
          ) : deferredPrompt ? (
            /* Android Direct Install Button */
            <div className="hw-install-android">
              <button className="hw-install-btn" onClick={handleInstallClick}>
                <Download size={18} />
                <span>Install HerWell App Now</span>
              </button>
              <p className="hw-install-subtext">No App Store or Play Store download needed.</p>
            </div>
          ) : (
            /* General Browser Steps (Android Chrome / other) */
            <div className="hw-install-steps">
              <p className="hw-install-steps-title">In Chrome or your phone's browser:</p>
              <div className="hw-install-step-row">
                <span className="hw-install-step-num">1</span>
                <div className="hw-install-step-content">
                  <p>Tap the <strong>three dots menu (⋮)</strong> in the top-right corner.</p>
                </div>
              </div>
              <div className="hw-install-step-row">
                <span className="hw-install-step-num">2</span>
                <div className="hw-install-step-content">
                  <p>Select <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <footer className="hw-install-footer">
          <Heart size={15} className="text-[#FF6B4A]" />
          <span>Made for everyday wellbeing, privacy, and calm.</span>
        </footer>
      </div>
    </div>
  );
}

