/** Email addresses are always stored and sent lowercase, however they were typed ("Mario.Rossi@Studio.IT" -> "mario.rossi@studio.it"). */
export const lowerEmail = (value: string): string => value.trim().toLowerCase();
