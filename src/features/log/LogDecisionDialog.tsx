// Placeholder from the scaffold; the feature agent replaces this file.
// Contract: opened from the options page; on save it dispatches `logDecision`
// and navigates to /decisions/:id.
export interface LogDecisionDialogProps {
  decisionId: string;
  open: boolean;
  onClose: () => void;
  chosenOptionId?: string;
}

export function LogDecisionDialog(_props: LogDecisionDialogProps) {
  return null;
}
