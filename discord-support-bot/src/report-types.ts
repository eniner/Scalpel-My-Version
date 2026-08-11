export const REPORT_TYPES = {
  bug: {
    label: 'Bug',
    emoji: '🐛',
    color: 0xe74c3c,
    description: 'Something broken or unexpected in Scalpel',
  },
  issue: {
    label: 'Issue',
    emoji: '⚠️',
    color: 0xf39c12,
    description: 'Install, login, filter, or setup problem',
  },
  feedback: {
    label: 'Feedback',
    emoji: '💡',
    color: 0x3498db,
    description: 'Feature request or general feedback for the team',
  },
} as const

export type ReportType = keyof typeof REPORT_TYPES

export function isReportType(value: string): value is ReportType {
  return value in REPORT_TYPES
}

export const CUSTOM_IDS = {
  reportModal: (type: ReportType) => `scalpel_report_modal:${type}`,
  claim: 'scalpel_report_claim',
  resolve: 'scalpel_report_resolve',
  reopen: 'scalpel_report_reopen',
} as const
