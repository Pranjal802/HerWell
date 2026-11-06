import { useState, useEffect, useRef } from "react";
import {
  Sparkles, Send, Trash2, RotateCcw, AlertCircle, Shield, Flower2,
  Copy, Check, Sun, Moon, Apple, CalendarDays, Clock, HeartHandshake
} from "lucide-react";
import { api } from "../lib/api.js";

const suggestedQuestions = [
  { icon: Sun, label: "Healthy morning habits", query: "What are some healthy morning habits to start the day with ease?" },
  { icon: Moon, label: "Improve sleep hygiene", query: "How can I improve my sleeping habits naturally?" },
  { icon: Apple, label: "Plant protein sources", query: "What are healthy vegetarian and plant-based protein sources?" },
  { icon: CalendarDays, label: "My routine for today", query: "What is my routine for today?" },
  { icon: Clock, label: "Upcoming appointments", query: "What appointments are coming up?" },
  { icon: HeartHandshake, label: "Manage everyday stress", query: "How can I gently manage everyday stress and stay calm?" },
];

/**
 * Formats basic markdown elements (headers, bold, lists, paragraphs) cleanly and safely
 */
function FormattedMessage({ text }) {
  if (!text) return null;

  const paragraphs = text.split(/\n\n+/);

  return (
    <div className="hw-ai-formatted">
      {paragraphs.map((para, pIdx) => {
        const trimmedPara = para.trim();

        // Check for Markdown headers (e.g., ### Title or ## Title)
        const headerMatch = trimmedPara.match(/^(#{1,4})\s+(.*)$/);
        if (headerMatch) {
          return (
            <h4 key={pIdx} className="hw-ai-message-heading">
              {formatInline(headerMatch[2])}
            </h4>
          );
        }

        const lines = para.split("\n");
        const isBulletList = lines.every((line) => line.trim().startsWith("- ") || line.trim().startsWith("* "));
        const isNumberList = lines.every((line) => /^\d+\.\s/.test(line.trim()));

        if (isBulletList) {
          return (
            <ul key={pIdx} className="hw-ai-list">
              {lines.map((line, lIdx) => (
                <li key={lIdx}>
                  <span className="hw-ai-bullet-dot" />
                  <span className="hw-ai-list-text">{formatInline(line.trim().replace(/^[-*]\s+/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }

        if (isNumberList) {
          return (
            <ol key={pIdx} className="hw-ai-list hw-ai-list-ordered">
              {lines.map((line, lIdx) => (
                <li key={lIdx}>
                  <span className="hw-ai-list-text">{formatInline(line.trim().replace(/^\d+\.\s+/, ""))}</span>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <p key={pIdx} className="hw-ai-paragraph">
            {lines.map((line, lIdx) => (
              <span key={lIdx}>
                {formatInline(line)}
                {lIdx < lines.length - 1 && <br />}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function formatInline(str) {
  const parts = [];
  let remaining = str;
  let key = 0;

  while (remaining.length > 0) {
    const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(<span key={key++}>{remaining.slice(0, boldMatch.index)}</span>);
      }
      parts.push(<strong key={key++} className="hw-ai-strong">{boldMatch[1]}</strong>);
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
    } else {
      parts.push(<span key={key++}>{remaining}</span>);
      break;
    }
  }

  return parts;
}

export default function AiAssistant({ initialQuestion }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState(initialQuestion || "");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [errorNotice, setErrorNotice] = useState("");
  const [lastFailedMessage, setLastFailedMessage] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = (behavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    let isMounted = true;
    api("/ai/history")
      .then((data) => {
        if (isMounted && data.messages) {
          setMessages(data.messages);
        }
      })
      .catch((err) => {
        if (isMounted) setErrorNotice(err.message || "Failed to load chat history.");
      })
      .finally(() => {
        if (isMounted) setInitialLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    scrollToBottom(initialLoading ? "auto" : "smooth");
  }, [messages, loading, initialLoading]);

  async function handleSend(textToSend) {
    const messageContent = (typeof textToSend === "string" ? textToSend : input).trim();
    if (!messageContent || loading) return;

    setErrorNotice("");
    setInput("");
    setLastFailedMessage("");

    const tempUserMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content: messageContent,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, tempUserMessage]);
    setLoading(true);

    try {
      const data = await api("/ai/chat", {
        method: "POST",
        body: { message: messageContent },
      });

      const assistantMessage = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        createdAt: data.createdAt || new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setErrorNotice(err.message || "HerWell AI could not complete your request. Please try again.");
      setLastFailedMessage(messageContent);
    } finally {
      setLoading(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleInputResize(e) {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
  }

  async function handleClearHistory() {
    try {
      await api("/ai/history", { method: "DELETE" });
      setMessages([]);
      setConfirmClear(false);
      setErrorNotice("");
      setLastFailedMessage("");
    } catch (err) {
      setErrorNotice(err.message || "Could not clear chat history.");
    }
  }

  function handleRetry() {
    if (lastFailedMessage) {
      handleSend(lastFailedMessage);
    }
  }

  async function copyToClipboard(text, id) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }

  return (
    <div className="hw-ai-container">
      {/* Modern Glassmorphic Header */}
      <header className="hw-ai-header">
        <div className="hw-ai-brand">
          <div className="hw-ai-icon-badge">
            <Sparkles size={20} className="hw-ai-sparkle-icon" />
          </div>
          <div>
            <div className="hw-ai-title-row">
              <h2 className="hw-ai-title">HerWell AI</h2>
              <span className="hw-ai-status-pill">
                <span className="hw-ai-status-dot" />
                Companion
              </span>
            </div>
            <p className="hw-ai-subtitle">Everyday wellness, habits & schedule companion</p>
          </div>
        </div>

        <div className="hw-ai-header-actions">
          {messages.length > 0 && (
            confirmClear ? (
              <div className="hw-ai-confirm-clear">
                <span className="hw-ai-confirm-text">Clear all?</span>
                <button
                  type="button"
                  className="hw-ai-clear-confirm-btn"
                  onClick={handleClearHistory}
                >
                  Yes, clear
                </button>
                <button
                  type="button"
                  className="hw-ai-clear-cancel-btn"
                  onClick={() => setConfirmClear(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="hw-ai-action-btn"
                onClick={() => setConfirmClear(true)}
                title="Clear conversation history"
                aria-label="Clear conversation history"
              >
                <Trash2 size={15} />
                <span>Clear chat</span>
              </button>
            )
          )}
        </div>
      </header>

      {/* Safety & External AI Reassurance Badge */}
      <div className="hw-ai-disclaimer-banner">
        <Shield size={14} className="hw-ai-shield-icon" />
        <span>
          HerWell AI provides educational wellness and schedule guidance. Powered by Google Gemini — not a doctor or medical emergency service.
        </span>
      </div>

      {/* Messages Scroll Area */}
      <div className="hw-ai-messages-area">
        {initialLoading ? (
          <div className="hw-ai-loading-screen">
            <Flower2 size={28} className="animate-spin text-[#0E7C7B]" />
            <span>Connecting with your wellness space…</span>
          </div>
        ) : (
          <>
            {/* Friendly Greeting Card */}
            <div className="hw-ai-welcome-card">
              <div className="hw-ai-avatar">
                <Sparkles size={18} />
              </div>
              <div className="hw-ai-welcome-body">
                <p className="hw-ai-welcome-text">
                  Hello! I'm your HerWell AI wellness companion. You can ask me questions about everyday wellness, nutrition education, healthy habits, and your HerWell routines or schedule. How can I help you today?
                </p>
              </div>
            </div>

            {/* Conversation Bubbles */}
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const msgId = msg.id || index;
              return (
                <div
                  key={msgId}
                  className={`hw-ai-message-row ${isUser ? "is-user" : "is-ai"}`}
                >
                  {!isUser && (
                    <div className="hw-ai-avatar hw-ai-avatar-message">
                      <Sparkles size={16} />
                    </div>
                  )}
                  <div className={`hw-ai-bubble ${isUser ? "hw-ai-bubble-user" : "hw-ai-bubble-ai"}`}>
                    <FormattedMessage text={msg.content} />

                    <div className="hw-ai-bubble-footer">
                      <span className="hw-ai-time">
                        {msg.createdAt
                          ? new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                          : ""}
                      </span>

                      {!isUser && (
                        <button
                          type="button"
                          className="hw-ai-copy-btn"
                          onClick={() => copyToClipboard(msg.content, msgId)}
                          title="Copy advice"
                          aria-label="Copy advice"
                        >
                          {copiedId === msgId ? <Check size={13} className="text-[#1E8E5A]" /> : <Copy size={13} />}
                          <span>{copiedId === msgId ? "Copied" : "Copy"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Calming Thinking State */}
            {loading && (
              <div className="hw-ai-message-row is-ai">
                <div className="hw-ai-avatar hw-ai-avatar-message">
                  <Sparkles size={16} className="animate-pulse text-[#0E7C7B]" />
                </div>
                <div className="hw-ai-bubble hw-ai-bubble-ai hw-ai-thinking">
                  <span className="hw-ai-dot" />
                  <span className="hw-ai-dot" />
                  <span className="hw-ai-dot" />
                  <span className="hw-ai-thinking-text">Reflecting gently on your request…</span>
                </div>
              </div>
            )}

            {/* Error Notification with Immediate Retry */}
            {errorNotice && (
              <div className="hw-ai-error-box">
                <div className="hw-ai-error-content">
                  <AlertCircle size={18} className="hw-ai-error-icon" />
                  <span className="hw-ai-error-message">{errorNotice}</span>
                </div>
                {lastFailedMessage && (
                  <button
                    type="button"
                    className="hw-ai-retry-btn"
                    onClick={handleRetry}
                    disabled={loading}
                  >
                    <RotateCcw size={14} />
                    <span>Retry message</span>
                  </button>
                )}
              </div>
            )}

            {/* Modern Categorized Suggested Inquiries */}
            {messages.length <= 1 && !loading && (
              <div className="hw-ai-suggestions-section">
                <p className="hw-ai-suggestions-label">Explore wellness topics & your schedule:</p>
                <div className="hw-ai-suggestions-grid">
                  {suggestedQuestions.map(({ icon: Icon, label, query }) => (
                    <button
                      key={label}
                      type="button"
                      className="hw-ai-suggestion-chip"
                      onClick={() => handleSend(query)}
                    >
                      <Icon size={14} className="hw-ai-chip-icon" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Modern Auto-Expanding Input Footer */}
      <footer className="hw-ai-footer-input">
        <form
          className="hw-ai-input-form"
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
        >
          <textarea
            ref={textareaRef}
            className="hw-ai-textarea"
            placeholder="Ask about wellness, nutrition, or your HerWell schedule…"
            value={input}
            onChange={handleInputResize}
            onKeyDown={handleKeyDown}
            disabled={loading}
            rows={1}
            maxLength={2000}
            aria-label="Ask HerWell AI"
          />
          <button
            type="submit"
            className="hw-ai-send-btn"
            disabled={!input.trim() || loading}
            aria-label="Send question"
            title="Send"
          >
            <Send size={18} />
          </button>
        </form>
        <div className="hw-ai-footer-notes">
          <span>Shift + Enter for new line • Enter to send</span>
          <span>{input.length}/2000</span>
        </div>
      </footer>
    </div>
  );
}
