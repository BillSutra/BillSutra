import Image from 'next/image';
import Link from 'next/link';
import React from 'react';

const NotFound = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
            <h1 className="text-4xl font-bold">404 - Not Found</h1>
            <p className="mt-4 text-lg">Sorry, the page you are looking for does not exist.</p>
            <Image src="images/404.svg" alt="Not Found" width={400} height={300} />
            <Link href="/" className="mt-6 text-blue-500 underline">Go back to Home</Link>
        </div>
    );
}

export default NotFound;
