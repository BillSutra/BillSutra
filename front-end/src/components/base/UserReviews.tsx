import React from "react";

const stars = Array.from({ length: 5 }, (_, index) => index);

export default function UserReviews() {
  return (
    <section className="bg-gray-50">
      <div className="mx-auto max-w-6xl px-6 py-16 text-center">
        <h2 className="text-3xl font-extrabold text-gray-900">
          How Useful is BillSutra for Your Business?
        </h2>
        <p className="mt-2 text-sm text-gray-500">Click on a star to rate it</p>
        <div className="mt-6 flex justify-center gap-2">
          {stars.map((star) => (
            <svg
              key={star}
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill={star < 4 ? "#F59E0B" : "#E5E7EB"}
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 2l2.93 5.94 6.56.95-4.75 4.63 1.12 6.53L12 17.77 6.14 20.05l1.12-6.53L2.5 8.89l6.56-.95L12 2z" />
            </svg>
          ))}
        </div>
        <div className="mt-4 text-sm text-gray-600">
          Average rating 4.43 / 5. Vote count: 31863
        </div>
      </div>
    </section>
  );
}
