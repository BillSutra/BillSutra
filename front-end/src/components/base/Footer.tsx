import React from "react";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-200">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-6 py-14 md:grid-cols-4">
        <div>
          <div className="text-xl font-extrabold text-white">BillSutra</div>
          <p className="mt-3 text-sm text-gray-400">
            Billing, accounting, and inventory software for small businesses in
            India.
          </p>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Our Products</div>
          <div className="mt-3 space-y-2 text-sm text-gray-400">
            <div>BillSutra App</div>
            <div>GST Accounting</div>
            <div>Inventory Manager</div>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">
            Industry Solutions
          </div>
          <div className="mt-3 space-y-2 text-sm text-gray-400">
            <div>Retail</div>
            <div>Grocery</div>
            <div>Pharmacy</div>
            <div>Restaurant</div>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-white">Contact Info</div>
          <div className="mt-3 space-y-2 text-sm text-gray-400">
            <div>support@billsutra.in</div>
            <div>+91 98765 43210</div>
            <div>Mon - Sat, 9AM to 7PM</div>
          </div>
        </div>
      </div>
      <div className="border-t border-gray-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-gray-500">
          <div>© 2026 BillSutra. All rights reserved.</div>
          <div className="flex gap-4">
            <Link href="/privacy-policy">Privacy Policy</Link>
            <Link href="/terms-of-service">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
