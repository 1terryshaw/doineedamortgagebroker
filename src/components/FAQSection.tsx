"use client";

import { useState } from "react";
import { FAQPageJsonLd } from "./JsonLd";

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQSectionProps {
  items: FAQItem[];
}

export default function FAQSection({ items }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 sm:p-8">
      <FAQPageJsonLd items={items} />
      <h2 className="text-xl font-bold text-[#0f2a4a] mb-4">
        Frequently Asked Questions
      </h2>
      <div className="divide-y divide-gray-200">
        {items.map((item, index) => (
          <div key={index} className="py-4 first:pt-0 last:pb-0">
            <button
              onClick={() =>
                setOpenIndex(openIndex === index ? null : index)
              }
              className="flex w-full items-center justify-between text-left"
              aria-expanded={openIndex === index}
            >
              <span className="text-sm font-semibold text-[#0f2a4a] pr-4">
                {item.question}
              </span>
              <svg
                className={`h-5 w-5 flex-shrink-0 text-gray-400 transition-transform ${
                  openIndex === index ? "rotate-180" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                />
              </svg>
            </button>
            {openIndex === index && (
              <p className="mt-3 text-sm leading-relaxed text-gray-600">
                {item.answer}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
