/**
 * Attributes for plain text boxes, like a run's name, so browsers and
 * password managers don't mistake them for a login and offer to save them
 */
export const NOT_A_LOGIN = {
  type: "text",
  autoComplete: "off",
  // 1Password, LastPass, Bitwarden and Dashlane each have their own flag
  "data-1p-ignore": true,
  "data-lpignore": "true",
  "data-bwignore": true,
  "data-form-type": "other",
} as const;
