export default function Disclaimer() {
  return (
    <div
      role="note"
      aria-label="Directory disclaimer"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 sm:px-6"
    >
      <span className="font-semibold">This is not financial advice.</span>{" "}
      DoINeedAMortgageBroker is a directory, not a licensed financial advisor.
      Mortgage decisions should be made with a licensed professional. Listings
      are sourced from public state regulator records and may not reflect
      current license status.
    </div>
  );
}
