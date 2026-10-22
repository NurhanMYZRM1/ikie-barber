// Sum integer cents to avoid floating point errors such as 0.1 + 0.2.
export function sumMoney(amounts: number[]) {
  return amounts.reduce((total, amount) => total + Math.round(Number(amount) * 100), 0) / 100;
}
export function formatMoney(amount: number, currency = "MYR") {
  const number = new Intl.NumberFormat("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount));
  return `${currency === "MYR" ? "RM" : currency} ${number}`;
}
