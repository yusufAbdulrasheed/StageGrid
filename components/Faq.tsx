const items = [
  {
    q: "Do I need an account to book?",
    a: "Yes. A free account lets us issue your ticket, email it to you and keep every booking in your history. Browsing and searching events never needs one.",
  },
  {
    q: "How do I pay for a ticket?",
    a: "Paid events use Flutterwave checkout (card, bank transfer or USSD). Your ticket is issued the moment the payment clears, and a receipt is emailed to you. Free events are one tap.",
  },
  {
    q: "What if a ticket sells out while I'm paying?",
    a: "We check availability again after payment. If the last seat went first, your payment is refunded automatically and you're told by email.",
  },
  {
    q: "Is it free to host an event?",
    a: "Starting is free: the Starter plan includes 2 live events and 50 attendees each. There's no monthly fee for free events; on paid tickets we keep a small percentage (8% on Starter, 5% on Pro, 3% on Business).",
  },
  {
    q: "How do I get paid?",
    a: "Add your bank account in your workspace settings. Ticket revenue is split at the moment of payment, with your share settled to your bank account by Flutterwave on its normal schedule.",
  },
  {
    q: "Can my team help run the event?",
    a: "Yes. Invite teammates as members or admins. Members can manage events and check guests in; admins also manage the team and settings; the owner controls billing and payouts.",
  },
];

export default function Faq() {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((i) => (
        <details key={i.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium tracking-tight [&::-webkit-details-marker]:hidden">
            {i.q}
            <span className="font-mono text-xl text-faint transition-transform group-open:rotate-45" aria-hidden>+</span>
          </summary>
          <p className="mt-3 max-w-2xl text-muted">{i.a}</p>
        </details>
      ))}
    </div>
  );
}
