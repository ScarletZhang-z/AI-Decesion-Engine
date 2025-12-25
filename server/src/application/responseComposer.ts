export type FieldName = 'contractType' | 'location' | 'department';
export type Tone = 'friendly' | 'professional' | 'concise';

export type ResponsePlan =
  | {
      kind: 'ask';
      nextField: FieldName;
      known: Partial<Record<FieldName, string | null>>;
      quickReplies?: string[];
      textTemplate: string;
    }
  | {
      kind: 'final';
      assigneeEmail: string;
      known: Partial<Record<FieldName, string | null>>;
      tips?: string[];
      textTemplate: string;
    }
  | {
      kind: 'fallback';
      fallbackEmail: string;
      known: Partial<Record<FieldName, string | null>>;
      textTemplate: string;
    };

const QUICK_REPLY_MAP: Partial<Record<FieldName, string[]>> = {
  contractType: ['Sales', 'Employment', 'NDA'],
  location: ['Australia', 'United States'],
};

const questionForField = (field: FieldName): string => {
  switch (field) {
    case 'location':
      return 'Where are you based? (e.g. Australia / United States)';
    case 'contractType':
      return 'Is this Sales, Employment, or NDA?';
    case 'department':
      return 'Which department are you in? (e.g. Engineering / Marketing / Finance)';
    default:
      return 'Could you share a quick detail?';
  }
};

const buildAskTemplate = (field: FieldName): { textTemplate: string; quickReplies?: string[] } => {
  const intro = 'Hello - I can help route this to the right legal teammate.';
  const preface = 'I just need one quick detail:';
  const question = questionForField(field);
  const quickReplies = QUICK_REPLY_MAP[field];

  return {
    textTemplate: `${intro} ${preface} ${question}`,
    quickReplies: quickReplies && quickReplies.length > 0 ? quickReplies : undefined,
  };
};

const summarizeKnown = (known: Partial<Record<FieldName, string | null>>): string => {
  const parts: string[] = [];
  const contractType = known.contractType ?? null;
  const location = known.location ?? null;
  const department = known.department ?? null;

  if (contractType) {
    parts.push(`${contractType} contract request`);
  } else {
    parts.push('contract request');
  }

  if (location) {
    parts.push(`in ${location}`);
  }

  if (department) {
    parts.push(`from ${department}`);
  }

  const summary = parts.join(' ');
  return summary.trim() ? summary : 'request';
};

const buildFinalTemplate = (assigneeEmail: string, known: Partial<Record<FieldName, string | null>>): string => {
  const summary = summarizeKnown(known);
  return `Sounds like a ${summary}. Please email ${assigneeEmail} - they handle this type of request. Tip: include the contract version and any deadline.`;
};

const buildFallbackTemplate = (fallbackEmail: string): string =>
  `I couldn't confidently match this to a specific owner yet. Please email ${fallbackEmail}.`;

export function composePlan(args: {
  userMessage: string;
  known: Partial<Record<FieldName, string | null>>;
  nextField?: FieldName;
  assigneeEmail?: string | null;
  fallbackEmail: string;
  tone?: Tone;
}): ResponsePlan {
  const assigneeEmail = args.assigneeEmail ?? undefined;

  if (args.nextField) {
    const { textTemplate, quickReplies } = buildAskTemplate(args.nextField);
    return {
      kind: 'ask',
      nextField: args.nextField,
      known: args.known,
      quickReplies,
      textTemplate,
    };
  }

  if (assigneeEmail) {
    return {
      kind: 'final',
      assigneeEmail,
      known: args.known,
      tips: ['include the contract version and any deadline'],
      textTemplate: buildFinalTemplate(assigneeEmail, args.known),
    };
  }

  return {
    kind: 'fallback',
    fallbackEmail: args.fallbackEmail,
    known: args.known,
    textTemplate: buildFallbackTemplate(args.fallbackEmail),
  };
}
