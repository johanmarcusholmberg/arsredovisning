interface NoteReferenceBadgeProps {
  noteNumber: number;
  onClick?: () => void;
}

export function NoteReferenceBadge({ noteNumber, onClick }: NoteReferenceBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
      title={`Gå till Not ${noteNumber}`}
    >
      Not {noteNumber}
    </button>
  );
}
