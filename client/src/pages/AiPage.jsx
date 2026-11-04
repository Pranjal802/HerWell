import PageHeader from "../components/PageHeader.jsx";
import AiAssistant from "../components/AiAssistant.jsx";

export default function AiPage() {
  return (
    <div className="hw-ai-page">
      <PageHeader
        eyebrow="AI WELLNESS COMPANION"
        title="HerWell AI"
        description="Ask questions about general wellness, habits, nutrition education, or your HerWell schedule."
      />
      <div className="hw-ai-page-body">
        <AiAssistant />
      </div>
    </div>
  );
}

