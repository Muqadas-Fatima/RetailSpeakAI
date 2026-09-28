"use client";

import { BrainCircuit, RotateCcw } from "lucide-react";
import { ChatComposer, ChatThread, SuggestedPrompts } from "@/components/owner/chat";
import { Panel, PanelBody, PanelHeader } from "@/components/owner/primitives";
import { SectionEmpty } from "@/components/owner/states";
import { useOwnerAgent } from "@/lib/owner/agent";

const DESCRIPTION = "Ask the RetailAI owner agent about sales, stock, suppliers and forecasts.";



function OwnerAgentPage() {
  const { messages, isProcessing, send, retry, clear, prompts } = useOwnerAgent();

  return (
    <Panel>
      <PanelHeader title="AI Agent" description={DESCRIPTION}>
        {messages.length > 0 ? (
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-border px-3 py-1.5 text-xs font-semibold text-brand-navy-deep transition-colors hover:border-brand-accent hover:text-brand-accent "
          >
            <RotateCcw className="h-3.5 w-3.5" />
            New conversation
          </button>
        ) : null}
      </PanelHeader>
      <PanelBody className="space-y-4">
        <ChatThread
          messages={messages}
          onRetry={retry}
          emptyState={
            <SectionEmpty
              title="Start a conversation"
              description="Ask a question about your business, or pick one of the suggestions below."
              icon={BrainCircuit}
            />
          }
        />
        <SuggestedPrompts prompts={prompts} onSelect={send} disabled={isProcessing} />
        <ChatComposer onSend={send} disabled={isProcessing} />
      </PanelBody>
    </Panel>
  );
}

export default OwnerAgentPage;
