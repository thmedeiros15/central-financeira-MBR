export const getLocalDateParts = (isoString: string) => {
  const date = new Date(isoString);
  return {
    day: date.getUTCDate(),
    month: date.getUTCMonth(),
    year: date.getUTCFullYear()
  };
};
